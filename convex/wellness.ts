import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import {
  getCoachFromSession,
  requireCoach,
  requireOwnedAthlete,
  requireOwnedTeam,
} from './lib/session';

const wellnessPayloadValidator = {
  id: v.string(),
  coachId: v.optional(v.string()),
  teamId: v.string(),
  athleteId: v.string(),
  date: v.string(),
  sleep: v.number(),
  soreness: v.number(),
  stress: v.number(),
  mood: v.number(),
  totalScore: v.optional(v.number()),
  notes: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
};

function mapDoc({ _id, _creationTime, clientId, ...rest }: Doc<'wellness'>) {
  return { id: clientId, ...rest };
}

function isValidScale(n: number): boolean {
  return Number.isFinite(n) && n >= 1 && n <= 5;
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
      .query('wellness')
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
    entry: v.object(wellnessPayloadValidator),
  },
  handler: async (ctx, { sessionToken, entry }) => {
    const coach = await requireCoach(ctx, sessionToken);
    await requireOwnedTeam(ctx, coach, entry.teamId);
    const athlete = await requireOwnedAthlete(ctx, coach, entry.athleteId);
    if (athlete.teamId !== entry.teamId) {
      throw new ConvexError('Atleta não pertence à equipe informada.');
    }
    if (
      !isValidScale(entry.sleep) ||
      !isValidScale(entry.soreness) ||
      !isValidScale(entry.stress) ||
      !isValidScale(entry.mood)
    ) {
      throw new ConvexError('Cada item de wellness deve estar entre 1 e 5.');
    }

    const existing = await ctx.db
      .query('wellness')
      .withIndex('by_clientId', (q) => q.eq('clientId', entry.id))
      .unique();
    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Registro de wellness não encontrado ou sem permissão de acesso.');
    }

    const sleep = Math.round(entry.sleep);
    const soreness = Math.round(entry.soreness);
    const stress = Math.round(entry.stress);
    const mood = Math.round(entry.mood);
    const totalScore = sleep + soreness + stress + mood;

    const { id, ...fields } = entry;
    const record = {
      ...fields,
      clientId: id,
      coachId: coach.clientId,
      sleep,
      soreness,
      stress,
      mood,
      totalScore,
      createdAt: existing?.createdAt ?? entry.createdAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, record);
    } else {
      await ctx.db.insert('wellness', record);
    }
  },
});

export const remove = mutation({
  args: { sessionToken: v.string(), id: v.string() },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('wellness')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;
    if (existing.coachId !== coach.clientId) {
      throw new ConvexError('Registro de wellness não encontrado ou sem permissão de acesso.');
    }
    await ctx.db.delete(existing._id);
  },
});
