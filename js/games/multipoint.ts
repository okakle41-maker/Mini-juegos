/* ============================================================
   multipoint.ts — Multi-Point Progress + Bounce Bar
   Dos minijuegos de timing en el sublobby de SkillChecks
   Migrado al sistema GameRegistry (metadatos + lazy logic).
   Lógica pesada en multipointGame.logic.ts y bouncebarGame.logic.ts.
   ============================================================ */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

// ── Multi-Point Progress ────────────────────────────────────
const multipointGame: GameConfig = {
  id:          'multipoint',
  name:        'Multi-Point',
  tag:         'REFLEJOS',
  accent:      '#a78bfa',
  icon:        '🎯',
  num:         'SC-A',
  description: 'Haz clic al pasar por cada punto marcado en la barra.',
  difficulty:  3,
  hidden:      true,
  css:         'css/multipoint.css',

  init: () => {
    throw new Error('[multipoint] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[multipoint] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./multipointGame.logic.js'),
};

GameRegistry.register(multipointGame);


// ── Bounce Bar ──────────────────────────────────────────────
const bouncebarGame: GameConfig = {
  id:          'bouncebar',
  name:        'Bounce Bar',
  tag:         'REFLEJOS',
  accent:      '#f472b6',
  icon:        '⚡',
  num:         'SC-B',
  description: 'La barra retrocede y se lanza — pulsa justo en la zona.',
  difficulty:  4,
  hidden:      true,
  css:         'css/multipoint.css',   // shared CSS

  init: () => {
    throw new Error('[bouncebar] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[bouncebar] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./bouncebarGame.logic.js'),
};

GameRegistry.register(bouncebarGame);

export default multipointGame;
export { bouncebarGame };
