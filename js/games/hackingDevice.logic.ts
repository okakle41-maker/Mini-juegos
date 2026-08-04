/**
 * hackingDevice.logic.ts
 *
 * Lógica pesada extraída de hackingDevice.ts para lazy loading —
 * ver `logic` en hackingDevice.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
 *
 * Mecánica (rediseño): en vez de clickear directamente la celda con el
 * código objetivo, el jugador controla un CURSOR de N celdas
 * consecutivas en una fila (N = cantidad de códigos en la secuencia
 * objetivo, ej. 4 códigos de 2 caracteres cada uno) que se mueve como
 * bloque por la grilla con flechas/WASD (con wraparound en ambos
 * ejes). Se confirma con Enter/Espacio: gana la ronda si, en ese
 * instante, las N celdas bajo el cursor son exactamente los N códigos
 * del objetivo, en ese orden.
 *
 * Las celdas objetivo (las que contienen cada código del objetivo,
 * dispersas por la grilla) SIEMPRE fluyen en diagonal (abajo-derecha →
 * arriba-izquierda, con wraparound) tick a tick. El resto de la grilla
 * depende del modo elegido:
 *   - 'flow'   (default): toda la grilla fluye junto con el mismo
 *     desplazamiento diagonal, como un único bloque.
 *   - 'random': el resto de celdas (todo menos las del objetivo) se
 *     reordena/baraja entre sí cada tick — las celdas objetivo siguen
 *     fluyendo en diagonal igual que en 'flow', son las únicas que
 *     mantienen movimiento predecible.
 */

import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';

interface HackingUi {
  start: HTMLButtonElement;
  hackingBoard: HTMLElement;
  hackingSize: HTMLInputElement;
  hackingLength: HTMLInputElement;
  hackingTime: HTMLInputElement;
  hackingRounds: HTMLInputElement;
  hackingMoveMode: HTMLSelectElement | null;
  hackingHighlightTarget: HTMLInputElement | null;
  hackingStreak: HTMLElement;
  hackingMax: HTMLElement;
  hackingTimer: HTMLElement;
  hackingTarget: HTMLElement;
  hackingControlsHint: HTMLElement | null;
  hackingInfo: HTMLElement;
}

type MoveMode = 'flow' | 'random';

/** Una celda-objetivo: posición actual en la grilla + qué código (de la secuencia) representa. */
interface TargetCell {
  r: number;
  c: number;
  code: string;
  index: number;
}

interface HackingState {
  targetCodes: string[]; // secuencia completa, ej. ['NM','YK','BO','LW']
  grid: string[][];
  size: number;
  length: number; // longitud de cada código (2 caracteres normalmente)
  time: number;
  rounds: number;
  currentRound: number;
  streak: number;
  maxStreak: number;
  timer: ReturnType<typeof setInterval> | null;
  timeLeft: number;
  playing: boolean;
  targets: TargetCell[];
  moveTimer: ReturnType<typeof setInterval> | null;
  moveInterval: number;
  moveMode: MoveMode;
  /** Columna inicial del cursor — el cursor ocupa [cursorCol, cursorCol+N-1] en cursorRow, con wrap. */
  cursorRow: number;
  cursorCol: number;
  roundTransitionTimeout: ReturnType<typeof setTimeout> | null;
}

let activeState: HackingState | null = null; // referencia al state activo, usada por stop()
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

const CHAR_POOL_CLASS: Record<string, string> = {
  cyrillic: 'cyrillic',
  arabic: 'arabic',
  chinese: 'cjk'
};

