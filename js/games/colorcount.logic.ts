/**
 * js/games/colorcount.logic.ts
 *
 * Lógica pesada de "Color Count" (init/stop + clase ColorCountGame),
 * extraída de colorcount.ts — ver `logic` en colorcount.ts y el
 * comentario de GameConfig.logic en core/gameRegistry.ts.
 */

import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import GameHelpers from '../utils/gameHelpers.js';
import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';

interface ColorCountState {
  active: boolean;
  gridSize: number;
  targetColor: string;
  colors: string[];
  cells: string[];
  answer: string;
  message: string;
  result: string | null;
  showGrid: boolean;
  awaitingAnswer: boolean;
  revealTime: number;
  difficulty: string;
}

class ColorCountGame {
  ui: GameUi;
  state: ColorCountState;
  cleanup: ReturnType<typeof GameHelpers.createCleanupManager>;

  constructor(ui: GameUi) {
    this.ui = ui;
    this.state = this.initialState();
    this.cleanup = GameHelpers.createCleanupManager();
    this.bindEvents();
    this.renderGrid();
    this.updateUI();
  }

  initialState(): ColorCountState {
    return {
      active: false,
      gridSize: 8,
      targetColor: 'red',
      colors: ['red', 'blue', 'yellow', 'green'],
      cells: [],
      answer: '',
      message: 'Pulsa iniciar para comenzar.',
      result: null,
      showGrid: false,
      awaitingAnswer: false,
      revealTime: 2800,
      difficulty: 'normal'
    };
  }

