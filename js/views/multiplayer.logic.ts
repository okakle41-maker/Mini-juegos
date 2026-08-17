/**
 * Multiplayer View Logic
 * Lógica para la vista de multiplayer en tiempo real
 *
 * Esta vista aloja el Lobby Grupal (hasta 8 jugadores por código, con
 * sub-partidas 1v1 de Simon/Arrow/Termita dentro: crear, listar,
 * unirse como rival o espectador) y el chat/leaderboards globales.
 *
 * Caída de Letras (coop asimétrico 1v1, roles viewer/typer, su propio
 * sistema de salas sobre multiplayerSystem.ts) ya no tiene botón
 * propio acá — se accede, junto con Simon/Arrow/Termita, desde la
 * vista "Lobby Online" (ver views/onlineLobby.logic.ts), a la que se
 * redirige automáticamente al crear/unirse a un lobby grupal (ver
 * showLobbyActive más abajo).
 */

import { multiplayerSystem } from '../multiplayerSystem.js';
import { lobbySystem, type LobbyGameId, type LobbyPlayer } from '../lobbySystem.js';
import { template } from './multiplayer.js';
import { escapeHtml } from '../security.js';
import { hydrateBackButtons } from '../utils/backButton.js';
import { setPending } from '../utils/matchWaitingContext.js';
import { attachCopyButton } from '../utils/copyRoomCode.js';
import { withButtonBusy } from '../utils/buttonBusyGuard.js';
import { runCreateMatchAction } from '../utils/createMatchAction.js';
import { describeMatchError } from '../utils/describeMatchError.js';
import { renderEmptyState, wireMatchActions } from '../utils/matchListRenderer.js';
import { onClickAsync, onClickAsyncVoid } from '../utils/asyncEventHandler.js';

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

const GAME_LABELS: Record<LobbyGameId, string> = {
  simon: 'Simon Dice',
  arrow: 'Desafío Flechas',
  termita: 'Termita'
};

const STATUS_LABELS: Record<LobbyPlayer['status'], string> = {
  idle: 'En el lobby',
  waiting_match: 'Esperando rival',
  playing: 'Jugando',
  spectating: 'Especteando'
};

export function init(): void {
  const container = document.getElementById('multiplayer');
  if (!container) return;

  container.innerHTML = template();
  hydrateBackButtons(container);
  renderConnectionStatus();
  renderLeaderboards();
  setupLobbySection();
  setupChatSection();
  setupMultiplayerListeners();
  setupLobbyListeners();

  // Si ya había un lobby activo (p.ej. se navegó a jugar una sub-partida
  // y se volvió acá), se re-renderiza en vez de mostrar la pantalla de
  // "crear/unirse" de nuevo.
  if (lobbySystem.getCurrentLobby()) {
    showLobbyActive();
  }
}

function renderConnectionStatus(): void {
  const status = getElement('connection-status');
  if (status) {
    const isConnected = multiplayerSystem.isConnectedToServer();
    status.innerHTML = `
      <span class="status-dot ${isConnected ? 'status-dot--online' : 'status-dot--offline'}"></span>
      <span class="status-text">${isConnected ? 'Conectado' : 'Desconectado'}</span>
    `;
  }
}

