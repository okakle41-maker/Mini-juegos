/**
 * js/games/Maze/maze.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en maze.logic.ts.
 */

import GameRegistry from '../../core/gameRegistry.js';
import type { GameConfig } from '../../types/game.js';

const gameConfig: GameConfig = {
  id:          'maze-game',
  name:        'Maze',
  tag:         'NAVEGACIÓN',
  accent:      '#a3e635',
  icon:        '🌀',
  num:         '15',
  description: 'Encuentra la salida del laberinto antes de que se acabe el tiempo.',
  difficulty:  4,
  hidden:      true,     // sub-view, only accessible from skillchecks
  css:         'css/maze.css',

  init: () => {
    throw new Error('[maze-game] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[maze-game] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./maze.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
