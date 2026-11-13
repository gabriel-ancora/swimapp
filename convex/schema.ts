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
    .index('by_updatedAt', ['updatedAt']),

  catalogs: defineTable({
    key: v.string(),
    seriesTypes: v.array(seriesTypeOptionValidator),
    distances: v.array(v.number()),
    intervals: v.array(v.string()),
    equipment: v.array(v.string()),
    objectives: v.array(v.string()),
  }).index('by_key', ['key']),
});
