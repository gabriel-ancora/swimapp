import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Copy,
  Download,
  Edit3,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  Waves,
} from 'lucide-react';
import type { CatalogDatabase, Workout } from '../types/swimming';
import { computeWorkoutStats, formatDateBR, formatMeters } from '../utils/storage';

interface MyWorkoutsProps {
  workouts: Workout[];
  catalog: CatalogDatabase;
  onEdit: (workout: Workout) => void;
  onPrint: (workout: Workout) => void;
  onDuplicate: (workout: Workout) => void;
  onDelete: (id: string) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onCreateNew: () => void;
}

export const MyWorkouts: React.FC<MyWorkoutsProps> = ({
  workouts,
  catalog,
  onEdit,
  onPrint,
  onDuplicate,
  onDelete,
  onExportBackup,
  onImportBackup,
  onCreateNew,
}) => {
  const [search, setSearch] = useState('');
  const [poolFilter, setPoolFilter] = useState<'all' | 25 | 50>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredWorkouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workouts.filter((wk) => {
      if (poolFilter !== 'all' && wk.poolLength !== poolFilter) return false;
      if (!q) return true;
      return (
        wk.title.toLowerCase().includes(q) ||
        wk.objective.toLowerCase().includes(q) ||
        wk.coach.toLowerCase().includes(q) ||
        wk.items.some((i) => i.seriesType.toLowerCase().includes(q))
      );
    });
  }, [workouts, search, poolFilter]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-eyebrow">Biblioteca de Sessões</span>
          <h1 className="page-title">Meus Treinos</h1>
          <p className="page-subtitle">
            Consulte, modifique, duplique ou imprima suas fichas técnicas de natação.
          </p>
        </div>

        <div className="page-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportBackup(file);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => fileInputRef.current?.click()}
            title="Importar backup (.json)"
          >
            <Upload size={15} />
            Importar
          </button>
          <button
            type="button"
            className="btn"
            onClick={onExportBackup}
            title="Exportar treinos e base técnica (.json)"
          >
            <Download size={15} />
            Exportar
          </button>
          <button type="button" className="btn btn-primary" onClick={onCreateNew}>
            <Plus size={15} />
            Novo Treino
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={15} />
          <input
            type="text"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, objetivo, técnico ou estilo..."
          />
        </div>

        <div className="segmented pool-filter-segmented">
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

      {filteredWorkouts.length === 0 ? (
        <div
          className="surface-card card-section"
          style={{ textAlign: 'center', padding: '48px 24px' }}
        >
          <Waves size={28} style={{ color: 'var(--ink-muted)', marginBottom: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            Nenhum treino encontrado
          </div>
          <p style={{ margin: '0 0 16px 0', color: 'var(--ink-secondary)', fontSize: 13 }}>
            {workouts.length === 0
              ? 'Você ainda não salvou nenhum treino. Crie o primeiro agora.'
              : 'Ajuste os filtros de busca para localizar o treino desejado.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={onCreateNew}>
            <Plus size={15} /> Criar Novo Treino
          </button>
        </div>
      ) : (
        <div className="workouts-grid">
          {filteredWorkouts.map((wk) => {
            const stats = computeWorkoutStats(wk.items, catalog.zones);
            const isConfirming = confirmDeleteId === wk.id;

            return (
              <article key={wk.id} className="workout-card">
                <div className="workout-card-top">
                  <div>
                    <h3 className="workout-card-title">{wk.title || 'Treino Sem Título'}</h3>
                    <div className="workout-card-meta" style={{ marginTop: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} /> {formatDateBR(wk.date)}
                      </span>
                      <span>·</span>
                      <span className="mono-num" style={{ fontWeight: 600 }}>
                        Piscina {wk.poolLength}m
                      </span>
                      <span>·</span>
                      <span>{wk.objective}</span>
                    </div>
                  </div>
                </div>

                <div className="workout-card-stats">
                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--ink-muted)',
                      }}
                    >
                      Volume Total
                    </span>
                    <strong className="mono-num" style={{ fontSize: 18 }}>
                      {formatMeters(stats.totalMeters)}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--ink-muted)',
                      }}
                    >
                      Séries
                    </span>
                    <strong className="mono-num" style={{ fontSize: 14 }}>
                      {wk.items.length}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--ink-muted)',
                      }}
                    >
                      Duração Est.
                    </span>
                    <strong className="mono-num" style={{ fontSize: 14 }}>
                      ~{stats.estimatedMinutes} min
                    </strong>
                  </div>
                </div>

                {/* Zone Distribution Mini Bar */}
                <div>
                  <div className="zone-bar-track" style={{ margin: '0 0 6px 0', height: 6 }}>
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
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--ink-muted)',
                    }}
                  >
                    <span>
                      Aquec: <strong className="mono-num">{formatMeters(stats.byBlock.aquecimento)}</strong>
                    </span>
                    <span>
                      Princ: <strong className="mono-num">{formatMeters(stats.byBlock.principal)}</strong>
                    </span>
                    <span>
                      Comp: <strong className="mono-num">{formatMeters(stats.byBlock.complementar)}</strong>
                    </span>
                  </div>
                </div>

                <div className="workout-card-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => onEdit(wk)}
                  >
                    <Edit3 size={13} /> Modificar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onPrint(wk)}
                  >
                    <Printer size={13} /> Imprimir
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    title="Duplicar treino"
                    onClick={() => onDuplicate(wk)}
                  >
                    <Copy size={14} />
                  </button>
                  {isConfirming ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: 'var(--danger)',
                        borderColor: 'var(--danger)',
                        color: '#fff',
                      }}
                      onClick={() => {
                        onDelete(wk.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      Confirmar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-icon"
                      title="Excluir treino"
                      onClick={() => setConfirmDeleteId(wk.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
