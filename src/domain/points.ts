import type {
  Athlete,
  AthleteSex,
  PoolLength,
  QualifyingStandard,
  SwimResult,
} from '../types/swimming';
import { formatDiffSeconds, parseSwimTime } from './time';

export const SWIM_EVENTS = [
  '50m Livre',
  '100m Livre',
  '200m Livre',
  '400m Livre',
  '800m Livre',
  '1500m Livre',
  '50m Costas',
  '100m Costas',
  '200m Costas',
  '50m Peito',
  '100m Peito',
  '200m Peito',
  '50m Borboleta',
  '100m Borboleta',
  '200m Borboleta',
  '100m Medley',
  '200m Medley',
  '400m Medley',
] as const;

export type CanonicalSwimEvent = (typeof SWIM_EVENTS)[number];

/**
 * Normalizes free-form Brazilian Portuguese / English event names
 * (e.g. "100 Crawl", "50m borbo", "200 IM") to canonical event labels.
 */
export function normalizeEventName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const distMatch = lower.match(/\b(25|50|100|200|400|800|1500)(?:\s*m)?\b/);
  if (!distMatch) return trimmed;
  const dist = distMatch[1];

  let stroke: string | null = null;
  if (/(livre|crawl|free)/.test(lower)) stroke = 'Livre';
  else if (/(costas|back)/.test(lower)) stroke = 'Costas';
  else if (/(peito|breast)/.test(lower)) stroke = 'Peito';
  else if (/(borbo|fly|butter)/.test(lower)) stroke = 'Borboleta';
  else if (/(medley|\bim\b)/.test(lower)) stroke = 'Medley';

  if (!stroke) return trimmed;
  const candidate = `${dist}m ${stroke}`;
  return (SWIM_EVENTS as readonly string[]).includes(candidate) ? candidate : candidate;
}

/**
 * World Aquatics Base Times (1,000 points) for LCM (50m) and SCM (25m).
 * Stored as canonical time strings and parsed once into centiseconds.
 */
const WA_BASE_TIME_STRINGS: Record<
  PoolLength,
  Record<AthleteSex, Partial<Record<CanonicalSwimEvent, string>>>
> = {
  50: {
    M: {
      '50m Livre': '20.91',
      '100m Livre': '46.40',
      '200m Livre': '1:42.00',
      '400m Livre': '3:39.96',
      '800m Livre': '7:32.12',
      '1500m Livre': '14:30.67',
      '50m Costas': '23.55',
      '100m Costas': '51.60',
      '200m Costas': '1:51.92',
      '50m Peito': '25.95',
      '100m Peito': '56.88',
      '200m Peito': '2:05.48',
      '50m Borboleta': '22.27',
      '100m Borboleta': '49.45',
      '200m Borboleta': '1:50.34',
      '200m Medley': '1:52.69',
      '400m Medley': '4:02.50',
    },
    F: {
      '50m Livre': '23.61',
      '100m Livre': '51.71',
      '200m Livre': '1:52.23',
      '400m Livre': '3:54.18',
      '800m Livre': '8:04.12',
      '1500m Livre': '15:20.48',
      '50m Costas': '26.86',
      '100m Costas': '57.13',
      '200m Costas': '2:03.14',
      '50m Peito': '29.16',
      '100m Peito': '1:04.13',
      '200m Peito': '2:17.55',
      '50m Borboleta': '24.43',
      '100m Borboleta': '54.60',
      '200m Borboleta': '2:01.81',
      '200m Medley': '2:05.70',
      '400m Medley': '4:23.65',
    },
  },
  25: {
    M: {
      '50m Livre': '19.90',
      '100m Livre': '44.84',
      '200m Livre': '1:39.37',
      '400m Livre': '3:32.25',
      '800m Livre': '7:20.46',
      '1500m Livre': '14:06.88',
      '50m Costas': '22.11',
      '100m Costas': '48.33',
      '200m Costas': '1:45.63',
      '50m Peito': '24.95',
      '100m Peito': '55.28',
      '200m Peito': '2:00.16',
      '50m Borboleta': '21.50',
      '100m Borboleta': '48.08',
      '200m Borboleta': '1:46.85',
      '100m Medley': '50.26',
      '200m Medley': '1:49.63',
      '400m Medley': '3:55.50',
    },
    F: {
      '50m Livre': '22.83',
      '100m Livre': '50.25',
      '200m Livre': '1:50.31',
      '400m Livre': '3:53.92',
      '800m Livre': '7:57.42',
      '1500m Livre': '15:18.01',
      '50m Costas': '25.25',
      '100m Costas': '54.89',
      '200m Costas': '1:58.83',
      '50m Peito': '28.37',
      '100m Peito': '1:02.36',
      '200m Peito': '2:14.16',
      '50m Borboleta': '24.38',
      '100m Borboleta': '54.05',
      '200m Borboleta': '1:59.61',
      '100m Medley': '56.51',
      '200m Medley': '2:01.86',
      '400m Medley': '4:18.94',
    },
  },
};

