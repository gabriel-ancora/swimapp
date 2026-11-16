export type BlockType = 'aquecimento' | 'principal' | 'complementar';

export type ZoneId = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'VEL';

export type PoolLength = 25 | 50;

export type AthleteSex = 'M' | 'F';

export interface IntensityZone {
  id: ZoneId;
  code: string;
  name: string;
  shortLabel: string;
  hrRange: string;
  description: string;
  /** Semantic color tokens for light UI and print */
  accentHex: string;
  bgHex: string;
  borderHex: string;
  textHex: string;
}

export type SeriesCategory = 'Estilo' | 'Técnica' | 'Força/Equip.' | 'Velocidade/Prova';

export interface SeriesTypeOption {
  id: string;
  name: string;
  category: SeriesCategory;
}

export interface CatalogDatabase {
  seriesTypes: SeriesTypeOption[];
  distances: number[];
  intervals: string[];
  equipment: string[];
  objectives: string[];
  zones: IntensityZone[];
}

export interface WorkoutItem {
  id: string;
  block: BlockType;
  reps: number;
  distance: number;
  seriesType: string;
  interval: string;
  zoneId: ZoneId;
  equipment: string[];
  notes: string;
}

export type AthleteStatus = 'Ativo' | 'Recuperação' | 'Inativo';

export interface CoachProfile {
  id: string;
  name: string;
  email: string;
  cref: string;
  specialty: string;
  createdAt: string;
}

export interface Team {
  id: string;
  coachId: string;
  name: string;
  club: string;
  accentColor: string;
  categories: string[];
  weeklyVolumeGoalMeters?: number;
  weeklySessionsGoal: number;
  createdAt: string;
  updatedAt: string;
}

export interface AthleteEventGoal {
  id: string;
  event: string;
  /** Legacy text field kept optional for backwards compatibility; best times come from `results`. */
  bestTime?: string;
  /** Legacy text field kept optional for backwards compatibility. */
  targetTime?: string;
  /** Target time in integer centiseconds. */
  targetTimeCs?: number;
}

export interface Athlete {
  id: string;
  teamId: string;
  name: string;
  category: string;
  sex?: AthleteSex;
  mainEvent: string;
  /** Legacy text field; best mark is now derived automatically from `results`. */
  bestTime?: string;
  /** Legacy text field; migrated to `targetTimeCs`. */
  targetTime?: string;
  /** Target time for mainEvent in integer centiseconds. */
  targetTimeCs?: number;
  events?: AthleteEventGoal[];
  status: AthleteStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwimResult {
  id: string;
  coachId: string;
  teamId: string;
  athleteId: string;
  event: string;
  poolLength: PoolLength;
  /** Time in integer centiseconds. */
  timeCs: number;
  /** Optional split times in integer centiseconds. */
  splitsCs?: number[];
  date: string;
  competition: string;
  isOfficial: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type QualifyingOrganization =
  | 'Estadual'
  | 'CBDA'
  | 'Troféu Brasil'
  | 'Seletiva'
  | 'Outro';

export interface QualifyingStandard {
  id: string;
  coachId: string;
  name: string;
  organization: QualifyingOrganization;
  event: string;
  category: string;
  sex?: AthleteSex;
  poolLength: PoolLength;
  /** Qualifying time in integer centiseconds. */
  timeCs: number;
  season?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CssTest {
  id: string;
  coachId: string;
  teamId: string;
  athleteId: string;
  date: string;
  poolLength: PoolLength;
  /** 400m test time in integer centiseconds. */
  t400Cs: number;
  /** 200m test time in integer centiseconds. */
  t200Cs: number;
  /** Critical Swim Speed pace per 100m in integer centiseconds: (t400Cs - t200Cs) / 2. */
  cssPace100Cs: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RpeLog {
  id: string;
  coachId: string;
  teamId: string;
  athleteId: string;
  workoutId?: string;
  date: string;
  /** Session-RPE on CR-10 scale (0–10). */
  rpe: number;
  durationMinutes: number;
  /** Session load = rpe * durationMinutes (AU). */
  load: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WellnessEntry {
  id: string;
  coachId: string;
  teamId: string;
  athleteId: string;
  date: string;
  /** 1 (worst) to 5 (best). */
  sleep: number;
  /** 1 (worst soreness) to 5 (no soreness). */
  soreness: number;
  /** 1 (very high stress) to 5 (relaxed). */
  stress: number;
  /** 1 (very low mood) to 5 (great mood). */
  mood: number;
  /** Sum of sleep + soreness + stress + mood (4–20). */
  totalScore: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkoutTargetScope = 'equipe' | 'categoria' | 'atletas';

export type PlanType = 'competicao_alvo' | 'tempo_alvo' | 'objetivo_geral';

export type PeriodizationPhaseType =
  | 'base'
  | 'especifico'
  | 'pre_competitivo'
  | 'polimento'
  | 'competicao'
  | 'transicao';

export interface PeriodizationPhase {
  id: string;
  name: string;
  phaseType: PeriodizationPhaseType;
  startDate: string;
  endDate: string;
  focus: string;
  targetZones: ZoneId[];
  intensityLabel: string;
  weeklySessions: number;
  notes: string;
}

export interface TrainingPlan {
  id: string;
  coachId: string;
  teamId?: string;
  title: string;
  planType: PlanType;
  targetScope: WorkoutTargetScope;
  targetCategory?: string;
  targetAthleteId?: string;
  targetAthleteIds?: string[];
  targetEvent?: string;
  targetTime?: string;
  competitionName?: string;
  competitionDate?: string;
  startDate: string;
  endDate: string;
  objective: string;
  notes: string;
  phases: PeriodizationPhase[];
  createdAt: string;
  updatedAt: string;
}

export interface Workout {
  id: string;
  coachId?: string;
  teamId?: string;
  targetScope?: WorkoutTargetScope;
  targetCategory?: string;
  targetAthleteIds?: string[];
  planId?: string;
  phaseId?: string;
  periodizationPhase?: string;
  targetCompetition?: string;
  targetEvent?: string;
  targetTime?: string;
  completed?: boolean;
  absentAthleteIds?: string[];
  title: string;
  date: string;
  poolLength: PoolLength;
  objective: string;
  coach: string;
  generalNotes: string;
  items: WorkoutItem[];
  createdAt: string;
  updatedAt: string;
}

export type ActiveTab =
  | 'novo'
  | 'planejamento'
  | 'treinos'
  | 'painel'
  | 'atletas'
  | 'equipe'
  | 'base';
