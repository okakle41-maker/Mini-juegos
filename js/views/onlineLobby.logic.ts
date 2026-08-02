/**
 * js/views/onlineLobby.logic.ts
 *
 * Lógica de la vista "Lobby Online" (ver views/onlineLobby.ts para el
 * template). Reusa por completo el motor de tarjetas de
 * LobbyRenderer, pasándole los ids de contenedores propios de esta
 * vista (onlineGameList/onlineFilterBar, sin módulo del día),
 * GameRegistry.visibleOnline() como lista de juegos y un callback
 * onCardClick que intercepta las cards de los cooperativos de 4
 * jugadores (Signal Triangulation y Centro de Control) para abrir un
 * modal de configuración previa en vez de navegar directo — ver
 * GameConfig.online en core/gameRegistry.ts para qué juegos entran
 * ahí (hoy: simon, arrow, termita, letters, signal_triangulation,
 * ship_control).
 */

import LobbyRenderer from '../lobbyRenderer.js';
import GameRegistry, { type GameConfig } from '../core/gameRegistry.js';
import { lobbySystem } from '../lobbySystem.js';
import { signalTriangulationSystem } from '../signalTriangulationSystem.js';
import { shipControlSystem, type SCRole } from '../shipControlSystem.js';
import template from './onlineLobby.js';
import { hydrateBackButtons } from '../utils/backButton.js';

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
}

/** Juegos cooperativos de 4 jugadores que requieren configuración previa. */
const COOP_CONFIG_GAMES = new Set(['signal_triangulation', 'ship_control']);

function handleCardClick(game: GameConfig): void {
  if (!COOP_CONFIG_GAMES.has(game.id)) {
    // Juegos 1v1 / asimétricos 1v1 (Simon, Arrow, Termita, Letters):
    // navegación directa como siempre.
    window.showView?.(game.id);
    return;
  }
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
  modalEl('olConfigStCreateBtn')?.addEventListener('click', async () => {
    clearStConfigError();
    if (!signalTriangulationSystem.isPlayerEligible()) {
      showStConfigError('Necesitás iniciar sesión para crear una partida de Signal Triangulation.');
      return;
    }
    try {
      await signalTriangulationSystem.createMatch();
      closeConfigModal();
      window.showView?.('signal_triangulation');
    } catch (e) {
      showStConfigError(e instanceof Error ? e.message : 'No se pudo crear la partida.');
    }
  });

  // Centro de Control: elegir rol para crear
  modalEl('olConfigScRolePicker')?.addEventListener('click', async (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.ol-modal-role-btn[data-role]');
    if (!btn) return;
    clearScConfigError();
    if (!shipControlSystem.isPlayerEligible()) {
      showScConfigError('Necesitás iniciar sesión para crear una partida de Centro de Control.');
      return;
    }
    const role = btn.dataset.role as SCRole;
    try {
      await shipControlSystem.createMatch(role);
      closeConfigModal();
      window.showView?.('ship_control');
    } catch (e) {
      showScConfigError(e instanceof Error ? e.message : 'No se pudo crear la partida.');
    }
  });

  // Se registra una sola vez en todo el ciclo de vida de la app para no
  // acumular listeners duplicados cada vez que se entra a la vista.
  if (!escapeKeyHandler) {
    escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfigModal();
    };
    document.addEventListener('keydown', escapeKeyHandler);
  }
}

function openConfigModal(gameId: string): void {
  const overlay = modalEl('olConfigModalOverlay');
  if (!overlay) return;

  const stSection = modalEl('olConfigStSection');
  const scSection = modalEl('olConfigScSection');
  const title = modalEl('olConfigModalTitle');
  const desc = modalEl('olConfigModalDesc');
  const icon = modalEl('olConfigModalIcon');

  clearStConfigError();
  clearScConfigError();

  if (gameId === 'signal_triangulation') {
    stSection?.classList.remove('hidden');
    scSection?.classList.add('hidden');
    if (icon) icon.textContent = '📡';
    if (title) title.textContent = 'Signal Triangulation';
    if (desc) desc.textContent = 'Configurá tu partida cooperativa de 4 jugadores.';
  } else if (gameId === 'ship_control') {
    stSection?.classList.add('hidden');
    scSection?.classList.remove('hidden');
    if (icon) icon.textContent = '🚀';
    if (title) title.textContent = 'Centro de Control';
    if (desc) desc.textContent = 'Elegí tu rol para crear la partida cooperativa.';
  }

  overlay.classList.remove('hidden');
}

function closeConfigModal(): void {
  modalEl('olConfigModalOverlay')?.classList.add('hidden');
  clearStConfigError();
  clearScConfigError();
}

function showStConfigError(message: string): void {
  const el = modalEl('olConfigStError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearStConfigError(): void {
  modalEl('olConfigStError')?.classList.add('hidden');
}

function showScConfigError(message: string): void {
  const el = modalEl('olConfigScError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearScConfigError(): void {
  modalEl('olConfigScError')?.classList.add('hidden');
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
  } else {
    badge.classList.add('hidden');
  }
}

export function stop(): void {
  modalBound = false;
  cachedModalEls = {};

  // El listener de Escape se registra una sola vez y se mantiene para
  // toda la vida de la app — no se elimina acá a propósito: aunque el
  // usuario salga de la vista, el modal ya no existe en el DOM (se
  // limpió con container.innerHTML = ''), así que closeConfigModal()
  // es un no-op seguro (overlay null).

  const container = document.getElementById('online-lobby');
  if (container) container.innerHTML = '';
}