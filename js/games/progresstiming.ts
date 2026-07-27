/**
 * js/games/progresstiming.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en progresstiming.logic.ts.
 */
import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'progresstiming',
  name:        'Progress Timing',
  tag:         'REFLEJOS',
  accent:      '#fb923c',
  icon:        '⏱',
  num:         '13',
  description: 'Detén el marcador en la zona verde. Configura velocidad y tamaño antes de empezar.',
  difficulty:  4,
  hidden:      true,     // sub-view, only accessible from skillchecks
  css:         'css/progresstiming.css',

  init: () => {
    throw new Error('[progresstiming] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[progresstiming] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./progresstiming.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
