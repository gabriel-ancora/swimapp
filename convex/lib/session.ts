import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** SHA-256 hex digest. Session tokens are stored hashed, never in plain text. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Resolves the coach that owns a session token, or null if the token is
 * missing, unknown or expired. Works in queries and mutations.
 */
export async function getCoachFromSession(
  ctx: QueryCtx,
  sessionToken: string | undefined
): Promise<Doc<'coaches'> | null> {
  if (!sessionToken) return null;
  const tokenHash = await sha256Hex(sessionToken);
  const session = await ctx.db
    .query('sessions')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .unique();
  if (!session || session.expiresAt <= Date.now()) return null;

  return await ctx.db
    .query('coaches')
    .withIndex('by_clientId', (q) => q.eq('clientId', session.coachId))
    .unique();
}

/** Same as getCoachFromSession but throws — use in mutations. */
export async function requireCoach(
  ctx: QueryCtx,
  sessionToken: string | undefined
): Promise<Doc<'coaches'>> {
  const coach = await getCoachFromSession(ctx, sessionToken);
  if (!coach) {
    throw new ConvexError('Sessão expirada ou inválida. Entre novamente.');
  }
  return coach;
}

/** Loads a team and guarantees it belongs to the coach. */
export async function requireOwnedTeam(
  ctx: QueryCtx,
  coach: Doc<'coaches'>,
  teamId: string
): Promise<Doc<'teams'>> {
  const team = await ctx.db
    .query('teams')
    .withIndex('by_clientId', (q) => q.eq('clientId', teamId))
    .unique();
  if (!team || team.coachId !== coach.clientId) {
    throw new ConvexError('Equipe não encontrada ou sem permissão de acesso.');
  }
  return team;
}

/** Loads an athlete and guarantees their team belongs to the coach. */
export async function requireOwnedAthlete(
  ctx: QueryCtx,
  coach: Doc<'coaches'>,
  athleteId: string
): Promise<Doc<'athletes'>> {
  const athlete = await ctx.db
    .query('athletes')
    .withIndex('by_clientId', (q) => q.eq('clientId', athleteId))
    .unique();
  if (!athlete) {
    throw new ConvexError('Atleta não encontrado ou sem permissão de acesso.');
  }
  await requireOwnedTeam(ctx, coach, athlete.teamId);
  return athlete;
}

export function toCoachProfile(coach: Doc<'coaches'>) {
  return {
    id: coach.clientId,
    name: coach.name,
    email: coach.email,
    cref: coach.cref,
    specialty: coach.specialty,
    createdAt: coach.createdAt,
  };
}
