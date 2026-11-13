export type BlockType = 'aquecimento' | 'principal' | 'complementar';

export type ZoneId = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'VEL';

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
  bestTime: string;
  targetTime: string;
}

export interface Athlete {
  id: string;
  teamId: string;
  name: string;
  category: string;
  mainEvent: string;
  bestTime: string;
  targetTime?: string;
  events?: AthleteEventGoal[];
  status: AthleteStatus;
  notes: string;
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
  title: string;
  date: string;
  poolLength: 25 | 50;
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
