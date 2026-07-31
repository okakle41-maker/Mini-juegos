/**
 * Lane Dodge — 3 carriles; esquivá obstáculos con ← → / A D.
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

let cleanup: (() => void) | null = null;

export function init() {
  const track = document.getElementById('ldTrack');
  const player = document.getElementById('ldPlayer');
  const startBtn = document.getElementById('ldStart');
  const result = document.getElementById('ldResult');
  if (!track || !player || !startBtn || !result) return;

  const scoreEl = document.getElementById('ldScore');
  const bestEl = document.getElementById('ldBest');

  let running = false;
  let lane = 1;
  let score = 0;
  let speed = 2.4;
  let spawnEvery = 70;
  let frame = 0;
  let raf: number | null = null;
  let best = safeStorage.getNumber('lanedodgeBest', 0);
  type Obs = { el: HTMLElement; lane: number; y: number };
  let obstacles: Obs[] = [];

  if (bestEl) bestEl.textContent = String(best);

  function paintPlayer() {
    player.style.setProperty('--ld-lane', String(lane));
    player.className = `ld-player ld-lane-${lane}`;
  }

  function clearObs() {
    obstacles.forEach((o) => o.el.remove());
    obstacles = [];
  }

  function endGame() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    audioManager.play('gameover');
    result.innerHTML = `<span style="color:#ff5555">✖ Choque<br>Score: ${score}</span>`;
    if (score > best) {
      best = score;
      safeStorage.setNumber('lanedodgeBest', best);
      if (bestEl) bestEl.textContent = String(best);
    }
    if (window.Leaderboard) window.Leaderboard.save('lanedodge', score);
    (startBtn as HTMLButtonElement).style.display = '';
  }

  function spawn() {
    const el = document.createElement('div');
    el.className = 'ld-obs';
    const obsLane = Math.floor(Math.random() * 3);
    el.classList.add(`ld-lane-${obsLane}`);
    track.appendChild(el);
    obstacles.push({ el, lane: obsLane, y: -12 });
  }

  function tick() {
    if (!running) return;
    frame++;
    if (frame % spawnEvery === 0) spawn();
    if (frame % 180 === 0) {
      speed = Math.min(6, speed + 0.25);
      spawnEvery = Math.max(32, spawnEvery - 3);
    }

    const hitY = 78;
    const next: Obs[] = [];
    for (const o of obstacles) {
      o.y += speed * 0.55;
      o.el.style.top = `${o.y}%`;
      if (o.y > 110) {
        o.el.remove();
        score += 10;
        if (scoreEl) scoreEl.textContent = String(score);
        continue;
      }
      if (o.lane === lane && o.y > hitY - 6 && o.y < hitY + 8) {
        endGame();
        return;
      }
      next.push(o);
    }
    obstacles = next;
    score += 1;
    if (scoreEl) scoreEl.textContent = String(score);
    raf = requestAnimationFrame(tick);
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    if (running) return;
    score = 0;
    lane = 1;
    speed = 2.4;
    spawnEvery = 70;
    frame = 0;
    clearObs();
    paintPlayer();
    if (scoreEl) scoreEl.textContent = '0';
    result.textContent = '← → o A D para moverte';
    running = true;
    (startBtn as HTMLButtonElement).style.display = 'none';
    raf = requestAnimationFrame(tick);
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!running) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      lane = Math.max(0, lane - 1);
      paintPlayer();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      lane = Math.min(2, lane + 1);
      paintPlayer();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  paintPlayer();

  cleanup = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    clearObs();
    document.removeEventListener('keydown', onKeyDown);
  };
}

export function stop() {
  if (cleanup) cleanup();
  cleanup = null;
}
