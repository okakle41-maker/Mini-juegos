// Skillcheck.ts — hub de navegación + Circle mini-game
// Migrado al sistema GameRegistry (metadatos + lazy logic).
// Lógica pesada en skillchecksHub.logic.ts y circleGame.logic.ts.

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

// ── Hub: SkillChecks ────────────────────────────────────────
const skillchecksGame: GameConfig = {
  id:          'skillchecks',
  name:        'Skill Check',
  tag:         'REFLEJOS',
  accent:      '#10b981',
  icon:        '🎯',
  num:         '08',
  description: 'Colección de minijuegos de habilidad y reflejos.',
  difficulty:  3,
  css:         'css/Skillcheck.css',

  init: () => {
    throw new Error('[skillchecks] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[skillchecks] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./skillchecksHub.logic.js'),
};

GameRegistry.register(skillchecksGame);


// ── Circle mini-game ────────────────────────────────────────
const circleGame: GameConfig = {
  id:          'circle-game',
  name:        'Circle',
  tag:         'REFLEJOS',
  accent:      '#10b981',
  icon:        '⭕',
  num:         '08b',
  description: 'Detén la aguja en la zona verde. Cada acierto la hace más pequeña y rápida.',
  difficulty:  3,
  hidden:      true,     // sub-view, not shown as lobby card
  leaderboard: { format: (v: number) => `${v} pts` },

  init: () => {
    throw new Error('[circle-game] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[circle-game] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./circleGame.logic.js'),
};

GameRegistry.register(circleGame);

export default skillchecksGame;
export { circleGame };
