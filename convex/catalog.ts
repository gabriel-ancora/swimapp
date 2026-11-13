import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { seriesTypeOptionValidator } from './schema';

const DEFAULT_KEY = 'default';

export const get = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query('catalogs')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_KEY))
      .unique();

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

export const save = mutation({
  args: {
    seriesTypes: v.array(seriesTypeOptionValidator),
    distances: v.array(v.number()),
    intervals: v.array(v.string()),
    equipment: v.array(v.string()),
    objectives: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('catalogs')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_KEY))
      .unique();

    const record = {
      key: DEFAULT_KEY,
      seriesTypes: args.seriesTypes,
      distances: args.distances,
      intervals: args.intervals,
      equipment: args.equipment,
      objectives: args.objectives,
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert('catalogs', record);
    }
  },
});
