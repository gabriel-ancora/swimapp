/**
 * Swim time parsing/formatting.
 *
 * Times are handled internally as integer centiseconds so they can be compared,
 * charted and converted. Accepted inputs (comma or dot as decimal separator,
 * optional trailing "s"):
 *   "50.5" · "50.50" · "50,50s" · "52" · "1:02.35" · "1:02" · "16:05.12" · "1:02:03.40"
 */

const TIME_PATTERN =
  /^(?:(\d{1,2}):)??(?:(\d{1,3}):)?(\d{1,3})(?:[.,](\d{1,2}))?\s*s?$/i;

export function parseSwimTime(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  const match = raw.match(TIME_PATTERN);
  if (!match) return null;

  const [, hStr, mStr, sStr, fracStr] = match;
  const hours = hStr ? parseInt(hStr, 10) : 0;
  const minutes = mStr ? parseInt(mStr, 10) : 0;
  const seconds = parseInt(sStr, 10);
  // "50.5" means 50.50, not 50.05
  const centis = fracStr ? parseInt(fracStr.padEnd(2, '0'), 10) : 0;

  // When a larger unit is present, the smaller one must be a proper 0–59 field.
  if (mStr !== undefined && seconds > 59) return null;
  if (hStr !== undefined && minutes > 59) return null;

  const total = ((hours * 60 + minutes) * 60 + seconds) * 100 + centis;
  return total > 0 ? total : null;
}

/** Formats centiseconds as `ss.cc`, `m:ss.cc` or `h:mm:ss.cc`. */
export function formatSwimTime(centiseconds: number): string {
  const cs = Math.max(0, Math.round(centiseconds));
  const centis = cs % 100;
  const totalSeconds = Math.floor(cs / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const cc = String(centis).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${cc}`;
  }
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${cc}`;
  }
  return `${seconds}.${cc}`;
}

export type NormalizeTimeResult = { ok: true; value: string } | { ok: false };

/**
 * Normalizes a user-typed time to the canonical display format.
 * Empty input is valid (field not filled) and returns an empty string.
 */
export function normalizeSwimTime(input: string): NormalizeTimeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: '' };
  const cs = parseSwimTime(trimmed);
  if (cs === null) return { ok: false };
  return { ok: true, value: formatSwimTime(cs) };
}

/**
 * Parses a list of split times (e.g. "26.40, 28.90" or "26,40; 28,90").
 * Returns `null` if any non-empty token fails to parse.
 */
export function parseSplitsInput(input: string): { ok: true; splitsCs: number[] } | { ok: false } {
  const raw = input.trim();
  if (!raw) return { ok: true, splitsCs: [] };
  const tokens = raw
    .split(/[;\n|/]+|,\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const splitsCs: number[] = [];
  for (const token of tokens) {
    const cs = parseSwimTime(token);
    if (cs === null) return { ok: false };
    splitsCs.push(cs);
  }
  return { ok: true, splitsCs };
}

/** Formats a centiseconds delta with comma decimal separator in pt-BR (e.g. "0,90 s"). */
export function formatDiffSeconds(diffCs: number): string {
  const absSeconds = (Math.abs(diffCs) / 100).toFixed(2).replace('.', ',');
  return `${absSeconds} s`;
}

function parseEventDistanceAndStroke(eventName?: string): { distance: number | null; stroke: string } {
  if (!eventName) return { distance: null, stroke: '' };
  const normalized = eventName.trim().toLowerCase();
  const distMatch = normalized.match(/(\d{2,4})/);
  const distance = distMatch ? parseInt(distMatch[1], 10) : null;
  return { distance, stroke: normalized };
}

/**
 * Approximate conversion between 25m (SCM) and 50m (LCM) pool times.
 * Uses extra-turn differential (~0.80s per extra 50m turn for freestyle/back/fly,
 * ~1.00s for breaststroke, ~0.90s for medley) or a ~2% factor when distance is unknown.
 */
export function convertPoolTimeCs(
  timeCs: number,
  fromPool: 25 | 50,
  toPool: 25 | 50,
  eventName?: string
): number {
  if (fromPool === toPool || timeCs <= 0) return Math.round(timeCs);

  const { distance, stroke } = parseEventDistanceAndStroke(eventName);
  let deltaCs: number;

  if (distance && distance >= 50) {
    const extraTurns = distance / 50;
    const perTurnCs = stroke.includes('peito') || stroke.includes('breast')
      ? 100
      : stroke.includes('medley') || stroke.includes('im')
        ? 90
        : 80;
    deltaCs = Math.round(extraTurns * perTurnCs);
  } else {
    deltaCs = Math.round(timeCs * 0.02);
  }

  return fromPool === 25 ? Math.round(timeCs + deltaCs) : Math.max(100, Math.round(timeCs - deltaCs));
}
