/**
 * js/games/rhythmArrows.logic.ts
 *
 * Lógica pesada del juego "Rhythm Arrows" (init/stop + clase
 * RhythmArrowsGame), separada de rhythmArrows.ts siguiendo el mismo
 * patrón que arrowGame.logic.ts / arrowGame.ts (ver comentario de
 * GameConfig.logic en core/gameRegistry.ts): rhythmArrows.ts solo
 * registra metadatos ligeros, este archivo se importa bajo demanda
 * cuando el usuario abre la vista "rhythmArrows".
 *
 * Diferencia de diseño vs. arrowGame: acá no es "presiona antes de que
 * se acabe el tiempo", es "presiona en el instante exacto en que una
 * línea de ritmo llega a un vértice". Portado desde el prototipo
 * standalone en "minijuegos a futuri/rhythm-arrows/public/js/game.js"
 * (canvas + servidor Node propio) a este patrón: TypeScript, sin
 * servidor propio, sin multiplayer (single-player por ahora), dibujo
 * con SVG en vez de canvas para consistencia con el resto del proyecto.
 */

import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import safeStorage from '../core/safeStorage.js';
import GameHelpers from '../utils/gameHelpers.js';
import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';

interface RhythmArrowsInstance {
  stop: (isExit?: boolean) => void;
}

type Direction = 'up' | 'down' | 'left' | 'right';

interface Vertex {
  x: number;
  y: number;
  dir: Direction;
  lit: boolean;
}

