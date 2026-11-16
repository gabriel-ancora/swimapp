import type { RpeLog, WellnessEntry } from '../types/swimming';
import { addDaysISO, todayLocalISO } from './date';

export const ACWR_MIN_SAFE = 0.8;
export const ACWR_MAX_SAFE = 1.3;
export const ACWR_CRITICAL_HIGH = 1.5;
export const MONOTONY_ALERT_THRESHOLD = 2.0;

/** Session load = RPE (0–10) × duration in minutes. */
export function computeSessionLoad(rpe: number, durationMinutes: number): number {
  const safeRpe = Math.max(0, Math.min(10, Number.isFinite(rpe) ? rpe : 0));
  const safeMin = Math.max(0, Number.isFinite(durationMinutes) ? durationMinutes : 0);
  return Math.round(safeRpe * safeMin);
}

export type AcwrStatus = 'optimal' | 'low' | 'high' | 'critical' | 'insufficient';

export interface DailyLoadPoint {
  date: string;
  load: number;
}

export interface LoadMetrics {
  referenceDate: string;
  totalLogs: number;
  acuteLoad7d: number;
  chronicLoad28dTotal: number;
  chronicWeeklyAvg: number;
  acwr: number | null;
  acwrStatus: AcwrStatus;
  acwrOutOfRange: boolean;
  monotony: number | null;
  monotonyHigh: boolean;
  strain: number | null;
  dailyLoads7d: DailyLoadPoint[];
  dailyLoads28d: DailyLoadPoint[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Computes rolling 7:28 ACWR, Foster Monotony and Training Strain from session-RPE logs.
 * Daily totals include 0 on rest days within the 7-day and 28-day windows.
 */
export function computeLoadMetrics(
  rpeLogs: RpeLog[],
  referenceDateISO: string = todayLocalISO()
): LoadMetrics {
  const dailyMap = new Map<string, number>();
  for (const log of rpeLogs) {
    if (!log.date) continue;
    const load = Number.isFinite(log.load) ? log.load : computeSessionLoad(log.rpe, log.durationMinutes);
    dailyMap.set(log.date, (dailyMap.get(log.date) ?? 0) + Math.max(0, load));
  }

  const dailyLoads28d: DailyLoadPoint[] = [];
  for (let offset = -27; offset <= 0; offset += 1) {
    const date = addDaysISO(referenceDateISO, offset);
    dailyLoads28d.push({ date, load: dailyMap.get(date) ?? 0 });
  }

  const dailyLoads7d = dailyLoads28d.slice(-7);
  const acuteLoad7d = Math.round(dailyLoads7d.reduce((sum, d) => sum + d.load, 0));
  const chronicLoad28dTotal = Math.round(dailyLoads28d.reduce((sum, d) => sum + d.load, 0));
  const chronicWeeklyAvg = chronicLoad28dTotal / 4;

  let acwr: number | null = null;
  let acwrStatus: AcwrStatus = 'insufficient';

  if (chronicWeeklyAvg > 0) {
    acwr = round2(acuteLoad7d / chronicWeeklyAvg);
    if (acwr < ACWR_MIN_SAFE) acwrStatus = 'low';
    else if (acwr <= ACWR_MAX_SAFE) acwrStatus = 'optimal';
    else if (acwr <= ACWR_CRITICAL_HIGH) acwrStatus = 'high';
    else acwrStatus = 'critical';
  }

  const acwrOutOfRange = acwr !== null && (acwr < ACWR_MIN_SAFE || acwr > ACWR_MAX_SAFE);

  // Foster Training Monotony over 7-day window (mean / population SD)
  const values7 = dailyLoads7d.map((d) => d.load);
  const mean7 = values7.reduce((s, v) => s + v, 0) / 7;
  const variance7 = values7.reduce((s, v) => s + Math.pow(v - mean7, 2), 0) / 7;
  const sd7 = Math.sqrt(variance7);

  let monotony: number | null = 0;
  if (mean7 === 0) {
    monotony = 0;
  } else if (sd7 === 0) {
    monotony = null;
  } else {
    monotony = round2(mean7 / sd7);
  }

  const monotonyHigh = monotony !== null && monotony > MONOTONY_ALERT_THRESHOLD;
  const strain = monotony !== null ? Math.round(acuteLoad7d * monotony) : null;

  return {
    referenceDate: referenceDateISO,
    totalLogs: rpeLogs.length,
    acuteLoad7d,
    chronicLoad28dTotal,
    chronicWeeklyAvg: Math.round(chronicWeeklyAvg),
    acwr,
    acwrStatus,
    acwrOutOfRange,
    monotony,
    monotonyHigh,
    strain,
    dailyLoads7d,
    dailyLoads28d,
  };
}

export type WellnessTrendStatus = 'none' | 'ok' | 'attention' | 'risk';

export interface WellnessEvaluation {
  status: WellnessTrendStatus;
  entriesCount: number;
  latestEntry: WellnessEntry | null;
  latestScore: number | null;
  baselineAvg: number | null;
  delta: number | null;
  worseningStreak: number;
  alertMessage: string | null;
}

/**
 * Evaluates daily wellness entries (4–20 scale, higher = better) and detects
 * consistent worsening (consecutive declines, >= 2.5pt drop vs baseline, or critical low score).
 */
export function evaluateWellnessTrend(entries: WellnessEntry[]): WellnessEvaluation {
  if (entries.length === 0) {
    return {
      status: 'none',
      entriesCount: 0,
      latestEntry: null,
      latestScore: null,
      baselineAvg: null,
      delta: null,
      worseningStreak: 0,
      alertMessage: null,
    };
  }

  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt)
  );
  const latestEntry = sorted[sorted.length - 1];
  const latestScore = latestEntry.totalScore;

