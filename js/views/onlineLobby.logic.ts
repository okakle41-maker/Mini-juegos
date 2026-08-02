/**
 * js/views/onlineLobby.logic.ts
 *
 * Lógica de la vista "Lobby Online" (ver views/onlineLobby.ts para el
 * template). Reusa por completo el motor de tarjetas de
 * LobbyRenderer, pasándole los ids de contenedores propios de esta
 * vista (onlineGameList/onlineFilterBar, sin módulo del día) y
 * GameRegistry.visibleOnline() como lista de juegos — ver
 * GameConfig.online en core/gameRegistry.ts para qué juegos entran
 * ahí (hoy: simon, arrow, termita, letters).
 */

import LobbyRenderer from '../lobbyRenderer.js';
import GameRegistry from '../core/gameRegistry.js';
import { lobbySystem } from '../lobbySystem.js';
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
    games: GameRegistry.visibleOnline()
  });

  renderLobbyCodeBadge();
}

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
  const container = document.getElementById('online-lobby');
  if (container) container.innerHTML = '';
}
