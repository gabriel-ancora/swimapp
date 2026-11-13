import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import {
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudOff,
  Database,
  PlusSquare,
  Waves,
} from 'lucide-react';
import './App.css';
import { CatalogManager } from './components/CatalogManager';
import { MyWorkouts } from './components/MyWorkouts';
import { PrintSheet } from './components/PrintSheet';
import { WorkoutBuilder } from './components/WorkoutBuilder';
import { DEFAULT_CATALOG, SAMPLE_WORKOUTS } from './data/defaultDatabase';
import type { ActiveTab, CatalogDatabase, Workout } from './types/swimming';
import {
  generateId,
  loadCatalog,
  loadWorkouts,
  resetCatalog,
  saveCatalog,
  saveWorkouts,
} from './utils/storage';

const workoutsListQuery = makeFunctionReference<'query', Record<string, never>, Workout[]>(
  'workouts:list'
);
const workoutUpsertMutation = makeFunctionReference<'mutation', { workout: Workout }, void>(
  'workouts:upsert'
);
const workoutRemoveMutation = makeFunctionReference<'mutation', { id: string }, void>(
  'workouts:remove'
);
const workoutsSeedMutation = makeFunctionReference<'mutation', { workouts: Workout[] }, void>(
  'workouts:seedIfEmpty'
);

type StoredCatalog = Omit<CatalogDatabase, 'zones'>;
const catalogGetQuery = makeFunctionReference<'query', Record<string, never>, StoredCatalog | null>(
  'catalog:get'
);
const catalogSaveMutation = makeFunctionReference<'mutation', StoredCatalog, void>('catalog:save');

function createEmptyWorkout(catalog: CatalogDatabase): Workout {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return {
    id: generateId('wk'),
    title: '',
    date: today,
    poolLength: 25,
    objective: catalog.objectives[0] ?? 'Base Aeróbica (A1/A2)',
    coach: '',
    generalNotes: '',
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

interface AppShellProps {
  catalog: CatalogDatabase;
  workouts: Workout[];
  syncMode: 'cloud' | 'local';
  isLoadingCloud?: boolean;
  onUpdateCatalog: (next: CatalogDatabase) => void | Promise<void>;
  onResetCatalog: () => void | Promise<void>;
  onPersistWorkout: (workout: Workout, isEditing: boolean) => void | Promise<void>;
  onDeleteWorkout: (id: string) => void | Promise<void>;
}

function AppShell({
  catalog,
  workouts,
  syncMode,
  isLoadingCloud = false,
  onUpdateCatalog,
  onResetCatalog,
  onPersistWorkout,
  onDeleteWorkout,
}: AppShellProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('novo');
  const [draft, setDraft] = useState<Workout>(() => createEmptyWorkout(catalog));
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
    setDraft(createEmptyWorkout(catalog));
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
              <div className="brand-mark">
                <Waves size={18} />
              </div>
              <div className="brand-text">
                <span className="brand-name">RAIA // PRO</span>
                <span className="brand-sub">Performance Aquática</span>
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
                Meus Treinos
                <span className="nav-badge">{isLoadingCloud ? '…' : workouts.length}</span>
              </button>
              <button
                type="button"
                className={`nav-tab ${activeTab === 'base' ? 'active' : ''}`}
                onClick={() => setActiveTab('base')}
              >
                <Database size={15} />
                Base Técnica
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
            </div>
          </div>
        </header>

        <main className="main-container">
          {activeTab === 'novo' && (
            <WorkoutBuilder
              draft={draft}
              isEditingExisting={Boolean(editingId)}
              catalog={catalog}
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

function ConvexApp() {
  const cloudWorkouts = useQuery(workoutsListQuery, {});
  const cloudCatalog = useQuery(catalogGetQuery, {});
  const upsertWorkout = useMutation(workoutUpsertMutation);
  const removeWorkout = useMutation(workoutRemoveMutation);
  const seedWorkouts = useMutation(workoutsSeedMutation);
  const saveCloudCatalog = useMutation(catalogSaveMutation);

  const hasSeededRef = useRef(false);

  useEffect(() => {
    if (cloudWorkouts && cloudWorkouts.length === 0 && !hasSeededRef.current) {
      hasSeededRef.current = true;
      void seedWorkouts({ workouts: SAMPLE_WORKOUTS });
    }
  }, [cloudWorkouts, seedWorkouts]);

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

  const handlePersistWorkout = async (workout: Workout) => {
    await upsertWorkout({ workout });
  };

  const handleDeleteWorkout = async (id: string) => {
    await removeWorkout({ id });
  };

  return (
    <AppShell
      catalog={catalog}
      workouts={cloudWorkouts ?? []}
      syncMode="cloud"
      isLoadingCloud={cloudWorkouts === undefined}
      onUpdateCatalog={handleUpdateCatalog}
      onResetCatalog={handleResetCatalog}
      onPersistWorkout={handlePersistWorkout}
      onDeleteWorkout={handleDeleteWorkout}
    />
  );
}

function LocalApp() {
  const [catalog, setCatalog] = useState<CatalogDatabase>(() => loadCatalog());
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts());

  const handleUpdateCatalog = (next: CatalogDatabase) => {
    setCatalog(next);
    saveCatalog(next);
  };

  const handleResetCatalog = () => {
    const restored = resetCatalog();
    setCatalog(restored);
  };

  const handlePersistWorkout = (workout: Workout, isEditing: boolean) => {
    const updatedList = isEditing
      ? workouts.map((w) => (w.id === workout.id ? workout : w))
      : [workout, ...workouts];
    setWorkouts(updatedList);
    saveWorkouts(updatedList);
  };

  const handleDeleteWorkout = (id: string) => {
    const next = workouts.filter((w) => w.id !== id);
    setWorkouts(next);
    saveWorkouts(next);
  };

  return (
    <AppShell
      catalog={catalog}
      workouts={workouts}
      syncMode="local"
      onUpdateCatalog={handleUpdateCatalog}
      onResetCatalog={handleResetCatalog}
      onPersistWorkout={handlePersistWorkout}
      onDeleteWorkout={handleDeleteWorkout}
    />
  );
}

export function App() {
  const hasConvex = Boolean(import.meta.env.VITE_CONVEX_URL);
  return hasConvex ? <ConvexApp /> : <LocalApp />;
}

export default App;
