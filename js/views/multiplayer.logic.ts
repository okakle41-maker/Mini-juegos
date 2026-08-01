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

/**
 * Lee del panel de dificultad correspondiente los valores que el
 * creador de la sala fija para ambos jugadores. Los clamps replican los
 * mismos límites que cada juego ya aplica en single-player (ver
 * simon.logic.ts/arrowGame.logic.ts/termita.logic.ts/lettersFall.logic.ts)
 * para que una sala nunca quede con parámetros que el juego rechazaría.
 */
function readRoomSettings(gameId: string): Record<string, any> {
  const num = (id: string, fallback: number) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    const v = parseFloat(el?.value ?? '');
    return Number.isFinite(v) ? v : fallback;
  };

  switch (gameId) {
    case 'simon':
      return {
        colorCount: Math.max(4, Math.min(num('room-simon-colors', 4), 6)),
        baseLength: Math.max(1, num('room-simon-baselength', 3)),
        speed: Math.max(200, Math.min(num('room-simon-speed', 700), 2000)),
        rounds: Math.max(1, Math.min(num('room-simon-rounds', 5), 20))
      };
    case 'arrow':
      return {
        steps: Math.max(10, Math.min(num('room-arrow-steps', 20), 30)),
        time: Math.max(5, Math.min(num('room-arrow-time', 15), 30))
      };
    case 'termita': {
      const validSizes = [4, 5, 6, 8, 10];
      const rawSize = num('room-termita-size', 5);
      const size = validSizes.includes(rawSize) ? rawSize : 5;
      return {
        size,
        targets: Math.max(1, num('room-termita-targets', 4)),
        showTime: Math.max(100, num('room-termita-showtime', 800)),
        rounds: Math.max(1, num('room-termita-rounds', 5))
      };
    }
    default:
      return {};
  }
}

function setupEventListeners(): void {
  // Mostrar el panel de dificultad del juego elegido
  const roomGameSelect = document.getElementById('room-game-select') as HTMLSelectElement | null;
  const toggleRoomSettings = () => {
    const gameId = roomGameSelect?.value || 'simon';
    ['simon', 'arrow', 'termita', 'letters'].forEach(g => {
      const panel = document.getElementById(`room-settings-${g}`);
      if (panel) panel.style.display = g === gameId ? 'block' : 'none';
    });
  };
  roomGameSelect?.addEventListener('change', toggleRoomSettings);
  toggleRoomSettings();

  // Crear sala
  document.getElementById('create-room-btn')?.addEventListener('click', async () => {
    const gameId = (document.getElementById('room-game-select') as HTMLSelectElement).value;

    // Letters Fall es coop asimétrico (roles viewer/typer, no "player"
    // genérico) y ya tiene su propia pantalla de crear/unirse sala
    // dentro del juego, donde el viewer fija la dificultad para ambos
    // igual que acá. Crear una sala genérica desde esta vista generaría
    // una fila de live_matches incompatible con lo que espera
    // lettersFall.logic.ts (sin rol asignado) — mejor redirigir al
    // flujo nativo que duplicar la lógica de sala.
    if (gameId === 'letters') {
      window.showView?.('letters');
      return;
    }

    try {
      const settings = readRoomSettings(gameId);
      const match = await multiplayerSystem.createRoomMatch(gameId, 'player', settings);
      document.getElementById('room-code-display')!.textContent = match.roomCode || '';
      document.getElementById('room-created-status')!.style.display = 'block';
      document.getElementById('current-match-section')!.style.display = 'block';
      renderCurrentMatch(match);

      // Los juegos con vista propia (simon/arrow/termita) solo saben
      // leer el match activo al arrancar su init() — hay que navegar a
      // esa vista recién cuando se une el segundo jugador, no antes
      // (si el creador entrara ya, quedaría esperando dentro del juego
      // sin feedback de "esperando rival" que sí tiene esta vista).
      const stopWatching = multiplayerSystem.onRoomUpdate(match.id, (updated) => {
        if (updated.players.length >= 2) {
          stopWatching();
          window.showView?.(gameId);
        }
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo crear la sala');
    }
  });

  // Unirse a sala
  document.getElementById('join-room-btn')?.addEventListener('click', async () => {
    const gameId = (document.getElementById('room-game-select') as HTMLSelectElement).value;
    const code = (document.getElementById('join-room-code') as HTMLInputElement).value;

    if (gameId === 'letters') {
      window.showView?.('letters');
      return;
    }

    if (!code.trim()) return;
    try {
      const match = await multiplayerSystem.joinRoomMatch(gameId, code, 'player');
      document.getElementById('current-match-section')!.style.display = 'block';
      renderCurrentMatch(match);
      window.showView?.(gameId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo unir a la sala');
    }
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
      const match = await multiplayerSystem.spectateMatch(matchId);
      if (!match) {
        alert('No se encontró esa partida.');
      }
    }
  });

  // Actualizar listado de partidas activas al abrir la vista
  renderActiveMatches();

  // Leaderboard tabs
  document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('leaderboard-tab--active'));
      tab.classList.add('leaderboard-tab--active');
      renderLeaderboardForGame((tab as HTMLElement).dataset.game || 'simon');
    });
  });
}

