/**
 * js/games/rapidlines.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en rapidlinesGame.logic.ts.
 */
import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'rapidlines-game',
  name:        'Rapid Lines',
  tag:         'REFLEJOS',
  accent:      '#22d3ee',
  icon:        '⚡',
  num:         '10',
  description: 'Presiona la tecla correcta cuando la flecha llegue al centro. La velocidad aumenta.',
  difficulty:  4,
  hidden:      true,     // sub-view, only accessible from skillchecks
  css:         'css/styles.css',

  init: () => {
    throw new Error('[rapidlines-game] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[rapidlines-game] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./rapidlinesGame.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
