/**
 * js/games/rapidlines.ts
 *
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en rapidlinesGame.logic.ts.
 */
import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'rapidlines-game',
  name:        'Rapid Lines',
  tag:         'REFLEJOS',
  accent:      '#22d3ee',
  icon:        '⚡',
  num:         '10',
  description: 'Presiona la tecla correcta cuando la flecha llegue al centro. La velocidad aumenta.',
  difficulty:  4,
  hidden:      true,     // sub-view, only accessible from skillchecks
  // css: 'css/styles.css' era redundante (ese archivo ya se carga
  // global desde index.html) y de todas formas no traía el estilo
  // real de este juego. El CSS real (.rapid-hud, #rapidArena, etc.)
  // vivía en css/Skillcheck.css, declarado ahí en el GameConfig del
  // hub ('skillchecks') — no en el de este juego — así que solo se
  // inyectaba si el usuario pasaba antes por la vista de "cubos"
  // (ver css/skillcheckGames.css para la explicación completa de este
  // bug, encontrado al migrar la navegación al menú flotante).
  css:         'css/skillcheckGames.css',

  init: () => {
    throw new Error('[rapidlines-game] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[rapidlines-game] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./rapidlinesGame.logic.js'),
};

GameRegistry.register(gameConfig);

export default gameConfig;