export function init(rawUi: GameUi): void {
  const ui = rawUi as unknown as HackingUi;
  const { start: startHacking, hackingBoard, hackingSize, hackingLength,
          hackingTime, hackingRounds, hackingMoveMode, hackingHighlightTarget,
          hackingStreak, hackingMax, hackingTimer, hackingTarget,
          hackingControlsHint, hackingInfo } = ui;

  if (!startHacking) return; // sección no presente

  hackingBoard.after(startHacking);
  if (hackingControlsHint) hackingControlsHint.classList.remove('hidden');

  const pools: Record<string, string> = {
    letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '✉☢✦☮♆☎♞♫☚✧✪✦✶',
    greek: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩψσπφ',
    runes: 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ',
    braille: '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚',
    cyrillic: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
    arabic: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
    chinese: '中国人大小天地山水火木金土日月东西南北上下左右文字学生力心手目'
  };

  const state: HackingState = {
    targetCodes: [],
    grid: [],
    size: 10,
    length: 2,
    time: 15,
    rounds: 5,
    currentRound: 0,
    streak: 0,
    maxStreak: 0,
    timer: null,
    timeLeft: 0,
    playing: false,
    targets: [],
    moveTimer: null,
    moveInterval: 1100,
    moveMode: 'flow',
    cursorRow: 0,
    cursorCol: 0,
    roundTransitionTimeout: null
  };
  activeState = state;

  function getSelectedPools(): string {
    const opts = Array.from(
      document.getElementById('soup')!.querySelectorAll<HTMLElement>('.symbol-chip.active')
    ).map(el => el.dataset.value || '');
    let chars = '';
    opts.forEach(k => {
      if (pools[k]) chars += pools[k];
    });
    if (!chars) {
      chars = pools.letters + pools.numbers;
    }
    return chars;
  }

  /** Clase CSS de tipografía especial a aplicar según los pools activos (cirílico/árabe/chino tienen fuente definida en css/hacking.css; griego/runas/braille/símbolos no la necesitan). */
  function getActivePoolClass(): string {
    const active = Array.from(
      document.getElementById('soup')!.querySelectorAll<HTMLElement>('.symbol-chip.active')
    ).map(el => el.dataset.value || '');
    for (const key of active) {
      if (CHAR_POOL_CLASS[key]) return CHAR_POOL_CLASS[key];
    }
    return '';
  }

  document.getElementById('soup')!.querySelectorAll<HTMLElement>('.symbol-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', String(isActive));
    });
  });

  function randomChar(chars: string): string {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  function randomCode(chars: string): string {
    let code = '';
    for (let i = 0; i < state.length; i++) code += randomChar(chars);
    return code;
  }

  function wrap(n: number, size: number): number {
    return ((n % size) + size) % size;
  }

  /** Genera la secuencia objetivo (4 códigos, mismo ancho que el cursor) y ubica cada código en una celda dispersa distinta. */
  function generateTargets(): void {
    const chars = getSelectedPools();
    const count = 4; // cantidad fija de códigos en la secuencia, igual al ancho del cursor
    state.targetCodes = [];
    state.targets = [];

    const usedPositions = new Set<string>();
    for (let i = 0; i < count; i++) {
      const code = randomCode(chars);
      state.targetCodes.push(code);

      let r = 0, c = 0, attempts = 0;
      do {
        r = Math.floor(Math.random() * state.size);
        c = Math.floor(Math.random() * state.size);
        attempts += 1;
      } while (usedPositions.has(`${r},${c}`) && attempts < 50);
      usedPositions.add(`${r},${c}`);

      state.targets.push({ r, c, code, index: i });
    }

    const strong = hackingTarget.querySelector('strong');
    if (strong) strong.textContent = state.targetCodes.join('  ');
    const showTarget = !hackingHighlightTarget || hackingHighlightTarget.checked;
    hackingTarget.classList.toggle('hidden', !showTarget);
  }

  function createGrid(): void {
    state.grid = [];
    const chars = getSelectedPools();
    for (let r = 0; r < state.size; r++) {
      const row: string[] = [];
      for (let c = 0; c < state.size; c++) {
        row.push(randomCode(chars));
      }
      state.grid.push(row);
    }
    // Las celdas objetivo pisan lo que haya en su posición actual.
    state.targets.forEach(t => {
      state.grid[t.r][t.c] = t.code;
    });
  }

  function cursorCells(): Array<{ r: number; c: number }> {
    const width = state.targetCodes.length || 4;
    const cells: Array<{ r: number; c: number }> = [];
    for (let i = 0; i < width; i++) {
      cells.push({ r: state.cursorRow, c: wrap(state.cursorCol + i, state.size) });
    }
    return cells;
  }

  function renderBoard(): void {
    hackingBoard.innerHTML = '';
    hackingBoard.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    const poolClass = getActivePoolClass();
    const cursor = cursorCells();
    const cursorSet = new Set(cursor.map(p => `${p.r},${p.c}`));

    state.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const div = document.createElement('div');
        div.className = 'symbol-cell';
        if (poolClass) div.classList.add(poolClass);

        div.innerHTML = Array.from(cell)
          .map(ch => `<span>${ch}</span>`)
          .join('');

        div.dataset.pos = `${r},${c}`;
        if (cursorSet.has(`${r},${c}`)) div.classList.add('cursor');
        hackingBoard.appendChild(div);
      });
    });
    hackingBoard.classList.remove('hidden');
  }

  /** Desplaza en diagonal (abajo-derecha → arriba-izquierda) las celdas objetivo, con wraparound. */
  function advanceTargetsDiagonally(): void {
    state.targets.forEach(t => {
      t.r = wrap(t.r - 1, state.size);
      t.c = wrap(t.c - 1, state.size);
    });
  }

  /** Modo 'flow': toda la grilla se desplaza junto con el mismo offset diagonal que las celdas objetivo, sin regenerar contenido random (cada celda hereda el valor de su vecina abajo-derecha). */
  function shiftGridDiagonally(): void {
    const size = state.size;
    const newGrid: string[][] = Array.from({ length: size }, () => new Array(size).fill(''));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const sourceR = wrap(r + 1, size);
        const sourceC = wrap(c + 1, size);
        newGrid[r][c] = state.grid[sourceR][sourceC];
      }
    }
    state.grid = newGrid;
  }

  /** Modo 'random': baraja el contenido de todas las celdas que NO son celda-objetivo (Fisher-Yates sobre sus valores, posiciones fijas). */
  function shuffleNonTargetCells(): void {
    const targetPositions = new Set(state.targets.map(t => `${t.r},${t.c}`));
    const positions: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (!targetPositions.has(`${r},${c}`)) positions.push({ r, c });
      }
    }
    const values = positions.map(p => state.grid[p.r][p.c]);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    positions.forEach((p, i) => {
      state.grid[p.r][p.c] = values[i];
    });
  }

  function moveStep(): void {
    advanceTargetsDiagonally();
    if (state.moveMode === 'flow') {
      shiftGridDiagonally();
    } else {
      shuffleNonTargetCells();
    }
    // Las celdas objetivo siempre pisan su nueva posición con su código,
    // en ambos modos — así nunca quedan tapadas por el shift/shuffle de
    // fondo (el shift diagonal ya las arrastra correctamente, pero esto
    // es un refuerzo barato y evita depender de ese detalle de orden).
    state.targets.forEach(t => {
      state.grid[t.r][t.c] = t.code;
    });
    renderBoard();
  }

  function moveCursor(dr: number, dc: number): void {
    if (!state.playing) return;
    if (dr !== 0) state.cursorRow = wrap(state.cursorRow + dr, state.size);
    if (dc !== 0) state.cursorCol = wrap(state.cursorCol + dc, state.size);
    renderBoard();
  }

  function attemptConfirm(): void {
    if (!state.playing) return;
    const cells = cursorCells();
    const read = cells.map(p => state.grid[p.r][p.c]);
    const isCorrect = read.length === state.targetCodes.length
      && read.every((val, i) => val === state.targetCodes[i]);

    if (isCorrect) {
      audioManager.play('good');
      state.streak += 1;
      state.maxStreak = Math.max(state.maxStreak, state.streak);
      hackingStreak.textContent = `STREAK: ${state.streak}`;
      hackingMax.textContent = `MAX STREAK: ${state.maxStreak}`;
      hackingInfo.textContent = `¡Correcto! Generando nuevo tablero...`;
      markCorrectFlash();
      resetTimer();
      state.roundTransitionTimeout = setTimeout(() => {
        state.roundTransitionTimeout = null;
        nextRound(true);
      }, 600);
    } else {
      audioManager.play('miss');
      hackingInfo.textContent = `Incorrecto. Seguí buscando.`;
      markWrongFlash();
    }
  }

  function markCorrectFlash(): void {
    cursorCells().forEach(p => {
      const el = hackingBoard.querySelector<HTMLElement>(`[data-pos="${p.r},${p.c}"]`);
      el?.classList.add('correct');
    });
  }

  function markWrongFlash(): void {
    cursorCells().forEach(p => {
      const el = hackingBoard.querySelector<HTMLElement>(`[data-pos="${p.r},${p.c}"]`);
      el?.classList.add('wrong');
    });
    setTimeout(() => {
      cursorCells().forEach(p => {
        const el = hackingBoard.querySelector<HTMLElement>(`[data-pos="${p.r},${p.c}"]`);
        el?.classList.remove('wrong');
      });
    }, 350);
  }

  function updateTimerDisplay(): void {
    hackingTimer.textContent = `TIEMPO: ${state.timeLeft.toFixed(1)}s`;
  }

  function tick(): void {
    state.timeLeft -= 0.1;
    if (state.timeLeft <= 0) {
      if (state.timer) clearInterval(state.timer);
      state.timer = null;
      if (state.roundTransitionTimeout) { clearTimeout(state.roundTransitionTimeout); state.roundTransitionTimeout = null; }
      hackingInfo.textContent = `Tiempo agotado. Ronda finalizada.`;
      state.streak = 0;
      hackingStreak.textContent = `STREAK: ${state.streak}`;
      state.playing = false;
      startHacking.disabled = false;
      audioManager.play('gameover');
      if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
      if (window.Leaderboard) window.Leaderboard.save('soup', state.maxStreak);
      return;
    }
    updateTimerDisplay();
  }

  function resetTimer(): void {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    state.timeLeft = state.time;
    updateTimerDisplay();
    state.timer = setInterval(tick, 100);
    if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
    state.moveTimer = setInterval(moveStep, state.moveInterval);
  }

  function nextRound(found: boolean): void {
    if (found) state.currentRound += 1;
    if (state.currentRound >= state.rounds) {
      hackingInfo.textContent = `¡Completaste ${state.rounds} rondas! Puntuación: ${state.streak}`;
      state.playing = false;
      startHacking.disabled = false;
      audioManager.play('perfect');
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
      if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
      if (state.roundTransitionTimeout) { clearTimeout(state.roundTransitionTimeout); state.roundTransitionTimeout = null; }
      if (window.Leaderboard) window.Leaderboard.save('soup', state.maxStreak);
      return;
    }

    generateTargets();
    createGrid();
    state.cursorRow = Math.floor(state.size / 2);
    state.cursorCol = 0;
    renderBoard();
    resetTimer();
    hackingInfo.textContent = `Ronda ${state.currentRound + 1}/${state.rounds}. Alineá el cursor con el objetivo y confirmá.`;
  }

  keydownHandler = (e: KeyboardEvent) => {
    if (!state.playing) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') { e.preventDefault(); moveCursor(-1, 0); }
    else if (key === 'arrowdown' || key === 's') { e.preventDefault(); moveCursor(1, 0); }
    else if (key === 'arrowleft' || key === 'a') { e.preventDefault(); moveCursor(0, -1); }
    else if (key === 'arrowright' || key === 'd') { e.preventDefault(); moveCursor(0, 1); }
    else if (key === 'enter' || key === ' ') { e.preventDefault(); attemptConfirm(); }
  };
  document.addEventListener('keydown', keydownHandler);

  startHacking.addEventListener('click', () => {
    state.size = Math.max(6, Math.min(parseInt(hackingSize.value, 10) || 10, 20));
    state.length = Math.max(1, Math.min(parseInt(hackingLength.value, 10) || 2, 4));
    state.time = Math.max(1, Math.min(parseInt(hackingTime.value, 10) || 15, 60));
    state.rounds = Math.max(1, Math.min(parseInt(hackingRounds.value, 10) || 5, 50));
    state.moveMode = (hackingMoveMode?.value as MoveMode) || 'flow';
    state.currentRound = 0;
    state.streak = 0;
    state.maxStreak = 0;
    hackingStreak.textContent = `STREAK: ${state.streak}`;
    hackingMax.textContent = `MAX STREAK: ${state.maxStreak}`;
    state.playing = true;
    startHacking.disabled = true;
    nextRound(false);
  });
}

export function stop(): void {
  const state = activeState;
  if (state) {
    state.playing = false;
    if (state.timer)     { clearInterval(state.timer);     state.timer = null; }
    if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
    if (state.roundTransitionTimeout) { clearTimeout(state.roundTransitionTimeout); state.roundTransitionTimeout = null; }
  }
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
}
