/**
 * js/games/memorygrid.ts
 *
 * Memory Grid — atraviesa la cuadrícula recordando los números de cada casilla.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en memorygrid.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'memorygrid',
  name:        'Memory Grid',
  tag:         'MEMORIA',
  accent:      '#06b6d4',
  icon:        '🧩',
  num:         '17',
  description: 'Memoriza los números del tablero y encuentra la ruta de S a E con saltos exactos.',
  difficulty:  3,
  css:         'css/memorygrid.css',

  init: () => {
    throw new Error('[memorygrid] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[memorygrid] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./memorygrid.logic.js'),
  leaderboard: { format: v => `${v} pts` },
};

GameRegistry.register(gameConfig);

export default gameConfig;
