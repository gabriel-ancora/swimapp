import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Flag,
  Layers,
  Plus,
  PlusSquare,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  User,
  X,
} from 'lucide-react';
import type {
  Athlete,
  CatalogDatabase,
  CoachProfile,
  PeriodizationPhase,
  PeriodizationPhaseType,
  PlanType,
  Team,
  TrainingPlan,
  Workout,
  WorkoutTargetScope,
  ZoneId,
} from '../types/swimming';
import { addDaysISO, todayLocalISO } from '../domain/date';
import { formatSwimTime } from '../domain/time';
import { formatDateBR, generateId } from '../utils/storage';

interface PlanningManagerProps {
  coach: CoachProfile;
  activeTeam: Team | null;
  athletes: Athlete[];
  plans: TrainingPlan[];
  workouts: Workout[];
  catalog: CatalogDatabase;
  onSavePlan: (plan: TrainingPlan) => Promise<void> | void;
  onDeletePlan: (planId: string) => Promise<void> | void;
  onCreateWorkoutFromPlan: (plan: TrainingPlan, phase?: PeriodizationPhase) => void;
  onQuickAddAthlete?: (athlete: Athlete) => Promise<void> | void;
}

const PLAN_TYPE_LABELS: Record<PlanType, { label: string; badgeClass: string }> = {
  competicao_alvo: { label: 'Competição Alvo', badgeClass: 'plan-badge-comp' },
  tempo_alvo: { label: 'Tempo alvo (atleta)', badgeClass: 'plan-badge-time' },
  objetivo_geral: { label: 'Objetivo geral', badgeClass: 'plan-badge-goal' },
};

const PHASE_META: Record<
  PeriodizationPhaseType,
  { label: string; color: string; defaultZones: ZoneId[] }
> = {
  base: { label: 'Base geral', color: '#5B93C4', defaultZones: ['Z1', 'Z2'] },
  especifico: { label: 'Específico', color: '#2F5F9F', defaultZones: ['Z2', 'Z3', 'Z4'] },
  pre_competitivo: {
    label: 'Pré-Competitivo',
    color: '#7A6FB0',
    defaultZones: ['Z4', 'Z5', 'VEL'],
  },
  polimento: { label: 'Polimento', color: '#E2A541', defaultZones: ['Z1', 'VEL'] },
  competicao: { label: 'Competição', color: '#A8322F', defaultZones: ['VEL'] },
  transicao: { label: 'Transição', color: '#9C978F', defaultZones: ['Z1'] },
};

