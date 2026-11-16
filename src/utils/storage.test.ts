import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../data/defaultDatabase';
import type { Athlete, Workout, WorkoutItem } from '../types/swimming';
import {
  computeWorkoutStats,
  estimateItemSeconds,
  getItemMeters,
  isWorkoutAssignedToAthlete,
} from './storage';

function item(partial: Partial<WorkoutItem>): WorkoutItem {
  return {
    id: 'it',
    block: 'principal',
    reps: 1,
    distance: 100,
    seriesType: 'Crawl (Livre)',
    interval: '',
    zoneId: 'Z2',
    equipment: [],
    notes: '',
    ...partial,
  };
}

describe('workout math', () => {
  it('computes meters per item and ignores negatives', () => {
    expect(getItemMeters(item({ reps: 8, distance: 50 }))).toBe(400);
    expect(getItemMeters(item({ reps: -2, distance: 50 }))).toBe(0);
  });

  it('estimates time from "@ m:ss" send-off', () => {
    expect(estimateItemSeconds(item({ reps: 10, interval: '@ 1:30' }))).toBe(900);
  });

  it('estimates time from pace + rest ("15\\" desc.")', () => {
    // 4x100: 400m * 0.92s/m = 368s + 3 rests * 15s = 413s
    expect(estimateItemSeconds(item({ reps: 4, interval: '15" desc.' }))).toBe(413);
  });

  it('uses athlete CSS pace instead of fixed 92s/100m when provided', () => {
    // CSS = 75.00s/100m -> Z4 factor 1.00 => 75s/100m
    // 4x100 Z4 with 15" desc: 4 * 75s + 3 * 15s = 345s
    expect(
      estimateItemSeconds(item({ reps: 4, distance: 100, zoneId: 'Z4', interval: '15" desc.' }), 7500)
    ).toBe(345);
  });

  it('aggregates by block and zone', () => {
    const stats = computeWorkoutStats(
      [
        item({ block: 'aquecimento', reps: 1, distance: 400, zoneId: 'Z1' }),
        item({ block: 'principal', reps: 6, distance: 100, zoneId: 'Z4' }),
      ],
      DEFAULT_CATALOG.zones
    );
    expect(stats.totalMeters).toBe(1000);
    expect(stats.byBlock).toEqual({ aquecimento: 400, principal: 600, complementar: 0 });
    expect(stats.byZone.find((z) => z.zone.id === 'Z4')?.percent).toBe(60);
  });
});

describe('isWorkoutAssignedToAthlete', () => {
  const athlete = { id: 'a1', teamId: 't1', category: 'Juvenil' } as Athlete;
  const base = { teamId: 't1' } as Workout;

  it('matches by scope', () => {
    expect(isWorkoutAssignedToAthlete({ ...base, targetScope: 'equipe' }, athlete)).toBe(true);
    expect(
      isWorkoutAssignedToAthlete({ ...base, targetScope: 'categoria', targetCategory: 'Juvenil' }, athlete)
    ).toBe(true);
    expect(
      isWorkoutAssignedToAthlete({ ...base, targetScope: 'categoria', targetCategory: 'Sênior' }, athlete)
    ).toBe(false);
    expect(
      isWorkoutAssignedToAthlete({ ...base, targetScope: 'atletas', targetAthleteIds: ['a1'] }, athlete)
    ).toBe(true);
  });

  it('never matches a workout from another team', () => {
    expect(isWorkoutAssignedToAthlete({ ...base, teamId: 't2' }, athlete)).toBe(false);
  });
});
