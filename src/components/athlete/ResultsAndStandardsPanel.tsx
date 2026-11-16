import React, { useMemo, useState } from 'react';
import { Award, Flag, Plus, Trash2, TrendingDown } from 'lucide-react';
import type {
  Athlete,
  PoolLength,
  QualifyingOrganization,
  QualifyingStandard,
  SwimResult,
} from '../../types/swimming';
import { todayLocalISO } from '../../domain/date';
import {
  computeBestMarksByEvent,
  computeWorldAquaticsPoints,
  evaluateAthleteStandards,
  normalizeEventName,
  SWIM_EVENTS,
} from '../../domain/points';
import {
  convertPoolTimeCs,
  formatSwimTime,
  parseSplitsInput,
  parseSwimTime,
} from '../../domain/time';
import { formatDateBR, generateId } from '../../utils/storage';

interface ResultsAndStandardsPanelProps {
  athlete: Athlete;
  coachId: string;
  results: SwimResult[];
  standards: QualifyingStandard[];
  onSaveResult: (result: SwimResult) => Promise<void> | void;
  onDeleteResult: (id: string) => Promise<void> | void;
  onSaveStandard: (standard: QualifyingStandard) => Promise<void> | void;
  onDeleteStandard: (id: string) => Promise<void> | void;
  onSaveAthlete: (athlete: Athlete) => Promise<void> | void;
}

const ORGANIZATIONS: QualifyingOrganization[] = [
  'Estadual',
  'CBDA',
  'Troféu Brasil',
  'Seletiva',
  'Outro',
];

