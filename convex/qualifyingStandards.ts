import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import { getCoachFromSession, requireCoach } from './lib/session';

const standardPayloadValidator = {
  id: v.string(),
  coachId: v.optional(v.string()),
  name: v.string(),
  organization: v.union(
    v.literal('Estadual'),
    v.literal('CBDA'),
    v.literal('Troféu Brasil'),
    v.literal('Seletiva'),
    v.literal('Outro')
  ),
  event: v.string(),
  category: v.string(),
  sex: v.optional(v.union(v.literal('M'), v.literal('F'))),
  poolLength: v.union(v.literal(25), v.literal(50)),
  timeCs: v.number(),
  season: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
};

function mapDoc({ _id, _creationTime, clientId, ...rest }: Doc<'qualifyingStandards'>) {
  return { id: clientId, ...rest };
}

export const list = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    if (!coach) return [];

    const docs = await ctx.db
      .query('qualifyingStandards')
      .withIndex('by_coachId', (q) => q.eq('coachId', coach.clientId))
      .collect();

    return docs
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.event.localeCompare(b.event, 'pt-BR'))
      .map(mapDoc);
  },
});

export const upsert = mutation({
  args: {
    sessionToken: v.string(),
    standard: v.object(standardPayloadValidator),
  },
  handler: async (ctx, { sessionToken, standard }) => {
    const coach = await requireCoach(ctx, sessionToken);
    if (!Number.isFinite(standard.timeCs) || standard.timeCs <= 0) {
      throw new ConvexError('Tempo de índice inválido.');
    }

    const existing = await ctx.db
      .query('qualifyingStandards')
      .withIndex('by_clientId', (q) => q.eq('clientId', standard.id))
      .unique();
    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Índice não encontrado ou sem permissão de acesso.');
    }

    const { id, ...fields } = standard;
    const record = {
      ...fields,
      clientId: id,
      coachId: coach.clientId,
      timeCs: Math.round(standard.timeCs),
      createdAt: existing?.createdAt ?? standard.createdAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, record);
    } else {
      await ctx.db.insert('qualifyingStandards', record);
    }
  },
});

export const remove = mutation({
  args: { sessionToken: v.string(), id: v.string() },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('qualifyingStandards')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;
    if (existing.coachId !== coach.clientId) {
      throw new ConvexError('Índice não encontrado ou sem permissão de acesso.');
    }
    await ctx.db.delete(existing._id);
  },
});
