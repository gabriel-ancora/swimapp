import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Copy,
  Edit3,
  FilePlus2,
  Plus,
  Printer,
  Save,
  Trash2,
} from 'lucide-react';
import type {
  Athlete,
  BlockType,
  CatalogDatabase,
  Team,
  Workout,
  WorkoutItem,
  WorkoutTargetScope,
} from '../types/swimming';
import { computeWorkoutStats, formatMeters, generateId, getItemMeters } from '../utils/storage';
import { SeriesComposer } from './SeriesComposer';

interface WorkoutBuilderProps {
  draft: Workout;
  isEditingExisting: boolean;
  catalog: CatalogDatabase;
  activeTeam: Team | null;
  athletes: Athlete[];
  onChangeDraft: (updated: Workout) => void;
  onSaveWorkout: () => void;
  onPrintWorkout: () => void;
  onResetDraft: () => void;
}

const BLOCKS: Array<{ key: BlockType; title: string; subtitle: string }> = [
  {
    key: 'aquecimento',
    title: 'Aquecimento',
    subtitle: 'Ativação neuromuscular, amplitude e preparação técnica',
  },
  {
    key: 'principal',
    title: 'Série Principal',
    subtitle: 'Bloco alvo da sessão (limiar, VO2, ritmo de prova ou velocidade)',
  },
  {
    key: 'complementar',
    title: 'Complementares & Soltura',
    subtitle: 'Educativos, perna, braço, submerso e remoção de lactato',
  },
];

