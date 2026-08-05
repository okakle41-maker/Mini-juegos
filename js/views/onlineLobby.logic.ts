/**
 * js/views/onlineLobby.logic.ts
 *
 * Lógica de la vista "Lobby Online" (ver views/onlineLobby.ts para el
 * template). Reusa por completo el motor de tarjetas de
 * LobbyRenderer, pasándole los ids de contenedores propios de esta
 * vista (onlineGameList/onlineFilterBar, sin módulo del día),
 * GameRegistry.visibleOnline() como lista de juegos y un callback
 * onCardClick que intercepta las cards para abrir un modal de
 * configuración previa en vez de navegar directo — ver GameConfig.online
 * en core/gameRegistry.ts para qué juegos entran ahí (hoy: simon, arrow,
 * termita, letters, signal_triangulation, ship_control). El modal tiene
 * tres secciones posibles según el juego: olConfigLobbySection (1v1:
 * simon/arrow/termita — crear/unirse como rival/espectar, vía
 * lobbySystem), olConfigStSection (Signal Triangulation) y
 * olConfigScSection (Centro de Control, con selector de rol). Excepción:
 * Letters Fall (SELF_MANAGED_ROOM_GAMES) navega directo, ya maneja su
 * propio panel de sala dentro de su propia vista.
 */

import LobbyRenderer from '../lobbyRenderer.js';
import GameRegistry, { type GameConfig } from '../core/gameRegistry.js';
import { lobbySystem, type LobbyGameId, type LobbyMatch } from '../lobbySystem.js';
import { signalTriangulationSystem, type STMatch, type STSlot } from '../signalTriangulationSystem.js';
import { shipControlSystem, type SCMatch, type SCRole } from '../shipControlSystem.js';
import { fragmentedLabyrinthSystem, type FLMatch, type FLRole, ROLE_DESCRIPTIONS as FL_ROLE_DESCRIPTIONS } from '../fragmentedLabyrinthSystem.js';
import Auth from '../authManager.js';
import { escapeHtml } from '../security.js';
import template from './onlineLobby.js';
import { hydrateBackButtons } from '../utils/backButton.js';
import { setPending } from '../utils/matchWaitingContext.js';
import { attachCopyButton } from '../utils/copyRoomCode.js';
import { withButtonBusy } from '../utils/buttonBusyGuard.js';
import { runCreateMatchAction } from '../utils/createMatchAction.js';
import { describeMatchError } from '../utils/describeMatchError.js';

export function init(): void {
  const container = document.getElementById('online-lobby');
  if (!container) return;

  container.innerHTML = template();
  hydrateBackButtons(container);

  LobbyRenderer.render({
    gridId: 'onlineGameList',
    filterBarId: 'onlineFilterBar',
    moduleOfDayId: null,
    headerCountIds: ['onlineModsCountPill'],
    games: GameRegistry.visibleOnline(),
    onCardClick: handleCardClick
  });

  renderLobbyCodeBadge();
  setupConfigModal();
  setupMatchesListeners();
}

/** Juegos 1v1 que corren sobre lobbySystem (sub-partidas del lobby grupal). */
const LOBBY_1V1_GAMES: ReadonlySet<string> = new Set<LobbyGameId>(['simon', 'arrow', 'termita']);

const LOBBY_GAME_LABELS: Record<LobbyGameId, { icon: string; name: string }> = {
  simon: { icon: '🧠', name: 'Simon Dice' },
  arrow: { icon: '🏹', name: 'Desafío Flechas' },
  termita: { icon: '🐜', name: 'Termita' }
};

const ST_ANTENNA_LABEL: Record<STSlot, string> = {
  1: '(0,0)',
  2: '(9,0)',
  3: '(9,9)',
  4: '(0,9)'
};

const SC_ROLE_LABELS: Record<SCRole, string> = {
  navigation: '🧭 Navegación',
  sensors: '📡 Sensores',
  energy: '⚡ Energía',
  comms: '📻 Comunicaciones'
};
const ALL_SC_ROLES: SCRole[] = ['navigation', 'sensors', 'energy', 'comms'];
const ALL_FL_ROLES: FLRole[] = ['A', 'B', 'C', 'D'];

