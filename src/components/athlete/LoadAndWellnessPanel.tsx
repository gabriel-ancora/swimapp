import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  HeartPulse,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  Athlete,
  CatalogDatabase,
  RpeLog,
  WellnessEntry,
  Workout,
} from '../../types/swimming';
import { todayLocalISO } from '../../domain/date';
import {
  computeLoadMetrics,
  computeSessionLoad,
  evaluateWellnessTrend,
} from '../../domain/load';
import { computeWorkoutStats, formatDateBR, generateId } from '../../utils/storage';

interface LoadAndWellnessPanelProps {
  athlete: Athlete;
  coachId: string;
  catalog: CatalogDatabase;
  athleteCssPace100Cs?: number;
  assignedCompletedWorkouts: Workout[];
  rpeLogs: RpeLog[];
  wellnessEntries: WellnessEntry[];
  onSaveRpeLog: (log: RpeLog) => Promise<void> | void;
  onDeleteRpeLog: (id: string) => Promise<void> | void;
  onSaveWellness: (entry: WellnessEntry) => Promise<void> | void;
  onDeleteWellness: (id: string) => Promise<void> | void;
}

const RPE_OPTIONS = [
  { val: 1, label: '1 · Muito leve' },
  { val: 2, label: '2 · Leve' },
  { val: 3, label: '3 · Moderado' },
  { val: 4, label: '4 · Um pouco forte' },
  { val: 5, label: '5 · Forte' },
  { val: 6, label: '6 · Forte+' },
  { val: 7, label: '7 · Muito forte' },
  { val: 8, label: '8 · Muito forte+' },
  { val: 9, label: '9 · Quase máx.' },
  { val: 10, label: '10 · Máximo' },
];

