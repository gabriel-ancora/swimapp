import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import {
  getCoachFromSession,
  requireCoach,
  requireOwnedAthlete,
  requireOwnedTeam,
} from './lib/session';

const cssTestPayloadValidator = {
  id: v.string(),
  coachId: v.optional(v.string()),
  teamId: v.string(),
  athleteId: v.string(),
  date: v.string(),
  poolLength: v.union(v.literal(25), v.literal(50)),
  t400Cs: v.number(),
  t200Cs: v.number(),
  cssPace100Cs: v.optional(v.number()),
  notes: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
};

function mapDoc({ _id, _creationTime, clientId, ...rest }: Doc<'cssTests'>) {
  return { id: clientId, ...rest };
}

export const listByTeam = query({
  args: { sessionToken: v.string(), teamId: v.string() },
  handler: async (ctx, { sessionToken, teamId }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    if (!coach) return [];
    const team = await ctx.db
      .query('teams')
      .withIndex('by_clientId', (q) => q.eq('clientId', teamId))
      .unique();
    if (!team || team.coachId !== coach.clientId) return [];

    const docs = await ctx.db
      .query('cssTests')
      .withIndex('by_teamId', (q) => q.eq('teamId', teamId))
      .collect();

    return docs
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
      .map(mapDoc);
  },
});

export const upsert = mutation({
  args: {
    sessionToken: v.string(),
    test: v.object(cssTestPayloadValidator),
  },
  handler: async (ctx, { sessionToken, test }) => {
    const coach = await requireCoach(ctx, sessionToken);
    await requireOwnedTeam(ctx, coach, test.teamId);
    const athlete = await requireOwnedAthlete(ctx, coach, test.athleteId);
    if (athlete.teamId !== test.teamId) {
      throw new ConvexError('Atleta não pertence à equipe informada.');
    }
    if (
      !Number.isFinite(test.t400Cs) ||
      !Number.isFinite(test.t200Cs) ||
      test.t400Cs <= 0 ||
      test.t200Cs <= 0 ||
      test.t400Cs <= test.t200Cs
    ) {
      throw new ConvexError('O tempo dos 400m deve ser maior que o dos 200m.');
    }

    const existing = await ctx.db
      .query('cssTests')
      .withIndex('by_clientId', (q) => q.eq('clientId', test.id))
      .unique();
    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Teste de CSS não encontrado ou sem permissão de acesso.');
    }

    const t400Cs = Math.round(test.t400Cs);
    const t200Cs = Math.round(test.t200Cs);
    const cssPace100Cs = Math.round((t400Cs - t200Cs) / 2);

    const { id, ...fields } = test;
    const record = {
      ...fields,
      clientId: id,
      coachId: coach.clientId,
      t400Cs,
      t200Cs,
      cssPace100Cs,
      createdAt: existing?.createdAt ?? test.createdAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, record);
    } else {
      await ctx.db.insert('cssTests', record);
    }
  },
});

export const remove = mutation({
  args: { sessionToken: v.string(), id: v.string() },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('cssTests')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;
    if (existing.coachId !== coach.clientId) {
      throw new ConvexError('Teste de CSS não encontrado ou sem permissão de acesso.');
    }
    await ctx.db.delete(existing._id);
  },
});
