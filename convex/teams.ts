import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const teamPayloadValidator = {
  id: v.string(),
  coachId: v.string(),
  name: v.string(),
  club: v.string(),
  accentColor: v.string(),
  categories: v.array(v.string()),
  weeklyVolumeGoalMeters: v.number(),
  weeklySessionsGoal: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
};

export const listByCoach = query({
  args: {
    coachId: v.string(),
  },
  handler: async (ctx, { coachId }) => {
    const docs = await ctx.db
      .query('teams')
      .withIndex('by_coachId', (q) => q.eq('coachId', coachId))
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
    team: v.object(teamPayloadValidator),
  },
  handler: async (ctx, { team }) => {
    const existing = await ctx.db
      .query('teams')
      .withIndex('by_clientId', (q) => q.eq('clientId', team.id))
      .unique();

    const record = {
      clientId: team.id,
      coachId: team.coachId,
      name: team.name,
      club: team.club,
      accentColor: team.accentColor,
      categories: team.categories,
      weeklyVolumeGoalMeters: team.weeklyVolumeGoalMeters,
      weeklySessionsGoal: team.weeklySessionsGoal,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert('teams', record);
    }
  },
});

export const remove = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db
      .query('teams')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
