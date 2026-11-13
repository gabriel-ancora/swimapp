import { mutation } from './_generated/server';
import { v } from 'convex/values';

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`raia_pro_salt_v1:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const register = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    email: v.string(),
    password: v.string(),
    cref: v.string(),
    specialty: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query('coaches')
      .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
      .unique();

    if (existing) {
      throw new Error('Já existe um treinador cadastrado com este e-mail.');
    }

    const passwordHash = await hashPassword(args.password);
    await ctx.db.insert('coaches', {
      clientId: args.id,
      name: args.name.trim(),
      email: normalizedEmail,
      passwordHash,
      cref: args.cref.trim(),
      specialty: args.specialty.trim(),
      createdAt: args.createdAt,
    });

    return {
      id: args.id,
      name: args.name.trim(),
      email: normalizedEmail,
      cref: args.cref.trim(),
      specialty: args.specialty.trim(),
      createdAt: args.createdAt,
    };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const coach = await ctx.db
      .query('coaches')
      .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
      .unique();

    if (!coach) {
      throw new Error('E-mail ou senha inválidos.');
    }

    const passwordHash = await hashPassword(password);
    if (coach.passwordHash !== passwordHash) {
      throw new Error('E-mail ou senha inválidos.');
    }

    return {
      id: coach.clientId,
      name: coach.name,
      email: coach.email,
      cref: coach.cref,
      specialty: coach.specialty,
      createdAt: coach.createdAt,
    };
  },
});
