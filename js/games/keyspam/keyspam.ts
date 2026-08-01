/**
 * js/games/keyspam/keyspam.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en keyspam.logic.ts.
 */
import GameRegistry from '../../core/gameRegistry.js';
import type { GameConfig } from '../../types/game.js';

const gameConfig: GameConfig = {
  id:          'keyspam-game',
  name:        'Key Spam',
  tag:         'REFLEJOS',
  accent:      '#4ade80',
  icon:        '⌨️',
  num:         '14',
  description: 'Pulsa la tecla mostrada la cantidad de veces requerida antes de que se acabe el tiempo.',
  difficulty:  2,
  hidden:      true,     // sub-view, only accessible from skillchecks
  css:         'css/keyspam.css',

  init: () => {
    throw new Error('[keyspam-game] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[keyspam-game] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./keyspam.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
