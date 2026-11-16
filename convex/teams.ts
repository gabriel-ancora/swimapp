import { mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { getCoachFromSession, requireCoach, requireOwnedTeam } from './lib/session';

const teamPayloadValidator = {
  id: v.string(),
  /** Ignored by the server: the owner always comes from the session. */
  coachId: v.optional(v.string()),
  name: v.string(),
  club: v.string(),
  accentColor: v.string(),
  categories: v.array(v.string()),
  weeklyVolumeGoalMeters: v.optional(v.number()),
  weeklySessionsGoal: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
};

export const list = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    if (!coach) return [];

    const docs = await ctx.db
      .query('teams')
      .withIndex('by_coachId', (q) => q.eq('coachId', coach.clientId))
      .collect();

    return docs.map((d) => ({
      id: d.clientId,
      coachId: d.coachId,
      name: d.name,
      club: d.club,
      accentColor: d.accentColor,
      categories: d.categories,
      weeklyVolumeGoalMeters: d.weeklyVolumeGoalMeters,
      weeklySessionsGoal: d.weeklySessionsGoal,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  },
});

export const upsert = mutation({
  args: {
    sessionToken: v.string(),
    team: v.object(teamPayloadValidator),
  },
  handler: async (ctx, { sessionToken, team }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('teams')
      .withIndex('by_clientId', (q) => q.eq('clientId', team.id))
      .unique();

    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Equipe não encontrada ou sem permissão de acesso.');
    }

    const record = {
      clientId: team.id,
      coachId: coach.clientId,
      name: team.name,
      club: team.club,
      accentColor: team.accentColor,
      categories: team.categories,
      weeklyVolumeGoalMeters: team.weeklyVolumeGoalMeters,
      weeklySessionsGoal: team.weeklySessionsGoal,
      createdAt: existing?.createdAt ?? team.createdAt,
      updatedAt: team.updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert('teams', record);
    }
  },
});

/** Deletes a team together with its athletes, plans, workouts and performance logs. */
export const remove = mutation({
  args: {
    sessionToken: v.string(),
    id: v.string(),
  },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const team = await requireOwnedTeam(ctx, coach, id);

    const [athletes, plans, workouts, results, cssTests, rpeLogs, wellness] = await Promise.all([
      ctx.db
        .query('athletes')
        .withIndex('by_teamId', (q) => q.eq('teamId', id))
        .collect(),
      ctx.db
        .query('plans')
        .withIndex('by_teamId', (q) => q.eq('teamId', id))
        .collect(),
      ctx.db
        .query('workouts')
        .withIndex('by_teamId', (q) => q.eq('teamId', id))
        .collect(),
      ctx.db
        .query('results')
        .withIndex('by_teamId', (q) => q.eq('teamId', id))
        .collect(),
      ctx.db
        .query('cssTests')
        .withIndex('by_teamId', (q) => q.eq('teamId', id))
        .collect(),
      ctx.db
        .query('rpeLogs')
        .withIndex('by_teamId', (q) => q.eq('teamId', id))
        .collect(),
      ctx.db
        .query('wellness')
        .withIndex('by_teamId', (q) => q.eq('teamId', id))
        .collect(),
    ]);

    for (const doc of [
      ...athletes,
      ...plans,
      ...workouts,
      ...results,
      ...cssTests,
      ...rpeLogs,
      ...wellness,
    ]) {
      await ctx.db.delete(doc._id);
    }
    await ctx.db.delete(team._id);
  },
});
