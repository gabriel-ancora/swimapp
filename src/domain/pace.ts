import type { Athlete, CssTest, Workout, ZoneId } from '../types/swimming';
import { formatSwimTime } from './time';

/**
 * Zone pace multipliers relative to Critical Swim Speed (CSS = 1.00 at Z4 / AN1).
 * Higher factor = slower pace per 100m; lower factor = faster pace per 100m.
 */
export const ZONE_PACE_FACTORS: Record<ZoneId, number> = {
  Z1: 1.22,
  Z2: 1.13,
  Z3: 1.06,
  Z4: 1.0,
  Z5: 0.94,
  VEL: 0.86,
};

/**
 * Computes Critical Swim Speed pace per 100m (in integer centiseconds) from 400m and 200m tests:
 * CSS (m/s) = (400 - 200) / (T400 - T200) => pace per 100m = (T400 - T200) / 2.
 * Returns null if inputs are invalid (e.g. T400 <= T200).
 */
export function computeCssPace100Cs(t400Cs: number, t200Cs: number): number | null {
  if (!Number.isFinite(t400Cs) || !Number.isFinite(t200Cs)) return null;
  if (t400Cs <= 0 || t200Cs <= 0) return null;
  if (t400Cs <= t200Cs) return null;
  const diff = t400Cs - t200Cs;
  return Math.round(diff / 2);
}

/** Computes target pace per 100m (in centiseconds) for a given intensity zone. */
export function getZoneTargetPace100Cs(cssPace100Cs: number, zoneId: ZoneId): number {
  const factor = ZONE_PACE_FACTORS[zoneId] ?? 1.0;
  return Math.max(100, Math.round(cssPace100Cs * factor));
}

/** Computes target pace per 100m in seconds for duration estimation. */
export function getZoneTargetPace100Seconds(cssPace100Cs: number, zoneId: ZoneId): number {
  return getZoneTargetPace100Cs(cssPace100Cs, zoneId) / 100;
}

/** Computes target swim time (in centiseconds) for a repetition of `distanceMeters` in `zoneId`. */
export function getSeriesTargetTimeCs(
  cssPace100Cs: number,
  zoneId: ZoneId,
  distanceMeters: number
): number {
  if (distanceMeters <= 0 || cssPace100Cs <= 0) return 0;
  const pace100 = getZoneTargetPace100Cs(cssPace100Cs, zoneId);
  return Math.round(pace100 * (distanceMeters / 100));
}

export interface ZonePaceTarget {
  zoneId: ZoneId;
  factor: number;
  pace100Cs: number;
  pace100Text: string;
}

export function getAllZonePaces(cssPace100Cs: number): ZonePaceTarget[] {
  const order: ZoneId[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'VEL'];
  return order.map((zoneId) => {
    const pace100Cs = getZoneTargetPace100Cs(cssPace100Cs, zoneId);
    return {
      zoneId,
      factor: ZONE_PACE_FACTORS[zoneId],
      pace100Cs,
      pace100Text: formatSwimTime(pace100Cs),
    };
  });
}

/** Returns the most recent CSS test for an athlete (sorting by date descending, then updatedAt). */
export function getLatestCssForAthlete(cssTests: CssTest[], athleteId: string): CssTest | null {
  const list = cssTests
    .filter((t) => t.athleteId === athleteId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  return list[0] ?? null;
}

function matchesWorkoutAthlete(workout: Workout, athlete: Athlete): boolean {
  if (workout.teamId && workout.teamId !== athlete.teamId) return false;
  const scope = workout.targetScope ?? 'equipe';
  if (scope === 'equipe') return true;
  if (scope === 'categoria') return workout.targetCategory === athlete.category;
  if (scope === 'atletas') return Boolean(workout.targetAthleteIds?.includes(athlete.id));
  return false;
}

/**
 * Resolves the effective CSS pace (cs/100m) for a workout based on its targeted athletes.
 * Averages the latest CSS pace of targeted athletes who have a recorded CSS test.
 * Returns undefined if no targeted athlete has a CSS test yet.
 */
export function resolveWorkoutCssPace100Cs(
  workout: Workout,
  athletes: Athlete[],
  cssTests: CssTest[]
): number | undefined {
  if (athletes.length === 0 || cssTests.length === 0) return undefined;
  const targeted = athletes.filter((a) => matchesWorkoutAthlete(workout, a));
  const paces: number[] = [];
  for (const ath of targeted) {
    const latest = getLatestCssForAthlete(cssTests, ath.id);
    if (latest) paces.push(latest.cssPace100Cs);
  }
  if (paces.length === 0) return undefined;
  return Math.round(paces.reduce((sum, p) => sum + p, 0) / paces.length);
}
