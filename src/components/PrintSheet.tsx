import React from 'react';
import type { BlockType, CatalogDatabase, Workout } from '../types/swimming';
import { computeWorkoutStats, formatDateBR, formatMeters, getItemMeters } from '../utils/storage';

interface PrintSheetProps {
  workout: Workout | null;
  catalog: CatalogDatabase;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  aquecimento: '01 · Aquecimento',
  principal: '02 · Série Principal',
  complementar: '03 · Complementar & Soltura',
};

export const PrintSheet: React.FC<PrintSheetProps> = ({ workout, catalog }) => {
  if (!workout) return null;

  const stats = computeWorkoutStats(workout.items, catalog.zones);
  const blocks: BlockType[] = ['aquecimento', 'principal', 'complementar'];

  return (
    <div className="print-only print-sheet">
      <div className="print-header">
        <div>
          <div className="print-brand">RAIA // PRO · Ficha Técnica de Treino</div>
          <h1 className="print-title">{workout.title || 'Treino Sem Título'}</h1>
          <div className="print-meta-row">
            <span>
              <strong>Data:</strong> {formatDateBR(workout.date)}
            </span>
            <span>
              <strong>Piscina:</strong> {workout.poolLength}m
            </span>
            <span>
              <strong>Objetivo:</strong> {workout.objective}
            </span>
            {workout.periodizationPhase && (
              <span>
                <strong>Periodização:</strong> {workout.periodizationPhase}
              </span>
            )}
            {workout.targetCompetition && (
              <span>
                <strong>Alvo:</strong> {workout.targetCompetition}
              </span>
            )}
            {workout.targetEvent && (
              <span>
                <strong>Prova Alvo:</strong> {workout.targetEvent}
                {workout.targetTime ? ` (${workout.targetTime})` : ''}
              </span>
            )}
            {workout.coach && (
              <span>
                <strong>Técnico:</strong> {workout.coach}
              </span>
            )}
          </div>
        </div>
        <div className="print-total-box">
          <span className="print-brand">Volume Total</span>
          <strong>{formatMeters(stats.totalMeters)}</strong>
          <span style={{ fontSize: 11, color: '#475569' }}>
            ~{stats.estimatedMinutes} min estimados
          </span>
        </div>
      </div>

      {blocks.map((block) => {
        const blockItems = workout.items.filter((i) => i.block === block);
        if (blockItems.length === 0) return null;

        return (
          <div className="print-block" key={block}>
            <div className="print-block-title">
              <span>{BLOCK_LABELS[block]}</span>
              <span className="mono-num">{formatMeters(stats.byBlock[block])}</span>
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Série</th>
                  <th style={{ width: 70 }}>Subtotal</th>
                  <th style={{ width: 170 }}>Estilo / Tipo</th>
                  <th style={{ width: 95 }}>Intervalo</th>
                  <th style={{ width: 90 }}>Zona</th>
                  <th>Observações & Equipamentos</th>
                </tr>
              </thead>
              <tbody>
                {blockItems.map((item) => {
                  const zone = catalog.zones.find((z) => z.id === item.zoneId);
                  return (
                    <tr key={item.id}>
                      <td className="mono-num" style={{ fontWeight: 700 }}>
                        {item.reps} × {item.distance}m
                      </td>
                      <td className="mono-num">{formatMeters(getItemMeters(item))}</td>
                      <td style={{ fontWeight: 600 }}>{item.seriesType}</td>
                      <td className="mono-num">{item.interval}</td>
                      <td className="mono-num" style={{ fontWeight: 700 }}>
                        {zone ? `${zone.code} · ${zone.shortLabel}` : item.zoneId}
                      </td>
                      <td>
                        {item.equipment.length > 0 && (
                          <span style={{ fontWeight: 600 }}>
                            [{item.equipment.join(', ')}]{' '}
                          </span>
                        )}
                        {item.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {workout.generalNotes && (
        <div className="print-notes-box">
          <strong>Observações Gerais do Treino:</strong>
          <div style={{ marginTop: 4 }}>{workout.generalNotes}</div>
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          paddingTop: 10,
          borderTop: '1px solid #cbd5e1',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#475569',
        }}
      >
        <div>
          <strong>Distribuição de Zonas: </strong>
          {stats.byZone
            .filter((z) => z.meters > 0)
            .map((z) => `${z.zone.code}: ${formatMeters(z.meters)} (${z.percent}%)`)
            .join(' · ')}
        </div>
        <div className="mono-num">RAIA // PRO</div>
      </div>
    </div>
  );
};
