// Skillcheck.ts — card agrupadora "Skill Check" + Circle mini-game
// Migrado al sistema GameRegistry (metadatos + lazy logic).
// Lógica pesada del mini-game en circleGame.logic.ts.
//
// La card "Skill Check" ya no navega a una vista propia de "cubos":
// se agrupó bajo el mismo mecanismo de menú flotante que "Clásicos"
// (ver js/games/classicsHub.ts para la explicación completa del
// patrón, y js/utils/gameGroupMenuController.tsx). Al clickearla,
// LobbyRenderer abre un popover con los juegos listados en
// SKILLCHECKS_HUB_GAME_IDS; elegir uno navega recién ahí. La vista
// "skillchecks" (grilla de cubos que existía antes en
// js/views/skillchecks.ts) y su lógica quedaron eliminadas — mismo
// destino final para cada juego (ViewManager.showView(id del juego
// elegido)), solo cambia cómo se llega ahí desde el lobby.
//
// Los 15 juegos agrupados tenían su botón "Volver" apuntando a
// data-back-to="skillchecks" (para volver a esa grilla) — se
// actualizaron a data-back-to="home" (mismo id que usa
// ViewManager.backToMenu() como fallback por defecto) ya que
// "skillchecks" dejó de ser una vista navegable: sin ese cambio,
// backToMenu('skillchecks') llamaba a showView('skillchecks'), que
// falla silenciosamente al no encontrar ningún elemento con ese id.

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

/** Ids de GameRegistry agrupados bajo la card "Skill Check", en el
 *  orden en que deben listarse dentro del menú flotante — mismo orden
 *  que tenían los cubos en SKILL_CUBES (js/views/skillchecks.ts), para no
 *  reordenar algo que el usuario ya conocía visualmente. Único punto
 *  de verdad, igual que CLASSICS_HUB_GAME_IDS en classicsHub.ts. */
export const SKILLCHECKS_HUB_GAME_IDS: readonly string[] = [
  'rapidlines-game',
  'circle-game',
  'maze-game',
  'keyspam-game',
  'sequence-game',
  'rhythmclick',
  'progresstiming',
  'multipoint',
  'bouncebar',
  'holdrelease',
  'targetpop',
  'chordkeys',
  'orbitcatch',
  'lanedodge',
  'pipealign',
];

// ── Hub: SkillChecks ────────────────────────────────────────
const skillchecksGame: GameConfig = {
  id:          'skillchecks',
  name:        'Skill Check',
  tag:         'REFLEJOS',
  accent:      '#10b981',
  icon:        '🎯',
  num:         '08',
  description: 'Colección de minijuegos de habilidad y reflejos.',
  difficulty:  3,

  init: () => {
    throw new Error('[skillchecks] init directo no debería llamarse: esta card abre un menú flotante, no navega a una vista propia.');
  },
  stop: () => {
    throw new Error('[skillchecks] stop directo no debería llamarse: esta card abre un menú flotante, no navega a una vista propia.');
  },
};

GameRegistry.register(skillchecksGame);


// ── Circle mini-game ────────────────────────────────────────
const circleGame: GameConfig = {
  id:          'circle-game',
  name:        'Circle',
  tag:         'REFLEJOS',
  accent:      '#10b981',
  icon:        '⭕',
  num:         '08b',
  description: 'Detén la aguja en la zona verde. Cada acierto la hace más pequeña y rápida.',
  difficulty:  3,
  hidden:      true,     // sub-view, not shown as lobby card
  leaderboard: { format: (v: number) => `${v} pts` },
  // Antes de la migración al menú flotante, este juego nunca declaró
  // su propio `css` — su estilo (.circle-card, .circle-ring,
  // #circleNeedle, etc.) vivía en css/Skillcheck.css, cargado como
  // efecto colateral del GameConfig del hub ('skillchecks', que ya no
  // navega/inicializa nunca, ver skillchecksGame más arriba). Ver
  // css/skillcheckGames.css para el detalle completo del bug.
  css:         'css/skillcheckGames.css',

  init: () => {
    throw new Error('[circle-game] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[circle-game] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./circleGame.logic.js'),
};

GameRegistry.register(circleGame);

export default skillchecksGame;
export { circleGame };
