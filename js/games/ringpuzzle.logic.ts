/**
 * js/games/ringpuzzle.logic.ts
 *
 * Lógica pesada extraída de ringpuzzle.ts para lazy loading — ver
 * `logic` en ringpuzzle.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameHelpers from '../utils/gameHelpers.js';
import ViewManager from '../core/viewManager.js';
import audioManager from '../audioManager.js';

type UiMap = Record<string, HTMLElement | SVGSVGElement | null | undefined>;

type Phase = 'menu' | 'playing' | 'won' | 'lost';
type ExitReason = 'timeout' | 'abandon' | null;
type FeedbackKind = 'correct' | 'wrong' | null;

interface RingConfig {
  numRings: number;
  nodesPerRing: number;
  numColors: number;
  allowRepeated: boolean;
  timeLimitSeconds: number;
  errorMarginDeg: number;
  [key: string]: number | boolean;
}

interface RingNode {
  colorIndex: number;
  color: string;
  baseAngle: number;
  targetAngle: number;
}

interface Ring {
  index: number;
  nodes: RingNode[];
  rotation: number;
  solutionRotation: number;
  locked: boolean;
  radius: number;
}

interface DragState {
  startAngle: number;
  startRotation: number;
  ringIndex: number;
}

interface Layout {
  svgSize: number;
  cx: number;
  cy: number;
  baseRadius: number;
  ringGap: number;
}

/* ── Constants ── */
const COLORS = [
  '#EF4444', '#22C55E', '#3B82F6', '#F59E0B',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

const DEFAULT_CONFIG: RingConfig = {
  numRings: 3,
  nodesPerRing: 6,
  numColors: 4,
  allowRepeated: true,
  timeLimitSeconds: 90,
  errorMarginDeg: 3,
};

const NODE_RADIUS = 11;
const PENALTY_SECONDS = 3;
const FEEDBACK_DURATION = 800;

/* Layout dinámico según cantidad de anillos */
let layout: Layout = { svgSize: 560, cx: 280, cy: 280, baseRadius: 70, ringGap: 58 };

function computeLayout(numRings: number): Layout {
  const baseRadius = 70;
  const ringGap = numRings <= 3 ? 58 : numRings === 4 ? 50 : 42;
  const markerOffset = 26;
  const strokeHalf = 20;
  const padding = 36;
  const maxRingRadius = baseRadius + (numRings - 1) * ringGap;
  const outerExtent = maxRingRadius + markerOffset + NODE_RADIUS + 3 + strokeHalf + padding;
  const svgSize = Math.max(400, Math.ceil(outerExtent * 2));
  return { svgSize, cx: svgSize / 2, cy: svgSize / 2, baseRadius, ringGap };
}

function applyLayout() {
  layout = computeLayout(config.numRings);
  if (!ui.rpSvg) return;
  const svg = ui.rpSvg as SVGSVGElement;
  svg.setAttribute('width', String(layout.svgSize));
  svg.setAttribute('height', String(layout.svgSize));
  svg.setAttribute('viewBox', `0 0 ${layout.svgSize} ${layout.svgSize}`);
}

/* ── State ── */
let config: RingConfig = Object.assign({}, DEFAULT_CONFIG);
let rings: Ring[] = [];
let activeRingIndex = 0;
let phase: Phase = 'menu';
let timeLeft = 90;
let wrongCount = 0;
let lastFeedback: FeedbackKind = null;
let exitReason: ExitReason = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

/* Drag state */
let dragState: DragState | null = null;

/* ── Math helpers ── */
// shuffle: ver GameHelpers.shuffle (js/utils/gameHelpers.ts) — se
// consolidó ahí para evitar la misma implementación repetida en
// varios juegos (bombdefusal, ringpuzzle, virusOverload, pairs).

function angleBetween(cx: number, cy: number, px: number, py: number): number {
  const dx = px - cx;
  const dy = py - cy;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return (deg + 360) % 360;
}

function nodePosition(radius: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: layout.cx + radius * Math.cos(rad),
    y: layout.cy + radius * Math.sin(rad),
  };
}

function checkRing(ring: Ring): boolean {
  return ring.nodes.every(node => {
    const displayAngle = (node.baseAngle + ring.rotation + 360) % 360;
    const target = (node.targetAngle + 360) % 360;
    const diff = Math.abs(displayAngle - target);
    const normalizedDiff = Math.min(diff, 360 - diff);
    return normalizedDiff <= config.errorMarginDeg;
  });
}

