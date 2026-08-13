/**
 * Torneos View Logic (Preact)
 * Lógica para la vista de torneos y eventos
 *
 * Migrado desde torneos.logic.ts (manipulación imperativa del DOM +
 * template() en torneos.ts) a un componente Preact. Mantiene el mismo
 * contrato init()/stop() que espera GameRegistry (ver
 * registerSystemViews.ts) y las mismas clases CSS/estructura de
 * markup que consumía css/tournaments.css.
 *
 * Nota sobre escapeHtml: el original escapaba texto antes de
 * insertarlo vía innerHTML (nombre, descripción, etc.) porque venía
 * de datos potencialmente no confiables. JSX escapa automáticamente
 * cualquier valor interpolado como texto, así que ya no hace falta
 * llamar a escapeHtml() acá — sigue siendo necesario en cualquier otro
 * lugar del código que siga usando innerHTML con estos mismos datos.
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  tournamentSystem,
  type Tournament,
  type Event as TournamentEvent,
  type EventChallenge,
} from '../tournamentSystem.js';
import { hydrateBackButtons } from '../utils/backButton.js';

type TabId = 'tournaments' | 'events';

// Lecturas defensivas: si tournamentSystem no expone el método
// esperado (p. ej. un mock de test desactualizado), se degrada a un
// valor vacío en vez de tirar abajo el render completo del
// componente — mismo criterio aplicado en las vistas ya migradas.
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function TournamentCard({ tournament, onRegister }: { tournament: Tournament; onRegister: (id: string) => void }) {
  return (
    <div className="tournament-card">
      <h4 className="tournament-name">{tournament.name}</h4>
      <p className="tournament-description">{tournament.description}</p>
      <div className="tournament-info">
        <span className="tournament-game">Juego: {tournament.gameId}</span>
        <span className="tournament-participants">{tournament.currentParticipants}/{tournament.maxParticipants}</span>
        <span className={`tournament-status tournament-status--${tournament.status}`}>{tournament.status}</span>
      </div>
      {tournament.isRegistered ? (
        <button className="tournament-btn tournament-btn--registered">✓ Registrado</button>
      ) : (
        <button
          className="tournament-btn tournament-btn--register"
          data-tournament-id={tournament.id}
          onClick={() => onRegister(tournament.id)}
        >
          Registrarse
        </button>
      )}
    </div>
  );
}

function TournamentsTab({ activeTournaments, tournamentHistory, onRegister }: {
  activeTournaments: Tournament[];
  tournamentHistory: Tournament[];
  onRegister: (id: string) => void;
}) {
  return (
    <div className="tournament-tab-content" id="tournaments-tab">
      <div className="tournaments-section">
        <h3 className="section-title">🏆 Torneos Activos</h3>
        <div className="section-decorative">
          <span>🏆</span><span>🎯</span><span>🥇</span>
        </div>
        <div className="tournaments-list" id="active-tournaments">
          {activeTournaments.length > 0 ? (
            activeTournaments.map((t) => <TournamentCard key={t.id} tournament={t} onRegister={onRegister} />)
          ) : (
            <p className="no-tournaments">No hay torneos activos</p>
          )}
        </div>
      </div>
      <div className="tournaments-section">
        <h3 className="section-title">📜 Historial de Torneos</h3>
        <div className="section-decorative">
          <span>📜</span><span>🏅</span><span>🎖️</span>
        </div>
        <div className="tournaments-list" id="tournament-history">
          {tournamentHistory.length > 0 ? (
            tournamentHistory.map((t) => (
              <div key={t.id} className="tournament-card tournament-card--history">
                <h4 className="tournament-name">{t.name}</h4>
                <span className="tournament-date">Finalizado: {new Date(t.endTime).toLocaleDateString()}</span>
              </div>
            ))
          ) : (
            <p className="no-tournaments">Sin historial de torneos</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EventChallengeCard({ challenge }: { challenge: EventChallenge }) {
  return (
    <div className={`challenge-card ${challenge.completed ? 'challenge-card--completed' : ''}`}>
      <h5 className="challenge-name">{challenge.name}</h5>
      <p className="challenge-description">{challenge.description}</p>
      <div className="challenge-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(challenge.progress / challenge.target) * 100}%` }} />
        </div>
        <span className="progress-text">{challenge.progress}/{challenge.target}</span>
      </div>
      {challenge.completed && <span className="challenge-completed">✓ Completado</span>}
    </div>
  );
}

function CurrentEventDetails({ event, onApplyTheme, onRemoveTheme }: {
  event: TournamentEvent;
  onApplyTheme: () => void;
  onRemoveTheme: () => void;
}) {
  const completionReward = event.rewards.completion;

  return (
    <div className="current-event-section" id="current-event-section">
      <h3 className="section-title">Evento Actual</h3>
      <div className="event-info" id="event-info">
        <h4 className="event-detail-name">{event.name}</h4>
        <p className="event-detail-description">{event.description}</p>
        <div className="event-detail-info">
          <span className="event-detail-type">{event.type}</span>
          <span className="event-detail-dates">
            {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="event-challenges">
        <h4 className="subsection-title">Desafíos del Evento</h4>
        <div className="challenges-list" id="event-challenges">
          {event.challenges.map((challenge) => (
            <EventChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      </div>
      <div className="event-rewards">
        <h4 className="subsection-title">Recompensas</h4>
        <div className="rewards-list" id="event-rewards">
          <div className="reward-card">
            <h5 className="reward-title">Recompensa de Completación</h5>
            <span className="reward-xp">+{completionReward.xp} XP</span>
            {completionReward.cosmetics.length > 0 && (
              <div className="reward-cosmetics">
                {completionReward.cosmetics.map((c) => (
                  <span key={c} className="reward-cosmetic">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="event-actions">
        <button className="event-btn" id="apply-event-theme" onClick={onApplyTheme}>
          🎨 Aplicar Tema del Evento
        </button>
        <button className="event-btn" id="remove-event-theme" onClick={onRemoveTheme}>
          🚫 Quitar Tema del Evento
        </button>
      </div>
    </div>
  );
}

function EventsTab({ activeEvents, upcomingEvents, selectedEventId, onSelectEvent, onApplyTheme, onRemoveTheme }: {
  activeEvents: TournamentEvent[];
  upcomingEvents: TournamentEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  onApplyTheme: () => void;
  onRemoveTheme: () => void;
}) {
  const selectedEvent = [...activeEvents, ...upcomingEvents].find((e) => e.id === selectedEventId) ?? null;

  return (
    <div className="tournament-tab-content" id="events-tab">
      <div className="events-section">
        <h3 className="section-title">🎪 Eventos Activos</h3>
        <div className="section-decorative">
          <span>🎪</span><span>🎊</span><span>✨</span>
        </div>
        <div className="events-list" id="active-events">
          {activeEvents.length > 0 ? (
            activeEvents.map((event) => (
              <div key={event.id} className="event-card event-card--active">
                <h4 className="event-name">{event.name}</h4>
                <p className="event-description">{event.description}</p>
                <div className="event-info">
                  <span className="event-type">{event.type}</span>
                  <span className="event-dates">
                    {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                  </span>
                </div>
                <button className="event-btn" data-event-id={event.id} onClick={() => onSelectEvent(event.id)}>
                  Ver Evento
                </button>
              </div>
            ))
          ) : (
            <p className="no-events">No hay eventos activos</p>
          )}
        </div>
      </div>
      <div className="events-section">
        <h3 className="section-title">📅 Próximos Eventos</h3>
        <div className="section-decorative">
          <span>📅</span><span>🗓️</span><span>⏰</span>
        </div>
        <div className="events-list" id="upcoming-events">
          {upcomingEvents.slice(0, 5).map((event) => (
            <div key={event.id} className="event-card">
              <h4 className="event-name">{event.name}</h4>
              <span className="event-start">Comienza: {new Date(event.startDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
      {selectedEvent && (
        <CurrentEventDetails event={selectedEvent} onApplyTheme={onApplyTheme} onRemoveTheme={onRemoveTheme} />
      )}
    </div>
  );
}

function TorneosView() {
  const [tab, setTab] = useState<TabId>('tournaments');
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>(() =>
    safe(() => tournamentSystem.getActiveTournaments(), [])
  );
  const [tournamentHistory, setTournamentHistory] = useState<Tournament[]>(() =>
    safe(() => tournamentSystem.getTournamentHistory(), [])
  );
  const [activeEvents, setActiveEvents] = useState<TournamentEvent[]>(() =>
    safe(() => tournamentSystem.getActiveEvents(), [])
  );
  const [upcomingEvents, setUpcomingEvents] = useState<TournamentEvent[]>(() =>
    safe(() => tournamentSystem.getEvents().filter((e) => !e.isActive), [])
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const refreshTournaments = () => {
    setActiveTournaments(safe(() => tournamentSystem.getActiveTournaments(), []));
    setTournamentHistory(safe(() => tournamentSystem.getTournamentHistory(), []));
  };

  const refreshEvents = () => {
    setActiveEvents(safe(() => tournamentSystem.getActiveEvents(), []));
    setUpcomingEvents(safe(() => tournamentSystem.getEvents().filter((e) => !e.isActive), []));
  };

  useEffect(() => {
    const registeredHandler = () => refreshTournaments();
    const challengeCompletedHandler = () => {
      const currentEvent = safe(() => tournamentSystem.getCurrentEvent(), null);
      if (currentEvent) {
        refreshEvents();
        setSelectedEventId(currentEvent.id);
      }
    };

    window.addEventListener('tournament:registered', registeredHandler);
    window.addEventListener('event:challenge_completed', challengeCompletedHandler);
    return () => {
      window.removeEventListener('tournament:registered', registeredHandler);
      window.removeEventListener('event:challenge_completed', challengeCompletedHandler);
    };
  }, []);

  const handleRegisterForTournament = (tournamentId: string): void => {
    void tournamentSystem
      .registerForTournament(tournamentId)
      .then(() => refreshTournaments())
      .catch((err: unknown) => {
        console.error('[torneos] Error al registrarse en el torneo:', err);
        alert('Error al registrarse en el torneo');
      });
  };

  const handleApplyTheme = () => {
    const currentEvent = safe(() => tournamentSystem.getCurrentEvent(), null);
    if (currentEvent) {
      tournamentSystem.applyEventTheme(currentEvent.id);
    }
  };

  const handleRemoveTheme = () => {
    const currentEvent = safe(() => tournamentSystem.getCurrentEvent(), null);
    if (currentEvent) {
      tournamentSystem.removeEventTheme(currentEvent.id);
    }
  };

  return (
    <div className="tournaments-view">
      <div className="tournaments-header">
        <button className="back-btn" data-back-to="home"></button>
        <h2 className="tournaments-title">🏆 Torneos y Eventos</h2>
      </div>

      <div className="tournaments-tabs">
        <button
          className={`tournament-tab ${tab === 'tournaments' ? 'tournament-tab--active' : ''}`}
          data-tab="tournaments"
          onClick={() => setTab('tournaments')}
        >
          🏆 Torneos
        </button>
        <button
          className={`tournament-tab ${tab === 'events' ? 'tournament-tab--active' : ''}`}
          data-tab="events"
          onClick={() => setTab('events')}
        >
          🎪 Eventos
        </button>
      </div>

      {tab === 'tournaments' ? (
        <TournamentsTab
          activeTournaments={activeTournaments}
          tournamentHistory={tournamentHistory}
          onRegister={handleRegisterForTournament}
        />
      ) : (
        <EventsTab
          activeEvents={activeEvents}
          upcomingEvents={upcomingEvents}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          onApplyTheme={handleApplyTheme}
          onRemoveTheme={handleRemoveTheme}
        />
      )}
    </div>
  );
}

export function init(): void {
  const container = document.getElementById('torneos');
  if (!container) return;

  render(<TorneosView />, container);
  hydrateBackButtons(container);
}

export function stop(): void {
  const container = document.getElementById('torneos');
  if (container) {
    render(null, container);
  }
}