  // Count consecutive strictly declining entries ending at the latest entry
  let worseningStreak = 0;
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    if (sorted[i].totalScore < sorted[i - 1].totalScore) {
      worseningStreak += 1;
    } else {
      break;
    }
  }

  const priorWindow = sorted.slice(Math.max(0, sorted.length - 8), sorted.length - 1);
  const baselineAvg =
    priorWindow.length > 0
      ? round2(priorWindow.reduce((sum, e) => sum + e.totalScore, 0) / priorWindow.length)
      : null;

  const recent3 = sorted.slice(-3);
  const recent3Avg =
    recent3.length >= 2
      ? round2(recent3.reduce((sum, e) => sum + e.totalScore, 0) / recent3.length)
      : latestScore;

  const delta = baselineAvg !== null ? round2(latestScore - baselineAvg) : null;
  const rollingDrop = baselineAvg !== null ? baselineAvg - recent3Avg : 0;

  const hasLowDimension =
    latestEntry.sleep <= 2 ||
    latestEntry.soreness <= 2 ||
    latestEntry.stress <= 2 ||
    latestEntry.mood <= 2;

  if (worseningStreak >= 2 || latestScore <= 9 || rollingDrop >= 2.5) {
    const reasons: string[] = [];
    if (worseningStreak >= 2) {
      reasons.push(`${worseningStreak + 1} registros seguidos em queda`);
    }
    if (rollingDrop >= 2.5 && baselineAvg !== null) {
      reasons.push(`queda de ${round2(rollingDrop)} pts vs média recente (${baselineAvg}/20)`);
    }
    if (latestScore <= 9) {
      reasons.push(`wellness crítico (${latestScore}/20)`);
    }
    return {
      status: 'risk',
      entriesCount: entries.length,
      latestEntry,
      latestScore,
      baselineAvg,
      delta,
      worseningStreak,
      alertMessage: `Alerta de wellness: ${reasons.join(' · ')}.`,
    };
  }

  if (latestScore <= 12 || (delta !== null && delta <= -2) || hasLowDimension) {
    return {
      status: 'attention',
      entriesCount: entries.length,
      latestEntry,
      latestScore,
      baselineAvg,
      delta,
      worseningStreak,
      alertMessage: `Wellness em atenção (${latestScore}/20): acompanhar sono, dor e recuperação.`,
    };
  }

  return {
    status: 'ok',
    entriesCount: entries.length,
    latestEntry,
    latestScore,
    baselineAvg,
    delta,
    worseningStreak,
    alertMessage: null,
  };
}

export interface LoadStateEvaluation {
  score: number | null;
  label: string;
  tone: 'optimal' | 'fresh' | 'moderate' | 'fatigue' | 'detraining';
  summary: string;
  recommendation: string;
  alerts: string[];
}

/**
 * Validated athlete load & readiness state combining session-RPE, ACWR, Monotony, Strain and Wellness.
 * Replaces the old heuristic `predictPhysicalState`.
 */
