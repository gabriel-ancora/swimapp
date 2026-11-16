import { describe, expect, it } from 'vitest';
import type { RpeLog, WellnessEntry } from '../types/swimming';
import {
  computeLoadMetrics,
  computeSessionLoad,
  evaluateAthleteLoadState,
  evaluateWellnessTrend,
} from './load';

function rpe(date: string, rpeVal: number, mins = 60): RpeLog {
  return {
    id: `rpe-${date}`,
    coachId: 'c1',
    teamId: 't1',
    athleteId: 'a1',
    date,
    rpe: rpeVal,
    durationMinutes: mins,
    load: rpeVal * mins,
    createdAt: '',
    updatedAt: '',
  };
}

function well(date: string, sleep: number, soreness: number, stress: number, mood: number): WellnessEntry {
  return {
    id: `w-${date}`,
    coachId: 'c1',
    teamId: 't1',
    athleteId: 'a1',
    date,
    sleep,
    soreness,
    stress,
    mood,
    totalScore: sleep + soreness + stress + mood,
    createdAt: '',
    updatedAt: date,
  };
}

describe('load & ACWR metrics', () => {
  it('computes session load = RPE * minutes', () => {
    expect(computeSessionLoad(7, 60)).toBe(420);
    expect(computeSessionLoad(12, 50)).toBe(500); // clamped at 10
  });

  it('flags ACWR within 0.8–1.3 as optimal and outside as out of range', () => {
    // 4 weeks of identical 1000 UA/week => ACWR = 1.00
    const steadyLogs = [
      rpe('2026-10-20', 5, 200),
      rpe('2026-10-27', 5, 200),
      rpe('2026-11-03', 5, 200),
      rpe('2026-11-10', 5, 200),
    ];
    const steady = computeLoadMetrics(steadyLogs, '2026-11-16');
    expect(steady.acuteLoad7d).toBe(1000);
    expect(steady.acwr).toBe(1);
    expect(steady.acwrStatus).toBe('optimal');
    expect(steady.acwrOutOfRange).toBe(false);

    // Sudden acute spike: prior 3 weeks 400 each, this week 1200 => total 2400, chronic avg = 600, ACWR = 2.0
    const spikeLogs = [
      rpe('2026-10-20', 4, 100),
      rpe('2026-10-27', 4, 100),
      rpe('2026-11-03', 4, 100),
      rpe('2026-11-14', 8, 150),
    ];
    const spike = computeLoadMetrics(spikeLogs, '2026-11-16');
    expect(spike.acwr).toBe(2);
    expect(spike.acwrStatus).toBe('critical');
    expect(spike.acwrOutOfRange).toBe(true);
  });

  it('computes Foster monotony and strain over 7-day window', () => {
    const logs = [
      rpe('2026-11-10', 5, 60), // 300
      rpe('2026-11-11', 5, 60), // 300
      rpe('2026-11-12', 5, 60), // 300
      rpe('2026-11-13', 5, 60), // 300
      rpe('2026-11-14', 5, 60), // 300
      rpe('2026-11-15', 5, 60), // 300
      // 2026-11-16 rest = 0
    ];
    const m = computeLoadMetrics(logs, '2026-11-16');
    expect(m.acuteLoad7d).toBe(1800);
    // 6 days of 300 + 1 day of 0 => mean = 257.14, SD = 104.98 => monotony = 2.45 > 2.0
    expect(m.monotony).toBeCloseTo(2.45, 2);
    expect(m.monotonyHigh).toBe(true);
    expect(m.strain).toBe(Math.round(1800 * 2.45));
  });
});

describe('wellness trend & combined load state', () => {
  it('detects consistent worsening in wellness scores', () => {
    const entries = [
      well('2026-11-10', 5, 5, 4, 5), // 19
      well('2026-11-11', 4, 4, 4, 4), // 16
      well('2026-11-12', 3, 4, 3, 4), // 14
      well('2026-11-13', 3, 3, 3, 3), // 12
    ];
    const ev = evaluateWellnessTrend(entries);
    expect(ev.status).toBe('risk');
    expect(ev.worseningStreak).toBe(3);
    expect(ev.alertMessage).toBeTruthy();
  });

  it('produces ACWR alerts when out of 0.8–1.3 range', () => {
    const lowLoad = computeLoadMetrics([rpe('2026-10-22', 8, 100), rpe('2026-11-15', 2, 50)], '2026-11-16');
    const wellOk = evaluateWellnessTrend([well('2026-11-16', 4, 4, 4, 4)]);
    const state = evaluateAthleteLoadState(lowLoad, wellOk);
    expect(state.alerts.some((a) => a.includes('ACWR'))).toBe(true);
  });
});
