/**
 * js/games/mechlock.ts
 *
 * Mech Lock — Cerradura mecánica procedural.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en mechlock.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'mechlock',
  name:        'Cerradura Mecánica',
  tag:         'LÓGICA',
  accent:      '#d4a24c',
  icon:        '⚙️',
  num:         '24',
  description: 'Mecanismo procedural de engranajes, pestillos, imanes y contrapesos. Descubre cómo abrir el cerrojo principal.',
  difficulty:  4,
  css:         'css/mechlock.css',
  // Ver nota equivalente en bombdefusal.ts: agrupado bajo "Clásicos"
  // (js/games/classicsHub.ts), ya no es card suelta del lobby.
  hidden:      true,

  init: () => {
    throw new Error('[mechlock] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[mechlock] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./mechlock.logic.js'),
  leaderboard: { format: (v: number) => `${v} pts` },
};

GameRegistry.register(gameConfig);

export default gameConfig;
