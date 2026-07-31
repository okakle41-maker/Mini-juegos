/**
 * js/games/index.ts
 *
 * Barrel file: centraliza el import de todos los módulos de juego en un
 * único punto, en vez de que main.ts tenga que listar 27 rutas sueltas.
 *
 * Cada juego se auto-registra en GameRegistry al importarse (efecto
 * secundario dentro del propio archivo — ver `GameRegistry.register(...)`
 * al final de cada uno). Este barrel no vuelve a llamar a `register()`;
 * solo importa cada módulo y re-exporta su `gameConfig` por si algo
 * necesita referenciarlo explícitamente (tests, debug, tooling) sin
 * pasar por `GameRegistry.get(id)`.
 *
 * Orden: los 3 helpers de Maze (mazePlayer, mazeGenerator, mazeRenderer)
 * deben importarse antes que maze.ts, ya que maze.ts los usa directamente
 * como imports ES (ya no dependen de globals `window.MazeX`). El resto no
 * tiene dependencias de orden entre sí.
 */

export { default as datarecallgrid } from './datarecallgrid.js';
export { default as neuralfragment } from './neuralfragment.js';
export { default as termita } from './termita.js';
export { default as simon } from './simon.js';
export { default as arrowGame } from './arrowGame.js';
export { default as lettersFall } from './lettersFall.js';
export { default as hackingDevice } from './hackingDevice.js';
export { default as holematch } from './holematch.js';
export { default as colorcount } from './colorcount.js';
export { default as pairs } from './pairs.js';
export { default as ringpuzzle } from './ringpuzzle.js';
export { default as typix } from './typix.js';
export { default as snippetRace } from './snippetRace.js';
export { default as skillchecks, circleGame } from './Skillcheck.js';
export { default as multipoint, bouncebarGame } from './multipoint.js';
export {
  holdrelease,
  targetpop,
  chordkeys,
  orbitcatch,
  lanedodge,
  pipealign,
} from './skillcheckExtras.js';
export { default as rapidlines } from './rapidlines.js';

// Maze: los helpers primero, maze.ts (que los importa) después.
export { default as MazePlayer } from './Maze/mazePlayer.js';
export { default as MazeGenerator } from './Maze/mazeGenerator.js';
export { default as MazeRenderer } from './Maze/mazeRenderer.js';
export { default as maze } from './Maze/maze.js';

export { default as keyspam } from './keyspam/keyspam.js';
export { default as sequence } from './sequence.js';
export { default as progresstiming } from './progresstiming.js';
export { default as rhythmclick } from './rhythmclick.js';
export { default as memorygrid } from './memorygrid.js';
export { default as bombdefusal } from './bombdefusal.js';
export { default as reactor } from './reactor.js';
export { default as mechlock } from './mechlock.js';
export { default as virusOverload } from './virusOverload.js';