/**
 * Juegos que manejan su propio flujo de sala DENTRO de su propia vista
 * (panel "Solo/Crear sala/Unirse" al entrar) en vez de a través de este
 * modal — hoy solo Letters Fall, sobre multiplayerSystem (código de
 * sala directo, ver views/letters.ts/lettersFall.logic.ts). Navegan
 * directo como el resto de los juegos NO-online del catálogo; no tienen
 * relación con lobbySystem/ST/SC ni con el lobby grupal de esta vista.
 */
const SELF_MANAGED_ROOM_GAMES: ReadonlySet<string> = new Set(['letters']);

function handleCardClick(game: GameConfig): void {
  if (SELF_MANAGED_ROOM_GAMES.has(game.id)) {
    window.showView?.(game.id);
    return;
  }
  // El resto (1v1 vía lobbySystem o cooperativos de 4 vía ST/SC) pasa
  // por el modal de crear/unirse/espectar.
  openConfigModal(game.id);
}

// ── Modal de configuración ─────────────────────────────────────────

let cachedModalEls: Record<string, HTMLElement | null> = {};
let modalBound = false;
let escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function modalEl(id: string): HTMLElement | null {
  if (!cachedModalEls[id]) {
    cachedModalEls[id] = document.getElementById(id);
  }
  return cachedModalEls[id];
}

function setupConfigModal(): void {
  if (modalBound) return;
  modalBound = true;
  cachedModalEls = {};

  modalEl('olConfigModalClose')?.addEventListener('click', closeConfigModal);
  modalEl('olConfigModalOverlay')?.addEventListener('click', (e) => {
    if (e.target === modalEl('olConfigModalOverlay')) closeConfigModal();
  });

  // Signal Triangulation: crear partida
  const stCreateBtn = modalEl('olConfigStCreateBtn') as HTMLButtonElement | null;
  stCreateBtn?.addEventListener('click', () => withButtonBusy(stCreateBtn, () => runCreateMatchAction({
    clearError: () => clearConfigError('olConfigStError'),
    showError: (msg) => showConfigError('olConfigStError', msg),
    checkEligibility: () => signalTriangulationSystem.isPlayerEligible()
      ? null
      : 'Necesitás iniciar sesión para crear una partida de Signal Triangulation.',
    create: () => signalTriangulationSystem.createMatch(),
    fallbackErrorMessage: 'No se pudo crear la partida.',
    onSuccess: () => {
      closeConfigModal();
      setPending('signal_triangulation', 'online-lobby');
      window.showView?.('match-waiting');
    }
  })));

  // Fragmented Labyrinth: crear partida (quien crea ocupa el rol A)
  const flCreateBtn = modalEl('olConfigFlCreateBtn') as HTMLButtonElement | null;
  flCreateBtn?.addEventListener('click', () => withButtonBusy(flCreateBtn, () => runCreateMatchAction({
    clearError: () => clearConfigError('olConfigFlError'),
    showError: (msg) => showConfigError('olConfigFlError', msg),
    checkEligibility: () => fragmentedLabyrinthSystem.isPlayerEligible()
      ? null
      : 'Necesitás iniciar sesión para crear una partida de Fragmented Labyrinth.',
    create: () => fragmentedLabyrinthSystem.createMatch(),
    fallbackErrorMessage: 'No se pudo crear la partida.',
    onSuccess: () => {
      closeConfigModal();
      setPending('fragmented_labyrinth', 'online-lobby');
      window.showView?.('match-waiting');
    }
  })));

  // Centro de Control: elegir rol para crear
  modalEl('olConfigScRolePicker')?.addEventListener('click', async (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.ol-modal-role-btn[data-role]');
    if (!btn) return;
    await withButtonBusy(btn, () => runCreateMatchAction({
      clearError: () => clearConfigError('olConfigScError'),
      showError: (msg) => showConfigError('olConfigScError', msg),
      checkEligibility: () => shipControlSystem.isPlayerEligible()
        ? null
        : 'Necesitás iniciar sesión para crear una partida de Centro de Control.',
      create: () => shipControlSystem.createMatch(btn.dataset.role as SCRole),
      fallbackErrorMessage: 'No se pudo crear la partida.',
      onSuccess: () => {
        closeConfigModal();
        setPending('ship_control', 'online-lobby');
        window.showView?.('match-waiting');
      }
    }));
  });

  // Simon/Arrow/Termita: crear partida 1v1
  const lobbyCreateBtn = modalEl('olConfigLobbyCreateBtn') as HTMLButtonElement | null;
  lobbyCreateBtn?.addEventListener('click', () => withButtonBusy(lobbyCreateBtn, async () => {
    // Guard silencioso, no un error mostrable (no debería poder pasar:
    // el botón vive dentro de olConfigLobbySection, que solo se muestra
    // tras haber seteado currentLobbyGameId al abrir el modal) — se
    // mantiene fuera de runCreateMatchAction porque esa función siempre
    // muestra el resultado de checkEligibility, y acá directamente no
    // hay nada que crear ni que decirle al jugador.
    if (!currentLobbyGameId) return;
    const gameId = currentLobbyGameId;
    await runCreateMatchAction({
      clearError: () => clearConfigError('olConfigLobbyError'),
      showError: (msg) => showConfigError('olConfigLobbyError', msg),
      checkEligibility: () => lobbySystem.getCurrentLobby()
        ? null
        : 'Necesitás estar en un lobby grupal para crear una partida.',
      create: () => lobbySystem.createMatch(gameId),
      fallbackErrorMessage: 'No se pudo crear la partida.',
      onSuccess: () => {
        closeConfigModal();
        setPending(gameId, 'online-lobby');
        window.showView?.('match-waiting');
      }
    });
  }));

  // Se registra una sola vez en todo el ciclo de vida de la app para no
  // acumular listeners duplicados cada vez que se entra a la vista.
  if (!escapeKeyHandler) {
    escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfigModal();
    };
    document.addEventListener('keydown', escapeKeyHandler);
  }
}

