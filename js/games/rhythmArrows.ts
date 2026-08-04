/**
 * js/games/rhythmArrows.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic), mismo patrón
 * que arrowGame.ts / rhythmclick.ts. Solo metadatos ligeros: la lógica
 * pesada (~lo que era rhythm-arrows/public/js/game.js en el prototipo
 * standalone) vive en rhythmArrows.logic.ts y se carga vía
 * `logic: () => import(...)` solo cuando el usuario abre la vista
 * "rhythmArrows" — ver GameConfig.logic en core/gameRegistry.ts.
 *
 * Portado desde "minijuegos a futuri/rhythm-arrows" (prototipo Node +
 * canvas, sin integrar): sin servidor propio, sin multiplayer por ahora
 * (single-player), dibujo en SVG en vez de canvas.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'rhythmArrows',
  name:        'Rhythm Arrows',
  tag:         'RITMO',
  accent:      '#f97316',
  icon:        '🔺',
  num:         '29',
  description: 'Seguí el recorrido de la línea por la figura y presioná la flecha justo en el momento exacto. No es velocidad, es sincronización.',
  difficulty:  3,
  css:         'css/rhythmArrows.css',

  // init/stop directos no se usan (logic tiene prioridad, ver
  // ensureInit en gameRegistry.ts); se dejan como stubs solo porque el
  // tipo GameConfig los exige obligatorios.
  init: () => {
    throw new Error('[rhythmArrows] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[rhythmArrows] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./rhythmArrows.logic.js'),

  leaderboard: { format: v => `${'⭐'.repeat(v)}${'☆'.repeat(3 - v)}` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