function renderLeaderboards(): void {
  const leaderboardList = getElement('leaderboard-list');
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

function renderLeaderboardForGame(gameId: string): void {
  const leaderboardList = getElement('leaderboard-list');
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

function showLobbyEntry(): void {
  getElement('lobby-entry')?.classList.remove('hidden');
  getElement('lobby-active')?.classList.add('hidden');
}

function showLobbyActive(): void {
  getElement('lobby-entry')?.classList.add('hidden');
  getElement('lobby-active')?.classList.remove('hidden');
  const lobby = lobbySystem.getCurrentLobby();
  if (lobby) {
    const codeDisplay = getElement('lobby-code-display');
    if (codeDisplay) {
      codeDisplay.textContent = lobby.roomCode;
      attachCopyButton(codeDisplay, 'lobby-code-copy-btn');
    }
  }
  renderLobbyPlayers();
  renderLobbyMatches();
}

function showLobbyError(message: string): void {
  const el = getElement('lobby-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearLobbyError(): void {
  getElement('lobby-error')?.classList.add('hidden');
}

function setupLobbySection(): void {
  const createBtn = getElement('lobby-create-btn') as HTMLButtonElement | null;
  createBtn?.addEventListener('click', onClickAsyncVoid(() => withButtonBusy(createBtn, async () => {
    clearLobbyError();
    try {
      await lobbySystem.createLobby();
      // Se queda en esta vista mostrando el código de sala (lobby-active)
      // en vez de navegar de inmediato a "Lobby Online" — antes eso hacía
      // que el usuario nunca llegara a ver el código, porque la
      // navegación era instantánea y esa otra vista no lo muestra en
      // ningún lado. Ahora el usuario decide cuándo avanzar con el botón
      // "Ir a elegir juego" (ver lobby-go-online-btn más abajo).
      showLobbyActive();
    } catch (e) {
      showLobbyError(describeMatchError(e, 'No se pudo crear el lobby.'));
    }
  })));

  const joinBtn = getElement('lobby-join-btn') as HTMLButtonElement | null;
  joinBtn?.addEventListener('click', onClickAsyncVoid(() => withButtonBusy(joinBtn, async () => {
    clearLobbyError();
    const codeInput = getElement('lobby-join-code') as HTMLInputElement | null;
    const code = codeInput?.value.trim();
    if (!code) return;
    try {
      await lobbySystem.joinLobby(code);
      // Ver comentario equivalente en lobby-create-btn más arriba.
      showLobbyActive();
    } catch (e) {
      showLobbyError(describeMatchError(e, 'No se pudo unir al lobby.'));
    }
  })));

  getElement('lobby-leave-btn')?.addEventListener('click', onClickAsync(async () => {
    await lobbySystem.leaveLobby();
    showLobbyEntry();
  }));

  getElement('lobby-go-online-btn')?.addEventListener('click', () => {
    window.showView?.('online-lobby');
  });

  const createMatchBtn = getElement('lobby-create-match-btn') as HTMLButtonElement | null;
  createMatchBtn?.addEventListener('click', onClickAsyncVoid(() => withButtonBusy(createMatchBtn, () => runCreateMatchAction({
    clearError: clearLobbyError,
    showError: showLobbyError,
    create: () => {
      const select = getElement('lobby-game-select') as HTMLSelectElement | null;
      const gameId = (select?.value ?? 'simon') as LobbyGameId;
      return lobbySystem.createMatch(gameId).then(() => gameId);
    },
    fallbackErrorMessage: 'No se pudo crear la partida.',
    onSuccess: (gameId) => {
      setPending(gameId, 'multiplayer');
      window.showView?.('match-waiting');
    }
  }))));
}

function renderLobbyPlayers(): void {
  const lobby = lobbySystem.getCurrentLobby();
  const list = getElement('lobby-players-list');
  const countEl = getElement('lobby-player-count');
  if (!lobby || !list) return;

  if (countEl) countEl.textContent = String(lobby.players.length);

  list.innerHTML = lobby.players.map((p) => `
    <div class="lobby-player-item">
      <span class="lobby-player-name">${escapeHtml(p.username)}${p.id === lobby.hostId ? ' 👑' : ''}</span>
      <span class="lobby-player-status">${STATUS_LABELS[p.status]}</span>
    </div>
  `).join('');
}

function renderLobbyMatches(): void {
  const list = getElement('lobby-matches-list');
  if (!list) return;
  const matches = lobbySystem.getMatches();
  const myId = lobbySystem.currentPlayerId();
  const lobby = lobbySystem.getCurrentLobby();

  if (renderEmptyState(list, matches.length > 0, '<p class="no-matches">Todavía no hay partidas. ¡Creá una!</p>')) return;

  const usernameById = new Map((lobby?.players ?? []).map((p) => [p.id, p.username]));

  list.innerHTML = matches.map((m) => {
    const p1Name = usernameById.get(m.player1Id) ?? 'Jugador';
    const p2Name = m.player2Id ? (usernameById.get(m.player2Id) ?? 'Jugador') : null;
    const iAmPlayer = m.player1Id === myId || m.player2Id === myId;
    const canJoinAsPlayer = m.status === 'waiting' && !m.player2Id && !iAmPlayer;
    const canSpectate = m.status === 'playing' && !iAmPlayer;
    const canResume = iAmPlayer && (m.status === 'waiting' || m.status === 'playing');

    return `
      <div class="lobby-match-item" data-match-id="${escapeHtml(m.id)}">
        <span class="lobby-match-game">${GAME_LABELS[m.gameId]}</span>
        <span class="lobby-match-players">${escapeHtml(p1Name)}${p2Name ? ` vs ${escapeHtml(p2Name)}` : ' (esperando rival)'}</span>
        <span class="lobby-match-status">${m.status === 'waiting' ? '⏳ Esperando' : '▶️ En curso'}</span>
        ${canResume ? `<button class="lobby-match-resume-btn" data-action="resume" data-game="${m.gameId}">▶️ Volver a mi partida</button>` : ''}
        ${canJoinAsPlayer ? `<button class="lobby-match-join-btn" data-action="join" data-match-id="${escapeHtml(m.id)}" data-game="${m.gameId}">🆚 Unirse como rival</button>` : ''}
        ${canSpectate ? `<button class="lobby-match-spectate-btn" data-action="spectate" data-match-id="${escapeHtml(m.id)}" data-game="${m.gameId}">👁️ Espectar</button>` : ''}
      </div>
    `;
  }).join('');

  wireMatchActions(list, {
    // Esta vista tiene un único slot de error (showLobbyError), no uno
    // por sección como onlineLobby — errorElId no se usa acá, se pasa
    // solo para cumplir la firma compartida.
    errorElId: '',
    showError: (_elId, message) => showLobbyError(message),
    actions: {
      resume: async (btn) => {
        const gameId = btn.dataset.game as LobbyGameId;
        window.showView?.(gameId);
      },
      join: async (btn) => {
        const gameId = btn.dataset.game as LobbyGameId;
        const matchId = btn.dataset.matchId;
        if (!matchId) return;
        await lobbySystem.joinMatchAsPlayer(matchId);
        setPending(gameId, 'multiplayer');
        window.showView?.('match-waiting');
      },
      spectate: async (btn) => {
        const gameId = btn.dataset.game as LobbyGameId;
        const matchId = btn.dataset.matchId;
        if (!matchId) return;
        await lobbySystem.spectateMatch(matchId);
        window.showView?.(gameId);
      }
    }
  });
}

function setupLobbyListeners(): void {
  const playersHandler = () => renderLobbyPlayers();
  const matchesHandler = () => renderLobbyMatches();
  const hostChangedHandler = () => renderLobbyPlayers();

  window.addEventListener('lobby:players_changed', playersHandler);
  window.addEventListener('lobby:matches_changed', matchesHandler);
  window.addEventListener('lobby:match_created', matchesHandler);
  window.addEventListener('lobby:match_joined', matchesHandler);
  window.addEventListener('lobby:match_left', matchesHandler);
  window.addEventListener('lobby:host_changed', hostChangedHandler);

  eventListeners.push(() => {
    window.removeEventListener('lobby:players_changed', playersHandler);
    window.removeEventListener('lobby:matches_changed', matchesHandler);
    window.removeEventListener('lobby:match_created', matchesHandler);
    window.removeEventListener('lobby:match_joined', matchesHandler);
    window.removeEventListener('lobby:match_left', matchesHandler);
    window.removeEventListener('lobby:host_changed', hostChangedHandler);
  });
}

// ── Chat global (sin cambios de fondo) ──────────────────────────────

function setupChatSection(): void {
  getElement('chat-send-btn')?.addEventListener('click', () => {
    const input = getElement('chat-input') as HTMLInputElement | null;
    const message = input?.value.trim();
    if (message) {
      void multiplayerSystem.sendMatchMessage(message).catch((err: unknown) => {
        console.error('[Multiplayer] No se pudo enviar el mensaje de chat:', err);
      });
      input!.value = '';
    }
  });

  document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('leaderboard-tab--active'));
      tab.classList.add('leaderboard-tab--active');
      renderLeaderboardForGame((tab as HTMLElement).dataset.game || 'simon');
    });
  });
}

