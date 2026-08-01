/**
 * Torneos View Logic
 * Lógica para la vista de torneos y eventos
 */

import { tournamentSystem } from '../tournamentSystem.js';
import { template } from './torneos.js';
import type { TournamentEvent, EventChallenge } from '../types/game';
import { escapeHtml } from '../security.js';

let eventListeners: Array<() => void> = [];
let cachedElements: Record<string, HTMLElement | null> = {};

function getElement(id: string): HTMLElement | null {
  if (!cachedElements[id]) {
    cachedElements[id] = document.getElementById(id);
  }
  return cachedElements[id];
}

function clearCache(): void {
  cachedElements = {};
}

export function init(): void {
  const container = document.getElementById('torneos');
  if (!container) return;

  container.innerHTML = template();
  renderTournaments();
  renderEvents();
  setupEventListeners();
  setupTournamentListeners();
}

function renderTournaments(): void {
  const activeTournaments = tournamentSystem.getActiveTournaments();
  const tournamentHistory = tournamentSystem.getTournamentHistory();
  
  const activeList = document.getElementById('active-tournaments');
  if (activeList) {
    activeList.innerHTML = activeTournaments.length > 0 ? activeTournaments.map(tournament => `
      <div class="tournament-card">
        <h4 class="tournament-name">${escapeHtml(tournament.name)}</h4>
        <p class="tournament-description">${escapeHtml(tournament.description)}</p>
        <div class="tournament-info">
          <span class="tournament-game">Juego: ${tournament.gameId}</span>
          <span class="tournament-participants">${tournament.currentParticipants}/${tournament.maxParticipants}</span>
          <span class="tournament-status tournament-status--${tournament.status}">${tournament.status}</span>
        </div>
        ${tournament.isRegistered ? `
          <button class="tournament-btn tournament-btn--registered">✓ Registrado</button>
        ` : `
          <button class="tournament-btn tournament-btn--register" data-tournament-id="${tournament.id}">
            Registrarse
          </button>
        `}
      </div>
    `).join('') : '<p class="no-tournaments">No hay torneos activos</p>';
  }

  const historyList = document.getElementById('tournament-history');
  if (historyList) {
    historyList.innerHTML = tournamentHistory.length > 0 ? tournamentHistory.map(tournament => `
      <div class="tournament-card tournament-card--history">
        <h4 class="tournament-name">${tournament.name}</h4>
        <span class="tournament-date">Finalizado: ${new Date(tournament.endTime).toLocaleDateString()}</span>
      </div>
    `).join('') : '<p class="no-tournaments">Sin historial de torneos</p>';
  }
}

function renderEvents(): void {
  const activeEvents = tournamentSystem.getActiveEvents();
  const upcomingEvents = tournamentSystem.getEvents().filter(e => !e.isActive);
  
  const activeList = document.getElementById('active-events');
  if (activeList) {
    activeList.innerHTML = activeEvents.length > 0 ? activeEvents.map(event => `
      <div class="event-card event-card--active">
        <h4 class="event-name">${escapeHtml(event.name)}</h4>
        <p class="event-description">${escapeHtml(event.description)}</p>
        <div class="event-info">
          <span class="event-type">${event.type}</span>
          <span class="event-dates">${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}</span>
        </div>
        <button class="event-btn" data-event-id="${event.id}">Ver Evento</button>
      </div>
    `).join('') : '<p class="no-events">No hay eventos activos</p>';
  }

  const upcomingList = document.getElementById('upcoming-events');
  if (upcomingList) {
    upcomingList.innerHTML = upcomingEvents.slice(0, 5).map(event => `
      <div class="event-card">
        <h4 class="event-name">${escapeHtml(event.name)}</h4>
        <span class="event-start">Comienza: ${new Date(event.startDate).toLocaleDateString()}</span>
      </div>
    `).join('');
  }
}