export const ResultsAndStandardsPanel: React.FC<ResultsAndStandardsPanelProps> = ({
  athlete,
  coachId,
  results,
  standards,
  onSaveResult,
  onDeleteResult,
  onSaveStandard,
  onDeleteStandard,
  onSaveAthlete,
}) => {
  const athleteResults = useMemo(
    () =>
      results
        .filter((r) => r.athleteId === athlete.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    [results, athlete.id]
  );

  const sex = athlete.sex ?? 'M';
  const bestMarks = useMemo(() => computeBestMarksByEvent(athleteResults), [athleteResults]);
  const standardEvals = useMemo(
    () => evaluateAthleteStandards(athlete, athleteResults, standards),
    [athlete, athleteResults, standards]
  );

  // Result form state
  const [eventName, setEventName] = useState(
    normalizeEventName(athlete.mainEvent || '100m Livre') || '100m Livre'
  );
  const [poolLength, setPoolLength] = useState<PoolLength>(25);
  const [timeInput, setTimeInput] = useState('');
  const [splitsInput, setSplitsInput] = useState('');
  const [date, setDate] = useState(() => todayLocalISO());
  const [competition, setCompetition] = useState('');
  const [isOfficial, setIsOfficial] = useState(true);
  const [resultError, setResultError] = useState<string | null>(null);

  // Chart state
  const availableEvents = useMemo(() => {
    const set = new Set<string>();
    if (athlete.mainEvent) set.add(normalizeEventName(athlete.mainEvent));
    for (const r of athleteResults) set.add(normalizeEventName(r.event));
    return Array.from(set).filter(Boolean);
  }, [athlete.mainEvent, athleteResults]);

  const [chartEvent, setChartEvent] = useState<string>(
    () => availableEvents[0] ?? '100m Livre'
  );
  const [chartPool, setChartPool] = useState<PoolLength>(25);
  const [customGoalInput, setCustomGoalInput] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);

  const effectiveChartEvent = availableEvents.includes(chartEvent)
    ? chartEvent
    : availableEvents[0] ?? '100m Livre';

  const chartSeries = useMemo(() => {
    return athleteResults
      .filter(
        (r) =>
          normalizeEventName(r.event) === effectiveChartEvent && r.poolLength === chartPool
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }, [athleteResults, effectiveChartEvent, chartPool]);

  // Target time (meta) for selected chart event
  const chartTargetCs = useMemo(() => {
    const normMain = normalizeEventName(athlete.mainEvent || '');
    if (normMain === effectiveChartEvent) {
      if (athlete.targetTimeCs) return athlete.targetTimeCs;
      if (athlete.targetTime) {
        const p = parseSwimTime(athlete.targetTime);
        if (p) return p;
      }
    }
    const extraGoal = athlete.events?.find(
      (ev) => normalizeEventName(ev.event) === effectiveChartEvent
    );
    if (extraGoal?.targetTimeCs) return extraGoal.targetTimeCs;
    if (extraGoal?.targetTime) {
      const p = parseSwimTime(extraGoal.targetTime);
      if (p) return p;
    }
    // Fallback to fastest matching qualifying standard for this event + pool
    const matchingStd = standardEvals.find(
      (s) =>
        normalizeEventName(s.standard.event) === effectiveChartEvent &&
        s.standard.poolLength === chartPool
    );
    return matchingStd?.standard.timeCs ?? null;
  }, [athlete, effectiveChartEvent, chartPool, standardEvals]);

  // Qualifying standard form state
  const [showStandardForm, setShowStandardForm] = useState(false);
  const [stdName, setStdName] = useState('');
  const [stdOrg, setStdOrg] = useState<QualifyingOrganization>('CBDA');
  const [stdEvent, setStdEvent] = useState('100m Livre');
  const [stdCategory, setStdCategory] = useState(athlete.category || 'Juvenil');
  const [stdSex, setStdSex] = useState<'M' | 'F' | 'all'>('all');
  const [stdPool, setStdPool] = useState<PoolLength>(50);
  const [stdTimeInput, setStdTimeInput] = useState('');
  const [stdError, setStdError] = useState<string | null>(null);

  const handleAddResult = async (e: React.FormEvent) => {
    e.preventDefault();
    const cs = parseSwimTime(timeInput);
    if (!cs) {
      setResultError('Tempo inválido. Ex: 52.40, 1:02.35 ou 16:05.12.');
      return;
    }
    const splits = parseSplitsInput(splitsInput);
    if (!splits.ok) {
      setResultError('Parciais inválidas. Separe por vírgula ou ponto e vírgula (ex: 25.40, 27.10).');
      return;
    }
    setResultError(null);
    const now = new Date().toISOString();
    const normEv = normalizeEventName(eventName) || eventName.trim();
    await onSaveResult({
      id: generateId('res'),
      coachId,
      teamId: athlete.teamId,
      athleteId: athlete.id,
      event: normEv,
      poolLength,
      timeCs: cs,
      splitsCs: splits.splitsCs.length > 0 ? splits.splitsCs : undefined,
      date: date || todayLocalISO(),
      competition: competition.trim() || (isOfficial ? 'Competição oficial' : 'Treino / Tomada'),
      isOfficial,
      createdAt: now,
      updatedAt: now,
    });
    setChartEvent(normEv);
    setChartPool(poolLength);
    setTimeInput('');
    setSplitsInput('');
  };

  const handleSaveGoalForChartEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSwimTime(customGoalInput);
    if (!parsed) {
      setGoalError('Meta inválida. Ex: 50.90 ou 1:01.20');
      return;
    }
    setGoalError(null);
    const now = new Date().toISOString();
    const normMain = normalizeEventName(athlete.mainEvent || '');
    if (normMain === effectiveChartEvent) {
      await onSaveAthlete({
        ...athlete,
        targetTimeCs: parsed,
        targetTime: formatSwimTime(parsed),
        updatedAt: now,
      });
    } else {
      const existingEvents = athlete.events ? [...athlete.events] : [];
      const idx = existingEvents.findIndex(
        (ev) => normalizeEventName(ev.event) === effectiveChartEvent
      );
      if (idx >= 0) {
        existingEvents[idx] = {
          ...existingEvents[idx],
          targetTimeCs: parsed,
          targetTime: formatSwimTime(parsed),
        };
      } else {
        existingEvents.push({
          id: generateId('ev'),
          event: effectiveChartEvent,
          targetTimeCs: parsed,
          targetTime: formatSwimTime(parsed),
        });
      }
      await onSaveAthlete({
        ...athlete,
        events: existingEvents,
        updatedAt: now,
      });
    }
    setCustomGoalInput('');
  };

  const handleAddStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cs = parseSwimTime(stdTimeInput);
    if (!cs || !stdName.trim()) {
      setStdError('Informe o nome do índice e um tempo válido (ex: 52.10 ou 1:02.50).');
      return;
    }
    setStdError(null);
    const now = new Date().toISOString();
    await onSaveStandard({
      id: generateId('std'),
      coachId,
      name: stdName.trim(),
      organization: stdOrg,
      event: normalizeEventName(stdEvent) || stdEvent.trim(),
      category: stdCategory.trim() || 'Absoluto',
      sex: stdSex === 'all' ? undefined : stdSex,
      poolLength: stdPool,
      timeCs: cs,
      createdAt: now,
      updatedAt: now,
    });
    setStdName('');
    setStdTimeInput('');
    setShowStandardForm(false);
  };

  // SVG chart geometry
  const chartPlot = useMemo(() => {
    if (chartSeries.length === 0) return null;
    const width = 560;
    const height = 210;
    const padL = 56;
    const padR = 20;
    const padT = 18;
    const padB = 34;

    const times = chartSeries.map((r) => r.timeCs);
    if (chartTargetCs) times.push(chartTargetCs);
    const rawMin = Math.min(...times);
    const rawMax = Math.max(...times);
    const span = Math.max(100, rawMax - rawMin);
    const yMin = rawMin - Math.round(span * 0.15);
    const yMax = rawMax + Math.round(span * 0.15);

    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const toX = (i: number) =>
      chartSeries.length === 1
        ? padL + innerW / 2
        : padL + (i / (chartSeries.length - 1)) * innerW;

    // Faster times (smaller cs) higher on chart
    const toY = (cs: number) => padT + ((cs - yMin) / Math.max(1, yMax - yMin)) * innerH;

    const points = chartSeries.map((r, i) => ({
      result: r,
      x: toX(i),
      y: toY(r.timeCs),
    }));

    const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
    const targetY = chartTargetCs ? toY(chartTargetCs) : null;

    return { width, height, padL, padR, padT, padB, yMin, yMax, points, polyline, targetY };
  }, [chartSeries, chartTargetCs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <datalist id="results-swim-events">
        {SWIM_EVENTS.map((ev) => (
          <option key={ev} value={ev} />
        ))}
      </datalist>

      {/* Register Result + Best Marks */}
      <div className="analytics-grid-2">
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <Plus size={15} /> Registrar tempo / competição
            </h2>
          </div>
          <form className="card-section" onSubmit={handleAddResult}>
            <div className="form-grid">
              <div className="field col-6">
                <label>Prova</label>
                <input
                  type="text"
                  list="results-swim-events"
                  className="input"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ex: 100m Livre"
                  required
                />
              </div>

              <div className="field col-3">
                <label>Piscina</label>
                <select
                  className="select"
                  value={poolLength}
                  onChange={(e) => setPoolLength(Number(e.target.value) as PoolLength)}
                >
                  <option value={25}>25m</option>
                  <option value={50}>50m</option>
                </select>
              </div>

              <div className="field col-3">
                <label>Tempo</label>
                <input
                  type="text"
                  className="input mono-num"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  placeholder="52.40 / 1:02.35"
                  required
                />
              </div>

              <div className="field col-6">
                <label>Parciais (opcional)</label>
                <input
                  type="text"
                  className="input mono-num"
                  value={splitsInput}
                  onChange={(e) => setSplitsInput(e.target.value)}
                  placeholder="Ex: 25.10, 27.30"
                />
              </div>

              <div className="field col-3">
                <label>Data</label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="field col-3">
                <label>Tipo</label>
                <select
                  className="select"
                  value={isOfficial ? 'official' : 'training'}
                  onChange={(e) => setIsOfficial(e.target.value === 'official')}
                >
                  <option value="official">Oficial</option>
                  <option value="training">Treino</option>
                </select>
              </div>

              <div className="field col-12">
                <label>Competição / contexto</label>
                <input
                  type="text"
                  className="input"
                  value={competition}
                  onChange={(e) => setCompetition(e.target.value)}
                  placeholder="Ex: Campeonato Paulista · Tomada de tempo"
                />
              </div>
            </div>

            {resultError && (
              <div className="auth-error" role="alert" style={{ marginTop: 10 }}>
                {resultError}
              </div>
            )}

            <div className="composer-actions">
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Salvar resultado
              </button>
            </div>
          </form>
        </section>

        {/* Auto-computed Best Marks + 25m<->50m conversion + WA Points */}
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <Award size={15} /> Melhores marcas & World Aquatics
            </h2>
            <span className="db-chip">{sex === 'F' ? 'Feminino' : 'Masculino'}</span>
          </div>
          <div className="card-section">
            {bestMarks.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                Nenhum resultado registrado para {athlete.name}. Lance o primeiro tempo ao lado para calcular melhores marcas, conversão 25m↔50m e pontos World Aquatics.
              </div>
            ) : (
              <div className="table-scroll">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Prova</th>
                      <th>Piscina</th>
                      <th>Melhor marca</th>
                      <th>Conv. aprox.</th>
                      <th>Pts WA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestMarks.map((bm) => {
                      const otherPool: PoolLength = bm.poolLength === 25 ? 50 : 25;
                      const convertedCs = convertPoolTimeCs(
                        bm.bestResult.timeCs,
                        bm.poolLength,
                        otherPool,
                        bm.event
                      );
                      const waPts = computeWorldAquaticsPoints(
                        bm.bestResult.timeCs,
                        bm.event,
                        bm.poolLength,
                        sex
                      );

                      return (
                        <tr key={`${bm.event}-${bm.poolLength}`}>
                          <td style={{ fontWeight: 600 }}>{bm.event}</td>
                          <td className="mono-num">{bm.poolLength}m</td>
                          <td>
                            <span className="mono-num" style={{ fontWeight: 700 }}>
                              {formatSwimTime(bm.bestResult.timeCs)}
                            </span>{' '}
                            <span className="db-chip" style={{ height: 20, fontSize: 11 }}>
                              {bm.bestResult.isOfficial ? 'Oficial' : 'Treino'}
                            </span>
                          </td>
                          <td className="mono-num" style={{ color: 'var(--ink-secondary)', fontSize: 12 }}>
                            ≈ {formatSwimTime(convertedCs)} ({otherPool}m)
                          </td>
                          <td className="mono-num" style={{ fontWeight: 600 }}>
                            {waPts !== null ? `${waPts} pts` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Evolution Chart with Goal Line */}
      <section className="surface-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2 className="card-title">
            <TrendingDown size={15} /> Evolução por prova
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="select"
              style={{ width: 'auto', minWidth: 160 }}
              value={effectiveChartEvent}
              onChange={(e) => setChartEvent(e.target.value)}
            >
              {availableEvents.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
            <div className="segmented" style={{ width: 'auto' }}>
              <button
                type="button"
                className={chartPool === 25 ? 'active' : ''}
                onClick={() => setChartPool(25)}
              >
                25m
              </button>
              <button
                type="button"
                className={chartPool === 50 ? 'active' : ''}
                onClick={() => setChartPool(50)}
              >
                50m
              </button>
            </div>
          </div>
        </div>
        <div className="card-section">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
              {chartTargetCs ? (
                <span>
                  Linha da meta ({effectiveChartEvent}):{' '}
                  <strong className="mono-num" style={{ color: 'var(--success)' }}>
                    {formatSwimTime(chartTargetCs)}
                  </strong>
                </span>
              ) : (
                <span>Sem meta definida para {effectiveChartEvent}.</span>
              )}
            </div>
            <form
              onSubmit={handleSaveGoalForChartEvent}
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}
            >
              <input
                type="text"
                className="input mono-num"
                style={{ width: 130, height: 32 }}
                value={customGoalInput}
                onChange={(e) => setCustomGoalInput(e.target.value)}
                placeholder="Meta (ex: 50.90)"
              />
              <button type="submit" className="btn btn-sm">
                Definir meta
              </button>
            </form>
          </div>
          {goalError && (
            <div className="auth-error" style={{ marginBottom: 10 }}>
              {goalError}
            </div>
          )}

          {!chartPlot ? (
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', padding: '20px 0' }}>
              Sem resultados para {effectiveChartEvent} em piscina de {chartPool}m.
            </div>
          ) : (
            <div className="table-scroll">
              <svg
                viewBox={`0 0 ${chartPlot.width} ${chartPlot.height}`}
                style={{ width: '100%', minWidth: 360, maxHeight: 230, display: 'block' }}
                aria-label={`Gráfico de evolução em ${effectiveChartEvent}`}
              >
                {/* Horizontal reference grid */}
                {[0, 0.5, 1].map((ratio) => {
                  const cs = Math.round(
                    chartPlot.yMin + ratio * (chartPlot.yMax - chartPlot.yMin)
                  );
                  const y =
                    chartPlot.padT +
                    ratio * (chartPlot.height - chartPlot.padT - chartPlot.padB);
                  return (
                    <g key={ratio}>
                      <line
                        x1={chartPlot.padL}
                        x2={chartPlot.width - chartPlot.padR}
                        y1={y}
                        y2={y}
                        stroke="var(--border-hairline)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={chartPlot.padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fill="var(--ink-muted)"
                      >
                        {formatSwimTime(cs)}
                      </text>
                    </g>
                  );
                })}

                {/* Goal line */}
                {chartPlot.targetY !== null && chartTargetCs !== null && (
                  <g>
                    <line
                      x1={chartPlot.padL}
                      x2={chartPlot.width - chartPlot.padR}
                      y1={chartPlot.targetY}
                      y2={chartPlot.targetY}
                      stroke="var(--success)"
                      strokeWidth="1.75"
                      strokeDasharray="6 4"
                    />
                    <text
                      x={chartPlot.width - chartPlot.padR}
                      y={chartPlot.targetY - 5}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="600"
                      fill="var(--success)"
                    >
                      Meta {formatSwimTime(chartTargetCs)}
                    </text>
                  </g>
                )}

                {/* Trend line */}
                {chartPlot.points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.2"
                    points={chartPlot.polyline}
                  />
                )}

                {/* Points */}
                {chartPlot.points.map((pt) => (
                  <g key={pt.result.id}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={5}
                      fill={pt.result.isOfficial ? 'var(--accent)' : 'var(--bg-surface)'}
                      stroke="var(--accent)"
                      strokeWidth="2"
                    >
                      <title>
                        {formatDateBR(pt.result.date)} · {formatSwimTime(pt.result.timeCs)} (
                        {pt.result.competition})
                      </title>
                    </circle>
                    <text
                      x={pt.x}
                      y={pt.y - 9}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="var(--ink-primary)"
                    >
                      {formatSwimTime(pt.result.timeCs)}
                    </text>
                    <text
                      x={pt.x}
                      y={chartPlot.height - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--ink-muted)"
                    >
                      {pt.result.date.slice(5).split('-').reverse().join('/')}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>
      </section>

      {/* Qualifying Standards (Índices) */}
      <section className="surface-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2 className="card-title">
            <Flag size={15} /> Índices & classificatórias ({standardEvals.length})
          </h2>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowStandardForm((v) => !v)}
          >
            <Plus size={14} /> {showStandardForm ? 'Fechar' : 'Cadastrar índice'}
          </button>
        </div>

        {showStandardForm && (
          <form
            className="card-section"
            style={{ borderBottom: '1px solid var(--border-hairline)', background: 'var(--bg-subtle)' }}
            onSubmit={handleAddStandard}
          >
            <div className="form-grid">
              <div className="field col-4">
                <label>Nome do índice / competição</label>
                <input
                  type="text"
                  className="input"
                  value={stdName}
                  onChange={(e) => setStdName(e.target.value)}
                  placeholder="Ex: Troféu Brasil 2026"
                  required
                />
              </div>

              <div className="field col-3">
                <label>Entidade / nível</label>
                <select
                  className="select"
                  value={stdOrg}
                  onChange={(e) => setStdOrg(e.target.value as QualifyingOrganization)}
                >
                  {ORGANIZATIONS.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field col-3">
                <label>Prova</label>
                <input
                  type="text"
                  list="results-swim-events"
                  className="input"
                  value={stdEvent}
                  onChange={(e) => setStdEvent(e.target.value)}
                  required
                />
              </div>

              <div className="field col-2">
                <label>Tempo índice</label>
                <input
                  type="text"
                  className="input mono-num"
                  value={stdTimeInput}
                  onChange={(e) => setStdTimeInput(e.target.value)}
                  placeholder="51.90"
                  required
                />
              </div>

              <div className="field col-4">
                <label>Categoria</label>
                <input
                  type="text"
                  className="input"
                  value={stdCategory}
                  onChange={(e) => setStdCategory(e.target.value)}
                  placeholder="Juvenil, Júnior, Absoluto, Todas..."
                />
              </div>

              <div className="field col-4">
                <label>Piscina</label>
                <select
                  className="select"
                  value={stdPool}
                  onChange={(e) => setStdPool(Number(e.target.value) as PoolLength)}
                >
                  <option value={25}>25m</option>
                  <option value={50}>50m</option>
                </select>
              </div>

              <div className="field col-4">
                <label>Sexo</label>
                <select
                  className="select"
                  value={stdSex}
                  onChange={(e) => setStdSex(e.target.value as 'M' | 'F' | 'all')}
                >
                  <option value="all">Ambos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
            </div>

            {stdError && (
              <div className="auth-error" style={{ marginTop: 10 }}>
                {stdError}
              </div>
            )}

            <div className="composer-actions">
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Salvar índice
              </button>
            </div>
          </form>
        )}

        <div className="card-section">
          {standardEvals.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
              Nenhum índice cadastrado para a categoria/sexo de {athlete.name}. Cadastre índices estaduais, CBDA, Troféu Brasil ou seletivas acima.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Índice</th>
                    <th>Prova / Piscina</th>
                    <th>Tempo índice</th>
                    <th>Melhor do atleta</th>
                    <th>Situação</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {standardEvals.map((ev) => (
                    <tr key={ev.standard.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ev.standard.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                          {ev.standard.organization} · {ev.standard.category}
                        </div>
                      </td>
                      <td>
                        {ev.standard.event} · <span className="mono-num">{ev.standard.poolLength}m</span>
                      </td>
                      <td className="mono-num" style={{ fontWeight: 600 }}>
                        {formatSwimTime(ev.standard.timeCs)}
                      </td>
                      <td className="mono-num">
                        {ev.bestResult ? formatSwimTime(ev.bestResult.timeCs) : '—'}
                      </td>
                      <td>
                        <span
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
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-icon"
                          title="Excluir índice"
                          onClick={() => onDeleteStandard(ev.standard.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Complete Results History */}
      {athleteResults.length > 0 && (
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">Histórico de resultados ({athleteResults.length})</h2>
          </div>
          <div className="table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Prova</th>
                  <th>Piscina</th>
                  <th>Tempo</th>
                  <th>Parciais</th>
                  <th>Pts WA</th>
                  <th>Competição</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {athleteResults.map((res) => {
                  const pts = computeWorldAquaticsPoints(
                    res.timeCs,
                    res.event,
                    res.poolLength,
                    sex
                  );
                  return (
                    <tr key={res.id}>
                      <td className="mono-num">{formatDateBR(res.date)}</td>
                      <td style={{ fontWeight: 600 }}>{res.event}</td>
                      <td className="mono-num">{res.poolLength}m</td>
                      <td className="mono-num" style={{ fontWeight: 700 }}>
                        {formatSwimTime(res.timeCs)}
                      </td>
                      <td className="mono-num" style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                        {res.splitsCs?.length
                          ? res.splitsCs.map((s) => formatSwimTime(s)).join(' · ')
                          : '—'}
                      </td>
                      <td className="mono-num">{pts !== null ? `${pts}` : '—'}</td>
                      <td>
                        <span>{res.competition}</span>{' '}
                        <span className="db-chip" style={{ height: 20, fontSize: 11 }}>
                          {res.isOfficial ? 'Oficial' : 'Treino'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-icon"
                          title="Excluir resultado"
                          onClick={() => onDeleteResult(res.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
