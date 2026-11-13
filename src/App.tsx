import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudOff,
  Database,
  LogOut,
  PlusSquare,
  Users,
  Waves,
} from 'lucide-react';
import './App.css';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AthleteAnalytics } from './components/AthleteAnalytics';
import { AuthScreen } from './components/AuthScreen';
import { CatalogManager } from './components/CatalogManager';
import { MyWorkouts } from './components/MyWorkouts';
import { PrintSheet } from './components/PrintSheet';
import { TeamManager } from './components/TeamManager';
import { WorkoutBuilder } from './components/WorkoutBuilder';
import { DEFAULT_CATALOG } from './data/defaultDatabase';
import type {
  ActiveTab,
  Athlete,
  CatalogDatabase,
  CoachProfile,
  Team,
  Workout,
} from './types/swimming';
import {
  clearSession,
  generateId,
  hashPasswordClient,
  loadCatalog,
  loadLocalAthletes,
  loadLocalCoaches,
  loadLocalTeams,
  loadSession,
  loadWorkouts,
  resetCatalog,
  saveCatalog,
  saveLocalAthletes,
  saveLocalCoaches,
  saveLocalTeams,
  saveSession,
  saveWorkouts,
} from './utils/storage';

const workoutsListQuery = makeFunctionReference<
  'query',
  { coachId?: string },
  Workout[]
>('workouts:list');
const workoutUpsertMutation = makeFunctionReference<'mutation', { workout: Workout }, void>(
  'workouts:upsert'
);
const workoutRemoveMutation = makeFunctionReference<'mutation', { id: string }, void>(
  'workouts:remove'
);

type StoredCatalog = Omit<CatalogDatabase, 'zones'>;
const catalogGetQuery = makeFunctionReference<'query', Record<string, never>, StoredCatalog | null>(
  'catalog:get'
);
const catalogSaveMutation = makeFunctionReference<'mutation', StoredCatalog, void>('catalog:save');

const authRegisterMutation = makeFunctionReference<
  'mutation',
  {
    id: string;
    name: string;
    email: string;
    password: string;
    cref: string;
    specialty: string;
    createdAt: string;
  },
  CoachProfile
>('auth:register');

const authLoginMutation = makeFunctionReference<
  'mutation',
  { email: string; password: string },
  CoachProfile
>('auth:login');

const teamsListQuery = makeFunctionReference<'query', { coachId: string }, Team[]>(
  'teams:listByCoach'
);
const teamUpsertMutation = makeFunctionReference<'mutation', { team: Team }, void>('teams:upsert');

const athletesListQuery = makeFunctionReference<'query', { teamId: string }, Athlete[]>(
  'athletes:listByTeam'
);
const athleteUpsertMutation = makeFunctionReference<'mutation', { athlete: Athlete }, void>(
  'athletes:upsert'
);
const athleteRemoveMutation = makeFunctionReference<'mutation', { id: string }, void>(
  'athletes:remove'
);