interface RhythmArrowsOptions {
  sides: number;      // vértices de la figura (3..8)
  travelMs: number;    // duración del viaje de la línea entre vértices
  windowMs: number;    // ventana de acierto en ms (±)
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const DIR_CHARS: Record<Direction, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const KEY_MAP: Record<string, Direction> = {
  arrowup: 'up', w: 'up',
  arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left',
  arrowright: 'right', d: 'right'
};

const SVG_SIZE = 360;
const CENTER = SVG_SIZE / 2;
const RADIUS = 130;
const VERTEX_RADIUS = 20;
// Distancia (px) antes del centro del vértice donde la línea se detiene:
// el jugador debe pulsar cuando la cabeza de la línea llega a este punto.
const STOP_DISTANCE = 18;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function init(ui: GameUi) {
  const startBtn = ui.start as HTMLButtonElement | undefined;
  const sidesEl = ui.rhythmSides as HTMLSelectElement | undefined;
  const speedEl = ui.rhythmSpeed as HTMLSelectElement | undefined;
  const precisionEl = ui.rhythmPrecision as HTMLSelectElement | undefined;
  const svg = ui.rhythmSvg as unknown as SVGSVGElement | undefined;
  const {
    rhythmCompleted,
    rhythmTime,
    rhythmRecord,
    rhythmMessage,
    rhythmFeedback
  } = ui;

  if (!startBtn || !svg) return;

  const speedPresets: Record<string, number> = {
    slow: 1400,
    normal: 1000,
    fast: 700,
    veryfast: 420
  };
  const precisionPresets: Record<string, number> = {
    relaxed: 220,
    normal: 160,
    tight: 110,
    extreme: 60
  };

  class RhythmArrowsGame {
    ui: GameUi;
    options: RhythmArrowsOptions;
    cleanup: ReturnType<typeof GameHelpers.createCleanupManager>;
    recordKey = 'rhythmArrowsRecordStars';
    record = 0;

    vertices: Vertex[] = [];
    activeIndex = 0;
    nextIndex = 1;
    previousIndex = -1;
    lineProgress = 0;
    lineActive = false;
    running = false;
    completedCount = 0;
    startTime = 0;
    perfectCount = 0;
    goodCount = 0;
    lastTimestamp = 0;
    animationHandle: number | null = null;

    // Elementos SVG creados dinámicamente (se regeneran en cada partida).
    vertexEls: Array<{ circle: SVGCircleElement; label: SVGTextElement }> = [];
    lineHeadEl: SVGCircleElement | null = null;
    lineTrailEl: SVGLineElement | null = null;

    constructor(ui: GameUi, options: RhythmArrowsOptions) {
      this.ui = ui;
      this.options = options;
      this.cleanup = GameHelpers.createCleanupManager();
      this.loadRecord();
    }

    loadRecord() {
      this.record = safeStorage.getNumber(this.recordKey, 0);
    }

    saveRecord() {
      safeStorage.setNumber(this.recordKey, this.record);
    }

    // ── Generación de figura ──────────────────────────────────────────
    generateFigure(sides: number): Vertex[] {
      const points: Vertex[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / sides;
        points.push({
          x: CENTER + RADIUS * Math.cos(angle),
          y: CENTER + RADIUS * Math.sin(angle),
          dir: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
          lit: false
        });
      }
      return points;
    }

    getMaxProgress(): number {
      if (this.previousIndex < 0 || this.nextIndex < 0) return 1;
      const from = this.vertices[this.previousIndex];
      const to = this.vertices[this.nextIndex];
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      return Math.max(0, 1 - STOP_DISTANCE / dist);
    }

    // ── Construcción del SVG ──────────────────────────────────────────
    buildSvg() {
      while (svg!.firstChild) svg!.removeChild(svg!.firstChild);
      svg!.setAttribute('viewBox', `0 0 ${SVG_SIZE} ${SVG_SIZE}`);

      // Conexiones estáticas entre vértices consecutivos.
      for (let i = 0; i < this.vertices.length; i++) {
        const v = this.vertices[i];
        const w = this.vertices[(i + 1) % this.vertices.length];
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(v.x));
        line.setAttribute('y1', String(v.y));
        line.setAttribute('x2', String(w.x));
        line.setAttribute('y2', String(w.y));
        line.setAttribute('class', 'rhythm-arrows-connection');
        svg!.appendChild(line);
      }

      // Línea de ritmo (trazo + cabeza), se actualiza en cada frame.
      this.lineTrailEl = document.createElementNS(SVG_NS, 'line');
      this.lineTrailEl.setAttribute('class', 'rhythm-arrows-trail');
      this.lineTrailEl.setAttribute('opacity', '0');
      svg!.appendChild(this.lineTrailEl);

      this.lineHeadEl = document.createElementNS(SVG_NS, 'circle');
      this.lineHeadEl.setAttribute('r', '6');
      this.lineHeadEl.setAttribute('class', 'rhythm-arrows-head');
      this.lineHeadEl.setAttribute('opacity', '0');
      svg!.appendChild(this.lineHeadEl);

      // Vértices (flechas).
      this.vertexEls = this.vertices.map((v, i) => {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(v.x));
        circle.setAttribute('cy', String(v.y));
        circle.setAttribute('r', String(VERTEX_RADIUS));
        circle.setAttribute('class', 'rhythm-arrows-vertex' + (i === 0 ? ' rhythm-arrows-vertex--start' : ''));
        svg!.appendChild(circle);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', String(v.x));
        label.setAttribute('y', String(v.y));
        label.setAttribute('class', 'rhythm-arrows-vertex-label');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'central');
        label.setAttribute('aria-hidden', 'true');
        label.textContent = DIR_CHARS[v.dir];
        svg!.appendChild(label);

        return { circle, label };
      });