export function evaluateAthleteLoadState(
  load: LoadMetrics,
  wellness: WellnessEvaluation
): LoadStateEvaluation {
  const alerts: string[] = [];

  if (load.acwr !== null && load.acwr < ACWR_MIN_SAFE) {
    alerts.push(
      `ACWR baixo (${load.acwr.toFixed(2)}, abaixo de 0,80): risco de subcarga / destreinamento.`
    );
  } else if (load.acwr !== null && load.acwr > ACWR_CRITICAL_HIGH) {
    alerts.push(
      `ACWR crítico (${load.acwr.toFixed(2)}, acima de 1,50): risco elevado de sobrecarga.`
    );
  } else if (load.acwr !== null && load.acwr > ACWR_MAX_SAFE) {
    alerts.push(
      `ACWR elevado (${load.acwr.toFixed(2)}, acima de 1,30): atenção para pico de carga aguda.`
    );
  }

  if (load.monotonyHigh && load.monotony !== null) {
    alerts.push(
      `Monotonia alta (${load.monotony.toFixed(2)} > 2,00): pouca variação entre dias fortes e leves.`
    );
  }

  if (wellness.status === 'risk' && wellness.alertMessage) {
    alerts.push(wellness.alertMessage);
  } else if (wellness.status === 'attention' && wellness.alertMessage) {
    alerts.push(wellness.alertMessage);
  }

  if (load.totalLogs === 0 && wellness.entriesCount === 0) {
    return {
      score: null,
      label: 'Sem RPE / Wellness',
      tone: 'moderate',
      summary:
        'Nenhum registro de sessão-RPE ou wellness diário lançado ainda para este atleta.',
      recommendation:
        'Registre o RPE (0–10) após os treinos e o wellness diário para liberar ACWR, monotonia, strain e alertas reais.',
      alerts,
    };
  }

  if (load.acwr === null) {
    const baseScore =
      wellness.latestScore !== null ? Math.round((wellness.latestScore / 20) * 100) : 75;
    return {
      score: baseScore,
      label: 'Base em construção',
      tone: wellness.status === 'risk' ? 'fatigue' : 'moderate',
      summary: `Carga aguda 7d: ${load.acuteLoad7d} UA (${load.totalLogs} registro(s) de RPE)${
        wellness.latestScore !== null ? ` · Wellness: ${wellness.latestScore}/20` : ''
      }.`,
      recommendation:
        'Continue registrando RPE após as sessões para consolidar a carga crônica (28d) e o ACWR.',
      alerts,
    };
  }

  // Compute readiness score (0–100) from ACWR + Monotony + Wellness
  let score = 88;
  if (load.acwr > ACWR_CRITICAL_HIGH) score -= 35;
  else if (load.acwr > ACWR_MAX_SAFE) score -= 18;
  else if (load.acwr < ACWR_MIN_SAFE) score -= 16;

  if (load.monotonyHigh) score -= 12;
  if (wellness.status === 'risk') score -= 22;
  else if (wellness.status === 'attention') score -= 10;
  else if (wellness.latestScore !== null && wellness.latestScore >= 17) score += 6;

  score = Math.max(10, Math.min(100, score));

  const metricsSnippet = `ACWR ${load.acwr.toFixed(2)} · Carga 7d ${load.acuteLoad7d} UA${
    load.monotony !== null ? ` · Monotonia ${load.monotony.toFixed(2)}` : ''
  }${load.strain !== null ? ` · Strain ${load.strain}` : ''}${
    wellness.latestScore !== null ? ` · Wellness ${wellness.latestScore}/20` : ''
  }`;

  if (load.acwrStatus === 'critical' || (load.acwrStatus === 'high' && wellness.status === 'risk')) {
    return {
      score,
      label: 'Sobrecarga / Risco alto',
      tone: 'fatigue',
      summary: metricsSnippet,
      recommendation:
        'Reduzir carga imediata (priorizar Z1/Z2 ou folga), revisar intensidade e acompanhar resposta de wellness.',
      alerts,
    };
  }

  if (load.acwrStatus === 'high' || wellness.status === 'risk' || load.monotonyHigh) {
    return {
      score,
      label: 'Atenção de carga',
      tone: 'detraining',
      summary: metricsSnippet,
      recommendation:
        'Modular volume/intensidade nos próximos 2–3 dias para trazer o ACWR para 0,80–1,30 e evitar monotonia.',
      alerts,
    };
  }

  if (load.acwrStatus === 'low') {
    return {
      score,
      label: 'Subcarga (< 0,80)',
      tone: 'fresh',
      summary: metricsSnippet,
      recommendation:
        'Atleta fresco ou com queda recente de estímulo; seguro progredir gradualmente para a faixa 0,80–1,30.',
      alerts,
    };
  }

  return {
    score,
    label: 'Carga ideal (0,80–1,30)',
    tone: 'optimal',
    summary: metricsSnippet,
    recommendation:
      'Relação aguda/crônica dentro da zona segura. Manter progressão planejada e monitoramento diário.',
    alerts,
  };
}