function setupEventListeners(): void {
  // Torneos tabs
  document.querySelectorAll('.tournament-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tournament-tab').forEach(t => t.classList.remove('tournament-tab--active'));
      tab.classList.add('tournament-tab--active');
      switchTournamentTab((tab as HTMLElement).dataset.tab || 'tournaments');
    });
  });

  // Registrarse en torneo
  document.querySelectorAll('.tournament-btn--register').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tournamentId = (btn as HTMLElement).dataset.tournamentId;
      if (tournamentId) {
        try {
          await tournamentSystem.registerForTournament(tournamentId);
          renderTournaments();
        } catch (e) {
          alert('Error al registrarse en el torneo');
        }
      }
    });
  });

  // Ver evento
  document.querySelectorAll('.event-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const eventId = (btn as HTMLElement).dataset.eventId;
      if (eventId) {
        showEventDetails(eventId);
      }
    });
  });

  // Aplicar tema de evento
  document.getElementById('apply-event-theme')?.addEventListener('click', () => {
    const currentEvent = tournamentSystem.getCurrentEvent();
    if (currentEvent) {
      tournamentSystem.applyEventTheme(currentEvent.id);
    }
  });

  // Quitar tema de evento
  document.getElementById('remove-event-theme')?.addEventListener('click', () => {
    const currentEvent = tournamentSystem.getCurrentEvent();
    if (currentEvent) {
      tournamentSystem.removeEventTheme(currentEvent.id);
    }
  });
}

function switchTournamentTab(tab: string): void {
  document.querySelectorAll('.tournament-tab-content').forEach(content => {
    (content as HTMLElement).style.display = 'none';
  });
  
  const targetTab = document.getElementById(`${tab}-tab`);
  if (targetTab) {
    targetTab.style.display = 'block';
  }
}

function showEventDetails(eventId: string): void {
  const events = tournamentSystem.getEvents();
  const event = events.find(e => e.id === eventId);
  
  if (event) {
    document.getElementById('current-event-section')!.style.display = 'block';
    
    document.getElementById('event-info')!.innerHTML = `
      <h4 class="event-detail-name">${escapeHtml(event.name)}</h4>
      <p class="event-detail-description">${escapeHtml(event.description)}</p>
      <div class="event-detail-info">
        <span class="event-detail-type">${event.type}</span>
        <span class="event-detail-dates">${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}</span>
      </div>
    `;

    renderEventChallenges(event);
    renderEventRewards(event);
  }
}

function renderEventChallenges(event: TournamentEvent): void {
  const challengesList = document.getElementById('event-challenges');
  if (challengesList) {
    challengesList.innerHTML = event.challenges.map((challenge: EventChallenge) => `
      <div class="challenge-card ${challenge.completed ? 'challenge-card--completed' : ''}">
        <h5 class="challenge-name">${escapeHtml(challenge.name)}</h5>
        <p class="challenge-description">${escapeHtml(challenge.description)}</p>
        <div class="challenge-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(challenge.progress / challenge.target) * 100}%"></div>
          </div>
          <span class="progress-text">${challenge.progress}/${challenge.target}</span>
        </div>
        ${challenge.completed ? '<span class="challenge-completed">✓ Completado</span>' : ''}
      </div>
    `).join('');
  }
}

function renderEventRewards(event: TournamentEvent): void {
  const rewardsList = document.getElementById('event-rewards');
  if (rewardsList) {
    const completionReward = event.rewards.completion;
    rewardsList.innerHTML = `
      <div class="reward-card">
        <h5 class="reward-title">Recompensa de Completación</h5>
        <span class="reward-xp">+${completionReward.xp} XP</span>
        ${completionReward.cosmetics.length > 0 ? `
          <div class="reward-cosmetics">
            ${completionReward.cosmetics.map((c: string) => `<span class="reward-cosmetic">${c}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
}

function setupTournamentListeners(): void {
  const registeredHandler = () => {
    renderTournaments();
  };
  const challengeCompletedHandler = () => {
    const currentEvent = tournamentSystem.getCurrentEvent();
    if (currentEvent) {
      showEventDetails(currentEvent.id);
    }
  };

  window.addEventListener('tournament:registered', registeredHandler);
  window.addEventListener('event:challenge_completed', challengeCompletedHandler);

  eventListeners.push(() => {
    window.removeEventListener('tournament:registered', registeredHandler);
    window.removeEventListener('event:challenge_completed', challengeCompletedHandler);
  });
}

export function stop(): void {
  // Limpiar event listeners
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  
  // Limpiar caché de elementos
  clearCache();
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('torneos');
  if (container) {
    container.innerHTML = '';
  }
}
