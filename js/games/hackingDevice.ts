/**
 * js/games/hackingDevice.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en hackingDevice.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'soup',
  name:        'Hacking Device',
  tag:         'CIFRADO',
  accent:      '#f43f5e',
  icon:        '💀',
  num:         '04',
  description: 'Descifra el código de acceso e infiltra el sistema antes de que el firewall te detecte.',
  difficulty:  5,
  css:         'css/hacking.css',

  init: () => {
    throw new Error('[hackingDevice] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[hackingDevice] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./hackingDevice.logic.js'),
  leaderboard: { format: (v: number) => `${v} racha` }
};

GameRegistry.register(gameConfig);

export default gameConfig;
