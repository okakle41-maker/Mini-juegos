/**
 * skillcheckExtras.ts — sub-juegos nuevos del hub Skill Check.
 * Metadata liviana; lógica en *.logic.ts vía import() dinámico.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const CSS = 'css/skillcheckExtras.css';
const TAG = 'REFLEJOS';
const ACCENT = '#10b981';

function stub(id: string): Pick<GameConfig, 'init' | 'stop'> {
  return {
    init: () => {
      throw new Error(`[${id}] init directo no debería llamarse: usar logic()`);
    },
    stop: () => {
      throw new Error(`[${id}] stop directo no debería llamarse: usar logic()`);
    },
  };
}

const holdrelease: GameConfig = {
  id: 'holdrelease',
  name: 'Hold & Release',
  tag: TAG,
  accent: ACCENT,
  icon: '✊',
  num: 'SC-C',
  description: 'Mantené Space para cargar y soltá en la zona verde.',
  difficulty: 3,
  hidden: true,
  css: CSS,
  leaderboard: { format: (v: number) => `${v} pts` },
  ...stub('holdrelease'),
  logic: () => import('./holdrelease.logic.js'),
};

const targetpop: GameConfig = {
  id: 'targetpop',
  name: 'Target Pop',
  tag: TAG,
  accent: '#f59e0b',
  icon: '🎯',
  num: 'SC-D',
  description: 'Tocá los blancos antes de que desaparezcan. Combo = más puntos.',
  difficulty: 3,
  hidden: true,
  css: CSS,
  leaderboard: { format: (v: number) => `${v} pts` },
  ...stub('targetpop'),
  logic: () => import('./targetpop.logic.js'),
};

const chordkeys: GameConfig = {
  id: 'chordkeys',
  name: 'Chord Keys',
  tag: TAG,
  accent: '#38bdf8',
  icon: '⌨️',
  num: 'SC-E',
  description: 'Pulsá 2–3 teclas a la vez antes de que se acabe el tiempo.',
  difficulty: 4,
  hidden: true,
  css: CSS,
  leaderboard: { format: (v: number) => `${v} pts` },
  ...stub('chordkeys'),
  logic: () => import('./chordkeys.logic.js'),
};

const orbitcatch: GameConfig = {
  id: 'orbitcatch',
  name: 'Orbit Catch',
  tag: TAG,
  accent: '#a78bfa',
  icon: '🪐',
  num: 'SC-F',
  description: 'Pulsá Space cuando el punto orbitante pase por la zona.',
  difficulty: 3,
  hidden: true,
  css: CSS,
  leaderboard: { format: (v: number) => `${v} pts` },
  ...stub('orbitcatch'),
  logic: () => import('./orbitcatch.logic.js'),
};

const lanedodge: GameConfig = {
  id: 'lanedodge',
  name: 'Lane Dodge',
  tag: TAG,
  accent: '#f472b6',
  icon: '↕️',
  num: 'SC-G',
  description: 'Esquivá obstáculos en 3 carriles con ← → o A D.',
  difficulty: 4,
  hidden: true,
  css: CSS,
  leaderboard: { format: (v: number) => `${v} pts` },
  ...stub('lanedodge'),
  logic: () => import('./lanedodge.logic.js'),
};

const pipealign: GameConfig = {
  id: 'pipealign',
  name: 'Pipe Align',
  tag: 'LÓGICA',
  accent: '#34d399',
  icon: '🔧',
  num: 'SC-H',
  description: 'Girá los tubos hasta conectar entrada y salida a tiempo.',
  difficulty: 4,
  hidden: true,
  css: CSS,
  leaderboard: { format: (v: number) => `${v} pts` },
  ...stub('pipealign'),
  logic: () => import('./pipealign.logic.js'),
};

GameRegistry.register(holdrelease);
GameRegistry.register(targetpop);
GameRegistry.register(chordkeys);
GameRegistry.register(orbitcatch);
GameRegistry.register(lanedodge);
GameRegistry.register(pipealign);

export default holdrelease;
export { holdrelease, targetpop, chordkeys, orbitcatch, lanedodge, pipealign };
