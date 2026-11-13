import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { periodizationPhaseValidator } from './schema';

const planPayloadValidator = {
  id: v.string(),
  coachId: v.string(),
  teamId: v.optional(v.string()),
  title: v.string(),
  planType: v.union(
    v.literal('competicao_alvo'),
    v.literal('tempo_alvo'),
    v.literal('objetivo_geral')
  ),
  targetScope: v.union(v.literal('equipe'), v.literal('categoria'), v.literal('atletas')),
  targetCategory: v.optional(v.string()),
  targetAthleteId: v.optional(v.string()),
  targetAthleteIds: v.optional(v.array(v.string())),
  targetEvent: v.optional(v.string()),
  targetTime: v.optional(v.string()),
  competitionName: v.optional(v.string()),
  competitionDate: v.optional(v.string()),
  startDate: v.string(),
  endDate: v.string(),
  objective: v.string(),
  notes: v.string(),
  phases: v.array(periodizationPhaseValidator),
  createdAt: v.string(),
  updatedAt: v.string(),
};

export const listByCoach = query({
  args: {
    coachId: v.string(),
  },
  handler: async (ctx, { coachId }) => {
    const docs = await ctx.db
      .query('plans')
      .withIndex('by_coachId', (q) => q.eq('coachId', coachId))
      .collect();

    return docs
      .map((d) => ({
        id: d.clientId,
        coachId: d.coachId,
        teamId: d.teamId,
        title: d.title,
        planType: d.planType,
        targetScope: d.targetScope,
        targetCategory: d.targetCategory,
        targetAthleteId: d.targetAthleteId,
        targetAthleteIds: d.targetAthleteIds,
        targetEvent: d.targetEvent,
        targetTime: d.targetTime,
        competitionName: d.competitionName,
        competitionDate: d.competitionDate,
        startDate: d.startDate,
        endDate: d.endDate,
        objective: d.objective,
        notes: d.notes,
        phases: d.phases,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
});

export const upsert = mutation({
  args: {
    plan: v.object(planPayloadValidator),
  },
  handler: async (ctx, { plan }) => {
    const existing = await ctx.db
      .query('plans')
      .withIndex('by_clientId', (q) => q.eq('clientId', plan.id))
      .unique();

    const record = {
      clientId: plan.id,
      coachId: plan.coachId,
      teamId: plan.teamId,
      title: plan.title,
      planType: plan.planType,
      targetScope: plan.targetScope,
      targetCategory: plan.targetCategory,
      targetAthleteId: plan.targetAthleteId,
      targetAthleteIds: plan.targetAthleteIds,
      targetEvent: plan.targetEvent,
      targetTime: plan.targetTime,
      competitionName: plan.competitionName,
      competitionDate: plan.competitionDate,
      startDate: plan.startDate,
      endDate: plan.endDate,
      objective: plan.objective,
      notes: plan.notes,
      phases: plan.phases,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert('plans', record);
    }
  },
});

export const remove = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db
      .query('plans')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
