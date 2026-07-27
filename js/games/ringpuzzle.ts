/**
 * js/games/ringpuzzle.ts
 *
 * Ring Puzzle — alinea los nodos de colores en cada anillo y confírmalos.
 * Registrado en GameRegistry como id: 'ring-puzzle'.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en ringpuzzle.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'ring-puzzle',
  name:        'Ring Puzzle',
  tag:         'LÓGICA',
  accent:      '#f97316',
  icon:        '⭕',
  num:         '22',
  description: 'Alinea los nodos de colores en cada anillo girándolos hasta que encajen con su posición objetivo.',
  difficulty:  3,
  css:         'css/ringpuzzle.css',

  init: () => {
    throw new Error('[ringpuzzle] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[ringpuzzle] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./ringpuzzle.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
