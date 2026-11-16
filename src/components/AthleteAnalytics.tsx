import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BatteryCharging,
  Clock,
  Flame,
  Gauge,
  HeartPulse,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  UserX,
  Users,
  Waves,
} from 'lucide-react';
import type {
  Athlete,
  CatalogDatabase,
  CssTest,
  QualifyingStandard,
  RpeLog,
  SwimResult,
  Team,
  TrainingPlan,
  WellnessEntry,
  Workout,
  ZoneId,
} from '../types/swimming';
import {
  computeLoadMetrics,
  evaluateAthleteLoadState,
  evaluateWellnessTrend,
} from '../domain/load';
import { getLatestCssForAthlete } from '../domain/pace';
import {
  computeBestMarksByEvent,
  computeWorldAquaticsPoints,
  evaluateAthleteStandards,
  normalizeEventName,
} from '../domain/points';
import { formatSwimTime } from '../domain/time';
import {
  computeWorkoutStats,
  estimateItemSeconds,
  formatDateBR,
  formatMeters,
  getItemMeters,
  isWorkoutAssignedToAthlete,
} from '../utils/storage';
import { CssZonesPanel } from './athlete/CssZonesPanel';
import { LoadAndWellnessPanel } from './athlete/LoadAndWellnessPanel';
import { ResultsAndStandardsPanel } from './athlete/ResultsAndStandardsPanel';

interface AthleteAnalyticsProps {
  activeTeam: Team | null;
  coachId?: string;
  athletes: Athlete[];
  workouts: Workout[];
  plans?: TrainingPlan[];
  catalog: CatalogDatabase;
  results?: SwimResult[];
  standards?: QualifyingStandard[];
  cssTests?: CssTest[];
  rpeLogs?: RpeLog[];
  wellnessEntries?: WellnessEntry[];
  onSaveResult?: (result: SwimResult) => Promise<void> | void;
  onDeleteResult?: (id: string) => Promise<void> | void;
  onSaveStandard?: (standard: QualifyingStandard) => Promise<void> | void;
  onDeleteStandard?: (id: string) => Promise<void> | void;
  onSaveCssTest?: (test: CssTest) => Promise<void> | void;
  onDeleteCssTest?: (id: string) => Promise<void> | void;
  onSaveRpeLog?: (log: RpeLog) => Promise<void> | void;
  onDeleteRpeLog?: (id: string) => Promise<void> | void;
  onSaveWellness?: (entry: WellnessEntry) => Promise<void> | void;
  onDeleteWellness?: (id: string) => Promise<void> | void;
  onSaveAthlete?: (athlete: Athlete) => Promise<void> | void;
  onEditWorkout: (workout: Workout) => void;
  onToggleAthleteAbsence?: (workout: Workout, athleteId: string) => void;
  onGoToTeam: () => void;
}

type PeriodFilter = '7d' | '30d' | '90d' | 'all';
type AthleteSubTab = 'carga' | 'tempos' | 'css';

function computeStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

const noop = () => undefined;