/* ── Puzzle generation ── */
function generatePuzzle(): Ring[] {
  const { numRings, nodesPerRing, numColors, allowRepeated } = config;
  const stepDeg = 360 / nodesPerRing;

  return Array.from({ length: numRings }, (_, ringIndex) => {
    const solutionStep = Math.floor(Math.random() * nodesPerRing);
    const solutionRotation = solutionStep * stepDeg;
    const offset = 1 + Math.floor(Math.random() * (nodesPerRing - 1));
    const startRotation = ((solutionStep + offset) % nodesPerRing) * stepDeg;

    let colorIndices: number[];
    if (!allowRepeated) {
      const pool = Array.from({ length: numColors }, (_, i) => i);
      const repeated: number[] = [];
      while (repeated.length < nodesPerRing) repeated.push(...pool);
      colorIndices = GameHelpers.shuffle(repeated).slice(0, nodesPerRing);
    } else {
      colorIndices = Array.from({ length: nodesPerRing }, () =>
        Math.floor(Math.random() * numColors)
      );
    }

    const nodes: RingNode[] = colorIndices.map((colorIndex, i) => {
      const baseAngle = i * stepDeg;
      const targetAngle = (baseAngle + solutionRotation) % 360;
      return { colorIndex, color: COLORS[colorIndex % COLORS.length], baseAngle, targetAngle };
    });

    return {
      index: ringIndex,
      nodes,
      rotation: startRotation,
      solutionRotation,
      locked: false,
      radius: layout.baseRadius + ringIndex * layout.ringGap,
    };
  });
}

/* ── SVG rendering ── */
function svgEl(tag: string, attrs: Record<string, string | number>, children?: Array<SVGElement | string | null | undefined>) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, String(v)));
  (children || []).forEach(c => typeof c === 'string'
    ? el.appendChild(document.createTextNode(c))
    : c && el.appendChild(c));
  return el;
}

