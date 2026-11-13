import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { workoutItemValidator } from './schema';

const workoutPayloadValidator = {
  id: v.string(),
  title: v.string(),
  date: v.string(),
  poolLength: v.union(v.literal(25), v.literal(50)),
  objective: v.string(),
  coach: v.string(),
  generalNotes: v.string(),
  items: v.array(workoutItemValidator),
  createdAt: v.string(),
  updatedAt: v.string(),
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query('workouts').withIndex('by_updatedAt').order('desc').collect();
    return docs.map((doc) => ({
      id: doc.clientId,
      title: doc.title,
      date: doc.date,
      poolLength: doc.poolLength,
      objective: doc.objective,
      coach: doc.coach,
      generalNotes: doc.generalNotes,
      items: doc.items,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  },
});

export const upsert = mutation({
  args: {
    workout: v.object(workoutPayloadValidator),
  },
  handler: async (ctx, { workout }) => {
    const existing = await ctx.db
      .query('workouts')
      .withIndex('by_clientId', (q) => q.eq('clientId', workout.id))
      .unique();

    const record = {
      clientId: workout.id,
      title: workout.title,
      date: workout.date,
      poolLength: workout.poolLength,
      objective: workout.objective,
      coach: workout.coach,
      generalNotes: workout.generalNotes,
      items: workout.items,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert('workouts', record);
    }
  },
});

export const remove = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db
      .query('workouts')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const seedIfEmpty = mutation({
  args: {
    workouts: v.array(v.object(workoutPayloadValidator)),
  },
  handler: async (ctx, { workouts }) => {
    const first = await ctx.db.query('workouts').first();
    if (first) return;

    for (const workout of workouts) {
      await ctx.db.insert('workouts', {
        clientId: workout.id,
        title: workout.title,
        date: workout.date,
        poolLength: workout.poolLength,
        objective: workout.objective,
        coach: workout.coach,
        generalNotes: workout.generalNotes,
        items: workout.items,
        createdAt: workout.createdAt,
        updatedAt: workout.updatedAt,
      });
    }
  },
});
