/**
 * js/games/simon.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en simon.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'simon',
  name:        'Simon Dice',
  tag:         'SECUENCIA',
  accent:      '#818cf8',
  icon:        '🧠',
  num:         '02',
  description: 'Repite secuencias de colores en orden exacto. Cada ronda añade un paso más al patrón.',
  difficulty:  3,
  css:         'css/simon.css',
  online:      true,

  init: () => {
    throw new Error('[simon] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[simon] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./simon.logic.js'),
  leaderboard: { format: v => `${v} rondas` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
