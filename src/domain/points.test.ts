import { describe, expect, it } from 'vitest';
import type { Athlete, QualifyingStandard, SwimResult } from '../types/swimming';
import {
  computeBestMarksByEvent,
  computeStandardGap,
  computeWorldAquaticsPoints,
  evaluateAthleteStandards,
  getWorldAquaticsBaseTimeCs,
  normalizeEventName,
} from './points';

describe('normalizeEventName', () => {
  it('normalizes common variants to canonical event names', () => {
    expect(normalizeEventName('100 Crawl')).toBe('100m Livre');
    expect(normalizeEventName('50m borbo')).toBe('50m Borboleta');
    expect(normalizeEventName('200 IM')).toBe('200m Medley');
    expect(normalizeEventName('100m peito')).toBe('100m Peito');
    expect(normalizeEventName('200 Costas')).toBe('200m Costas');
  });
});

describe('World Aquatics points', () => {
  it('returns 1000 points when matching the base time', () => {
    const base = getWorldAquaticsBaseTimeCs('100m Livre', 50, 'M');
    expect(base).toBe(4640);
    expect(computeWorldAquaticsPoints(4640, '100m Livre', 50, 'M')).toBe(1000);
  });

  it('truncates (floors) points using cubic curve', () => {
    // 50.00s vs 46.40s base => 1000 * (46.40 / 50.00)^3 = 799.173 -> 799
    expect(computeWorldAquaticsPoints(5000, '100m Livre', 50, 'M')).toBe(799);
    // Women's 50m Livre 25m pool: 22.83 base -> 25.00s => floor(1000*(22.83/25)^3) = 761
    expect(computeWorldAquaticsPoints(2500, '50m Livre', 25, 'F')).toBe(761);
  });

  it('returns null for unsupported events (like 100m Medley in 50m pool)', () => {
    expect(computeWorldAquaticsPoints(5500, '100m Medley', 50, 'M')).toBeNull();
    expect(computeWorldAquaticsPoints(5500, '100m Medley', 25, 'M')).toBeGreaterThan(700);
  });
});

describe('best marks & qualifying standards', () => {
  const baseResult: Omit<SwimResult, 'id' | 'timeCs' | 'poolLength' | 'isOfficial'> = {
    coachId: 'c1',
    teamId: 't1',
    athleteId: 'a1',
    event: '100m Livre',
    date: '2026-10-10',
    competition: 'Estadual',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
  };

  it('computes best mark automatically per event and pool', () => {
    const results: SwimResult[] = [
      { ...baseResult, id: 'r1', poolLength: 25, timeCs: 5310, isOfficial: true },
      { ...baseResult, id: 'r2', poolLength: 25, timeCs: 5240, isOfficial: false },
      { ...baseResult, id: 'r3', poolLength: 50, timeCs: 5400, isOfficial: true },
    ];

    const bests = computeBestMarksByEvent(results);
    expect(bests).toHaveLength(2);
    expect(bests[0].poolLength).toBe(25);
    expect(bests[0].bestResult.timeCs).toBe(5240);
    expect(bests[0].bestOfficialResult?.timeCs).toBe(5310);
    expect(bests[1].poolLength).toBe(50);
    expect(bests[1].bestResult.timeCs).toBe(5400);
  });

  it('computes exact gap message for qualifying standards', () => {
    const std: QualifyingStandard = {
      id: 'std-1',
      coachId: 'c1',
      name: 'Troféu Brasil',
      organization: 'Troféu Brasil',
      event: '100m Livre',
      category: 'Juvenil',
      sex: 'M',
      poolLength: 50,
      timeCs: 5200,
      createdAt: '',
      updatedAt: '',
    };

    const miss = computeStandardGap(5290, std);
    expect(miss.achieved).toBe(false);
    expect(miss.diffCs).toBe(90);
    expect(miss.message).toBe('Faltam 0,90 s para o índice Troféu Brasil');

    const hit = computeStandardGap(5170, std);
    expect(hit.achieved).toBe(true);
    expect(hit.diffCs).toBe(-30);
    expect(hit.message).toContain('atingido');
  });

  it('filters standards by athlete category and sex', () => {
    const athlete: Athlete = {
      id: 'a1',
      teamId: 't1',
      name: 'Lucas',
      category: 'Juvenil',
      sex: 'M',
      mainEvent: '100m Livre',
      status: 'Ativo',
      notes: '',
      createdAt: '',
      updatedAt: '',
    };
    const results: SwimResult[] = [
      { ...baseResult, id: 'r1', poolLength: 50, timeCs: 5290, isOfficial: true },
    ];
    const standards: QualifyingStandard[] = [
      {
        id: 's1',
        coachId: 'c1',
        name: 'CBDA Juvenil',
        organization: 'CBDA',
        event: '100m Livre',
        category: 'Juvenil',
        sex: 'M',
        poolLength: 50,
        timeCs: 5200,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 's2',
        coachId: 'c1',
        name: 'CBDA Feminino',
        organization: 'CBDA',
        event: '100m Livre',
        category: 'Juvenil',
        sex: 'F',
        poolLength: 50,
        timeCs: 5700,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const evals = evaluateAthleteStandards(athlete, results, standards);
    expect(evals).toHaveLength(1);
    expect(evals[0].standard.name).toBe('CBDA Juvenil');
    expect(evals[0].diffCs).toBe(90);
  });
});