export const WorkoutBuilder: React.FC<WorkoutBuilderProps> = ({
  draft,
  isEditingExisting,
  catalog,
  activeTeam,
  athletes,
  onChangeDraft,
  onSaveWorkout,
  onPrintWorkout,
  onResetDraft,
}) => {
  const [activeComposerBlock, setActiveComposerBlock] = useState<BlockType | null>(null);
  const [editingItem, setEditingItem] = useState<WorkoutItem | null>(null);

  const stats = computeWorkoutStats(draft.items, catalog.zones);

  const updateField = <K extends keyof Workout>(field: K, value: Workout[K]) => {
    onChangeDraft({ ...draft, [field]: value });
  };

  const currentScope: WorkoutTargetScope = draft.targetScope ?? 'equipe';

  const handleScopeChange = (scope: WorkoutTargetScope) => {
    onChangeDraft({
      ...draft,
      targetScope: scope,
      targetCategory:
        scope === 'categoria'
          ? draft.targetCategory || activeTeam?.categories[0] || ''
          : undefined,
      targetAthleteIds: scope === 'atletas' ? draft.targetAthleteIds ?? [] : undefined,
    });
  };

  const toggleTargetAthlete = (athleteId: string) => {
    const current = draft.targetAthleteIds ?? [];
    const next = current.includes(athleteId)
      ? current.filter((id) => id !== athleteId)
      : [...current, athleteId];
    onChangeDraft({ ...draft, targetAthleteIds: next });
  };

  const handleSaveItem = (item: WorkoutItem) => {
    if (editingItem) {
      onChangeDraft({
        ...draft,
        items: draft.items.map((existing) => (existing.id === item.id ? item : existing)),
      });
      setEditingItem(null);
      setActiveComposerBlock(null);
    } else {
      onChangeDraft({
        ...draft,
        items: [...draft.items, item],
      });
      setActiveComposerBlock(null);
    }
  };

  const handleDeleteItem = (id: string) => {
    onChangeDraft({
      ...draft,
      items: draft.items.filter((i) => i.id !== id),
    });
  };

  const handleDuplicateItem = (item: WorkoutItem) => {
    const clone: WorkoutItem = { ...item, id: generateId('it') };
    const idx = draft.items.findIndex((i) => i.id === item.id);
    const next = [...draft.items];
    next.splice(idx + 1, 0, clone);
    onChangeDraft({ ...draft, items: next });
  };

  const handleMoveItem = (item: WorkoutItem, direction: -1 | 1) => {
    const blockItems = draft.items.filter((i) => i.block === item.block);
    const pos = blockItems.findIndex((i) => i.id === item.id);
    const targetPos = pos + direction;
    if (targetPos < 0 || targetPos >= blockItems.length) return;

    const swapTarget = blockItems[targetPos];
    const next = [...draft.items];
    const idxA = next.findIndex((i) => i.id === item.id);
    const idxB = next.findIndex((i) => i.id === swapTarget.id);
    [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
    onChangeDraft({ ...draft, items: next });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-eyebrow">
            {isEditingExisting ? 'Modo de Edição · Ficha Ativa' : 'Planejamento de Sessão'}
          </span>
          <h1 className="page-title">
            {isEditingExisting ? 'Modificar Treino' : 'Novo Treino de Alto Rendimento'}
          </h1>
          <p className="page-subtitle">
            Estruture aquecimento, séries principais e complementares com controle preciso de
            intervalos e zonas fisiológicas.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="btn" onClick={onResetDraft}>
            <FilePlus2 size={15} />
            Limpar / Novo
          </button>
          <button type="button" className="btn" onClick={onPrintWorkout}>
            <Printer size={15} />
            Imprimir
          </button>
          <button type="button" className="btn btn-primary" onClick={onSaveWorkout}>
            <Save size={15} />
            {isEditingExisting ? 'Salvar Alterações' : 'Salvar Treino'}
          </button>
        </div>
      </div>

      <div className="builder-grid">
        {/* Left: Metadata & Blocks */}
        <div>
          <div className="surface-card">
            <div className="card-header">
              <h2 className="card-title">Identificação & Parâmetros da Sessão</h2>
              <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                {draft.items.length} {draft.items.length === 1 ? 'série' : 'séries'}
              </span>
            </div>
            <div className="card-section">
              <div className="form-grid">
                <div className="field col-6">
                  <label>Título do Treino</label>
                  <input
                    type="text"
                    className="input"
                    value={draft.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="Ex: Limiar Anaeróbico — Série Quebrada 200m"
                  />
                </div>

                <div className="field col-3">
                  <label>Data da Sessão</label>
                  <input
                    type="date"
                    className="input mono-num"
                    value={draft.date}
                    onChange={(e) => updateField('date', e.target.value)}
                  />
                </div>

                <div className="field col-3">
                  <label>Piscina</label>
                  <div className="segmented">
                    <button
                      type="button"
                      className={draft.poolLength === 25 ? 'active' : ''}
                      onClick={() => updateField('poolLength', 25)}
                    >
                      25m
                    </button>
                    <button
                      type="button"
                      className={draft.poolLength === 50 ? 'active' : ''}
                      onClick={() => updateField('poolLength', 50)}
                    >
                      50m
                    </button>
                  </div>
                </div>

                <div className="field col-6">
                  <label>Objetivo Fisiológico</label>
                  <select
                    className="select"
                    value={draft.objective}
                    onChange={(e) => updateField('objective', e.target.value)}
                  >
                    {catalog.objectives.map((obj) => (
                      <option key={obj} value={obj}>
                        {obj}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field col-6">
                  <label>Técnico Responsável</label>
                  <input
                    type="text"
                    className="input"
                    value={draft.coach}
                    onChange={(e) => updateField('coach', e.target.value)}
                    placeholder="Nome do treinador(a)"
                  />
                </div>

                {activeTeam && (
                  <div className="field col-12">
                    <label>Direcionamento do Treino ({activeTeam.name})</label>
                    <div className="segmented" style={{ marginBottom: 8 }}>
                      <button
                        type="button"
                        className={currentScope === 'equipe' ? 'active' : ''}
                        onClick={() => handleScopeChange('equipe')}
                      >
                        Toda a Equipe
                      </button>
                      <button
                        type="button"
                        className={currentScope === 'categoria' ? 'active' : ''}
                        onClick={() => handleScopeChange('categoria')}
                      >
                        Grupo / Categoria
                      </button>
                      <button
                        type="button"
                        className={currentScope === 'atletas' ? 'active' : ''}
                        onClick={() => handleScopeChange('atletas')}
                      >
                        Atletas Específicos
                      </button>
                    </div>

                    {currentScope === 'categoria' && (
                      <select
                        className="select"
                        value={draft.targetCategory ?? activeTeam.categories[0] ?? ''}
                        onChange={(e) => updateField('targetCategory', e.target.value)}
                      >
                        {activeTeam.categories.map((cat) => (
                          <option key={cat} value={cat}>
                            Grupo: {cat}
                          </option>
                        ))}
                      </select>
                    )}

                    {currentScope === 'atletas' && (
                      <div>
                        {athletes.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                            Nenhum atleta cadastrado na equipe ainda.
                          </span>
                        ) : (
                          <div className="chip-row">
                            {athletes.map((ath) => {
                              const selected = Boolean(draft.targetAthleteIds?.includes(ath.id));
                              return (
                                <button
                                  key={ath.id}
                                  type="button"
                                  className={`chip-btn ${selected ? 'selected' : ''}`}
                                  onClick={() => toggleTargetAthlete(ath.id)}
                                >
                                  {ath.name} ({ath.category})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="field col-12">
                  <label>Observações Gerais do Treino</label>
                  <textarea
                    className="textarea"
                    value={draft.generalNotes}
                    onChange={(e) => updateField('generalNotes', e.target.value)}
                    placeholder="Orientações gerais de borda, metas de parcial, frequência de braçada, hidratação..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Three Structured Blocks */}
          <div className="blocks-stack">
            {BLOCKS.map((block) => {
              const blockItems = draft.items.filter((i) => i.block === block.key);
              const isComposingHere = activeComposerBlock === block.key;

              return (
                <section key={block.key} className="block-card">
                  <div className="block-header">
                    <div className="block-title-wrap">
                      <span className={`block-dot ${block.key}`} />
                      <div>
                        <h3 className="block-title">{block.title}</h3>
                        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                          {block.subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="block-header-actions">
                      <span className="block-meters">{formatMeters(stats.byBlock[block.key])}</span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          setEditingItem(null);
                          setActiveComposerBlock(isComposingHere ? null : block.key);
                        }}
                      >
                        <Plus size={14} />
                        Adicionar Série
                      </button>
                    </div>
                  </div>

                  {blockItems.length > 0 ? (
                    <div className="series-list">
                      {blockItems.map((item, idx) => {
                        const zone = catalog.zones.find((z) => z.id === item.zoneId);
                        const subtotal = getItemMeters(item);

                        return (
                          <div key={item.id} className="series-row">
                            <div className="series-cell-reps">
                              <div className="series-reps-dist">
                                {item.reps} × {item.distance}m
                              </div>
                            </div>

                            <div className="series-subtotal series-cell-subtotal">
                              {formatMeters(subtotal)}
                            </div>

                            <div className="series-cell-type">
                              <div className="series-type-main">{item.seriesType}</div>
                              {item.equipment.length > 0 && (
                                <div className="series-equip-list">
                                  {item.equipment.map((eq) => (
                                    <span key={eq} className="equip-tag">
                                      {eq}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="series-cell-interval">
                              <span className="interval-pill">
                                <Clock size={12} />
                                {item.interval}
                              </span>
                            </div>

                            <div className="series-cell-zone">
                              {zone && (
                                <span
                                  className="zone-badge"
                                  style={{
                                    backgroundColor: zone.bgHex,
                                    borderColor: zone.borderHex,
                                    color: zone.textHex,
                                  }}
                                >
                                  {zone.code} · {zone.shortLabel.split(' ')[0]}
                                </span>
                              )}
                            </div>

                            <div className="series-notes series-cell-notes">
                              {item.notes || (
                                <span style={{ color: 'var(--ink-muted)' }}>—</span>
                              )}
                            </div>

                            <div className="series-actions">
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon"
                                title="Subir"
                                disabled={idx === 0}
                                onClick={() => handleMoveItem(item, -1)}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon"
                                title="Descer"
                                disabled={idx === blockItems.length - 1}
                                onClick={() => handleMoveItem(item, 1)}
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon"
                                title="Editar série"
                                onClick={() => {
                                  setEditingItem(item);
                                  setActiveComposerBlock(block.key);
                                }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon"
                                title="Duplicar série"
                                onClick={() => handleDuplicateItem(item)}
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger-ghost btn-icon"
                                title="Remover série"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !isComposingHere && (
                      <div className="empty-block">
                        <span>Nenhuma série adicionada neste bloco ainda.</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            setEditingItem(null);
                            setActiveComposerBlock(block.key);
                          }}
                        >
                          <Plus size={14} /> Montar série
                        </button>
                      </div>
                    )
                  )}

                  {isComposingHere && (
                    <SeriesComposer
                      key={editingItem?.id ?? `new-${block.key}`}
                      block={block.key}
                      catalog={catalog}
                      initialItem={editingItem}
                      onSave={handleSaveItem}
                      onCancel={() => {
                        setEditingItem(null);
                        setActiveComposerBlock(null);
                      }}
                    />
                  )}
                </section>
              );
            })}
          </div>
        </div>

        {/* Right Sticky Telemetry & Actions */}
        <aside className="telemetry-panel">
          <div className="surface-card card-section">
            <div className="metric-hero">
              <div>
                <div className="metric-label">Volume Total</div>
                <div className="metric-big">{formatMeters(stats.totalMeters)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="metric-label">Duração Est.</div>
                <div
                  className="mono-num"
                  style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-secondary)' }}
                >
                  ~{stats.estimatedMinutes} min
                </div>
              </div>
            </div>

            <div className="block-breakdown">
              <div className="breakdown-cell">
                <span>Aquec.</span>
                <strong>{formatMeters(stats.byBlock.aquecimento)}</strong>
              </div>
              <div className="breakdown-cell">
                <span>Principal</span>
                <strong>{formatMeters(stats.byBlock.principal)}</strong>
              </div>
              <div className="breakdown-cell">
                <span>Complem.</span>
                <strong>{formatMeters(stats.byBlock.complementar)}</strong>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="metric-label">Distribuição por Intensidade</div>
              <div className="zone-bar-track">
                {stats.byZone
                  .filter((z) => z.meters > 0)
                  .map((z) => (
                    <div
                      key={z.zone.id}
                      style={{
                        width: `${z.percent}%`,
                        backgroundColor: z.zone.accentHex,
                      }}
                      title={`${z.zone.code}: ${formatMeters(z.meters)} (${z.percent}%)`}
                    />
                  ))}
              </div>

              <div className="zone-legend-list">
                {stats.byZone.map((z) => (
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

          <div className="surface-card card-section">
            <div className="action-stack">
              <button type="button" className="btn btn-primary" onClick={onSaveWorkout}>
                <Save size={15} />
                {isEditingExisting ? 'Salvar Alterações no Treino' : 'Salvar em Meus Treinos'}
              </button>
              <button type="button" className="btn btn-dark" onClick={onPrintWorkout}>
                <Printer size={15} />
                Imprimir Ficha de Borda
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
