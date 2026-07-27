import audioManager from '../audioManager.js';
/**
 * js/games/rhythmclick.logic.ts
 *
 * Lógica pesada de "Rhythm Click" (init/stop), extraída de
 * rhythmclick.ts para lazy loading — ver `logic` en rhythmclick.ts y
 * el comentario de GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this._stop` implícito a un closure
 * module-level (ver misma nota en Maze/maze.logic.ts).
 */

let cleanup: (() => void) | null = null;

export function init() {
    const start    = document.getElementById('startRhythm') as HTMLButtonElement | null;
    if (!start) return;

    const arena    = document.getElementById('rhythmArena') as HTMLElement | null;
    const levelEl  = document.getElementById('rhythmLevel') as HTMLElement | null;
    const scoreEl  = document.getElementById('rhythmScore') as HTMLElement | null;
    const timeEl   = document.getElementById('rhythmTime') as HTMLElement | null;
    const resultEl = document.getElementById('rhythmResult') as HTMLElement | null;

    if (!arena || !levelEl || !scoreEl || !timeEl || !resultEl) return;

    let running = false;
    let level = 1, score = 0;
    let time = 30, timer: ReturnType<typeof setInterval> | null = null;
    let spawnInterval: ReturnType<typeof setInterval> | null = null, spawnDelay = 1000;
    let activeCores = 0, maxCores = 1;

    function startTimer() {
      if (timer) clearInterval(timer);
      time = 30;
      timeEl.textContent = String(time);
      timeEl.classList.remove('danger');
      timer = setInterval(() => {
        time--;
        timeEl.textContent = String(time);
        timeEl.classList.toggle('danger', time <= 10);
        if (time === 10) audioManager.play('beep');
        if (time <= 0) {
          clearInterval(timer); timer = null;
          if (spawnInterval) { clearInterval(spawnInterval); spawnInterval = null; }
          running = false;
          audioManager.play('gameover');
          resultEl.textContent = '⛔ Tiempo agotado';
          start.style.display = 'inline-block';
        }
      }, 1000);
    }

    function startSpawner() {
      if (spawnInterval) clearInterval(spawnInterval);
      spawnInterval = setInterval(() => {
        if (!running) return;
        if (activeCores < maxCores) spawnCore();
      }, spawnDelay);
    }

    function spawnCore() {
      const core = document.createElement('div');
      core.className = 'rhythm-core';
      core.innerHTML = '<div class="core-ring"></div><div class="core-center"></div>';
      const size = 70;
      core.style.left = Math.random() * (arena.clientWidth - size) + 'px';
      core.style.top  = Math.random() * (arena.clientHeight - size) + 'px';
      arena.appendChild(core);
      activeCores++;

      const ring = core.querySelector('.core-ring') as HTMLElement | null;
      const center = core.querySelector('.core-center') as HTMLElement | null;
      if (!ring || !center) {
        core.remove();
        activeCores = Math.max(0, activeCores - 1);
        return;
      }
      let scale = 3, clicked = false;
      const shrinkSpeed = 0.012 + level * 0.002;

      center.addEventListener('click', () => {
        if (!running || clicked) return;
        clicked = true;
        if (scale >= 0.95 && scale <= 1.05) {
          audioManager.play('perfect'); score += 100; resultEl.textContent = 'PERFECT';
        } else if (scale >= 0.85 && scale <= 1.15) {
          audioManager.play('click'); score += 50; resultEl.textContent = 'GOOD';
        } else {
          audioManager.play('gameover'); resultEl.textContent = 'MISS';
        }
        scoreEl.textContent = String(score);
        if (score >= level * 250) {
          level++;
          levelEl.textContent = String(level);
          maxCores = Math.min(5, level);
        }
        core.remove();
        activeCores = Math.max(0, activeCores - 1);
      });

      function animate() {
        if (!running) { core.remove(); activeCores = Math.max(0, activeCores - 1); return; }
        scale -= shrinkSpeed;
        ring.style.transform = `scale(${scale})`;
        if (scale >= 0.97 && scale <= 1.03) ring.classList.add('perfect');
        else if (scale >= 0.88 && scale <= 1.12) ring.classList.add('good');
        if (scale <= 0.70) {
          if (!clicked) { audioManager.play('gameover'); resultEl.textContent = 'MISS'; }
          core.remove();
          activeCores = Math.max(0, activeCores - 1);
          return;
        }
        requestAnimationFrame(animate);
      }
      animate();
    }

    function startGame() {
      running = true;
      level = 1; score = 0; activeCores = 0; maxCores = 1;
      levelEl.textContent = String(level);
      scoreEl.textContent = String(score);
      resultEl.textContent = '';
      arena.innerHTML = '';
      start.style.display = 'none';
      startTimer();
      spawnCore();
      startSpawner();
    }

    start.addEventListener('click', startGame);

    cleanup = function () {
      running = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (spawnInterval) { clearInterval(spawnInterval); spawnInterval = null; }
      arena.innerHTML = '';
      resultEl.textContent = '';
      start.style.display = 'inline-block';
    };}

export function stop() {
  if (cleanup) cleanup();
}
