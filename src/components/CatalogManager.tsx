import React, { useState } from 'react';
import { Database, Plus, RotateCcw, X } from 'lucide-react';
import type { CatalogDatabase, SeriesCategory } from '../types/swimming';
import { generateId } from '../utils/storage';

interface CatalogManagerProps {
  catalog: CatalogDatabase;
  onUpdateCatalog: (next: CatalogDatabase) => void;
  onResetCatalog: () => void;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({
  catalog,
  onUpdateCatalog,
  onResetCatalog,
}) => {
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesCategory, setNewSeriesCategory] = useState<SeriesCategory>('Estilo');
  const [newDistance, setNewDistance] = useState('');
  const [newInterval, setNewInterval] = useState('');
  const [newEquipment, setNewEquipment] = useState('');
  const [newObjective, setNewObjective] = useState('');

  const addSeriesType = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSeriesName.trim();
    if (!name) return;
    if (catalog.seriesTypes.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    onUpdateCatalog({
      ...catalog,
      seriesTypes: [
        ...catalog.seriesTypes,
        { id: generateId('st'), name, category: newSeriesCategory },
      ],
    });
    setNewSeriesName('');
  };

  const removeSeriesType = (id: string) => {
    onUpdateCatalog({
      ...catalog,
      seriesTypes: catalog.seriesTypes.filter((s) => s.id !== id),
    });
  };