  bindEvents() {
    if (this.ui.start) {
      this.ui.start.addEventListener('click', () => this.start());
    }
    if (this.ui.colorcountSubmit) {
      this.ui.colorcountSubmit.addEventListener('click', () => this.submitAnswer());
    }
    if (this.ui.colorcountAnswer) {
      this.ui.colorcountAnswer.addEventListener('input', (event: Event) => {
        this.state.answer = (event.target as HTMLInputElement).value;
      });
      this.ui.colorcountAnswer.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' && this.state.awaitingAnswer) {
          this.submitAnswer();
        }
      });
    }
    if (this.ui.colorcountDifficulty) {
      this.ui.colorcountDifficulty.addEventListener('change', (event: Event) => {
        this.state.difficulty = (event.target as HTMLSelectElement).value;
      });
    }
  }

  start() {
    this.cleanup.cleanup();
    this.state.active = true;
    this.state.cells = this.generateCells(this.state.gridSize);
    this.state.targetColor = this.chooseTargetColor();
    this.state.answer = '';
    this.state.result = null;
    this.state.showGrid = true;
    this.state.awaitingAnswer = false;
    this.state.message = 'Observa el tablero... memoriza el color objetivo.';
    this.renderGrid();
    this.updateUI();

    this.cleanup.addTimeout(() => this.askForAnswer(), this.state.revealTime);
  }

  askForAnswer() {
    this.state.showGrid = false;
    this.state.awaitingAnswer = true;
    this.state.message = `Escribe cuántos cuadros ${this.state.targetColor} viste.`;
    this.renderGrid();
    this.updateUI();
    if (this.ui.colorcountAnswer) {
      (this.ui.colorcountAnswer as HTMLInputElement).focus();
    }
  }

  generateCells(size: number): string[] {
    const palette = ['red', 'blue', 'yellow', 'green'];
    const totalCells = size * size;
    
    const paintedRatios: Record<string, number> = {
      easy: 0.4,
      normal: 0.6,
      hard: 0.75,
      extreme: 0.9
    };
    const ratio = paintedRatios[this.state.difficulty] || 0.6;
    const paintedCount = Math.ceil(totalCells * ratio);
    
    const cells = Array(totalCells).fill('gray');
    const indices = Array.from({ length: totalCells }, (_, i) => i);
    
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    for (let i = 0; i < paintedCount; i++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      cells[indices[i]] = color;
    }
    
    return cells;
  }

  chooseTargetColor(): string {
    const palette = ['red', 'blue', 'yellow', 'green'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  renderGrid() {
    if (!this.ui.colorcountGrid) return;
    const size = this.state.gridSize;
    const grid = this.ui.colorcountGrid as HTMLElement;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
    grid.style.justifyItems = 'stretch';
    grid.style.alignItems = 'stretch';

    const showingColors = this.state.active && this.state.showGrid;
    const displayColors = showingColors
      ? this.state.cells
      : Array.from({ length: size * size }, () => 'hidden');

    // Mientras la grilla está tapada (fase de espera a la respuesta) no
    // hay nada que un lector de pantalla deba anunciar celda por celda:
    // son placeholders sin color real, y recorrerlos con el lector solo
    // agrega ruido sin información. aria-hidden se saca apenas
    // showingColors vuelve a true (fase de memorización o de revelar
    // resultado), momento en el que sí hay colores reales que describir.
    grid.setAttribute('aria-hidden', showingColors ? 'false' : 'true');

    displayColors.forEach((color) => {
      const square = document.createElement('div');
      square.className = 'colorcount-square';
      square.style.background = color === 'hidden' ? this.getHiddenBackground() : this.getCellBackground(color);
      if (color !== 'hidden') {
        square.setAttribute('aria-label', `Cuadro de color ${color}`);
      }
      grid.appendChild(square);
    });
  }

  getCellBackground(color: string): string {
    const map: Record<string, string> = {
      red: 'linear-gradient(145deg, #d32f2f, #ef5350)',
      blue: 'linear-gradient(145deg, #1976d2, #64b5f6)',
      yellow: 'linear-gradient(145deg, #fbc02d, #fff176)',
      green: 'linear-gradient(145deg, #388e3c, #66bb6a)',
      gray: 'linear-gradient(145deg, #8d8d8d, #b0b0b0)'
    };
    return map[color] || map.gray;
  }

  getHiddenBackground(): string {
    return 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.08))';
  }

  submitAnswer() {
    if (!this.state.awaitingAnswer) return;
    const answerValue = parseInt(this.state.answer, 10);
    if (Number.isNaN(answerValue)) {
      this.state.message = 'Ingresa un número válido antes de enviar.';
      this.updateUI();
      return;
    }

    const actualCount = this.getActualCount();
    const correct = answerValue === actualCount;
    this.state.awaitingAnswer = false;
    this.state.showGrid = true;
    this.state.result = correct ? 'success' : 'failed';
    this.state.message = correct
      ? `Correcto. Había ${actualCount} cuadros ${this.state.targetColor}.`
      : `Incorrecto. La respuesta correcta era ${actualCount}.`;
    if (audioManager) audioManager.play(correct ? 'perfect' : 'miss');
    this.renderGrid();
    this.updateUI();
  }

  getActualCount(): number {
    return this.state.cells.filter((color) => color === this.state.targetColor).length;
  }

  updateUI() {
    if (this.ui.colorcountQuestion) {
      if (!this.state.active) {
        this.ui.colorcountQuestion.textContent = 'Pulsa iniciar para comenzar';
      } else if (this.state.awaitingAnswer) {
        this.ui.colorcountQuestion.textContent = `¿Cuántos cuadros ${this.state.targetColor} viste?`;
      } else {
        this.ui.colorcountQuestion.textContent = `Observa los cuadros ${this.state.targetColor}`;
      }
    }

    if (this.ui.colorcountMessage) {
      this.ui.colorcountMessage.textContent = this.state.message;
      const msgEl = this.ui.colorcountMessage as HTMLElement;
      msgEl.className = 'colorcount-message';
      if (this.state.result === 'success') msgEl.classList.add('colorcount-success');
      if (this.state.result === 'failed') msgEl.classList.add('colorcount-failed');
    }

    if (this.ui.colorcountAnswer) {
      (this.ui.colorcountAnswer as HTMLInputElement).disabled = !this.state.awaitingAnswer;
      if (!this.state.awaitingAnswer) {
        (this.ui.colorcountAnswer as HTMLInputElement).value = '';
      }
    }
    if (this.ui.colorcountSubmit) {
      (this.ui.colorcountSubmit as HTMLButtonElement).disabled = !this.state.awaitingAnswer;
    }
  }
}

export function init(ui: GameUi) {
  if (!ui.start) return;
  const game = new ColorCountGame(ui);
  GameInstanceRegistry.set('colorcount', game);
}

export function stop() {
  const game = GameInstanceRegistry.get<ColorCountGame>('colorcount');
  if (game) {
    game.state.active = false;
    // Antes: el setTimeout de revealTime nunca se cancelaba al salir
    // del juego a mitad de la fase de memorización — si el usuario
    // cerraba la vista antes de que expirara, igual disparaba después
    // y llamaba a askForAnswer() sobre una UI que ya no está visible.
    game.cleanup.cleanup();
  }
  GameInstanceRegistry.clear('colorcount');
}

