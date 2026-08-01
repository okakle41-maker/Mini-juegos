/**
 * js/games/Maze/maze.logic.ts
 *
 * Lógica pesada de "Maze" (init/stop), extraída de maze.ts para lazy
 * loading — ver `logic` en maze.ts y el comentario de GameConfig.logic
 * en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: StoppableThis` (usado cuando init/stop
 * vivían inline en el objeto GameConfig) a un closure module-level:
 * la firma de `GameConfig.logic` es `init(ui)`/`stop()` sin `this`
 * context, así que el cleanup que antes se guardaba en `this._stop`
 * ahora se guarda en la variable `cleanup` de este módulo.
 */

import MazeGenerator from './mazeGenerator.js';
import MazePlayer from './mazePlayer.js';
import MazeRenderer from './mazeRenderer.js';
import audioManager from '../../audioManager.js';

let cleanup: (() => void) | null = null;

export function init() {
  const start = document.getElementById('startMaze');
  if (!start) return;

  let maze: number[][] = [];
  let player: MazePlayerInstance | null = null;
  let level = 1, mazeSize = 15;
  let time = 60, timer: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    time = 60;
    const timeEl = document.getElementById('mazeTime');
    if (!timeEl) return;
    timeEl.textContent = String(time);
    timeEl.classList.remove('danger');
    timer = setInterval(() => {
      time--;
      timeEl.textContent = String(time);
      timeEl.classList.toggle('danger', time <= 10);
      if (time === 10) audioManager.play('beep');
      if (time <= 0) {
        if (timer) { clearInterval(timer); timer = null; }
        time = 0; timeEl.textContent = '0';
        audioManager.play('gameover');
        player = null;
        const fog = document.getElementById('mazeFog') as HTMLElement | null;
        if (fog) { fog.style.transition = 'opacity .5s ease'; fog.style.opacity = '0'; }
        setTimeout(() => {
          const result = document.getElementById('mazeResult');
          if (result) result.textContent = '⏱ Tiempo agotado';
          start!.style.display = 'inline-block';
        }, 650);
      }
    }, 1000);
  }

  function startLevel() {
    maze   = MazeGenerator.generate(mazeSize, mazeSize);
    player = new MazePlayer(maze);
    MazeRenderer.render(maze, player);
    MazeRenderer.updateFog(player);
    const levelEl = document.getElementById('mazeLevel');
    const movesEl = document.getElementById('mazeMoves');
    const resultEl = document.getElementById('mazeResult');
    if (levelEl) levelEl.textContent = String(level);
    if (movesEl) movesEl.textContent = '0';
    if (resultEl) resultEl.textContent = '';
    startTimer();
  }

  start.addEventListener('click', () => {
    level = 1; mazeSize = 15;
    startLevel();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const mazeView = document.getElementById('maze-game');
    if (!player || !mazeView || mazeView.classList.contains('hidden')) return;
    let moved = false;
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup':    moved = player.move(0, -1); break;
      case 's': case 'arrowdown':  moved = player.move(0,  1); break;
      case 'a': case 'arrowleft':  moved = player.move(-1, 0); break;
      case 'd': case 'arrowright': moved = player.move( 1, 0); break;
      default: return;
    }
    if (!moved) return;
    const step = Math.floor(Math.random() * 3) + 1;
    audioManager.play('step' + step);
    const fog = document.getElementById('mazeFog') as HTMLElement | null;
    if (fog) fog.style.opacity = '1';
    MazeRenderer.updatePlayer(player);
    MazeRenderer.updateFog(player);
    MazeRenderer.spawnParticles(player);
    const movesEl = document.getElementById('mazeMoves');
    if (movesEl) movesEl.textContent = String(player.moves);

    if (maze[player.y][player.x] === 2) {
      const container = document.getElementById('mazeContainer');
      if (container) container.classList.add('maze-next');
      audioManager.play('perfect');
      level++;
      if (level % 2 === 1 && mazeSize < 31) mazeSize += 2;
      setTimeout(() => {
        if (container) container.classList.remove('maze-next');
        startLevel();
      }, 250);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  cleanup = function () {
    if (timer) { clearInterval(timer); timer = null; }
    document.removeEventListener('keydown', onKeyDown);
    player = null;
    const result = document.getElementById('mazeResult');
    if (result) result.textContent = '';
    const fog = document.getElementById('mazeFog') as HTMLElement | null;
    if (fog) fog.style.opacity = '1';
  };
}

export function stop() {
  if (cleanup) cleanup();
}
