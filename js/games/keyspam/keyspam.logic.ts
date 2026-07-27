import audioManager from '../../audioManager.js';
/**
 * js/games/keyspam/keyspam.logic.ts
 *
 * Lógica pesada de "Key Spam" (init/stop), extraída de keyspam.ts para
 * lazy loading — ver `logic` en keyspam.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: StoppableThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts).
 */

let cleanup: (() => void) | null = null;

export function init() {
  const start = document.getElementById('startKeySpam');
  if (!start) return;

  const keyElement   = document.getElementById('keyspamKey');
  const hitsElement  = document.getElementById('keyspamHits');
  const progress     = document.getElementById('keyspamProgressFill') as HTMLElement | null;
  const result       = document.getElementById('keyspamResult');
  const levelElement = document.getElementById('keyspamLevel');

  if (!keyElement || !hitsElement || !progress || !result || !levelElement) return;

  const KEYS = ['E', 'Q', 'R', 'F', 'ENTER'];

  let running = false;
  let level = 1;
  let target = 20;
  let hits = 0;
  let currentKey = 'E';
  let time = 8;
  let timer: ReturnType<typeof setInterval> | null = null;

  function randomKey() {
    currentKey = KEYS[Math.floor(Math.random() * KEYS.length)];
    keyElement!.textContent = currentKey === 'ENTER' ? '⏎' : currentKey;
  }

  function updateHUD() {
    hitsElement!.textContent = `${hits} / ${target}`;
    progress!.style.width = ((hits / target) * 100) + '%';
    levelElement!.textContent = String(level);
  }

  function startTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    time = 8;
    const timeEl = document.getElementById('keyspamTime');
    if (!timeEl) return;
    timeEl.textContent = String(time);
    timeEl.classList.remove('danger');
    timer = setInterval(() => {
      time--;
      timeEl.textContent = String(time);
      timeEl.classList.toggle('danger', time <= 3);
      if (time <= 0) {
        if (timer) { clearInterval(timer); timer = null; }
        running = false;
        result!.textContent = '⛔ ACCESS DENIED';
        start!.style.display = 'inline-block';
      }
    }, 1000);
  }

  function startLevel() {
    running = true;
    hits = 0;
    result!.textContent = '';
    start!.style.display = 'none';
    randomKey();
    updateHUD();
    startTimer();
  }

  start.addEventListener('click', () => {
    level = 1;
    target = 20;
    startLevel();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const view = document.getElementById('keyspam-game');
    if (!running || !view || view.classList.contains('hidden')) return;
    let pressed = e.key.toUpperCase();
    if (e.key === 'Enter') pressed = 'ENTER';
    if (pressed !== currentKey) return;
    hits++;
    const sound = Math.floor(Math.random() * 3) + 1;
    audioManager?.play('key' + sound);
    keyElement!.classList.add('pressed', 'flash');
    setTimeout(() => keyElement!.classList.remove('pressed', 'flash'), 80);
    updateHUD();
    if (hits >= target) {
      running = false;
      result!.textContent = '✔ Nivel completado';
      level++;
      target += 5;
      if (timer) { clearInterval(timer); timer = null; }
      setTimeout(() => startLevel(), 500);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  cleanup = function () {
    running = false;
    if (timer) { clearInterval(timer); timer = null; }
    document.removeEventListener('keydown', onKeyDown);
    hits = 0;
    time = 8;
    progress!.style.width = '0%';
    hitsElement!.textContent = '0 / 20';
    const timeEl = document.getElementById('keyspamTime');
    if (timeEl) timeEl.textContent = '8';
    result!.textContent = '';
    start!.style.display = 'inline-block';
  };
}

export function stop() {
  if (cleanup) cleanup();
}
