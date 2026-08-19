/**
 * js/games/bombdefusal.ts
 *
 * Bomb Defusal — operador vs manual bajo presión.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en bombdefusal.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'bombdefusal',
  name:        'Bomb Defusal',
  tag:         'ANÁLISIS',
  accent:      '#ef4444',
  icon:        '💣',
  num:         '20',
  description: 'Desactiva módulos bajo presión consultando el manual. Operador vs Experto: ninguno tiene toda la información.',
  difficulty:  5,
  css:         'css/bombdefusal.css',
  // Agrupado bajo la card "Clásicos" (ver js/games/classicsHub.ts): ya
  // no aparece como card suelta en el lobby — se abre desde el menú
  // flotante de esa card, pero sigue siendo un GameConfig normal
  // (mismo id, misma vista, ViewManager.showView('bombdefusal') sigue
  // funcionando igual que antes) y GameRegistry.get() lo sigue
  // devolviendo — hidden solo lo saca de las grillas (visible()/
  // visibleOnline()), no del registro.
  hidden:      true,

  init: () => {
    throw new Error('[bombdefusal] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[bombdefusal] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./bombdefusal.logic.js'),

  leaderboard: { format: (v: number) => `${v} pts` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