function diffDaysISO(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00`);
  const b = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function createEmptyPhase(startDate: string, endDate: string): PeriodizationPhase {
  return {
    id: generateId('ph'),
    name: 'Nova fase',
    phaseType: 'base',
    startDate,
    endDate,
    focus: '',
    targetZones: ['Z1', 'Z2'],
    intensityLabel: 'Moderada · controle técnico',
    weeklySessions: 5,
    notes: '',
  };
}

function buildSuggestedPhases(startDate: string, endDate: string): PeriodizationPhase[] {
  const totalDays = Math.max(7, diffDaysISO(startDate, endDate));
  const compDays = totalDays >= 21 ? 3 : 1;
  const taperDays = Math.max(3, Math.round(totalDays * 0.12));
  const preDays = Math.max(3, Math.round(totalDays * 0.25));
  const specDays = Math.max(3, Math.round(totalDays * 0.3));
  const baseDays = Math.max(2, totalDays - compDays - taperDays - preDays - specDays);

  const d1 = addDaysISO(startDate, baseDays - 1);
  const d2Start = addDaysISO(d1, 1);
  const d2 = addDaysISO(d2Start, specDays - 1);
  const d3Start = addDaysISO(d2, 1);
  const d3 = addDaysISO(d3Start, preDays - 1);
  const d4Start = addDaysISO(d3, 1);
  const d4 = addDaysISO(d4Start, taperDays - 1);
  const d5Start = addDaysISO(d4, 1);

  return [
    {
      id: generateId('ph'),
      name: '01 · Base aeróbica & técnica',
      phaseType: 'base',
      startDate,
      endDate: d1,
      focus: 'Construção aeróbica (Z1/Z2), eficiência de braçada, saídas e viradas.',
      targetZones: ['Z1', 'Z2'],
      intensityLabel: 'Volume progressivo · baixa/moderada',
      weeklySessions: 5,
      notes: 'Priorizar mecânica de nado e controle respiratório.',
    },
    {
      id: generateId('ph'),
      name: '02 · Desenvolvimento específico',
      phaseType: 'especifico',
      startDate: d2Start,
      endDate: d2,
      focus: 'Limiar anaeróbico (Z3/Z4) e séries específicas da prova alvo.',
      targetZones: ['Z2', 'Z3', 'Z4'],
      intensityLabel: 'Moderada/alta · limiar',
      weeklySessions: 6,
      notes: 'Introduzir séries fracionadas em ritmo controlado.',
    },
    {
      id: generateId('ph'),
      name: '03 · Pré-Competitivo & ritmo',
      phaseType: 'pre_competitivo',
      startDate: d3Start,
      endDate: d3,
      focus: 'Tolerância ao lactato (Z5), ritmo de prova e séries quebradas (Broken).',
      targetZones: ['Z4', 'Z5', 'VEL'],
      intensityLabel: 'Alta intensidade · ritmo de prova',
      weeklySessions: 6,
      notes: 'Monitorar parciais e frequência de braçada em velocidade de prova.',
    },
    {
      id: generateId('ph'),
      name: '04 · Polimento (Taper)',
      phaseType: 'polimento',
      startDate: d4Start,
      endDate: d4,
      focus: 'Redução gradual de volume mantendo estímulos curtos de velocidade máxima.',
      targetZones: ['Z1', 'VEL'],
      intensityLabel: 'Baixo volume · alta qualidade',
      weeklySessions: 4,
      notes: 'Foco em recuperação neuromuscular, descanso e confiança.',
    },
    {
      id: generateId('ph'),
      name: '05 · Competição alvo',
      phaseType: 'competicao',
      startDate: d5Start <= endDate ? d5Start : endDate,
      endDate,
      focus: 'Ativação pré-prova, estratégia de parciais e soltura pós-prova.',
      targetZones: ['Z1', 'VEL'],
      intensityLabel: 'Máxima · dia de prova',
      weeklySessions: 3,
      notes: 'Execução da estratégia planejada.',
    },
  ];
}

export const PlanningManager: React.FC<PlanningManagerProps> = ({
  coach,
  activeTeam,
  athletes,
  plans,
  workouts,
  catalog,
  onSavePlan,
  onDeletePlan,
  onCreateWorkoutFromPlan,
  onQuickAddAthlete,
}) => {
  const [today] = useState(() => todayLocalISO());
  const defaultEnd = addDaysISO(today, 56);

  const [isFormOpen, setIsFormOpen] = useState(plans.length === 0);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | PlanType>('all');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(plans[0]?.id ?? null);

  // Form state
  const [title, setTitle] = useState('');
  const [planType, setPlanType] = useState<PlanType>('competicao_alvo');
  const [targetScope, setTargetScope] = useState<WorkoutTargetScope>('equipe');
  const [targetCategory, setTargetCategory] = useState(activeTeam?.categories[0] ?? '');
  const [targetAthleteIds, setTargetAthleteIds] = useState<string[]>(
    athletes[0]?.id ? [athletes[0].id] : []
  );
  const [showQuickAthlete, setShowQuickAthlete] = useState(false);
  const [quickAthleteName, setQuickAthleteName] = useState('');
  const [quickAthleteCategory, setQuickAthleteCategory] = useState(
    activeTeam?.categories[0] ?? 'Geral'
  );
  const [quickAthleteEvent, setQuickAthleteEvent] = useState('');
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDate, setCompetitionDate] = useState(defaultEnd);
  const [targetEvent, setTargetEvent] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [objective, setObjective] = useState('');
  const [notes, setNotes] = useState('');
  const [phases, setPhases] = useState<PeriodizationPhase[]>(() =>
    buildSuggestedPhases(today, defaultEnd)
  );

  const selectedAthletes = useMemo(
    () => athletes.filter((a) => targetAthleteIds.includes(a.id)),
    [athletes, targetAthleteIds]
  );

  const selectedAthleteEvents = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      event: string;
      bestTime: string;
      targetTime: string;
    }> = [];
    for (const ath of selectedAthletes) {
      const firstName = ath.name.split(' ')[0];
      if (ath.mainEvent) {
        list.push({
          key: `${ath.id}-main`,
          label: `${firstName} · ${ath.mainEvent} (Principal)`,
          event: ath.mainEvent,
          bestTime: ath.bestTime ?? '',
          targetTime:
            ath.targetTime ?? (ath.targetTimeCs ? formatSwimTime(ath.targetTimeCs) : ''),
        });
      }
      for (const ev of ath.events ?? []) {
        list.push({
          key: `${ath.id}-${ev.id}`,
          label: `${firstName} · ${ev.event}`,
          event: ev.event,
          bestTime: ev.bestTime ?? '',
          targetTime: ev.targetTime ?? (ev.targetTimeCs ? formatSwimTime(ev.targetTimeCs) : ''),
        });
      }
    }
    return list;
  }, [selectedAthletes]);

  const toggleTargetAthlete = (athleteId: string) => {
    setTargetAthleteIds((prev) =>
      prev.includes(athleteId) ? prev.filter((id) => id !== athleteId) : [...prev, athleteId]
    );
  };

  const handleQuickAddAthlete = async () => {
    if (!activeTeam || !onQuickAddAthlete || !quickAthleteName.trim()) return;
    const now = new Date().toISOString();
    const newAth: Athlete = {
      id: generateId('ath'),
      teamId: activeTeam.id,
      name: quickAthleteName.trim(),
      category: quickAthleteCategory || activeTeam.categories[0] || 'Geral',
      mainEvent: quickAthleteEvent.trim() || 'Livre',
      bestTime: '',
      status: 'Ativo',
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    await onQuickAddAthlete(newAth);
    setTargetAthleteIds((prev) => [...prev, newAth.id]);
    setQuickAthleteName('');
    setQuickAthleteEvent('');
    setShowQuickAthlete(false);
  };

  const resetForm = () => {
    setEditingPlanId(null);
    setTitle('');
    setPlanType('competicao_alvo');
    setTargetScope('equipe');
    setTargetCategory(activeTeam?.categories[0] ?? '');
    setTargetAthleteIds(athletes[0]?.id ? [athletes[0].id] : []);
    setShowQuickAthlete(false);
    setCompetitionName('');
    setCompetitionDate(defaultEnd);
    setTargetEvent('');
    setTargetTime('');
    setStartDate(today);
    setEndDate(defaultEnd);
    setObjective('');
    setNotes('');
    setPhases(buildSuggestedPhases(today, defaultEnd));
  };

  const openNewForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const startEditPlan = (plan: TrainingPlan) => {
    setEditingPlanId(plan.id);
    setTitle(plan.title);
    setPlanType(plan.planType);
    setTargetScope(plan.targetScope);
    setTargetCategory(plan.targetCategory ?? activeTeam?.categories[0] ?? '');
    setTargetAthleteIds(
      plan.targetAthleteIds ?? (plan.targetAthleteId ? [plan.targetAthleteId] : [])
    );
    setShowQuickAthlete(false);
    setCompetitionName(plan.competitionName ?? '');
    setCompetitionDate(plan.competitionDate ?? plan.endDate);
    setTargetEvent(plan.targetEvent ?? '');
    setTargetTime(plan.targetTime ?? '');
    setStartDate(plan.startDate);
    setEndDate(plan.endDate);
    setObjective(plan.objective);
    setNotes(plan.notes);
    setPhases(plan.phases.map((p) => ({ ...p, targetZones: [...p.targetZones] })));
    setIsFormOpen(true);
  };

  const handleDuplicatePlan = async (plan: TrainingPlan) => {
    const now = new Date().toISOString();
    const copy: TrainingPlan = {
      ...plan,
      id: generateId('pln'),
      title: `${plan.title} (Cópia)`,
      phases: plan.phases.map((p) => ({
        ...p,
        id: generateId('ph'),
        targetZones: [...p.targetZones],
      })),
      createdAt: now,
      updatedAt: now,
    };
    await onSavePlan(copy);
  };

  const handleAddPhase = () => {
    const lastEnd = phases.length > 0 ? phases[phases.length - 1].endDate : startDate;
    const nextStart = phases.length > 0 ? addDaysISO(lastEnd, 1) : startDate;
    const nextEnd = nextStart <= endDate ? endDate : nextStart;
    setPhases([...phases, createEmptyPhase(nextStart, nextEnd)]);
  };

  const handleUpdatePhase = (
    phaseId: string,
    patch: Partial<PeriodizationPhase>
  ) => {
    setPhases(phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p)));
  };

  const togglePhaseZone = (phaseId: string, zoneId: ZoneId) => {
    setPhases(
      phases.map((p) => {
        if (p.id !== phaseId) return p;
        const exists = p.targetZones.includes(zoneId);
        const nextZones = exists
          ? p.targetZones.filter((z) => z !== zoneId)
          : [...p.targetZones, zoneId];
        return { ...p, targetZones: nextZones };
      })
    );
  };

  const handleRemovePhase = (phaseId: string) => {
    setPhases(phases.filter((p) => p.id !== phaseId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const existing = editingPlanId ? plans.find((p) => p.id === editingPlanId) : null;

    const computedTitle =
      title.trim() ||
      (planType === 'competicao_alvo' && competitionName.trim()
        ? competitionName.trim()
        : planType === 'tempo_alvo' && selectedAthletes.length > 0 && targetEvent.trim()
          ? `${selectedAthletes.map((a) => a.name.split(' ')[0]).join(', ')} · ${targetEvent.trim()}`
          : 'Planejamento de ciclo');

    const payload: TrainingPlan = {
      id: existing?.id ?? generateId('pln'),
      coachId: coach.id,
      teamId: activeTeam?.id,
      title: computedTitle,
      planType,
      targetScope,
      targetCategory: targetScope === 'categoria' ? targetCategory : undefined,
      targetAthleteId:
        targetScope === 'atletas' ? targetAthleteIds[0] || undefined : undefined,
      targetAthleteIds:
        targetScope === 'atletas' && targetAthleteIds.length > 0
          ? targetAthleteIds
          : undefined,
      targetEvent: targetEvent.trim() || undefined,
      targetTime: targetTime.trim() || undefined,
      competitionName: competitionName.trim() || undefined,
      competitionDate: competitionDate || undefined,
      startDate,
      endDate,
      objective: objective.trim(),
      notes: notes.trim(),
      phases,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await onSavePlan(payload);
    setExpandedPlanId(payload.id);
    setIsFormOpen(false);
    resetForm();
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (typeFilter !== 'all' && p.planType !== typeFilter) return false;
      return true;
    });
  }, [plans, typeFilter]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Planejamento</h1>
          <p className="page-subtitle">
            Macrociclos com fases, competições e tempos-alvo. Os treinos podem ser ligados a cada fase.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openNewForm}>
            <Plus size={15} />
            Novo planejamento
          </button>
        </div>
      </div>

      {/* Create / Edit Plan Form */}
      {isFormOpen && (
        <section className="surface-card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2 className="card-title">
              <Target size={15} />{' '}
              {editingPlanId ? 'Editar planejamento & periodização' : 'Novo planejamento & periodização'}
            </h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
            >
              <X size={14} /> Fechar
            </button>
          </div>

          <form className="card-section" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field col-12">
                <label>Tipo de planejamento</label>
                <div className="segmented">
                  <button
                    type="button"
                    className={planType === 'competicao_alvo' ? 'active' : ''}
                    onClick={() => setPlanType('competicao_alvo')}
                  >
                    <Trophy size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                    Competição alvo
                  </button>
                  <button
                    type="button"
                    className={planType === 'tempo_alvo' ? 'active' : ''}
                    onClick={() => {
                      setPlanType('tempo_alvo');
                      setTargetScope('atletas');
                    }}
                  >
                    <Target size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                    Tempo alvo (atleta)
                  </button>
                  <button
                    type="button"
                    className={planType === 'objetivo_geral' ? 'active' : ''}
                    onClick={() => setPlanType('objetivo_geral')}
                  >
                    <Flag size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />
                    Objetivo geral / ciclo
                  </button>
                </div>
              </div>

              <div className="field col-6">
                <label>Título do planejamento</label>
                <input
                  type="text"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Campeonato Brasileiro Absoluto 2026"
                  required
                />
              </div>

              <div className="field col-3">
                <label>Início do ciclo</label>
                <input
                  type="date"
                  className="input mono-num"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="field col-3">
                <label>Fim / data alvo</label>
                <input
                  type="date"
                  className="input mono-num"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="field col-12">
                <label>Direcionamento</label>
                <div className="segmented" style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className={targetScope === 'equipe' ? 'active' : ''}
                    onClick={() => setTargetScope('equipe')}
                  >
                    Toda a equipe
                  </button>
                  <button
                    type="button"
                    className={targetScope === 'categoria' ? 'active' : ''}
                    onClick={() => setTargetScope('categoria')}
                  >
                    Categoria / grupo
                  </button>
                  <button
                    type="button"
                    className={targetScope === 'atletas' ? 'active' : ''}
                    onClick={() => setTargetScope('atletas')}
                  >
                    Atletas específicos
                  </button>
                </div>

                {targetScope === 'categoria' && activeTeam && (
                  <select
                    className="select"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                  >
                    {activeTeam.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        Categoria: {cat}
                      </option>
                    ))}
                  </select>
                )}

                {targetScope === 'atletas' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        Selecione um ou mais atletas para este planejamento ({targetAthleteIds.length} selecionado{targetAthleteIds.length === 1 ? '' : 's'}):
                      </span>
                      {activeTeam && onQuickAddAthlete && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', fontSize: 12 }}
                          onClick={() => setShowQuickAthlete((v) => !v)}
                        >
                          <Plus size={12} /> Novo atleta rápido
                        </button>
                      )}
                    </div>

                    {showQuickAthlete && activeTeam && (
                      <div className="quick-athlete-box" style={{ marginBottom: 10 }}>
                        <input
                          type="text"
                          className="input"
                          value={quickAthleteName}
                          onChange={(e) => setQuickAthleteName(e.target.value)}
                          placeholder="Nome do atleta"
                        />
                        <select
                          className="select"
                          value={quickAthleteCategory}
                          onChange={(e) => setQuickAthleteCategory(e.target.value)}
                        >
                          {activeTeam.categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className="input"
                          value={quickAthleteEvent}
                          onChange={(e) => setQuickAthleteEvent(e.target.value)}
                          placeholder="Prova principal (ex: 100m Livre)"
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleQuickAddAthlete}
                        >
                          <Check size={13} /> Adicionar
                        </button>
                      </div>
                    )}

                    {athletes.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        Cadastre atletas em Equipe ou use "Novo atleta rápido" acima.
                      </span>
                    ) : (
                      <>
                        <div className="chip-row">
                          {athletes.map((ath) => {
                            const selected = targetAthleteIds.includes(ath.id);
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

                        {selectedAthleteEvents.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <span
                              style={{
                                display: 'block',
                                fontSize: 12,
                                color: 'var(--ink-muted)',
                                marginBottom: 4,
                              }}
                            >
                              Provas cadastradas dos atletas selecionados (clique para preencher prova e tempo meta):
                            </span>
                            <div className="chip-row">
                              {selectedAthleteEvents.map((ev) => (
                                <button
                                  key={ev.key}
                                  type="button"
                                  className={`chip-btn ${targetEvent === ev.event ? 'selected' : ''}`}
                                  onClick={() => {
                                    setTargetEvent(ev.event);
                                    if (ev.targetTime) setTargetTime(ev.targetTime);
                                  }}
                                >
                                  {ev.label}
                                  {ev.bestTime ? ` · Atual: ${ev.bestTime}` : ''}
                                  {ev.targetTime ? ` → Meta: ${ev.targetTime}` : ''}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {planType === 'competicao_alvo' && (
                <>
                  <div className="field col-6">
                    <label>Nome da competição alvo</label>
                    <input
                      type="text"
                      className="input"
                      value={competitionName}
                      onChange={(e) => setCompetitionName(e.target.value)}
                      placeholder="Ex: Troféu Brasil / Campeonato Paulista"
                    />
                  </div>
                  <div className="field col-6">
                    <label>Data da competição</label>
                    <input
                      type="date"
                      className="input mono-num"
                      value={competitionDate}
                      onChange={(e) => setCompetitionDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="field col-4">
                <label>Prova alvo (opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={targetEvent}
                  onChange={(e) => setTargetEvent(e.target.value)}
                  placeholder="Ex: 100m Livre"
                />
              </div>

              <div className="field col-4">
                <label>Tempo alvo / meta (opcional)</label>
                <input
                  type="text"
                  className="input mono-num"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  placeholder="Ex: 50.50s"
                />
              </div>

              <div className="field col-4">
                <label>Objetivo principal do ciclo</label>
                <input
                  type="text"
                  className="input"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ex: Classificação para final A / Sub-51s"
                />
              </div>

              <div className="field col-12">
                <label>Estratégia & observações do planejamento</label>
                <textarea
                  className="textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Estratégia de parciais, metas técnicas, controle de carga, testes intermediários..."
                />
              </div>
            </div>

            {/* Periodization Phases Builder */}
            <div className="periodization-builder">
              <div className="periodization-builder-head">
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    <Layers size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                    Periodização ({phases.length} fases)
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    Divida o ciclo em mesociclos/fases com datas, foco, zonas alvo e sessões por semana.
                  </span>
                </div>
                <div className="composer-actions" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setPhases(buildSuggestedPhases(startDate, endDate))}
                  >
                    <Sparkles size={13} /> Gerar periodização sugerida
                  </button>
                  <button type="button" className="btn btn-sm" onClick={handleAddPhase}>
                    <Plus size={13} /> Adicionar fase
                  </button>
                </div>
              </div>

              {phases.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-muted)', padding: '12px 0' }}>
                  Nenhuma fase adicionada ainda. Clique em "Gerar periodização sugerida" ou
                  "Adicionar fase".
                </div>
              ) : (
                <div className="phases-editor-list">
                  {phases.map((phase) => (
                    <div key={phase.id} className="phase-editor-card">
                      <div className="phase-editor-top">
                        <span
                          className="phase-color-dot"
                          style={{ backgroundColor: PHASE_META[phase.phaseType].color }}
                        />
                        <input
                          type="text"
                          className="input"
                          style={{ fontWeight: 600 }}
                          value={phase.name}
                          onChange={(e) => handleUpdatePhase(phase.id, { name: e.target.value })}
                          placeholder="Nome da fase"
                        />
                        <select
                          className="select"
                          style={{ maxWidth: 185 }}
                          value={phase.phaseType}
                          onChange={(e) => {
                            const nextType = e.target.value as PeriodizationPhaseType;
                            handleUpdatePhase(phase.id, {
                              phaseType: nextType,
                              targetZones: PHASE_META[nextType].defaultZones,
                            });
                          }}
                        >
                          {Object.entries(PHASE_META).map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-icon"
                          title="Remover fase"
                          onClick={() => handleRemovePhase(phase.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="form-grid" style={{ marginTop: 10 }}>
                        <div className="field col-3">
                          <label>Início</label>
                          <input
                            type="date"
                            className="input mono-num"
                            value={phase.startDate}
                            onChange={(e) =>
                              handleUpdatePhase(phase.id, { startDate: e.target.value })
                            }
                          />
                        </div>
                        <div className="field col-3">
                          <label>Fim</label>
                          <input
                            type="date"
                            className="input mono-num"
                            value={phase.endDate}
                            onChange={(e) =>
                              handleUpdatePhase(phase.id, { endDate: e.target.value })
                            }
                          />
                        </div>
                        <div className="field col-3">
                          <label>Sessões / semana</label>
                          <input
                            type="number"
                            min={1}
                            max={14}
                            className="input mono-num"
                            value={phase.weeklySessions}
                            onChange={(e) =>
                              handleUpdatePhase(phase.id, {
                                weeklySessions: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                        </div>
                        <div className="field col-3">
                          <label>Intensidade</label>
                          <input
                            type="text"
                            className="input"
                            value={phase.intensityLabel}
                            onChange={(e) =>
                              handleUpdatePhase(phase.id, { intensityLabel: e.target.value })
                            }
                            placeholder="Ex: Alta · Limiar"
                          />
                        </div>

                        <div className="field col-6">
                          <label>Foco técnico & fisiológico</label>
                          <input
                            type="text"
                            className="input"
                            value={phase.focus}
                            onChange={(e) =>
                              handleUpdatePhase(phase.id, { focus: e.target.value })
                            }
                            placeholder="Ex: Base aeróbica e controle de virada"
                          />
                        </div>

                        <div className="field col-6">
                          <label>Zonas alvo da fase</label>
                          <div className="chip-row">
                            {catalog.zones.map((z) => {
                              const selected = phase.targetZones.includes(z.id);
                              return (
                                <button
                                  key={z.id}
                                  type="button"
                                  className={`chip-btn ${selected ? 'selected' : ''}`}
                                  onClick={() => togglePhaseZone(phase.id, z.id)}
                                >
                                  {z.code}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="field col-12">
                          <label>Detalhamento / microciclos / testes</label>
                          <input
                            type="text"
                            className="input"
                            value={phase.notes}
                            onChange={(e) =>
                              handleUpdatePhase(phase.id, { notes: e.target.value })
                            }
                            placeholder="Ex: Semana 1-2 volume crescente, Semana 3 teste de 200m..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="composer-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                <Check size={15} />
                {editingPlanId ? 'Salvar alterações' : 'Salvar planejamento'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter Bar */}
      <div className="filters-bar">
        <div className="segmented">
          <button
            type="button"
            className={typeFilter === 'all' ? 'active' : ''}
            onClick={() => setTypeFilter('all')}
          >
            Todos ({plans.length})
          </button>
          <button
            type="button"
            className={typeFilter === 'competicao_alvo' ? 'active' : ''}
            onClick={() => setTypeFilter('competicao_alvo')}
          >
            Competições alvo
          </button>
          <button
            type="button"
            className={typeFilter === 'tempo_alvo' ? 'active' : ''}
            onClick={() => setTypeFilter('tempo_alvo')}
          >
            Tempos alvo
          </button>
          <button
            type="button"
            className={typeFilter === 'objetivo_geral' ? 'active' : ''}
            onClick={() => setTypeFilter('objetivo_geral')}
          >
            Objetivos gerais
          </button>
        </div>
      </div>

      {/* Plans List */}
      {filteredPlans.length === 0 ? (
        <div
          className="surface-card card-section"
          style={{ textAlign: 'center', padding: '48px 24px' }}
        >
          <Target size={28} style={{ color: 'var(--ink-muted)', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            Nenhum planejamento cadastrado
          </div>
          <p style={{ margin: '0 0 16px 0', color: 'var(--ink-secondary)', fontSize: 13 }}>
            Crie um planejamento com competição alvo, tempo alvo de atleta e fases de periodização.
          </p>
          <button type="button" className="btn btn-primary" onClick={openNewForm}>
            <Plus size={15} /> Criar primeiro planejamento
          </button>
        </div>
      ) : (
        <div className="plans-stack">
          {filteredPlans.map((plan) => {
            const planAthleteIds =
              plan.targetAthleteIds ?? (plan.targetAthleteId ? [plan.targetAthleteId] : []);
            const targetAthletesList = athletes.filter((a) => planAthleteIds.includes(a.id));
            const daysRemaining = diffDaysISO(today, plan.competitionDate || plan.endDate);
            const linkedWorkoutsCount = workouts.filter((w) => w.planId === plan.id).length;
            const isExpanded = expandedPlanId === plan.id;

            const totalPlanDays = Math.max(1, diffDaysISO(plan.startDate, plan.endDate) + 1);

            return (
              <article key={plan.id} className="surface-card plan-card">
                <div className="plan-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={`plan-badge ${PLAN_TYPE_LABELS[plan.planType].badgeClass}`}>
                        {PLAN_TYPE_LABELS[plan.planType].label}
                      </span>
                      {plan.targetScope === 'equipe' && (
                        <span className="db-chip">Toda a equipe</span>
                      )}
                      {plan.targetScope === 'categoria' && plan.targetCategory && (
                        <span className="db-chip">Grupo: {plan.targetCategory}</span>
                      )}
                      {plan.targetScope === 'atletas' &&
                        targetAthletesList.map((ath) => (
                          <span key={ath.id} className="db-chip">
                            <User size={11} /> {ath.name}
                          </span>
                        ))}
                      {plan.targetEvent && (
                        <span className="db-chip">
                          <strong>{plan.targetEvent}</strong>
                          {plan.targetTime ? ` → Meta ${plan.targetTime}` : ''}
                        </span>
                      )}
                    </div>

                    <h3 className="plan-card-title">{plan.title}</h3>

                    <div className="workout-card-meta">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} /> {formatDateBR(plan.startDate)} →{' '}
                        {formatDateBR(plan.endDate)}
                      </span>
                      {plan.competitionName && (
                        <>
                          <span>·</span>
                          <span>
                            <Trophy size={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />
                            {plan.competitionName}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span className="mono-num">
                        {daysRemaining > 0
                          ? `Faltam ${daysRemaining} dias`
                          : daysRemaining === 0
                            ? 'Hoje'
                            : `Encerrado há ${Math.abs(daysRemaining)}d`}
                      </span>
                      <span>·</span>
                      <span className="mono-num">{linkedWorkoutsCount} treinos vinculados</span>
                    </div>
                  </div>

                  <div className="series-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onCreateWorkoutFromPlan(plan)}
                    >
                      <PlusSquare size={13} /> Criar treino
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      title="Editar planejamento"
                      onClick={() => startEditPlan(plan)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      title="Duplicar planejamento"
                      onClick={() => handleDuplicatePlan(plan)}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-icon"
                      title="Excluir planejamento"
                      onClick={() => onDeletePlan(plan.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      title={isExpanded ? 'Recolher fases' : 'Expandir fases'}
                      onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {(plan.objective || plan.notes) && (
                  <div className="plan-summary-strip">
                    {plan.objective && (
                      <div>
                        <strong>Objetivo:</strong> {plan.objective}
                      </div>
                    )}
                    {plan.notes && (
                      <div style={{ color: 'var(--ink-secondary)', marginTop: 2 }}>{plan.notes}</div>
                    )}
                  </div>
                )}

                {/* Proportional Periodization Timeline Bar */}
                {plan.phases.length > 0 && (
                  <div className="plan-timeline-wrap">
                    <div className="plan-timeline-bar">
                      {plan.phases.map((ph) => {
                        const phDays = Math.max(1, diffDaysISO(ph.startDate, ph.endDate) + 1);
                        const pct = Math.max(8, Math.round((phDays / totalPlanDays) * 100));
                        return (
                          <div
                            key={ph.id}
                            className="plan-timeline-seg"
                            style={{
                              flex: `${pct} 1 0%`,
                              backgroundColor: PHASE_META[ph.phaseType].color,
                            }}
                            title={`${ph.name}: ${formatDateBR(ph.startDate)} – ${formatDateBR(ph.endDate)}`}
                          >
                            <span>{ph.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Expanded Phases Detail */}
                {isExpanded && plan.phases.length > 0 && (
                  <div className="plan-phases-detail">
                    {plan.phases.map((ph) => {
                      const phaseWorkouts = workouts.filter(
                        (w) => w.planId === plan.id && w.phaseId === ph.id
                      ).length;

                      return (
                        <div key={ph.id} className="phase-detail-row">
                          <div className="phase-detail-left">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                className="phase-color-dot"
                                style={{ backgroundColor: PHASE_META[ph.phaseType].color }}
                              />
                              <strong style={{ fontSize: 13 }}>{ph.name}</strong>
                              <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                                {formatDateBR(ph.startDate)} → {formatDateBR(ph.endDate)}
                              </span>
                              <span className="db-chip">{ph.weeklySessions}x/sem</span>
                              {ph.targetZones.map((z) => (
                                <span key={z} className="zone-mini-pill">
                                  {z}
                                </span>
                              ))}
                            </div>
                            {ph.focus && (
                              <div style={{ fontSize: 12, color: 'var(--ink-primary)', marginTop: 4 }}>
                                <strong>Foco:</strong> {ph.focus}
                              </div>
                            )}
                            {ph.notes && (
                              <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 2 }}>
                                {ph.notes}
                              </div>
                            )}
                          </div>

                          <div className="phase-detail-right">
                            <span className="mono-num" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                              {phaseWorkouts} {phaseWorkouts === 1 ? 'treino' : 'treinos'}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => onCreateWorkoutFromPlan(plan, ph)}
                            >
                              <Plus size={13} /> Treino nesta fase
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
