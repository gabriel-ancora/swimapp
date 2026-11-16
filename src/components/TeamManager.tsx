import React, { useState } from 'react';
import {
  Check,
  Edit3,
  Palette,
  Plus,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  Athlete,
  AthleteEventGoal,
  AthleteSex,
  AthleteStatus,
  CoachProfile,
  SwimResult,
  Team,
} from '../types/swimming';
import { computeBestMarksByEvent, SWIM_EVENTS } from '../domain/points';
import { formatSwimTime } from '../domain/time';
import { generateId } from '../utils/storage';

interface TeamManagerProps {
  coach: CoachProfile;
  teams: Team[];
  activeTeam: Team | null;
  athletes: Athlete[];
  results?: SwimResult[];
  onSelectTeam: (teamId: string) => void;
  onSaveTeam: (team: Team) => Promise<void> | void;
  onSaveAthlete: (athlete: Athlete) => Promise<void> | void;
  onDeleteAthlete: (athleteId: string) => Promise<void> | void;
}

const TEAM_COLORS = ['#1E56D9', '#0F766E', '#A8322F', '#6D5BD0', '#C27C0E', '#1C1B19'];
const DEFAULT_CATEGORIES = ['Infantil', 'Juvenil', 'Júnior', 'Sênior', 'Master'];

