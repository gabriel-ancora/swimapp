import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { BlockType, CatalogDatabase, WorkoutItem, ZoneId } from '../types/swimming';
import { generateId } from '../utils/storage';

interface SeriesComposerProps {
  block: BlockType;
  catalog: CatalogDatabase;
  initialItem?: WorkoutItem | null;
  onSave: (item: WorkoutItem) => void;
  onCancel: () => void;
}

export const SeriesComposer: React.FC<SeriesComposerProps> = ({
  block,
  catalog,
  initialItem,
  onSave,
  onCancel,
}) => {
  const [reps, setReps] = useState<number>(initialItem?.reps ?? 4);
  const [distance, setDistance] = useState<number>(
    initialItem?.distance ?? (block === 'aquecimento' ? 200 : block === 'principal' ? 100 : 50)
  );
  const [seriesType, setSeriesType] = useState<string>(
    initialItem?.seriesType ?? catalog.seriesTypes[0]?.name ?? 'Crawl (Livre)'
  );
  const [interval, setInterval] = useState<string>(
    initialItem?.interval ?? (block === 'aquecimento' ? 'Livre / Contínuo' : '@ 1:30')
  );
  const [zoneId, setZoneId] = useState<ZoneId>(
    initialItem?.zoneId ?? (block === 'aquecimento' ? 'Z2' : block === 'principal' ? 'Z4' : 'Z1')
  );
  const [equipment, setEquipment] = useState<string[]>(initialItem?.equipment ?? []);
  const [notes, setNotes] = useState<string>(initialItem?.notes ?? '');

  const toggleEquipment = (eq: string) => {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((item) => item !== eq) : [...prev, eq]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reps < 1 || distance < 10) return;

    onSave({
      id: initialItem?.id ?? generateId('it'),
      block,
      reps: Math.max(1, reps),
      distance: Math.max(10, distance),
      seriesType,
      interval: interval.trim() || 'Livre / Contínuo',
      zoneId,
      equipment,
      notes: notes.trim(),
    });
  };

  const quickDistances = catalog.distances.slice(0, 8);

  return (
    <form className="composer-box" onSubmit={handleSubmit}>
      <div className="composer-title">
        <span>{initialItem ? 'Editar Série' : 'Adicionar Série ao Bloco'}</span>
        <span className="mono-num" style={{ color: 'var(--accent-primary)' }}>
          Subtotal: {(Math.max(1, reps) * Math.max(0, distance)).toLocaleString('pt-BR')} m
        </span>
      </div>

      <div className="form-grid">
        {/* Repetições */}
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label>Repetições</label>
          <input
            type="number"
            min={1}
            max={100}
            className="input mono-num"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value) || 1)}
            required
          />
        </div>

        {/* Metragem */}
        <div className="field" style={{ gridColumn: 'span 3' }}>
          <label>Metragem (m)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              min={10}
              step={5}
              className="input mono-num"
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value) || 0)}
              required
            />
            <select
              className="select mono-num"
              style={{ width: 92 }}
              value={catalog.distances.includes(distance) ? distance : ''}
              onChange={(e) => {
                if (e.target.value) setDistance(Number(e.target.value));
              }}
              aria-label="Selecionar metragem da base"
            >
              <option value="">Base...</option>
              {catalog.distances.map((d) => (
                <option key={d} value={d}>
                  {d}m
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tipo de Série */}
        <div className="field" style={{ gridColumn: 'span 4' }}>
          <label>Estilo / Tipo de Série</label>
          <select
            className="select"
            value={seriesType}
            onChange={(e) => setSeriesType(e.target.value)}
          >
            {catalog.seriesTypes.map((st) => (
              <option key={st.id} value={st.name}>
                {st.name} ({st.category})
              </option>
            ))}
          </select>
        </div>

        {/* Intervalo */}
        <div className="field" style={{ gridColumn: 'span 3' }}>
          <label>Intervalo / Saída</label>
          <input
            type="text"
            className="input mono-num"
            list={`intervals-${block}`}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            placeholder="Ex: @ 1:30 ou 15&quot; desc."
          />
          <datalist id={`intervals-${block}`}>
            {catalog.intervals.map((iv) => (
              <option key={iv} value={iv} />
            ))}
          </datalist>
        </div>

        {/* Quick Distance Chips */}
        <div className="field" style={{ gridColumn: 'span 12' }}>
          <label>Atalhos de Metragem (Base Própria)</label>
          <div className="chip-row">
            {quickDistances.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip-btn mono-num ${distance === d ? 'selected' : ''}`}
                onClick={() => setDistance(d)}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Zona de Intensidade */}
        <div className="field" style={{ gridColumn: 'span 12' }}>
          <label>Intensidade / Zona Fisiológica</label>
          <div className="chip-row">
            {catalog.zones.map((z) => {
              const isSelected = zoneId === z.id;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZoneId(z.id)}
                  className="chip-btn"
                  style={{
                    backgroundColor: isSelected ? z.accentHex : z.bgHex,
                    borderColor: isSelected ? z.accentHex : z.borderHex,
                    color: isSelected ? '#ffffff' : z.textHex,
                  }}
                >
                  <span className="mono-num">{z.code}</span> · {z.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipamentos */}
        <div className="field" style={{ gridColumn: 'span 12' }}>
          <label>Equipamentos (Opcional)</label>
          <div className="chip-row">
            {catalog.equipment.map((eq) => {
              const active = equipment.includes(eq);
              return (
                <button
                  key={eq}
                  type="button"
                  className={`chip-btn ${active ? 'selected' : ''}`}
                  onClick={() => toggleEquipment(eq)}
                >
                  {eq}
                </button>
              );
            })}
          </div>
        </div>

        {/* Observações */}
        <div className="field" style={{ gridColumn: 'span 12' }}>
          <label>Observações Técnicas da Série</label>
          <input
            type="text"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Descer 1s a cada repetição, respiração 3x3, saída forte da parede..."
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--border-hairline)',
        }}
      >
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          <X size={14} /> Cancelar
        </button>
        <button type="submit" className="btn btn-primary btn-sm">
          {initialItem ? <Check size={14} /> : <Plus size={14} />}
          {initialItem ? 'Atualizar Série' : 'Confirmar Série'}
        </button>
      </div>
    </form>
  );
};