export const AthleteAnalytics: React.FC<AthleteAnalyticsProps> = ({
  activeTeam,
  coachId = '',
  athletes,
  workouts,
  plans = [],
  catalog,
  results = [],
  standards = [],
  cssTests = [],
  rpeLogs = [],
  wellnessEntries = [],
  onSaveResult = noop,
  onDeleteResult = noop,
  onSaveStandard = noop,
  onDeleteStandard = noop,
  onSaveCssTest = noop,
  onDeleteCssTest = noop,
  onSaveRpeLog = noop,
  onDeleteRpeLog = noop,
  onSaveWellness = noop,
  onDeleteWellness = noop,
  onSaveAthlete = noop,
  onEditWorkout,
  onToggleAthleteAbsence,
  onGoToTeam,
}) => {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(
    () => athletes[0]?.id ?? ''
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [subTab, setSubTab] = useState<AthleteSubTab>('carga');
  const [hoveredWorkoutId, setHoveredWorkoutId] = useState<string | null>(null);
  const [todayRef] = useState(() => new Date());

  const filteredRoster = useMemo(() => {
    if (categoryFilter === 'all') return athletes;
    return athletes.filter((a) => a.category === categoryFilter);
  }, [athletes, categoryFilter]);

  const effectiveAthlete = useMemo(() => {
    return (
      filteredRoster.find((a) => a.id === selectedAthleteId) ?? filteredRoster[0] ?? null
    );
  }, [filteredRoster, selectedAthleteId]);

  const periodWorkouts = useMemo(() => {
    const cutoff =
      period === 'all'
        ? null
        : new Date(
            todayRef.getFullYear(),
            todayRef.getMonth(),
            todayRef.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90)
          );

    return workouts
      .filter((w) => {
        if (cutoff && w.date) {
          const parsed = new Date(`${w.date}T00:00:00`);
          if (!Number.isNaN(parsed.getTime()) && parsed < cutoff) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [workouts, period, todayRef]);

  // Statistical + real load/CSS/wellness summary for every athlete in the roster
  const rosterStats = useMemo(() => {
    return filteredRoster.map((athlete) => {
      const latestCss = getLatestCssForAthlete(cssTests, athlete.id);
      const cssPace100Cs = latestCss?.cssPace100Cs;

      const assigned = periodWorkouts.filter((w) => isWorkoutAssignedToAthlete(w, athlete));
      const attended = assigned.filter((w) => !w.absentAthleteIds?.includes(athlete.id));
      const missed = assigned.filter((w) => Boolean(w.absentAthleteIds?.includes(athlete.id)));

      const volumes: number[] = [];
      let totalMeters = 0;
      let totalMinutes = 0;
      let highIntensityMeters = 0;

      for (const wk of attended) {
        const st = computeWorkoutStats(wk.items, catalog.zones, cssPace100Cs);
        volumes.push(st.totalMeters);
        totalMeters += st.totalMeters;
        totalMinutes += st.estimatedMinutes;
        for (const z of st.byZone) {
          if (z.zone.id === 'Z4' || z.zone.id === 'Z5' || z.zone.id === 'VEL') {
            highIntensityMeters += z.meters;
          }
        }
      }

      const sessions = attended.length;
      const avgMeters = sessions > 0 ? Math.round(totalMeters / sessions) : 0;
      const stdDev = computeStdDev(volumes);
      const highPct = totalMeters > 0 ? Math.round((highIntensityMeters / totalMeters) * 100) : 0;

      const athRpe = rpeLogs.filter((l) => l.athleteId === athlete.id);
      const athWellness = wellnessEntries.filter((w) => w.athleteId === athlete.id);
      const loadMetrics = computeLoadMetrics(athRpe);
      const wellnessEval = evaluateWellnessTrend(athWellness);
      const loadState = evaluateAthleteLoadState(loadMetrics, wellnessEval);

      return {
        athlete,
        sessions,
        missedCount: missed.length,
        totalMeters,
        totalMinutes,
        avgMeters,
        stdDev,
        highPct,
        cssPace100Cs,
        loadMetrics,
        wellnessEval,
        loadState,
      };
    });
  }, [filteredRoster, periodWorkouts, catalog.zones, cssTests, rpeLogs, wellnessEntries]);

  // Deep-dive analytics for the selected athlete
  const athleteDetail = useMemo(() => {
    if (!effectiveAthlete) return null;

    const latestCss = getLatestCssForAthlete(cssTests, effectiveAthlete.id);
    const cssPace100Cs = latestCss?.cssPace100Cs;

    const athResults = results.filter((r) => r.athleteId === effectiveAthlete.id);
    const bestMarks = computeBestMarksByEvent(athResults);
    const standardEvals = evaluateAthleteStandards(effectiveAthlete, athResults, standards);

    const assigned = periodWorkouts.filter((w) =>
      isWorkoutAssignedToAthlete(w, effectiveAthlete)
    );
    const attended = assigned.filter((w) => !w.absentAthleteIds?.includes(effectiveAthlete.id));
    const missedWorkouts = assigned.filter((w) =>
      Boolean(w.absentAthleteIds?.includes(effectiveAthlete.id))
    );

    let totalMeters = 0;
    let totalMinutes = 0;
    let totalReps = 0;
    let highIntensityMeters = 0;
    const volumes: number[] = [];

    const zoneMeters: Record<ZoneId, number> = {
      Z1: 0,
      Z2: 0,
      Z3: 0,
      Z4: 0,
      Z5: 0,
      VEL: 0,
    };

    const styleMap = new Map<string, { name: string; meters: number; count: number }>();
    const equipMap = new Map<string, { name: string; meters: number; count: number }>();

    const sessions: Array<{
      workout: Workout;
      stats: ReturnType<typeof computeWorkoutStats>;
      highPct: number;
    }> = [];

    for (const wk of attended) {
      const stats = computeWorkoutStats(wk.items, catalog.zones, cssPace100Cs);
      totalMeters += stats.totalMeters;
      totalMinutes += stats.estimatedMinutes;
      volumes.push(stats.totalMeters);

      let wkHigh = 0;
      for (const item of wk.items) {
        const m = getItemMeters(item);
        totalReps += item.reps;
        zoneMeters[item.zoneId] = (zoneMeters[item.zoneId] || 0) + m;

        if (item.zoneId === 'Z4' || item.zoneId === 'Z5' || item.zoneId === 'VEL') {
          highIntensityMeters += m;
          wkHigh += m;
        }

        const prevStyle = styleMap.get(item.seriesType) ?? {
          name: item.seriesType,
          meters: 0,
          count: 0,
        };
        prevStyle.meters += m;
        prevStyle.count += 1;
        styleMap.set(item.seriesType, prevStyle);

        for (const eq of item.equipment) {
          const prevEq = equipMap.get(eq) ?? { name: eq, meters: 0, count: 0 };
          prevEq.meters += m;
          prevEq.count += 1;
          equipMap.set(eq, prevEq);
        }
      }

      // Also verify estimateItemSeconds usage stays consistent
      void estimateItemSeconds;

      sessions.push({
        workout: wk,
        stats,
        highPct: stats.totalMeters > 0 ? Math.round((wkHigh / stats.totalMeters) * 100) : 0,
      });
    }

    const sessionCount = attended.length;
    const totalAssignedCount = assigned.length;
    const attendanceRate =
      totalAssignedCount > 0 ? Math.round((sessionCount / totalAssignedCount) * 100) : 100;
    const avgMeters = sessionCount > 0 ? Math.round(totalMeters / sessionCount) : 0;
    const stdDev = computeStdDev(volumes);
    const highPct = totalMeters > 0 ? Math.round((highIntensityMeters / totalMeters) * 100) : 0;
    const aerobicPct = totalMeters > 0 ? 100 - highPct : 0;
    const maxSessionMeters = volumes.reduce((m, v) => Math.max(m, v), 0);

    const athRpe = rpeLogs.filter((l) => l.athleteId === effectiveAthlete.id);
    const athWellness = wellnessEntries.filter((w) => w.athleteId === effectiveAthlete.id);
    const loadMetrics = computeLoadMetrics(athRpe);
    const wellnessEval = evaluateWellnessTrend(athWellness);
    const loadState = evaluateAthleteLoadState(loadMetrics, wellnessEval);

    const byZone = catalog.zones.map((zone) => {
      const meters = zoneMeters[zone.id] || 0;
      const percent = totalMeters > 0 ? Math.round((meters / totalMeters) * 100) : 0;
      return { zone, meters, percent };
    });

    const styles = Array.from(styleMap.values()).sort((a, b) => b.meters - a.meters);
    const equipment = Array.from(equipMap.values()).sort((a, b) => b.meters - a.meters);

    const mainNorm = normalizeEventName(effectiveAthlete.mainEvent || '');
    const mainBest25 = bestMarks.find((b) => b.event === mainNorm && b.poolLength === 25);
    const mainBest50 = bestMarks.find((b) => b.event === mainNorm && b.poolLength === 50);

    return {
      athlete: effectiveAthlete,
      latestCss,
      cssPace100Cs,
      bestMarks,
      mainBest25,
      mainBest50,
      standardEvals,
      assigned,
      attended,
      sessionCount,
      totalAssignedCount,
      attendanceRate,
      missedWorkouts,
      loadMetrics,
      wellnessEval,
      loadState,
      totalMeters,
      totalMinutes,
      totalReps,
      avgMeters,
      stdDev,
      highIntensityMeters,
      highPct,
      aerobicPct,
      maxSessionMeters,
      byZone,
      styles,
      equipment,
      sessions,
    };
  }, [
    effectiveAthlete,
    periodWorkouts,
    catalog.zones,
    cssTests,
    results,
    standards,
    rpeLogs,
    wellnessEntries,
  ]);

  const donutSegments = useMemo(() => {
    if (!athleteDetail) return [];
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const segments: Array<
      (typeof athleteDetail.byZone)[number] & {
        dash: number;
        gap: number;
        offset: number;
      }
    > = [];

    for (const z of athleteDetail.byZone) {
      if (z.meters <= 0) continue;
      const ratio =
        athleteDetail.totalMeters > 0 ? z.meters / athleteDetail.totalMeters : 0;
      const dash = ratio * circumference;
      segments.push({
        ...z,
        dash,
        gap: circumference - dash,
        offset,
      });
      offset += dash;
    }

    return segments;
  }, [athleteDetail]);

  if (!activeTeam || athletes.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">Atletas</h1>
            <p className="page-subtitle">
              Desempenho real, testes de CSS, carga interna (sRPE/ACWR) e wellness.
            </p>
          </div>
        </div>

        <div
          className="surface-card card-section"
          style={{ textAlign: 'center', padding: '52px 24px' }}
        >
          <Users size={30} style={{ color: 'var(--ink-muted)', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
            {!activeTeam
              ? 'Nenhuma equipe criada ainda'
              : 'Nenhum atleta cadastrado nesta equipe'}
          </div>
          <p style={{ margin: '0 0 16px 0', color: 'var(--ink-secondary)', fontSize: 13 }}>
            Cadastre sua equipe e seus atletas em Equipe para acompanhar tempos, CSS e ACWR.
          </p>
          <button type="button" className="btn btn-primary" onClick={onGoToTeam}>
            Ir para Equipe
          </button>
        </div>
      </div>
    );
  }

  const activeSession =
    athleteDetail?.sessions.find((s) => s.workout.id === hoveredWorkoutId) ??
    athleteDetail?.sessions[athleteDetail.sessions.length - 1] ??
    null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Atletas</h1>
          <p className="page-subtitle">
            Tempos reais, pontos World Aquatics, CSS, carga interna (sRPE / ACWR) e wellness.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="analytics-filters surface-card"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
      >
        <div className="analytics-filter-group">
          <label>Atleta analisado</label>
          <select
            className="select"
            value={effectiveAthlete?.id ?? ''}
            onChange={(e) => setSelectedAthleteId(e.target.value)}
          >
            {filteredRoster.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.category})
              </option>
            ))}
          </select>
        </div>

        <div className="analytics-filter-group">
          <label>Categoria / grupo</label>
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {activeTeam.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="analytics-filter-group">
          <label>Período</label>
          <div className="segmented">
            {(
              [
                { id: '7d', label: '7d' },
                { id: '30d', label: '30d' },
                { id: '90d', label: '90d' },
                { id: 'all', label: 'Tudo' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={period === opt.id ? 'active' : ''}
                onClick={() => setPeriod(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {athleteDetail && (
        <>
          {/* Athlete Header Summary */}
          <div className="surface-card card-section" style={{ marginBottom: 16 }}>
            <div className="athlete-banner">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                    {athleteDetail.athlete.name}
                  </h2>
                  <span className="db-chip">{athleteDetail.athlete.category}</span>
                  <span className="db-chip">
                    {athleteDetail.athlete.sex === 'F' ? 'Feminino' : 'Masculino'}
                  </span>
                  <span
                    className={`status-badge status-${athleteDetail.athlete.status.toLowerCase()}`}
                  >
                    {athleteDetail.athlete.status}
                  </span>
                  {athleteDetail.latestCss && (
                    <span className="db-chip mono-num">
                      <Gauge size={12} /> CSS:{' '}
                      <strong>{formatSwimTime(athleteDetail.latestCss.cssPace100Cs)}/100m</strong>
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 6 }}>
                  Prova principal: <strong>{athleteDetail.athlete.mainEvent || '—'}</strong>
                  {athleteDetail.mainBest25 && (
                    <>
                      {' '}
                      · 25m:{' '}
                      <strong className="mono-num">
                        {formatSwimTime(athleteDetail.mainBest25.bestResult.timeCs)}
                      </strong>
                      {(() => {
                        const pts = computeWorldAquaticsPoints(
                          athleteDetail.mainBest25.bestResult.timeCs,
                          athleteDetail.mainBest25.event,
                          25,
                          athleteDetail.athlete.sex ?? 'M'
                        );
                        return pts !== null ? ` (${pts} pts WA)` : '';
                      })()}
                    </>
                  )}
                  {athleteDetail.mainBest50 && (
                    <>
                      {' '}
                      · 50m:{' '}
                      <strong className="mono-num">
                        {formatSwimTime(athleteDetail.mainBest50.bestResult.timeCs)}
                      </strong>
                      {(() => {
                        const pts = computeWorldAquaticsPoints(
                          athleteDetail.mainBest50.bestResult.timeCs,
                          athleteDetail.mainBest50.event,
                          50,
                          athleteDetail.athlete.sex ?? 'M'
                        );
                        return pts !== null ? ` (${pts} pts WA)` : '';
                      })()}
                    </>
                  )}
                  {!athleteDetail.mainBest25 && !athleteDetail.mainBest50 && (
                    <> · Sem tempos registrados ainda</>
                  )}
                </div>

                {athleteDetail.standardEvals.length > 0 && (
                  <div className="tag-cloud" style={{ marginTop: 8 }}>
                    {athleteDetail.standardEvals.slice(0, 3).map((ev) => (
                      <span
                        key={ev.standard.id}
                        className={`readiness-badge ${
                          ev.achieved === true
                            ? 'tone-optimal'
                            : ev.achieved === false
                              ? 'tone-detraining'
                              : 'tone-moderate'
                        }`}
                      >
                        {ev.message}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {plans.filter(
                (p) =>
                  (!p.teamId || p.teamId === activeTeam.id) &&
                  (p.targetScope === 'equipe' ||
                    (p.targetScope === 'categoria' &&
                      p.targetCategory === athleteDetail.athlete.category) ||
                    (p.targetScope === 'atletas' &&
                      (p.targetAthleteIds?.includes(athleteDetail.athlete.id) ||
                        p.targetAthleteId === athleteDetail.athlete.id)))
              ).length > 0 && (
                <div className="athlete-goal-box">
                  <div className="metric-label" style={{ marginBottom: 6 }}>
                    Planejamentos ativos
                  </div>
                  <div className="tag-cloud">
                    {plans
                      .filter(
                        (p) =>
                          (!p.teamId || p.teamId === activeTeam.id) &&
                          (p.targetScope === 'equipe' ||
                            (p.targetScope === 'categoria' &&
                              p.targetCategory === athleteDetail.athlete.category) ||
                            (p.targetScope === 'atletas' &&
                              (p.targetAthleteIds?.includes(athleteDetail.athlete.id) ||
                                p.targetAthleteId === athleteDetail.athlete.id)))
                      )
                      .slice(0, 3)
                      .map((p) => (
                        <span key={p.id} className="db-chip">
                          <Target size={12} />
                          <strong>{p.title}</strong>
                          {p.targetTime ? ` · Meta ${p.targetTime}` : ''}
                          {p.competitionDate ? ` (${formatDateBR(p.competitionDate)})` : ''}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Validated Load State (replaces predictPhysicalState heuristic) */}
          <div className="readiness-grid" style={{ marginBottom: 16 }}>
            <section
              className={`surface-card readiness-card tone-${athleteDetail.loadState.tone}`}
            >
              <div className="readiness-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <BatteryCharging size={18} />
                  <span className="metric-label" style={{ margin: 0 }}>
                    Carga interna & prontidão (sRPE / ACWR)
                  </span>
                  <span className={`readiness-badge tone-${athleteDetail.loadState.tone}`}>
                    {athleteDetail.loadState.label}
                  </span>
                </div>
                <div className="readiness-score mono-num">
                  {athleteDetail.loadState.score !== null ? athleteDetail.loadState.score : '—'}
                  {athleteDetail.loadState.score !== null && <span>/100</span>}
                </div>
              </div>
              <p className="readiness-summary">{athleteDetail.loadState.summary}</p>
              <div className="readiness-rec">
                <strong>Recomendação:</strong> {athleteDetail.loadState.recommendation}
              </div>
            </section>

            <div className="readiness-mini-kpis">
              <div className="surface-card kpi-card">
                <div className="kpi-top">
                  <span className="metric-label">ACWR (7d / 28d)</span>
                  {athleteDetail.loadMetrics.acwrOutOfRange ? (
                    <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
                  ) : (
                    <Activity size={15} />
                  )}
                </div>
                <div
                  className="kpi-value mono-num"
                  style={{
                    color: athleteDetail.loadMetrics.acwrOutOfRange ? 'var(--danger)' : undefined,
                  }}
                >
                  {athleteDetail.loadMetrics.acwr !== null
                    ? athleteDetail.loadMetrics.acwr.toFixed(2)
                    : '—'}
                </div>
                <div className="kpi-sub">
                  {athleteDetail.loadMetrics.acwr === null
                    ? 'Faixa alvo: 0,80–1,30'
                    : athleteDetail.loadMetrics.acwrOutOfRange
                      ? 'Alerta: fora de 0,80–1,30'
                      : 'Zona segura (0,80–1,30)'}
                </div>
              </div>

              <div className="surface-card kpi-card">
                <div className="kpi-top">
                  <span className="metric-label">Presença & faltas</span>
                  <UserCheck size={15} />
                </div>
                <div className="kpi-value mono-num">{athleteDetail.attendanceRate}%</div>
                <div className="kpi-sub">
                  {athleteDetail.sessionCount} realizados ·{' '}
                  <span
                    style={{
                      color: athleteDetail.missedWorkouts.length > 0 ? 'var(--danger)' : undefined,
                      fontWeight: athleteDetail.missedWorkouts.length > 0 ? 700 : undefined,
                    }}
                  >
                    {athleteDetail.missedWorkouts.length}{' '}
                    {athleteDetail.missedWorkouts.length === 1 ? 'falta' : 'faltas'}
                  </span>
                </div>
              </div>

              <div className="surface-card kpi-card">
                <div className="kpi-top">
                  <span className="metric-label">Wellness / Monotonia</span>
                  <HeartPulse size={15} />
                </div>
                <div className="kpi-value mono-num">
                  {athleteDetail.wellnessEval.latestScore !== null
                    ? `${athleteDetail.wellnessEval.latestScore}/20`
                    : '—'}
                </div>
                <div className="kpi-sub">
                  Monotonia:{' '}
                  <strong className="mono-num">
                    {athleteDetail.loadMetrics.monotony !== null
                      ? athleteDetail.loadMetrics.monotony.toFixed(2)
                      : '—'}
                  </strong>{' '}
                  · Strain:{' '}
                  <strong className="mono-num">
                    {athleteDetail.loadMetrics.strain ?? '—'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-navigation tabs */}
          <div style={{ marginBottom: 16 }}>
            <div className="segmented" style={{ maxWidth: 640 }}>
              <button
                type="button"
                className={subTab === 'carga' ? 'active' : ''}
                onClick={() => setSubTab('carga')}
              >
                <Activity size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Carga, RPE & Wellness
              </button>
              <button
                type="button"
                className={subTab === 'tempos' ? 'active' : ''}
                onClick={() => setSubTab('tempos')}
              >
                <Trophy size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Tempos & Índices
              </button>
              <button
                type="button"
                className={subTab === 'css' ? 'active' : ''}
                onClick={() => setSubTab('css')}
              >
                <Gauge size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                CSS & Zonas de Ritmo
              </button>
            </div>
          </div>

          {subTab === 'tempos' && (
            <ResultsAndStandardsPanel
              key={athleteDetail.athlete.id}
              athlete={athleteDetail.athlete}
              coachId={coachId}
              results={results}
              standards={standards}
              onSaveResult={onSaveResult}
              onDeleteResult={onDeleteResult}
              onSaveStandard={onSaveStandard}
              onDeleteStandard={onDeleteStandard}
              onSaveAthlete={onSaveAthlete}
            />
          )}

          {subTab === 'css' && (
            <CssZonesPanel
              key={athleteDetail.athlete.id}
              athlete={athleteDetail.athlete}
              coachId={coachId}
              catalog={catalog}
              cssTests={cssTests}
              onSaveCssTest={onSaveCssTest}
              onDeleteCssTest={onDeleteCssTest}
            />
          )}

          {subTab === 'carga' && (
            <>
              <LoadAndWellnessPanel
                key={athleteDetail.athlete.id}
                athlete={athleteDetail.athlete}
                coachId={coachId}
                catalog={catalog}
                athleteCssPace100Cs={athleteDetail.cssPace100Cs}
                assignedCompletedWorkouts={athleteDetail.attended}
                rpeLogs={rpeLogs}
                wellnessEntries={wellnessEntries}
                onSaveRpeLog={onSaveRpeLog}
                onDeleteRpeLog={onDeleteRpeLog}
                onSaveWellness={onSaveWellness}
                onDeleteWellness={onDeleteWellness}
              />

              {athleteDetail.missedWorkouts.length > 0 && (
                <section className="surface-card" style={{ marginTop: 16 }}>
                  <div className="card-header">
                    <h2 className="card-title" style={{ color: 'var(--danger)' }}>
                      <UserX size={15} /> Treinos em que Não Compareceu (
                      {athleteDetail.missedWorkouts.length})
                    </h2>
                  </div>
                  <div className="card-section" style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <div className="missed-workouts-list">
                      {athleteDetail.missedWorkouts.map((wk) => {
                        const st = computeWorkoutStats(
                          wk.items,
                          catalog.zones,
                          athleteDetail.cssPace100Cs
                        );
                        return (
                          <div key={wk.id} className="missed-workout-row">
                            <div>
                              <strong style={{ fontSize: 13 }}>
                                {wk.title || 'Treino sem título'}
                              </strong>
                              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                                <span className="mono-num">{formatDateBR(wk.date)}</span> ·{' '}
                                {wk.objective} ·{' '}
                                <span className="mono-num">{formatMeters(st.totalMeters)}</span>
                              </div>
                            </div>
                            <div className="series-actions">
                              {onToggleAthleteAbsence && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() =>
                                    onToggleAthleteAbsence(wk, athleteDetail.athlete.id)
                                  }
                                >
                                  Marcar presença
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => onEditWorkout(wk)}
                              >
                                Ver treino
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {athleteDetail.sessionCount === 0 ? (
                <div
                  className="surface-card card-section"
                  style={{ textAlign: 'center', padding: '44px 20px', marginTop: 16 }}
                >
                  <BarChart3 size={28} style={{ color: 'var(--ink-muted)', marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                    Nenhum treino concluído atribuído a {athleteDetail.athlete.name} neste período
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-secondary)' }}>
                    Apenas treinos marcados como concluídos são contabilizados nos painéis. Crie ou
                    conclua um treino direcionado para a equipe, grupo{' '}
                    <strong>{athleteDetail.athlete.category}</strong> ou para este atleta.
                  </p>
                </div>
              ) : (
                <>
                  {/* Precision Statistical KPIs */}
                  <div className="kpi-grid" style={{ marginTop: 16 }}>
                    <div className="surface-card kpi-card">
                      <div className="kpi-top">
                        <span className="metric-label">Volume acumulado</span>
                        <Waves size={16} style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <div className="kpi-value mono-num">
                        {formatMeters(athleteDetail.totalMeters)}
                      </div>
                      <div className="kpi-sub">
                        {athleteDetail.sessionCount} sessões · {athleteDetail.totalReps} repetições
                      </div>
                    </div>

                    <div className="surface-card kpi-card">
                      <div className="kpi-top">
                        <span className="metric-label">Média & consistência (σ)</span>
                        <Activity size={16} />
                      </div>
                      <div className="kpi-value mono-num">
                        {formatMeters(athleteDetail.avgMeters)}
                      </div>
                      <div className="kpi-sub">
                        Desvio padrão: ±{formatMeters(athleteDetail.stdDev)} por sessão
                      </div>
                    </div>

                    <div className="surface-card kpi-card">
                      <div className="kpi-top">
                        <span className="metric-label">Polarização (aeróbio / intenso)</span>
                        <Flame size={16} style={{ color: 'var(--danger)' }} />
                      </div>
                      <div className="kpi-value mono-num">
                        {athleteDetail.aerobicPct}% / {athleteDetail.highPct}%
                      </div>
                      <div className="kpi-sub">
                        {formatMeters(athleteDetail.highIntensityMeters)} em Z4–VEL
                      </div>
                    </div>

                    <div className="surface-card kpi-card">
                      <div className="kpi-top">
                        <span className="metric-label">Tempo na água</span>
                        <Clock size={16} />
                      </div>
                      <div className="kpi-value mono-num">~{athleteDetail.totalMinutes} min</div>
                      <div className="kpi-sub">
                        {athleteDetail.cssPace100Cs
                          ? `Estimado pelo CSS (${formatSwimTime(athleteDetail.cssPace100Cs)}/100m)`
                          : `Média de ~${Math.round(athleteDetail.totalMinutes / athleteDetail.sessionCount)} min/treino`}
                      </div>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="analytics-grid-2">
                    <section className="surface-card">
                      <div className="card-header">
                        <h2 className="card-title">
                          <TrendingUp size={15} /> Evolução de volume por sessão
                        </h2>
                      </div>
                      <div className="card-section">
                        <div className="bar-chart-scroll">
                          <div className="bar-chart-canvas">
                            {athleteDetail.sessions.map(({ workout, stats }) => {
                              const heightPct =
                                athleteDetail.maxSessionMeters > 0
                                  ? Math.max(
                                      6,
                                      Math.round(
                                        (stats.totalMeters / athleteDetail.maxSessionMeters) * 100
                                      )
                                    )
                                  : 0;
                              const isSelected = activeSession?.workout.id === workout.id;

                              return (
                                <button
                                  key={workout.id}
                                  type="button"
                                  className={`bar-col-btn ${isSelected ? 'active' : ''}`}
                                  onMouseEnter={() => setHoveredWorkoutId(workout.id)}
                                  onFocus={() => setHoveredWorkoutId(workout.id)}
                                  onClick={() => onEditWorkout(workout)}
                                >
                                  <div className="bar-track">
                                    <div className="bar-fill-stack" style={{ height: `${heightPct}%` }}>
                                      {stats.byZone
                                        .filter((z) => z.meters > 0)
                                        .map((z) => (
                                          <div
                                            key={z.zone.id}
                                            style={{
                                              height: `${z.percent}%`,
                                              backgroundColor: z.zone.accentHex,
                                            }}
                                          />
                                        ))}
                                    </div>
                                  </div>
                                  <span className="bar-x-label mono-num">
                                    {workout.date
                                      ? workout.date.slice(5).split('-').reverse().join('/')
                                      : '—'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {activeSession && (
                          <div className="chart-inspector">
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {activeSession.workout.title || 'Treino sem título'}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                                {formatDateBR(activeSession.workout.date)} ·{' '}
                                {activeSession.workout.objective}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="mono-num" style={{ fontWeight: 600, fontSize: 15 }}>
                                {formatMeters(activeSession.stats.totalMeters)}
                              </div>
                              <div className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                                ~{activeSession.stats.estimatedMinutes} min ·{' '}
                                {activeSession.highPct}% intenso
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="surface-card">
                      <div className="card-header">
                        <h2 className="card-title">
                          <Target size={15} /> Perfil fisiológico (Z1–VEL)
                        </h2>
                      </div>
                      <div className="card-section">
                        <div className="donut-layout">
                          <div className="donut-wrap">
                            <svg viewBox="0 0 140 140" className="donut-svg">
                              <circle
                                cx="70"
                                cy="70"
                                r="52"
                                fill="none"
                                stroke="#EBEBE8"
                                strokeWidth="18"
                              />
                              {donutSegments.map((seg) => (
                                <circle
                                  key={seg.zone.id}
                                  cx="70"
                                  cy="70"
                                  r="52"
                                  fill="none"
                                  stroke={seg.zone.accentHex}
                                  strokeWidth="18"
                                  strokeDasharray={`${seg.dash} ${seg.gap}`}
                                  strokeDashoffset={-seg.offset}
                                  transform="rotate(-90 70 70)"
                                />
                              ))}
                            </svg>
                            <div className="donut-center">
                              <span className="mono-num" style={{ fontSize: 16, fontWeight: 600 }}>
                                {athleteDetail.highPct}%
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 600 }}>
                                Z4–VEL
                              </span>
                            </div>
                          </div>

                          <div className="zone-legend-list" style={{ flex: 1 }}>
                            {athleteDetail.byZone.map((z) => (
                              <div key={z.zone.id} className="zone-legend-row">
                                <div className="zone-legend-left">
                                  <span
                                    className="zone-swatch"
                                    style={{ backgroundColor: z.zone.accentHex }}
                                  />
                                  <span>
                                    <strong className="mono-num">{z.zone.code}</strong> ·{' '}
                                    {z.zone.shortLabel}
                                  </span>
                                </div>
                                <span className="mono-num" style={{ fontWeight: 600 }}>
                                  {formatMeters(z.meters)} ({z.percent}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Styles & Equipment */}
                  <div className="analytics-grid-2">
                    <section className="surface-card">
                      <div className="card-header">
                        <h2 className="card-title">Estilos & tipos trabalhados</h2>
                      </div>
                      <div className="card-section">
                        <div className="h-bars-list">
                          {athleteDetail.styles.slice(0, 6).map((st) => {
                            const max = athleteDetail.styles[0]?.meters || 1;
                            const pct = Math.round((st.meters / max) * 100);
                            return (
                              <div key={st.name} className="h-bar-item">
                                <div className="h-bar-head">
                                  <span style={{ fontWeight: 600 }}>{st.name}</span>
                                  <span className="mono-num">
                                    {formatMeters(st.meters)} · {st.count}x
                                  </span>
                                </div>
                                <div className="h-bar-track">
                                  <div
                                    className="h-bar-fill"
                                    style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>

                    <section className="surface-card">
                      <div className="card-header">
                        <h2 className="card-title">Equipamentos utilizados</h2>
                      </div>
                      <div className="card-section">
                        {athleteDetail.equipment.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                            Nenhum equipamento registrado nas sessões deste atleta.
                          </div>
                        ) : (
                          <div className="h-bars-list">
                            {athleteDetail.equipment.slice(0, 6).map((eq) => {
                              const max = athleteDetail.equipment[0]?.meters || 1;
                              const pct = Math.round((eq.meters / max) * 100);
                              return (
                                <div key={eq.name} className="h-bar-item">
                                  <div className="h-bar-head">
                                    <span style={{ fontWeight: 600 }}>{eq.name}</span>
                                    <span className="mono-num">
                                      {formatMeters(eq.meters)} ({eq.count}x)
                                    </span>
                                  </div>
                                  <div className="h-bar-track">
                                    <div
                                      className="h-bar-fill"
                                      style={{ width: `${pct}%`, backgroundColor: 'var(--zone-z2)' }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </>
              )}
            </>
          )}

          {/* Comparative Roster Table */}
          <section className="surface-card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2 className="card-title">
                <Award size={15} /> Comparativo do elenco ({rosterStats.length} atletas)
              </h2>
            </div>
            <div className="table-scroll">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th>Categoria</th>
                    <th>CSS (/100m)</th>
                    <th>Sessões</th>
                    <th>Volume total</th>
                    <th>Carga 7d (sRPE)</th>
                    <th>ACWR</th>
                    <th>Wellness</th>
                    <th>Prontidão</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterStats.map((row) => (
                    <tr
                      key={row.athlete.id}
                      style={{
                        cursor: 'pointer',
                        backgroundColor:
                          row.athlete.id === effectiveAthlete?.id ? 'var(--accent-soft)' : undefined,
                      }}
                      onClick={() => setSelectedAthleteId(row.athlete.id)}
                    >
                      <td style={{ fontWeight: 600 }}>{row.athlete.name}</td>
                      <td>
                        <span className="db-chip">{row.athlete.category}</span>
                      </td>
                      <td className="mono-num">
                        {row.cssPace100Cs ? formatSwimTime(row.cssPace100Cs) : '—'}
                      </td>
                      <td className="mono-num">{row.sessions}</td>
                      <td className="mono-num">{formatMeters(row.totalMeters)}</td>
                      <td className="mono-num">{row.loadMetrics.acuteLoad7d} UA</td>
                      <td
                        className="mono-num"
                        style={{
                          fontWeight: 700,
                          color: row.loadMetrics.acwrOutOfRange ? 'var(--danger)' : undefined,
                        }}
                      >
                        {row.loadMetrics.acwr !== null ? row.loadMetrics.acwr.toFixed(2) : '—'}
                      </td>
                      <td className="mono-num">
                        {row.wellnessEval.latestScore !== null
                          ? `${row.wellnessEval.latestScore}/20`
                          : '—'}
                      </td>
                      <td>
                        <span className={`readiness-badge tone-${row.loadState.tone}`}>
                          {row.loadState.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