function renderBoard(svgEl_: SVGSVGElement) {
  svgEl_.innerHTML = '';

  const defs = svgEl('defs', {});
  const bgGrad = svgEl('radialGradient', { id: 'rpBgGrad', cx: '50%', cy: '50%', r: '50%' });
  ([['0%', '#1c0e00'], ['70%', '#0f0600'], ['100%', '#080300']] as [string, string][]).forEach(([o, c]) => {
    bgGrad.appendChild(svgEl('stop', { offset: o, 'stop-color': c }));
  });
  defs.appendChild(bgGrad);

  const glow = svgEl('filter', { id: 'rpGlow' });
  glow.appendChild(svgEl('feGaussianBlur', { stdDeviation: '3', result: 'coloredBlur' }));
  const merge = svgEl('feMerge', {});
  merge.appendChild(svgEl('feMergeNode', { in: 'coloredBlur' }));
  merge.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
  glow.appendChild(merge);
  defs.appendChild(glow);

  const glowStrong = svgEl('filter', { id: 'rpGlowStrong' });
  glowStrong.appendChild(svgEl('feGaussianBlur', { stdDeviation: '6', result: 'coloredBlur' }));
  const merge2 = svgEl('feMerge', {});
  merge2.appendChild(svgEl('feMergeNode', { in: 'coloredBlur' }));
  merge2.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
  glowStrong.appendChild(merge2);
  defs.appendChild(glowStrong);

  svgEl_.appendChild(defs);

  const maxRadius = rings.length > 0 ? rings[rings.length - 1].radius + 30 : 200;
  svgEl_.appendChild(svgEl('circle', {
    cx: layout.cx, cy: layout.cy, r: maxRadius + 10, fill: 'url(#rpBgGrad)',
  }));

  // Grid circles
  rings.forEach(ring => {
    svgEl_.appendChild(svgEl('circle', {
      cx: layout.cx, cy: layout.cy, r: ring.radius,
      fill: 'none', stroke: 'rgba(255,140,30,0.07)', 'stroke-width': 1,
    }));
  });

  // Target markers
  rings.forEach(ring => {
    ring.nodes.forEach(node => {
      const SPAN = 10;
      const markerR = ring.radius + 26;
      const toXY = (deg: number) => {
        const r = ((deg - 90) * Math.PI) / 180;
        return { x: layout.cx + markerR * Math.cos(r), y: layout.cy + markerR * Math.sin(r) };
      };
      const s = toXY(node.targetAngle - SPAN);
      const e = toXY(node.targetAngle + SPAN);
      const d = `M ${s.x} ${s.y} A ${markerR} ${markerR} 0 0 1 ${e.x} ${e.y}`;
      svgEl_.appendChild(svgEl('path', {
        d,
        fill: 'none',
        stroke: node.color,
        'stroke-width': 4,
        'stroke-linecap': 'round',
        opacity: ring.locked ? 0.2 : 0.8,
      }));
    });
  });

  // Rings
  rings.forEach(ring => {
    const isActive = ring.index === activeRingIndex && !ring.locked;
    const isLocked = ring.locked;
    const g = svgEl('g', { style: `cursor: ${isActive ? 'grab' : 'default'}` });

    // Ring track
    g.appendChild(svgEl('circle', {
      cx: layout.cx, cy: layout.cy, r: ring.radius,
      fill: 'none',
      stroke: isLocked
        ? 'rgba(180,80,10,0.35)'
        : isActive
        ? 'rgba(255,180,80,0.18)'
        : 'rgba(255,140,30,0.07)',
      'stroke-width': isActive ? 36 : 32,
      filter: isActive ? 'url(#rpGlow)' : '',
    }));

    if (isLocked) {
      g.appendChild(svgEl('circle', {
        cx: layout.cx, cy: layout.cy, r: ring.radius,
        fill: 'none',
        stroke: 'rgba(249,115,22,0.15)',
        'stroke-width': 36,
      }));
    }

    // Nodes
    ring.nodes.forEach(node => {
      const displayAngle = (node.baseAngle + ring.rotation + 360) % 360;
      const pos = nodePosition(ring.radius, displayAngle);
      const ng = svgEl('g', { filter: isActive ? 'url(#rpGlowStrong)' : '' });
      ng.appendChild(svgEl('circle', {
        cx: pos.x, cy: pos.y, r: NODE_RADIUS + 3, fill: 'rgba(0,0,0,0.5)',
      }));
      ng.appendChild(svgEl('circle', {
        cx: pos.x, cy: pos.y, r: NODE_RADIUS,
        fill: node.color, opacity: isLocked ? 0.4 : 1,
      }));
      if (isLocked) {
        const t = svgEl('text', {
          x: pos.x, y: pos.y + 1,
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': 10, fill: 'white', opacity: 0.8,
        }, ['✓']);
        ng.appendChild(t);
      }
      g.appendChild(ng);
    });

    // Pointer events for dragging
    (g as unknown as HTMLElement).dataset.ringIndex = String(ring.index);
    svgEl_.appendChild(g);
  });

  // Center hub
  svgEl_.appendChild(svgEl('circle', {
    cx: layout.cx, cy: layout.cy, r: 38, fill: '#100600', stroke: 'rgba(255,140,30,0.2)', 'stroke-width': 1.5,
  }));
  svgEl_.appendChild(svgEl('circle', { cx: layout.cx, cy: layout.cy, r: 26, fill: '#1c0900' }));

  const centerText = svgEl('text', {
    x: layout.cx, y: layout.cy + 6, 'text-anchor': 'middle',
  });
  if (lastFeedback === 'correct') {
    centerText.setAttribute('font-size', '22');
    centerText.setAttribute('fill', '#f97316');
    centerText.setAttribute('filter', 'url(#rpGlowStrong)');
    centerText.appendChild(document.createTextNode('✓'));
  } else if (lastFeedback === 'wrong') {
    centerText.setAttribute('font-size', '22');
    centerText.setAttribute('fill', '#ef4444');
    centerText.setAttribute('filter', 'url(#rpGlowStrong)');
    centerText.appendChild(document.createTextNode('✗'));
  } else {
    centerText.setAttribute('font-size', '11');
    centerText.setAttribute('fill', 'rgba(255,140,30,0.3)');
    centerText.setAttribute('font-family', 'monospace');
    centerText.appendChild(document.createTextNode('◆◆◆'));
  }
  svgEl_.appendChild(centerText);
}

/* ── UI references ── */
let ui: UiMap = {};

function showPhase(name: string) {
  ['rp-phase-menu', 'rp-phase-playing', 'rp-phase-result'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', el.id === id && id === `rp-phase-${name}`);
  });
  const section = document.getElementById('ring-puzzle');
  if (!section) return;
  section.querySelectorAll('.rp-phase').forEach(el => {
    el.classList.toggle('active', el.id === `rp-phase-${name}`);
  });
}

