import { DEFAULT_CATALOG, SAMPLE_WORKOUTS } from '../data/defaultDatabase';
import type {
  BlockType,
  CatalogDatabase,
  IntensityZone,
  Workout,
  WorkoutItem,
  ZoneId,
} from '../types/swimming';

const CATALOG_KEY = 'raia_pro_catalog_v1';
const WORKOUTS_KEY = 'raia_pro_workouts_v1';

export function loadCatalog(): CatalogDatabase {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) {
      localStorage.setItem(CATALOG_KEY, JSON.stringify(DEFAULT_CATALOG));
      return DEFAULT_CATALOG;
    }
    const parsed = JSON.parse(raw) as Partial<CatalogDatabase>;
    return {
      seriesTypes: parsed.seriesTypes?.length ? parsed.seriesTypes : DEFAULT_CATALOG.seriesTypes,
      distances: parsed.distances?.length ? parsed.distances : DEFAULT_CATALOG.distances,
      intervals: parsed.intervals?.length ? parsed.intervals : DEFAULT_CATALOG.intervals,
      equipment: parsed.equipment?.length ? parsed.equipment : DEFAULT_CATALOG.equipment,
      objectives: parsed.objectives?.length ? parsed.objectives : DEFAULT_CATALOG.objectives,
      zones: DEFAULT_CATALOG.zones,
    };
  } catch {
    return DEFAULT_CATALOG;
  }
}

export function saveCatalog(catalog: CatalogDatabase): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
}

export function resetCatalog(): CatalogDatabase {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(DEFAULT_CATALOG));
  return DEFAULT_CATALOG;
}

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY);
    if (!raw) {
      localStorage.setItem(WORKOUTS_KEY, JSON.stringify(SAMPLE_WORKOUTS));
      return SAMPLE_WORKOUTS;
    }
    return JSON.parse(raw) as Workout[];
  } catch {
    return SAMPLE_WORKOUTS;
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
}

export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getItemMeters(item: WorkoutItem): number {
  return Math.max(0, item.reps) * Math.max(0, item.distance);
}

/**
 * Estimates duration in minutes from interval strings like "@ 1:30", "15\" desc.", or distance pace.
 */
export function estimateItemSeconds(item: WorkoutItem): number {
  const meters = getItemMeters(item);
  if (meters === 0) return 0;

  const interval = item.interval.trim();
  const atMatch = interval.match(/@\s*(\d+):(\d{2})/);
  if (atMatch) {
    const perRepSec = parseInt(atMatch[1], 10) * 60 + parseInt(atMatch[2], 10);
    return item.reps * perRepSec;
  }

  // Average pace fallback ~90s per 100m + rest if "desc." is specified
  const swimSeconds = (meters / 100) * 92;
  const restSecMatch = interval.match(/(\d+)\s*"\s*desc/i);
  const restMinMatch = interval.match(/(\d+):(\d{2})\s*desc/i);
  let restSeconds = 0;
  if (restSecMatch) {
    restSeconds = Math.max(0, item.reps - 1) * parseInt(restSecMatch[1], 10);
  } else if (restMinMatch) {
    restSeconds =
      Math.max(0, item.reps - 1) *
      (parseInt(restMinMatch[1], 10) * 60 + parseInt(restMinMatch[2], 10));
  }
  return Math.round(swimSeconds + restSeconds);
}

export interface WorkoutStats {
  totalMeters: number;
  estimatedMinutes: number;
  byBlock: Record<BlockType, number>;
  byZone: Array<{ zone: IntensityZone; meters: number; percent: number }>;
}

export function computeWorkoutStats(items: WorkoutItem[], zones: IntensityZone[]): WorkoutStats {
  const byBlock: Record<BlockType, number> = {
    aquecimento: 0,
    principal: 0,
    complementar: 0,
  };
  const zoneMeters: Record<ZoneId, number> = {
    Z1: 0,
    Z2: 0,
    Z3: 0,
    Z4: 0,
    Z5: 0,
    VEL: 0,
  };

  let totalMeters = 0;
  let totalSeconds = 0;

  for (const item of items) {
    const m = getItemMeters(item);
    totalMeters += m;
    byBlock[item.block] += m;
    zoneMeters[item.zoneId] = (zoneMeters[item.zoneId] || 0) + m;
    totalSeconds += estimateItemSeconds(item);
  }

  const byZone = zones.map((zone) => {
    const meters = zoneMeters[zone.id] || 0;
    const percent = totalMeters > 0 ? Math.round((meters / totalMeters) * 100) : 0;
    return { zone, meters, percent };
  });

  return {
    totalMeters,
    estimatedMinutes: Math.max(0, Math.round(totalSeconds / 60)),
    byBlock,
    byZone,
  };
}

export function formatMeters(meters: number): string {
  return `${meters.toLocaleString('pt-BR')} m`;
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
