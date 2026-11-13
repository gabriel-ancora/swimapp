import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Clock,
  Flame,
  Target,
  TrendingUp,
  Users,
  Waves,
} from 'lucide-react';
import type {
  Athlete,
  CatalogDatabase,
  Team,
  TrainingPlan,
  Workout,
  ZoneId,
} from '../types/swimming';
import {
  computeWorkoutStats,
  estimateItemSeconds,
  formatDateBR,
  formatMeters,
  getItemMeters,
  isWorkoutAssignedToAthlete,
} from '../utils/storage';

interface AthleteAnalyticsProps {
  activeTeam: Team | null;
  athletes: Athlete[];
  workouts: Workout[];
  plans?: TrainingPlan[];
  catalog: CatalogDatabase;
  onEditWorkout: (workout: Workout) => void;
  onGoToTeam: () => void;
}

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

function computeStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

export const AthleteAnalytics: React.FC<AthleteAnalyticsProps> = ({
  activeTeam,
  athletes,
  workouts,
  plans = [],
  catalog,
  onEditWorkout,
  onGoToTeam,
}) => {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(
    () => athletes[0]?.id ?? ''
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
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

  // Statistical summary for every athlete in the roster
  const rosterStats = useMemo(() => {
    return filteredRoster.map((athlete) => {
      const assigned = periodWorkouts.filter((w) => isWorkoutAssignedToAthlete(w, athlete));
      const volumes: number[] = [];
      let totalMeters = 0;
      let totalMinutes = 0;
      let highIntensityMeters = 0;

      for (const wk of assigned) {
        const st = computeWorkoutStats(wk.items, catalog.zones);
        volumes.push(st.totalMeters);
        totalMeters += st.totalMeters;
        totalMinutes += st.estimatedMinutes;
        for (const z of st.byZone) {
          if (z.zone.id === 'Z4' || z.zone.id === 'Z5' || z.zone.id === 'VEL') {
            highIntensityMeters += z.meters;
          }
        }
      }

      const sessions = assigned.length;
      const avgMeters = sessions > 0 ? Math.round(totalMeters / sessions) : 0;
      const stdDev = computeStdDev(volumes);
      const highPct = totalMeters > 0 ? Math.round((highIntensityMeters / totalMeters) * 100) : 0;

      return {
        athlete,
        sessions,
        totalMeters,
        totalMinutes,
        avgMeters,
        stdDev,
        highPct,
      };
    });
  }, [filteredRoster, periodWorkouts, catalog.zones]);

  // Deep-dive analytics for the selected athlete
  const athleteDetail = useMemo(() => {
    if (!effectiveAthlete) return null;

    const assigned = periodWorkouts.filter((w) =>
      isWorkoutAssignedToAthlete(w, effectiveAthlete)
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

    const zoneMinutes: Record<ZoneId, number> = {
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

    for (const wk of assigned) {
      const stats = computeWorkoutStats(wk.items, catalog.zones);
      totalMeters += stats.totalMeters;
      totalMinutes += stats.estimatedMinutes;
      volumes.push(stats.totalMeters);

      let wkHigh = 0;
      for (const item of wk.items) {
        const m = getItemMeters(item);
        const sec = estimateItemSeconds(item);
        totalReps += item.reps;
        zoneMeters[item.zoneId] = (zoneMeters[item.zoneId] || 0) + m;
        zoneMinutes[item.zoneId] = (zoneMinutes[item.zoneId] || 0) + sec / 60;

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

      sessions.push({
        workout: wk,
        stats,
        highPct: stats.totalMeters > 0 ? Math.round((wkHigh / stats.totalMeters) * 100) : 0,
      });
    }

    const sessionCount = assigned.length;
    const avgMeters = sessionCount > 0 ? Math.round(totalMeters / sessionCount) : 0;
    const stdDev = computeStdDev(volumes);
    const highPct = totalMeters > 0 ? Math.round((highIntensityMeters / totalMeters) * 100) : 0;
    const aerobicPct = totalMeters > 0 ? 100 - highPct : 0;
    const maxSessionMeters = volumes.reduce((m, v) => Math.max(m, v), 0);

    const byZone = catalog.zones.map((zone) => {
      const meters = zoneMeters[zone.id] || 0;
      const minutes = Math.round(zoneMinutes[zone.id] || 0);
      const percent = totalMeters > 0 ? Math.round((meters / totalMeters) * 100) : 0;
      return { zone, meters, minutes, percent };
    });

    const styles = Array.from(styleMap.values()).sort((a, b) => b.meters - a.meters);
    const equipment = Array.from(equipMap.values()).sort((a, b) => b.meters - a.meters);

    return {
      athlete: effectiveAthlete,
      sessionCount,
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
  }, [effectiveAthlete, periodWorkouts, catalog.zones]);

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
            <span className="page-eyebrow">Estatística & Performance Individual</span>
            <h1 className="page-title">Análise Estatística de Atletas</h1>
            <p className="page-subtitle">
              Acompanhe volume, consistência (desvio padrão), polarização e evolução individual
              baseada nos treinos reais atribuídos.
            </p>
          </div>
        </div>

        <div
          className="surface-card card-section"
          style={{ textAlign: 'center', padding: '52px 24px' }}
        >
          <Users size={30} style={{ color: 'var(--ink-muted)', marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {!activeTeam
              ? 'Nenhuma equipe criada ainda'
              : 'Nenhum atleta cadastrado nesta equipe'}
          </div>
          <p style={{ margin: '0 0 16px 0', color: 'var(--ink-secondary)', fontSize: 13 }}>
            Cadastre sua equipe e seus atletas na aba Minha Equipe para visualizar as estatísticas
            individuais.
          </p>
          <button type="button" className="btn btn-primary" onClick={onGoToTeam}>
            Ir para Minha Equipe
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
          <span className="page-eyebrow">
            Estatística & Performance · {activeTeam.name}
          </span>
          <h1 className="page-title">Análise Estatística de Atletas</h1>
          <p className="page-subtitle">
            Métricas reais de carga, consistência, zonas fisiológicas e estilos calculadas a partir
            dos treinos atribuídos ao atleta, grupo ou equipe.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="analytics-filters surface-card" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="analytics-filter-group">
          <label>Atleta Analisado</label>
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
          <label>Categoria / Grupo</label>
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
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    {athleteDetail.athlete.name}
                  </h2>
                  <span className="db-chip">{athleteDetail.athlete.category}</span>
                  <span
                    className={`status-badge status-${athleteDetail.athlete.status.toLowerCase()}`}
                  >
                    {athleteDetail.athlete.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 6 }}>
                  Prova principal: <strong>{athleteDetail.athlete.mainEvent || '—'}</strong> ·
                  Melhor marca:{' '}
                  <strong className="mono-num">{athleteDetail.athlete.bestTime || '—'}</strong>
                  {athleteDetail.athlete.targetTime && (
                    <>
                      {' '}
                      · Tempo meta:{' '}
                      <strong className="mono-num" style={{ color: 'var(--accent-primary)' }}>
                        {athleteDetail.athlete.targetTime}
                      </strong>
                    </>
                  )}
                </div>
                {athleteDetail.athlete.events && athleteDetail.athlete.events.length > 0 && (
                  <div className="tag-cloud" style={{ marginTop: 8 }}>
                    {athleteDetail.athlete.events.map((ev) => (
                      <span key={ev.id} className="db-chip">
                        <strong>{ev.event}</strong>
                        {ev.bestTime ? ` · ${ev.bestTime}` : ''}
                        {ev.targetTime ? ` → Meta: ${ev.targetTime}` : ''}
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
                      p.targetAthleteId === athleteDetail.athlete.id))
              ).length > 0 && (
                <div className="athlete-goal-box">
                  <div className="metric-label" style={{ marginBottom: 6 }}>
                    Planejamentos Ativos
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
                              p.targetAthleteId === athleteDetail.athlete.id))
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

          {athleteDetail.sessionCount === 0 ? (
            <div
              className="surface-card card-section"
              style={{ textAlign: 'center', padding: '44px 20px', marginBottom: 16 }}
            >
              <BarChart3 size={28} style={{ color: 'var(--ink-muted)', marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Nenhum treino atribuído a {athleteDetail.athlete.name} neste período
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-secondary)' }}>
                Crie um treino direcionado para toda a equipe, para o grupo{' '}
                <strong>{athleteDetail.athlete.category}</strong> ou diretamente para este atleta.
              </p>
            </div>
          ) : (
            <>
              {/* Precision Statistical KPIs */}
              <div className="kpi-grid">
                <div className="surface-card kpi-card">
                  <div className="kpi-top">
                    <span className="metric-label">Volume Acumulado</span>
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
                    <span className="metric-label">Média & Consistência (σ)</span>
                    <Activity size={16} style={{ color: '#0d9488' }} />
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
                    <span className="metric-label">Polarização (Aeróbio / Intenso)</span>
                    <Flame size={16} style={{ color: '#dc2626' }} />
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
                    <span className="metric-label">Tempo na Água</span>
                    <Clock size={16} style={{ color: '#6366f1' }} />
                  </div>
                  <div className="kpi-value mono-num">~{athleteDetail.totalMinutes} min</div>
                  <div className="kpi-sub">
                    Média de ~
                    {Math.round(athleteDetail.totalMinutes / athleteDetail.sessionCount)} min/treino
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="analytics-grid-2">
                <section className="surface-card">
                  <div className="card-header">
                    <h2 className="card-title">
                      <TrendingUp size={15} /> Evolução de Carga do Atleta
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
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {activeSession.workout.title || 'Treino Sem Título'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                            {formatDateBR(activeSession.workout.date)} ·{' '}
                            {activeSession.workout.objective}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mono-num" style={{ fontWeight: 700, fontSize: 15 }}>
                            {formatMeters(activeSession.stats.totalMeters)}
                          </div>
                          <div className="mono-num" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
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
                      <Target size={15} /> Perfil Fisiológico (Z1–VEL)
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
                            stroke="#f1f5f9"
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
                          <span className="mono-num" style={{ fontSize: 16, fontWeight: 700 }}>
                            {athleteDetail.highPct}%
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 700 }}>
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
                    <h2 className="card-title">Estilos & Tipos Trabalhados</h2>
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
                                style={{ width: `${pct}%`, backgroundColor: '#0057ff' }}
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
                    <h2 className="card-title">Equipamentos Utilizados</h2>
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
                                  style={{ width: `${pct}%`, backgroundColor: '#0d9488' }}
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

          {/* Comparative Roster Table */}
          <section className="surface-card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2 className="card-title">
                <Award size={15} /> Comparativo Estatístico do Elenco ({rosterStats.length} atletas)
              </h2>
            </div>
            <div className="table-scroll">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th>Categoria</th>
                    <th>Prova</th>
                    <th>Sessões</th>
                    <th>Volume Total</th>
                    <th>Média / Sessão</th>
                    <th>Desvio Padrão (σ)</th>
                    <th>Carga Intensa (Z4–VEL)</th>
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
                      <td>{row.athlete.mainEvent || '—'}</td>
                      <td className="mono-num">{row.sessions}</td>
                      <td className="mono-num">{formatMeters(row.totalMeters)}</td>
                      <td className="mono-num">{formatMeters(row.avgMeters)}</td>
                      <td className="mono-num">±{formatMeters(row.stdDev)}</td>
                      <td className="mono-num">{row.highPct}%</td>
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
