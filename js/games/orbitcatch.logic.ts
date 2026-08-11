/**
 * Orbit Catch — pulsá Space cuando el punto orbitante entra en la zona.
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

let cleanup: (() => void) | null = null;

export function init() {
  const orbitRef = document.getElementById('ocOrbit');
  const zoneRef = document.getElementById('ocZone');
  const startBtn = document.getElementById('ocStart');
  const result = document.getElementById('ocResult');
  if (!orbitRef || !zoneRef || !startBtn || !result) return;

  // Ver mismo motivo en rhythmclick.logic.ts.
  const orbit: HTMLElement = orbitRef;
  const zone: HTMLElement = zoneRef;

  const scoreEl = document.getElementById('ocScore');
  const comboEl = document.getElementById('ocCombo');
  const bestEl = document.getElementById('ocBest');

  const RADIUS = 120;
  let running = false;
  let angle = 0;
  let speed = 2.2;
  let zoneAngle = 0;
  let zoneWidth = 40;
  let score = 0;
  let combo = 0;
  let best = safeStorage.getNumber('orbitcatchBest', 0);
  let raf: number | null = null;

  if (bestEl) bestEl.textContent = String(best);

  function placeZone() {
    zoneAngle = Math.random() * 360;
    zone.style.transform = `rotate(${zoneAngle}deg)`;
    zone.style.width = `${Math.max(8, zoneWidth * 0.45)}px`;
    zone.style.marginLeft = `${-Math.max(8, zoneWidth * 0.45) / 2}px`;
  }

  function placeDot() {
    const rad = (angle - 90) * Math.PI / 180;
    orbit.style.left = `calc(50% + ${Math.cos(rad) * RADIUS}px)`;
    orbit.style.top = `calc(50% + ${Math.sin(rad) * RADIUS}px)`;
  }

  function animate() {
    if (!running) return;
    angle = (angle + speed) % 360;
    placeDot();
    raf = requestAnimationFrame(animate);
  }

  function angularDiff(a: number, b: number): number {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    if (running) return;
    score = 0;
    combo = 0;
    speed = 2.2;
    zoneWidth = 40;
    if (scoreEl) scoreEl.textContent = '0';
    if (comboEl) comboEl.textContent = '0';
    angle = Math.random() * 360;
    placeZone();
    placeDot();
    running = true;
    result.textContent = 'Pulsa ESPACIO en la zona';
    (startBtn as HTMLButtonElement).style.display = 'none';
    raf = requestAnimationFrame(animate);
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat || !running) return;
    e.preventDefault();
    const diff = angularDiff(angle, zoneAngle);
    const half = zoneWidth / 2;
    if (diff <= half) {
      combo++;
      const precision = 1 - diff / half;
      const gained = Math.round(90 + precision * 110 + speed * 15 + combo * 6);
      score += gained;
      if (scoreEl) scoreEl.textContent = String(score);
      if (comboEl) comboEl.textContent = String(combo);
      if (score > best) {
        best = score;
        safeStorage.setNumber('orbitcatchBest', best);
        if (bestEl) bestEl.textContent = String(best);
      }
      audioManager.play(precision > 0.8 ? 'perfect' : 'good');
      result.innerHTML = `<span style="color:#44ff88">✔ +${gained}</span>`;
      zoneWidth = Math.max(14, zoneWidth - 1.5);
      speed = Math.min(5.5, speed + 0.18);
      placeZone();
    } else {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      combo = 0;
      if (comboEl) comboEl.textContent = '0';
      audioManager.play('gameover');
      result.innerHTML = `<span style="color:#ff5555">✖ Fallaste<br>Score: ${score}</span>`;
      if (window.Leaderboard) window.Leaderboard.save('orbitcatch', score);
      (startBtn as HTMLButtonElement).style.display = '';
    }
  };

  document.addEventListener('keydown', onKeyDown);
  placeZone();
  placeDot();

  cleanup = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
  };
}

export function stop() {
  if (cleanup) cleanup();
  cleanup = null;
}
