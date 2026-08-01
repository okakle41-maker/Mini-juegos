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
 * Definición de los campos de dificultad por juego — se usa tanto para
 * generar el HTML del panel dentro del lobby como para leerlo/validarlo.
 * Los límites replican los que cada juego ya aplica en single-player
 * (ver simon.logic.ts/arrowGame.logic.ts/termita.logic.ts) para que una
 * sala nunca quede con parámetros que el juego rechazaría.
 */
type RoomFieldDef =
  | { key: string; label: string; kind: 'number'; min: number; max?: number; step?: number; default: number }
  | { key: string; label: string; kind: 'select'; options: Array<{ value: string; label: string }>; default: string };

const ROOM_FIELDS: Record<string, RoomFieldDef[]> = {
  simon: [
    { key: 'colorCount', label: 'Colores (4-6)', kind: 'number', min: 4, max: 6, default: 4 },
    { key: 'baseLength', label: 'Longitud inicial', kind: 'number', min: 1, default: 3 },
    { key: 'speed', label: 'Velocidad (ms)', kind: 'number', min: 200, max: 2000, step: 100, default: 700 },
    { key: 'rounds', label: 'Rondas', kind: 'number', min: 1, max: 20, default: 5 }
  ],
  arrow: [
    { key: 'steps', label: 'Cantidad de flechas (10-30)', kind: 'number', min: 10, max: 30, default: 20 },
    { key: 'time', label: 'Tiempo (segundos, 5-30)', kind: 'number', min: 5, max: 30, default: 15 }
  ],
  termita: [
    {
      key: 'size', label: 'Tamaño de cuadrícula', kind: 'select', default: '5',
      options: [
        { value: '4', label: '4 por 4' },
        { value: '5', label: '5 por 5' },
        { value: '6', label: '6 por 6' },
        { value: '8', label: '8 por 8' },
        { value: '10', label: '10 por 10' }
      ]
    },
    { key: 'targets', label: 'Objetivos a memorizar', kind: 'number', min: 1, max: 20, default: 4 },
    { key: 'showTime', label: 'Tiempo de exhibición (ms)', kind: 'number', min: 100, step: 100, default: 800 },
    { key: 'rounds', label: 'Rondas', kind: 'number', min: 1, default: 5 }
  ]
};

function fieldElId(gameId: string, key: string): string {
  return `lobby-setting-${gameId}-${key}`;
}

/**
 * Genera el HTML del panel de dificultad dentro del lobby. `readOnly`
 * deshabilita los controles para el jugador que no es el anfitrión —
 * ver isRoomHost en multiplayerSystem.ts.
 */