function createEmptyWorkout(
  catalog: CatalogDatabase,
  coach: CoachProfile,
  activeTeam: Team | null
): Workout {
  const today = new Date().toISOString().slice(0, 10);
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
  syncMode: 'cloud' | 'local';
  isLoadingCloud?: boolean;
  onSelectTeam: (teamId: string) => void;
  onSaveTeam: (team: Team) => void | Promise<void>;
  onSaveAthlete: (athlete: Athlete) => void | Promise<void>;
  onDeleteAthlete: (athleteId: string) => void | Promise<void>;
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
  syncMode,
  isLoadingCloud = false,
  onSelectTeam,
  onSaveTeam,
  onSaveAthlete,
  onDeleteAthlete,
  onUpdateCatalog,
  onResetCatalog,
  onPersistWorkout,
  onDeleteWorkout,
  onLogout,
}: AppShellProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('novo');
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
    showToast(isEditing ? 'Treino atualizado em Meus Treinos.' : 'Treino salvo em Meus Treinos.');
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
    setActiveTab('novo');
  };

  const handleDuplicateWorkout = async (workout: Workout) => {
    const now = new Date().toISOString();
    const copy: Workout = {
      ...workout,
      id: generateId('wk'),
      coachId: coach.id,
      teamId: activeTeam?.id ?? workout.teamId,
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

  return (
    <>
      <div className="app-shell no-print">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <div
                className="brand-mark"
                style={activeTeam ? { background: activeTeam.accentColor } : undefined}
              >
                <Waves size={18} />
              </div>
              <div className="brand-text">
                <span className="brand-name">{activeTeam ? activeTeam.name : 'RAIA // PRO'}</span>
                <span className="brand-sub">{coach.name}</span>
              </div>
            </div>

            <nav className="nav-tabs" aria-label="Navegação Principal">
              <button
                type="button"
                className={`nav-tab ${activeTab === 'novo' ? 'active' : ''}`}
                onClick={() => setActiveTab('novo')}
              >
                <PlusSquare size={15} />
                Novo Treino
              </button>
              <button
                type="button"
                className={`nav-tab ${activeTab === 'treinos' ? 'active' : ''}`}
                onClick={() => setActiveTab('treinos')}
              >
                <ClipboardList size={15} />
                Treinos
                <span className="nav-badge">{isLoadingCloud ? '…' : workouts.length}</span>
              </button>
              <button
                type="button"
                className={`nav-tab ${activeTab === 'painel' ? 'active' : ''}`}
                onClick={() => setActiveTab('painel')}
              >
                <BarChart3 size={15} />
                Painel
              </button>
              <button
                type="button"
                className={`nav-tab ${activeTab === 'atletas' ? 'active' : ''}`}
                onClick={() => setActiveTab('atletas')}
              >
                <Activity size={15} />
                Atletas
              </button>
              <button
                type="button"
                className={`nav-tab ${activeTab === 'equipe' ? 'active' : ''}`}
                onClick={() => setActiveTab('equipe')}
              >
                <Users size={15} />
                Equipe
                <span className="nav-badge">{athletes.length}</span>
              </button>
              <button
                type="button"
                className={`nav-tab ${activeTab === 'base' ? 'active' : ''}`}
                onClick={() => setActiveTab('base')}
              >
                <Database size={15} />
                Base
              </button>
            </nav>

            <div className="topbar-meta">
              <span
                className={`sync-pill ${syncMode}`}
                title={
                  syncMode === 'cloud'
                    ? 'Sincronizado em tempo real via Convex'
                    : 'Armazenamento local (configure VITE_CONVEX_URL para sincronizar)'
                }
              >
                {syncMode === 'cloud' ? <Cloud size={12} /> : <CloudOff size={12} />}
                {syncMode === 'cloud' ? 'Nuvem' : 'Local'}
              </span>
              <span className="pool-pill">
                PISCINA {activeTab === 'novo' ? `${draft.poolLength}M` : '25M / 50M'}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onLogout}
                title="Sair da conta"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="main-container">
          {activeTab === 'novo' && (
            <WorkoutBuilder
              draft={draft}
              isEditingExisting={Boolean(editingId)}
              catalog={catalog}
              activeTeam={activeTeam}
              athletes={athletes}
              onChangeDraft={setDraft}
              onSaveWorkout={handleSaveWorkout}
              onPrintWorkout={() => handlePrint(draft)}
              onResetDraft={handleResetDraft}
            />
          )}

          {activeTab === 'treinos' && (
            <MyWorkouts
              workouts={workouts}
              catalog={catalog}
              athletes={athletes}
              onEdit={handleEditFromList}
              onPrint={handlePrint}
              onDuplicate={handleDuplicateWorkout}
              onDelete={handleDeleteWorkout}
              onCreateNew={() => {
                handleResetDraft();
                setActiveTab('novo');
              }}
            />
          )}

          {activeTab === 'painel' && (
            <AnalyticsDashboard
              workouts={workouts}
              catalog={catalog}
              onEditWorkout={handleEditFromList}
              onCreateNew={() => {
                handleResetDraft();
                setActiveTab('novo');
              }}
            />
          )}

          {activeTab === 'atletas' && (
            <AthleteAnalytics
              activeTeam={activeTeam}
              athletes={athletes}
              workouts={workouts}
              catalog={catalog}
              onEditWorkout={handleEditFromList}
              onGoToTeam={() => setActiveTab('equipe')}
            />
          )}

          {activeTab === 'equipe' && (
            <TeamManager
              coach={coach}
              teams={teams}
              activeTeam={activeTeam}
              athletes={athletes}
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

      <PrintSheet workout={printTarget} catalog={catalog} />

      {toast && (
        <div className="toast no-print" role="status">
          <CheckCircle2 size={16} style={{ color: '#34d399' }} />
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}

function ConvexApp({
  coach,
  onLogout,
}: {
  coach: CoachProfile;
  onLogout: () => void;
}) {
  const cloudWorkouts = useQuery(workoutsListQuery, { coachId: coach.id });
  const cloudCatalog = useQuery(catalogGetQuery, {});
  const cloudTeams = useQuery(teamsListQuery, { coachId: coach.id });

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const activeTeam = useMemo(() => {
    const list = cloudTeams ?? [];
    return list.find((t) => t.id === selectedTeamId) ?? list[0] ?? null;
  }, [cloudTeams, selectedTeamId]);

  const cloudAthletes = useQuery(
    athletesListQuery,
    activeTeam ? { teamId: activeTeam.id } : 'skip'
  );

  const upsertWorkout = useMutation(workoutUpsertMutation);
  const removeWorkout = useMutation(workoutRemoveMutation);
  const saveCloudCatalog = useMutation(catalogSaveMutation);
  const upsertTeam = useMutation(teamUpsertMutation);
  const upsertAthlete = useMutation(athleteUpsertMutation);
  const removeAthlete = useMutation(athleteRemoveMutation);

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
      seriesTypes: next.seriesTypes,
      distances: next.distances,
      intervals: next.intervals,
      equipment: next.equipment,
      objectives: next.objectives,
    });
  };

  const handleResetCatalog = async () => {
    await saveCloudCatalog({
      seriesTypes: DEFAULT_CATALOG.seriesTypes,
      distances: DEFAULT_CATALOG.distances,
      intervals: DEFAULT_CATALOG.intervals,
      equipment: DEFAULT_CATALOG.equipment,
      objectives: DEFAULT_CATALOG.objectives,
    });
  };

  return (
    <AppShell
      coach={coach}
      catalog={catalog}
      workouts={cloudWorkouts ?? []}
      teams={cloudTeams ?? []}
      activeTeam={activeTeam}
      athletes={cloudAthletes ?? []}
      syncMode="cloud"
      isLoadingCloud={cloudWorkouts === undefined}
      onSelectTeam={setSelectedTeamId}
      onSaveTeam={async (team) => {
        await upsertTeam({ team });
        setSelectedTeamId(team.id);
      }}
      onSaveAthlete={async (athlete) => {
        await upsertAthlete({ athlete });
      }}
      onDeleteAthlete={async (id) => {
        await removeAthlete({ id });
      }}
      onUpdateCatalog={handleUpdateCatalog}
      onResetCatalog={handleResetCatalog}
      onPersistWorkout={async (workout) => {
        await upsertWorkout({ workout });
      }}
      onDeleteWorkout={async (id) => {
        await removeWorkout({ id });
      }}
      onLogout={onLogout}
    />
  );
}

function ConvexAuthGate({
  onAuthenticated,
}: {
  onAuthenticated: (coach: CoachProfile) => void;
}) {
  const loginMutation = useMutation(authLoginMutation);
  const registerMutation = useMutation(authRegisterMutation);

  return (
    <AuthScreen
      syncMode="cloud"
      onLogin={async (email, password) => {
        const profile = await loginMutation({ email, password });
        saveSession(profile);
        onAuthenticated(profile);
      }}
      onRegister={async ({ name, email, password, cref, specialty }) => {
        const profile = await registerMutation({
          id: generateId('ch'),
          name,
          email,
          password,
          cref,
          specialty,
          createdAt: new Date().toISOString(),
        });
        saveSession(profile);
        onAuthenticated(profile);
      }}
    />
  );
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
  const [athletes, setAthletes] = useState<Athlete[]>(() => loadLocalAthletes());

  const activeTeam = useMemo(() => {
    return teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null;
  }, [teams, selectedTeamId]);

  const activeAthletes = useMemo(() => {
    if (!activeTeam) return [];
    return athletes.filter((a) => a.teamId === activeTeam.id);
  }, [athletes, activeTeam]);

  return (
    <AppShell
      coach={coach}
      catalog={catalog}
      workouts={workouts.filter((w) => !w.coachId || w.coachId === coach.id)}
      teams={teams}
      activeTeam={activeTeam}
      athletes={activeAthletes}
      syncMode="local"
      onSelectTeam={setSelectedTeamId}
      onSaveTeam={(team) => {
        const all = loadLocalTeams();
        const exists = all.some((t) => t.id === team.id);
        const nextAll = exists ? all.map((t) => (t.id === team.id ? team : t)) : [team, ...all];
        saveLocalTeams(nextAll);
        setTeams(nextAll.filter((t) => t.coachId === coach.id));
        setSelectedTeamId(team.id);
      }}
      onSaveAthlete={(athlete) => {
        const exists = athletes.some((a) => a.id === athlete.id);
        const next = exists
          ? athletes.map((a) => (a.id === athlete.id ? athlete : a))
          : [...athletes, athlete];
        setAthletes(next);
        saveLocalAthletes(next);
      }}
      onDeleteAthlete={(id) => {
        const next = athletes.filter((a) => a.id !== id);
        setAthletes(next);
        saveLocalAthletes(next);
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
  const [session, setSession] = useState<CoachProfile | null>(() => loadSession());

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

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
    <ConvexApp coach={session} onLogout={handleLogout} />
  ) : (
    <LocalApp coach={session} onLogout={handleLogout} />
  );
}

export default App;
