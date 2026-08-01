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
  holematchSpeed?: HTMLInputElement;
  holematchSpeedVal?: HTMLElement;
  holematchPrecision?: HTMLInputElement;
  holematchPrecisionVal?: HTMLElement;
  holematchFlipMin?: HTMLInputElement;
  holematchFlipMax?: HTMLInputElement;
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
  // Cambio de dirección: ya no ocurre al acertar, sino en un
  // intervalo aleatorio independiente del juego (más "pixel perfect"
  // e impredecible: no se puede aprender el patrón por aciertos).
  flipTimer: number;
  nextFlipAt: number;
  flipMin: number;
  flipMax: number;
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
      // Ventana de acierto más ajustada por defecto (antes 14° en
      // normal): el pedido es que se sienta más "pixel perfect", así
      // que se reduce el margen de tolerancia en las tres dificultades.
      window: 10,
      maxMistakes: 2,
      progress: 0,
      targetCount: 7,
      mistakes: 0,
      timeRemaining: 20,
      message: 'Presiona iniciar para comenzar.',
      lastTime: 0,
      targets: [],
      currentTargetIndex: 0,
      direction: 1,
      flipTimer: 0,
      nextFlipAt: 0,
      flipMin: 1.2,
      flipMax: 3.2
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

    // Sliders de configuración manual: al tocarlos, el usuario toma
    // control fino sobre velocidad/precisión por encima del preset de
    // dificultad (igual que "Modo avanzado" en Progress Timing).
    if (this.ui.holematchSpeed) {
      this.ui.holematchSpeed.addEventListener('input', () => {
        this.state.speed = parseInt(this.ui.holematchSpeed!.value, 10);
        if (this.ui.holematchSpeedVal) this.ui.holematchSpeedVal.textContent = String(this.state.speed);
      });
    }
    if (this.ui.holematchPrecision) {
      this.ui.holematchPrecision.addEventListener('input', () => {
        this.state.window = parseInt(this.ui.holematchPrecision!.value, 10);
        if (this.ui.holematchPrecisionVal) this.ui.holematchPrecisionVal.textContent = `${this.state.window}°`;
      });
    }
    if (this.ui.holematchFlipMin) {
      this.ui.holematchFlipMin.addEventListener('input', () => {
        const v = parseFloat(this.ui.holematchFlipMin!.value);
        this.state.flipMin = Math.min(v, this.state.flipMax - 0.2);
      });
    }
    if (this.ui.holematchFlipMax) {
      this.ui.holematchFlipMax.addEventListener('input', () => {
        const v = parseFloat(this.ui.holematchFlipMax!.value);
        this.state.flipMax = Math.max(v, this.state.flipMin + 0.2);
      });
    }
  }

  updateDifficulty(): void {
    const value = this.ui.holematchDifficulty ? this.ui.holematchDifficulty.value : 'normal';
    this.state.difficulty = value;
    if (value === 'easy') {
      this.state.speed = 130;
      this.state.window = 14;
      this.state.maxMistakes = 3;
      this.state.timeRemaining = 24;
    } else if (value === 'hard') {
      // Ventana bien angosta: apunta a que el hit tenga que ser
      // realmente "pixel perfect" en dificultad alta.
      this.state.speed = 260;
      this.state.window = 6;
      this.state.maxMistakes = 1;
      this.state.timeRemaining = 16;
    } else {
      this.state.speed = 180;
      this.state.window = 10;
      this.state.maxMistakes = 2;
      this.state.timeRemaining = 20;
    }
    // Sincroniza los sliders finos con el preset elegido, para que el
    // usuario vea y pueda seguir ajustando desde ese punto de partida.
    if (this.ui.holematchSpeed) this.ui.holematchSpeed.value = String(this.state.speed);
    if (this.ui.holematchSpeedVal) this.ui.holematchSpeedVal.textContent = String(this.state.speed);
    if (this.ui.holematchPrecision) this.ui.holematchPrecision.value = String(this.state.window);
    if (this.ui.holematchPrecisionVal) this.ui.holematchPrecisionVal.textContent = `${this.state.window}°`;
    this.updateUI();
  }

  start(): void {
    this.state = this.initialState();
    this.state.targetCount = this.getRequestedTargetCount();
    this.readManualConfig();
    this.updateDifficulty();
    this.state.active = true;
    this.state.direction = Math.random() < 0.5 ? 1 : -1;
    this.state.flipTimer = 0;
    this.state.nextFlipAt = this.randomFlipInterval();
    this.state.message = 'Pulsa ESPACIO en el momento exacto.';
    this.state.lastTime = performance.now();
    this.angle = 0;
    this.buildBoard();
    this.setNewTarget();
    this.updateUI();
    requestAnimationFrame(this.update.bind(this));
  }

  /** Lee los sliders de flip (si el usuario los tocó) para que
   *  persistan entre reinicios; se llama antes de updateDifficulty
   *  para no perder ninguna config manual al presionar "Iniciar". */
  readManualConfig(): void {
    if (this.ui.holematchFlipMin) {
      const v = parseFloat(this.ui.holematchFlipMin.value);
      if (!Number.isNaN(v)) this.state.flipMin = v;
    }
    if (this.ui.holematchFlipMax) {
      const v = parseFloat(this.ui.holematchFlipMax.value);
      if (!Number.isNaN(v)) this.state.flipMax = v;
    }
  }

  randomFlipInterval(): number {
    const { flipMin, flipMax } = this.state;
    return flipMin + Math.random() * Math.max(0.1, flipMax - flipMin);
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
    const angles = this.randomAngles(count);
    this.state.targets = angles.map((angle): HoleMatchTarget => ({
      angle,
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

  /** Genera `count` ángulos aleatorios en el círculo (0–360°), con una
   *  separación mínima entre casillas consecutivas para que el juego
   *  siga siendo jugable (evita que dos objetivos queden pegados o
   *  se pisen visualmente). Antes eran equidistantes fijos (360/count);
   *  ahora cada partida arma un recorrido distinto e impredecible. */
  randomAngles(count: number): number[] {
    const minGap = Math.min(360 / count * 0.6, 28);
    const maxAttempts = 200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angles: number[] = [];
      let ok = true;
      for (let i = 0; i < count; i++) {
        let candidate = Math.random() * 360;
        let tries = 0;
        while (tries < 40 && angles.some(a => this.circularDistance(a, candidate) < minGap)) {
          candidate = Math.random() * 360;
          tries++;
        }
        if (tries >= 40) { ok = false; break; }
        angles.push(candidate);
      }
      if (ok) return angles;
    }
    // Fallback improbable: si no se logró separar bien tras varios
    // intentos (count muy alto), cae al reparto equidistante clásico
    // para no romper el juego.
    const step = 360 / count;
    return Array.from({ length: count }, (_, i) => step * i + step / 2);
  }

  circularDistance(a: number, b: number): number {
    const diff = Math.abs(a - b) % 360;
    return Math.min(diff, 360 - diff);
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

    // Cambio de dirección en un intervalo aleatorio, desacoplado de
    // los aciertos: el jugador ya no puede anticipar el rebote por
    // haber acertado la casilla anterior.
    this.state.flipTimer += deltaTime;
    if (this.state.flipTimer >= this.state.nextFlipAt) {
      this.state.direction *= -1;
      this.state.flipTimer = 0;
      this.state.nextFlipAt = this.randomFlipInterval();
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
    // El cambio de dirección ya no depende de acertar: ver update()
    // (flipTimer / nextFlipAt), que lo dispara en un intervalo random.
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

