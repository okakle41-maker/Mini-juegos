/**
 * js/games/holematch.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en holematch.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'holematch',
  name:        'Hole Match',
  tag:         'PERCEPCIÓN',
  accent:      '#facc15',
  icon:        '🔷',
  num:         '06',
  description: 'Empareja la forma con el hueco correcto al instante. El margen de error es cero.',
  difficulty:  2,
  css:         'css/holematch.css',

  init: () => {
    throw new Error('[holematch] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[holematch] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./holematch.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