  const addDistance = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(newDistance, 10);
    if (!val || val < 10 || catalog.distances.includes(val)) return;
    onUpdateCatalog({
      ...catalog,
      distances: [...catalog.distances, val].sort((a, b) => a - b),
    });
    setNewDistance('');
  };

  const removeDistance = (d: number) => {
    onUpdateCatalog({
      ...catalog,
      distances: catalog.distances.filter((x) => x !== d),
    });
  };

  const addInterval = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newInterval.trim();
    if (!val || catalog.intervals.includes(val)) return;
    onUpdateCatalog({
      ...catalog,
      intervals: [...catalog.intervals, val],
    });
    setNewInterval('');
  };

  const removeInterval = (iv: string) => {
    onUpdateCatalog({
      ...catalog,
      intervals: catalog.intervals.filter((x) => x !== iv),
    });
  };

  const addEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newEquipment.trim();
    if (!val || catalog.equipment.includes(val)) return;
    onUpdateCatalog({
      ...catalog,
      equipment: [...catalog.equipment, val],
    });
    setNewEquipment('');
  };

  const removeEquipment = (eq: string) => {
    onUpdateCatalog({
      ...catalog,
      equipment: catalog.equipment.filter((x) => x !== eq),
    });
  };

  const addObjective = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newObjective.trim();
    if (!val || catalog.objectives.includes(val)) return;
    onUpdateCatalog({
      ...catalog,
      objectives: [...catalog.objectives, val],
    });
    setNewObjective('');
  };

  const removeObjective = (obj: string) => {
    onUpdateCatalog({
      ...catalog,
      objectives: catalog.objectives.filter((x) => x !== obj),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-eyebrow">Base Própria · Dados Mestres</span>
          <h1 className="page-title">Base Técnica de Treinos</h1>
          <p className="page-subtitle">
            Personalize os tipos de séries, metragens, intervalos e equipamentos disponíveis no
            montador de treinos.
          </p>
        </div>

        <button type="button" className="btn" onClick={onResetCatalog}>
          <RotateCcw size={14} /> Restaurar Padrão de Fábrica
        </button>
      </div>

      <div className="catalog-grid">
        {/* Tipos de Série */}
        <div className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <Database size={15} /> Tipos de Série & Estilos
            </h2>
            <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              {catalog.seriesTypes.length} itens
            </span>
          </div>
          <div className="card-section">
            <form
              onSubmit={addSeriesType}
              style={{ display: 'flex', gap: 8, marginBottom: 14 }}
            >
              <input
                type="text"
                className="input"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                placeholder="Ex: Medley Invertido"
              />
              <select
                className="select"
                style={{ width: 150 }}
                value={newSeriesCategory}
                onChange={(e) => setNewSeriesCategory(e.target.value as SeriesCategory)}
              >
                <option value="Estilo">Estilo</option>
                <option value="Técnica">Técnica</option>
                <option value="Força/Equip.">Força/Equip.</option>
                <option value="Velocidade/Prova">Velocidade/Prova</option>
              </select>
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Add
              </button>
            </form>

            <div className="tag-cloud">
              {catalog.seriesTypes.map((st) => (
                <span key={st.id} className="db-chip">
                  <span>{st.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 500 }}>
                    {st.category}
                  </span>
                  <button
                    type="button"
                    title="Remover"
                    onClick={() => removeSeriesType(st.id)}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Metragens */}
        <div className="surface-card">
          <div className="card-header">
            <h2 className="card-title">Metragens Padrão (m)</h2>
            <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              {catalog.distances.length} itens
            </span>
          </div>
          <div className="card-section">
            <form onSubmit={addDistance} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="number"
                min={10}
                step={5}
                className="input mono-num"
                value={newDistance}
                onChange={(e) => setNewDistance(e.target.value)}
                placeholder="Ex: 600"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Add
              </button>
            </form>

            <div className="tag-cloud">
              {catalog.distances.map((d) => (
                <span key={d} className="db-chip mono-num">
                  {d}m
                  <button type="button" title="Remover" onClick={() => removeDistance(d)}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Intervalos */}
        <div className="surface-card">
          <div className="card-header">
            <h2 className="card-title">Intervalos & Saídas</h2>
            <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              {catalog.intervals.length} itens
            </span>
          </div>
          <div className="card-section">
            <form onSubmit={addInterval} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                className="input mono-num"
                value={newInterval}
                onChange={(e) => setNewInterval(e.target.value)}
                placeholder="Ex: @ 1:35 ou 25&quot; desc."
              />
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Add
              </button>
            </form>

            <div className="tag-cloud">
              {catalog.intervals.map((iv) => (
                <span key={iv} className="db-chip mono-num">
                  {iv}
                  <button type="button" title="Remover" onClick={() => removeInterval(iv)}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Equipamentos & Objetivos */}
        <div className="surface-card">
          <div className="card-header">
            <h2 className="card-title">Equipamentos & Objetivos</h2>
          </div>
          <div className="card-section" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="metric-label" style={{ marginBottom: 8 }}>
                Equipamentos
              </div>
              <form onSubmit={addEquipment} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  className="input"
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  placeholder="Ex: Monofin / Caneleira"
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  <Plus size={14} /> Add
                </button>
              </form>
              <div className="tag-cloud">
                {catalog.equipment.map((eq) => (
                  <span key={eq} className="db-chip">
                    {eq}
                    <button type="button" title="Remover" onClick={() => removeEquipment(eq)}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 14 }}>
              <div className="metric-label" style={{ marginBottom: 8 }}>
                Objetivos de Treino
              </div>
              <form onSubmit={addObjective} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  className="input"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Ex: Tolerância ao Lactato"
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  <Plus size={14} /> Add
                </button>
              </form>
              <div className="tag-cloud">
                {catalog.objectives.map((obj) => (
                  <span key={obj} className="db-chip">
                    {obj}
                    <button type="button" title="Remover" onClick={() => removeObjective(obj)}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zonas Fisiológicas (Reference) */}
      <div className="surface-card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 className="card-title">Escala de Intensidade Fisiológica (Z1 – VEL)</h2>
        </div>
        <div className="card-section">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {catalog.zones.map((z) => (
              <div
                key={z.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${z.borderHex}`,
                  background: z.bgHex,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <strong className="mono-num" style={{ color: z.textHex }}>
                    {z.code} · {z.name}
                  </strong>
                </div>
                <div className="mono-num" style={{ fontSize: 11, color: z.textHex, opacity: 0.85 }}>
                  FC Alvo: {z.hrRange}
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--ink-secondary)' }}>
                  {z.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