let currentLobbyGameId: LobbyGameId | null = null;

function openConfigModal(gameId: string): void {
  const overlay = modalEl('olConfigModalOverlay');
  if (!overlay) return;

  const stSection = modalEl('olConfigStSection');
  const scSection = modalEl('olConfigScSection');
  const flSection = modalEl('olConfigFlSection');
  const lobbySection = modalEl('olConfigLobbySection');
  const title = modalEl('olConfigModalTitle');
  const desc = modalEl('olConfigModalDesc');
  const icon = modalEl('olConfigModalIcon');

  clearConfigError('olConfigStError');
  clearConfigError('olConfigScError');
  clearConfigError('olConfigFlError');
  clearConfigError('olConfigLobbyError');
  currentLobbyGameId = null;

  if (gameId === 'signal_triangulation') {
    stSection?.classList.remove('hidden');
    scSection?.classList.add('hidden');
    flSection?.classList.add('hidden');
    lobbySection?.classList.add('hidden');
    if (icon) icon.textContent = '📡';
    if (title) title.textContent = 'Signal Triangulation';
    if (desc) desc.textContent = 'Configurá tu partida cooperativa de 4 jugadores.';
    void signalTriangulationSystem.loadLobbyMatches().then(() => renderStMatches());
  } else if (gameId === 'ship_control') {
    stSection?.classList.add('hidden');
    scSection?.classList.remove('hidden');
    flSection?.classList.add('hidden');
    lobbySection?.classList.add('hidden');
    if (icon) icon.textContent = '🚀';
    if (title) title.textContent = 'Centro de Control';
    if (desc) desc.textContent = 'Elegí tu rol para crear la partida cooperativa.';
    void shipControlSystem.loadLobbyMatches().then(() => renderScMatches());
  } else if (gameId === 'fragmented_labyrinth') {
    stSection?.classList.add('hidden');
    scSection?.classList.add('hidden');
    flSection?.classList.remove('hidden');
    lobbySection?.classList.add('hidden');
    if (icon) icon.textContent = '🌀';
    if (title) title.textContent = 'Fragmented Labyrinth';
    if (desc) desc.textContent = 'Creá la partida (rol A) o unite a una que ya esté esperando jugadores.';
    void fragmentedLabyrinthSystem.loadLobbyMatches().then(() => renderFlMatches());
  } else if (LOBBY_1V1_GAMES.has(gameId)) {
    const lobbyGameId = gameId as LobbyGameId;
    currentLobbyGameId = lobbyGameId;
    const labels = LOBBY_GAME_LABELS[lobbyGameId];
    stSection?.classList.add('hidden');
    scSection?.classList.add('hidden');
    flSection?.classList.add('hidden');
    lobbySection?.classList.remove('hidden');
    if (icon) icon.textContent = labels.icon;
    if (title) title.textContent = labels.name;
    if (desc) desc.textContent = 'Creá una partida, unite como rival o espectá una en curso.';
    renderLobbyMatches();
  } else {
    // Juego sin soporte multiplayer de sub-partida conocido (no debería
    // pasar dado GameRegistry.visibleOnline(), pero por las dudas no
    // abrimos un modal vacío/roto).
    return;
  }

  overlay.classList.remove('hidden');
}

