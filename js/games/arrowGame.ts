/**
 * js/games/arrowGame.ts
 *
 * Migrado al sistema GameRegistry.
 *
 * Solo metadatos ligeros del juego (nombre, tag, ícono, descripción):
 * necesarios de entrada, ya que lobbyRenderer.ts/sidebarViews.ts los leen
 * al arrancar para pintar el lobby completo, incluso antes de que el
 * usuario abra ningún juego. La lógica pesada (init/stop + toda la clase
 * ArrowClicker, ~350 líneas) vive en arrowGame.logic.ts y se carga vía
 * `logic: () => import(...)` solo cuando el usuario abre la vista
 * "arrow" — ver GameConfig.logic en core/gameRegistry.ts para el
 * contrato completo.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'arrow',
  name:        'Desafío Flechas',
  tag:         'REFLEJOS',
  accent:      '#ff9a3c',
  icon:        '⬆️',
  num:         '03',
  description: 'Presiona la tecla de flecha correcta antes de que caduque la señal. Velocidad máxima requerida.',
  difficulty:  2,
  css:         'css/arrow.css',
  online:      true,
  playersRequired: 2,

  // init/stop directos no se usan (logic tiene prioridad, ver
  // ensureInit en gameRegistry.ts); se dejan como stubs solo porque el
  // tipo GameConfig los exige obligatorios para no romper a los otros 27
  // juegos que todavía no migraron a `logic`.
  init: () => {
    throw new Error('[arrowGame] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[arrowGame] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./arrowGame.logic.js'),

  leaderboard: { format: v => `${v}%` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
