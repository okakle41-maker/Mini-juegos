/**
 * Pipe Align — girá segmentos de tubería hasta conectar entrada → salida.
 * Cada nivel genera un camino solución y luego desordena rotaciones.
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

let cleanup: (() => void) | null = null;

/** bitmask: N=1 E=2 S=4 W=8 */
type Cell = { mask: number; rot: number };

const STRAIGHT_NS = 5; // N+S
const STRAIGHT_EW = 10; // E+W
const ELBOW_NE = 3; // N+E
const CROSS = 15;
const FILLERS = [STRAIGHT_NS, ELBOW_NE, 7 /* tee */, CROSS];

function rotateMask(mask: number, steps: number): number {
  let m = mask;
  for (let i = 0; i < ((steps % 4) + 4) % 4; i++) {
    m = ((m << 1) | ((m >> 3) & 1)) & 15;
  }
  return m;
}

function dirs(mask: number): { n: boolean; e: boolean; s: boolean; w: boolean } {
  return { n: !!(mask & 1), e: !!(mask & 2), s: !!(mask & 4), w: !!(mask & 8) };
}

/** Dado un mask “canónico”, encuentra rotaciones que lo produzcan. */
function baseAndRot(effective: number): { mask: number; rot: number } {
  const bases = [STRAIGHT_NS, ELBOW_NE, 7, CROSS, STRAIGHT_EW];
  for (const base of bases) {
    for (let rot = 0; rot < 4; rot++) {
      if (rotateMask(base, rot) === effective) return { mask: base, rot };
    }
  }
  return { mask: CROSS, rot: 0 };
}

function glyph(mask: number): string {
  switch (mask) {
    case 5:
    case 10:
      return '║';
    case 3:
    case 6:
    case 12:
    case 9:
      return '╚';
    case 7:
    case 14:
    case 13:
    case 11:
      return '╠';
    case 15:
      return '╬';
    default:
      return '·';
  }
}

function pipeFor(inDir: 'n' | 'e' | 's' | 'w' | null, outDir: 'n' | 'e' | 's' | 'w' | null): number {
  const bit = { n: 1, e: 2, s: 4, w: 8 };
  let mask = 0;
  if (inDir) mask |= bit[inDir];
  if (outDir) mask |= bit[outDir];
  if (!mask) mask = CROSS;
  return mask;
}

const OPP = { n: 's', e: 'w', s: 'n', w: 'e' } as const;
const DELTA = { n: [-1, 0], e: [0, 1], s: [1, 0], w: [0, -1] } as const;

