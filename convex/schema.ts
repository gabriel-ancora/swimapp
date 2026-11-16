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

export const athleteEventGoalValidator = v.object({
  id: v.string(),
  event: v.string(),
  bestTime: v.optional(v.string()),
  targetTime: v.optional(v.string()),
  targetTimeCs: v.optional(v.number()),
});

export const periodizationPhaseValidator = v.object({
  id: v.string(),
  name: v.string(),
  phaseType: v.union(
    v.literal('base'),
    v.literal('especifico'),
    v.literal('pre_competitivo'),
    v.literal('polimento'),
    v.literal('competicao'),
    v.literal('transicao')
  ),
  startDate: v.string(),
  endDate: v.string(),
  focus: v.string(),
  targetZones: v.array(
    v.union(
      v.literal('Z1'),
      v.literal('Z2'),
      v.literal('Z3'),
      v.literal('Z4'),
      v.literal('Z5'),
      v.literal('VEL')
    )
  ),
  intensityLabel: v.string(),
  weeklySessions: v.number(),
  notes: v.string(),
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
  })
    .index('by_clientId', ['clientId'])
    .index('by_coachId', ['coachId'])
    .index('by_teamId', ['teamId'])
    .index('by_updatedAt', ['updatedAt']),

  coaches: defineTable({
    clientId: v.string(),
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    /** Per-user random salt (hex). Absent on legacy accounts (fixed-salt SHA-256). */
    passwordSalt: v.optional(v.string()),
    /** 'scrypt-v1' for current hashes; absent = legacy, upgraded on next login. */
    passwordAlgo: v.optional(v.string()),
    failedLoginAttempts: v.optional(v.number()),
    /** Epoch ms until which login is blocked after too many failures. */
    lockedUntil: v.optional(v.number()),
    cref: v.string(),
    specialty: v.string(),
    createdAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_email', ['email']),

  sessions: defineTable({
    /** SHA-256 of the session token — the raw token only lives on the client. */
    tokenHash: v.string(),
    coachId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_coachId', ['coachId']),

  teams: defineTable({
    clientId: v.string(),
    coachId: v.string(),
    name: v.string(),
    club: v.string(),
    accentColor: v.string(),
    categories: v.array(v.string()),
    weeklyVolumeGoalMeters: v.optional(v.number()),
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
    sex: v.optional(v.union(v.literal('M'), v.literal('F'))),
    mainEvent: v.string(),
    bestTime: v.optional(v.string()),
    targetTime: v.optional(v.string()),
    targetTimeCs: v.optional(v.number()),
    events: v.optional(v.array(athleteEventGoalValidator)),
    status: v.union(v.literal('Ativo'), v.literal('Recuperação'), v.literal('Inativo')),
    notes: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_teamId', ['teamId']),

  results: defineTable({
    clientId: v.string(),
    coachId: v.string(),
    teamId: v.string(),
    athleteId: v.string(),
    event: v.string(),
    poolLength: v.union(v.literal(25), v.literal(50)),
    timeCs: v.number(),
    splitsCs: v.optional(v.array(v.number())),
    date: v.string(),
    competition: v.string(),
    isOfficial: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_coachId', ['coachId'])
    .index('by_teamId', ['teamId'])
    .index('by_athleteId', ['athleteId']),

  qualifyingStandards: defineTable({
    clientId: v.string(),
    coachId: v.string(),
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
  })
    .index('by_clientId', ['clientId'])
    .index('by_coachId', ['coachId']),

  cssTests: defineTable({
    clientId: v.string(),
    coachId: v.string(),
    teamId: v.string(),
    athleteId: v.string(),
    date: v.string(),
    poolLength: v.union(v.literal(25), v.literal(50)),
    t400Cs: v.number(),
    t200Cs: v.number(),
    cssPace100Cs: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_teamId', ['teamId'])
    .index('by_athleteId', ['athleteId']),

  rpeLogs: defineTable({
    clientId: v.string(),
    coachId: v.string(),
    teamId: v.string(),
    athleteId: v.string(),
    workoutId: v.optional(v.string()),
    date: v.string(),
    rpe: v.number(),
    durationMinutes: v.number(),
    load: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_teamId', ['teamId'])
    .index('by_athleteId', ['athleteId']),

  wellness: defineTable({
    clientId: v.string(),
    coachId: v.string(),
    teamId: v.string(),
    athleteId: v.string(),
    date: v.string(),
    sleep: v.number(),
    soreness: v.number(),
    stress: v.number(),
    mood: v.number(),
    totalScore: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_teamId', ['teamId'])
    .index('by_athleteId', ['athleteId']),

  plans: defineTable({
    clientId: v.string(),
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
  })
    .index('by_clientId', ['clientId'])
    .index('by_coachId', ['coachId'])
    .index('by_teamId', ['teamId']),

  catalogs: defineTable({
    /** 'coach:<coachClientId>' for a coach's own catalog; 'default' is the shared fallback. */
    key: v.string(),
    seriesTypes: v.array(seriesTypeOptionValidator),
    distances: v.array(v.number()),
    intervals: v.array(v.string()),
    equipment: v.array(v.string()),
    objectives: v.array(v.string()),
  }).index('by_key', ['key']),
});
