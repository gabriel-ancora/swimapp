import { describe, expect, it } from 'vitest';
import type { Athlete, CssTest, Workout } from '../types/swimming';
import {
  computeCssPace100Cs,
  getAllZonePaces,
  getSeriesTargetTimeCs,
  getZoneTargetPace100Cs,
  resolveWorkoutCssPace100Cs,
} from './pace';

describe('CSS pace calculations', () => {
  it('computes CSS pace per 100m from 400m and 200m times', () => {
    // T400 = 4:40.00 (28000 cs), T200 = 2:10.00 (13000 cs)
    // CSS = (28000 - 13000) / 2 = 7500 cs = 1:15.00 / 100m
    expect(computeCssPace100Cs(28000, 13000)).toBe(7500);
  });

  it('rejects invalid CSS test times where T400 <= T200', () => {
    expect(computeCssPace100Cs(13000, 13000)).toBeNull();
    expect(computeCssPace100Cs(12000, 13000)).toBeNull();
    expect(computeCssPace100Cs(0, 1000)).toBeNull();
  });

  it('computes individual zone paces Z1–VEL and series target times', () => {
    const css = 7500; // 1:15.00 / 100m
    expect(getZoneTargetPace100Cs(css, 'Z4')).toBe(7500);
    expect(getZoneTargetPace100Cs(css, 'Z1')).toBeGreaterThan(getZoneTargetPace100Cs(css, 'Z2'));
    expect(getZoneTargetPace100Cs(css, 'VEL')).toBeLessThan(getZoneTargetPace100Cs(css, 'Z5'));

    // 200m at Z4 (1:15/100m) = 2:30.00 (15000 cs)
    expect(getSeriesTargetTimeCs(css, 'Z4', 200)).toBe(15000);
    // 50m at Z4 = 37.50s (3750 cs)
    expect(getSeriesTargetTimeCs(css, 'Z4', 50)).toBe(3750);

    const all = getAllZonePaces(css);
    expect(all.map((z) => z.zoneId)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'VEL']);
    expect(all.find((z) => z.zoneId === 'Z4')?.pace100Text).toBe('1:15.00');
  });

  it('resolves latest CSS pace for workout targeted athletes', () => {
    const athletes: Athlete[] = [
      { id: 'a1', teamId: 't1', name: 'Ana', category: 'Juvenil', mainEvent: '100m Livre', status: 'Ativo', notes: '', createdAt: '', updatedAt: '' },
      { id: 'a2', teamId: 't1', name: 'Bia', category: 'Sênior', mainEvent: '200m Livre', status: 'Ativo', notes: '', createdAt: '', updatedAt: '' },
    ];
    const tests: CssTest[] = [
      { id: 'c1', coachId: 'ch', teamId: 't1', athleteId: 'a1', date: '2026-10-01', poolLength: 25, t400Cs: 28000, t200Cs: 13000, cssPace100Cs: 7500, createdAt: '', updatedAt: '1' },
      { id: 'c2', coachId: 'ch', teamId: 't1', athleteId: 'a1', date: '2026-11-01', poolLength: 25, t400Cs: 27400, t200Cs: 12800, cssPace100Cs: 7300, createdAt: '', updatedAt: '2' },
      { id: 'c3', coachId: 'ch', teamId: 't1', athleteId: 'a2', date: '2026-11-01', poolLength: 25, t400Cs: 26600, t200Cs: 12400, cssPace100Cs: 7100, createdAt: '', updatedAt: '2' },
    ];

    const wkJuvenil = { teamId: 't1', targetScope: 'categoria', targetCategory: 'Juvenil' } as Workout;
    expect(resolveWorkoutCssPace100Cs(wkJuvenil, athletes, tests)).toBe(7300);

    const wkTeam = { teamId: 't1', targetScope: 'equipe' } as Workout;
    expect(resolveWorkoutCssPace100Cs(wkTeam, athletes, tests)).toBe(7200);
  });
});
