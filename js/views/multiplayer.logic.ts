/**
 * Multiplayer View Logic
 * Lógica para la vista de multiplayer en tiempo real
 */

import { multiplayerSystem } from '../multiplayerSystem.js';
import type { MatchEventDetail, ScoreEventDetail } from '../types/game';
import { template } from './multiplayer.js';
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
  const container = document.getElementById('multiplayer');
  if (!container) return;

  container.innerHTML = template();
  renderConnectionStatus();
  renderLeaderboards();
  setupEventListeners();
  setupMultiplayerListeners();
}

function renderConnectionStatus(): void {
  const status = document.getElementById('connection-status');
  if (status) {
    const isConnected = multiplayerSystem.isConnectedToServer();
    status.innerHTML = `
      <span class="status-dot ${isConnected ? 'status-dot--online' : 'status-dot--offline'}"></span>
      <span class="status-text">${isConnected ? 'Conectado' : 'Desconectado'}</span>
    `;
  }
}

function renderLeaderboards(): void {
  const leaderboardList = document.getElementById('leaderboard-list');
  if (leaderboardList) {
    const leaderboards = multiplayerSystem.getAllLeaderboards();
    const firstGame = leaderboards.keys().next().value;
    const entries = firstGame ? leaderboards.get(firstGame) || [] : [];
    
    leaderboardList.innerHTML = entries.slice(0, 10).map((entry, index) => `
      <div class="leaderboard-entry ${index < 3 ? 'leaderboard-entry--top' : ''}">
        <span class="entry-rank">#${index + 1}</span>
        <span class="entry-name">${escapeHtml(entry.playerName)}</span>
        <span class="entry-score">${entry.score}</span>
      </div>
    `).join('');
  }
}

function setupEventListeners(): void {
  // Buscar partida
  document.getElementById('find-match-btn')?.addEventListener('click', async () => {
    const gameId = (document.getElementById('match-game-select') as HTMLSelectElement).value;
    const skillLevel = parseInt((document.getElementById('match-skill-select') as HTMLSelectElement).value);
    
    try {
      await multiplayerSystem.joinMatchmaking(gameId, skillLevel);
      document.getElementById('matchmaking-status')!.style.display = 'block';
      document.getElementById('find-match-btn')!.style.display = 'none';
      document.getElementById('cancel-match-btn')!.style.display = 'block';
    } catch (e) {
      alert('Error al buscar partida');
    }
  });

  // Cancelar búsqueda
  document.getElementById('cancel-match-btn')?.addEventListener('click', async () => {
    await multiplayerSystem.leaveMatchmaking();
    document.getElementById('matchmaking-status')!.style.display = 'none';
    document.getElementById('find-match-btn')!.style.display = 'block';
    document.getElementById('cancel-match-btn')!.style.display = 'none';
  });

  // Enviar mensaje de chat
  document.getElementById('chat-send-btn')?.addEventListener('click', () => {
    const input = document.getElementById('chat-input') as HTMLInputElement;
    const message = input.value.trim();
    if (message) {
      multiplayerSystem.sendMatchMessage(message);
      input.value = '';
    }
  });

  // Espectador
  document.getElementById('spectate-btn')?.addEventListener('click', async () => {
    const matchId = (document.getElementById('spectator-match-id') as HTMLInputElement).value;
    if (matchId) {
      await multiplayerSystem.spectateMatch(matchId);
    }
  });

  // Leaderboard tabs
  document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('leaderboard-tab--active'));
      tab.classList.add('leaderboard-tab--active');
      renderLeaderboardForGame((tab as HTMLElement).dataset.game || 'simon');
    });
  });
}

function renderLeaderboardForGame(gameId: string): void {
  const leaderboardList = document.getElementById('leaderboard-list');
  if (leaderboardList) {
    const entries = multiplayerSystem.getLeaderboard(gameId);
    
    leaderboardList.innerHTML = entries.slice(0, 10).map((entry, index) => `
      <div class="leaderboard-entry ${index < 3 ? 'leaderboard-entry--top' : ''}">
        <span class="entry-rank">#${index + 1}</span>
        <span class="entry-name">${escapeHtml(entry.playerName)}</span>
        <span class="entry-score">${entry.score}</span>
      </div>
    `).join('');
  }
}

function setupMultiplayerListeners(): void {
  const matchFoundHandler = (e: any) => {
    document.getElementById('matchmaking-status')!.style.display = 'none';
    document.getElementById('current-match-section')!.style.display = 'block';
    renderCurrentMatch(e.detail.match);
  };
  const matchStartedHandler = () => {
    alert('¡La partida ha comenzado!');
  };
  const scoreUpdatedHandler = (e: any) => {
    updateMatchScores(e.detail);
  };
  const leaderboardUpdatedHandler = () => {
    renderLeaderboards();
  };

  window.addEventListener('multiplayer:match_found', matchFoundHandler);
  window.addEventListener('multiplayer:match_started', matchStartedHandler);
  window.addEventListener('multiplayer:score_updated', scoreUpdatedHandler);
  window.addEventListener('multiplayer:leaderboard_updated', leaderboardUpdatedHandler);

  eventListeners.push(() => {
    window.removeEventListener('multiplayer:match_found', matchFoundHandler);
    window.removeEventListener('multiplayer:match_started', matchStartedHandler);
    window.removeEventListener('multiplayer:score_updated', scoreUpdatedHandler);
    window.removeEventListener('multiplayer:leaderboard_updated', leaderboardUpdatedHandler);
  });
}

function renderCurrentMatch(match: any): void {
  document.getElementById('player1-name')!.textContent = match.players[0].name;
  document.getElementById('player2-name')!.textContent = match.players[1].name;
  document.getElementById('player1-avatar')!.textContent = match.players[0].avatar;
  document.getElementById('player2-avatar')!.textContent = match.players[1].avatar;
}

function updateMatchScores(data: ScoreEventDetail): void {
  if (data.playerId === 'current_player') {
    document.getElementById('player1-score')!.textContent = data.score.toString();
  } else {
    document.getElementById('player2-score')!.textContent = data.score.toString();
  }
}

export function stop(): void {
  // Limpiar event listeners
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  
  // Limpiar caché de elementos
  clearCache();
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('multiplayer');
  if (container) {
    container.innerHTML = '';
  }
}
