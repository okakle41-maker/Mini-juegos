/**
 * js/games/lettersFall.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en lettersFall.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'letters',
  name:        'Caída de letras',
  tag:         'TIPEO',
  accent:      '#a78bfa',
  icon:        '⌨️',
  num:         '05',
  description: 'Escribe las letras que caen en tiempo real. Si llegan al suelo, el sistema falla.',
  difficulty:  3,
  css:         'css/letters.css',

  init: () => {
    throw new Error('[letters] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[letters] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./lettersFall.logic.js'),
  leaderboard: { format: (v: number) => `${v} pts` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
