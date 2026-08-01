/**
 * js/games/sequence.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en sequence.logic.ts.
 */
import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'sequence-game',
  name:        'Sequence',
  tag:         'MEMORIA',
  accent:      '#a78bfa',
  icon:        '🔢',
  num:         '11',
  description: 'Observa y repite la secuencia. Cada nivel añade un paso más.',
  difficulty:  3,
  hidden:      true,     // sub-view, only accessible from skillchecks
  css:         'css/sequence.css',

  init: () => {
    throw new Error('[sequence-game] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[sequence-game] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./sequence.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
