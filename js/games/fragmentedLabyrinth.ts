/**
 * js/games/fragmentedLabyrinth.ts
 *
 * Solo metadatos ligeros (nombre, tag, ícono, descripción) — misma
 * estructura que signalTriangulation.ts. La lógica pesada vive en
 * fragmentedLabyrinth.logic.ts y se carga vía import() dinámico solo
 * cuando el usuario abre la vista.
 *
 * Portado desde "minijuegos a futuri/fragmentad-labyrinth" (prototipo
 * con servidor WebSocket Node propio, sin integrar): sin servidor
 * propio, autoridad de juego en Postgres (RPC + RLS, ver
 * supabase/migration_018_fragmented_labyrinth.sql), sin chat integrado
 * en este port inicial (coordinación por voz externa, como ya aclaraba
 * el README del prototipo). Igual que Signal Triangulation, NO tiene
 * modo solo — es exclusivamente cooperativo de 4 jugadores, así que
 * `online: true` lo hace aparecer en la grilla filtrada de "Lobby
 * Online" (views/onlineLobby.logic.ts), único lugar desde el que tiene
 * sentido entrar (necesita una partida ya creada vía
 * fragmentedLabyrinthSystem.createMatch/joinMatch). `soloUnavailable:
 * true` lo saca del lobby principal de un jugador (#home) sin afectar
 * Lobby Online — ver GameConfig.soloUnavailable.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'fragmented_labyrinth',
  name:        'Fragmented Labyrinth',
  tag:         'COOP 4 JUGADORES',
  accent:      '#a3e635',
  icon:        '🌀',
  num:         '30',
  description: 'Un laberinto, cuatro cuadrantes, un solo personaje. Solo el Jugador A lo controla — los otros tres guían por voz desde lo que ven.',
  difficulty:  4,
  css:         'css/fragmentedLabyrinth.css',
  online:      true,
  playersRequired: 4,
  soloUnavailable: true,

  // init/stop directos no se usan (logic tiene prioridad, ver
  // ensureInit en gameRegistry.ts); se dejan como stubs solo porque el
  // tipo GameConfig los exige obligatorios.
  init: () => {
    throw new Error('[fragmentedLabyrinth] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[fragmentedLabyrinth] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./fragmentedLabyrinth.logic.js')
};

GameRegistry.register(gameConfig);

export default gameConfig;
