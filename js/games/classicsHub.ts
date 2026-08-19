/**
 * js/games/classicsHub.ts
 *
 * Card agrupadora "Clásicos" del lobby principal. Agrupa 5 juegos que
 * antes tenían cada uno su propia card suelta (Bomb Defusal, Reactor
 * Nuclear, Cerradura Mecánica, Virus Overload, Snippet Race — todos
 * ahora marcados `hidden: true` en sus respectivos GameConfig, ver
 * nota en cada uno) bajo una única card. Al clickearla no navega a
 * ninguna vista propia: LobbyRenderer.render() del lobby principal
 * recibe un `onCardClick` (ver app.ts) que detecta este id puntual y
 * abre un menú flotante (ver components/GameGroupMenu.tsx) posicionado
 * junto a la card, con las 5 opciones — elegir una navega recién ahí
 * con ViewManager.showView(id), exactamente igual que si esa card
 * siguiera existiendo suelta.
 *
 * `init`/`stop` nunca deberían llamarse en la práctica (ver mismo
 * patrón que Skillcheck.ts/hubs existentes): esta card nunca se
 * "abre" como vista, solo dispara el menú. Se lanza igual si algo
 * llega a invocarlos por error (routing directo a /#classics-hub,
 * por ejemplo) en vez de fallar en silencio.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

/** Ids de GameRegistry agrupados bajo esta card, en el orden en que
 *  deben listarse dentro del menú flotante. Único punto de verdad:
 *  tanto GameGroupMenu (para resolver nombre/ícono/accent de cada
 *  entrada vía GameRegistry.get) como cualquier test que quiera
 *  validar el grupo deberían importar esto en vez de hardcodear la
 *  lista de nuevo. */
export const CLASSICS_HUB_GAME_IDS: readonly string[] = [
  'bombdefusal',
  'reactor',
  'mechlock',
  'virusOverload',
  'snippet-race',
];

const classicsHubGame: GameConfig = {
  id:          'classics-hub',
  name:        'Clásicos',
  tag:         'ANÁLISIS',
  accent:      '#ef4444',
  icon:        '🗂️',
  num:         '20b',
  description: 'Bomb Defusal, Reactor Nuclear, Cerradura Mecánica, Virus Overload y Snippet Race en un solo lugar.',
  difficulty:  4,

  init: () => {
    throw new Error('[classics-hub] init directo no debería llamarse: esta card abre un menú flotante, no navega a una vista propia.');
  },
  stop: () => {
    throw new Error('[classics-hub] stop directo no debería llamarse: esta card abre un menú flotante, no navega a una vista propia.');
  },
};

GameRegistry.register(classicsHubGame);

export default classicsHubGame;
