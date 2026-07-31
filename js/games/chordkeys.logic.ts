/**
 * Chord Keys — pulsá varias teclas a la vez dentro del tiempo límite.
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

let cleanup: (() => void) | null = null;

const POOL = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyW', 'KeyE'];

function label(code: string): string {
  return code.replace('Key', '');
}

export function init() {
  const display = document.getElementById('ckDisplay');
  const startBtn = document.getElementById('ckStart');
  const result = document.getElementById('ckResult');
  const timerFill = document.getElementById('ckTimerFill');
  if (!display || !startBtn || !result || !timerFill) return;

  const scoreEl = document.getElementById('ckScore');
  const comboEl = document.getElementById('ckCombo');
  const bestEl = document.getElementById('ckBest');

  let running = false;
  let score = 0;
  let combo = 0;
  let chord: string[] = [];
  let down = new Set<string>();
  let windowMs = 2200;
  let chordSize = 2;
  let round = 0;
  let deadline = 0;
  let raf: number | null = null;
  let best = safeStorage.getNumber('chordkeysBest', 0);

  if (bestEl) bestEl.textContent = String(best);

  function paintChord() {
    display.innerHTML = chord
      .map((c) => `<span class="ck-key" data-code="${c}">${label(c)}</span>`)
      .join('<span class="ck-plus">+</span>');
  }

  function nextChord() {
    const size = Math.min(3, chordSize);
    const shuffled = [...POOL].sort(() => Math.random() - 0.5);
    chord = shuffled.slice(0, size);
    down.clear();
    paintChord();
    deadline = performance.now() + windowMs;
    result.textContent = 'Pulsá todas juntas';
  }

  function tickTimer() {
    if (!running) return;
    const left = Math.max(0, deadline - performance.now());
    timerFill.style.width = `${(left / windowMs) * 100}%`;
    if (left <= 0) {
      fail('Tiempo agotado');
      return;
    }
    raf = requestAnimationFrame(tickTimer);
  }

  function fail(msg: string) {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    combo = 0;
    if (comboEl) comboEl.textContent = '0';
    audioManager.play('gameover');
    result.innerHTML = `<span style="color:#ff5555">✖ ${msg}<br>Score: ${score}</span>`;
    if (window.Leaderboard) window.Leaderboard.save('chordkeys', score);
    (startBtn as HTMLButtonElement).style.display = '';
  }

  function checkChord() {
    if (!running || chord.length === 0) return;
    const ok = chord.every((c) => down.has(c));
    if (!ok) return;
    // no extra keys required — extras allowed as long as chord keys are down
    combo++;
    round++;
    const gained = Math.round(100 + chord.length * 40 + combo * 10);
    score += gained;
    if (scoreEl) scoreEl.textContent = String(score);
    if (comboEl) comboEl.textContent = String(combo);
    if (score > best) {
      best = score;
      safeStorage.setNumber('chordkeysBest', best);
      if (bestEl) bestEl.textContent = String(best);
    }
    audioManager.play(chord.length >= 3 ? 'perfect' : 'good');
    result.innerHTML = `<span style="color:#44ff88">✔ +${gained}</span>`;
    if (round % 4 === 0) chordSize = Math.min(3, chordSize + 1);
    if (round % 3 === 0) windowMs = Math.max(1100, windowMs - 80);
    nextChord();
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    if (running) return;
    score = 0;
    combo = 0;
    round = 0;
    chordSize = 2;
    windowMs = 2200;
    if (scoreEl) scoreEl.textContent = '0';
    if (comboEl) comboEl.textContent = '0';
    running = true;
    (startBtn as HTMLButtonElement).style.display = 'none';
    nextChord();
    raf = requestAnimationFrame(tickTimer);
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!running) return;
    if (!POOL.includes(e.code) && !chord.includes(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    display.querySelectorAll('.ck-key').forEach((node) => {
      const el = node as HTMLElement;
      el.classList.toggle('ck-down', down.has(el.dataset.code || ''));
    });
    checkChord();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    down.delete(e.code);
    display.querySelectorAll('.ck-key').forEach((node) => {
      const el = node as HTMLElement;
      el.classList.toggle('ck-down', down.has(el.dataset.code || ''));
    });
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  cleanup = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
  };
}

export function stop() {
  if (cleanup) cleanup();
  cleanup = null;
}
