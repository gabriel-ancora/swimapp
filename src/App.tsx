import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  Activity,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardList,
  Library,
  LogOut,
  Menu,
  SquarePen,
  Users,
  type LucideIcon,
} from 'lucide-react';
import './App.css';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AthleteAnalytics } from './components/AthleteAnalytics';
import { AuthScreen } from './components/AuthScreen';
import { Logo, LogoMark } from './components/Logo';
import { CatalogManager } from './components/CatalogManager';
import { MyWorkouts } from './components/MyWorkouts';
import { PlanningManager } from './components/PlanningManager';
import { PrintSheet } from './components/PrintSheet';
import { TeamManager } from './components/TeamManager';
import { WorkoutBuilder } from './components/WorkoutBuilder';
import { DEFAULT_CATALOG } from './data/defaultDatabase';
import { todayLocalISO } from './domain/date';
import { buildLegacyTimeMigration } from './domain/migration';
import type {
  ActiveTab,
  Athlete,
  CatalogDatabase,
  CoachProfile,
  CssTest,
  PeriodizationPhase,
  QualifyingStandard,
  RpeLog,
  SwimResult,
  Team,
  TrainingPlan,
  WellnessEntry,
  Workout,
} from './types/swimming';
import {
  type AuthSession,
  clearSession,
  generateId,
  hashPasswordClient,
  loadCatalog,
  loadLocalAthletes,
  loadLocalCoaches,
  loadLocalCssTests,
  loadLocalPlans,
  loadLocalResults,
  loadLocalRpeLogs,
  loadLocalStandards,
  loadLocalTeams,
  loadLocalWellness,
  loadSession,
  loadWorkouts,
  resetCatalog,
  saveCatalog,
  saveLocalAthletes,
  saveLocalCoaches,
  saveLocalCssTests,
  saveLocalPlans,
  saveLocalResults,
  saveLocalRpeLogs,
  saveLocalStandards,
  saveLocalTeams,
  saveLocalWellness,
  saveSession,
  saveWorkouts,
} from './utils/storage';

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ tab: ActiveTab; label: string; Icon: LucideIcon }>;
}> = [
  {
    label: 'Treinos',
    items: [
      { tab: 'novo', label: 'Novo treino', Icon: SquarePen },
      { tab: 'treinos', label: 'Biblioteca', Icon: ClipboardList },
      { tab: 'planejamento', label: 'Planejamento', Icon: CalendarRange },
    ],
  },
  {
    label: 'Análise',
    items: [
      { tab: 'painel', label: 'Painel', Icon: BarChart3 },
      { tab: 'atletas', label: 'Atletas', Icon: Activity },
    ],
  },
  {
    label: 'Configuração',
    items: [
      { tab: 'equipe', label: 'Equipe', Icon: Users },
      { tab: 'base', label: 'Base técnica', Icon: Library },
    ],
  },
];