function closeConfigModal(): void {
  modalEl('olConfigModalOverlay')?.classList.add('hidden');
  clearConfigError('olConfigStError');
  clearConfigError('olConfigScError');
  clearConfigError('olConfigFlError');
  clearConfigError('olConfigLobbyError');
  currentLobbyGameId = null;
}

/**
 * Muestra/limpia el mensaje de error dentro de una sección del modal de
 * configuración (ST/SC/FL/lobby 1v1), identificada por el id de su
 * elemento `.ol-modal-error`. Reemplaza las 4 parejas
 * show/clear{St,Sc,Fl,Lobby}ConfigError que existían antes — idénticas
 * salvo por qué id de elemento tocaban, así que cualquier cambio al
 * comportamiento (p. ej. el fallback cuando el elemento no existe)
 * requería tocar 4 lugares para no dejar 3 actualizados y 1 desviado.
 */
function showConfigError(elId: string, message: string): void {
  const el = modalEl(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearConfigError(elId: string): void {
  modalEl(elId)?.classList.add('hidden');
}

// ── Listas de partidas existentes (crear O unirse, todo en este modal) ──
//
// Portado de la vieja sección propia en views/multiplayer.logic.ts (ver
// historial): esa vista ya no aloja Signal Triangulation/Centro de
// Control en absoluto, así que este modal —el único punto de entrada a
// ambos juegos— necesita poder listar partidas ya creadas por otros
// jugadores del lobby y no solo ofrecer "crear", o nadie más que el
// creador podría entrar a jugarlas.

function renderStMatches(): void {
  const list = modalEl('olConfigStMatchesList');
  if (!list) return;
  const matches = signalTriangulationSystem.getMatches();
  const lobby = lobbySystem.getCurrentLobby();
  const myId = Auth.getUser()?.id ?? null;

  if (matches.length === 0) {
    list.innerHTML = '<p class="no-matches">Todavía no hay partidas de Signal Triangulation. ¡Creá una!</p>';
    return;
  }

  const usernameById = new Map((lobby?.players ?? []).map((p) => [p.id, p.username]));

  list.innerHTML = matches.map((m: STMatch) => {
    const slots: STSlot[] = [1, 2, 3, 4];
    const filledCount = slots.filter((s) => !!m.players[s]).length;
    const iAmPlayer = myId !== null && slots.some((s) => m.players[s] === myId);
    const canJoin = m.status === 'waiting' && filledCount < 4 && !iAmPlayer && myId !== null;
    const canResume = iAmPlayer && (m.status === 'waiting' || m.status === 'playing');

    const namesLine = slots
      .map((s) => {
        const pid = m.players[s];
        if (!pid) return `J${s} ${ST_ANTENNA_LABEL[s]}: esperando`;
        const name = usernameById.get(pid) ?? 'Jugador';
        return `J${s} ${ST_ANTENNA_LABEL[s]}: ${escapeHtml(name)}`;
      })
      .join(' · ');

    return `
      <div class="lobby-match-item" data-match-id="${escapeHtml(m.id)}">
        <span class="lobby-match-game">📡 Signal Triangulation</span>
        <span class="lobby-match-players">${namesLine} (${filledCount}/4)</span>
        <span class="lobby-match-status">${m.status === 'waiting' ? '⏳ Esperando jugadores' : '▶️ En curso'}</span>
        ${canResume ? `<button class="lobby-match-resume-btn" data-action="st-resume">▶️ Volver a mi partida</button>` : ''}
        ${canJoin ? `<button class="lobby-match-join-btn" data-action="st-join" data-match-id="${m.id}">🆚 Unirse</button>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = btn as HTMLElement;
      const action = el.dataset.action;
      const matchId = el.dataset.matchId;

      try {
        if (action === 'st-resume') {
          closeConfigModal();
          window.showView?.('signal_triangulation');
        } else if (action === 'st-join' && matchId) {
          await signalTriangulationSystem.joinMatch(matchId);
          closeConfigModal();
          setPending('signal_triangulation', 'online-lobby');
          window.showView?.('match-waiting');
        }
      } catch (e) {
        showConfigError('olConfigStError', describeMatchError(e, 'No se pudo completar la acción.'));
      }
    });
  });
}

