/**
 * js/games/neuralfragment.ts
 *
 * Neural Fragment Hack - Minijuego de memoria con fragmentos corruptos
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en neuralfragment.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'neuralfragment',
  name:        'Neural Fragment Hack',
  tag:         'MEMORIA',
  accent:      '#00ff88',
  icon:        '🧠',
  num:         '16',
  description: 'Reconstruye fragmentos de memoria corrupta. Filtra el ruido y restaura los datos perdidos.',
  difficulty:  3,
  css:         'css/neuralfragment.css',

  init: () => {
    throw new Error('[neuralfragment] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[neuralfragment] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./neuralfragment.logic.js'),
  leaderboard: { format: (v: number) => `${v} fragmentos` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
