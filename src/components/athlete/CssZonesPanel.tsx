import React, { useMemo, useState } from 'react';
import { Gauge, Plus, Trash2, Waves } from 'lucide-react';
import type { Athlete, CatalogDatabase, CssTest, PoolLength } from '../../types/swimming';
import { todayLocalISO } from '../../domain/date';
import {
  computeCssPace100Cs,
  getAllZonePaces,
  getLatestCssForAthlete,
  getSeriesTargetTimeCs,
} from '../../domain/pace';
import { formatSwimTime, parseSwimTime } from '../../domain/time';
import { formatDateBR, generateId } from '../../utils/storage';

interface CssZonesPanelProps {
  athlete: Athlete;
  coachId: string;
  catalog: CatalogDatabase;
  cssTests: CssTest[];
  onSaveCssTest: (test: CssTest) => Promise<void> | void;
  onDeleteCssTest: (id: string) => Promise<void> | void;
}

export const CssZonesPanel: React.FC<CssZonesPanelProps> = ({
  athlete,
  coachId,
  catalog,
  cssTests,
  onSaveCssTest,
  onDeleteCssTest,
}) => {
  const athleteTests = useMemo(
    () =>
      cssTests
        .filter((t) => t.athleteId === athlete.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    [cssTests, athlete.id]
  );

  const latestTest = useMemo(
    () => getLatestCssForAthlete(cssTests, athlete.id),
    [cssTests, athlete.id]
  );

  const [t400Input, setT400Input] = useState('');
  const [t200Input, setT200Input] = useState('');
  const [poolLength, setPoolLength] = useState<PoolLength>(25);
  const [date, setDate] = useState(() => todayLocalISO());
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const previewCssCs = useMemo(() => {
    const t400 = parseSwimTime(t400Input);
    const t200 = parseSwimTime(t200Input);
    if (!t400 || !t200) return null;
    return computeCssPace100Cs(t400, t200);
  }, [t400Input, t200Input]);

  const zonePaces = useMemo(
    () => (latestTest ? getAllZonePaces(latestTest.cssPace100Cs) : []),
    [latestTest]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t400Cs = parseSwimTime(t400Input);
    const t200Cs = parseSwimTime(t200Input);
    if (!t400Cs || !t200Cs) {
      setFormError('Informe tempos válidos para 400m (ex: 4:40.00) e 200m (ex: 2:10.00).');
      return;
    }
    const cssPace100Cs = computeCssPace100Cs(t400Cs, t200Cs);
    if (!cssPace100Cs) {
      setFormError('O tempo dos 400m precisa ser maior que o tempo dos 200m.');
      return;
    }
    setFormError(null);
    const now = new Date().toISOString();
    await onSaveCssTest({
      id: generateId('css'),
      coachId,
      teamId: athlete.teamId,
      athleteId: athlete.id,
      date: date || todayLocalISO(),
      poolLength,
      t400Cs,
      t200Cs,
      cssPace100Cs,
      notes: notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    setT400Input('');
    setT200Input('');
    setNotes('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="analytics-grid-2">
        {/* CSS Test Form */}
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <Gauge size={15} /> Registrar teste de CSS (400m + 200m)
            </h2>
          </div>
          <form className="card-section" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field col-4">
                <label>Tempo 400m</label>
                <input
                  type="text"
                  className="input mono-num"
                  value={t400Input}
                  onChange={(e) => setT400Input(e.target.value)}
                  placeholder="Ex: 4:40.00"
                  required
                />
              </div>

              <div className="field col-4">
                <label>Tempo 200m</label>
                <input
                  type="text"
                  className="input mono-num"
                  value={t200Input}
                  onChange={(e) => setT200Input(e.target.value)}
                  placeholder="Ex: 2:10.00"
                  required
                />
              </div>

              <div className="field col-4">
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

              <div className="field col-4">
                <label>Data do teste</label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="field col-8">
                <label>Observações (opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Teste pós-bloco de base, descansado..."
                />
              </div>
            </div>

            {previewCssCs && (
              <div className="phase-hint-strip" style={{ marginTop: 12 }}>
                CSS calculado:{' '}
                <strong className="mono-num" style={{ color: 'var(--accent-primary)' }}>
                  {formatSwimTime(previewCssCs)} / 100m
                </strong>{' '}
                (velocidade crítica = {(10000 / previewCssCs).toFixed(2)} m/s)
              </div>
            )}

            {formError && (
              <div className="auth-error" role="alert" style={{ marginTop: 10 }}>
                {formError}
              </div>
            )}

            <div className="composer-actions">
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Salvar teste de CSS
              </button>
            </div>
          </form>
        </section>

        {/* Individual Z1-VEL Target Paces */}
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <Waves size={15} /> Zonas individuais por ritmo (Z1–VEL)
            </h2>
            {latestTest && (
              <span className="db-chip mono-num">
                CSS: {formatSwimTime(latestTest.cssPace100Cs)}/100m
              </span>
            )}
          </div>
          <div className="card-section">
            {!latestTest ? (
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                Registre um teste de 400m + 200m ao lado para calcular os ritmos individuais de Z1 a VEL, atualizar as estimativas de duração dos treinos e exibir os tempos-alvo na ficha impressa.
              </div>
            ) : (
              <div className="table-scroll">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Zona</th>
                      <th>Alvo / 100m</th>
                      <th>50m</th>
                      <th>200m</th>
                      <th>400m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zonePaces.map((zp) => {
                      const zoneMeta = catalog.zones.find((z) => z.id === zp.zoneId);
                      return (
                        <tr key={zp.zoneId}>
                          <td>
                            <span
                              className="zone-badge"
                              style={{
                                backgroundColor: zoneMeta?.bgHex,
                                borderColor: zoneMeta?.borderHex,
                                color: zoneMeta?.textHex,
                              }}
                            >
                              {zp.zoneId} · {zoneMeta?.shortLabel}
                            </span>
                          </td>
                          <td className="mono-num" style={{ fontWeight: 700 }}>
                            {zp.pace100Text}
                          </td>
                          <td className="mono-num">
                            {formatSwimTime(
                              getSeriesTargetTimeCs(latestTest.cssPace100Cs, zp.zoneId, 50)
                            )}
                          </td>
                          <td className="mono-num">
                            {formatSwimTime(
                              getSeriesTargetTimeCs(latestTest.cssPace100Cs, zp.zoneId, 200)
                            )}
                          </td>
                          <td className="mono-num">
                            {formatSwimTime(
                              getSeriesTargetTimeCs(latestTest.cssPace100Cs, zp.zoneId, 400)
                            )}
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

      {/* History */}
      {athleteTests.length > 0 && (
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">Histórico de testes de CSS ({athleteTests.length})</h2>
          </div>
          <div className="table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Piscina</th>
                  <th>400m</th>
                  <th>200m</th>
                  <th>CSS (/100m)</th>
                  <th>Observações</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {athleteTests.map((t) => (
                  <tr key={t.id}>
                    <td className="mono-num">{formatDateBR(t.date)}</td>
                    <td className="mono-num">{t.poolLength}m</td>
                    <td className="mono-num">{formatSwimTime(t.t400Cs)}</td>
                    <td className="mono-num">{formatSwimTime(t.t200Cs)}</td>
                    <td className="mono-num" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {formatSwimTime(t.cssPace100Cs)}
                    </td>
                    <td style={{ color: 'var(--ink-secondary)', fontSize: 12 }}>
                      {t.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-danger-ghost btn-icon"
                        title="Excluir teste CSS"
                        onClick={() => onDeleteCssTest(t.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
