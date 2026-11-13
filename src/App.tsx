import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Database, PlusSquare, Waves } from 'lucide-react';
import './App.css';
import { CatalogManager } from './components/CatalogManager';
import { MyWorkouts } from './components/MyWorkouts';
import { PrintSheet } from './components/PrintSheet';
import { WorkoutBuilder } from './components/WorkoutBuilder';
import type { ActiveTab, CatalogDatabase, Workout } from './types/swimming';
import {
  createBackupPayload,
  generateId,
  loadCatalog,
  loadWorkouts,
  mergeWorkouts,
  parseBackupFile,
  resetCatalog,
  saveCatalog,
  saveWorkouts,
} from './utils/storage';

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

export function App() {
  const [catalog, setCatalog] = useState<CatalogDatabase>(() => loadCatalog());
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts());
  const [activeTab, setActiveTab] = useState<ActiveTab>('novo');
  const [draft, setDraft] = useState<Workout>(() => createEmptyWorkout(loadCatalog()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<Workout | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const handleUpdateCatalog = (next: CatalogDatabase) => {
    setCatalog(next);
    saveCatalog(next);
    showToast('Base técnica atualizada.');
  };

  const handleResetCatalog = () => {
    const restored = resetCatalog();
    setCatalog(restored);
    showToast('Base técnica restaurada para o padrão.');
  };

  const handleSaveWorkout = () => {
    if (draft.items.length === 0) {
      showToast('Adicione pelo menos uma série antes de salvar.');
      return;
    }

    const now = new Date().toISOString();
    const finalWorkout: Workout = {
      ...draft,
      title: draft.title.trim() || `Treino ${draft.objective}`,
      updatedAt: now,
    };

    let updatedList: Workout[];
    if (editingId) {
      updatedList = workouts.map((w) => (w.id === editingId ? finalWorkout : w));
      showToast('Treino atualizado em Meus Treinos.');
    } else {
      updatedList = [finalWorkout, ...workouts];
      setEditingId(finalWorkout.id);
      showToast('Treino salvo em Meus Treinos.');
    }

    setDraft(finalWorkout);
    setWorkouts(updatedList);
    saveWorkouts(updatedList);
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

  const handleDuplicateWorkout = (workout: Workout) => {
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
    const next = [copy, ...workouts];
    setWorkouts(next);
    saveWorkouts(next);
    showToast('Treino duplicado com sucesso.');
  };

  const handleDeleteWorkout = (id: string) => {
    const next = workouts.filter((w) => w.id !== id);
    setWorkouts(next);
    saveWorkouts(next);
    if (editingId === id) {
      handleResetDraft();
    }
    showToast('Treino excluído.');
  };

  const handleExportBackup = () => {
    const payload = createBackupPayload(workouts, catalog);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const dateSlug = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raia-pro-backup-${dateSlug}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Backup .json exportado com sucesso.');
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const { workouts: importedWorkouts, catalog: importedCatalog } = parseBackupFile(text);
      const { merged, addedCount, updatedCount } = mergeWorkouts(workouts, importedWorkouts);

      setWorkouts(merged);
      saveWorkouts(merged);

      if (importedCatalog) {
        setCatalog(importedCatalog);
        saveCatalog(importedCatalog);
      }

      showToast(
        `Backup importado: ${addedCount} novo(s), ${updatedCount} atualizado(s).`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível importar o arquivo.';
      showToast(message);
    }
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
                <span className="nav-badge">{workouts.length}</span>
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
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
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

export default App;