function renderScMatches(): void {
  const list = modalEl('olConfigScMatchesList');
  if (!list) return;
  const matches = shipControlSystem.getMatches();
  const lobby = lobbySystem.getCurrentLobby();
  const myId = Auth.getUser()?.id ?? null;

  if (matches.length === 0) {
    list.innerHTML = '<p class="no-matches">Todavía no hay partidas de Centro de Control. ¡Creá una eligiendo tu rol!</p>';
    return;
  }

  const usernameById = new Map((lobby?.players ?? []).map((p) => [p.id, p.username]));

  list.innerHTML = matches.map((m: SCMatch) => {
    const filledCount = ALL_SC_ROLES.filter((r) => !!m.players[r]).length;
    const myRole = myId !== null ? ALL_SC_ROLES.find((r) => m.players[r] === myId) ?? null : null;
    const iAmPlayer = myRole !== null;
    const openRoles = ALL_SC_ROLES.filter((r) => !m.players[r]);
    const canJoin = m.status === 'waiting' && openRoles.length > 0 && !iAmPlayer && myId !== null;
    const canResume = iAmPlayer && (m.status === 'waiting' || m.status === 'playing');

    const rolesLine = ALL_SC_ROLES
      .map((r) => {
        const pid = m.players[r];
        const name = pid ? (usernameById.get(pid) ?? 'Jugador') : 'esperando';
        return `${SC_ROLE_LABELS[r]}: ${pid ? escapeHtml(name) : name}`;
      })
      .join(' · ');

    const joinButtons = canJoin
      ? openRoles.map((r) => `<button class="lobby-match-join-btn" data-action="sc-join" data-match-id="${m.id}" data-role="${r}">${SC_ROLE_LABELS[r]}</button>`).join('')
      : '';

    return `
      <div class="lobby-match-item" data-match-id="${escapeHtml(m.id)}">
        <span class="lobby-match-game">🚀 Centro de Control</span>
        <span class="lobby-match-players">${rolesLine} (${filledCount}/4)</span>
        <span class="lobby-match-status">${m.status === 'waiting' ? '⏳ Esperando jugadores' : '▶️ En curso'}</span>
        ${canResume ? `<button class="lobby-match-resume-btn" data-action="sc-resume">▶️ Volver a mi partida (${SC_ROLE_LABELS[myRole as SCRole]})</button>` : ''}
        ${joinButtons ? `<div class="lobby-sc-join-roles">${joinButtons}</div>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = btn as HTMLElement;
      const action = el.dataset.action;
      const matchId = el.dataset.matchId;
      const role = el.dataset.role as SCRole | undefined;

      try {
        if (action === 'sc-resume') {
          closeConfigModal();
          window.showView?.('ship_control');
        } else if (action === 'sc-join' && matchId && role) {
          await shipControlSystem.joinMatch(matchId, role);
          closeConfigModal();
          setPending('ship_control', 'online-lobby');
          window.showView?.('match-waiting');
        }
      } catch (e) {
        showConfigError('olConfigScError', describeMatchError(e, 'No se pudo completar la acción.'));
      }
    });
  });
}

/**
 * Fragmented Labyrinth: lista de partidas cooperativas de 4 del lobby
 * actual. Mismo criterio que renderScMatches (roles fijos, quien crea
 * ya ocupa un rol), pero acá el rol A es especial (controla al
 * personaje) así que se distingue en el texto de unión.
 */
