import audioManager from '../audioManager.js';
import difficultyPresets from '../difficultyPresets.js';
import { AnimationOptimizer } from '../gameOptimizations.js';
/**
 * js/games/rhythmclick.logic.ts
 *
 * Lógica pesada de "Rhythm Click" (init/stop), extraída de
 * rhythmclick.ts para lazy loading — ver `logic` en rhythmclick.ts y
 * el comentario de GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this._stop` implícito a un closure
 * module-level (ver misma nota en Maze/maze.logic.ts).
 *
 * Usa DifficultyPresetsManager (js/difficultyPresets.ts) para escalar
 * el tiempo base (30s) según el preset GLOBAL elegido en Configuración
 * → DIFICULTAD GLOBAL (js/difficultySettings.ts), y AnimationOptimizer
 * (js/gameOptimizations.ts) para limitar cuántos "cores" pueden
 * animarse a la vez si el usuario tiene prefers-reduced-motion o
 * calidad de animación baja — antes ambos módulos se cargaban en
 * main.ts pero ningún juego los consultaba.
 */

let cleanup: (() => void) | null = null;

export function init() {
    const startEl    = document.getElementById('startRhythm') as HTMLButtonElement | null;
    const arenaEl    = document.getElementById('rhythmArena') as HTMLElement | null;
    const levelElEl  = document.getElementById('rhythmLevel') as HTMLElement | null;
    const scoreElEl  = document.getElementById('rhythmScore') as HTMLElement | null;
    const timeElEl   = document.getElementById('rhythmTime') as HTMLElement | null;
    const resultElEl = document.getElementById('rhythmResult') as HTMLElement | null;

    if (!startEl || !arenaEl || !levelElEl || !scoreElEl || !timeElEl || !resultElEl) return;

    // Con strictNullChecks, TS no propaga el narrowing del guard de
    // arriba hacia adentro de las funciones anidadas más abajo
    // (startTimer, spawnCore, startGame, cleanup) porque son closures
    // sobre estas variables, no usos directos en el mismo scope — para
    // TS, en teoría podrían reasignarse a null entre la verificación y
    // el uso. Re-declararlas como const con un tipo ya no-nulo (mismo
    // valor, ya verificado arriba) resuelve esto sin tocar la lógica:
    // son const, nunca se reasignan, así que el tipo no-nulo es
    // correcto en todo el resto de la función.
    const start: HTMLButtonElement = startEl;
    const arena: HTMLElement = arenaEl;
    const levelEl: HTMLElement = levelElEl;
    const scoreEl: HTMLElement = scoreElEl;
    const timeEl: HTMLElement = timeElEl;
    const resultEl: HTMLElement = resultElEl;

    const animationOptimizer = new AnimationOptimizer();

    let running = false;
    let level = 1, score = 0;
    let time = 30, timer: ReturnType<typeof setInterval> | null = null;
    let spawnInterval: ReturnType<typeof setInterval> | null = null;
    const spawnDelay = 1000;
    let activeCores = 0, maxCores = 1;
    let nextAnimId = 0;

    function getBaseTime(): number {
      // Todavía no hay selector de dificultad propio para este juego, así
      // que usamos el preset GLOBAL elegido en Configuración (ver
      // js/difficultySettings.ts) en vez de GAME_ID, que caería siempre
      // a 'normal' por no tener ajuste guardado.
      return Math.round(30 * difficultyPresets.getGameSettings('global').timeMultiplier);
    }

    function startTimer() {
      if (timer) clearInterval(timer);
      time = getBaseTime();
      timeEl.textContent = String(time);
      timeEl.classList.remove('danger');
      timer = setInterval(() => {
        time--;
        timeEl.textContent = String(time);
        timeEl.classList.toggle('danger', time <= 10);
        if (time === 10) audioManager.play('beep');
        if (time <= 0) {
          // clearInterval acepta undefined pero no null en su firma de
          // tipos; timer siempre está asignado acá (viene de la propia
          // llamada a setInterval que definió este callback), pero por
          // ser una variable let capturada por closure, TS no puede
          // descartar que algo la haya vuelto a poner en null entre el
          // if de arriba y esta línea. El guard es redundante en
          // runtime pero resuelve el desajuste de tipos sin cambiar
          // comportamiento (clearInterval(null) ya era un no-op).
          if (timer) clearInterval(timer);
          timer = null;
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
      if (!animationOptimizer.shouldAnimate()) return;
      const core = document.createElement('div');
      core.className = 'rhythm-core';
      core.innerHTML = '<div class="core-ring"></div><div class="core-center"></div>';
      const size = 70;
      core.style.left = Math.random() * (arena.clientWidth - size) + 'px';
      core.style.top  = Math.random() * (arena.clientHeight - size) + 'px';
      arena.appendChild(core);
      activeCores++;
      const coreAnimId = nextAnimId++;
      animationOptimizer.registerAnimation(coreAnimId);

      const ringEl = core.querySelector('.core-ring') as HTMLElement | null;
      const centerEl = core.querySelector('.core-center') as HTMLElement | null;
      if (!ringEl || !centerEl) {
        core.remove();
        activeCores = Math.max(0, activeCores - 1);
        animationOptimizer.unregisterAnimation(coreAnimId);
        return;
      }
      // Mismo motivo que start/arena/etc. arriba: ring/center ya
      // verificados, se re-tipan como no-nulos para las closures
      // (el listener de click y animate()) definidas más abajo.
      const ring: HTMLElement = ringEl;
      const center: HTMLElement = centerEl;
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
        animationOptimizer.unregisterAnimation(coreAnimId);
      });

      function animate() {
        if (!running) {
          core.remove();
          activeCores = Math.max(0, activeCores - 1);
          animationOptimizer.unregisterAnimation(coreAnimId);
          return;
        }
        scale -= shrinkSpeed;
        ring.style.transform = `scale(${scale})`;
        if (scale >= 0.97 && scale <= 1.03) ring.classList.add('perfect');
        else if (scale >= 0.88 && scale <= 1.12) ring.classList.add('good');
        if (scale <= 0.70) {
          if (!clicked) { audioManager.play('gameover'); resultEl.textContent = 'MISS'; }
          core.remove();
          activeCores = Math.max(0, activeCores - 1);
          animationOptimizer.unregisterAnimation(coreAnimId);
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