export function init() {
  const gridElRef = document.getElementById('paGrid');
  const startBtn = document.getElementById('paStart');
  const resultRef = document.getElementById('paResult');
  const timerFill = document.getElementById('paTimerFill');
  if (!gridElRef || !startBtn || !resultRef || !timerFill) return;

  // Ver mismo motivo en rhythmclick.logic.ts: closures más abajo
  // necesitan el tipo ya no-nulo, TS no propaga el narrowing del if
  // de arriba hacia adentro de funciones anidadas.
  const gridEl: HTMLElement = gridElRef;
  const result: HTMLElement = resultRef;

  const scoreEl = document.getElementById('paScore');
  const levelEl = document.getElementById('paLevel');
  const bestEl = document.getElementById('paBest');

  let running = false;
  let size = 3;
  let grid: Cell[][] = [];
  let score = 0;
  let level = 1;
  let timeLeft = 45;
  let timer: ReturnType<typeof setInterval> | null = null;
  let best = safeStorage.getNumber('pipealignBest', 0);
  let startCell = { r: 0, c: 0 };
  let endCell = { r: 2, c: 2 };
  let wonLock = false;

  if (bestEl) bestEl.textContent = String(best);

  function effective(cell: Cell): number {
    return rotateMask(cell.mask, cell.rot);
  }

  function connected(): boolean {
    const key = (r: number, c: number) => `${r},${c}`;
    const seen = new Set<string>();
    const q: Array<{ r: number; c: number }> = [startCell];
    seen.add(key(startCell.r, startCell.c));

    while (q.length) {
      const cur = q.shift()!;
      if (cur.r === endCell.r && cur.c === endCell.c) return true;
      const d = dirs(effective(grid[cur.r][cur.c]));
      (['n', 'e', 's', 'w'] as const).forEach((dir) => {
        if (!d[dir]) return;
        const [dr, dc] = DELTA[dir];
        const nr = cur.r + dr;
        const nc = cur.c + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) return;
        const nd = dirs(effective(grid[nr][nc]));
        if (!nd[OPP[dir]]) return;
        const k = key(nr, nc);
        if (seen.has(k)) return;
        seen.add(k);
        q.push({ r: nr, c: nc });
      });
    }
    return false;
  }

  function highlightPath() {
    gridEl.querySelectorAll('.pa-cell').forEach((el) => el.classList.remove('pa-on'));
    if (!connected()) return;

    const key = (r: number, c: number) => `${r},${c}`;
    const prev = new Map<string, string | null>();
    const q: Array<{ r: number; c: number }> = [startCell];
    prev.set(key(startCell.r, startCell.c), null);

    while (q.length) {
      const cur = q.shift()!;
      if (cur.r === endCell.r && cur.c === endCell.c) break;
      const d = dirs(effective(grid[cur.r][cur.c]));
      (['n', 'e', 's', 'w'] as const).forEach((dir) => {
        if (!d[dir]) return;
        const [dr, dc] = DELTA[dir];
        const nr = cur.r + dr;
        const nc = cur.c + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) return;
        const nd = dirs(effective(grid[nr][nc]));
        if (!nd[OPP[dir]]) return;
        const k = key(nr, nc);
        if (prev.has(k)) return;
        prev.set(k, key(cur.r, cur.c));
        q.push({ r: nr, c: nc });
      });
    }

    let curKey: string | null = key(endCell.r, endCell.c);
    while (curKey) {
      const [r, c] = curKey.split(',').map(Number);
      gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`)?.classList.add('pa-on');
      curKey = prev.get(curKey) ?? null;
    }
  }

  function render() {
    gridEl.style.setProperty('--pa-size', String(size));
    gridEl.innerHTML = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = grid[r][c];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pa-cell';
        btn.dataset.r = String(r);
        btn.dataset.c = String(c);
        if (r === startCell.r && c === startCell.c) btn.classList.add('pa-start');
        if (r === endCell.r && c === endCell.c) btn.classList.add('pa-end');
        btn.textContent = glyph(cell.mask);
        btn.style.transform = `rotate(${cell.rot * 90}deg)`;
        btn.setAttribute('aria-label', `Tubo fila ${r + 1} columna ${c + 1}`);
        btn.addEventListener('click', () => {
          if (!running || wonLock) return;
          cell.rot = (cell.rot + 1) % 4;
          btn.style.transform = `rotate(${cell.rot * 90}deg)`;
          audioManager.play('click');
          highlightPath();
          if (connected()) winLevel();
        });
        gridEl.appendChild(btn);
      }
    }
    highlightPath();
  }

  /** Camino aleatorio de esquina a esquina + fillers; scramble de rotaciones. */
  function buildLevel() {
    startCell = { r: 0, c: 0 };
    endCell = { r: size - 1, c: size - 1 };

    const path: Array<{ r: number; c: number }> = [{ ...startCell }];
    let r = 0;
    let c = 0;
    while (r !== endCell.r || c !== endCell.c) {
      const canE = c < size - 1;
      const canS = r < size - 1;
      let dir: 'e' | 's';
      if (canE && canS) dir = Math.random() < 0.5 ? 'e' : 's';
      else if (canE) dir = 'e';
      else dir = 's';
      if (dir === 'e') c++;
      else r++;
      path.push({ r, c });
    }

    const needed: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    for (let i = 0; i < path.length; i++) {
      const cur = path[i];
      const prev = path[i - 1];
      const next = path[i + 1];
      let inDir: 'n' | 'e' | 's' | 'w' | null = null;
      let outDir: 'n' | 'e' | 's' | 'w' | null = null;

      if (prev) {
        if (prev.r < cur.r) inDir = 'n';
        else if (prev.r > cur.r) inDir = 's';
        else if (prev.c < cur.c) inDir = 'w';
        else inDir = 'e';
      }
      if (next) {
        if (next.r > cur.r) outDir = 's';
        else if (next.r < cur.r) outDir = 'n';
        else if (next.c > cur.c) outDir = 'e';
        else outDir = 'w';
      }

      // Extremos: agregar apertura “hacia afuera” para que el glifo no quede de 1 bit
      if (!inDir && outDir) inDir = OPP[outDir];
      if (!outDir && inDir) outDir = OPP[inDir];

      needed[cur.r][cur.c] = pipeFor(inDir, outDir);
    }

    grid = [];
    for (let rr = 0; rr < size; rr++) {
      const row: Cell[] = [];
      for (let cc = 0; cc < size; cc++) {
        if (needed[rr][cc]) {
          const { mask, rot } = baseAndRot(needed[rr][cc]);
          const scramble = (rot + 1 + Math.floor(Math.random() * 3)) % 4;
          row.push({ mask, rot: scramble });
        } else {
          const mask = FILLERS[Math.floor(Math.random() * FILLERS.length)];
          row.push({ mask, rot: Math.floor(Math.random() * 4) });
        }
      }
      grid.push(row);
    }

    if (connected()) {
      grid[startCell.r][startCell.c].rot = (grid[startCell.r][startCell.c].rot + 1) % 4;
    }

    render();
  }

  function winLevel() {
    if (!running || wonLock) return;
    wonLock = true;
    const bonus = Math.round(timeLeft * 8 + size * 40);
    score += bonus;
    if (scoreEl) scoreEl.textContent = String(score);
    audioManager.play('perfect');
    result.innerHTML = `<span style="color:#44ff88">✔ Conectado +${bonus}</span>`;
    level++;
    if (levelEl) levelEl.textContent = String(level);
    if (level % 2 === 0) size = Math.min(5, size + 1);
    timeLeft = Math.min(60, timeLeft + 12);
    setTimeout(() => {
      if (!running) return;
      wonLock = false;
      buildLevel();
    }, 450);
  }

  function endGame(msg: string) {
    running = false;
    wonLock = false;
    if (timer) clearInterval(timer);
    timer = null;
    audioManager.play('gameover');
    result.innerHTML = `<span style="color:#ff5555">${msg}<br>Score: ${score}</span>`;
    if (score > best) {
      best = score;
      safeStorage.setNumber('pipealignBest', best);
      if (bestEl) bestEl.textContent = String(best);
    }
    if (window.Leaderboard) window.Leaderboard.save('pipealign', score);
    (startBtn as HTMLButtonElement).style.display = '';
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    if (running) return;
    score = 0;
    level = 1;
    size = 3;
    timeLeft = 45;
    wonLock = false;
    if (scoreEl) scoreEl.textContent = '0';
    if (levelEl) levelEl.textContent = '1';
    result.textContent = 'Click en un tubo para girarlo';
    running = true;
    (startBtn as HTMLButtonElement).style.display = 'none';
    buildLevel();
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      timeLeft--;
      timerFill.style.width = `${(timeLeft / 60) * 100}%`;
      if (timeLeft <= 0) endGame('✖ Tiempo agotado');
    }, 1000);
    timerFill.style.width = '75%';
  });

  cleanup = () => {
    running = false;
    wonLock = false;
    if (timer) clearInterval(timer);
  };
}

export function stop() {
  if (cleanup) cleanup();
  cleanup = null;
}