function renderFlMatches(): void {
  const list = modalEl('olConfigFlMatchesList');
  if (!list) return;
  const matches = fragmentedLabyrinthSystem.getMatches();
  const lobby = lobbySystem.getCurrentLobby();
  const myId = Auth.getUser()?.id ?? null;

  if (matches.length === 0) {
    list.innerHTML = '<p class="no-matches">Todavía no hay partidas de Fragmented Labyrinth. ¡Creá una!</p>';
    return;
  }

  const usernameById = new Map((lobby?.players ?? []).map((p) => [p.id, p.username]));

  list.innerHTML = matches.map((m: FLMatch) => {
    const filledCount = ALL_FL_ROLES.filter((r) => !!m.players[r]).length;
    const myRole = myId !== null ? ALL_FL_ROLES.find((r) => m.players[r] === myId) ?? null : null;
    const iAmPlayer = myRole !== null;
    const openRoles = ALL_FL_ROLES.filter((r) => !m.players[r]);
    const canJoin = m.status === 'waiting' && openRoles.length > 0 && !iAmPlayer && myId !== null;
    const canResume = iAmPlayer && (m.status === 'waiting' || m.status === 'playing');

    const rolesLine = ALL_FL_ROLES
      .map((r) => {
        const pid = m.players[r];
        const name = pid ? (usernameById.get(pid) ?? 'Jugador') : 'esperando';
        return `Rol ${r}: ${pid ? escapeHtml(name) : name}`;
      })
      .join(' · ');

    return `
      <div class="lobby-match-item" data-match-id="${escapeHtml(m.id)}">
        <span class="lobby-match-game">🌀 Fragmented Labyrinth</span>
        <span class="lobby-match-players">${rolesLine} (${filledCount}/4)</span>
        <span class="lobby-match-status">${m.status === 'waiting' ? '⏳ Esperando jugadores' : '▶️ En curso'}</span>
        ${canResume ? `<button class="lobby-match-resume-btn" data-action="fl-resume">▶️ Volver a mi partida (Rol ${myRole})</button>` : ''}
        ${canJoin ? `<button class="lobby-match-join-btn" data-action="fl-join" data-match-id="${m.id}">🌀 Unirse (Rol ${openRoles[0]} — ${FL_ROLE_DESCRIPTIONS[openRoles[0]]})</button>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = btn as HTMLElement;
      const action = el.dataset.action;
      const matchId = el.dataset.matchId;

      try {
        if (action === 'fl-resume') {
          closeConfigModal();
          window.showView?.('fragmented_labyrinth');
        } else if (action === 'fl-join' && matchId) {
          await fragmentedLabyrinthSystem.joinMatch(matchId);
          closeConfigModal();
          setPending('fragmented_labyrinth', 'online-lobby');
          window.showView?.('match-waiting');
        }
      } catch (e) {
        showConfigError('olConfigFlError', describeMatchError(e, 'No se pudo completar la acción.'));
      }
    });
  });
}

/**
 * Simon/Arrow/Termita: lista de sub-partidas 1v1 del lobby grupal
 * actual, filtrada al juego que se está configurando (currentLobbyGameId).
 * A diferencia de ST/SC, lobbySystem no separa por juego en el server —
 * getMatches() devuelve TODAS las sub-partidas 1v1 del lobby (Simon +
 * Arrow + Termita mezcladas), así que el filtro por gameId es acá.
 */
function renderLobbyMatches(): void {
  const list = modalEl('olConfigLobbyMatchesList');
  if (!list || !currentLobbyGameId) return;
  const gameId = currentLobbyGameId;
  const labels = LOBBY_GAME_LABELS[gameId];
  const matches = lobbySystem.getMatches().filter((m) => m.gameId === gameId);
  const lobby = lobbySystem.getCurrentLobby();
  const myId = lobbySystem.currentPlayerId();

  if (matches.length === 0) {
    list.innerHTML = `<p class="no-matches">Todavía no hay partidas de ${escapeHtml(labels.name)}. ¡Creá una!</p>`;
    return;
  }

  const usernameById = new Map((lobby?.players ?? []).map((p) => [p.id, p.username]));

  list.innerHTML = matches.map((m: LobbyMatch) => {
    const p1Name = usernameById.get(m.player1Id) ?? 'Jugador';
    const p2Name = m.player2Id ? (usernameById.get(m.player2Id) ?? 'Jugador') : null;
    const iAmPlayer = m.player1Id === myId || m.player2Id === myId;
    const canJoinAsPlayer = m.status === 'waiting' && !m.player2Id && !iAmPlayer;
    const canSpectate = m.status === 'playing' && !iAmPlayer;
    const canResume = iAmPlayer && (m.status === 'waiting' || m.status === 'playing');

    return `
      <div class="lobby-match-item" data-match-id="${escapeHtml(m.id)}">
        <span class="lobby-match-game">${labels.icon} ${escapeHtml(labels.name)}</span>
        <span class="lobby-match-players">${escapeHtml(p1Name)}${p2Name ? ` vs ${escapeHtml(p2Name)}` : ' (esperando rival)'}</span>
        <span class="lobby-match-status">${m.status === 'waiting' ? '⏳ Esperando' : '▶️ En curso'}</span>
        ${canResume ? `<button class="lobby-match-resume-btn" data-action="lobby-resume">▶️ Volver a mi partida</button>` : ''}
        ${canJoinAsPlayer ? `<button class="lobby-match-join-btn" data-action="lobby-join" data-match-id="${m.id}">🆚 Unirse como rival</button>` : ''}
        ${canSpectate ? `<button class="lobby-match-spectate-btn" data-action="lobby-spectate" data-match-id="${m.id}">👁️ Espectar</button>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = btn as HTMLElement;
      const action = el.dataset.action;
      const matchId = el.dataset.matchId;

      try {
        if (action === 'lobby-resume') {
          closeConfigModal();
          window.showView?.(gameId);
        } else if (action === 'lobby-join' && matchId) {
          await lobbySystem.joinMatchAsPlayer(matchId);
          closeConfigModal();
          setPending(gameId, 'online-lobby');
          window.showView?.('match-waiting');
        } else if (action === 'lobby-spectate' && matchId) {
          await lobbySystem.spectateMatch(matchId);
          closeConfigModal();
          window.showView?.(gameId);
        }
      } catch (e) {
        showConfigError('olConfigLobbyError', describeMatchError(e, 'No se pudo completar la acción.'));
      }
    });
  });
}

