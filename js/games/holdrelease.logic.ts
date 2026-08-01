/**
 * Hold & Release — cargá el medidor con Space y soltá en la zona verde.
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

let cleanup: (() => void) | null = null;

export function init() {
  const fill = document.getElementById('hrFill');
  const zone = document.getElementById('hrZone');
  const startBtn = document.getElementById('hrStart');
  const result = document.getElementById('hrResult');
  if (!fill || !zone || !startBtn || !result) return;

  const scoreEl = document.getElementById('hrScore');
  const comboEl = document.getElementById('hrCombo');
  const bestEl = document.getElementById('hrBest');

  let running = false;
  let holding = false;
  let level = 0;
  let fillPct = 0;
  let zoneStart = 55;
  let zoneSize = 18;
  let chargeSpeed = 1.1;
  let score = 0;
  let combo = 0;
  let best = safeStorage.getNumber('holdreleaseBest', 0);
  let raf: number | null = null;

  if (bestEl) bestEl.textContent = String(best);

  function placeZone() {
    zoneStart = 40 + Math.random() * (55 - zoneSize);
    zone.style.bottom = `${zoneStart}%`;
    zone.style.height = `${zoneSize}%`;
  }

  function paint() {
    fill.style.height = `${fillPct}%`;
  }

  function tick() {
    if (!running || !holding) return;
    fillPct = Math.min(100, fillPct + chargeSpeed);
    paint();
    if (fillPct >= 100) {
      fail('Te pasaste');
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function resetRound() {
    fillPct = 0;
    holding = false;
    paint();
    placeZone();
    result.textContent = 'Mantené ESPACIO y soltá en la zona';
  }

  function fail(msg: string) {
    running = false;
    holding = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    combo = 0;
    if (comboEl) comboEl.textContent = '0';
    audioManager.play('gameover');
    result.innerHTML = `<span style="color:#ff5555">✖ ${msg}<br>Score: ${score}</span>`;
    if (window.Leaderboard) window.Leaderboard.save('holdrelease', score);
    (startBtn as HTMLButtonElement).style.display = '';
  }

  function success() {
    const inZone = fillPct >= zoneStart && fillPct <= zoneStart + zoneSize;
    if (!inZone) {
      fail('Fuera de zona');
      return;
    }
    combo++;
    const center = zoneStart + zoneSize / 2;
    const precision = 1 - Math.abs(fillPct - center) / (zoneSize / 2);
    const gained = Math.round(80 + precision * 120 + level * 15 + combo * 8);
    score += gained;
    if (scoreEl) scoreEl.textContent = String(score);
    if (comboEl) comboEl.textContent = String(combo);
    if (score > best) {
      best = score;
      safeStorage.setNumber('holdreleaseBest', best);
      if (bestEl) bestEl.textContent = String(best);
    }
    audioManager.play(precision > 0.75 ? 'perfect' : 'good');
    result.innerHTML = `<span style="color:#44ff88">✔ +${gained}</span>`;
    level++;
    zoneSize = Math.max(8, 18 - level * 0.6);
    chargeSpeed = Math.min(2.4, 1.1 + level * 0.08);
    resetRound();
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    if (running) return;
    level = 0;
    score = 0;
    combo = 0;
    zoneSize = 18;
    chargeSpeed = 1.1;
    if (scoreEl) scoreEl.textContent = '0';
    if (comboEl) comboEl.textContent = '0';
    running = true;
    (startBtn as HTMLButtonElement).style.display = 'none';
    resetRound();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat || !running || holding) return;
    e.preventDefault();
    holding = true;
    fillPct = 0;
    paint();
    raf = requestAnimationFrame(tick);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !running || !holding) return;
    e.preventDefault();
    holding = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    success();
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  placeZone();
  paint();

  cleanup = () => {
    running = false;
    holding = false;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
  };
}

export function stop() {
  if (cleanup) cleanup();
  cleanup = null;
}
