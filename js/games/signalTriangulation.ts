/**
 * js/games/signalTriangulation.ts
 *
 * Solo metadatos ligeros del juego (nombre, tag, ícono, descripción) —
 * ver GameConfig.logic en core/gameRegistry.ts para el contrato
 * completo. La lógica pesada vive en signalTriangulation.logic.ts y se
 * carga vía import() dinámico solo cuando el usuario abre la vista.
 *
 * A diferencia de Simon/Arrow/Termita, este juego NO tiene modo solo —
 * es exclusivamente cooperativo de 4 jugadores. `online: true` lo hace
 * aparecer en la grilla filtrada de "Lobby Online"
 * (views/onlineLobby.logic.ts), que es el único lugar desde el que
 * tiene sentido entrar a esta vista (necesita una partida ya creada vía
 * signalTriangulationSystem.createMatch/joinMatch).
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'signal_triangulation',
  name:        'Signal Triangulation',
  tag:         'COOP 4 JUGADORES',
  accent:      '#3ad1ff',
  icon:        '📡',
  num:         '28',
  description: 'Cuatro antenas, una señal oculta. Cada uno ve solo su propia distancia — comuníquense por voz para triangular la celda exacta.',
  difficulty:  4,
  css:         'css/signalTriangulation.css',
  online:      true,

  // init/stop directos no se usan (logic tiene prioridad, ver
  // ensureInit en gameRegistry.ts); se dejan como stubs solo porque el
  // tipo GameConfig los exige obligatorios.
  init: () => {
    throw new Error('[signalTriangulation] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[signalTriangulation] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./signalTriangulation.logic.js')
};

GameRegistry.register(gameConfig);

export default gameConfig;
