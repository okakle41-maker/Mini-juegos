/**
 * js/games/mechlock.logic.ts
 *
 * Lógica pesada extraída de mechlock.ts para lazy loading — ver
 * `logic` en mechlock.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameHelpers from '../utils/gameHelpers.js';

type NodeType = 'bolt' | 'gear' | 'chain' | 'weight' | 'magnet' | 'clutch' | 'wheel' | 'lever' | 'latch';
type EdgeKind = 'main' | 'block' | 'unlock' | 'decoy';

interface MLNodeState {
  power?: number;
  angle?: number;
  fallen?: number;
  engaged?: boolean | null;
  retract?: number;
  locked?: boolean;
}

export interface MLNode {
  id: number;
  type: NodeType;
  x: number;
  y: number;
  state: MLNodeState;
  blocks?: number;
  decoy?: boolean;
  _incoming?: number;
}

export interface MLEdge {
  from: number;
  to: number;
  kind: EdgeKind;
  revealed: boolean;
  _touched?: boolean;
}

export interface Mechanism {
  nodes: MLNode[];
  edges: MLEdge[];
}

export interface AllowedTypes {
  magnets: boolean;
  chains: boolean;
  weights: boolean;
  clutches: boolean;
}

interface MechlockUi {
  board: HTMLElement;
  info?: HTMLElement | null;
  hud?: HTMLElement | null;
  size?: HTMLSelectElement | null;
  difficulty?: HTMLSelectElement | null;
  optMagnets?: HTMLInputElement | null;
  optChains?: HTMLInputElement | null;
  optWeights?: HTMLInputElement | null;
  optClutches?: HTMLInputElement | null;
  optShowConn?: HTMLInputElement | null;
  optTimer?: HTMLInputElement | null;
  start?: HTMLElement | null;
  [key: string]: HTMLElement | null | undefined;
}

// ──────────────────────────────────────────────────────────────────
// Audio sintetizado (clack / clunk / click / clang)
// ──────────────────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!_audioCtx) {
    try { _audioCtx = new ((window.AudioContext || window.webkitAudioContext) as typeof AudioContext)(); }
    catch { _audioCtx = null; }
  }
  return _audioCtx;
}
function metalSound(kind: string) {
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  let freq = 600, dur = 0.08, q = 8, vol = 0.18;
  let type: OscillatorType = 'square';
  if (kind === 'click')  { freq = 1400; dur = 0.04; q = 14; vol = 0.10; }
  if (kind === 'clack')  { freq = 800;  dur = 0.10; q = 10; vol = 0.18; }
  if (kind === 'clunk')  { freq = 280;  dur = 0.18; q = 5;  vol = 0.22; type = 'sawtooth'; }
  if (kind === 'clang')  { freq = 520;  dur = 0.45; q = 3;  vol = 0.25; type = 'triangle'; }
  if (kind === 'crrrrk') { freq = 180;  dur = 0.35; q = 2;  vol = 0.18; type = 'sawtooth'; }
  if (kind === 'unlock') { freq = 110;  dur = 0.9;  q = 1;  vol = 0.35; type = 'triangle'; }
  filter.frequency.value = freq; filter.Q.value = q;
  osc.type = type; osc.frequency.value = freq;
  osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.start(now); osc.stop(now + dur + 0.02);
}

// ──────────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────────
const rnd  = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
// clamp: ver GameHelpers.clamp (js/utils/gameHelpers.ts)

// ──────────────────────────────────────────────────────────────────
// Generador de mecanismo
// ──────────────────────────────────────────────────────────────────
export function generateMechanism(opts: { partsCount: number; allowedTypes: AllowedTypes; difficulty: number }): Mechanism {
  const { partsCount, allowedTypes, difficulty } = opts;
  const interTypes: NodeType[] = ['gear', 'gear', 'gear'];
  if (allowedTypes.chains)   interTypes.push('chain');
  if (allowedTypes.weights)  interTypes.push('weight');
  if (allowedTypes.magnets)  interTypes.push('magnet');
  if (allowedTypes.clutches) interTypes.push('clutch');

  const nodes: MLNode[] = [];
  const edges: MLEdge[] = [];

  const bolt: MLNode = { id: 0, type: 'bolt', x: 0.5, y: 0.08, state: { power: 0, retract: 0 } };
  nodes.push(bolt);

  const mainLen = GameHelpers.clamp(Math.floor(partsCount * 0.45), 3, 8);
  let prev: MLNode = bolt;
  const mainChain: MLNode[] = [bolt];
  for (let i = 0; i < mainLen; i++) {
    const t = interTypes[i % interTypes.length];
    const yProgress = 0.18 + (i / mainLen) * 0.55;
    const n: MLNode = {
      id: nodes.length, type: t,
      x: 0.5 + Math.sin((i + 1) * 1.3) * 0.22,
      y: yProgress,
      state: { power: 0, angle: 0, fallen: 0, engaged: t === 'clutch' ? true : null },
    };
    nodes.push(n);
    edges.push({ from: n.id, to: prev.id, kind: 'main', revealed: false });
    mainChain.push(n);
    prev = n;
  }
  const inMain: MLNode = {
    id: nodes.length,
    type: Math.random() < 0.5 ? 'wheel' : 'lever',
    x: GameHelpers.clamp(prev.x + rnd(-0.15, 0.15), 0.1, 0.9),
    y: 0.88,
    state: { power: 0, angle: 0 },
  };
  nodes.push(inMain);
  edges.push({ from: inMain.id, to: prev.id, kind: 'main', revealed: false });

  const remaining = partsCount - nodes.length;
  const latchCount = GameHelpers.clamp(Math.floor(remaining / 4) + (difficulty >= 2 ? 1 : 0), 1, 4);
  const latches: MLNode[] = [];
  for (let i = 0; i < latchCount; i++) {
    const blocked = mainChain[1 + (i % (mainChain.length - 1))];
    const latch: MLNode = {
      id: nodes.length, type: 'latch',
      x: GameHelpers.clamp(blocked.x + rnd(-0.2, 0.2), 0.08, 0.92),
      y: GameHelpers.clamp(blocked.y + rnd(-0.06, 0.06), 0.15, 0.78),
      state: { locked: true },
      blocks: blocked.id,
    };
    nodes.push(latch);
    edges.push({ from: latch.id, to: blocked.id, kind: 'block', revealed: false });
    latches.push(latch);
  }

  let slotsLeft = partsCount - nodes.length;
  for (const latch of latches) {
    const sideLen = GameHelpers.clamp(Math.floor(slotsLeft / (latches.length || 1)) - 1, 1, 4);
    let prevSide: MLNode = latch;
    let unlocker: MLNode | null = null;
    for (let i = 0; i < sideLen; i++) {
      let t: NodeType;
      if (i === 0 && (allowedTypes.magnets || allowedTypes.weights)) {
        t = allowedTypes.magnets ? 'magnet' : 'weight';
      } else {
        t = pick(interTypes);
      }
      const n: MLNode = {
        id: nodes.length, type: t,
        x: GameHelpers.clamp(latch.x + rnd(-0.3, 0.3), 0.06, 0.94),
        y: GameHelpers.clamp(latch.y + rnd(-0.25, 0.25) + 0.05 * (i + 1), 0.12, 0.84),
        state: { power: 0, angle: 0, fallen: 0, engaged: t === 'clutch' ? true : null },
      };
      nodes.push(n);
      edges.push({ from: n.id, to: prevSide.id, kind: i === 0 ? 'unlock' : 'main', revealed: false });
      prevSide = n;
      unlocker = n;
      slotsLeft--;
      if (slotsLeft <= 0) break;
    }
    if (slotsLeft > 0 || unlocker === null) {
      const inSide: MLNode = {
        id: nodes.length,
        type: Math.random() < 0.5 ? 'lever' : 'wheel',
        x: GameHelpers.clamp((unlocker ? unlocker.x : latch.x) + rnd(-0.15, 0.15), 0.05, 0.95),
        y: GameHelpers.clamp((unlocker ? unlocker.y : latch.y) + 0.12, 0.15, 0.92),
        state: { power: 0, angle: 0 },
      };
      nodes.push(inSide);
      edges.push({ from: inSide.id, to: (unlocker || latch).id, kind: 'main', revealed: false });
      slotsLeft--;
    }
  }

  while (nodes.length < partsCount) {
    const t = pick(interTypes);
    const n: MLNode = {
      id: nodes.length, type: t,
      x: rnd(0.06, 0.94), y: rnd(0.18, 0.85),
      state: { power: 0, angle: 0, fallen: 0, engaged: t === 'clutch' ? true : null },
      decoy: true,
    };
    nodes.push(n);
    const near = nodes
      .filter(o => o !== n && !o.decoy && o.type !== 'bolt')
      .sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0];
    if (near) edges.push({ from: n.id, to: near.id, kind: 'decoy', revealed: false });
  }

  if (difficulty === 0) edges.forEach(e => (e.revealed = true));

  // Separación: empuja nodos para que no se superpongan visualmente
  separateNodes(nodes);

  return { nodes, edges };
}

// Relajación iterativa en coordenadas SVG (1000x700) para evitar solapes
function separateNodes(nodes: MLNode[]) {
  const W = 1000, H = 700;
  const MIN_DIST = 110; // distancia mínima entre centros (SVG units)
  const MARGIN_X = 60, MARGIN_Y = 60;
  const ITERS = 80;

  interface Pt { n: MLNode; px: number; py: number; fixed: boolean; }

  // Convertir a px
  const pts: Pt[] = nodes.map(n => ({
    n,
    px: n.x * W,
    py: n.y * H,
    fixed: n.type === 'bolt', // el cerrojo se queda arriba
  }));

  for (let iter = 0; iter < ITERS; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.px - a.px;
        let dy = b.py - a.py;
        let d = Math.hypot(dx, dy);
        if (d < 0.0001) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d = Math.hypot(dx, dy); }
        if (d < MIN_DIST) {
          const overlap = (MIN_DIST - d) / 2;
          const ux = dx / d, uy = dy / d;
          if (!a.fixed) { a.px -= ux * overlap; a.py -= uy * overlap; }
          else          { b.px += ux * overlap * 2; b.py += uy * overlap * 2; }
          if (!b.fixed) { b.px += ux * overlap; b.py += uy * overlap; }
          else          { a.px -= ux * overlap * 2; a.py -= uy * overlap * 2; }
          moved = true;
        }
      }
    }
    // Mantener dentro de límites
    for (const p of pts) {
      if (p.fixed) continue;
      p.px = Math.max(MARGIN_X, Math.min(W - MARGIN_X, p.px));
      p.py = Math.max(MARGIN_Y, Math.min(H - MARGIN_Y, p.py));
    }
    if (!moved) break;
  }

  for (const p of pts) {
    p.n.x = p.px / W;
    p.n.y = p.py / H;
  }
}

// ──────────────────────────────────────────────────────────────────
// Render SVG
// ──────────────────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}

export function init(rawUi: GameUi) {
  const ui = rawUi as unknown as MechlockUi;
  if (!ui || !ui.board) return;

  const board = ui.board;
  let mech: Mechanism | null = null;
  let svgRoot: SVGElement | null = null;
  let edgeLayer: SVGElement | null = null;
  let nodeLayer: SVGElement | null = null;
  let running = false;
  let rafId: number | null = null;
  let lastT = 0;
  let timeLimit = 0;
  let elapsed = 0;
  let solved = false;
  let interactionCount = 0;

  function setMsg(html: string, cls = '') {
    if (!ui.info) return;
    ui.info.className = 'result' + (cls ? ' ' + cls : '');
    ui.info.innerHTML = html;
  }

  function propagate(dt: number) {
    const { nodes, edges } = mech!;
    nodes.forEach(n => {
      if (n.type !== 'weight' || (n.state.fallen || 0) <= 0) {
        n._incoming = 0;
      }
    });

    nodes.forEach(n => {
      if (n.type === 'wheel' || n.type === 'lever') {
        n._incoming = n.state.power;
        n.state.power = Math.max(0, (n.state.power || 0) - dt * 0.8);
      }
      if (n.type === 'weight' && (n.state.fallen || 0) > 0 && (n.state.fallen || 0) < 1) {
        n._incoming = 1.0;
      }
    });

    for (let iter = 0; iter < 6; iter++) {
      nodes.forEach(n => {
        if (n.type === 'latch') {
          const unlockSrc = edges.find(e => e.to === n.id && e.kind !== 'block');
          let unlocked = false;
          if (unlockSrc) {
            const src = nodes[unlockSrc.from];
            if ((src._incoming || 0) > 0.15) unlocked = true;
          }
          n.state.locked = !unlocked;
        }
      });

      edges.forEach(e => {
        if (e.kind === 'block' || e.kind === 'decoy') return;
        const src = nodes[e.from];
        const dst = nodes[e.to];
        if (!src || !dst) return;
        let p = src._incoming || 0;
        if (src.type === 'clutch' && src.state.engaged === false) p = 0;
        if (src.type === 'gear') p *= 0.95;
        if (src.type === 'chain') p *= 0.97;
        if (dst.type !== 'latch') {
          const blocking = edges.find(x =>
            x.kind === 'block' && x.to === dst.id && nodes[x.from].state.locked,
          );
          if (blocking) p = 0;
        }
        dst._incoming = Math.max(dst._incoming || 0, p);
      });

      nodes.forEach(n => {
        if (n.type === 'magnet') {
          n.state.power = n._incoming || 0;
        }
      });
    }

    nodes.forEach(n => {
      if (n.type === 'weight') {
        if ((n._incoming || 0) > 0.2 && (n.state.fallen || 0) === 0) {
          n.state.fallen = 0.001;
          metalSound('clunk');
        }
        if ((n.state.fallen || 0) > 0 && (n.state.fallen || 0) < 1) {
          n.state.fallen = Math.min(1, (n.state.fallen || 0) + dt * 0.25);
          if ((n.state.fallen || 0) >= 1) metalSound('clang');
        }
      }
      if (n.type === 'gear' || n.type === 'chain') {
        n.state.angle = (n.state.angle || 0) + (n._incoming || 0) * dt * 200;
      }
    });

    const bolt = nodes[0];
    const inPower = bolt._incoming || 0;
    if (inPower > 0.15) {
      bolt.state.retract = Math.min(1, (bolt.state.retract || 0) + dt * inPower * 0.45);
      if (!solved && (bolt.state.retract || 0) >= 1) {
        solved = true;
        metalSound('unlock');
        setMsg(`<span class="ml-ok">¡CERROJO ABIERTO!</span> · piezas: ${mech!.nodes.length} · interacciones: ${interactionCount}`, 'success');
        if (window.Leaderboard) {
          const score = Math.round((mech!.nodes.length / Math.max(1, interactionCount)) * 100);
          window.Leaderboard.save('mechlock', score);
        }
        running = false;
      }
    } else {
      bolt.state.retract = Math.max(0, (bolt.state.retract || 0) - dt * 0.15);
    }
  }

  function buildSVG() {
    board.innerHTML = '';
    board.setAttribute('aria-hidden', 'true');
    svgRoot = svg('svg', {
      viewBox: '0 0 1000 700',
      class: 'mechlock-svg',
      preserveAspectRatio: 'xMidYMid meet',
    });
    const bg = svg('rect', { x: 0, y: 0, width: 1000, height: 700, class: 'ml-plate' });
    svgRoot.appendChild(bg);
    for (let i = 0; i < 12; i++) {
      const rx = 20 + (i % 6) * 192;
      const ry = i < 6 ? 20 : 670;
      svgRoot.appendChild(svg('circle', { cx: rx, cy: ry, r: 7, class: 'ml-rivet' }));
    }
    edgeLayer = svg('g', { class: 'ml-edges' });
    nodeLayer = svg('g', { class: 'ml-nodes' });
    svgRoot.appendChild(edgeLayer);
    svgRoot.appendChild(nodeLayer);
    board.appendChild(svgRoot);

    // Delegated input: nodes are re-rendered every frame, so per-node
    // listeners get destroyed mid-click. Use pointerdown on the root.
    svgRoot.addEventListener('pointerdown', function (ev: Event) {
      if (!running || solved || !mech) return;
      const target = (ev.target as Element).closest('.ml-node[data-id]');
      if (!target) return;
      const id = parseInt(target.getAttribute('data-id') || '0', 10);
      const node = mech.nodes[id];
      if (!node) return;
      if (node.type === 'wheel' || node.type === 'lever' || node.type === 'clutch') {
        ev.preventDefault();
        onInteract(node);
      }
    });
  }

  function nx(n: MLNode) { return n.x * 1000; }
  function ny(n: MLNode) { return n.y * 700; }

  function renderEdges() {
    edgeLayer!.innerHTML = '';
    mech!.edges.forEach(e => {
      const a = mech!.nodes[e.from], b = mech!.nodes[e.to];
      if (!a || !b) return;
      if (!e.revealed) return;
      const cls = 'ml-edge ml-edge-' + e.kind;
      const active =
        (a._incoming || 0) > 0.1 || (b._incoming || 0) > 0.1 ? ' active' : '';
      const line = svg('line', {
        x1: nx(a), y1: ny(a), x2: nx(b), y2: ny(b),
        class: cls + active,
      });
      edgeLayer!.appendChild(line);
    });
  }

  function renderNodes() {
    nodeLayer!.innerHTML = '';
    mech!.nodes.forEach(n => {
      const g = svg('g', {
        class: 'ml-node ml-' + n.type +
          ((n._incoming || 0) > 0.1 ? ' powered' : '') +
          (n.type === 'latch' && !n.state.locked ? ' unlocked' : '') +
          (n.type === 'clutch' && n.state.engaged === false ? ' disengaged' : ''),
        transform: `translate(${nx(n)}, ${ny(n)})`,
        'data-id': n.id,
      });

      if (n.type === 'bolt') {
        const w = 220, h = 70;
        const tx = -((n.state.retract || 0) * 90);
        g.appendChild(svg('rect', { x: -w/2 - 10, y: -h/2 - 10, width: w + 20, height: h + 20, rx: 8, class: 'ml-bolt-housing' }));
        const boltRect = svg('rect', { x: -w/2 + tx, y: -h/2, width: w, height: h, rx: 6, class: 'ml-bolt' });
        g.appendChild(boltRect);
        for (let i = 0; i < 6; i++) {
          g.appendChild(svg('rect', { x: -w/2 + tx + 18 + i*30, y: -h/2 + 14, width: 14, height: h - 28, rx: 2, class: 'ml-bolt-bar' }));
        }
        g.appendChild(svg('rect', { x: -w/2, y: h/2 + 14, width: w, height: 8, rx: 3, class: 'ml-progress-bg' }));
        g.appendChild(svg('rect', { x: -w/2, y: h/2 + 14, width: w * (n.state.retract || 0), height: 8, rx: 3, class: 'ml-progress' }));
      } else if (n.type === 'gear') {
        const r = 28;
        const gear = svg('g', { transform: `rotate(${n.state.angle || 0})`, class: 'ml-gear-spin' });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const x1 = Math.cos(a) * r, y1 = Math.sin(a) * r;
          gear.appendChild(svg('rect', {
            x: x1 - 4, y: y1 - 4, width: 8, height: 8,
            transform: `rotate(${(a*180)/Math.PI} ${x1} ${y1})`,
            class: 'ml-gear-tooth',
          }));
        }
        gear.appendChild(svg('circle', { cx: 0, cy: 0, r: r, class: 'ml-gear-body' }));
        gear.appendChild(svg('circle', { cx: 0, cy: 0, r: 6, class: 'ml-gear-axle' }));
        gear.appendChild(svg('line', { x1: 0, y1: 0, x2: r-2, y2: 0, class: 'ml-gear-mark' }));
        g.appendChild(gear);
      } else if (n.type === 'wheel') {
        const r = 30;
        const wh = svg('g', { transform: `rotate(${n.state.angle || 0})`, class: 'ml-wheel-spin' });
        wh.appendChild(svg('circle', { cx: 0, cy: 0, r: r, class: 'ml-wheel-body' }));
        for (let i = 0; i < 6; i++) {
          const a = (i/6) * Math.PI * 2;
          wh.appendChild(svg('line', { x1: 0, y1: 0, x2: Math.cos(a)*r, y2: Math.sin(a)*r, class: 'ml-wheel-spoke' }));
        }
        wh.appendChild(svg('circle', { cx: 0, cy: 0, r: 6, class: 'ml-gear-axle' }));
        g.appendChild(wh);
        const lbl = svg('text', { y: r + 18, 'text-anchor': 'middle', class: 'ml-label' });
        lbl.textContent = 'RUEDA';
        g.appendChild(lbl);
      } else if (n.type === 'lever') {
        const ang = (n._incoming || 0) * 50 - 25;
        g.appendChild(svg('rect', { x: -8, y: -4, width: 16, height: 8, class: 'ml-lever-base' }));
        const arm = svg('g', { transform: `rotate(${ang})`, class: 'ml-lever-arm-g' });
        arm.appendChild(svg('rect', { x: -4, y: -36, width: 8, height: 40, class: 'ml-lever-arm' }));
        arm.appendChild(svg('circle', { cx: 0, cy: -38, r: 8, class: 'ml-lever-knob' }));
        g.appendChild(arm);
        const lbl = svg('text', { y: 22, 'text-anchor': 'middle', class: 'ml-label' });
        lbl.textContent = 'PALANCA';
        g.appendChild(lbl);
      } else if (n.type === 'latch') {
        const w = 50;
        g.appendChild(svg('rect', { x: -w/2, y: -10, width: w, height: 20, rx: 3, class: 'ml-latch-frame' }));
        const slide = svg('rect', {
          x: n.state.locked ? -8 : -w/2 + 4,
          y: -7, width: 16, height: 14, rx: 2, class: 'ml-latch-pin',
        });
        g.appendChild(slide);
      } else if (n.type === 'weight') {
        const fall = (n.state.fallen || 0) * 50;
        g.appendChild(svg('line', { x1: 0, y1: -30, x2: 0, y2: -2 + fall, class: 'ml-chain-line' }));
        g.appendChild(svg('rect', { x: -16, y: -2 + fall, width: 32, height: 24, rx: 2, class: 'ml-weight-body' }));
        const t = svg('text', { y: 15 + fall, 'text-anchor': 'middle', class: 'ml-weight-text' });
        t.textContent = 'kg';
        g.appendChild(t);
      } else if (n.type === 'magnet') {
        const pwr = n._incoming || 0;
        g.appendChild(svg('path', {
          d: 'M -22 -18 L -22 6 A 22 22 0 0 0 22 6 L 22 -18 L 10 -18 L 10 0 A 10 10 0 0 1 -10 0 L -10 -18 Z',
          class: 'ml-magnet-body',
        }));
        g.appendChild(svg('rect', { x: -22, y: -22, width: 12, height: 6, class: 'ml-magnet-pole-n' }));
        g.appendChild(svg('rect', { x: 10, y: -22, width: 12, height: 6, class: 'ml-magnet-pole-s' }));
        if (pwr > 0.1) {
          for (let i = 0; i < 3; i++) {
            g.appendChild(svg('circle', { cx: 0, cy: 10, r: 14 + i*8 + Math.sin(performance.now()/150 + i)*2, class: 'ml-magnet-field' }));
          }
        }
      } else if (n.type === 'chain') {
        for (let i = 0; i < 4; i++) {
          g.appendChild(svg('ellipse', {
            cx: -18 + i*12, cy: 0, rx: 7, ry: 4,
            transform: `rotate(${((n.state.angle || 0) + i*40) % 360} ${-18 + i*12} 0)`,
            class: 'ml-chain-link',
          }));
        }
      } else if (n.type === 'clutch') {
        g.appendChild(svg('circle', { cx: -12, cy: 0, r: 14, class: 'ml-clutch-disc' }));
        g.appendChild(svg('circle', { cx: 12, cy: 0, r: 14, class: 'ml-clutch-disc' }));
        if (n.state.engaged) g.appendChild(svg('rect', { x: -4, y: -3, width: 8, height: 6, class: 'ml-clutch-link' }));
        const lbl = svg('text', { y: 28, 'text-anchor': 'middle', class: 'ml-label' });
        lbl.textContent = n.state.engaged ? 'ON' : 'OFF';
        g.appendChild(lbl);
      }

      if (n.type === 'wheel' || n.type === 'lever' || n.type === 'clutch') {
        (g as unknown as HTMLElement).style.cursor = 'pointer';
        // Click handling is delegated on svgRoot (pointerdown) — see buildSVG().
      }

      nodeLayer!.appendChild(g);
    });
  }

  function onInteract(n: MLNode) {
    if (!running || solved || !mech) return;
    interactionCount++;
    if (n.type === 'clutch') {
      n.state.engaged = !n.state.engaged;
      metalSound('click');
    } else {
      n.state.power = Math.min(1, (n.state.power || 0) + 0.6);
      n.state.angle = (n.state.angle || 0) + 40;
      metalSound(n.type === 'wheel' ? 'clack' : 'clunk');
    }
    mech.edges.forEach(e => {
      if (e.from === n.id || e.to === n.id) { e._touched = true; e.revealed = true; }
    });
    setTimeout(() => {
      mech!.edges.forEach(e => {
        if (e._touched) {
          mech!.edges.forEach(e2 => {
            if (e2.from === e.to || e2.to === e.to || e2.from === e.from) {
              if ((mech!.nodes[e2.from]._incoming || 0) > 0.05 || (mech!.nodes[e2.to]._incoming || 0) > 0.05) {
                e2.revealed = true;
              }
            }
          });
        }
      });
    }, 200);
  }

  function loop(t: number) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    elapsed += dt;
    if (timeLimit > 0 && elapsed >= timeLimit && !solved) {
      running = false;
      setMsg(`<span class="ml-fail">Tiempo agotado</span> · interacciones: ${interactionCount}`, 'fail');
      metalSound('crrrrk');
    }
    propagate(dt);
    renderEdges();
    renderNodes();
    updateHud();
    if (running) rafId = requestAnimationFrame(loop);
  }

  function updateHud() {
    if (ui.hud) {
      const t = timeLimit > 0 ? `${Math.max(0, timeLimit - elapsed).toFixed(1)}s` : '∞';
      ui.hud.textContent = `Piezas: ${mech!.nodes.length} · Interacciones: ${interactionCount} · Tiempo: ${t}`;
    }
  }

  function startGame() {
    const sizeSel = ui.size ? ui.size.value : 'medium';
    const partsCount = sizeSel === 'small' ? 10 : sizeSel === 'large' ? 40 : 20;
    const difficulty = parseInt(ui.difficulty ? ui.difficulty.value : '1', 10);
    const allowedTypes: AllowedTypes = {
      magnets:  ui.optMagnets  ? ui.optMagnets.checked  : true,
      chains:   ui.optChains   ? ui.optChains.checked   : true,
      weights:  ui.optWeights  ? ui.optWeights.checked  : true,
      clutches: ui.optClutches ? ui.optClutches.checked : true,
    };
    const showConn = ui.optShowConn ? ui.optShowConn.checked : true;
    timeLimit = ui.optTimer && ui.optTimer.checked ? Math.max(30, partsCount * 4) : 0;

    mech = generateMechanism({ partsCount, allowedTypes, difficulty });
    if (showConn || difficulty === 0) {
      mech.edges.forEach(e => (e.revealed = true));
    }
    elapsed = 0;
    interactionCount = 0;
    solved = false;
    buildSVG();
    renderEdges();
    renderNodes();
    setMsg('Interactúa con palancas, ruedas y embragues. Descubre el camino hasta el cerrojo.', '');
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(loop);
    audio();
  }

  function stopGame() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (ui.start) ui.start.addEventListener('click', startGame);

  return { startGame, stop: stopGame };
}

export function stop() { /* opcional */ }

