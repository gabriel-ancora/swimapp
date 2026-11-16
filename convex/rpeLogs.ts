import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import {
  getCoachFromSession,
  requireCoach,
  requireOwnedAthlete,
  requireOwnedTeam,
} from './lib/session';

const rpePayloadValidator = {
  id: v.string(),
  coachId: v.optional(v.string()),
  teamId: v.string(),
  athleteId: v.string(),
  workoutId: v.optional(v.string()),
  date: v.string(),
  rpe: v.number(),
  durationMinutes: v.number(),
  load: v.optional(v.number()),
  notes: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
};

function mapDoc({ _id, _creationTime, clientId, ...rest }: Doc<'rpeLogs'>) {
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
      .query('rpeLogs')
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
    rpeLog: v.object(rpePayloadValidator),
  },
  handler: async (ctx, { sessionToken, rpeLog }) => {
    const coach = await requireCoach(ctx, sessionToken);
    await requireOwnedTeam(ctx, coach, rpeLog.teamId);
    const athlete = await requireOwnedAthlete(ctx, coach, rpeLog.athleteId);
    if (athlete.teamId !== rpeLog.teamId) {
      throw new ConvexError('Atleta não pertence à equipe informada.');
    }
    if (!Number.isFinite(rpeLog.rpe) || rpeLog.rpe < 0 || rpeLog.rpe > 10) {
      throw new ConvexError('RPE deve estar entre 0 e 10.');
    }
    if (!Number.isFinite(rpeLog.durationMinutes) || rpeLog.durationMinutes <= 0) {
      throw new ConvexError('Duração em minutos deve ser maior que zero.');
    }

    const existing = await ctx.db
      .query('rpeLogs')
      .withIndex('by_clientId', (q) => q.eq('clientId', rpeLog.id))
      .unique();
    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Registro de RPE não encontrado ou sem permissão de acesso.');
    }

    const load = Math.round(rpeLog.rpe * rpeLog.durationMinutes);
    const { id, ...fields } = rpeLog;
    const record = {
      ...fields,
      clientId: id,
      coachId: coach.clientId,
      load,
      createdAt: existing?.createdAt ?? rpeLog.createdAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, record);
    } else {
      await ctx.db.insert('rpeLogs', record);
    }
  },
});

export const remove = mutation({
  args: { sessionToken: v.string(), id: v.string() },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('rpeLogs')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;
    if (existing.coachId !== coach.clientId) {
      throw new ConvexError('Registro de RPE não encontrado ou sem permissão de acesso.');
    }
    await ctx.db.delete(existing._id);
  },
});