export const LoadAndWellnessPanel: React.FC<LoadAndWellnessPanelProps> = ({
  athlete,
  coachId,
  catalog,
  athleteCssPace100Cs,
  assignedCompletedWorkouts,
  rpeLogs,
  wellnessEntries,
  onSaveRpeLog,
  onDeleteRpeLog,
  onSaveWellness,
  onDeleteWellness,
}) => {
  const athleteRpe = useMemo(
    () =>
      rpeLogs
        .filter((l) => l.athleteId === athlete.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    [rpeLogs, athlete.id]
  );

  const athleteWellness = useMemo(
    () =>
      wellnessEntries
        .filter((w) => w.athleteId === athlete.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    [wellnessEntries, athlete.id]
  );

  const loadMetrics = useMemo(() => computeLoadMetrics(athleteRpe), [athleteRpe]);
  const wellnessEval = useMemo(() => evaluateWellnessTrend(athleteWellness), [athleteWellness]);

  // RPE form state
  const latestWorkout = assignedCompletedWorkouts[assignedCompletedWorkouts.length - 1];
  const defaultWorkoutMinutes = latestWorkout
    ? Math.max(
        15,
        computeWorkoutStats(latestWorkout.items, catalog.zones, athleteCssPace100Cs)
          .estimatedMinutes
      )
    : 60;

  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(
    () => latestWorkout?.id ?? ''
  );
  const [rpeDate, setRpeDate] = useState<string>(() => latestWorkout?.date || todayLocalISO());
  const [rpeValue, setRpeValue] = useState<number>(6);
  const [durationMinutes, setDurationMinutes] = useState<number>(defaultWorkoutMinutes);
  const [rpeNotes, setRpeNotes] = useState<string>('');

  // Wellness form state
  const [wDate, setWDate] = useState<string>(() => todayLocalISO());
  const [sleep, setSleep] = useState<number>(4);
  const [soreness, setSoreness] = useState<number>(4);
  const [stress, setStress] = useState<number>(4);
  const [mood, setMood] = useState<number>(4);
  const [wNotes, setWNotes] = useState<string>('');

  const handleSelectWorkoutForRpe = (wkId: string) => {
    setSelectedWorkoutId(wkId);
    const wk = assignedCompletedWorkouts.find((w) => w.id === wkId);
    if (wk) {
      if (wk.date) setRpeDate(wk.date);
      const st = computeWorkoutStats(wk.items, catalog.zones, athleteCssPace100Cs);
      if (st.estimatedMinutes > 0) setDurationMinutes(st.estimatedMinutes);
    }
  };

  const handleSubmitRpe = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Math.max(1, Math.round(durationMinutes));
    const safeRpe = Math.max(0, Math.min(10, rpeValue));
    const now = new Date().toISOString();
    await onSaveRpeLog({
      id: generateId('rpe'),
      coachId,
      teamId: athlete.teamId,
      athleteId: athlete.id,
      workoutId: selectedWorkoutId || undefined,
      date: rpeDate || todayLocalISO(),
      rpe: safeRpe,
      durationMinutes: mins,
      load: computeSessionLoad(safeRpe, mins),
      notes: rpeNotes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    setRpeNotes('');
  };

  const handleSubmitWellness = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    await onSaveWellness({
      id: generateId('well'),
      coachId,
      teamId: athlete.teamId,
      athleteId: athlete.id,
      date: wDate || todayLocalISO(),
      sleep,
      soreness,
      stress,
      mood,
      totalScore: sleep + soreness + stress + mood,
      notes: wNotes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    setWNotes('');
  };

  const max28Load = Math.max(1, ...loadMetrics.dailyLoads28d.map((d) => d.load));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ACWR & Wellness Alerts */}
      {(loadMetrics.acwrOutOfRange || loadMetrics.monotonyHigh || wellnessEval.status === 'risk') && (
        <div
          className="surface-card card-section"
          style={{
            borderColor: 'var(--danger-border)',
            background: 'var(--danger-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--danger)' }}>
            <AlertTriangle size={16} /> Alertas de carga interna & recuperação
          </div>
          {loadMetrics.acwrOutOfRange && loadMetrics.acwr !== null && (
            <div style={{ fontSize: 13 }}>
              • <strong>ACWR fora da faixa segura (0,80–1,30):</strong> atual em{' '}
              <span className="mono-num">{loadMetrics.acwr.toFixed(2)}</span>{' '}
              ({loadMetrics.acwr < 0.8 ? 'subcarga / destreinamento' : 'pico de sobrecarga'}).
            </div>
          )}
          {loadMetrics.monotonyHigh && loadMetrics.monotony !== null && (
            <div style={{ fontSize: 13 }}>
              • <strong>Monotonia elevada ({loadMetrics.monotony.toFixed(2)}):</strong> variar estímulos fortes e regenerativos na semana.
            </div>
          )}
          {wellnessEval.status === 'risk' && wellnessEval.alertMessage && (
            <div style={{ fontSize: 13 }}>• {wellnessEval.alertMessage}</div>
          )}
        </div>
      )}

      {/* 4 Validated Internal Load KPIs */}
      <div className="kpi-grid">
        <div className="surface-card kpi-card">
          <div className="kpi-top">
            <span className="metric-label">ACWR (7d / 28d)</span>
            {loadMetrics.acwrOutOfRange ? (
              <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
            ) : (
              <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
            )}
          </div>
          <div className="kpi-value mono-num">
            {loadMetrics.acwr !== null ? loadMetrics.acwr.toFixed(2) : '—'}
          </div>
          <div className="kpi-sub">
            {loadMetrics.acwr === null
              ? 'Registre RPE para calcular'
              : loadMetrics.acwrOutOfRange
                ? 'Fora da faixa ideal (0,80–1,30)'
                : 'Dentro da faixa segura (0,80–1,30)'}
          </div>
        </div>

        <div className="surface-card kpi-card">
          <div className="kpi-top">
            <span className="metric-label">Carga aguda (7 dias)</span>
            <Activity size={16} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="kpi-value mono-num">{loadMetrics.acuteLoad7d} UA</div>
          <div className="kpi-sub">
            Crônica semanal (28d): {loadMetrics.chronicWeeklyAvg} UA
          </div>
        </div>

        <div className="surface-card kpi-card">
          <div className="kpi-top">
            <span className="metric-label">Monotonia & Strain</span>
            <Activity size={16} />
          </div>
          <div className="kpi-value mono-num">
            {loadMetrics.monotony !== null ? loadMetrics.monotony.toFixed(2) : '—'}
          </div>
          <div className="kpi-sub">
            Strain semanal:{' '}
            <strong className="mono-num">
              {loadMetrics.strain !== null ? `${loadMetrics.strain} UA` : '—'}
            </strong>
          </div>
        </div>

        <div className="surface-card kpi-card">
          <div className="kpi-top">
            <span className="metric-label">Wellness diário</span>
            <HeartPulse
              size={16}
              style={{
                color:
                  wellnessEval.status === 'risk'
                    ? 'var(--danger)'
                    : wellnessEval.status === 'ok'
                      ? 'var(--success)'
                      : 'var(--warning)',
              }}
            />
          </div>
          <div className="kpi-value mono-num">
            {wellnessEval.latestScore !== null ? `${wellnessEval.latestScore}/20` : '—'}
          </div>
          <div className="kpi-sub">
            {wellnessEval.baselineAvg !== null
              ? `Média recente: ${wellnessEval.baselineAvg}/20`
              : 'Sono, dor, estresse e humor'}
          </div>
        </div>
      </div>

      {/* 28-day Session-RPE Load Chart */}
      <section className="surface-card">
        <div className="card-header">
          <h2 className="card-title">Carga diária dos últimos 28 dias (sRPE = RPE × min)</h2>
          <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Últimos 7d destacados
          </span>
        </div>
        <div className="card-section">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(28, minmax(6px, 1fr))',
              gap: 4,
              alignItems: 'end',
              height: 92,
            }}
          >
            {loadMetrics.dailyLoads28d.map((pt, idx) => {
              const isAcute = idx >= 21;
              const hPct = pt.load > 0 ? Math.max(8, Math.round((pt.load / max28Load) * 100)) : 4;
              return (
                <div
                  key={pt.date}
                  title={`${formatDateBR(pt.date)}: ${pt.load} UA`}
                  style={{
                    height: `${hPct}%`,
                    borderRadius: 3,
                    background:
                      pt.load === 0
                        ? 'var(--bg-active)'
                        : isAcute
                          ? 'var(--accent)'
                          : 'var(--zone-z2)',
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Register RPE + Register Wellness */}
      <div className="analytics-grid-2">
        {/* Session RPE Form */}
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <Plus size={15} /> Registrar sessão-RPE (0–10)
            </h2>
          </div>
          <form className="card-section" onSubmit={handleSubmitRpe}>
            <div className="form-grid">
              {assignedCompletedWorkouts.length > 0 && (
                <div className="field col-12">
                  <label>Treino concluído (opcional)</label>
                  <select
                    className="select"
                    value={selectedWorkoutId}
                    onChange={(e) => handleSelectWorkoutForRpe(e.target.value)}
                  >
                    <option value="">Sessão avulsa / sem vínculo</option>
                    {[...assignedCompletedWorkouts]
                      .reverse()
                      .slice(0, 15)
                      .map((wk) => (
                        <option key={wk.id} value={wk.id}>
                          {formatDateBR(wk.date)} · {wk.title || wk.objective}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="field col-6">
                <label>Data</label>
                <input
                  type="date"
                  className="input"
                  value={rpeDate}
                  onChange={(e) => setRpeDate(e.target.value)}
                  required
                />
              </div>

              <div className="field col-6">
                <label>Duração (minutos)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  className="input mono-num"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="field col-12">
                <label>
                  RPE percebido:{' '}
                  <strong className="mono-num" style={{ color: 'var(--accent-primary)' }}>
                    {rpeValue}/10
                  </strong>
                </label>
                <div className="chip-row">
                  {RPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      className={`chip-btn mono-num ${rpeValue === opt.val ? 'selected' : ''}`}
                      title={opt.label}
                      onClick={() => setRpeValue(opt.val)}
                    >
                      {opt.val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field col-12">
                <label>Observações (opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={rpeNotes}
                  onChange={(e) => setRpeNotes(e.target.value)}
                  placeholder="Ex: Sensação de água pesada, boa resposta no final..."
                />
              </div>
            </div>

            <div className="phase-hint-strip" style={{ marginTop: 12 }}>
              Carga da sessão:{' '}
              <strong className="mono-num">
                {computeSessionLoad(rpeValue, durationMinutes)} UA
              </strong>{' '}
              ({rpeValue} × {Math.max(0, Math.round(durationMinutes))} min)
            </div>

            <div className="composer-actions">
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Registrar RPE
              </button>
            </div>
          </form>

          {athleteRpe.length > 0 && (
            <div className="table-scroll" style={{ borderTop: '1px solid var(--border-hairline)' }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>RPE</th>
                    <th>Duração</th>
                    <th>Carga</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {athleteRpe.slice(0, 8).map((log) => (
                    <tr key={log.id}>
                      <td className="mono-num">{formatDateBR(log.date)}</td>
                      <td className="mono-num" style={{ fontWeight: 600 }}>
                        {log.rpe}/10
                      </td>
                      <td className="mono-num">{log.durationMinutes} min</td>
                      <td className="mono-num" style={{ fontWeight: 700 }}>
                        {log.load} UA
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-icon"
                          title="Excluir registro RPE"
                          onClick={() => onDeleteRpeLog(log.id)}
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
        </section>

        {/* Daily Wellness Questionnaire */}
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <HeartPulse size={15} /> Wellness diário (1 = pior · 5 = ótimo)
            </h2>
            {wellnessEval.latestScore !== null && (
              <span
                className={`readiness-badge ${
                  wellnessEval.status === 'risk'
                    ? 'tone-fatigue'
                    : wellnessEval.status === 'attention'
                      ? 'tone-detraining'
                      : 'tone-optimal'
                }`}
              >
                {wellnessEval.latestScore}/20
              </span>
            )}
          </div>
          <form className="card-section" onSubmit={handleSubmitWellness}>
            <div className="form-grid">
              <div className="field col-12">
                <label>Data</label>
                <input
                  type="date"
                  className="input"
                  value={wDate}
                  onChange={(e) => setWDate(e.target.value)}
                  required
                />
              </div>

              {(
                [
                  { label: 'Qualidade do sono', value: sleep, setter: setSleep },
                  { label: 'Dor muscular (5 = sem dor)', value: soreness, setter: setSoreness },
                  { label: 'Estresse (5 = relaxado)', value: stress, setter: setStress },
                  { label: 'Humor / disposição', value: mood, setter: setMood },
                ] as const
              ).map((dim) => (
                <div className="field col-6" key={dim.label}>
                  <label>
                    {dim.label}: <strong className="mono-num">{dim.value}/5</strong>
                  </label>
                  <div className="chip-row">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`chip-btn mono-num ${dim.value === n ? 'selected' : ''}`}
                        onClick={() => dim.setter(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="field col-12">
                <label>Observações (opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={wNotes}
                  onChange={(e) => setWNotes(e.target.value)}
                  placeholder="Ex: Dormiu pouco antes de prova, ombro cansado..."
                />
              </div>
            </div>

            <div className="composer-actions">
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Salvar wellness ({sleep + soreness + stress + mood}/20)
              </button>
            </div>
          </form>

          {athleteWellness.length > 0 && (
            <div className="table-scroll" style={{ borderTop: '1px solid var(--border-hairline)' }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Sono</th>
                    <th>Dor</th>
                    <th>Estresse</th>
                    <th>Humor</th>
                    <th>Total</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {athleteWellness.slice(0, 8).map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono-num">{formatDateBR(entry.date)}</td>
                      <td className="mono-num">{entry.sleep}</td>
                      <td className="mono-num">{entry.soreness}</td>
                      <td className="mono-num">{entry.stress}</td>
                      <td className="mono-num">{entry.mood}</td>
                      <td className="mono-num" style={{ fontWeight: 700 }}>
                        {entry.totalScore}/20
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-icon"
                          title="Excluir registro de wellness"
                          onClick={() => onDeleteWellness(entry.id)}
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
        </section>
      </div>
    </div>
  );
};