      this.refreshVertexStyles();
    }

    refreshVertexStyles() {
      this.vertexEls.forEach(({ circle }, i) => {
        circle.classList.toggle('lit', this.vertices[i].lit);
        circle.classList.toggle('active', i === this.nextIndex && this.running);
      });
    }

    updateLineVisual() {
      if (!this.lineTrailEl || !this.lineHeadEl) return;
      if (!this.lineActive || this.previousIndex < 0 || this.nextIndex < 0) {
        this.lineTrailEl.setAttribute('opacity', '0');
        this.lineHeadEl.setAttribute('opacity', '0');
        return;
      }
      const from = this.vertices[this.previousIndex];
      const to = this.vertices[this.nextIndex];
      const maxProgress = this.getMaxProgress();
      const progress = Math.min(this.lineProgress, maxProgress);
      const x = from.x + (to.x - from.x) * progress;
      const y = from.y + (to.y - from.y) * progress;

      this.lineTrailEl.setAttribute('x1', String(from.x));
      this.lineTrailEl.setAttribute('y1', String(from.y));
      this.lineTrailEl.setAttribute('x2', String(x));
      this.lineTrailEl.setAttribute('y2', String(y));
      this.lineTrailEl.setAttribute('opacity', '1');

      this.lineHeadEl.setAttribute('cx', String(x));
      this.lineHeadEl.setAttribute('cy', String(y));
      this.lineHeadEl.setAttribute('opacity', '1');
    }

    // ── Ciclo de partida ────────────────────────────────────────────────
    start() {
      if (this.running) return;
      this.vertices = this.generateFigure(this.options.sides);
      this.activeIndex = 0;
      this.nextIndex = 1 % this.vertices.length;
      this.previousIndex = 0;
      this.lineProgress = 0;
      this.lineActive = false;
      this.running = true;
      this.completedCount = 0;
      this.perfectCount = 0;
      this.goodCount = 0;
      this.startTime = performance.now();
      this.lastTimestamp = 0;

      this.buildSvg();
      this.clearMessage();
      startBtn!.disabled = true;
      this.updateStats();
      audioManager?.play('click');

      this.cleanup.addTimeout(() => {
        if (!this.running) return;
        this.lineActive = true;
        this.lineProgress = 0;
      }, 900);

      this.animationHandle = requestAnimationFrame((t) => this.animate(t));
    }

    animate(timestamp: number) {
      if (!this.running) return;
      if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
      const dt = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      if (this.lineActive) {
        this.lineProgress += dt / this.options.travelMs;
        const maxProgress = this.getMaxProgress();
        if (this.lineProgress >= maxProgress) {
          this.lineProgress = maxProgress;
          this.updateLineVisual();
          this.fail('¡Se te pasó la flecha!');
          return;
        }
      }

      this.updateLineVisual();
      const elapsed = (performance.now() - this.startTime) / 1000;
      if (rhythmTime) (rhythmTime as HTMLElement).textContent = `${elapsed.toFixed(1)}s`;

      this.animationHandle = requestAnimationFrame((t) => this.animate(t));
    }

    handleInput(dir: Direction) {
      if (!this.running || !this.lineActive) return;
      const target = this.vertices[this.nextIndex];

      if (dir !== target.dir) {
        this.fail('Dirección incorrecta');
        return;
      }

      const maxProgress = this.getMaxProgress();
      const delta = Math.abs(this.lineProgress - maxProgress);
      const deltaMs = delta * this.options.travelMs;

      if (deltaMs <= this.options.windowMs) {
        const isPerfect = deltaMs <= this.options.windowMs * 0.35;
        if (isPerfect) this.perfectCount += 1; else this.goodCount += 1;

        this.vertices[this.nextIndex].lit = true;
        this.completedCount += 1;
        this.refreshVertexStyles();
        this.updateStats();

        if (isPerfect) {
          audioManager?.play('perfect');
          this.showFeedback('¡PERFECTO!', true);
        } else {
          audioManager?.play('good');
          this.showFeedback('¡Bien!', true);
        }

        if (this.completedCount === this.vertices.length) {
          this.win();
          return;
        }

        this.advance();
      } else if (this.lineProgress >= maxProgress) {
        this.fail('¡Muy tarde!');
      } else {
        this.fail('¡Muy pronto!');
      }
    }

    advance() {
      let idx = (this.nextIndex + 1) % this.vertices.length;
      while (this.vertices[idx].lit) {
        idx = (idx + 1) % this.vertices.length;
      }
      this.previousIndex = this.nextIndex;
      this.nextIndex = idx;
      this.lineActive = false;
      this.lineProgress = 0;
      this.refreshVertexStyles();
      this.updateLineVisual();

      this.cleanup.addTimeout(() => {
        if (!this.running) return;
        this.lineActive = true;
        this.lineProgress = 0;
      }, 220);
    }

    win() {
      this.running = false;
      this.lineActive = false;
      this.stopAnimation();
      const elapsed = (performance.now() - this.startTime) / 1000;
      audioManager?.play('perfect');

      const accuracy = (this.perfectCount + this.goodCount) / this.vertices.length;
      let stars = 1;
      if (accuracy >= 0.6) stars = 2;
      if (accuracy >= 0.9) stars = 3;

      this.updateRecord(stars);
      this.setMessage(`Circuito completado — ${elapsed.toFixed(2)}s · ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}`, 'success');
      startBtn!.disabled = false;
      this.refreshVertexStyles();
    }

    fail(reason: string) {
      this.running = false;
      this.lineActive = false;
      this.stopAnimation();
      audioManager?.play('miss');
      this.setMessage(`Cadena rota — ${reason}`, 'fail');
      startBtn!.disabled = false;
      this.refreshVertexStyles();
    }

    stop(isExit = false) {
      if (!this.running) {
        this.stopAnimation();
        return;
      }
      this.running = false;
      this.lineActive = false;
      this.stopAnimation();
      if (!isExit) {
        this.setMessage('Partida interrumpida', 'fail');
      }
      startBtn!.disabled = false;
    }

    stopAnimation() {
      this.cleanup.cleanup();
      if (this.animationHandle !== null) {
        cancelAnimationFrame(this.animationHandle);
        this.animationHandle = null;
      }
    }

    updateRecord(stars: number) {
      if (stars > this.record) {
        this.record = stars;
        this.saveRecord();
      }
      if (rhythmRecord) (rhythmRecord as HTMLElement).textContent = `Récord: ${'⭐'.repeat(this.record)}${'☆'.repeat(3 - this.record)}`;
      if (window.Leaderboard) window.Leaderboard.save('rhythmArrows', stars);
    }

    updateStats() {
      if (rhythmCompleted) (rhythmCompleted as HTMLElement).textContent = `${this.completedCount} / ${this.vertices.length}`;
    }

    setMessage(text: string, type: 'success' | 'fail') {
      const el = rhythmMessage as HTMLElement | undefined;
      if (!el) return;
      el.textContent = text;
      el.classList.remove('success', 'fail', 'hidden');
      el.classList.add(type);
    }

    clearMessage() {
      const el = rhythmMessage as HTMLElement | undefined;
      if (!el) return;
      el.textContent = '';
      el.classList.add('hidden');
      el.classList.remove('success', 'fail');
    }

    showFeedback(text: string, good: boolean) {
      const el = rhythmFeedback as HTMLElement | undefined;
      if (!el) return;
      el.textContent = text;
      el.className = 'rhythm-arrows-feedback show ' + (good ? 'good' : 'bad');
      this.cleanup.addTimeout(() => {
        el.className = 'rhythm-arrows-feedback';
      }, 420);
    }
  }

  const initialSides = sidesEl ? parseInt(sidesEl.value, 10) || 4 : 4;
  const initialSpeed = speedEl ? speedPresets[speedEl.value] ?? 1000 : 1000;
  const initialWindow = precisionEl ? precisionPresets[precisionEl.value] ?? 160 : 160;

  const game = new RhythmArrowsGame(ui, {
    sides: initialSides,
    travelMs: initialSpeed,
    windowMs: initialWindow
  });

  if (rhythmRecord) {
    (rhythmRecord as HTMLElement).textContent = `Récord: ${'⭐'.repeat(game.record)}${'☆'.repeat(3 - game.record)}`;
  }

  sidesEl?.addEventListener('change', () => {
    game.options.sides = Math.max(3, Math.min(parseInt(sidesEl.value, 10) || 4, 8));
  });
  speedEl?.addEventListener('change', () => {
    game.options.travelMs = speedPresets[speedEl.value] ?? 1000;
  });
  precisionEl?.addEventListener('change', () => {
    game.options.windowMs = precisionPresets[precisionEl.value] ?? 160;
  });

  startBtn.addEventListener('click', () => game.start());

  const onKeyDown = (event: KeyboardEvent) => {
    const dir = KEY_MAP[event.key.toLowerCase()];
    if (!dir) return;
    event.preventDefault();
    game.handleInput(dir);
  };
  document.addEventListener('keydown', onKeyDown);

  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Figura de flechas de ritmo');

  GameInstanceRegistry.set<RhythmArrowsInstance>('rhythmArrows', game);
  rhythmArrowsKeyDownHandler = onKeyDown;
}

let rhythmArrowsKeyDownHandler: ((event: KeyboardEvent) => void) | null = null;

export function stop() {
  const game = GameInstanceRegistry.get<RhythmArrowsInstance>('rhythmArrows');
  if (game) game.stop(true);
  if (rhythmArrowsKeyDownHandler) {
    document.removeEventListener('keydown', rhythmArrowsKeyDownHandler);
    rhythmArrowsKeyDownHandler = null;
  }
  GameInstanceRegistry.clear('rhythmArrows');
}