const TAB_TITLES: Record<ActiveTab, string> = {
  novo: 'Novo treino',
  treinos: 'Biblioteca',
  planejamento: 'Planejamento',
  painel: 'Painel',
  atletas: 'Atletas',
  equipe: 'Equipe',
  base: 'Base técnica',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function createEmptyWorkout(
  catalog: CatalogDatabase,
  coach: CoachProfile,
  activeTeam: Team | null
): Workout {
  const today = todayLocalISO();
  const now = new Date().toISOString();
  return {
    id: generateId('wk'),
    coachId: coach.id,
    teamId: activeTeam?.id,
    targetScope: 'equipe',
    title: '',
    date: today,
    poolLength: 25,
    objective: catalog.objectives[0] ?? 'Base Aeróbica (A1/A2)',
    coach: coach.name,
    generalNotes: '',
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

interface AppShellProps {
  coach: CoachProfile;
  catalog: CatalogDatabase;
  workouts: Workout[];
  teams: Team[];
  activeTeam: Team | null;
  athletes: Athlete[];
  plans: TrainingPlan[];
  results: SwimResult[];
  standards: QualifyingStandard[];
  cssTests: CssTest[];
  rpeLogs: RpeLog[];
  wellnessEntries: WellnessEntry[];
  syncMode: 'cloud' | 'local';
  isLoadingCloud?: boolean;
  onSelectTeam: (teamId: string) => void;
  onSaveTeam: (team: Team) => void | Promise<void>;
  onSaveAthlete: (athlete: Athlete) => void | Promise<void>;
  onDeleteAthlete: (athleteId: string) => void | Promise<void>;
  onSavePlan: (plan: TrainingPlan) => void | Promise<void>;
  onDeletePlan: (planId: string) => void | Promise<void>;
  onSaveResult: (result: SwimResult) => void | Promise<void>;
  onDeleteResult: (id: string) => void | Promise<void>;
  onSaveStandard: (standard: QualifyingStandard) => void | Promise<void>;
  onDeleteStandard: (id: string) => void | Promise<void>;
  onSaveCssTest: (test: CssTest) => void | Promise<void>;
  onDeleteCssTest: (id: string) => void | Promise<void>;
  onSaveRpeLog: (log: RpeLog) => void | Promise<void>;
  onDeleteRpeLog: (id: string) => void | Promise<void>;
  onSaveWellness: (entry: WellnessEntry) => void | Promise<void>;
  onDeleteWellness: (id: string) => void | Promise<void>;
  onUpdateCatalog: (next: CatalogDatabase) => void | Promise<void>;
  onResetCatalog: () => void | Promise<void>;
  onPersistWorkout: (workout: Workout, isEditing: boolean) => void | Promise<void>;
  onDeleteWorkout: (id: string) => void | Promise<void>;
  onLogout: () => void;
}

function AppShell({
  coach,
  catalog,
  workouts,
  teams,
  activeTeam,
  athletes,
  plans,
  results,
  standards,
  cssTests,
  rpeLogs,
  wellnessEntries,
  syncMode,
  isLoadingCloud = false,
  onSelectTeam,
  onSaveTeam,
  onSaveAthlete,
  onDeleteAthlete,
  onSavePlan,
  onDeletePlan,
  onSaveResult,
  onDeleteResult,
  onSaveStandard,
  onDeleteStandard,
  onSaveCssTest,
  onDeleteCssTest,
  onSaveRpeLog,
  onDeleteRpeLog,
  onSaveWellness,
  onDeleteWellness,
  onUpdateCatalog,
  onResetCatalog,
  onPersistWorkout,
  onDeleteWorkout,
  onLogout,
}: AppShellProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('novo');
  const [navOpen, setNavOpen] = useState(false);

  const goTo = (tab: ActiveTab) => {
    setActiveTab(tab);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };

  const navCounts: Partial<Record<ActiveTab, number | string>> = {
    treinos: isLoadingCloud ? '…' : workouts.length,
    planejamento: plans.length,
    equipe: athletes.length,
  };
  const [draft, setDraft] = useState<Workout>(() =>
    createEmptyWorkout(catalog, coach, activeTeam)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<Workout | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const handleUpdateCatalog = async (next: CatalogDatabase) => {
    await onUpdateCatalog(next);
    showToast('Base técnica atualizada.');
  };

  const handleResetCatalog = async () => {
    await onResetCatalog();
    showToast('Base técnica restaurada para o padrão.');
  };

  const handleSaveWorkout = async () => {
    if (draft.items.length === 0) {
      showToast('Adicione pelo menos uma série antes de salvar.');
      return;
    }

    const now = new Date().toISOString();
    const isEditing = Boolean(editingId);
    const finalWorkout: Workout = {
      ...draft,
      coachId: draft.coachId ?? coach.id,
      teamId: draft.teamId ?? activeTeam?.id,
      targetScope: draft.targetScope ?? 'equipe',
      title: draft.title.trim() || `Treino ${draft.objective}`,
      updatedAt: now,
    };

    await onPersistWorkout(finalWorkout, isEditing);
    if (!isEditing) {
      setEditingId(finalWorkout.id);
    }
    setDraft(finalWorkout);
    showToast(isEditing ? 'Alterações salvas.' : 'Treino salvo na biblioteca.');
  };

  const handlePrint = (workoutToPrint: Workout) => {
    setPrintTarget(workoutToPrint);
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 60);
    });
  };

  const handleResetDraft = () => {
    setEditingId(null);
    setDraft(createEmptyWorkout(catalog, coach, activeTeam));
  };

  const handleEditFromList = (workout: Workout) => {
    setEditingId(workout.id);
    setDraft({
      ...workout,
      items: workout.items.map((item) => ({ ...item, equipment: [...item.equipment] })),
    });
    goTo('novo');
  };

  const handleDuplicateWorkout = async (workout: Workout) => {
    const now = new Date().toISOString();
    const copy: Workout = {
      ...workout,
      id: generateId('wk'),
      coachId: coach.id,
      teamId: activeTeam?.id ?? workout.teamId,
      completed: false,
      title: `${workout.title} (Cópia)`,
      createdAt: now,
      updatedAt: now,
      items: workout.items.map((item) => ({
        ...item,
        id: generateId('it'),
        equipment: [...item.equipment],
      })),
    };
    await onPersistWorkout(copy, false);
    showToast('Treino duplicado com sucesso.');
  };

  const handleDeleteWorkout = async (id: string) => {
    await onDeleteWorkout(id);
    if (editingId === id) {
      handleResetDraft();
    }
    showToast('Treino excluído.');
  };

  const handleToggleWorkoutCompleted = async (workout: Workout) => {
    const nextCompleted = !workout.completed;
    const updated: Workout = {
      ...workout,
      completed: nextCompleted,
      updatedAt: new Date().toISOString(),
    };
    await onPersistWorkout(updated, true);
    if (editingId === workout.id) {
      setDraft(updated);
    }
    showToast(
      nextCompleted
        ? 'Treino marcado como concluído e contabilizado nos painéis.'
        : 'Treino marcado como pendente.'
    );
  };

  const handleToggleAthleteAbsence = async (workout: Workout, athleteId: string) => {
    const current = workout.absentAthleteIds ?? [];
    const isAbsent = current.includes(athleteId);
    const nextAbsent = isAbsent
      ? current.filter((id) => id !== athleteId)
      : [...current, athleteId];
    const updated: Workout = {
      ...workout,
      absentAthleteIds: nextAbsent,
      updatedAt: new Date().toISOString(),
    };
    await onPersistWorkout(updated, true);
    if (editingId === workout.id) {
      setDraft(updated);
    }
    showToast(isAbsent ? 'Presença restaurada para o atleta.' : 'Falta registrada para o atleta.');
  };

  const handleCreateWorkoutFromPlan = (plan: TrainingPlan, phase?: PeriodizationPhase) => {
    const base = createEmptyWorkout(catalog, coach, activeTeam);
    setEditingId(null);
    setDraft({
      ...base,
      teamId: plan.teamId ?? base.teamId,
      planId: plan.id,
      phaseId: phase?.id,
      periodizationPhase: phase?.name ?? plan.phases[0]?.name,
      targetCompetition: plan.competitionName || plan.title,
      targetEvent: plan.targetEvent,
      targetTime: plan.targetTime,
      targetScope: plan.targetScope,
      targetCategory: plan.targetScope === 'categoria' ? plan.targetCategory : undefined,
      targetAthleteIds:
        plan.targetScope === 'atletas'
          ? plan.targetAthleteIds ?? (plan.targetAthleteId ? [plan.targetAthleteId] : undefined)
          : undefined,
      title: phase ? `${plan.title} — ${phase.name}` : plan.title,
      generalNotes: phase?.focus ? `Foco da fase: ${phase.focus}` : '',
    });
    goTo('novo');
  };

  return (
    <>
      <div className="app-shell no-print">
        <aside className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="Navegação principal">
          <div className="sidebar-head">
            <Logo />
            {activeTeam && (
              <div className="team-switcher" title={teams.length > 1 ? 'Trocar de equipe' : undefined}>
                <span className="team-switcher-dot" style={{ background: activeTeam.accentColor }}>
                  {activeTeam.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="team-switcher-text">
                  <span className="team-switcher-name">{activeTeam.name}</span>
                  {activeTeam.club && <span className="team-switcher-club">{activeTeam.club}</span>}
                </span>
                {teams.length > 1 && (
                  <>
                    <ChevronsUpDown size={14} className="team-switcher-chevron" />
                    <select
                      aria-label="Equipe ativa"
                      value={activeTeam.id}
                      onChange={(e) => onSelectTeam(e.target.value)}
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
          </div>

          <nav className="sidebar-nav">
            {NAV_GROUPS.map((group) => (
              <div className="nav-group" key={group.label}>
                <span className="nav-group-label">{group.label}</span>
                {group.items.map(({ tab, label, Icon }) => {
                  const count = navCounts[tab];
                  return (
                    <button
                      key={tab}
                      type="button"
                      data-nav
                      className={`nav-item ${activeTab === tab ? 'active' : ''}`}
                      aria-current={activeTab === tab ? 'page' : undefined}
                      onClick={() => goTo(tab)}
                    >
                      <Icon size={16} strokeWidth={1.9} />
                      {label}
                      {count !== undefined && <span className="nav-count">{count}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-foot">
            <span
              className="sync-note"
              title={
                syncMode === 'cloud'
                  ? 'Dados sincronizados em tempo real'
                  : 'Dados salvos apenas neste navegador'
              }
            >
              <span className={`sync-dot ${syncMode}`} />
              {syncMode === 'cloud' ? 'Sincronizado' : 'Modo local'}
            </span>
            <div className="user-row">
              <span className="avatar" aria-hidden="true">
                {initials(coach.name)}
              </span>
              <span className="user-text">
                <span className="user-name">{coach.name}</span>
                <span className="user-email">{coach.email}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={onLogout}
                title="Sair"
                aria-label="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        <div
          className={`sidebar-backdrop ${navOpen ? 'open' : ''}`}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />

        <div className="content-area">
          <header className="mobile-topbar">
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setNavOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
            <span className="mobile-topbar-title">{TAB_TITLES[activeTab]}</span>
            <LogoMark size={26} />
          </header>

        <main className="main-container">
          {activeTab === 'novo' && (
            <WorkoutBuilder
              draft={draft}
              isEditingExisting={Boolean(editingId)}
              catalog={catalog}
              activeTeam={activeTeam}
              athletes={athletes}
              cssTests={cssTests}
              plans={plans}
              onChangeDraft={setDraft}
              onSaveWorkout={handleSaveWorkout}
              onPrintWorkout={() => handlePrint(draft)}
              onResetDraft={handleResetDraft}
              onGoToPlanning={() => goTo('planejamento')}
              onQuickAddAthlete={async (ath) => {
                await onSaveAthlete(ath);
                showToast('Atleta adicionado à equipe.');
              }}
            />
          )}

          {activeTab === 'planejamento' && (
            <PlanningManager
              coach={coach}
              activeTeam={activeTeam}
              athletes={athletes}
              plans={plans}
              workouts={workouts}
              catalog={catalog}
              onSavePlan={async (plan) => {
                await onSavePlan(plan);
                showToast('Planejamento salvo com sucesso.');
              }}
              onDeletePlan={async (planId) => {
                await onDeletePlan(planId);
                showToast('Planejamento removido.');
              }}
              onCreateWorkoutFromPlan={handleCreateWorkoutFromPlan}
              onQuickAddAthlete={async (ath) => {
                await onSaveAthlete(ath);
                showToast('Atleta adicionado à equipe.');
              }}
            />
          )}

          {activeTab === 'treinos' && (
            <MyWorkouts
              workouts={workouts}
              catalog={catalog}
              athletes={athletes}
              cssTests={cssTests}
              onEdit={handleEditFromList}
              onPrint={handlePrint}
              onDuplicate={handleDuplicateWorkout}
              onDelete={handleDeleteWorkout}
              onToggleCompleted={handleToggleWorkoutCompleted}
              onToggleAthleteAbsence={handleToggleAthleteAbsence}
              onCreateNew={() => {
                handleResetDraft();
                goTo('novo');
              }}
            />
          )}

          {activeTab === 'painel' && (
            <AnalyticsDashboard
              workouts={workouts.filter((w) => Boolean(w.completed))}
              catalog={catalog}
              athletes={athletes}
              cssTests={cssTests}
              onEditWorkout={handleEditFromList}
              onCreateNew={() => {
                handleResetDraft();
                goTo('novo');
              }}
            />
          )}

          {activeTab === 'atletas' && (
            <AthleteAnalytics
              activeTeam={activeTeam}
              coachId={coach.id}
              athletes={athletes}
              workouts={workouts.filter((w) => Boolean(w.completed))}
              plans={plans}
              catalog={catalog}
              results={results}
              standards={standards}
              cssTests={cssTests}
              rpeLogs={rpeLogs}
              wellnessEntries={wellnessEntries}
              onSaveResult={async (res) => {
                await onSaveResult(res);
                showToast('Resultado registrado.');
              }}
              onDeleteResult={async (id) => {
                await onDeleteResult(id);
                showToast('Resultado removido.');
              }}
              onSaveStandard={async (std) => {
                await onSaveStandard(std);
                showToast('Índice salvo.');
              }}
              onDeleteStandard={async (id) => {
                await onDeleteStandard(id);
                showToast('Índice removido.');
              }}
              onSaveCssTest={async (t) => {
                await onSaveCssTest(t);
                showToast('Teste de CSS registrado.');
              }}
              onDeleteCssTest={async (id) => {
                await onDeleteCssTest(id);
                showToast('Teste de CSS removido.');
              }}
              onSaveRpeLog={async (l) => {
                await onSaveRpeLog(l);
                showToast('RPE registrado.');
              }}
              onDeleteRpeLog={async (id) => {
                await onDeleteRpeLog(id);
                showToast('Registro de RPE removido.');
              }}
              onSaveWellness={async (w) => {
                await onSaveWellness(w);
                showToast('Wellness diário registrado.');
              }}
              onDeleteWellness={async (id) => {
                await onDeleteWellness(id);
                showToast('Registro de wellness removido.');
              }}
              onSaveAthlete={onSaveAthlete}
              onEditWorkout={handleEditFromList}
              onToggleAthleteAbsence={handleToggleAthleteAbsence}
              onGoToTeam={() => goTo('equipe')}
            />
          )}

          {activeTab === 'equipe' && (
            <TeamManager
              coach={coach}
              teams={teams}
              activeTeam={activeTeam}
              athletes={athletes}
              results={results}
              onSelectTeam={onSelectTeam}
              onSaveTeam={async (team) => {
                await onSaveTeam(team);
                showToast('Equipe salva com sucesso.');
              }}
              onSaveAthlete={async (ath) => {
                await onSaveAthlete(ath);
                showToast('Atleta salvo na equipe.');
              }}
              onDeleteAthlete={async (athId) => {
                await onDeleteAthlete(athId);
                showToast('Atleta removido.');
              }}
            />
          )}

          {activeTab === 'base' && (
            <CatalogManager
              catalog={catalog}
              onUpdateCatalog={handleUpdateCatalog}
              onResetCatalog={handleResetCatalog}
            />
          )}
        </main>
        </div>
      </div>

      <PrintSheet
        workout={printTarget}
        catalog={catalog}
        athletes={athletes}
        cssTests={cssTests}
      />

      {toast && (
        <div className="toast no-print" role="status">
          <CheckCircle2 size={16} style={{ color: '#7fd1a6' }} />
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}

function ConvexApp({
  coach,
  sessionToken,
  onLogout,
}: {
  coach: CoachProfile;
  sessionToken: string;
  onLogout: () => void;
}) {
  const auth = { sessionToken };
  const me = useQuery(api.auth.me, auth);
  const cloudWorkouts = useQuery(api.workouts.list, auth);
  const cloudCatalog = useQuery(api.catalog.get, auth);
  const cloudTeams = useQuery(api.teams.list, auth);
  const cloudPlans = useQuery(api.plans.list, auth);
  const cloudStandards = useQuery(api.qualifyingStandards.list, auth);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const activeTeam = useMemo(() => {
    const list = cloudTeams ?? [];
    return list.find((t) => t.id === selectedTeamId) ?? list[0] ?? null;
  }, [cloudTeams, selectedTeamId]);

  const teamArg = activeTeam ? { sessionToken, teamId: activeTeam.id } : 'skip';
  const cloudAthletes = useQuery(api.athletes.listByTeam, teamArg);
  const cloudResults = useQuery(api.results.listByTeam, teamArg);
  const cloudCssTests = useQuery(api.cssTests.listByTeam, teamArg);
  const cloudRpeLogs = useQuery(api.rpeLogs.listByTeam, teamArg);
  const cloudWellness = useQuery(api.wellness.listByTeam, teamArg);

  const upsertWorkout = useMutation(api.workouts.upsert);
  const removeWorkout = useMutation(api.workouts.remove);
  const saveCloudCatalog = useMutation(api.catalog.save);
  const upsertTeam = useMutation(api.teams.upsert);
  const upsertAthlete = useMutation(api.athletes.upsert);
  const removeAthlete = useMutation(api.athletes.remove);
  const upsertPlan = useMutation(api.plans.upsert);
  const removePlan = useMutation(api.plans.remove);
  const upsertResult = useMutation(api.results.upsert);
  const removeResult = useMutation(api.results.remove);
  const upsertStandard = useMutation(api.qualifyingStandards.upsert);
  const removeStandard = useMutation(api.qualifyingStandards.remove);
  const upsertCssTest = useMutation(api.cssTests.upsert);
  const removeCssTest = useMutation(api.cssTests.remove);
  const upsertRpeLog = useMutation(api.rpeLogs.upsert);
  const removeRpeLog = useMutation(api.rpeLogs.remove);
  const upsertWellness = useMutation(api.wellness.upsert);
  const removeWellness = useMutation(api.wellness.remove);
  const logoutMutation = useMutation(api.auth.logout);

  // Server says the session is gone (expired, revoked or forged): back to login.
  useEffect(() => {
    if (me === null) onLogout();
  }, [me, onLogout]);

  // Idempotent migration: convert legacy athlete bestTime/targetTime strings into centisecond results/goals.
  const migratedTeamsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeTeam || !cloudAthletes || !cloudResults) return;
    if (migratedTeamsRef.current.has(activeTeam.id)) return;
    migratedTeamsRef.current.add(activeTeam.id);

    const plan = buildLegacyTimeMigration(cloudAthletes, cloudResults, me?.id ?? coach.id);
    if (plan.resultsToCreate.length === 0 && plan.athletesToUpdate.length === 0) return;

    void (async () => {
      for (const res of plan.resultsToCreate) {
        await upsertResult({ sessionToken, result: res });
      }
      for (const ath of plan.athletesToUpdate) {
        await upsertAthlete({ sessionToken, athlete: ath });
      }
    })();
  }, [activeTeam, cloudAthletes, cloudResults, me?.id, coach.id, sessionToken, upsertResult, upsertAthlete]);

  const catalog = useMemo<CatalogDatabase>(() => {
    if (!cloudCatalog) return DEFAULT_CATALOG;
    return {
      seriesTypes: cloudCatalog.seriesTypes.length
        ? cloudCatalog.seriesTypes
        : DEFAULT_CATALOG.seriesTypes,
      distances: cloudCatalog.distances.length
        ? cloudCatalog.distances
        : DEFAULT_CATALOG.distances,
      intervals: cloudCatalog.intervals.length
        ? cloudCatalog.intervals
        : DEFAULT_CATALOG.intervals,
      equipment: cloudCatalog.equipment.length
        ? cloudCatalog.equipment
        : DEFAULT_CATALOG.equipment,
      objectives: cloudCatalog.objectives.length
        ? cloudCatalog.objectives
        : DEFAULT_CATALOG.objectives,
      zones: DEFAULT_CATALOG.zones,
    };
  }, [cloudCatalog]);

  const handleUpdateCatalog = async (next: CatalogDatabase) => {
    await saveCloudCatalog({
      sessionToken,
      seriesTypes: next.seriesTypes,
      distances: next.distances,
      intervals: next.intervals,
      equipment: next.equipment,
      objectives: next.objectives,
    });
  };

  const handleResetCatalog = async () => {
    await saveCloudCatalog({
      sessionToken,
      seriesTypes: DEFAULT_CATALOG.seriesTypes,
      distances: DEFAULT_CATALOG.distances,
      intervals: DEFAULT_CATALOG.intervals,
      equipment: DEFAULT_CATALOG.equipment,
      objectives: DEFAULT_CATALOG.objectives,
    });
  };

  return (
    <AppShell
      coach={me ?? coach}
      catalog={catalog}
      workouts={cloudWorkouts ?? []}
      teams={cloudTeams ?? []}
      activeTeam={activeTeam}
      athletes={cloudAthletes ?? []}
      plans={cloudPlans ?? []}
      results={cloudResults ?? []}
      standards={cloudStandards ?? []}
      cssTests={cloudCssTests ?? []}
      rpeLogs={cloudRpeLogs ?? []}
      wellnessEntries={cloudWellness ?? []}
      syncMode="cloud"
      isLoadingCloud={cloudWorkouts === undefined}
      onSelectTeam={setSelectedTeamId}
      onSaveTeam={async (team) => {
        await upsertTeam({ sessionToken, team });
        setSelectedTeamId(team.id);
      }}
      onSaveAthlete={async (athlete) => {
        await upsertAthlete({ sessionToken, athlete });
      }}
      onDeleteAthlete={async (id) => {
        await removeAthlete({ sessionToken, id });
      }}
      onSavePlan={async (plan) => {
        await upsertPlan({ sessionToken, plan });
      }}
      onDeletePlan={async (id) => {
        await removePlan({ sessionToken, id });
      }}
      onSaveResult={async (result) => {
        await upsertResult({ sessionToken, result });
      }}
      onDeleteResult={async (id) => {
        await removeResult({ sessionToken, id });
      }}
      onSaveStandard={async (standard) => {
        await upsertStandard({ sessionToken, standard });
      }}
      onDeleteStandard={async (id) => {
        await removeStandard({ sessionToken, id });
      }}
      onSaveCssTest={async (test) => {
        await upsertCssTest({ sessionToken, test });
      }}
      onDeleteCssTest={async (id) => {
        await removeCssTest({ sessionToken, id });
      }}
      onSaveRpeLog={async (rpeLog) => {
        await upsertRpeLog({ sessionToken, rpeLog });
      }}
      onDeleteRpeLog={async (id) => {
        await removeRpeLog({ sessionToken, id });
      }}
      onSaveWellness={async (entry) => {
        await upsertWellness({ sessionToken, entry });
      }}
      onDeleteWellness={async (id) => {
        await removeWellness({ sessionToken, id });
      }}
      onUpdateCatalog={handleUpdateCatalog}
      onResetCatalog={handleResetCatalog}
      onPersistWorkout={async (workout) => {
        await upsertWorkout({ sessionToken, workout });
      }}
      onDeleteWorkout={async (id) => {
        await removeWorkout({ sessionToken, id });
      }}
      onLogout={() => {
        // Revoke server-side; leave the UI immediately even if the network call fails.
        void logoutMutation({ sessionToken }).catch(() => undefined);
        onLogout();
      }}
    />
  );
}

function ConvexAuthGate({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSession) => void;
}) {
  const loginAction = useAction(api.passwords.login);
  const registerAction = useAction(api.passwords.register);

  const startSession = ({ profile, sessionToken }: { profile: CoachProfile; sessionToken: string }) => {
    const session: AuthSession = { ...profile, sessionToken };
    saveSession(session);
    onAuthenticated(session);
  };

  return (
    <AuthScreen
      syncMode="cloud"
      onLogin={async (email, password) => {
        startSession(await loginAction({ email, password }));
      }}
      onRegister={async ({ name, email, password, cref, specialty }) => {
        startSession(await registerAction({ name, email, password, cref, specialty }));
      }}
    />
  );
}

function upsertLocalItem<T extends { id: string }>(list: T[], item: T): T[] {
  const exists = list.some((x) => x.id === item.id);
  return exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
}

function LocalApp({
  coach,
  onLogout,
}: {
  coach: CoachProfile;
  onLogout: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogDatabase>(() => loadCatalog());
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts());
  const [teams, setTeams] = useState<Team[]>(() =>
    loadLocalTeams().filter((t) => t.coachId === coach.id)
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const initialMigration = useMemo(() => {
    const rawAthletes = loadLocalAthletes();
    const rawResults = loadLocalResults();
    const plan = buildLegacyTimeMigration(rawAthletes, rawResults, coach.id);
    if (plan.resultsToCreate.length === 0 && plan.athletesToUpdate.length === 0) {
      return { athletes: rawAthletes, results: rawResults };
    }
    const nextResults = [...plan.resultsToCreate, ...rawResults];
    const updatedMap = new Map(plan.athletesToUpdate.map((a) => [a.id, a]));
    const nextAthletes = rawAthletes.map((a) => updatedMap.get(a.id) ?? a);
    saveLocalResults(nextResults);
    saveLocalAthletes(nextAthletes);
    return { athletes: nextAthletes, results: nextResults };
  }, [coach.id]);

  const [athletes, setAthletes] = useState<Athlete[]>(() => initialMigration.athletes);
  const [plans, setPlans] = useState<TrainingPlan[]>(() =>
    loadLocalPlans().filter((p) => p.coachId === coach.id)
  );
  const [results, setResults] = useState<SwimResult[]>(() => initialMigration.results);
  const [standards, setStandards] = useState<QualifyingStandard[]>(() =>
    loadLocalStandards().filter((s) => s.coachId === coach.id)
  );
  const [cssTests, setCssTests] = useState<CssTest[]>(() => loadLocalCssTests());
  const [rpeLogs, setRpeLogs] = useState<RpeLog[]>(() => loadLocalRpeLogs());
  const [wellnessEntries, setWellnessEntries] = useState<WellnessEntry[]>(() =>
    loadLocalWellness()
  );

  const activeTeam = useMemo(() => {
    return teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null;
  }, [teams, selectedTeamId]);

  const activeAthletes = useMemo(() => {
    if (!activeTeam) return [];
    return athletes.filter((a) => a.teamId === activeTeam.id);
  }, [athletes, activeTeam]);

  const activeResults = useMemo(
    () => (activeTeam ? results.filter((r) => r.teamId === activeTeam.id) : []),
    [results, activeTeam]
  );
  const activeCssTests = useMemo(
    () => (activeTeam ? cssTests.filter((c) => c.teamId === activeTeam.id) : []),
    [cssTests, activeTeam]
  );
  const activeRpeLogs = useMemo(
    () => (activeTeam ? rpeLogs.filter((l) => l.teamId === activeTeam.id) : []),
    [rpeLogs, activeTeam]
  );
  const activeWellness = useMemo(
    () => (activeTeam ? wellnessEntries.filter((w) => w.teamId === activeTeam.id) : []),
    [wellnessEntries, activeTeam]
  );

  return (
    <AppShell
      coach={coach}
      catalog={catalog}
      workouts={workouts.filter((w) => !w.coachId || w.coachId === coach.id)}
      teams={teams}
      activeTeam={activeTeam}
      athletes={activeAthletes}
      plans={plans}
      results={activeResults}
      standards={standards}
      cssTests={activeCssTests}
      rpeLogs={activeRpeLogs}
      wellnessEntries={activeWellness}
      syncMode="local"
      onSelectTeam={setSelectedTeamId}
      onSaveTeam={(team) => {
        const all = loadLocalTeams();
        const nextAll = upsertLocalItem(all, team);
        saveLocalTeams(nextAll);
        setTeams(nextAll.filter((t) => t.coachId === coach.id));
        setSelectedTeamId(team.id);
      }}
      onSaveAthlete={(athlete) => {
        const next = upsertLocalItem(athletes, athlete);
        setAthletes(next);
        saveLocalAthletes(next);
      }}
      onDeleteAthlete={(id) => {
        const next = athletes.filter((a) => a.id !== id);
        setAthletes(next);
        saveLocalAthletes(next);

        const nextResults = results.filter((r) => r.athleteId !== id);
        setResults(nextResults);
        saveLocalResults(nextResults);

        const nextCss = cssTests.filter((c) => c.athleteId !== id);
        setCssTests(nextCss);
        saveLocalCssTests(nextCss);

        const nextRpe = rpeLogs.filter((l) => l.athleteId !== id);
        setRpeLogs(nextRpe);
        saveLocalRpeLogs(nextRpe);

        const nextWell = wellnessEntries.filter((w) => w.athleteId !== id);
        setWellnessEntries(nextWell);
        saveLocalWellness(nextWell);
      }}
      onSavePlan={(plan) => {
        const all = loadLocalPlans();
        const nextAll = upsertLocalItem(all, plan);
        saveLocalPlans(nextAll);
        setPlans(nextAll.filter((p) => p.coachId === coach.id));
      }}
      onDeletePlan={(id) => {
        const all = loadLocalPlans();
        const nextAll = all.filter((p) => p.id !== id);
        saveLocalPlans(nextAll);
        setPlans(nextAll.filter((p) => p.coachId === coach.id));
      }}
      onSaveResult={(result) => {
        const next = upsertLocalItem(results, result);
        setResults(next);
        saveLocalResults(next);
      }}
      onDeleteResult={(id) => {
        const next = results.filter((r) => r.id !== id);
        setResults(next);
        saveLocalResults(next);
      }}
      onSaveStandard={(standard) => {
        const all = loadLocalStandards();
        const nextAll = upsertLocalItem(all, standard);
        saveLocalStandards(nextAll);
        setStandards(nextAll.filter((s) => s.coachId === coach.id));
      }}
      onDeleteStandard={(id) => {
        const all = loadLocalStandards();
        const nextAll = all.filter((s) => s.id !== id);
        saveLocalStandards(nextAll);
        setStandards(nextAll.filter((s) => s.coachId === coach.id));
      }}
      onSaveCssTest={(test) => {
        const next = upsertLocalItem(cssTests, test);
        setCssTests(next);
        saveLocalCssTests(next);
      }}
      onDeleteCssTest={(id) => {
        const next = cssTests.filter((t) => t.id !== id);
        setCssTests(next);
        saveLocalCssTests(next);
      }}
      onSaveRpeLog={(log) => {
        const next = upsertLocalItem(rpeLogs, log);
        setRpeLogs(next);
        saveLocalRpeLogs(next);
      }}
      onDeleteRpeLog={(id) => {
        const next = rpeLogs.filter((l) => l.id !== id);
        setRpeLogs(next);
        saveLocalRpeLogs(next);
      }}
      onSaveWellness={(entry) => {
        const next = upsertLocalItem(wellnessEntries, entry);
        setWellnessEntries(next);
        saveLocalWellness(next);
      }}
      onDeleteWellness={(id) => {
        const next = wellnessEntries.filter((w) => w.id !== id);
        setWellnessEntries(next);
        saveLocalWellness(next);
      }}
      onUpdateCatalog={(next) => {
        setCatalog(next);
        saveCatalog(next);
      }}
      onResetCatalog={() => {
        const restored = resetCatalog();
        setCatalog(restored);
      }}
      onPersistWorkout={(workout, isEditing) => {
        const updatedList = isEditing
          ? workouts.map((w) => (w.id === workout.id ? workout : w))
          : [workout, ...workouts];
        setWorkouts(updatedList);
        saveWorkouts(updatedList);
      }}
      onDeleteWorkout={(id) => {
        const next = workouts.filter((w) => w.id !== id);
        setWorkouts(next);
        saveWorkouts(next);
      }}
      onLogout={onLogout}
    />
  );
}

export function App() {
  const hasConvex = Boolean(import.meta.env.VITE_CONVEX_URL);
  const [session, setSession] = useState<AuthSession | null>(() => {
    const stored = loadSession();
    // Cloud sessions saved before server-side sessions existed have no token: force a new login.
    if (stored && hasConvex && !stored.sessionToken) {
      clearSession();
      return null;
    }
    return stored;
  });

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  if (!session) {
    if (hasConvex) {
      return <ConvexAuthGate onAuthenticated={setSession} />;
    }

    return (
      <AuthScreen
        syncMode="local"
        onLogin={async (email, password) => {
          const coaches = loadLocalCoaches();
          const hash = await hashPasswordClient(password);
          const found = coaches.find(
            (c) => c.email.toLowerCase() === email.toLowerCase() && c.passwordHash === hash
          );
          if (!found) {
            throw new Error('E-mail ou senha inválidos.');
          }
          const profile: CoachProfile = {
            id: found.id,
            name: found.name,
            email: found.email,
            cref: found.cref,
            specialty: found.specialty,
            createdAt: found.createdAt,
          };
          saveSession(profile);
          setSession(profile);
        }}
        onRegister={async ({ name, email, password, cref, specialty }) => {
          const coaches = loadLocalCoaches();
          if (coaches.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
            throw new Error('Já existe um treinador cadastrado com este e-mail.');
          }
          const passwordHash = await hashPasswordClient(password);
          const profile: CoachProfile = {
            id: generateId('ch'),
            name,
            email: email.toLowerCase(),
            cref,
            specialty,
            createdAt: new Date().toISOString(),
          };
          saveLocalCoaches([...coaches, { ...profile, passwordHash }]);
          saveSession(profile);
          setSession(profile);
        }}
      />
    );
  }

  return hasConvex ? (
    <ConvexApp coach={session} sessionToken={session.sessionToken ?? ''} onLogout={handleLogout} />
  ) : (
    <LocalApp coach={session} onLogout={handleLogout} />
  );
}

export default App;
