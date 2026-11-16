import { mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { periodizationPhaseValidator } from './schema';
import { getCoachFromSession, requireCoach, requireOwnedTeam } from './lib/session';

const planPayloadValidator = {
  id: v.string(),
  /** Ignored by the server: the owner always comes from the session. */
  coachId: v.optional(v.string()),
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

export const list = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    if (!coach) return [];

    const docs = await ctx.db
      .query('plans')
      .withIndex('by_coachId', (q) => q.eq('coachId', coach.clientId))
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
    sessionToken: v.string(),
    plan: v.object(planPayloadValidator),
  },
  handler: async (ctx, { sessionToken, plan }) => {
    const coach = await requireCoach(ctx, sessionToken);
    if (plan.teamId) await requireOwnedTeam(ctx, coach, plan.teamId);

    const existing = await ctx.db
      .query('plans')
      .withIndex('by_clientId', (q) => q.eq('clientId', plan.id))
      .unique();
    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Planejamento não encontrado ou sem permissão de acesso.');
    }

    const record = {
      clientId: plan.id,
      coachId: coach.clientId,
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
      createdAt: existing?.createdAt ?? plan.createdAt,
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
    sessionToken: v.string(),
    id: v.string(),
  },
  handler: async (ctx, { sessionToken, id }) => {
    const coach = await requireCoach(ctx, sessionToken);
    const existing = await ctx.db
      .query('plans')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;
    if (existing.coachId !== coach.clientId) {
      throw new ConvexError('Planejamento não encontrado ou sem permissão de acesso.');
    }
    await ctx.db.delete(existing._id);
  },
});
