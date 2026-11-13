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
  weeklyVolumeGoalMeters: number;
  weeklySessionsGoal: number;
  createdAt: string;
  updatedAt: string;
}

export interface Athlete {
  id: string;
  teamId: string;
  name: string;
  category: string;
  mainEvent: string;
  bestTime: string;
  status: AthleteStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkoutTargetScope = 'equipe' | 'categoria' | 'atletas';

export interface Workout {
  id: string;
  coachId?: string;
  teamId?: string;
  targetScope?: WorkoutTargetScope;
  targetCategory?: string;
  targetAthleteIds?: string[];
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

export type ActiveTab = 'novo' | 'treinos' | 'painel' | 'base';
export type ActiveTab = 'novo' | 'treinos' | 'painel' | 'atletas' | 'equipe' | 'base';
