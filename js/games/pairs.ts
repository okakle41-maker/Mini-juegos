/**
 * js/games/pairs.ts
 *
 * Pairs — encuentra todos los pares iguales.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en pairs.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'pairs',
  name:        'Pairs',
  tag:         'ESTRATEGIA',
  accent:      '#fb7185',
  icon:        '🃏',
  num:         '23',
  description: 'Encuentra todos los pares iguales con el menor número de movimientos posible.',
  difficulty:  2,
  css:         'css/pairs.css',

  init: () => {
    throw new Error('[pairs] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[pairs] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./pairs.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
