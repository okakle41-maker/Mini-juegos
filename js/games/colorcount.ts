/**
 * js/games/colorcount.ts
 *
 * Color Count — cuenta los elementos del color indicado.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en colorcount.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'colorcount',
  name:        'Color Count',
  tag:         'ANÁLISIS',
  accent:      '#fb923c',
  icon:        '🎨',
  num:         '07',
  description: 'Cuenta los elementos del color indicado antes de que el tiempo se agote.',
  difficulty:  3,
  css:         'css/colorcount.css',

  init: () => {
    throw new Error('[colorcount] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[colorcount] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./colorcount.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