async function renderActiveMatches(): Promise<void> {
  const container = document.getElementById('active-matches');
  if (!container) return;
  const list = container.querySelector('.matches-list') || container;

  const matches = await multiplayerSystem.listActiveMatches();
  if (matches.length === 0) {
    list.innerHTML = '<p class="no-matches">No hay partidas activas ahora mismo</p>';
    return;
  }

  list.innerHTML = matches.map(m => `
    <div class="match-list-item">
      <span class="match-list-game">${escapeHtml(m.gameId)}</span>
      <span class="match-list-status">${m.status === 'waiting' ? '⏳ Esperando' : '▶️ En curso'}</span>
      <span class="match-list-players">${m.players.length}/2 jugadores</span>
      <button class="spectate-list-btn" data-match-id="${escapeHtml(m.id)}">👁️ Ver</button>
    </div>
  `).join('');

  list.querySelectorAll('.spectate-list-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matchId = (btn as HTMLElement).dataset.matchId;
      if (matchId) await multiplayerSystem.spectateMatch(matchId);
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
  const matchStartedHandler = () => {
    alert('¡La partida ha comenzado!');
  };
  const scoreUpdatedHandler = (e: any) => {
    updateMatchScores(e.detail);
  };
  const leaderboardUpdatedHandler = () => {
    renderLeaderboards();
  };
  const spectatingStartedHandler = (e: any) => {
    document.getElementById('current-match-section')!.style.display = 'block';
    renderCurrentMatch(e.detail.match);
  };

  window.addEventListener('multiplayer:match_started', matchStartedHandler);
  window.addEventListener('multiplayer:score_updated', scoreUpdatedHandler);
  window.addEventListener('multiplayer:leaderboard_updated', leaderboardUpdatedHandler);
  window.addEventListener('multiplayer:spectating_started', spectatingStartedHandler);

  eventListeners.push(() => {
    window.removeEventListener('multiplayer:match_started', matchStartedHandler);
    window.removeEventListener('multiplayer:score_updated', scoreUpdatedHandler);
    window.removeEventListener('multiplayer:leaderboard_updated', leaderboardUpdatedHandler);
    window.removeEventListener('multiplayer:spectating_started', spectatingStartedHandler);
  });
}

function renderCurrentMatch(match: any): void {
  document.getElementById('player1-name')!.textContent = match.players[0]?.name || 'Jugador 1';
  document.getElementById('player2-name')!.textContent = match.players[1]?.name || 'Esperando...';
  document.getElementById('player1-avatar')!.textContent = match.players[0]?.avatar || '👤';
  document.getElementById('player2-avatar')!.textContent = match.players[1]?.avatar || '⏳';
}

function updateMatchScores(data: ScoreEventDetail): void {
  // multiplayer:score_updated siempre trae el id real del jugador que
  // reportó el score (multiplayerSystem.playerStatus.id, del estilo
  // `player_<timestamp>_<random>`) — nunca el literal 'current_player'
  // (eso no existe en ningún punto de multiplayerSystem.ts). Comparar
  // contra ese literal hacía que el propio score nunca actualizara
  // player1-score y siempre cayera en player2-score.
  const ownId = multiplayerSystem.getPlayerStatus()?.id;
  if (ownId && data.playerId === ownId) {
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

  // Si el jugador creó o se unió a una sala desde esta vista y la deja
  // sin ir a jugar (navega a otra sección del menú), la sala quedaba
  // "waiting"/"playing" para siempre — nadie más la marcaba abandonada.
  // No se toca si el juego real ya tomó la sala (lettersFall.logic.ts
  // gestiona su propio leaveRoomMatch() al terminar la partida): acá
  // solo limpiamos si currentMatch sigue siendo la sala que se ve en
  // esta pantalla, no una en curso dentro de un juego.
  if (multiplayerSystem.getCurrentMatch()) {
    multiplayerSystem.leaveRoomMatch().catch(() => {});
  }
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('multiplayer');
  if (container) {
    container.innerHTML = '';
  }
}
