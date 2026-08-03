/**
 * js/games/termita.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en termita.logic.ts — ver GameConfig.logic en
 * core/gameRegistry.ts.
 */

import GameRegistry from '../core/gameRegistry';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'termita',
  name:        'Termita',
  tag:         'MEMORIA',
  accent:      '#f97316',
  icon:        '🐜',
  num:         '01',
  description: 'Memoriza la cuadrícula iluminada. Señala las celdas correctas antes de que el sistema las borre.',
  difficulty:  2,
  css:         'css/termita.css',
  online:      true,
  playersRequired: 2,

  init: () => {
    throw new Error('[termita] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[termita] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./termita.logic.js'),

  leaderboard: {
    format: (v: number) => `${v} pts`
  }
};

GameRegistry.register(gameConfig);

export default gameConfig;
