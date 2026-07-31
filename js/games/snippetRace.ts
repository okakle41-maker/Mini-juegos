/**
 * js/games/snippetRace.ts
 *
 * Snippet Race — minijuego de tipeo/código del lobby (NO es sub-juego
 * de Skill Check). Metadata liviana; lógica en snippetRace.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'snippet-race',
  name:        'Snippet Race',
  tag:         'TIPEO',
  accent:      '#38bdf8',
  icon:        '💻',
  num:         '25',
  description: 'Completá o corregí fragmentos de código. Velocidad y precisión cuentan.',
  difficulty:  3,
  css:         'css/snippet-race.css',
  leaderboard: { format: (v: number) => `${v} pts` },

  init: () => {
    throw new Error('[snippet-race] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[snippet-race] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./snippetRace.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
