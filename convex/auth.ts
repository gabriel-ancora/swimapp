import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { getCoachFromSession, SESSION_TTL_MS, sha256Hex, toCoachProfile } from './lib/session';

/**
 * Session/account storage. Password hashing runs in Node actions
 * (see passwords.ts); these functions only touch the database.
 */

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/** Returns the logged-in coach's profile, or null if the session is invalid/expired. */
export const me = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    return coach ? toCoachProfile(coach) : null;
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const tokenHash = await sha256Hex(sessionToken);
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

export const getCredentials = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const coach = await ctx.db
      .query('coaches')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (!coach) return null;
    return {
      clientId: coach.clientId,
      passwordHash: coach.passwordHash,
      passwordSalt: coach.passwordSalt,
      passwordAlgo: coach.passwordAlgo,
      lockedUntil: coach.lockedUntil,
    };
  },
});

async function insertSession(
  ctx: MutationCtx,
  coachId: string,
  tokenHash: string
) {
  const now = Date.now();
  // Housekeeping: drop this coach's expired sessions.
  const existing = await ctx.db
    .query('sessions')
    .withIndex('by_coachId', (q) => q.eq('coachId', coachId))
    .collect();
  for (const s of existing) {
    if (s.expiresAt <= now) await ctx.db.delete(s._id);
  }
  await ctx.db.insert('sessions', {
    tokenHash,
    coachId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
}

export const createCoachWithSession = internalMutation({
  args: {
    clientId: v.string(),
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    passwordAlgo: v.string(),
    cref: v.string(),
    specialty: v.string(),
    createdAt: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, { tokenHash, ...coach }) => {
    const existing = await ctx.db
      .query('coaches')
      .withIndex('by_email', (q) => q.eq('email', coach.email))
      .unique();
    if (existing) {
      throw new ConvexError('Já existe um treinador cadastrado com este e-mail.');
    }
    const clash = await ctx.db
      .query('coaches')
      .withIndex('by_clientId', (q) => q.eq('clientId', coach.clientId))
      .unique();
    if (clash) {
      throw new ConvexError('Não foi possível criar a conta. Tente novamente.');
    }

    const id = await ctx.db.insert('coaches', { ...coach, failedLoginAttempts: 0 });
    await insertSession(ctx, coach.clientId, tokenHash);
    const doc = await ctx.db.get(id);
    return toCoachProfile(doc!);
  },
});

export const recordLoginFailure = internalMutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const coach = await ctx.db
      .query('coaches')
      .withIndex('by_clientId', (q) => q.eq('clientId', clientId))
      .unique();
    if (!coach) return;
    const attempts = (coach.failedLoginAttempts ?? 0) + 1;
    if (attempts >= MAX_FAILED_LOGINS) {
      await ctx.db.patch(coach._id, {
        failedLoginAttempts: 0,
        lockedUntil: Date.now() + LOCKOUT_MS,
      });
    } else {
      await ctx.db.patch(coach._id, { failedLoginAttempts: attempts });
    }
  },
});

export const completeLogin = internalMutation({
  args: {
    clientId: v.string(),
    tokenHash: v.string(),
    /** Set when a legacy hash was verified and must be replaced. */
    upgrade: v.optional(
      v.object({
        passwordHash: v.string(),
        passwordSalt: v.string(),
        passwordAlgo: v.string(),
      })
    ),
  },
  handler: async (ctx, { clientId, tokenHash, upgrade }) => {
    const coach = await ctx.db
      .query('coaches')
      .withIndex('by_clientId', (q) => q.eq('clientId', clientId))
      .unique();
    if (!coach) throw new ConvexError('E-mail ou senha inválidos.');

    await ctx.db.patch(coach._id, {
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      ...(upgrade ?? {}),
    });
    await insertSession(ctx, clientId, tokenHash);
    return toCoachProfile(coach);
  },
});
