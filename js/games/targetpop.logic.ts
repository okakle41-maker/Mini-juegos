/**
 * Target Pop — tocá blancos antes de que expiren; el combo multiplica puntos.
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

let cleanup: (() => void) | null = null;

export function init() {
  const arenaRef = document.getElementById('tpArena');
  const startBtn = document.getElementById('tpStart');
  const resultRef = document.getElementById('tpResult');
  if (!arenaRef || !startBtn || !resultRef) return;

  // Ver mismo motivo en rhythmclick.logic.ts.
  const arena: HTMLElement = arenaRef;
  const result: HTMLElement = resultRef;

  const scoreEl = document.getElementById('tpScore');
  const comboEl = document.getElementById('tpCombo');
  const bestEl = document.getElementById('tpBest');
  const livesEl = document.getElementById('tpLives');

  let running = false;
  let score = 0;
  let combo = 0;
  let lives = 3;
  let spawnTimer: ReturnType<typeof setInterval> | null = null;
  let spawnDelay = 900;
  let targetLife = 1400;
  let active = 0;
  let best = safeStorage.getNumber('targetpopBest', 0);
  const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  if (bestEl) bestEl.textContent = String(best);

  function clearArena() {
    arena.innerHTML = '';
    active = 0;
    while (pendingTimeouts.length) {
      clearTimeout(pendingTimeouts.pop()!);
    }
  }

  function endGame(msg: string) {
    running = false;
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = null;
    clearArena();
    audioManager.play('gameover');
    result.innerHTML = `<span style="color:#ff5555">${msg}<br>Score: ${score}</span>`;
    if (window.Leaderboard) window.Leaderboard.save('targetpop', score);
    (startBtn as HTMLButtonElement).style.display = '';
  }

  function miss() {
    if (!running) return;
    combo = 0;
    if (comboEl) comboEl.textContent = '0';
    lives--;
    if (livesEl) livesEl.textContent = String(lives);
    audioManager.play('miss');
    if (lives <= 0) endGame('✖ Sin vidas');
  }

  function spawn() {
    if (!running || active >= 4) return;
    const size = 44 + Math.random() * 28;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tp-target';
    el.setAttribute('aria-label', 'Blanco');
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    const maxX = Math.max(8, arena.clientWidth - size - 8);
    const maxY = Math.max(8, arena.clientHeight - size - 8);
    el.style.left = `${8 + Math.random() * maxX}px`;
    el.style.top = `${8 + Math.random() * maxY}px`;
    arena.appendChild(el);
    active++;

    let hit = false;
    const expire = setTimeout(() => {
      if (hit || !el.isConnected) return;
      el.remove();
      active = Math.max(0, active - 1);
      miss();
    }, targetLife);
    pendingTimeouts.push(expire);

    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (hit || !running) return;
      hit = true;
      clearTimeout(expire);
      el.classList.add('tp-hit');
      combo++;
      const gained = Math.round(50 + combo * 12 + (1400 - targetLife) / 20);
      score += gained;
      if (scoreEl) scoreEl.textContent = String(score);
      if (comboEl) comboEl.textContent = String(combo);
      if (score > best) {
        best = score;
        safeStorage.setNumber('targetpopBest', best);
        if (bestEl) bestEl.textContent = String(best);
      }
      audioManager.play(combo >= 5 ? 'perfect' : 'good');
      setTimeout(() => {
        el.remove();
        active = Math.max(0, active - 1);
      }, 120);
      if (combo > 0 && combo % 5 === 0) {
        spawnDelay = Math.max(420, spawnDelay - 40);
        targetLife = Math.max(700, targetLife - 60);
        if (spawnTimer) {
          clearInterval(spawnTimer);
          spawnTimer = setInterval(spawn, spawnDelay);
        }
      }
    });
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    if (running) return;
    score = 0;
    combo = 0;
    lives = 3;
    spawnDelay = 900;
    targetLife = 1400;
    if (scoreEl) scoreEl.textContent = '0';
    if (comboEl) comboEl.textContent = '0';
    if (livesEl) livesEl.textContent = '3';
    result.textContent = '¡Tocá los blancos!';
    clearArena();
    running = true;
    (startBtn as HTMLButtonElement).style.display = 'none';
    spawn();
    spawnTimer = setInterval(spawn, spawnDelay);
  });

  cleanup = () => {
    running = false;
    if (spawnTimer) clearInterval(spawnTimer);
    clearArena();
  };
}

export function stop() {
  if (cleanup) cleanup();
  cleanup = null;
}
