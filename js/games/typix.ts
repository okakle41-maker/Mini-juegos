/**
 * js/games/typix.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en typix.logic.ts.
 */
import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'typix',
  name:        'Typix',
  tag:         'TIPEO',
  accent:      '#38bdf8',
  icon:        '📝',
  num:         '09',
  description: 'Adivina el número de 5 dígitos en un máximo de 6 intentos.',
  difficulty:  2,
  css:         'css/typix.css',

  init: () => {
    throw new Error('[typix] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[typix] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./typix.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
