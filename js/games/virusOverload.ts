/**
 * js/games/virusOverload.ts
 *
 * Virus Overload — Sobrevive a la infección del sistema
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada (4 fases, 20 minijuegos) en virusOverload.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id: 'virusOverload',
  name: 'Virus Overload',
  tag: 'SUPERVISIÓN',
  accent: '#ff4500',
  icon: '🦠',
  num: '18',
  description: 'Sobrevive a la infección del sistema. 4 fases progresivas con 20 minijuegos únicos.',
  difficulty: 5,
  css: 'css/virusOverload.css',
  leaderboard: { format: (v: number) => `${v} pts` },

  init: () => {
    throw new Error('[virusOverload] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[virusOverload] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./virusOverload.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