/* ── Timer ── */
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (phase !== 'playing') { stopTimer(); return; }
    timeLeft = Math.max(0, timeLeft - 1);
    updateTimerUI();
    if (timeLeft <= 0) {
      exitReason = 'timeout';
      phase = 'lost';
      audioManager?.play('gameover');
      stopTimer();
      showResult();
      exitReason = null;
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerUI() {
  if (!ui.rpTimerFill || !ui.rpTimerLabel) return;
  const fill = ui.rpTimerFill as HTMLElement;
  const label = ui.rpTimerLabel as HTMLElement;
  const pct = timeLeft / config.timeLimitSeconds;
  const color = pct > 0.5 ? '#f97316' : pct > 0.25 ? '#fbbf24' : '#ef4444';
  fill.style.width = (pct * 100) + '%';
  fill.style.background = `linear-gradient(90deg, ${color}66, ${color})`;
  fill.style.boxShadow = `0 0 8px ${color}88`;
  label.style.color = color;
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  label.textContent = `${m}:${String(s).padStart(2, '0')}`;
}

/* ── Ring pills ── */
function updatePills() {
  if (!ui.rpRingPills) return;
  const pills = ui.rpRingPills as HTMLElement;
  pills.innerHTML = '';
  rings.forEach((r, i) => {
    const pill = document.createElement('div');
    pill.className = 'rp-ring-pill';
    if (r.locked) pill.classList.add('locked');
    else if (i === activeRingIndex) pill.classList.add('active');
    pills.appendChild(pill);
  });
}

/* ── Wrong count ── */
function updateWrongCount() {
  if (!ui.rpWrongCount) return;
  const el = ui.rpWrongCount as HTMLElement;
  el.textContent = wrongCount > 0 ? `✗${wrongCount}` : '';
  el.style.color = wrongCount > 0 ? '#ef4444' : 'transparent';
}

/* ── Rotation ── */
function rotate(dir: 'left' | 'right') {
  if (phase !== 'playing') return;
  if (rings[activeRingIndex].locked) return;
  const step = 360 / config.nodesPerRing;
  const delta = dir === 'left' ? -step : step;
  rings[activeRingIndex].rotation = (rings[activeRingIndex].rotation + delta + 360) % 360;
  if (ui.rpSvg) renderBoard(ui.rpSvg as SVGSVGElement);
}

/* ── Confirm ── */
function confirmRing() {
  if (phase !== 'playing') return;
  const ring = rings[activeRingIndex];
  if (ring.locked) return;

  if (feedbackTimeout) { clearTimeout(feedbackTimeout); feedbackTimeout = null; }

  const correct = checkRing(ring);
  if (correct) {
    rings[activeRingIndex].locked = true;
    lastFeedback = 'correct';
    audioManager?.play('good');
    const nextActive = activeRingIndex + 1;
    if (nextActive >= rings.length) {
      stopTimer();
      phase = 'won';
      audioManager?.play('perfect');
      if (ui.rpSvg) renderBoard(ui.rpSvg as SVGSVGElement);
      feedbackTimeout = setTimeout(() => {
        lastFeedback = null;
        showResult();
      }, FEEDBACK_DURATION);
      return;
    }
    activeRingIndex = nextActive;
  } else {
    timeLeft = Math.max(0, timeLeft - PENALTY_SECONDS);
    lastFeedback = 'wrong';
    audioManager?.play('miss');
    wrongCount++;
    updateWrongCount();
    updateTimerUI();
  }

  updatePills();
  if (ui.rpSvg) renderBoard(ui.rpSvg as SVGSVGElement);
  showFeedback(lastFeedback);

  feedbackTimeout = setTimeout(() => {
    lastFeedback = null;
    if (ui.rpSvg) renderBoard(ui.rpSvg as SVGSVGElement);
    hideFeedback();
  }, FEEDBACK_DURATION);
}

/* ── Feedback overlays ── */
function showFeedback(type: FeedbackKind) {
  if (!ui.rpFeedbackCorrect || !ui.rpFeedbackWrong) return;
  ui.rpFeedbackCorrect.classList.toggle('visible', type === 'correct');
  ui.rpFeedbackWrong.classList.toggle('visible', type === 'wrong');
}
function hideFeedback() {
  if (!ui.rpFeedbackCorrect || !ui.rpFeedbackWrong) return;
  ui.rpFeedbackCorrect.classList.remove('visible');
  ui.rpFeedbackWrong.classList.remove('visible');
}

/* ── Start game ── */
function startGame() {
  stopTimer();
  applyLayout();
  rings = generatePuzzle();
  activeRingIndex = 0;
  phase = 'playing';
  timeLeft = config.timeLimitSeconds;
  wrongCount = 0;
  lastFeedback = null;

  showPhase('playing');
  updatePills();
  updateWrongCount();
  updateTimerUI();
  if (ui.rpSvg) renderBoard(ui.rpSvg as SVGSVGElement);
  startTimer();
}

/* ── Show result ── */
function showResult() {
  showPhase('result');
  const won = phase === 'won';
  const abandoned = exitReason === 'abandon';
  const lockedCount = rings.filter(r => r.locked).length;
  const totalRings = rings.length;
  const timeTaken = config.timeLimitSeconds - timeLeft;

  if (ui.rpResultIcon) {
    const el = ui.rpResultIcon as HTMLElement;
    el.textContent = won ? '🔓' : abandoned ? '🚪' : '⏱';
    el.className = 'rp-result-icon ' + (won ? 'won' : 'lost');
  }
  if (ui.rpResultTitle) {
    const el = ui.rpResultTitle as HTMLElement;
    el.textContent = won
      ? 'Desbloqueado'
      : abandoned
      ? 'Abandonaste'
      : 'Tiempo agotado';
    el.style.color = won ? '#f97316' : '#f87171';
    el.style.textShadow = won ? '0 0 30px rgba(249,115,22,0.4)' : 'none';
  }
  if (ui.rpResultSub) {
    const el = ui.rpResultSub as HTMLElement;
    el.textContent = won
      ? `Resuelto en ${Math.floor(timeTaken / 60)}:${String(timeTaken % 60).padStart(2, '0')}`
      : abandoned
      ? `${lockedCount} de ${totalRings} anillos desbloqueados antes de salir`
      : `${lockedCount} de ${totalRings} anillos desbloqueados`;
  }
  if (ui.rpStatRings) (ui.rpStatRings as HTMLElement).textContent = `${lockedCount} / ${totalRings}`;
  if (ui.rpStatWrong) {
    const el = ui.rpStatWrong as HTMLElement;
    el.textContent = String(wrongCount);
    el.style.color = wrongCount > 0 ? '#f87171' : '#e8c99a';
  }
  if (ui.rpStatPenalty) (ui.rpStatPenalty as HTMLElement).textContent = `−${wrongCount * PENALTY_SECONDS}s`;
  const remainRow = document.getElementById('rp-stat-remaining-row');
  if (remainRow) {
    remainRow.style.display = won ? 'flex' : 'none';
    if (ui.rpStatRemaining) {
      const el = ui.rpStatRemaining as HTMLElement;
      el.textContent = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;
      el.style.color = '#f97316';
    }
  }
}

/* ── Drag handlers ── */
function getSVGPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  const scaleX = layout.svgSize / rect.width;
  const scaleY = layout.svgSize / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function onPointerDown(e: PointerEvent) {
  if (phase !== 'playing') return;
  // Find which ring group was clicked
  let el = e.target as HTMLElement | null;
  let ringIndex: number | null = null;
  while (el && el !== (ui.rpSvg as unknown as HTMLElement)) {
    if (el.dataset && el.dataset.ringIndex !== undefined) {
      ringIndex = parseInt(el.dataset.ringIndex, 10);
      break;
    }
    el = el.parentElement;
  }
  if (ringIndex === null || ringIndex !== activeRingIndex) return;
  if (rings[ringIndex].locked) return;

  const target = e.currentTarget as Element & { setPointerCapture?: (id: number) => void };
  target.setPointerCapture && target.setPointerCapture(e.pointerId);
  const pt = getSVGPoint(ui.rpSvg as SVGSVGElement, e.clientX, e.clientY);
  dragState = {
    startAngle: angleBetween(layout.cx, layout.cy, pt.x, pt.y),
    startRotation: rings[ringIndex].rotation,
    ringIndex,
  };
}

function onPointerMove(e: PointerEvent) {
  if (!dragState) return;
  const pt = getSVGPoint(ui.rpSvg as SVGSVGElement, e.clientX, e.clientY);
  const { startAngle, startRotation, ringIndex } = dragState;
  const currentAngle = angleBetween(layout.cx, layout.cy, pt.x, pt.y);
  let delta = currentAngle - startAngle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  rings[ringIndex].rotation = (startRotation + delta + 360) % 360;
  if (ui.rpSvg) renderBoard(ui.rpSvg as SVGSVGElement);
}

function onPointerUp() {
  dragState = null;
}

/* ── Menu UI helpers ── */
function buildColorDots() {
  if (!ui.rpColorDots) return;
  const el = ui.rpColorDots as HTMLElement;
  el.innerHTML = '';
  for (let i = 0; i < config.numColors; i++) {
    const dot = document.createElement('div');
    dot.className = 'rp-color-dot';
    dot.style.backgroundColor = COLORS[i];
    dot.style.boxShadow = `0 0 7px ${COLORS[i]}aa`;
    el.appendChild(dot);
  }
}

function buildSlider(
  fillId: string,
  inputId: string,
  valId: string,
  min: number,
  max: number,
  step: number,
  key: keyof RingConfig,
  displayFn?: (value: number) => string
) {
  const fill = document.getElementById(fillId) as HTMLElement | null;
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const val = document.getElementById(valId) as HTMLElement | null;
  if (!fill || !input || !val) return;

  function update(v: string | number) {
    config[key as string] = Number(v);
    const pct = ((Number(v) - min) / (max - min)) * 100;
    fill!.style.width = pct + '%';
    val!.textContent = displayFn ? displayFn(Number(v)) : String(v);
    if (key === 'numColors') buildColorDots();
    if (key === 'numRings') applyLayout();
  }

  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(config[key]);
  input.addEventListener('input', () => update(input.value));
  update(config[key] as number);
}

function buildToggle(btnId: string, key: keyof RingConfig) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  function sync() {
    const isOn = !!config[key];
    btn!.classList.toggle('on', isOn);
    btn!.setAttribute('aria-pressed', String(isOn));
  }
  sync();
  btn.addEventListener('click', () => {
    config[key as string] = !config[key];
    sync();
  });
}

