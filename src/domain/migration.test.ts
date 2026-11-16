import { describe, expect, it } from 'vitest';
import type { Athlete } from '../types/swimming';
import { buildLegacyTimeMigration } from './migration';

describe('legacy bestTime/targetTime migration', () => {
  it('converts legacy text bestTime and targetTime to centiseconds idempotently', () => {
    const athletes: Athlete[] = [
      {
        id: 'ath-1',
        teamId: 'team-1',
        name: 'Lucas',
        category: 'Juvenil',
        mainEvent: '100m Livre',
        bestTime: '52.40',
        targetTime: '50.90',
        events: [
          { id: 'ev-1', event: '200m Livre', bestTime: '1:55,2', targetTime: '1:52.00' },
        ],
        status: 'Ativo',
        notes: '',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
    ];

    const first = buildLegacyTimeMigration(athletes, [], 'coach-1');
    expect(first.resultsToCreate).toHaveLength(2);
    expect(first.resultsToCreate[0]).toMatchObject({
      athleteId: 'ath-1',
      event: '100m Livre',
      poolLength: 25,
      timeCs: 5240,
      isOfficial: false,
    });
    expect(first.resultsToCreate[1]).toMatchObject({
      athleteId: 'ath-1',
      event: '200m Livre',
      poolLength: 25,
      timeCs: 11520,
    });

    expect(first.athletesToUpdate).toHaveLength(1);
    expect(first.athletesToUpdate[0].targetTimeCs).toBe(5090);
    expect(first.athletesToUpdate[0].events?.[0].targetTimeCs).toBe(11200);

    // Running again with the migrated records produces zero new writes.
    const second = buildLegacyTimeMigration(
      first.athletesToUpdate,
      first.resultsToCreate,
      'coach-1'
    );
    expect(second.resultsToCreate).toHaveLength(0);
    expect(second.athletesToUpdate).toHaveLength(0);
  });
});