function setupMultiplayerListeners(): void {
  const leaderboardUpdatedHandler = () => {
    renderLeaderboards();
  };

  window.addEventListener('multiplayer:leaderboard_updated', leaderboardUpdatedHandler);

  eventListeners.push(() => {
    window.removeEventListener('multiplayer:leaderboard_updated', leaderboardUpdatedHandler);
  });
}

export function stop(): void {
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  clearCache();

  // El lobby en sí (a diferencia de la sub-partida, que cada juego
  // libera con lobbySystem.leaveCurrentMatch/completeMatch en su propio
  // stop() — ver simon/arrow/termita .logic.ts) sigue activo del lado
  // del servidor aunque el cliente cierre esta vista — solo se abandona
  // explícitamente con el botón "Salir del lobby" (lobbySystem.leaveLobby
  // no se llama acá a propósito: abandonar el lobby automáticamente al
  // salir de la vista sería agresivo y perdería el lugar en un lobby
  // con amigos por simplemente mirar otra pantalla del menú un momento).
  //
  // La suscripción Realtime a la lista de partidas de Signal
  // Triangulation/Centro de Control ya NO se maneja acá: esta vista dejó
  // de tener sección propia para esos juegos (crear/unirse vive solo en
  // la card de Lobby Online) — ver stopWatchingLobbyMatches() en
  // views/onlineLobby.logic.ts, que ahora es dueña de ese ciclo de vida.

  const container = document.getElementById('multiplayer');
  if (container) {
    container.innerHTML = '';
  }
}