function renderSettingsPanel(gameId: string, values: Record<string, any>, readOnly: boolean): string {
  const fields = ROOM_FIELDS[gameId];
  if (!fields) return '';

  const rows = fields.map(f => {
    const current = values[f.key] ?? f.default;
    const id = fieldElId(gameId, f.key);
    if (f.kind === 'select') {
      const opts = f.options.map(o =>
        `<option value="${escapeHtml(o.value)}" ${String(current) === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
      ).join('');
      return `<div class="form-group"><label for="${id}">${escapeHtml(f.label)}</label><select id="${id}" ${readOnly ? 'disabled' : ''}>${opts}</select></div>`;
    }
    const minAttr = f.min !== undefined ? `min="${f.min}"` : '';
    const maxAttr = f.max !== undefined ? `max="${f.max}"` : '';
    const stepAttr = f.step !== undefined ? `step="${f.step}"` : '';
    return `<div class="form-group"><label for="${id}">${escapeHtml(f.label)}</label><input type="number" id="${id}" ${minAttr} ${maxAttr} ${stepAttr} value="${escapeHtml(String(current))}" ${readOnly ? 'disabled' : ''}></div>`;
  }).join('');

  return `
    <div class="room-settings ${readOnly ? 'room-settings-readonly' : ''}">
      <p class="room-settings-title">${readOnly ? 'Dificultad (fijada por el anfitrión)' : 'Dificultad (aplica a ambos jugadores)'}</p>
      ${rows}
    </div>
  `;
}

/**
 * Lee los valores actuales del panel de dificultad renderizado en el
 * lobby, clampeados a los mismos límites que el juego real acepta.
 */
function readSettingsPanel(gameId: string): Record<string, any> {
  const fields = ROOM_FIELDS[gameId];
  if (!fields) return {};
  const result: Record<string, any> = {};
  for (const f of fields) {
    const el = document.getElementById(fieldElId(gameId, f.key)) as HTMLInputElement | HTMLSelectElement | null;
    if (f.kind === 'select') {
      const validValues = f.options.map(o => o.value);
      const val = el?.value;
      result[f.key] = validValues.includes(val || '') ? val : f.default;
      // termita.logic.ts espera `size` como number, no string.
      if (gameId === 'termita' && f.key === 'size') result[f.key] = Number(result[f.key]);
    } else {
      const raw = parseFloat(el?.value ?? '');
      let v = Number.isFinite(raw) ? raw : f.default;
      v = Math.max(f.min, v);
      if (f.max !== undefined) v = Math.min(f.max, v);
      result[f.key] = v;
    }
  }
  return result;
}

function defaultSettingsFor(gameId: string): Record<string, any> {
  const fields = ROOM_FIELDS[gameId];
  if (!fields) return {};
  const result: Record<string, any> = {};
  for (const f of fields) {
    result[f.key] = f.kind === 'select' ? Number(f.default) || f.default : f.default;
  }
  return result;
}

let stopLobbyRoomWatch: (() => void) | null = null;
let lobbySettingsDebounce: ReturnType<typeof setTimeout> | null = null;

/**
 * Muestra el lobby de la sala recién creada/unida y engancha toda su
 * interactividad: dificultad editable solo para el anfitrión (ver
 * isRoomHost), botón de inicio que solo el anfitrión ve, y
 * actualización en vivo cuando cambia algo del lado del servidor
 * (se une el segundo jugador, el anfitrión cambia la dificultad, o
 * arranca la partida).
 */
function enterLobby(match: any): void {
  document.getElementById('room-lobby-section')!.style.display = 'block';
  document.getElementById('lobby-room-code')!.textContent = match.roomCode || '';

  renderLobby(match);

  stopLobbyRoomWatch?.();
  stopLobbyRoomWatch = multiplayerSystem.onRoomUpdate(match.id, (updated) => {
    if (updated.status === 'abandoned') {
      stopLobbyRoomWatch?.();
      stopLobbyRoomWatch = null;
      document.getElementById('room-lobby-section')!.style.display = 'none';
      alert('La sala fue abandonada.');
      return;
    }
    renderLobby(updated);
    if (updated.status === 'playing') {
      stopLobbyRoomWatch?.();
      stopLobbyRoomWatch = null;
      document.getElementById('room-lobby-section')!.style.display = 'none';
      navigateToGame(updated.gameId);
    }
  });
}

function renderLobby(match: any): void {
  const isHost = multiplayerSystem.isRoomHost(match);
  const gameId = match.gameId;

  document.getElementById('lobby-players-count')!.textContent = `${match.players.length}/2 jugadores`;

  const container = document.getElementById('lobby-settings-container');
  if (container) {
    // No pisar lo que el anfitrión está tipeando: si es el host y ya
    // hay inputs montados, solo actualizar el estado de otros
    // elementos (conteo de jugadores, botón), no re-renderizar el panel
    // entero en cada evento — evitaría que el cursor salte mientras
    // escribe. Como anfitrión, el panel se monta una sola vez.
    if (!isHost || container.childElementCount === 0) {
      container.innerHTML = renderSettingsPanel(gameId, match.settings || {}, !isHost);
      if (isHost) attachHostSettingsListeners(match.id, gameId);
    }
  }

  const hostHint = document.getElementById('lobby-host-hint')!;
  const guestHint = document.getElementById('lobby-guest-hint')!;
  const startBtn = document.getElementById('lobby-start-btn') as HTMLButtonElement;

  hostHint.style.display = isHost ? 'block' : 'none';
  guestHint.style.display = isHost ? 'none' : 'block';
  startBtn.style.display = isHost ? 'inline-block' : 'none';
  startBtn.disabled = match.players.length < 2;
}

/**
 * Cada cambio en un input de dificultad del anfitrión se persiste a la
 * sala (debounced, para no golpear la base en cada tecla) — así el
 * invitado ve la dificultad actualizarse en vivo vía onRoomUpdate.
 */
function attachHostSettingsListeners(matchId: string, gameId: string): void {
  const fields = ROOM_FIELDS[gameId];
  if (!fields) return;
  fields.forEach(f => {
    const el = document.getElementById(fieldElId(gameId, f.key));
    el?.addEventListener('input', () => {
      if (lobbySettingsDebounce) clearTimeout(lobbySettingsDebounce);
      lobbySettingsDebounce = setTimeout(() => {
        const settings = readSettingsPanel(gameId);
        multiplayerSystem.updateRoomSettings(matchId, settings).catch(() => {});
      }, 400);
    });
  });
}

function setupLobbyControls(): void {
  document.getElementById('lobby-start-btn')?.addEventListener('click', async () => {
    const match = multiplayerSystem.getCurrentMatch();
    if (!match) return;
    try {
      await multiplayerSystem.startRoomMatch(match.id);
      // El propio anfitrión también navega al confirmar: onRoomUpdate
      // igual lo hubiera hecho al recibir su propio UPDATE, pero no
      // conviene esperar ese round-trip para el que hizo la acción.
      stopLobbyRoomWatch?.();
      stopLobbyRoomWatch = null;
      document.getElementById('room-lobby-section')!.style.display = 'none';
      navigateToGame(match.gameId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo iniciar la partida');
    }
  });

  document.getElementById('lobby-leave-btn')?.addEventListener('click', async () => {
    stopLobbyRoomWatch?.();
    stopLobbyRoomWatch = null;
    document.getElementById('room-lobby-section')!.style.display = 'none';
    await multiplayerSystem.leaveRoomMatch().catch(() => {});
  });
}

function setupEventListeners(): void {
  setupLobbyControls();

  // Crear sala
  document.getElementById('create-room-btn')?.addEventListener('click', async () => {
    const gameId = (document.getElementById('room-game-select') as HTMLSelectElement).value;

    // Letters Fall es coop asimétrico (roles viewer/typer, no "player"
    // genérico) y ya tiene su propia pantalla de crear/unirse sala
    // dentro del juego, donde el viewer fija la dificultad para ambos.
    // Crear una sala genérica desde esta vista generaría una fila de
    // live_matches incompatible con lo que espera lettersFall.logic.ts
    // (sin rol asignado) — mejor redirigir al flujo nativo que duplicar
    // la lógica de sala.
    if (gameId === 'letters') {
      window.showView?.('letters');
      return;
    }

    try {
      // La sala se crea con la dificultad por defecto de cada juego; el
      // anfitrión la ajusta después, ya dentro del lobby (ver
      // enterLobby), no antes de crear la sala.
      const defaults = defaultSettingsFor(gameId);
      const match = await multiplayerSystem.createRoomMatch(gameId, 'player', defaults);
      enterLobby(match);
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
      // autoStart=false: la sala queda en el lobby hasta que el
      // anfitrión la arranque, no al conectarse el segundo jugador.
      const match = await multiplayerSystem.joinRoomMatch(gameId, code, 'player', false);
      enterLobby(match);
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

  window.addEventListener('multiplayer:score_updated', scoreUpdatedHandler);
  window.addEventListener('multiplayer:leaderboard_updated', leaderboardUpdatedHandler);
  window.addEventListener('multiplayer:spectating_started', spectatingStartedHandler);

  eventListeners.push(() => {
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

/**
 * true mientras navegamos deliberadamente hacia el juego porque la
 * partida arrancó (por el propio anfitrión o porque onRoomUpdate
 * detectó status:'playing') — en ese caso stop() no debe abandonar la
 * sala que el juego está a punto de usar. Se resetea apenas se sale.
 */
let leavingToPlay = false;

function navigateToGame(gameId: string): void {
  leavingToPlay = true;
  window.showView?.(gameId);
}

export function stop(): void {
  // Limpiar event listeners
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  
  // Limpiar caché de elementos
  clearCache();

  stopLobbyRoomWatch?.();
  stopLobbyRoomWatch = null;

  // Si el jugador creó o se unió a una sala desde esta vista y la deja
  // sin ir a jugar (navega a otra sección del menú), la sala quedaba
  // "waiting"/"playing" para siempre — nadie más la marcaba abandonada.
  // No se toca si estamos saliendo porque la partida arrancó (ver
  // navigateToGame) ni si el juego real ya tomó la sala
  // (lettersFall.logic.ts gestiona su propio leaveRoomMatch() al
  // terminar la partida).
  if (!leavingToPlay && multiplayerSystem.getCurrentMatch()) {
    multiplayerSystem.leaveRoomMatch().catch(() => {});
  }
  leavingToPlay = false;
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('multiplayer');
  if (container) {
    container.innerHTML = '';
  }
}
