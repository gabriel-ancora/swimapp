import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import {
  getCoachFromSession,
  requireCoach,
  requireOwnedAthlete,
  requireOwnedTeam,
} from './lib/session';

const resultPayloadValidator = {
  id: v.string(),
  coachId: v.optional(v.string()),
  teamId: v.string(),
  athleteId: v.string(),
  event: v.string(),
  poolLength: v.union(v.literal(25), v.literal(50)),
  timeCs: v.number(),
  splitsCs: v.optional(v.array(v.number())),
  date: v.string(),
  competition: v.string(),
  isOfficial: v.boolean(),
  notes: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
};

function mapDoc({ _id, _creationTime, clientId, ...rest }: Doc<'results'>) {
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
      .query('results')
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
    result: v.object(resultPayloadValidator),
  },
  handler: async (ctx, { sessionToken, result }) => {
    const coach = await requireCoach(ctx, sessionToken);
    await requireOwnedTeam(ctx, coach, result.teamId);
    const athlete = await requireOwnedAthlete(ctx, coach, result.athleteId);
    if (athlete.teamId !== result.teamId) {
      throw new ConvexError('Atleta não pertence à equipe informada.');
    }
    if (!Number.isFinite(result.timeCs) || result.timeCs <= 0) {
      throw new ConvexError('Tempo inválido.');
    }

    const existing = await ctx.db
      .query('results')
      .withIndex('by_clientId', (q) => q.eq('clientId', result.id))
      .unique();
    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Resultado não encontrado ou sem permissão de acesso.');
    }

    const { id, ...fields } = result;
    const record = {
      ...fields,
      clientId: id,
      coachId: coach.clientId,
      timeCs: Math.round(result.timeCs),
      splitsCs: result.splitsCs?.map((s) => Math.round(s)),
      createdAt: existing?.createdAt ?? result.createdAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, record);
    } else {
      await ctx.db.insert('results', record);
    }
  },
});

export const remove = mutation({
  args: { sessionToken: v.string(), id: v.string() },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('results')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;
    if (existing.coachId !== coach.clientId) {
      throw new ConvexError('Resultado não encontrado ou sem permissão de acesso.');
    }
    await ctx.db.delete(existing._id);
  },
});
