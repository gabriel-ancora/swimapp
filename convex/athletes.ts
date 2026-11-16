import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { athleteEventGoalValidator } from './schema';
import { getCoachFromSession, requireCoach, requireOwnedTeam } from './lib/session';

const athletePayloadValidator = {
  id: v.string(),
  teamId: v.string(),
  name: v.string(),
  category: v.string(),
  sex: v.optional(v.union(v.literal('M'), v.literal('F'))),
  mainEvent: v.string(),
  bestTime: v.optional(v.string()),
  targetTime: v.optional(v.string()),
  targetTimeCs: v.optional(v.number()),
  events: v.optional(v.array(athleteEventGoalValidator)),
  status: v.union(v.literal('Ativo'), v.literal('Recuperação'), v.literal('Inativo')),
  notes: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
};

export const listByTeam = query({
  args: {
    sessionToken: v.string(),
    teamId: v.string(),
  },
  handler: async (ctx, { sessionToken, teamId }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    if (!coach) return [];
    const team = await ctx.db
      .query('teams')
      .withIndex('by_clientId', (q) => q.eq('clientId', teamId))
      .unique();
    if (!team || team.coachId !== coach.clientId) return [];

    const docs = await ctx.db
      .query('athletes')
      .withIndex('by_teamId', (q) => q.eq('teamId', teamId))
      .collect();

    return docs.map((d) => ({
      id: d.clientId,
      teamId: d.teamId,
      name: d.name,
      category: d.category,
      sex: d.sex,
      mainEvent: d.mainEvent,
      bestTime: d.bestTime,
      targetTime: d.targetTime,
      targetTimeCs: d.targetTimeCs,
      events: d.events,
      status: d.status,
      notes: d.notes,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  },
});

export const upsert = mutation({
  args: {
    sessionToken: v.string(),
    athlete: v.object(athletePayloadValidator),
  },
  handler: async (ctx, { sessionToken, athlete }) => {
    const coach = await requireCoach(ctx, sessionToken);
    await requireOwnedTeam(ctx, coach, athlete.teamId);

    const existing = await ctx.db
      .query('athletes')
      .withIndex('by_clientId', (q) => q.eq('clientId', athlete.id))
      .unique();
    if (existing) {
      // Also covers moving an athlete: the current team must be ours too.
      await requireOwnedTeam(ctx, coach, existing.teamId);
    }

    const record = {
      clientId: athlete.id,
      teamId: athlete.teamId,
      name: athlete.name,
      category: athlete.category,
      sex: athlete.sex,
      mainEvent: athlete.mainEvent,
      bestTime: athlete.bestTime,
      targetTime: athlete.targetTime,
      targetTimeCs: athlete.targetTimeCs,
      events: athlete.events,
      status: athlete.status,
      notes: athlete.notes,
      createdAt: existing?.createdAt ?? athlete.createdAt,
      updatedAt: athlete.updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert('athletes', record);
    }
  },
});

export const remove = mutation({
  args: {
    sessionToken: v.string(),
    id: v.string(),
  },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('athletes')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;

    await requireOwnedTeam(ctx, coach, existing.teamId);

    const [results, cssTests, rpeLogs, wellness] = await Promise.all([
      ctx.db
        .query('results')
        .withIndex('by_athleteId', (q) => q.eq('athleteId', id))
        .collect(),
      ctx.db
        .query('cssTests')
        .withIndex('by_athleteId', (q) => q.eq('athleteId', id))
        .collect(),
      ctx.db
        .query('rpeLogs')
        .withIndex('by_athleteId', (q) => q.eq('athleteId', id))
        .collect(),
      ctx.db
        .query('wellness')
        .withIndex('by_athleteId', (q) => q.eq('athleteId', id))
        .collect(),
    ]);

    for (const doc of [...results, ...cssTests, ...rpeLogs, ...wellness]) {
      await ctx.db.delete(doc._id);
    }
    await ctx.db.delete(existing._id);
  },
});
