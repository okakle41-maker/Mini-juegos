/**
 * js/core/viewTemplates.ts
 *
 * Registro central de templates de vista, uno por id de sección de juego.
 * Cada entrada es una función que retorna un import() dinámico del módulo
 * de template correspondiente (js/views/<id>.ts) — Vite hace code-splitting
 * automático de cada uno en su propio chunk, así que el HTML de un
 * minijuego solo se descarga cuando el usuario realmente lo visita
 * (mismo comportamiento de lazy-loading que el fetch() de views/*.html
 * que reemplaza, pero resuelto por el bundler en vez de una petición de
 * red a un archivo estático).
 */

import type { ViewTemplate } from '../types/game.js';

export type ViewTemplateLoader = () => Promise<{ default: ViewTemplate }>;

export const viewTemplates: Record<string, ViewTemplateLoader> = {
  'arrow': () => import('../views/arrow.js'),
  'bombdefusal': () => import('../views/bombdefusal.js'),
  'bouncebar': () => import('../views/bouncebar.js'),
  'chordkeys': () => import('../views/chordkeys.js'),
  'circle-game': () => import('../views/circle-game.js'),
  'colorcount': () => import('../views/colorcount.js'),
  'configuracion': () => import('../views/configuracion.js'),
  'cuenta': () => import('../views/cuenta.js'),
  'datarecallgrid': () => import('../views/datarecallgrid.js'),
  'estadisticas': () => import('../views/estadisticas.js'),
  'holdrelease': () => import('../views/holdrelease.js'),
  'holematch': () => import('../views/holematch.js'),
  'keyspam-game': () => import('../views/keyspam-game.js'),
  'lanedodge': () => import('../views/lanedodge.js'),
  'letters': () => import('../views/letters.js'),
  'manual': () => import('../views/manual.js'),
  'maze-game': () => import('../views/maze-game.js'),
  'mechlock': () => import('../views/mechlock.js'),
  'memorygrid': () => import('../views/memorygrid.js'),
  'multipoint': () => import('../views/multipoint.js'),
  'neuralfragment': () => import('../views/neuralfragment.js'),
  'online-lobby': () => import('../views/onlineLobby.js'),
  'orbitcatch': () => import('../views/orbitcatch.js'),
  'pairs': () => import('../views/pairs.js'),
  'pipealign': () => import('../views/pipealign.js'),
  'progreso': () => import('../views/progreso.js'),
  'progresstiming': () => import('../views/progresstiming.js'),
  'ranking': () => import('../views/ranking.js'),
  'rapidlines-game': () => import('../views/rapidlines-game.js'),
  'reactor': () => import('../views/reactor.js'),
  'rhythmclick': () => import('../views/rhythmclick.js'),
  'ring-puzzle': () => import('../views/ring-puzzle.js'),
  'sequence-game': () => import('../views/sequence-game.js'),
  'simon': () => import('../views/simon.js'),
  'skillchecks': () => import('../views/skillchecks.js'),
  'snippet-race': () => import('../views/snippet-race.js'),
  'soup': () => import('../views/soup.js'),
  'targetpop': () => import('../views/targetpop.js'),
  'termita': () => import('../views/termita.js'),
  'typix': () => import('../views/typix.js'),
  'virusOverload': () => import('../views/virusOverload.js'),
};
