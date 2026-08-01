/**
 * hackingDevice.logic.ts
 *
 * Lógica pesada extraída de hackingDevice.ts para lazy loading —
 * ver `logic` en hackingDevice.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
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
  hackingMoveAll: HTMLInputElement | null;
  hackingHighlightTarget: HTMLInputElement | null;
  hackingStreak: HTMLElement;
  hackingMax: HTMLElement;
  hackingTimer: HTMLElement;
  hackingTarget: HTMLElement;
  hackingInfo: HTMLElement;
}

interface HackingInstance {
  r: number;
  c: number;
  text: string;
}

interface HackingState {
  target: string;
  grid: string[][];
  size: number;
  length: number;
  time: number;
  rounds: number;
  currentRound: number;
  streak: number;
  maxStreak: number;
  timer: ReturnType<typeof setInterval> | null;
  timeLeft: number;
  playing: boolean;
  instances: HackingInstance[];
  moveTimer: ReturnType<typeof setInterval> | null;
  moveInterval: number;
  moveAll: boolean;
  /** setTimeout entre acertar una celda y pasar a la siguiente ronda
   *  (nextRound). Sin trackear, si stop() se llamaba dentro de esos
   *  600ms, este timeout igual disparaba después y llamaba
   *  nextRound(true) — que genera un tablero nuevo y arranca los
   *  intervals de nuevo (resetTimer) sobre una vista ya cerrada. */
  roundTransitionTimeout: ReturnType<typeof setTimeout> | null;
}

let activeState: HackingState | null = null; // referencia al state activo, usada por stop()

export function init(rawUi: GameUi): void {
  const ui = rawUi as unknown as HackingUi;
  const { start: startHacking, hackingBoard, hackingSize, hackingLength,
          hackingTime, hackingRounds, hackingMoveAll, hackingHighlightTarget,
          hackingStreak, hackingMax, hackingTimer, hackingTarget, hackingInfo } = ui;

  if (!startHacking) return; // sección no presente

  hackingBoard.after(startHacking);

  const pools: Record<string, string> = {
    letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '✉☢✦☮♆☎♞♫☚✧✪✦✶',
    greek: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩψσπφ',
    runes: 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ',
    braille: '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚',
    cyrillic: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
    arabic: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
    chinese:'中国人大小天地山水火木金土日月东西南北上下左右文字学生力心手目'
  };

  const state: HackingState = {
    target: '',
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
    instances: [],
    moveTimer: null,
    moveInterval: 1100,
    moveAll: false,
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

  document.getElementById('soup')!.querySelectorAll<HTMLElement>('.symbol-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', String(isActive));
    });
  });

  function randomChar(chars: string): string {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  function generateTarget(): void {
    const chars = getSelectedPools();
    let t = '';
    for (let i = 0; i < state.length; i++) t += randomChar(chars);
    state.target = t;
    const strong = hackingTarget.querySelector('strong');
    if (strong) strong.innerHTML = Array.from(t).join('<br>');
  }

  function createGrid(): void {
    state.grid = [];
    const chars = getSelectedPools();
    for (let r = 0; r < state.size; r++) {
      const row: string[] = [];
      for (let c = 0; c < state.size; c++) {
        let cell = '';
        let attempts = 0;
        do {
          cell = cell.trim();
          for (let k = 0; k < state.length; k++) cell += randomChar(chars);
          attempts += 1;
          if (attempts > 8) break;
        } while (state.target && cell === state.target);
        row.push(cell);
      }
      state.grid.push(row);
    }

    state.instances.forEach(inst => {
      const rr = ((inst.r % state.size) + state.size) % state.size;
      const rc = ((inst.c % state.size) + state.size) % state.size;
      state.grid[rr][rc] = inst.text;
    });
  }

  function renderBoard(): void {
    hackingBoard.innerHTML = '';
    hackingBoard.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    state.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const btn = document.createElement('button');
        btn.className = 'symbol-cell';
        btn.type = 'button';

        btn.innerHTML = Array.from(cell)
          .map(ch => `<span>${ch}</span>`)
          .join('');

        btn.dataset.pos = `${r},${c}`;
        btn.addEventListener('click', () => onCellClick(r, c, btn));
        const shouldHighlight = !!(hackingHighlightTarget && hackingHighlightTarget.checked && cell === state.target);
        if (shouldHighlight) btn.classList.add('highlight');
        hackingBoard.appendChild(btn);
      });
    });
    hackingBoard.classList.remove('hidden');
  }

  function initInstances(): void {
    state.instances = [];
    const inst: HackingInstance = {
      r: Math.floor(Math.random() * state.size),
      c: Math.floor(Math.random() * state.size),
      text: state.target
    };
    state.instances.push(inst);
  }

  function moveInstancesStep(): void {
    if (state.moveAll) {
      shiftWholeBoard();
    } else {
      state.instances.forEach(inst => {
        inst.c -= 1;
        if (inst.c < 0) {
          inst.r -= 1;
          inst.c = state.size - 1;
        }
        if (inst.r < 0) {
          inst.r = state.size - 1;
          inst.c = state.size - 1;
        }
      });
      createGrid();
    }
    renderBoard();
  }

  function onCellClick(r: number, c: number, el: HTMLButtonElement): void {
    if (!state.playing) return;
    const val = state.grid[r][c];
    if (val === state.target) {
      el.classList.add('correct');
      audioManager.play('good');
      state.streak += 1;
      state.maxStreak = Math.max(state.maxStreak, state.streak);
      hackingStreak.textContent = `STREAK: ${state.streak}`;
      hackingMax.textContent = `MAX STREAK: ${state.maxStreak}`;
      hackingInfo.textContent = `¡Correcto! Generando nuevo tablero...`;
      resetTimer();
      state.roundTransitionTimeout = setTimeout(() => {
        state.roundTransitionTimeout = null;
        nextRound(true);
      }, 600);
    } else {
      el.classList.add('wrong');
      audioManager.play('miss');
      hackingInfo.textContent = `Incorrecto.`;
    }
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
    moveInstancesStep();
    state.moveTimer = setInterval(moveInstancesStep, state.moveInterval);
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

    generateTarget();
    initInstances();
    createGrid();
    renderBoard();
    resetTimer();
    hackingInfo.textContent = `Ronda ${state.currentRound + 1}/${state.rounds}. Busca el patrón.`;
  }

  function shiftWholeBoard(): void {
    const flat = state.grid.flat();
    const first = flat.shift();
    if (first !== undefined) flat.push(first);
    state.grid = [];
    for (let r = 0; r < state.size; r++) {
      state.grid.push(
        flat.slice(
          r * state.size,
          (r + 1) * state.size
        )
      );
    }
  }

  startHacking.addEventListener('click', () => {
    state.size = Math.max(5, Math.min(parseInt(hackingSize.value, 10) || 10, 20));
    state.length = Math.max(1, Math.min(parseInt(hackingLength.value, 10) || 2, 4));
    state.time = Math.max(1, Math.min(parseInt(hackingTime.value, 10) || 15, 60));
    state.rounds = Math.max(1, Math.min(parseInt(hackingRounds.value, 10) || 5, 50));
    state.moveAll = !!(hackingMoveAll && hackingMoveAll.checked);
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
  if (!state) return;
  state.playing = false;
  if (state.timer)     { clearInterval(state.timer);     state.timer = null; }
  if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
  if (state.roundTransitionTimeout) { clearTimeout(state.roundTransitionTimeout); state.roundTransitionTimeout = null; }
}