function formatTime(v: number) {
  if (v < 60) return `${v}s`;
  const m = Math.floor(v / 60);
  const s = v % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function abandonGame() {
  if (phase !== 'playing') return false;
  stopTimer();
  if (feedbackTimeout) { clearTimeout(feedbackTimeout); feedbackTimeout = null; }
  dragState = null;
  lastFeedback = null;
  hideFeedback();
  exitReason = 'abandon';
  phase = 'lost';
  showResult();
  exitReason = null;
  return true;
}

/* ── Stop (called by GameRegistry on backToMenu) ── */
export function stop() {
  stopTimer();
  if (feedbackTimeout) { clearTimeout(feedbackTimeout); feedbackTimeout = null; }
  dragState = null;
  lastFeedback = null;
  hideFeedback();

  if (phase === 'playing') {
    exitReason = 'abandon';
    phase = 'lost';
    showResult();
    exitReason = null;
  }

  phase = 'menu';
  showPhase('menu');
}

/* ── Init ── */
export function init(_resolvedUi: GameUi) {
  // Collect UI references from section
  const section = document.getElementById('ring-puzzle');
  if (!section) return;

  ui.rpTimerFill = section.querySelector('[data-ui="rpTimerFill"]') as HTMLElement | null;
  ui.rpTimerLabel = section.querySelector('[data-ui="rpTimerLabel"]') as HTMLElement | null;
  ui.rpRingPills = section.querySelector('[data-ui="rpRingPills"]') as HTMLElement | null;
  ui.rpWrongCount = section.querySelector('[data-ui="rpWrongCount"]') as HTMLElement | null;
  ui.rpSvg = section.querySelector('[data-ui="rpSvg"]') as unknown as SVGSVGElement | null;
  ui.rpFeedbackCorrect = section.querySelector('[data-ui="rpFeedbackCorrect"]') as HTMLElement | null;
  ui.rpFeedbackWrong = section.querySelector('[data-ui="rpFeedbackWrong"]') as HTMLElement | null;
  ui.rpColorDots = section.querySelector('[data-ui="rpColorDots"]') as HTMLElement | null;
  ui.rpResultIcon = section.querySelector('[data-ui="rpResultIcon"]') as HTMLElement | null;
  ui.rpResultTitle = section.querySelector('[data-ui="rpResultTitle"]') as HTMLElement | null;
  ui.rpResultSub = section.querySelector('[data-ui="rpResultSub"]') as HTMLElement | null;
  ui.rpStatRings = section.querySelector('[data-ui="rpStatRings"]') as HTMLElement | null;
  ui.rpStatWrong = section.querySelector('[data-ui="rpStatWrong"]') as HTMLElement | null;
  ui.rpStatPenalty = section.querySelector('[data-ui="rpStatPenalty"]') as HTMLElement | null;
  ui.rpStatRemaining = section.querySelector('[data-ui="rpStatRemaining"]') as HTMLElement | null;

  // Sliders
  buildSlider('rp-fill-rings', 'rp-input-rings', 'rp-val-rings', 1, 5, 1, 'numRings');
  buildSlider('rp-fill-nodes', 'rp-input-nodes', 'rp-val-nodes', 3, 12, 1, 'nodesPerRing');
  buildSlider('rp-fill-colors', 'rp-input-colors', 'rp-val-colors', 2, 8, 1, 'numColors');
  buildSlider('rp-fill-time', 'rp-input-time', 'rp-val-time', 30, 300, 15, 'timeLimitSeconds', formatTime);

  buildToggle('rp-toggle-repeated', 'allowRepeated');
  buildColorDots();
  applyLayout();

  const backBtn = section.querySelector('.back-btn');
  if (backBtn) {
    backBtn.removeAttribute('onclick');
    backBtn.addEventListener('click', function (e) {
      if (phase === 'playing') {
        e.preventDefault();
        abandonGame();
        return;
      }
      ViewManager.backToMenu('home');
    });
  }

  // Buttons
  const startBtn = section.querySelector('[data-ui="rpStartBtn"]');
  if (startBtn) startBtn.addEventListener('click', startGame);

  const resetBtn = section.querySelector('[data-ui="rpResetBtn"]');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    config = Object.assign({}, DEFAULT_CONFIG);
    buildSlider('rp-fill-rings', 'rp-input-rings', 'rp-val-rings', 1, 5, 1, 'numRings');
    buildSlider('rp-fill-nodes', 'rp-input-nodes', 'rp-val-nodes', 3, 12, 1, 'nodesPerRing');
    buildSlider('rp-fill-colors', 'rp-input-colors', 'rp-val-colors', 2, 8, 1, 'numColors');
    buildSlider('rp-fill-time', 'rp-input-time', 'rp-val-time', 30, 300, 15, 'timeLimitSeconds', formatTime);
    buildToggle('rp-toggle-repeated', 'allowRepeated');
    buildColorDots();
  });

  const retryBtn = section.querySelector('[data-ui="rpRetryBtn"]');
  if (retryBtn) retryBtn.addEventListener('click', startGame);

  const menuBtn = section.querySelector('[data-ui="rpMenuBtn"]');
  if (menuBtn) menuBtn.addEventListener('click', () => showPhase('menu'));

  const rotLeftBtn = section.querySelector('[data-ui="rpRotLeft"]');
  if (rotLeftBtn) {
    rotLeftBtn.addEventListener('pointerdown', () => rotate('left'));
  }
  const rotRightBtn = section.querySelector('[data-ui="rpRotRight"]');
  if (rotRightBtn) {
    rotRightBtn.addEventListener('pointerdown', () => rotate('right'));
  }
  const confirmBtn = section.querySelector('[data-ui="rpConfirm"]');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmRing);

  // SVG pointer events
  if (ui.rpSvg) {
    const svg = ui.rpSvg as unknown as SVGSVGElement;
    svg.addEventListener('pointerdown', onPointerDown as EventListener);
    svg.addEventListener('pointermove', onPointerMove as EventListener);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointerleave', onPointerUp);
  }

  // Keyboard
  window.addEventListener('keydown', function rpKey(e) {
    const sectionEl = document.getElementById('ring-puzzle');
    const inView = sectionEl && !sectionEl.classList.contains('hidden');
    if (!inView) return;

    if (e.key === 'Escape' && phase === 'playing') {
      e.preventDefault();
      e.stopImmediatePropagation();
      abandonGame();
      return;
    }

    if (phase !== 'playing') return;
    if (e.key === 'ArrowLeft') rotate('left');
    if (e.key === 'ArrowRight') rotate('right');
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); confirmRing(); }
  }, true);

  showPhase('menu');
}

