/**
 * js/games/datarecallgrid.ts
 *
 * Data Recall Grid - Minijuego de memoria visual + asociación rápida
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en datarecallgrid.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'datarecallgrid',
  name:        'Data Recall Grid',
  tag:         'MEMORIA',
  accent:      '#ff4444',
  icon:        '🧠',
  num:         '19',
  description: 'Memoriza la red de datos y responde bajo presión. Escanea, recuerda, responde.',
  difficulty:  3,
  css:         'css/datarecallgrid.css',

  init: () => {
    throw new Error('[datarecallgrid] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[datarecallgrid] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./datarecallgrid.logic.js'),
  leaderboard: { format: (v: number) => `${v} respuestas` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
