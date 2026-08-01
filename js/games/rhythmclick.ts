/**
 * js/games/rhythmclick.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en rhythmclick.logic.ts.
 */
import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'rhythmclick',
  name:        'Rhythm Click',
  tag:         'REFLEJOS',
  accent:      '#f472b6',
  icon:        '🎯',
  num:         '12',
  description: 'Haz clic en el núcleo justo cuando el anillo se contrae. La precisión es todo.',
  difficulty:  3,
  hidden:      true,     // sub-view, only accessible from skillchecks
  css:         'css/rhythmclick.css',

  init: () => {
    throw new Error('[rhythmclick] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[rhythmclick] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./rhythmclick.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
