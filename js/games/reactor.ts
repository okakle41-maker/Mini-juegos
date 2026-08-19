/**
 * js/games/reactor.ts
 *
 * Reactor Nuclear — mantén el reactor estable durante el tiempo configurado.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en reactor.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'reactor',
  name:        'Reactor Nuclear',
  tag:         'ESTRATEGIA',
  accent:      '#22c55e',
  icon:        '☢️',
  num:         '21',
  description: 'Mantén el reactor estable bajo presión. Variables interconectadas, eventos aleatorios y reactores con personalidad.',
  difficulty:  5,
  css:         'css/reactor.css',
  // Ver nota equivalente en bombdefusal.ts: agrupado bajo "Clásicos"
  // (js/games/classicsHub.ts), ya no es card suelta del lobby.
  hidden:      true,

  init: () => {
    throw new Error('[reactor] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[reactor] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./reactor.logic.js'),
  leaderboard: { format: v => `${v} pts` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