export const TeamManager: React.FC<TeamManagerProps> = ({
  coach,
  teams,
  activeTeam,
  athletes,
  results = [],
  onSelectTeam,
  onSaveTeam,
  onSaveAthlete,
  onDeleteAthlete,
}) => {
  const [isCreatingTeam, setIsCreatingTeam] = useState(teams.length === 0);
  const [teamName, setTeamName] = useState(activeTeam?.name ?? '');
  const [teamClub, setTeamClub] = useState(activeTeam?.club ?? '');
  const [teamColor, setTeamColor] = useState(activeTeam?.accentColor ?? '#1E56D9');
  const [teamCategories, setTeamCategories] = useState<string[]>(
    activeTeam?.categories ?? DEFAULT_CATEGORIES
  );
  const [weeklySessionsGoal, setWeeklySessionsGoal] = useState<number>(
    activeTeam?.weeklySessionsGoal ?? 5
  );
  const [newCategory, setNewCategory] = useState('');

  // Athlete Form
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [athleteName, setAthleteName] = useState('');
  const [athleteCategory, setAthleteCategory] = useState(
    activeTeam?.categories[0] ?? DEFAULT_CATEGORIES[0]
  );
  const [athleteSex, setAthleteSex] = useState<AthleteSex>('M');
  const [athleteEvent, setAthleteEvent] = useState('');
  const [athleteEvents, setAthleteEvents] = useState<AthleteEventGoal[]>([]);
  const [extraEventName, setExtraEventName] = useState('');
  const [athleteStatus, setAthleteStatus] = useState<AthleteStatus>('Ativo');
  const [athleteNotes, setAthleteNotes] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const loadTeamIntoForm = (team: Team | null, creatingNew: boolean) => {
    setIsCreatingTeam(creatingNew);
    if (creatingNew || !team) {
      setTeamName('');
      setTeamClub('');
      setTeamColor('#1E56D9');
      setTeamCategories(DEFAULT_CATEGORIES);
      setWeeklySessionsGoal(5);
    } else {
      setTeamName(team.name);
      setTeamClub(team.club);
      setTeamColor(team.accentColor);
      setTeamCategories(team.categories.length ? team.categories : DEFAULT_CATEGORIES);
      setWeeklySessionsGoal(team.weeklySessionsGoal);
    }
  };

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (!val || teamCategories.includes(val)) return;
    setTeamCategories([...teamCategories, val]);
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    if (teamCategories.length <= 1) return;
    setTeamCategories(teamCategories.filter((c) => c !== cat));
  };

  const handleSubmitTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    const now = new Date().toISOString();

    const payload: Team =
      isCreatingTeam || !activeTeam
        ? {
            id: generateId('tm'),
            coachId: coach.id,
            name: teamName.trim(),
            club: teamClub.trim(),
            accentColor: teamColor,
            categories: teamCategories,
            weeklySessionsGoal: Math.max(1, weeklySessionsGoal),
            createdAt: now,
            updatedAt: now,
          }
        : {
            ...activeTeam,
            name: teamName.trim(),
            club: teamClub.trim(),
            accentColor: teamColor,
            categories: teamCategories,
            weeklySessionsGoal: Math.max(1, weeklySessionsGoal),
            updatedAt: now,
          };

    await onSaveTeam(payload);
    setIsCreatingTeam(false);
  };

  const resetAthleteForm = () => {
    setEditingAthlete(null);
    setAthleteName('');
    setAthleteCategory(activeTeam?.categories[0] ?? DEFAULT_CATEGORIES[0]);
    setAthleteSex('M');
    setAthleteEvent('');
    setAthleteEvents([]);
    setExtraEventName('');
    setAthleteStatus('Ativo');
    setAthleteNotes('');
  };

  const startEditAthlete = (ath: Athlete) => {
    setEditingAthlete(ath);
    setAthleteName(ath.name);
    setAthleteCategory(ath.category);
    setAthleteSex(ath.sex ?? 'M');
    setAthleteEvent(ath.mainEvent);
    setAthleteEvents(ath.events ? ath.events.map((ev) => ({ ...ev })) : []);
    setExtraEventName('');
    setAthleteStatus(ath.status);
    setAthleteNotes(ath.notes);
  };

  const handleAddExtraEvent = () => {
    const evName = extraEventName.trim();
    if (!evName) return;
    setAthleteEvents([
      ...athleteEvents,
      {
        id: generateId('ev'),
        event: evName,
      },
    ]);
    setExtraEventName('');
  };

  const handleUpdateExtraEvent = (id: string, value: string) => {
    setAthleteEvents(
      athleteEvents.map((ev) => (ev.id === id ? { ...ev, event: value } : ev))
    );
  };

  const handleRemoveExtraEvent = (id: string) => {
    setAthleteEvents(athleteEvents.filter((ev) => ev.id !== id));
  };

  const handleSubmitAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam || !athleteName.trim()) return;
    const now = new Date().toISOString();

    const cleanedEvents = athleteEvents
      .map((ev) => ({
        ...ev,
        event: ev.event.trim(),
      }))
      .filter((ev) => ev.event.length > 0);

    const payload: Athlete = editingAthlete
      ? {
          ...editingAthlete,
          name: athleteName.trim(),
          category: athleteCategory,
          sex: athleteSex,
          mainEvent: athleteEvent.trim() || '100m Livre',
          events: cleanedEvents,
          status: athleteStatus,
          notes: athleteNotes.trim(),
          updatedAt: now,
        }
      : {
          id: generateId('ath'),
          teamId: activeTeam.id,
          name: athleteName.trim(),
          category: athleteCategory,
          sex: athleteSex,
          mainEvent: athleteEvent.trim() || '100m Livre',
          events: cleanedEvents,
          status: athleteStatus,
          notes: athleteNotes.trim(),
          createdAt: now,
          updatedAt: now,
        };

    await onSaveAthlete(payload);
    resetAthleteForm();
  };

  const filteredAthletes =
    categoryFilter === 'all'
      ? athletes
      : athletes.filter((a) => a.category === categoryFilter);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Equipe</h1>
          <p className="page-subtitle">
            Dados da equipe, categorias, metas semanais e atletas.
          </p>
        </div>

        <div className="page-actions">
          {teams.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => loadTeamIntoForm(null, true)}
            >
              <Plus size={15} /> Nova equipe
            </button>
          )}
        </div>
      </div>

      {/* Team Switcher if multiple teams */}
      {teams.length > 1 && (
        <div className="filters-bar">
          <span className="metric-label" style={{ margin: 0 }}>
            Equipe ativa:
          </span>
          <div className="chip-row">
            {teams.map((tm) => (
              <button
                key={tm.id}
                type="button"
                className={`chip-btn ${activeTeam?.id === tm.id && !isCreatingTeam ? 'selected' : ''}`}
                onClick={() => {
                  onSelectTeam(tm.id);
                  loadTeamIntoForm(tm, false);
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: tm.accentColor,
                    marginRight: 6,
                  }}
                />
                {tm.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="catalog-grid">
        {/* Team Customization Card */}
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <Settings2 size={15} />{' '}
              {isCreatingTeam || !activeTeam
                ? 'Criar nova equipe'
                : `Configurações · ${activeTeam.name}`}
            </h2>
          </div>
          <form className="card-section" onSubmit={handleSubmitTeam}>
            <div className="form-grid">
              <div className="field col-6">
                <label>Nome da equipe</label>
                <input
                  type="text"
                  className="input"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Raia Sul Natação"
                  required
                />
              </div>

              <div className="field col-6">
                <label>Clube / cidade</label>
                <input
                  type="text"
                  className="input"
                  value={teamClub}
                  onChange={(e) => setTeamClub(e.target.value)}
                  placeholder="Ex: Clube Pinheiros · SP"
                />
              </div>

              <div className="field col-12">
                <label>Meta de sessões / semana</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  className="input mono-num"
                  value={weeklySessionsGoal}
                  onChange={(e) => setWeeklySessionsGoal(Number(e.target.value) || 1)}
                />
              </div>

              <div className="field col-12">
                <label>
                  <Palette size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Cor de identidade da equipe
                </label>
                <div className="chip-row">
                  {TEAM_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`color-swatch-btn ${teamColor === hex ? 'selected' : ''}`}
                      style={{ backgroundColor: hex }}
                      onClick={() => setTeamColor(hex)}
                      aria-label={`Selecionar cor ${hex}`}
                    />
                  ))}
                </div>
              </div>

              <div className="field col-12">
                <label>Categorias / grupos personalizados</label>
                <div className="catalog-add-form" style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    className="input"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ex: Velocistas, Fundistas, Petiz..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-sm" onClick={handleAddCategory}>
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
                <div className="tag-cloud">
                  {teamCategories.map((cat) => (
                    <span key={cat} className="db-chip">
                      {cat}
                      <button
                        type="button"
                        title="Remover categoria"
                        onClick={() => handleRemoveCategory(cat)}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="composer-actions">
              {isCreatingTeam && activeTeam && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => loadTeamIntoForm(activeTeam, false)}
                >
                  Cancelar
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-sm">
                <Check size={14} />
                {isCreatingTeam || !activeTeam ? 'Criar equipe' : 'Salvar configurações'}
              </button>
            </div>
          </form>
        </section>

        {/* Add / Edit Athlete Card */}
        <section className="surface-card">
          <div className="card-header">
            <h2 className="card-title">
              <UserPlus size={15} /> {editingAthlete ? 'Editar atleta' : 'Cadastrar atleta na equipe'}
            </h2>
          </div>
          {!activeTeam ? (
            <div className="card-section" style={{ color: 'var(--ink-secondary)', fontSize: 13 }}>
              Crie sua equipe ao lado primeiro para liberar o cadastro de atletas.
            </div>
          ) : (
            <form className="card-section" onSubmit={handleSubmitAthlete}>
              <datalist id="swim-events-list">
                {SWIM_EVENTS.map((ev) => (
                  <option key={ev} value={ev} />
                ))}
              </datalist>
              <div className="form-grid">
                <div className="field col-6">
                  <label>Nome do atleta</label>
                  <input
                    type="text"
                    className="input"
                    value={athleteName}
                    onChange={(e) => setAthleteName(e.target.value)}
                    placeholder="Ex: Lucas Oliveira"
                    required
                  />
                </div>

                <div className="field col-3">
                  <label>Categoria / grupo</label>
                  <select
                    className="select"
                    value={athleteCategory}
                    onChange={(e) => setAthleteCategory(e.target.value)}
                  >
                    {activeTeam.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field col-3">
                  <label>Sexo (World Aquatics)</label>
                  <select
                    className="select"
                    value={athleteSex}
                    onChange={(e) => setAthleteSex(e.target.value as AthleteSex)}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>

                <div className="field col-12">
                  <label>Prova principal</label>
                  <input
                    type="text"
                    list="swim-events-list"
                    className="input"
                    value={athleteEvent}
                    onChange={(e) => setAthleteEvent(e.target.value)}
                    placeholder="Ex: 100m Livre"
                  />
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4, display: 'block' }}>
                    Melhores marcas (25m e 50m) e metas são calculadas automaticamente pelos resultados registrados em <strong>Atletas</strong>.
                  </span>
                </div>

                <div className="field col-12">
                  <label>Outras provas do atleta</label>
                  <div className="athlete-events-box">
                    {athleteEvents.length > 0 && (
                      <div className="athlete-events-list">
                        {athleteEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="athlete-event-row"
                            style={{ gridTemplateColumns: '1fr auto' }}
                          >
                            <input
                              type="text"
                              list="swim-events-list"
                              className="input"
                              value={ev.event}
                              onChange={(e) => handleUpdateExtraEvent(ev.id, e.target.value)}
                              placeholder="Prova (ex: 200m Livre)"
                            />
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-icon"
                              title="Remover prova"
                              onClick={() => handleRemoveExtraEvent(ev.id)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      className="athlete-event-row"
                      style={{ gridTemplateColumns: '1fr auto' }}
                    >
                      <input
                        type="text"
                        list="swim-events-list"
                        className="input"
                        value={extraEventName}
                        onChange={(e) => setExtraEventName(e.target.value)}
                        placeholder="Outra prova (ex: 50m Borboleta)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddExtraEvent();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleAddExtraEvent}
                        title="Adicionar outra prova"
                      >
                        <Plus size={14} /> Adicionar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="field col-4">
                  <label>Status</label>
                  <select
                    className="select"
                    value={athleteStatus}
                    onChange={(e) => setAthleteStatus(e.target.value as AthleteStatus)}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Recuperação">Recuperação</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                <div className="field col-8">
                  <label>Observações técnicas</label>
                  <input
                    type="text"
                    className="input"
                    value={athleteNotes}
                    onChange={(e) => setAthleteNotes(e.target.value)}
                    placeholder="Ex: Foco em virada e saída submersa..."
                  />
                </div>
              </div>

              <div className="composer-actions">
                {editingAthlete && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={resetAthleteForm}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-sm">
                  <Plus size={14} /> {editingAthlete ? 'Atualizar atleta' : 'Adicionar atleta'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Athletes Roster */}
      {activeTeam && (
        <section className="surface-card" style={{ marginTop: 16 }}>
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <h2 className="card-title">
              <Users size={15} /> Elenco de {activeTeam.name} ({athletes.length})
            </h2>
            <div className="chip-row">
              <button
                type="button"
                className={`chip-btn ${categoryFilter === 'all' ? 'selected' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                Todos
              </button>
              {activeTeam.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`chip-btn ${categoryFilter === cat ? 'selected' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredAthletes.length === 0 ? (
            <div className="card-section" style={{ color: 'var(--ink-secondary)', fontSize: 13 }}>
              Nenhum atleta cadastrado neste filtro ainda.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th>Categoria</th>
                    <th>Prova principal (automática)</th>
                    <th>Melhores marcas</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.map((ath) => {
                    const athResults = results.filter((r) => r.athleteId === ath.id);
                    const bestMarks = computeBestMarksByEvent(athResults);
                    const mainMarks = bestMarks.filter((b) => b.event === ath.mainEvent);
                    const mainBest25 = mainMarks.find((b) => b.poolLength === 25)?.bestResult;
                    const mainBest50 = mainMarks.find((b) => b.poolLength === 50)?.bestResult;

                    return (
                    <tr key={ath.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {ath.name}{' '}
                          <span style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 500 }}>
                            ({ath.sex ?? 'M'})
                          </span>
                        </div>
                        {ath.notes && (
                          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{ath.notes}</div>
                        )}
                      </td>
                      <td>
                        <span className="db-chip">{ath.category}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ath.mainEvent || '—'}</div>
                        <div className="mono-num" style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                          {mainBest25 ? `25m: ${formatSwimTime(mainBest25.timeCs)}` : ''}
                          {mainBest25 && mainBest50 ? ' · ' : ''}
                          {mainBest50 ? `50m: ${formatSwimTime(mainBest50.timeCs)}` : ''}
                          {!mainBest25 && !mainBest50 && (ath.bestTime ? `Legado: ${ath.bestTime}` : 'Sem tempos registrados')}
                          {ath.targetTimeCs
                            ? ` · Meta: ${formatSwimTime(ath.targetTimeCs)}`
                            : ath.targetTime
                              ? ` · Meta: ${ath.targetTime}`
                              : ''}
                        </div>
                      </td>
                      <td>
                        {bestMarks.length > 0 ? (
                          <div className="tag-cloud">
                            {bestMarks.slice(0, 4).map((bm) => (
                              <span key={`${bm.event}-${bm.poolLength}`} className="db-chip">
                                <strong>{bm.event}</strong> ({bm.poolLength}m) ·{' '}
                                <span className="mono-num">{formatSwimTime(bm.bestResult.timeCs)}</span>
                              </span>
                            ))}
                          </div>
                        ) : ath.events && ath.events.length > 0 ? (
                          <div className="tag-cloud">
                            {ath.events.map((ev) => (
                              <span key={ev.id} className="db-chip">
                                <strong>{ev.event}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ink-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge status-${ath.status.toLowerCase()}`}>
                          {ath.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="series-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            title="Editar atleta"
                            onClick={() => startEditAthlete(ath)}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger-ghost btn-icon"
                            title="Remover atleta"
                            onClick={() => onDeleteAthlete(ath.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
