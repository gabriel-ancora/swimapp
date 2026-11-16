import React from 'react';
import type { Athlete, BlockType, CatalogDatabase, CssTest, Workout, ZoneId } from '../types/swimming';
import {
  getAllZonePaces,
  getLatestCssForAthlete,
  getSeriesTargetTimeCs,
  resolveWorkoutCssPace100Cs,
} from '../domain/pace';
import { formatSwimTime } from '../domain/time';
import {
  computeWorkoutStats,
  formatDateBR,
  formatMeters,
  getItemMeters,
  isWorkoutAssignedToAthlete,
} from '../utils/storage';

interface PrintSheetProps {
  workout: Workout | null;
  catalog: CatalogDatabase;
  athletes?: Athlete[];
  cssTests?: CssTest[];
}

const BLOCK_LABELS: Record<BlockType, string> = {
  aquecimento: '01 · Aquecimento',
  principal: '02 · Série principal',
  complementar: '03 · Complementar & soltura',
};

const ZONE_IDS: ZoneId[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'VEL'];

function formatCompactTarget(cs: number): string {
  return formatSwimTime(cs);
}

export const PrintSheet: React.FC<PrintSheetProps> = ({
  workout,
  catalog,
  athletes = [],
  cssTests = [],
}) => {
  if (!workout) return null;

  const effectiveCss = resolveWorkoutCssPace100Cs(workout, athletes, cssTests);
  const stats = computeWorkoutStats(workout.items, catalog.zones, effectiveCss);
  const blocks: BlockType[] = ['aquecimento', 'principal', 'complementar'];

  const targetedAthletes = athletes.filter((a) => isWorkoutAssignedToAthlete(workout, a));
  const athleteCssList = targetedAthletes
    .map((athlete) => {
      const test = getLatestCssForAthlete(cssTests, athlete.id);
      return test ? { athlete, cssPace100Cs: test.cssPace100Cs } : null;
    })
    .filter((x): x is { athlete: Athlete; cssPace100Cs: number } => x !== null);

  // Group by category (lane group) when there are many athletes
  const laneGroupsMap = new Map<string, { category: string; paces: number[] }>();
  for (const item of athleteCssList) {
    const cat = item.athlete.category || 'Geral';
    const existing = laneGroupsMap.get(cat) ?? { category: cat, paces: [] };
    existing.paces.push(item.cssPace100Cs);
    laneGroupsMap.set(cat, existing);
  }
  const laneGroups = Array.from(laneGroupsMap.values()).map((g) => ({
    category: g.category,
    count: g.paces.length,
    avgCssCs: Math.round(g.paces.reduce((s, p) => s + p, 0) / g.paces.length),
  }));

  const useIndividualTargets = athleteCssList.length > 0 && athleteCssList.length <= 4;

  const renderItemTargets = (zoneId: ZoneId, distance: number) => {
    if (athleteCssList.length === 0) return null;
    if (athleteCssList.length === 1) {
      const t = getSeriesTargetTimeCs(athleteCssList[0].cssPace100Cs, zoneId, distance);
      return <span className="mono-num" style={{ fontWeight: 600 }}>{formatCompactTarget(t)}</span>;
    }
    if (useIndividualTargets) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11 }}>
          {athleteCssList.map(({ athlete, cssPace100Cs }) => {
            const t = getSeriesTargetTimeCs(cssPace100Cs, zoneId, distance);
            const firstName = athlete.name.split(/\s+/)[0];
            return (
              <span key={athlete.id} className="mono-num">
                <strong>{firstName}:</strong> {formatCompactTarget(t)}
              </span>
            );
          })}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11 }}>
        {laneGroups.map((g) => {
          const t = getSeriesTargetTimeCs(g.avgCssCs, zoneId, distance);
          return (
            <span key={g.category} className="mono-num">
              <strong>{g.category}:</strong> {formatCompactTarget(t)}
            </span>
          );
        })}
      </div>
    );
  };

  const paceReferenceRows = useIndividualTargets
    ? athleteCssList.map(({ athlete, cssPace100Cs }) => ({
        key: athlete.id,
        label: `${athlete.name} (${athlete.category})`,
        cssPace100Cs,
        zones: getAllZonePaces(cssPace100Cs),
      }))
    : laneGroups.map((g) => ({
        key: g.category,
        label: `Raia / Grupo ${g.category} (${g.count} ${g.count === 1 ? 'atleta' : 'atletas'})`,
        cssPace100Cs: g.avgCssCs,
        zones: getAllZonePaces(g.avgCssCs),
      }));

  return (
    <div className="print-only print-sheet">
      <div className="print-header">
        <div>
          <div className="print-brand">Raia · Ficha de treino</div>
          <h1 className="print-title">{workout.title || 'Treino sem título'}</h1>
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
                <strong>Prova alvo:</strong> {workout.targetEvent}
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
          <span className="print-brand">Volume total</span>
          <strong>{formatMeters(stats.totalMeters)}</strong>
          <span style={{ fontSize: 12, color: '#475569' }}>
            ~{stats.estimatedMinutes} min estimados
            {effectiveCss ? ' (CSS)' : ''}
          </span>
        </div>
      </div>

      {paceReferenceRows.length > 0 && (
        <div className="print-block" style={{ marginBottom: 14 }}>
          <div className="print-block-title">
            <span>Ritmos-alvo individuais por 100m (CSS)</span>
            <span className="mono-num">Z1 – VEL</span>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th>Atleta / Grupo</th>
                <th style={{ width: 68 }}>CSS</th>
                {ZONE_IDS.map((z) => (
                  <th key={z} style={{ width: 58 }}>
                    {z}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paceReferenceRows.map((row) => (
                <tr key={row.key}>
                  <td style={{ fontWeight: 600 }}>{row.label}</td>
                  <td className="mono-num" style={{ fontWeight: 700 }}>
                    {formatSwimTime(row.cssPace100Cs)}
                  </td>
                  {row.zones.map((zp) => (
                    <td key={zp.zoneId} className="mono-num">
                      {zp.pace100Text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  <th style={{ width: 84 }}>Série</th>
                  <th style={{ width: 66 }}>Subtotal</th>
                  <th style={{ width: 145 }}>Estilo / tipo</th>
                  <th style={{ width: 85 }}>Intervalo</th>
                  <th style={{ width: 82 }}>Zona</th>
                  {athleteCssList.length > 0 && <th style={{ width: 115 }}>Tempo-alvo</th>}
                  <th>Observações & equipamentos</th>
                </tr>
              </thead>
              <tbody>
                {blockItems.map((item) => {
                  const zone = catalog.zones.find((z) => z.id === item.zoneId);
                  return (
                    <tr key={item.id}>
                      <td className="mono-num" style={{ fontWeight: 600 }}>
                        {item.reps} × {item.distance}m
                      </td>
                      <td className="mono-num">{formatMeters(getItemMeters(item))}</td>
                      <td style={{ fontWeight: 600 }}>{item.seriesType}</td>
                      <td className="mono-num">{item.interval}</td>
                      <td className="mono-num" style={{ fontWeight: 600 }}>
                        {zone ? `${zone.code} · ${zone.shortLabel}` : item.zoneId}
                      </td>
                      {athleteCssList.length > 0 && (
                        <td>{renderItemTargets(item.zoneId, item.distance)}</td>
                      )}
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
          <strong>Observações gerais do treino:</strong>
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
          fontSize: 12,
          color: '#475569',
        }}
      >
        <div>
          <strong>Distribuição de zonas: </strong>
          {stats.byZone
            .filter((z) => z.meters > 0)
            .map((z) => `${z.zone.code}: ${formatMeters(z.meters)} (${z.percent}%)`)
            .join(' · ')}
        </div>
        <div className="mono-num">Raia</div>
      </div>
    </div>
  );
};
