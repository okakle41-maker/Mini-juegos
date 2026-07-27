/**
 * js/games/circleGame.logic.ts
 *
 * Lógica pesada del mini-juego "Circle" (init/stop), extraída de
 * Skillcheck.ts para lazy loading — ver `logic` en Skillcheck.ts y el
 * comentario de GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: StoppableThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts).
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

let cleanup: (() => void) | null = null;

export function init() {
  const needle   = document.getElementById('circleNeedle');
  const target   = document.getElementById('circleTarget');
  const startBtn = document.getElementById('startCircle');
  const result   = document.getElementById('circleResult');
  if (!needle || !target || !startBtn || !result) return;
  // Alias no-nulos: los closures de abajo (animate/placeTarget/listeners)
  // se ejecutan siempre después de este guard, pero TS no puede propagar
  // la comprobación de arriba a través de límites de función.
  const needleEl = needle;
  const targetEl = target;

  // ARIA labels para accesibilidad
  needle.setAttribute('role', 'img');
  needle.setAttribute('aria-label', 'Aguja giratoria del círculo');
  target.setAttribute('role', 'img');
  target.setAttribute('aria-label', 'Zona objetivo donde detener la aguja');
  startBtn.setAttribute('aria-label', 'Iniciar juego del círculo. Pulsa ESPACIO durante el juego para detener la aguja en la zona verde');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');

  const scoreEl = document.getElementById('circleScore');
  const comboEl = document.getElementById('circleCombo');
  const bestEl  = document.getElementById('circleBest');

  let angle = 0, running = false, animationId: number | null = null;
  let speed = 2, zoneSize = 50;
  let score = 0, combo = 0;
  let bestScore = safeStorage.getNumber('circleBest', 0);
  let targetAngle = 0;

  const MIN_ZONE_SIZE = 20, MAX_SPEED = 5, RADIUS = 150;

  if (bestEl) bestEl.textContent = String(bestScore);

  function placeTarget() {
    targetAngle = Math.random() * 360;
    const rad = (targetAngle - 90) * Math.PI / 180;
    targetEl.style.left      = `calc(50% + ${Math.cos(rad) * RADIUS}px)`;
    targetEl.style.top       = `calc(50% + ${Math.sin(rad) * RADIUS}px)`;
    targetEl.style.width     = `${zoneSize}px`;
    targetEl.style.transform = `translate(-50%, -50%) rotate(${targetAngle}deg)`;
  }

  function animate() {
    if (!running) return;
    angle += speed;
    needleEl.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    animationId = requestAnimationFrame(animate);
  }

  startBtn.addEventListener('click', e => {
    e.preventDefault(); startBtn.blur();
    if (running) return;
    speed = 1.5; zoneSize = 50;
    score = 0; combo = 0;
    if (scoreEl) scoreEl.textContent = '0';
    if (comboEl) comboEl.textContent = '0';
    angle = Math.random() * 360;
    placeTarget();
    running = true;
    result.textContent = 'Pulsa ESPACIO';
    animate();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    e.preventDefault(); startBtn.blur();
    if (e.repeat || !running) return;

    const pos  = angle % 360;
    let diff   = Math.abs(pos - targetAngle);
    if (diff > 180) diff = 360 - diff;

    const ringRect = document.querySelector('.circle-ring')?.getBoundingClientRect();
    if (!ringRect) return;
    const radius   = ringRect.width / 2 - 10;
    const hitAngle = (zoneSize / radius) * (180 / Math.PI) / 2;

    if (diff <= hitAngle) {
      combo++;
      const precision = 1 - (diff / hitAngle);
      const gained    = Math.round(100 + precision * 100 + speed * 20 + combo * 5);
      score += gained;
      if (audioManager) audioManager.play(precision > 0.8 ? 'perfect' : 'good');
      if (scoreEl) scoreEl.textContent = String(score);
      if (comboEl) comboEl.textContent = String(combo);
      if (score > bestScore) {
        bestScore = score;
        safeStorage.setNumber('circleBest', bestScore);
        if (bestEl) bestEl.textContent = String(bestScore);
      }
      zoneSize = Math.max(MIN_ZONE_SIZE, zoneSize - 1);
      speed    = Math.min(MAX_SPEED, speed + 0.5);
      placeTarget();
      result.innerHTML = `<span style="color:#44ff88">✔ +${gained}</span>`;
    } else {
      running = false;
      if (animationId) cancelAnimationFrame(animationId);
      combo = 0;
      if (comboEl) comboEl.textContent = '0';
      if (audioManager) audioManager.play('gameover');
      result.innerHTML = `<span style="color:#ff5555">✖ Fallaste<br>Score: ${score}</span>`;
      if (window.Leaderboard) window.Leaderboard.save('circle-game', score);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  placeTarget();

  cleanup = function () {
    if (!running) { document.removeEventListener('keydown', onKeyDown); return; }
    running = false;
    if (animationId) cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', onKeyDown);
  };
}

export function stop() {
  if (cleanup) cleanup();
}
