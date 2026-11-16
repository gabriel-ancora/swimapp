import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { seriesTypeOptionValidator } from './schema';
import { getCoachFromSession, requireCoach } from './lib/session';

/** Shared fallback catalog (read-only from the app). */
const DEFAULT_KEY = 'default';
const coachKey = (coachClientId: string) => `coach:${coachClientId}`;

/** Returns the coach's own catalog, falling back to the shared default. */
export const get = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    if (!coach) return null;

    const own = await ctx.db
      .query('catalogs')
      .withIndex('by_key', (q) => q.eq('key', coachKey(coach.clientId)))
      .unique();
    const doc =
      own ??
      (await ctx.db
        .query('catalogs')
        .withIndex('by_key', (q) => q.eq('key', DEFAULT_KEY))
        .unique());

    if (!doc) return null;

    return {
      seriesTypes: doc.seriesTypes,
      distances: doc.distances,
      intervals: doc.intervals,
      equipment: doc.equipment,
      objectives: doc.objectives,
    };
  },
});

/** Saves the coach's own catalog — never touches other coaches' data. */
export const save = mutation({
  args: {
    sessionToken: v.string(),
    seriesTypes: v.array(seriesTypeOptionValidator),
    distances: v.array(v.number()),
    intervals: v.array(v.string()),
    equipment: v.array(v.string()),
    objectives: v.array(v.string()),
  },
  handler: async (ctx, { sessionToken, ...catalog }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const key = coachKey(coach.clientId);
    const existing = await ctx.db
      .query('catalogs')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();

    const record = { key, ...catalog };
    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert('catalogs', record);
    }
  },
});
