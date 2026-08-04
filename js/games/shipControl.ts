/**
 * js/games/shipControl.ts
 *
 * Solo metadatos ligeros del juego (nombre, tag, ícono, descripción) —
 * ver GameConfig.logic en core/gameRegistry.ts para el contrato
 * completo. La lógica pesada vive en shipControl.logic.ts y se carga
 * vía import() dinámico solo cuando el usuario abre la vista.
 *
 * Como Signal Triangulation, NO tiene modo solo — es exclusivamente
 * cooperativo de 4 jugadores con roles fijos y asimétricos (a
 * diferencia de las 4 antenas intercambiables de SigTri, acá cada rol
 * ve una pantalla completamente distinta — ver diseño,
 * ship-control-design.md sección 7). `online: true` lo hace aparecer en
 * la grilla filtrada de "Lobby Online". `soloUnavailable: true` lo saca
 * del lobby principal de un jugador (#home) sin afectar Lobby Online —
 * ver GameConfig.soloUnavailable.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'ship_control',
  name:        'Centro de Control',
  tag:         'COOP 4 JUGADORES',
  accent:      '#ff8c3a',
  icon:        '🚀',
  num:         '29',
  description: 'Cuatro roles, una nave. Navegación, Sensores, Energía y Comunicaciones — nadie ve lo mismo que el resto. Coordínense por voz antes de que el casco no aguante otro fallo.',
  difficulty:  5,
  css:         'css/shipControl.css',
  online:      true,
  playersRequired: 4,
  soloUnavailable: true,

  init: () => {
    throw new Error('[shipControl] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[shipControl] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./shipControl.logic.js')
};

GameRegistry.register(gameConfig);

export default gameConfig;
