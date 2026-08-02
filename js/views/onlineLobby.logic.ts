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

export function init(): void {
  const container = document.getElementById('online-lobby');
  if (!container) return;

  LobbyRenderer.render({
    gridId: 'onlineGameList',
    filterBarId: 'onlineFilterBar',
    moduleOfDayId: null,
    headerCountIds: ['onlineModsCountPill'],
    games: GameRegistry.visibleOnline()
  });
}

export function stop(): void {
  // No hay estado propio que limpiar más allá de lo que ya maneja
  // LobbyRenderer (bindThemeChangeOnce se registra una sola vez y
  // sigue siendo válido para la próxima vez que se entre acá).
}
