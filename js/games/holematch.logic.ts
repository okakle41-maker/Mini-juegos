/**
 * js/games/holematch.logic.ts
 *
 * Lógica pesada extraída de holematch.ts para lazy loading — ver
 * `logic` en holematch.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import audioManager from '../audioManager.js';
interface HoleMatchUi {
  start?: HTMLElement;
  holematchDifficulty?: HTMLSelectElement;
  holematchTargetCount?: HTMLInputElement;
  holematchBoard: HTMLElement;
  holematchProgress?: HTMLElement;
  holematchMistakes?: HTMLElement;
  holematchTimer?: HTMLElement;
  holematchMessage?: HTMLElement;
  holematchProgressBar?: HTMLElement;
}

interface HoleMatchTarget {
  angle: number;
  completed: boolean;
  element: HTMLElement | null;
}

interface HoleMatchState {
  active: boolean;
  difficulty: string;
  speed: number;
  window: number;
  maxMistakes: number;
  progress: number;
  targetCount: number;
  mistakes: number;
  timeRemaining: number;
  message: string;
  lastTime: number;
  targets: HoleMatchTarget[];
  currentTargetIndex: number;
  direction: number;
}

class HoleMatchGame {

  ui: HoleMatchUi;
  state: HoleMatchState;
  angle: number;
  targetAngle: number;
  radius: number;
  circleElement: HTMLElement | null;
  pointerElement: HTMLElement | null;
  stageElement: HTMLElement | null;
  private onKeyDown: (event: KeyboardEvent) => void;

  constructor(ui: HoleMatchUi) {
    this.ui = ui;
    this.state = this.initialState();
    this.angle = 0;
    this.targetAngle = 0;
    this.radius = 0;
    this.circleElement = null;
    this.pointerElement = null;
    this.stageElement = null;
    this.onKeyDown = (event: KeyboardEvent) => {
      if (!this.state.active) return;
      if (event.code === 'Space') {
        event.preventDefault();
        this.checkHit();
      }
    };
    this.bindEvents();
    this.updateUI();
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  initialState(): HoleMatchState {
    return {
      active: false,
      difficulty: 'normal',
      speed: 170,
      window: 14,
      maxMistakes: 2,
      progress: 0,
      targetCount: 7,
      mistakes: 0,
      timeRemaining: 20,
      message: 'Presiona iniciar para comenzar.',
      lastTime: 0,
      targets: [],
      currentTargetIndex: 0,
      direction: 1
    };
  }

  bindEvents(): void {
    document.addEventListener('keydown', this.onKeyDown);

    if (this.ui.start) {
      this.ui.start.addEventListener('click', () => this.start());
    }

    if (this.ui.holematchDifficulty) {
      this.ui.holematchDifficulty.addEventListener('change', () => this.updateDifficulty());
    }
  }

  updateDifficulty(): void {
    const value = this.ui.holematchDifficulty ? this.ui.holematchDifficulty.value : 'normal';
    this.state.difficulty = value;
    if (value === 'easy') {
      this.state.speed = 120;
      this.state.window = 22;
      this.state.maxMistakes = 3;
      this.state.timeRemaining = 24;
    } else if (value === 'hard') {
      this.state.speed = 240;
      this.state.window = 8;
      this.state.maxMistakes = 1;
      this.state.timeRemaining = 16;
    } else {
      this.state.speed = 170;
      this.state.window = 14;
      this.state.maxMistakes = 2;
      this.state.timeRemaining = 20;
    }
    this.updateUI();
  }

  start(): void {
    this.state = this.initialState();
    this.state.targetCount = this.getRequestedTargetCount();
    this.updateDifficulty();
    this.state.active = true;
    this.state.direction = Math.random() < 0.5 ? 1 : -1;
    this.state.message = 'Pulsa ESPACIO en el momento exacto.';
    this.state.lastTime = performance.now();
    this.angle = 0;
    this.buildBoard();
    this.setNewTarget();
    this.updateUI();
    requestAnimationFrame(this.update.bind(this));
  }

  getRequestedTargetCount(): number {
    if (!this.ui.holematchTargetCount) {
      return this.state.targetCount || 8;
    }
    const value = parseInt(this.ui.holematchTargetCount.value, 10);
    if (Number.isNaN(value)) {
      return this.state.targetCount || 8;
    }
    return Math.min(16, Math.max(4, value));
  }

  buildBoard(): void {
    const board = this.ui.holematchBoard;
    board.innerHTML = '';

    const stage = document.createElement('div');
    stage.className = 'holematch-stage';

    const ringOuter = document.createElement('div');
    ringOuter.className = 'holematch-ring holematch-ring-outer';
    stage.appendChild(ringOuter);

    const ringInner = document.createElement('div');
    ringInner.className = 'holematch-ring holematch-ring-inner';
    stage.appendChild(ringInner);

    board.appendChild(stage);
    this.stageElement = stage;

    const moving = document.createElement('div');
    moving.className = 'holematch-circle';
    stage.appendChild(moving);
    this.circleElement = moving;
    this.pointerElement = moving;

    this.buildTargets();
    this.updateLayout();
  }

  buildTargets(): void {
    const count = this.state.targetCount || 4;
    const step = 360 / count;
    this.state.targets = Array.from({ length: count }, (_, index): HoleMatchTarget => ({
      angle: step * index + (step / 2),
      completed: false,
      element: null
    }));

    if (!this.stageElement) return;
    this.state.targets.forEach((target, index) => {
      const targetElement = document.createElement('div');
      targetElement.className = 'holematch-target';
      targetElement.dataset.targetIndex = String(index);
      this.stageElement!.appendChild(targetElement);
      target.element = targetElement;
    });
  }

  setNewTarget(): void {
    const nextIndex = this.state.targets.findIndex((target) => !target.completed);
    if (nextIndex === -1) {
      this.gameOver(true);
      return;
    }
    this.state.currentTargetIndex = nextIndex;
    this.targetAngle = this.state.targets[nextIndex].angle;
    this.updateTargetsState();
  }

  updateTargetsState(): void {
    this.state.targets.forEach((target, index) => {
      if (!target.element) return;
      target.element.classList.toggle('completed', target.completed);
      target.element.classList.toggle('active', index === this.state.currentTargetIndex && !target.completed);
    });
  }

  updateLayout(): void {
    if (!this.stageElement || !this.ui.holematchBoard) return;
    const size = this.ui.holematchBoard.clientWidth;
    this.radius = Math.max((size / 2) - (size * 0.12), 0);
    this.state.targets.forEach((target, index) => {
      if (!target.element) return;
      target.element.style.left = '50%';
      target.element.style.top = '50%';
      target.element.style.transform = `translate(-50%, -50%) rotate(${target.angle}deg) translate(0, -${this.radius}px)`;
      target.element.classList.toggle('completed', target.completed);
      target.element.classList.toggle('active', index === this.state.currentTargetIndex);
    });
    this.renderPointer();
  }

  update(timestamp: number): void {
    if (!this.state.active) return;
    const deltaTime = (timestamp - this.state.lastTime) / 1000;
    this.state.lastTime = timestamp;
    this.state.timeRemaining = Math.max(0, this.state.timeRemaining - deltaTime);

    if (this.state.timeRemaining <= 0) {
      this.gameOver(false);
      return;
    }

    this.angle = (this.angle + this.state.direction * this.state.speed * deltaTime + 360) % 360;
    this.renderPointer();
    this.updateUI();
    requestAnimationFrame(this.update.bind(this));
  }

  renderPointer(): void {
    if (!this.circleElement) return;
    const rad = (this.angle * Math.PI) / 180;
    const x = Math.sin(rad) * this.radius;
    const y = -Math.cos(rad) * this.radius;
    this.circleElement.style.left = '50%';
    this.circleElement.style.top = '50%';
    this.circleElement.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }

  normalizeAngleDiff(angleA: number, angleB: number): number {
    const diff = ((angleA - angleB + 540) % 360) - 180;
    return diff;
  }

  checkHit(): void {
    if (!this.state.active) return;
    const delta = Math.abs(this.normalizeAngleDiff(this.angle, this.targetAngle));
    if (delta <= this.state.window) {
      this.registerSuccess();
    } else {
      this.registerFailure();
    }
  }

  registerSuccess(): void {
    this.state.targets[this.state.currentTargetIndex].completed = true;
    this.state.progress += 1;
    this.state.direction *= -1;
    this.state.message = '¡Perfecto!';
    audioManager.play('good');
    this.ui.holematchBoard.classList.add('holematch-success');
    setTimeout(() => this.ui.holematchBoard.classList.remove('holematch-success'), 220);
    if (this.state.progress >= this.state.targetCount) {
      this.gameOver(true);
    } else {
      this.setNewTarget();
    }
  }

  registerFailure(): void {
    this.state.mistakes += 1;
    this.state.message = 'Muy pronto / tarde';
    audioManager.play('miss');
    this.ui.holematchBoard.classList.add('holematch-fail');
    setTimeout(() => this.ui.holematchBoard.classList.remove('holematch-fail'), 240);
    if (this.state.mistakes >= this.state.maxMistakes) {
      this.gameOver(false);
    }
  }

  gameOver(win: boolean): void {
    this.state.active = false;
    this.state.message = win ? 'GANASTE' : 'PERDISTE';
    audioManager.play(win ? 'perfect' : 'gameover');
  }

  updateUI(): void {
    if (this.ui.holematchProgress) {
      this.ui.holematchProgress.textContent = `Progreso: ${this.state.progress} / ${this.state.targetCount}`;
    }
    if (this.ui.holematchMistakes) {
      this.ui.holematchMistakes.textContent = `Errores: ${this.state.mistakes}`;
    }
    if (this.ui.holematchTimer) {
      this.ui.holematchTimer.textContent = `Tiempo: ${this.state.timeRemaining.toFixed(1)}s`;
    }
    if (this.ui.holematchMessage) {
      this.ui.holematchMessage.textContent = this.state.message;
    }
    if (this.ui.holematchProgressBar) {
      const percent = (this.state.progress / this.state.targetCount) * 100;
      this.ui.holematchProgressBar.style.width = `${percent}%`;
    }
  }
}

export function init(rawUi: GameUi): void {
  const ui = rawUi as unknown as HoleMatchUi;
  if (!ui.start) return; // sección no presente
  const game = new HoleMatchGame(ui);
  GameInstanceRegistry.set('holematch', game);
  if (window.ResizeObserver) {
    new ResizeObserver(() => game.updateLayout()).observe(ui.holematchBoard);
  }
}

export function stop(): void {
  const game = GameInstanceRegistry.get<HoleMatchGame>('holematch');
  if (game) {
    game.state.active = false;
    game.destroy();
  }
  GameInstanceRegistry.clear('holematch');
}