export function getWorldAquaticsBaseTimeCs(
  event: string,
  poolLength: PoolLength,
  sex: AthleteSex
): number | null {
  const canonical = normalizeEventName(event) as CanonicalSwimEvent;
  const raw = WA_BASE_TIME_STRINGS[poolLength]?.[sex]?.[canonical];
  if (!raw) return null;
  return parseSwimTime(raw);
}

/**
 * Official World Aquatics point scoring formula:
 * P = floor(1000 * (B / T)^3)
 */
export function computeWorldAquaticsPoints(
  timeCs: number,
  event: string,
  poolLength: PoolLength,
  sex: AthleteSex
): number | null {
  if (timeCs <= 0) return null;
  const baseCs = getWorldAquaticsBaseTimeCs(event, poolLength, sex);
  if (!baseCs) return null;
  return Math.floor(1000 * Math.pow(baseCs / timeCs, 3));
}

export interface BestMarkKey {
  event: string;
  poolLength: PoolLength;
  bestResult: SwimResult;
  bestOfficialResult: SwimResult | null;
}

/**
 * Computes each athlete's personal best automatically per event and pool length (25m / 50m).
 */
export function computeBestMarksByEvent(results: SwimResult[]): BestMarkKey[] {
  const map = new Map<string, { event: string; poolLength: PoolLength; items: SwimResult[] }>();

  for (const res of results) {
    const event = normalizeEventName(res.event);
    const key = `${event}__${res.poolLength}`;
    const entry = map.get(key) ?? { event, poolLength: res.poolLength, items: [] };
    entry.items.push({ ...res, event });
    map.set(key, entry);
  }

  const out: BestMarkKey[] = [];
  for (const entry of map.values()) {
    const sorted = [...entry.items].sort((a, b) => a.timeCs - b.timeCs);
    const officialSorted = sorted.filter((r) => r.isOfficial);
    out.push({
      event: entry.event,
      poolLength: entry.poolLength,
      bestResult: sorted[0],
      bestOfficialResult: officialSorted[0] ?? null,
    });
  }

  return out.sort(
    (a, b) => a.event.localeCompare(b.event, 'pt-BR') || a.poolLength - b.poolLength
  );
}

export interface StandardGapResult {
  standard: QualifyingStandard;
  bestResult: SwimResult | null;
  achieved: boolean | null;
  /** Positive = missing centiseconds; <= 0 = faster than or equal to standard. */
  diffCs: number | null;
  message: string;
}

export function computeStandardGap(
  bestTimeCs: number,
  standard: QualifyingStandard
): { achieved: boolean; diffCs: number; message: string } {
  const diffCs = bestTimeCs - standard.timeCs;
  if (diffCs <= 0) {
    const margin = diffCs === 0 ? 'tempo exato' : `-${formatDiffSeconds(diffCs)}`;
    return {
      achieved: true,
      diffCs,
      message: `Índice ${standard.name} atingido (${margin})`,
    };
  }
  return {
    achieved: false,
    diffCs,
    message: `Faltam ${formatDiffSeconds(diffCs)} para o índice ${standard.name}`,
  };
}

function matchesCategory(standardCat: string, athleteCat: string): boolean {
  const s = standardCat.trim().toLowerCase();
  if (!s || s === 'todas' || s === 'absoluto' || s === 'geral') return true;
  return s === athleteCat.trim().toLowerCase();
}

export function evaluateAthleteStandards(
  athlete: Athlete,
  athleteResults: SwimResult[],
  standards: QualifyingStandard[]
): StandardGapResult[] {
  const bestMarks = computeBestMarksByEvent(athleteResults);

  const relevantStandards = standards.filter((std) => {
    if (std.sex && athlete.sex && std.sex !== athlete.sex) return false;
    return matchesCategory(std.category, athlete.category);
  });

  return relevantStandards
    .map((std) => {
      const normalizedStdEvent = normalizeEventName(std.event);
      const match = bestMarks.find(
        (b) => b.event === normalizedStdEvent && b.poolLength === std.poolLength
      );
      if (!match) {
        return {
          standard: std,
          bestResult: null,
          achieved: null,
          diffCs: null,
          message: `Sem marca em ${normalizedStdEvent} (${std.poolLength}m) para ${std.name}`,
        };
      }
      const gap = computeStandardGap(match.bestResult.timeCs, std);
      return {
        standard: std,
        bestResult: match.bestResult,
        achieved: gap.achieved,
        diffCs: gap.diffCs,
        message: gap.message,
      };
    })
    .sort((a, b) => {
      if (a.achieved !== b.achieved) {
        if (a.achieved === false) return -1;
        if (b.achieved === false) return 1;
        if (a.achieved === true) return 1;
      }
      if (a.diffCs !== null && b.diffCs !== null) return a.diffCs - b.diffCs;
      return a.standard.name.localeCompare(b.standard.name, 'pt-BR');
    });
}
