import { internalMutation, mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { ConvexError, v } from 'convex/values';
import { workoutItemValidator } from './schema';
import { getCoachFromSession, requireCoach, requireOwnedTeam } from './lib/session';

const workoutPayloadValidator = {
  id: v.string(),
  /** Ignored by the server: the owner always comes from the session. */
  coachId: v.optional(v.string()),
  teamId: v.optional(v.string()),
  targetScope: v.optional(
    v.union(v.literal('equipe'), v.literal('categoria'), v.literal('atletas'))
  ),
  targetCategory: v.optional(v.string()),
  targetAthleteIds: v.optional(v.array(v.string())),
  planId: v.optional(v.string()),
  phaseId: v.optional(v.string()),
  periodizationPhase: v.optional(v.string()),
  targetCompetition: v.optional(v.string()),
  targetEvent: v.optional(v.string()),
  targetTime: v.optional(v.string()),
  completed: v.optional(v.boolean()),
  absentAthleteIds: v.optional(v.array(v.string())),
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

function mapWorkoutDoc({ _id, _creationTime, clientId, ...rest }: Doc<'workouts'>) {
  return { id: clientId, ...rest };
}

/** All workouts owned by the logged-in coach, most recently updated first. */
export const list = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const coach = await getCoachFromSession(ctx, sessionToken);
    if (!coach) return [];

    const docs = await ctx.db
      .query('workouts')
      .withIndex('by_coachId', (q) => q.eq('coachId', coach.clientId))
      .collect();

    return docs
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(mapWorkoutDoc);
  },
});

export const upsert = mutation({
  args: {
    sessionToken: v.string(),
    workout: v.object(workoutPayloadValidator),
  },
  handler: async (ctx, { sessionToken, workout }) => {
    const coach = await requireCoach(ctx, sessionToken);
    if (workout.teamId) await requireOwnedTeam(ctx, coach, workout.teamId);

    const existing = await ctx.db
      .query('workouts')
      .withIndex('by_clientId', (q) => q.eq('clientId', workout.id))
      .unique();
    if (existing && existing.coachId !== coach.clientId) {
      throw new ConvexError('Treino não encontrado ou sem permissão de acesso.');
    }

    const { id, ...fields } = workout;
    const record = {
      ...fields,
      clientId: id,
      coachId: coach.clientId,
      createdAt: existing?.createdAt ?? workout.createdAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, record);
    } else {
      await ctx.db.insert('workouts', record);
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
      .query('workouts')
      .withIndex('by_clientId', (q) => q.eq('clientId', id))
      .unique();
    if (!existing) return;
    if (existing.coachId !== coach.clientId) {
      throw new ConvexError('Treino não encontrado ou sem permissão de acesso.');
    }
    await ctx.db.delete(existing._id);
  },
});

/**
 * Inserts sample workouts for a coach who has none yet.
 * Internal only — run from the Convex dashboard/CLI, never from the client.
 */
export const seedIfEmpty = internalMutation({
  args: {
    coachId: v.string(),
    workouts: v.array(v.object(workoutPayloadValidator)),
  },
  handler: async (ctx, { coachId, workouts }) => {
    const first = await ctx.db
      .query('workouts')
      .withIndex('by_coachId', (q) => q.eq('coachId', coachId))
      .first();
    if (first) return;

    for (const { id, ...fields } of workouts) {
      await ctx.db.insert('workouts', { ...fields, clientId: id, coachId });
    }
  },
});
