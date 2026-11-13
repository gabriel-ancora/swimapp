import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Flame,
  Layers,
  Target,
  TrendingUp,
  UserCheck,
  Waves,
} from 'lucide-react';
import type { BlockType, CatalogDatabase, Workout, ZoneId } from '../types/swimming';
import {
  computeWorkoutStats,
  estimateItemSeconds,
  formatDateBR,
  formatMeters,
  getItemMeters,
} from '../utils/storage';

interface AnalyticsDashboardProps {
  workouts: Workout[];
  catalog: CatalogDatabase;
  onCreateNew: () => void;
  onEditWorkout: (workout: Workout) => void;
}

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

const BLOCK_LABELS: Record<BlockType, { label: string; color: string }> = {
  aquecimento: { label: 'Aquecimento', color: '#0d9488' },
  principal: { label: 'Série Principal', color: '#0057ff' },
  complementar: { label: 'Complementares', color: '#64748b' },
};

function formatDurationLong(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  workouts,
  catalog,
  onCreateNew,
  onEditWorkout,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [poolFilter, setPoolFilter] = useState<'all' | 25 | 50>('all');
  const [coachFilter, setCoachFilter] = useState<string>('all');
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  const availableCoaches = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) {
      const name = w.coach.trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [workouts]);

  const availableObjectives = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) {
      if (w.objective) set.add(w.objective);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    const now = new Date();
    const cutoff =
      period === 'all'
        ? null
        : new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90)
          );

    return workouts
      .filter((w) => {
        if (poolFilter !== 'all' && w.poolLength !== poolFilter) return false;
        if (coachFilter !== 'all' && w.coach.trim() !== coachFilter) return false;
        if (objectiveFilter !== 'all' && w.objective !== objectiveFilter) return false;
        if (cutoff && w.date) {
          const parsed = new Date(`${w.date}T00:00:00`);
          if (!Number.isNaN(parsed.getTime()) && parsed < cutoff) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [workouts, period, poolFilter, coachFilter, objectiveFilter]);

  const analytics = useMemo(() => {
    let totalMeters = 0;
    let totalMinutes = 0;
    let totalSeries = 0;
    let totalReps = 0;

    const byBlock: Record<BlockType, number> = {
      aquecimento: 0,
      principal: 0,
      complementar: 0,
    };

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

    const seriesMap = new Map<string, { name: string; meters: number; count: number }>();
    const objectiveMap = new Map<string, { name: string; meters: number; sessions: number }>();
    const equipmentMap = new Map<string, { name: string; meters: number; count: number }>();
    const coachMap = new Map<
      string,
      { name: string; sessions: number; meters: number; highIntensityMeters: number }
    >();
    const poolMap: Record<25 | 50, { sessions: number; meters: number }> = {
      25: { sessions: 0, meters: 0 },
      50: { sessions: 0, meters: 0 },
    };

    const sessions = filteredWorkouts.map((wk) => {
      const stats = computeWorkoutStats(wk.items, catalog.zones);
      totalMeters += stats.totalMeters;
      totalMinutes += stats.estimatedMinutes;
      totalSeries += wk.items.length;

      byBlock.aquecimento += stats.byBlock.aquecimento;
      byBlock.principal += stats.byBlock.principal;
      byBlock.complementar += stats.byBlock.complementar;

      poolMap[wk.poolLength].sessions += 1;
      poolMap[wk.poolLength].meters += stats.totalMeters;

      const objKey = wk.objective || 'Sem objetivo';
      const prevObj = objectiveMap.get(objKey) ?? { name: objKey, meters: 0, sessions: 0 };
      prevObj.meters += stats.totalMeters;
      prevObj.sessions += 1;
      objectiveMap.set(objKey, prevObj);

      let wkHighIntensity = 0;

      for (const item of wk.items) {
        const m = getItemMeters(item);
        const sec = estimateItemSeconds(item);
        totalReps += item.reps;
        zoneMeters[item.zoneId] = (zoneMeters[item.zoneId] || 0) + m;
        zoneMinutes[item.zoneId] = (zoneMinutes[item.zoneId] || 0) + sec / 60;

        if (item.zoneId === 'Z4' || item.zoneId === 'Z5' || item.zoneId === 'VEL') {
          wkHighIntensity += m;
        }

        const st = seriesMap.get(item.seriesType) ?? {
          name: item.seriesType,
          meters: 0,
          count: 0,
        };
        st.meters += m;
        st.count += 1;
        seriesMap.set(item.seriesType, st);

        for (const eq of item.equipment) {
          const prevEq = equipmentMap.get(eq) ?? { name: eq, meters: 0, count: 0 };
          prevEq.meters += m;
          prevEq.count += 1;
          equipmentMap.set(eq, prevEq);
        }
      }

      const coachName = wk.coach.trim() || 'Sem técnico informado';
      const prevCoach = coachMap.get(coachName) ?? {
        name: coachName,
        sessions: 0,
        meters: 0,
        highIntensityMeters: 0,
      };
      prevCoach.sessions += 1;
      prevCoach.meters += stats.totalMeters;
      prevCoach.highIntensityMeters += wkHighIntensity;
      coachMap.set(coachName, prevCoach);

      const highPct =
        stats.totalMeters > 0 ? Math.round((wkHighIntensity / stats.totalMeters) * 100) : 0;

      return {
        workout: wk,
        stats,
        highIntensityPercent: highPct,
      };
    });

    const sessionCount = filteredWorkouts.length;
    const avgMetersPerSession = sessionCount > 0 ? Math.round(totalMeters / sessionCount) : 0;
    const avgMinutesPerSession = sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0;

    const highIntensityMeters = zoneMeters.Z4 + zoneMeters.Z5 + zoneMeters.VEL;
    const highIntensityPercent =
      totalMeters > 0 ? Math.round((highIntensityMeters / totalMeters) * 100) : 0;

    const byZone = catalog.zones.map((zone) => {
      const meters = zoneMeters[zone.id] || 0;
      const minutes = Math.round(zoneMinutes[zone.id] || 0);
      const percent = totalMeters > 0 ? Math.round((meters / totalMeters) * 100) : 0;
      return { zone, meters, minutes, percent };
    });

    const topSeries = Array.from(seriesMap.values()).sort((a, b) => b.meters - a.meters);
    const byObjective = Array.from(objectiveMap.values()).sort((a, b) => b.meters - a.meters);
    const byEquipment = Array.from(equipmentMap.values()).sort((a, b) => b.meters - a.meters);
    const byCoach = Array.from(coachMap.values()).sort((a, b) => b.meters - a.meters);

    const maxSessionMeters = sessions.reduce(
      (max, s) => Math.max(max, s.stats.totalMeters),
      0
    );

    return {
      totalMeters,
      totalMinutes,
      totalSeries,
      totalReps,
      sessionCount,
      avgMetersPerSession,
      avgMinutesPerSession,
      highIntensityMeters,
      highIntensityPercent,
      byBlock,
      byZone,
      topSeries,
      byObjective,
      byEquipment,
      byCoach,
      poolMap,
      sessions,
      maxSessionMeters,
    };
  }, [filteredWorkouts, catalog.zones]);

  // SVG Donut math for physiological zones
  const donutSegments = useMemo(() => {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return analytics.byZone
      .filter((z) => z.meters > 0)
      .map((z) => {
        const ratio = analytics.totalMeters > 0 ? z.meters / analytics.totalMeters : 0;
        const dash = ratio * circumference;
        const seg = {
          ...z,
          dash,
          gap: circumference - dash,
          offset,
          circumference,
        };
        offset += dash;
        return seg;
      });
  }, [analytics.byZone, analytics.totalMeters]);

  const activeHoveredSession =
    analytics.sessions.find((s) => s.workout.id === hoveredSessionId) ??
    analytics.sessions[analytics.sessions.length - 1] ??
    null;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-eyebrow">Inteligência & Telemetria</span>
          <h1 className="page-title">Painel Analítico de Treinos</h1>
          <p className="page-subtitle">
            Análise consolidada em tempo real de volume, zonas fisiológicas, blocos, estilos e
            equipamentos a partir dos treinos cadastrados.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="analytics-filters surface-card">
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

        <div className="analytics-filter-group">
          <label>Piscina</label>
          <div className="segmented">
            <button
              type="button"
              className={poolFilter === 'all' ? 'active' : ''}
              onClick={() => setPoolFilter('all')}
            >
              Todas
            </button>
            <button
              type="button"
              className={poolFilter === 25 ? 'active' : ''}
              onClick={() => setPoolFilter(25)}
            >
              25m
            </button>
            <button
              type="button"
              className={poolFilter === 50 ? 'active' : ''}
              onClick={() => setPoolFilter(50)}
            >
              50m
            </button>
          </div>
        </div>

        <div className="analytics-filter-group">
          <label>Técnico</label>
          <select
            className="select"
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
          >
            <option value="all">Todos os técnicos</option>
            {availableCoaches.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="analytics-filter-group">
          <label>Objetivo</label>
          <select
            className="select"
            value={objectiveFilter}
            onChange={(e) => setObjectiveFilter(e.target.value)}
          >
            <option value="all">Todos os objetivos</option>
            {availableObjectives.map((obj) => (
              <option key={obj} value={obj}>
                {obj}
              </option>
            ))}
          </select>
        </div>
      </div>

      {analytics.sessionCount === 0 ? (
        <div
          className="surface-card card-section"
          style={{ textAlign: 'center', padding: '52px 24px', marginTop: 16 }}
        >
          <BarChart3 size={30} style={{ color: 'var(--ink-muted)', marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            Nenhum dado disponível para os filtros atuais
          </div>
          <p style={{ margin: '0 0 16px 0', color: 'var(--ink-secondary)', fontSize: 13 }}>
            {workouts.length === 0
              ? 'Cadastre seu primeiro treino para visualizar os gráficos e indicadores reais.'
              : 'Ajuste o período, piscina, técnico ou objetivo para analisar os treinos cadastrados.'}
          </p>
          {workouts.length === 0 && (
            <button type="button" className="btn btn-primary" onClick={onCreateNew}>
              Criar Primeiro Treino
            </button>
          )}
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="kpi-grid">
            <div className="surface-card kpi-card">
              <div className="kpi-top">
                <span className="metric-label">Volume Total</span>
                <Waves size={16} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div className="kpi-value mono-num">{formatMeters(analytics.totalMeters)}</div>
              <div className="kpi-sub">
                {(analytics.totalMeters / 1000).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                km · média de {formatMeters(analytics.avgMetersPerSession)}/sessão
              </div>
            </div>

            <div className="surface-card kpi-card">
              <div className="kpi-top">
                <span className="metric-label">Sessões & Séries</span>
                <Activity size={16} style={{ color: '#0d9488' }} />
              </div>
              <div className="kpi-value mono-num">{analytics.sessionCount}</div>
              <div className="kpi-sub">
                {analytics.totalSeries} séries · {analytics.totalReps} repetições totais
              </div>
            </div>

            <div className="surface-card kpi-card">
              <div className="kpi-top">
                <span className="metric-label">Tempo Estimado</span>
                <Clock size={16} style={{ color: '#6366f1' }} />
              </div>
              <div className="kpi-value mono-num">
                {formatDurationLong(analytics.totalMinutes)}
              </div>
              <div className="kpi-sub">Média de ~{analytics.avgMinutesPerSession} min por treino</div>
            </div>

            <div className="surface-card kpi-card">
              <div className="kpi-top">
                <span className="metric-label">Carga Intensa (Z4–VEL)</span>
                <Flame size={16} style={{ color: '#dc2626' }} />
              </div>
              <div className="kpi-value mono-num">{analytics.highIntensityPercent}%</div>
              <div className="kpi-sub">
                {formatMeters(analytics.highIntensityMeters)} em limiar, VO2 e sprint
              </div>
            </div>
          </div>

          {/* Primary Charts Grid */}
          <div className="analytics-grid-2">
            {/* Volume Evolution Bar Chart */}
            <section className="surface-card">
              <div className="card-header">
                <h2 className="card-title">
                  <TrendingUp size={15} /> Evolução de Volume por Sessão
                </h2>
                <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  {analytics.sessions.length} sessões
                </span>
              </div>
              <div className="card-section">
                <div className="bar-chart-scroll">
                  <div className="bar-chart-canvas">
                    {analytics.sessions.map(({ workout, stats }) => {
                      const heightPct =
                        analytics.maxSessionMeters > 0
                          ? Math.max(6, Math.round((stats.totalMeters / analytics.maxSessionMeters) * 100))
                          : 0;
                      const isSelected = activeHoveredSession?.workout.id === workout.id;

                      return (
                        <button
                          key={workout.id}
                          type="button"
                          className={`bar-col-btn ${isSelected ? 'active' : ''}`}
                          onMouseEnter={() => setHoveredSessionId(workout.id)}
                          onFocus={() => setHoveredSessionId(workout.id)}
                          onClick={() => onEditWorkout(workout)}
                          title={`${formatDateBR(workout.date)} — ${workout.title}: ${formatMeters(stats.totalMeters)}`}
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
                            {workout.date ? workout.date.slice(5).split('-').reverse().join('/') : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeHoveredSession && (
                  <div className="chart-inspector">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {activeHoveredSession.workout.title || 'Treino Sem Título'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                        {formatDateBR(activeHoveredSession.workout.date)} · Piscina{' '}
                        {activeHoveredSession.workout.poolLength}m ·{' '}
                        {activeHoveredSession.workout.objective}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono-num" style={{ fontWeight: 700, fontSize: 15 }}>
                        {formatMeters(activeHoveredSession.stats.totalMeters)}
                      </div>
                      <div className="mono-num" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                        ~{activeHoveredSession.stats.estimatedMinutes} min ·{' '}
                        {activeHoveredSession.highIntensityPercent}% intenso
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Physiological Zones Donut + Breakdown */}
            <section className="surface-card">
              <div className="card-header">
                <h2 className="card-title">
                  <Target size={15} /> Distribuição por Zona Fisiológica
                </h2>
                <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Z1 – VEL
                </span>
              </div>
              <div className="card-section">
                <div className="donut-layout">
                  <div className="donut-wrap">
                    <svg viewBox="0 0 140 140" className="donut-svg" aria-label="Gráfico de zonas">
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
                        {analytics.highIntensityPercent}%
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 700 }}>
                        Z4–VEL
                      </span>
                    </div>
                  </div>

                  <div className="zone-legend-list" style={{ flex: 1 }}>
                    {analytics.byZone.map((z) => (
                      <div key={z.zone.id} className="zone-legend-row">
                        <div className="zone-legend-left">
                          <span
                            className="zone-swatch"
                            style={{ backgroundColor: z.zone.accentHex }}
                          />
                          <span>
                            <strong className="mono-num">{z.zone.code}</strong> · {z.zone.shortLabel}
                          </span>
                        </div>
                        <span className="mono-num" style={{ fontWeight: 600 }}>
                          {formatMeters(z.meters)}{' '}
                          <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>
                            ({z.percent}%)
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Secondary Analytics Grid */}
          <div className="analytics-grid-3">
            {/* Blocks Structure */}
            <section className="surface-card">
              <div className="card-header">
                <h2 className="card-title">
                  <Layers size={15} /> Estrutura por Bloco
                </h2>
              </div>
              <div className="card-section">
                <div className="h-bars-list">
                  {(['aquecimento', 'principal', 'complementar'] as BlockType[]).map((key) => {
                    const meters = analytics.byBlock[key];
                    const pct =
                      analytics.totalMeters > 0
                        ? Math.round((meters / analytics.totalMeters) * 100)
                        : 0;
                    return (
                      <div key={key} className="h-bar-item">
                        <div className="h-bar-head">
                          <span style={{ fontWeight: 600 }}>{BLOCK_LABELS[key].label}</span>
                          <span className="mono-num">
                            {formatMeters(meters)} ({pct}%)
                          </span>
                        </div>
                        <div className="h-bar-track">
                          <div
                            className="h-bar-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: BLOCK_LABELS[key].color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pool-split-box">
                  <div className="pool-split-cell">
                    <span>Piscina 25m</span>
                    <strong className="mono-num">
                      {analytics.poolMap[25].sessions} treinos ·{' '}
                      {formatMeters(analytics.poolMap[25].meters)}
                    </strong>
                  </div>
                  <div className="pool-split-cell">
                    <span>Piscina 50m</span>
                    <strong className="mono-num">
                      {analytics.poolMap[50].sessions} treinos ·{' '}
                      {formatMeters(analytics.poolMap[50].meters)}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            {/* Top Series Types / Styles */}
            <section className="surface-card">
              <div className="card-header">
                <h2 className="card-title">Estilos & Tipos de Série</h2>
                <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Top {Math.min(6, analytics.topSeries.length)}
                </span>
              </div>
              <div className="card-section">
                <div className="h-bars-list">
                  {analytics.topSeries.slice(0, 6).map((st) => {
                    const max = analytics.topSeries[0]?.meters || 1;
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

            {/* Equipment & Objectives */}
            <section className="surface-card">
              <div className="card-header">
                <h2 className="card-title">Equipamentos & Objetivos</h2>
              </div>
              <div className="card-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="metric-label" style={{ marginBottom: 8 }}>
                    Equipamentos Utilizados
                  </div>
                  {analytics.byEquipment.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      Nenhum equipamento registrado nas séries filtradas.
                    </div>
                  ) : (
                    <div className="h-bars-list">
                      {analytics.byEquipment.slice(0, 4).map((eq) => {
                        const max = analytics.byEquipment[0]?.meters || 1;
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

                <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 12 }}>
                  <div className="metric-label" style={{ marginBottom: 8 }}>
                    Objetivos das Sessões
                  </div>
                  <div className="tag-cloud">
                    {analytics.byObjective.map((obj) => (
                      <span key={obj.name} className="db-chip">
                        <span>{obj.name}</span>
                        <span className="mono-num" style={{ color: 'var(--accent-primary)' }}>
                          {obj.sessions}x · {formatMeters(obj.meters)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Coaches Breakdown */}
          <section className="surface-card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2 className="card-title">
                <UserCheck size={15} /> Resumo por Técnico Responsável
              </h2>
            </div>
            <div className="table-scroll">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th>Sessões</th>
                    <th>Volume Total</th>
                    <th>Média / Sessão</th>
                    <th>Carga Intensa (Z4–VEL)</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byCoach.map((c) => {
                    const avg = c.sessions > 0 ? Math.round(c.meters / c.sessions) : 0;
                    const highPct =
                      c.meters > 0 ? Math.round((c.highIntensityMeters / c.meters) * 100) : 0;
                    return (
                      <tr key={c.name}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td className="mono-num">{c.sessions}</td>
                        <td className="mono-num">{formatMeters(c.meters)}</td>
                        <td className="mono-num">{formatMeters(avg)}</td>
                        <td className="mono-num">{highPct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
