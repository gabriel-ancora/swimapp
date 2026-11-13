import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const athletePayloadValidator = {
  id: v.string(),
  teamId: v.string(),
  name: v.string(),
  category: v.string(),
  mainEvent: v.string(),
  bestTime: v.string(),
  status: v.union(v.literal('Ativo'), v.literal('Recuperação'), v.literal('Inativo')),
  notes: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
};

export const listByTeam = query({
  args: {
    teamId: v.string(),
  },
  handler: async (ctx, { teamId }) => {
    const docs = await ctx.db
      .query('athletes')
      .withIndex('by_teamId', (q) => q.eq('teamId', teamId))
      .collect();

    return docs.map((d) => ({
      id: d.clientId,
      teamId: d.teamId,
      name: d.name,
      category: d.category,
      mainEvent: d.mainEvent,
      bestTime: d.bestTime,
      status: d.status,
      notes: d.notes,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  },
});

export const upsert = mutation({
  args: {
    athlete: v.object(athletePayloadValidator),
  },
  handler: async (ctx, { athlete }) => {
    const existing = await ctx.db
      .query('athletes')
      .withIndex('by_clientId', (q) => q.eq('clientId', athlete.id))
      .unique();

    const record = {
      clientId: athlete.id,
      teamId: athlete.teamId,
      name: athlete.name,
      category: athlete.category,
      mainEvent: athlete.mainEvent,
      bestTime: athlete.bestTime,
      status: athlete.status,
      notes: athlete.notes,
      createdAt: athlete.createdAt,
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
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db
      .query('athletes')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
