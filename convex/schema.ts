import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const workoutItemValidator = v.object({
  id: v.string(),
  block: v.union(
    v.literal('aquecimento'),
    v.literal('principal'),
    v.literal('complementar')
  ),
  reps: v.number(),
  distance: v.number(),
  seriesType: v.string(),
  interval: v.string(),
  zoneId: v.union(
    v.literal('Z1'),
    v.literal('Z2'),
    v.literal('Z3'),
    v.literal('Z4'),
    v.literal('Z5'),
    v.literal('VEL')
  ),
  equipment: v.array(v.string()),
  notes: v.string(),
});

export const seriesTypeOptionValidator = v.object({
  id: v.string(),
  name: v.string(),
  category: v.union(
    v.literal('Estilo'),
    v.literal('Técnica'),
    v.literal('Força/Equip.'),
    v.literal('Velocidade/Prova')
  ),
});

export default defineSchema({
  workouts: defineTable({
    clientId: v.string(),
    coachId: v.optional(v.string()),
    teamId: v.optional(v.string()),
    targetScope: v.optional(
      v.union(v.literal('equipe'), v.literal('categoria'), v.literal('atletas'))
    ),
    targetCategory: v.optional(v.string()),
    targetAthleteIds: v.optional(v.array(v.string())),
    title: v.string(),
    date: v.string(),
    poolLength: v.union(v.literal(25), v.literal(50)),
    objective: v.string(),
    coach: v.string(),
    generalNotes: v.string(),
    items: v.array(workoutItemValidator),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_coachId', ['coachId'])
    .index('by_updatedAt', ['updatedAt']),

  coaches: defineTable({
    clientId: v.string(),
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    cref: v.string(),
    specialty: v.string(),
    createdAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_email', ['email']),

  teams: defineTable({
    clientId: v.string(),
    coachId: v.string(),
    name: v.string(),
    club: v.string(),
    accentColor: v.string(),
    categories: v.array(v.string()),
    weeklyVolumeGoalMeters: v.number(),
    weeklySessionsGoal: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_coachId', ['coachId']),

  athletes: defineTable({
    clientId: v.string(),
    teamId: v.string(),
    name: v.string(),
    category: v.string(),
    mainEvent: v.string(),
    bestTime: v.string(),
    status: v.union(v.literal('Ativo'), v.literal('Recuperação'), v.literal('Inativo')),
    notes: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_teamId', ['teamId']),

  catalogs: defineTable({
    key: v.string(),
    seriesTypes: v.array(seriesTypeOptionValidator),
    distances: v.array(v.number()),
    intervals: v.array(v.string()),
    equipment: v.array(v.string()),
    objectives: v.array(v.string()),
  }).index('by_key', ['key']),
});
