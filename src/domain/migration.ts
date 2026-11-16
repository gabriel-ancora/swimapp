import type { Athlete, SwimResult } from '../types/swimming';
import { todayLocalISO } from './date';
import { normalizeEventName } from './points';
import { parseSwimTime } from './time';

export interface MigrationPlanOutput {
  resultsToCreate: SwimResult[];
  athletesToUpdate: Athlete[];
}

function slugEvent(event: string): string {
  return event
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Converts legacy text `bestTime` / `targetTime` fields on athletes into
 * centisecond `SwimResult` records and numeric `targetTimeCs` goals using `parseSwimTime`.
 * Idempotent: skips events that already have a migrated or recorded result.
 */
export function buildLegacyTimeMigration(
  athletes: Athlete[],
  existingResults: SwimResult[],
  coachId: string
): MigrationPlanOutput {
  const existingResultIds = new Set(existingResults.map((r) => r.id));
  const existingAthleteEventSet = new Set(
    existingResults.map((r) => `${r.athleteId}::${normalizeEventName(r.event)}`)
  );

  const resultsToCreate: SwimResult[] = [];
  const athletesToUpdate: Athlete[] = [];
  const now = new Date().toISOString();

  for (const ath of athletes) {
    let athleteDirty = false;
    const nextAthlete: Athlete = {
      ...ath,
      events: ath.events ? ath.events.map((ev) => ({ ...ev })) : undefined,
    };

    const mainEvent = normalizeEventName(ath.mainEvent || 'Livre');
    const mainBestCs = ath.bestTime ? parseSwimTime(ath.bestTime) : null;
    if (mainBestCs !== null && mainEvent) {
      const migId = `res-mig-${ath.id}-${slugEvent(mainEvent) || 'main'}-25`;
      const key = `${ath.id}::${mainEvent}`;
      if (!existingResultIds.has(migId) && !existingAthleteEventSet.has(key)) {
        const fallbackDate = ath.createdAt?.slice(0, 10) || todayLocalISO();
        resultsToCreate.push({
          id: migId,
          coachId,
          teamId: ath.teamId,
          athleteId: ath.id,
          event: mainEvent,
          poolLength: 25,
          timeCs: mainBestCs,
          date: fallbackDate,
          competition: 'Marca anterior (migrada)',
          isOfficial: false,
          notes: 'Convertido automaticamente do campo legado de melhor marca.',
          createdAt: now,
          updatedAt: now,
        });
        existingResultIds.add(migId);
        existingAthleteEventSet.add(key);
      }
    }

    if (ath.targetTime && ath.targetTimeCs === undefined) {
      const parsedTarget = parseSwimTime(ath.targetTime);
      if (parsedTarget !== null) {
        nextAthlete.targetTimeCs = parsedTarget;
        athleteDirty = true;
      }
    }

    if (nextAthlete.events) {
      for (const ev of nextAthlete.events) {
        const evName = normalizeEventName(ev.event);
        if (!evName) continue;

        const evBestCs = ev.bestTime ? parseSwimTime(ev.bestTime) : null;
        if (evBestCs !== null) {
          const migId = `res-mig-${ath.id}-${slugEvent(evName)}-25`;
          const key = `${ath.id}::${evName}`;
          if (!existingResultIds.has(migId) && !existingAthleteEventSet.has(key)) {
            const fallbackDate = ath.createdAt?.slice(0, 10) || todayLocalISO();
            resultsToCreate.push({
              id: migId,
              coachId,
              teamId: ath.teamId,
              athleteId: ath.id,
              event: evName,
              poolLength: 25,
              timeCs: evBestCs,
              date: fallbackDate,
              competition: 'Marca anterior (migrada)',
              isOfficial: false,
              notes: 'Convertido automaticamente do campo legado de melhor marca.',
              createdAt: now,
              updatedAt: now,
            });
            existingResultIds.add(migId);
            existingAthleteEventSet.add(key);
          }
        }

        if (ev.targetTime && ev.targetTimeCs === undefined) {
          const parsedTarget = parseSwimTime(ev.targetTime);
          if (parsedTarget !== null) {
            ev.targetTimeCs = parsedTarget;
            athleteDirty = true;
          }
        }
      }
    }

    if (athleteDirty) {
      nextAthlete.updatedAt = now;
      athletesToUpdate.push(nextAthlete);
    }
  }

  return { resultsToCreate, athletesToUpdate };
}
