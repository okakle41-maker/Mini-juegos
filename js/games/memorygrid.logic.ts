/**
 * js/games/memorygrid.logic.ts
 *
 * Lógica pesada extraída de memorygrid.ts para lazy loading — ver
 * `logic` en memorygrid.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import GameHelpers from '../utils/gameHelpers.js';
import audioManager from '../audioManager.js';
interface MemoryGridInstance {
  stop: () => void;
}

interface MemoryGridConfig {
  size: number;
  minVal: number;
  maxVal: number;
  dirMode: string;
  allowRepeat: boolean;
  timeLimit: number;
  showPath: boolean;
  showHints: boolean;
  showTime: number;
  lives: number;
  useLives: boolean;
  allowUndo: boolean;
  addTraps: boolean;
  revealOnVisit: boolean;
  maxErrors: number;
  maxMoves: number;
  showSolutionOnEnd: boolean;
}

const DEFAULT_MEMORY_GRID_CONFIG: MemoryGridConfig = {
  size: 4,
  minVal: 1,
  maxVal: 3,
  dirMode: 'cardinal',
  allowRepeat: false,
  timeLimit: 60,
  showPath: true,
  showHints: false,
  showTime: 3000,
  lives: 3,
  useLives: true,
  allowUndo: true,
  addTraps: false,
  revealOnVisit: true,
  maxErrors: 0,
  maxMoves: 0,
  showSolutionOnEnd: true,
};

const CARDINAL = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

const DIAGONAL = [
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
];

const KNIGHT_OFFSETS = [
  { dx: 1, dy: 2 }, { dx: 2, dy: 1 }, { dx: 2, dy: -1 }, { dx: 1, dy: -2 },
  { dx: -1, dy: -2 }, { dx: -2, dy: -1 }, { dx: -2, dy: 1 }, { dx: -1, dy: 2 },
];

// clamp: ver GameHelpers.clamp (js/utils/gameHelpers.ts)
const intVal = (el: HTMLElement | null | undefined, d: number) => {
  const n = parseInt((el as HTMLInputElement | HTMLSelectElement | undefined)?.value ?? '', 10);
  return Number.isFinite(n) ? n : d;
};
const boolVal = (el: HTMLElement | null | undefined, d = false) =>
  (el ? !!(el as HTMLInputElement).checked : d);
const key = (x: number, y: number) => `${x},${y}`;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getDirections(dirMode: string) {
  if (dirMode === 'all8') return CARDINAL.concat(DIAGONAL);
  if (dirMode === 'knight') return KNIGHT_OFFSETS;
  return CARDINAL;
}

function stepDistance(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return Math.max(dx, dy);
}

function inBounds(x: number, y: number, size: number) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

function getValidMoves(from: { x: number; y: number }, value: number, size: number, dirMode: string, visited: Set<string> | null) {
  if (value <= 0) return [];

  if (dirMode === 'knight') {
    if (value !== 1) return [];
    return KNIGHT_OFFSETS
      .map(({ dx, dy }) => ({ x: from.x + dx, y: from.y + dy }))
      .filter(p => inBounds(p.x, p.y, size))
      .filter(p => !visited || !visited.has(key(p.x, p.y)));
  }

  const dirs = getDirections(dirMode);
  const moves: { x: number; y: number }[] = [];

  dirs.forEach(dir => {
    const tx = from.x + dir.dx * value;
    const ty = from.y + dir.dy * value;
    if (!inBounds(tx, ty, size)) return;
    const dest = { x: tx, y: ty };
    if (visited && visited.has(key(tx, ty))) return;
    moves.push(dest);
  });

  return moves;
}

function enumerateRawSteps(from: { x: number; y: number }, size: number, dirMode: string, minVal: number, maxVal: number) {
  const dirs = getDirections(dirMode);
  const steps: { to: { x: number; y: number }; value: number }[] = [];

  if (dirMode === 'knight') {
    KNIGHT_OFFSETS.forEach(({ dx, dy }) => {
      const tx = from.x + dx;
      const ty = from.y + dy;
      if (inBounds(tx, ty, size)) steps.push({ to: { x: tx, y: ty }, value: 1 });
    });
    return steps;
  }

  for (let v = minVal; v <= maxVal; v++) {
    dirs.forEach(dir => {
      const tx = from.x + dir.dx * v;
      const ty = from.y + dir.dy * v;
      if (inBounds(tx, ty, size)) steps.push({ to: { x: tx, y: ty }, value: v });
    });
  }

  return steps;
}

function buildFallbackPath(size: number) {
  const path = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  while (x < size - 1) {
    x++;
    path.push({ x, y });
  }
  while (y < size - 1) {
    y++;
    path.push({ x, y });
  }
  return path;
}

function generatePath(size: number, dirMode: string, minVal: number, maxVal: number, allowRepeat: boolean) {
  const end = { x: size - 1, y: size - 1 };

  for (let attempt = 0; attempt < 400; attempt++) {
    const path = [{ x: 0, y: 0 }];
    let pos = { x: 0, y: 0 };
    const visited = allowRepeat ? null : new Set([key(0, 0)]);
    const maxSteps = size * size * 4;

    for (let step = 0; step < maxSteps; step++) {
      if (pos.x === end.x && pos.y === end.y) return path;

      const candidates = enumerateRawSteps(pos, size, dirMode, minVal, maxVal)
        .filter(({ to }) => !visited || !visited.has(key(to.x, to.y)))
        .filter(({ to }) => manhattan(to, end) <= manhattan(pos, end) || Math.random() < 0.25);

      if (candidates.length === 0) break;

      const choice = pick(candidates);
      path.push({ ...choice.to });
      pos = choice.to;
      if (visited) visited.add(key(pos.x, pos.y));
    }

    if (pos.x === end.x && pos.y === end.y) return path;
  }

  return buildFallbackPath(size);
}

function assignValuesFromPath(path: { x: number; y: number }[], size: number, minVal: number, maxVal: number, dirMode: string) {
  const values = Array.from({ length: size }, () => Array(size).fill(0));

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    if (dirMode === 'knight') {
      values[from.y][from.x] = 1;
    } else {
      values[from.y][from.x] = stepDistance(from, to);
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (values[y][x] === 0) {
        values[y][x] = randInt(minVal, maxVal);
      }
    }
  }

  values[size - 1][size - 1] = 0;
  return values;
}

function generateBoard(cfg: Pick<MemoryGridConfig, 'size' | 'minVal' | 'maxVal' | 'dirMode' | 'allowRepeat' | 'addTraps'>) {
  const { size, minVal, maxVal, dirMode, allowRepeat, addTraps } = cfg;

  for (let attempt = 0; attempt < 60; attempt++) {
    const path = generatePath(size, dirMode, minVal, maxVal, allowRepeat);
    const values = assignValuesFromPath(path, size, minVal, maxVal, dirMode);

    if (addTraps) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if ((x === 0 && y === 0) || (x === size - 1 && y === size - 1)) continue;
          if (Math.random() < 0.18) values[y][x] = randInt(minVal, maxVal);
        }
      }
    }

    if (verifySolution(values, path, size, dirMode, allowRepeat)) {
      return { values, solutionPath: path };
    }
  }

  const path = buildFallbackPath(size);
  return {
    values: assignValuesFromPath(path, size, minVal, maxVal, dirMode),
    solutionPath: path,
  };
}

function verifySolution(values: number[][], path: { x: number; y: number }[], size: number, dirMode: string, allowRepeat: boolean) {
  if (!path.length) return false;
  let pos = { ...path[0] };
  const visited = allowRepeat ? null : new Set([key(pos.x, pos.y)]);

  for (let i = 1; i < path.length; i++) {
    const next = path[i];
    const v = values[pos.y][pos.x];
    const moves = getValidMoves(pos, v, size, dirMode, visited);
    if (!moves.some(m => m.x === next.x && m.y === next.y)) return false;
    pos = next;
    if (visited) visited.add(key(pos.x, pos.y));
  }

  return pos.x === size - 1 && pos.y === size - 1;
}

export function init(ui: GameUi) {
  if (!ui.start || !ui.board) return;

  let activeGame: ReturnType<typeof createGame> | null = null;

  function createGame() {
    const timers = new Set<number>();

    function setTimer(fn: () => void, ms: number) {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    }

    function clearAllTimers() {
      timers.forEach(clearTimeout);
      timers.clear();
      if (activeGame._playInterval) {
        clearInterval(activeGame._playInterval);
        activeGame._playInterval = null;
      }
    }

    const game = {
      cfg: DEFAULT_MEMORY_GRID_CONFIG as MemoryGridConfig,
      values: [] as number[][],
      cells: [] as HTMLButtonElement[],
      size: 4,
      pos: { x: 0, y: 0 },
      path: [] as { x: number; y: number }[],
      visited: new Set<string>(),
      solutionPath: [] as { x: number; y: number }[],
      lives: 3,
      errors: 0,
      moves: 0,
      playing: false,
      phase: 'idle',
      numbersVisible: false,
      timeLeft: 0,
      _playInterval: null as number | null,

      readConfig() {
        const size = GameHelpers.clamp(intVal(ui.size, 4), 4, 8);
        const minVal = GameHelpers.clamp(intVal(ui.minVal, 1), 1, 5);
        const maxVal = GameHelpers.clamp(intVal(ui.maxVal, 3), minVal, 6);
        const timeLimit = intVal(ui.timeLimit, 60);
        const maxErrors = intVal(ui.maxErrors, 0);
        const maxMoves = intVal(ui.maxMoves, 0);

        this.cfg = {
          size,
          minVal,
          maxVal,
          dirMode: (ui.dirMode as HTMLSelectElement | undefined)?.value || 'cardinal',
          allowRepeat: boolVal(ui.allowRepeat, false),
          timeLimit: timeLimit === 0 ? 0 : GameHelpers.clamp(timeLimit, 10, 600),
          showPath: boolVal(ui.showPath, true),
          showHints: boolVal(ui.showHints, false),
          showTime: GameHelpers.clamp(intVal(ui.showTime, 3000), 500, 30000),
          lives: GameHelpers.clamp(intVal(ui.livesInput, 3), 1, 9),
          useLives: boolVal(ui.useLives, true),
          allowUndo: boolVal(ui.allowUndo, true),
          addTraps: boolVal(ui.addTraps, false),
          revealOnVisit: boolVal(ui.revealOnVisit, true),
          maxErrors: maxErrors === 0 ? 0 : GameHelpers.clamp(maxErrors, 1, 99),
          maxMoves: maxMoves === 0 ? 0 : GameHelpers.clamp(maxMoves, 1, 99),
          showSolutionOnEnd: boolVal(ui.showSolutionOnEnd, true),
        };
        this.size = size;
        return this.cfg;
      },

      setStatus(text: string) {
        const status = ui.status as HTMLElement;
        if (status) status.textContent = text;
      },

      setLives(n: number) {
        const lives = ui.lives as HTMLElement;
        if (!lives) return;
        if (!this.cfg?.useLives) {
          lives.textContent = '';
          lives.removeAttribute('aria-label');
          return;
        }
        const count = Math.max(0, n);
        lives.textContent = '❤️'.repeat(count);
        lives.setAttribute('aria-label', `${count} vida${count === 1 ? '' : 's'} restante${count === 1 ? '' : 's'}`);
      },

      setHudExtra() {
        const movesEl = ui.movesEl as HTMLElement;
        const errorsEl = ui.errorsEl as HTMLElement;
        if (movesEl) {
          const max = this.cfg.maxMoves;
          movesEl.textContent = max
            ? `Movimientos: ${this.moves}/${max}`
            : `Movimientos: ${this.moves}`;
        }
        if (errorsEl) {
          const max = this.cfg.maxErrors;
          errorsEl.textContent = max
            ? `Errores: ${this.errors}/${max}`
            : (this.errors ? `Errores: ${this.errors}` : '');
        }
      },

      setResult(text: string) {
        const result = ui.result as HTMLElement;
        if (result) result.textContent = text || '';
      },

      setTimerLabel(text: string) {
        const timerEl = ui.timerEl as HTMLElement;
        if (timerEl) timerEl.textContent = text || '';
      },

      cellSize() {
        const sizes: Record<number, number> = { 4: 64, 5: 56, 6: 48, 7: 44, 8: 40 };
        return sizes[this.size] || 48;
      },

      indexAt(x: number, y: number) {
        return y * this.size + x;
      },

      coords(index: number) {
        return { x: index % this.size, y: Math.floor(index / this.size) };
      },

      buildBoard() {
        this.readConfig();
        const cellPx = this.cellSize();
        const board = ui.board as HTMLElement;
        board.innerHTML = '';
        board.style.gridTemplateColumns = `repeat(${this.size}, ${cellPx}px)`;
        board.setAttribute('role', 'grid');
        board.setAttribute('aria-label', 'Tablero de memoria con números');
        this.cells = [];

        for (let y = 0; y < this.size; y++) {
          for (let x = 0; x < this.size; x++) {
            const index = this.indexAt(x, y);
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'memory-cell';
            cell.dataset.x = String(x);
            cell.dataset.y = String(y);
            cell.disabled = true;
            cell.addEventListener('click', () => this.handleCellClick(x, y));
            board.appendChild(cell);
            this.cells[index] = cell;
          }
        }
      },

      cellLabel(x: number, y: number) {
        if (x === this.size - 1 && y === this.size - 1) return 'E';
        const v = this.values[y]?.[x];
        return String(v ?? '');
      },

      shouldShowNumber(x: number, y: number) {
        if (!this.numbersVisible) {
          if (this.cfg.revealOnVisit && this.visited.has(key(x, y))) return true;
          return false;
        }
        return true;
      },

      renderCell(x: number, y: number) {
        const cell = this.cells[this.indexAt(x, y)];
        if (!cell) return;

        cell.classList.remove(
          'current', 'path', 'hint', 'flash-error', 'flash-ok',
          'reveal-solution', 'hidden-value', 'start-cell', 'end-cell'
        );

        if (x === 0 && y === 0) cell.classList.add('start-cell');
        if (x === this.size - 1 && y === this.size - 1) cell.classList.add('end-cell');

        if (this.cfg.showPath && this.path.some((p: { x: number; y: number }, i: number) => i > 0 && p.x === x && p.y === y)) {
          cell.classList.add('path');
        }

        const isCurrent = this.pos.x === x && this.pos.y === y;
        if (isCurrent) cell.classList.add('current');

        const showNum = this.shouldShowNumber(x, y);
        let visibleValue: string;
        if (showNum) {
          visibleValue = this.cellLabel(x, y);
          cell.textContent = visibleValue;
          cell.classList.remove('hidden-value');
        } else if (x === 0 && y === 0) {
          visibleValue = 'inicio';
          cell.textContent = 'S';
          cell.classList.add('hidden-value');
        } else if (x === this.size - 1 && y === this.size - 1) {
          visibleValue = 'meta';
          cell.textContent = 'E';
          cell.classList.add('hidden-value');
        } else {
          visibleValue = 'valor oculto';
          cell.textContent = '?';
          cell.classList.add('hidden-value');
        }

        // Label dinámico: describe fila/columna + lo que la celda muestra
        // (mismo dato que cell.textContent, no algo aparte que se pueda
        // desincronizar) + si es la posición actual del jugador. Igual
        // que describeCard en pairs.logic.ts, no revela más de lo que
        // un jugador vidente vería — si el valor está oculto ('?'), el
        // label dice "valor oculto", no el número real.
        const parts = [`Casilla fila ${y + 1} columna ${x + 1}`, visibleValue];
        if (isCurrent) parts.push('posición actual');
        cell.setAttribute('aria-label', parts.join(', '));
      },

      renderBoard() {
        for (let y = 0; y < this.size; y++) {
          for (let x = 0; x < this.size; x++) {
            this.renderCell(x, y);
          }
        }

        if (this.phase === 'playing' && this.cfg.showHints) {
          this.getCurrentMoves().forEach((p: { x: number; y: number }) => {
            const cell = this.cells[this.indexAt(p.x, p.y)];
            if (cell) cell.classList.add('hint');
          });
        }

        const interactive = this.playing && this.phase === 'playing';
        this.cells.forEach((cell: HTMLButtonElement) => {
          cell.disabled = !interactive;
        });

        const undoBtn = ui.undoBtn as HTMLElement;
        if (undoBtn) {
          undoBtn.hidden = !(interactive && this.cfg.allowUndo && this.path.length > 1);
        }
      },

      getCurrentMoves(): { x: number; y: number }[] {
        const v = this.values[this.pos.y][this.pos.x];
        const visited = this.cfg.allowRepeat ? null : this.visited;
        return getValidMoves(this.pos, v, this.size, this.cfg.dirMode, visited);
      },

      showAllNumbers() {
        this.numbersVisible = true;
        this.renderBoard();
      },

      hideAllNumbers() {
        this.numbersVisible = false;
        this.renderBoard();
      },

      startMemorizePhase() {
        this.phase = 'memorizing';
        this.setStatus(`Memoriza el tablero (${this.cfg.showTime / 1000}s)`);
        this.showAllNumbers();
        setTimer(() => this.startPlayPhase(), this.cfg.showTime);
      },

      startPlayPhase() {
        this.phase = 'playing';
        this.hideAllNumbers();
        this.setStatus('Llega a E desde S usando movimientos exactos');
        this.startPlayTimer();
        this.renderBoard();
      },

      startPlayTimer() {
        if (this._playInterval) {
          clearInterval(this._playInterval);
          this._playInterval = null;
        }
        if (!this.cfg.timeLimit) {
          this.setTimerLabel('');
          return;
        }
        this.timeLeft = this.cfg.timeLimit;
        this.setTimerLabel(`${this.timeLeft}s`);
        this._playInterval = window.setInterval(() => {
          if (this.phase !== 'playing') return;
          this.timeLeft--;
          this.setTimerLabel(`${Math.max(0, this.timeLeft)}s`);
          if (this.timeLeft <= 0) this.failGame('Tiempo agotado');
        }, 1000);
      },

      stopPlayTimer() {
        if (this._playInterval) {
          clearInterval(this._playInterval);
          this._playInterval = null;
        }
        this.setTimerLabel('');
      },

      handleCellClick(x: number, y: number) {
        if (!this.playing || this.phase !== 'playing') return;

        const valid = this.getCurrentMoves();
        const match = valid.find((p: { x: number; y: number }) => p.x === x && p.y === y);

        if (!match) {
          this.registerError(x, y);
          return;
        }

        this.moveTo(x, y);
      },

      moveTo(x: number, y: number) {
        this.pos = { x, y };
        this.path.push({ x, y });
        if (!this.cfg.allowRepeat) this.visited.add(key(x, y));
        this.moves++;
        this.setHudExtra();
        if (audioManager) audioManager.play('step1');
        const cell = this.cells[this.indexAt(x, y)];
        if (cell) cell.classList.add('flash-ok');

        if (x === this.size - 1 && y === this.size - 1) {
          setTimer(() => this.winGame(), 400);
          return;
        }

        if (this.cfg.maxMoves && this.moves >= this.cfg.maxMoves) {
          this.failGame('Límite de movimientos alcanzado');
          return;
        }

        const nextMoves = this.getCurrentMoves();
        if (nextMoves.length === 0) {
          if (this.cfg.allowUndo) {
            this.setStatus('Sin movimientos válidos — deshaz o reinicia');
          } else {
            this.failGame('Sin movimientos válidos');
          }
        }

        this.renderBoard();
      },

      registerError(x: number, y: number) {
        this.errors++;
        this.setHudExtra();
        if (audioManager) audioManager.play('miss');
        const cell = this.cells[this.indexAt(x, y)];
        if (cell) {
          cell.classList.add('flash-error');
          setTimer(() => cell.classList.remove('flash-error'), 500);
        }

        if (this.cfg.maxErrors && this.errors >= this.cfg.maxErrors) {
          this.failGame('Demasiados errores');
          return;
        }

        if (this.cfg.useLives) {
          this.lives--;
          this.setLives(this.lives);
          if (this.lives <= 0) {
            this.failGame('Sin vidas');
            return;
          }
        }

        this.setStatus('Movimiento inválido — intenta otra casilla');
      },

      undoMove() {
        if (!this.cfg.allowUndo || this.path.length <= 1) return;
        const removed = this.path.pop();
        if (!this.cfg.allowRepeat) this.visited.delete(key(removed.x, removed.y));
        this.pos = { ...this.path[this.path.length - 1] };
        this.moves = Math.max(0, this.moves - 1);
        this.setHudExtra();
        this.setStatus('Movimiento deshecho');
        this.renderBoard();
      },

      revealSolution() {
        this.solutionPath.forEach((p: { x: number; y: number }) => {
          const cell = this.cells[this.indexAt(p.x, p.y)];
          if (cell) cell.classList.add('reveal-solution');
        });
        this.numbersVisible = true;
        this.renderBoard();
      },

      winGame() {
        this.stopPlayTimer();
        this.phase = 'ended';
        this.playing = false;
        this.numbersVisible = true;
        this.renderBoard();
        const start = ui.start as HTMLButtonElement;
        start.disabled = false;
        const undoBtn = ui.undoBtn as HTMLElement;
        if (undoBtn) undoBtn.hidden = true;
        if (audioManager) audioManager.play('perfect');
        const timeBonus = this.cfg.timeLimit ? this.timeLeft : 0;
        const score = this.moves * 10 + timeBonus;
        this.setResult(`🏆 ¡Victoria! ${this.moves} movimiento${this.moves === 1 ? '' : 's'}${timeBonus ? ` · ${timeBonus}s restantes` : ''}.`);
        this.setStatus('Meta alcanzada');
        if (window.Leaderboard) {
          window.Leaderboard.save('memorygrid', score);
        }
      },

      failGame(reason: string) {
        this.stopPlayTimer();
        this.phase = 'ended';
        this.playing = false;
        const start = ui.start as HTMLButtonElement;
        start.disabled = false;
        const undoBtn = ui.undoBtn as HTMLElement;
        if (undoBtn) undoBtn.hidden = true;
        if (audioManager) audioManager.play('gameover');
        if (this.cfg.showSolutionOnEnd) this.revealSolution();
        else this.renderBoard();

        this.setResult(`💀 Derrota: ${reason}.`);
        this.setStatus('Partida terminada');
      },

      resetRunState() {
        this.pos = { x: 0, y: 0 };
        this.path = [{ x: 0, y: 0 }];
        this.visited = new Set([key(0, 0)]);
        this.errors = 0;
        this.moves = 0;
        this.numbersVisible = false;
      },

      startGame() {
        clearAllTimers();
        this.readConfig();
        this.lives = this.cfg.lives;
        this.playing = true;
        this.setLives(this.lives);
        this.setHudExtra();
        this.setResult('');
        const start = ui.start as HTMLButtonElement;
        start.disabled = true;
        const undoBtn = ui.undoBtn as HTMLElement;
        if (undoBtn) undoBtn.hidden = true;

        this.buildBoard();
        const board = generateBoard(this.cfg);
        this.values = board.values;
        this.solutionPath = board.solutionPath;
        this.resetRunState();
        this.renderBoard();
        this.startMemorizePhase();
      },

      stop() {
        clearAllTimers();
        this.playing = false;
        this.phase = 'idle';
        const start = ui.start as HTMLButtonElement;
        if (start) start.disabled = false;
        const undoBtn = ui.undoBtn as HTMLElement;
        if (undoBtn) undoBtn.hidden = true;
        this.setTimerLabel('');
      },
    };

    return game;
  }

  activeGame = createGame();

  const start = ui.start as HTMLButtonElement;
  start.addEventListener('click', () => activeGame.startGame());

  const undoBtn = ui.undoBtn as HTMLElement;
  if (undoBtn) {
    undoBtn.addEventListener('click', () => activeGame.undoMove());
  }

  const minVal = ui.minVal as HTMLInputElement;
  const maxVal = ui.maxVal as HTMLInputElement;
  if (minVal && maxVal) {
    minVal.addEventListener('change', () => {
      const min = intVal(minVal, 1);
      if (intVal(maxVal, 3) < min) maxVal.value = String(min);
    });
  }

  GameInstanceRegistry.set<MemoryGridInstance>('memorygrid', activeGame);

  // Soporte de teclado para navegación por el tablero
  memoryGridKeyDownHandler = (e: KeyboardEvent) => {
    if (!activeGame.playing || activeGame.phase !== 'playing') return;

    const keyMap: Record<string, { dx: number; dy: number }> = {
      'ArrowUp': { dx: 0, dy: -1 },
      'ArrowDown': { dx: 0, dy: 1 },
      'ArrowLeft': { dx: -1, dy: 0 },
      'ArrowRight': { dx: 1, dy: 0 },
      'w': { dx: 0, dy: -1 },
      's': { dx: 0, dy: 1 },
      'a': { dx: -1, dy: 0 },
      'd': { dx: 1, dy: 0 }
    };

    const move = keyMap[e.key];
    if (move) {
      e.preventDefault();
      const newX = activeGame.pos.x + move.dx;
      const newY = activeGame.pos.y + move.dy;
      activeGame.handleCellClick(newX, newY);
    }

    if (e.key === 'z' || e.key === 'Z') {
      if (activeGame.cfg.allowUndo) {
        e.preventDefault();
        activeGame.undoMove();
      }
    }
  };
  document.addEventListener('keydown', memoryGridKeyDownHandler);

  return activeGame;
}

let memoryGridKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

export function stop() {
  const game = GameInstanceRegistry.get<MemoryGridInstance>('memorygrid');
  if (game) game.stop();
  if (memoryGridKeyDownHandler) {
    document.removeEventListener('keydown', memoryGridKeyDownHandler);
    memoryGridKeyDownHandler = null;
  }
  GameInstanceRegistry.clear('memorygrid');
}