let matchesListenersBound = false;

function setupMatchesListeners(): void {
  if (matchesListenersBound) return;
  matchesListenersBound = true;
  // Igual que setupConfigModal (ver comentario ahí): se registra una
  // sola vez en todo el ciclo de vida de la app, no en cada init() de
  // la vista — evita acumular listeners duplicados al entrar/salir.
  window.addEventListener('st:matches_changed', () => renderStMatches());
  window.addEventListener('sc:matches_changed', () => renderScMatches());
  window.addEventListener('fl:matches_changed', () => renderFlMatches());
  // lobbySystem no tiene un evento dedicado por-juego (a diferencia de
  // ST/SC): 'lobby:matches_changed' se dispara para CUALQUIER cambio de
  // CUALQUIER sub-partida 1v1 del lobby (Simon/Arrow/Termita mezclados).
  // renderLobbyMatches() ya filtra por currentLobbyGameId y es un no-op
  // seguro si el modal no está mostrando la sección 1v1 (list null o
  // currentLobbyGameId null).
  window.addEventListener('lobby:matches_changed', () => renderLobbyMatches());
}

// ── Badge de código de sala ────────────────────────────────────────

function renderLobbyCodeBadge(): void {
  const badge = document.getElementById('onlineLobbyCodeBadge');
  const valueEl = document.getElementById('onlineLobbyCodeValue');
  if (!badge || !valueEl) return;

  const lobby = lobbySystem.getCurrentLobby();
  if (lobby) {
    valueEl.textContent = lobby.roomCode;
    badge.classList.remove('hidden');
    attachCopyButton(valueEl, 'onlineLobbyCodeCopyBtn');
  } else {
    badge.classList.add('hidden');
  }
}

export function stop(): void {
  modalBound = false;
  cachedModalEls = {};

  // El listener de Escape (y ahora también los de st:matches_changed/
  // sc:matches_changed, ver setupMatchesListeners) se registra una sola
  // vez en todo el ciclo de vida de la app y se mantiene para siempre —
  // no se elimina acá a propósito: aunque el usuario salga de la vista,
  // el modal ya no existe en el DOM (se limpió con
  // container.innerHTML = ''), así que closeConfigModal()/renderStMatches()/
  // renderScMatches() son no-ops seguros (elementos null).

  // La suscripción Realtime a la LISTA de partidas de Signal
  // Triangulation/Centro de Control (a diferencia del listener de
  // arriba) sí se detiene acá: es un canal aparte que solo tiene
  // sentido mientras se está mirando esta vista — la vista del juego en
  // sí usa su propio canal filtrado por partida (ver
  // setupMatchRealtimeSubscriptions en cada *System.ts). Se movió acá
  // desde views/multiplayer.logic.ts: esa vista ya no aloja Signal
  // Triangulation/Centro de Control, así que dejó de ser dueña de este
  // ciclo de vida.
  signalTriangulationSystem.stopWatchingLobbyMatches();
  shipControlSystem.stopWatchingLobbyMatches();
  fragmentedLabyrinthSystem.stopWatchingLobbyMatches();

  const container = document.getElementById('online-lobby');
  if (container) container.innerHTML = '';
}