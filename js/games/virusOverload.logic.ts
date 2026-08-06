/**
 * js/games/virusOverload.logic.ts
 *
 * Lógica pesada extraída de virusOverload.ts para lazy loading — ver
 * `logic` en virusOverload.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameHelpers from '../utils/gameHelpers.js';
import ViewManager from '../core/viewManager.js';
import { devLog } from '../core/devLog.js';

type PhaseKey = 'INFILTRATION' | 'PROPAGATION' | 'OVERLOAD' | 'COLLAPSE';
type VirusTypeKey = 'BASIC' | 'RESISTANT' | 'MUTANT' | 'BOSS';

interface PhaseInfo {
  name: string;
  start: number;
  end: number;
  color: string;
}

interface VirusTypeInfo {
  name: string;
  color: string;
  health: number;
  points: number;
  canMutate?: boolean;
  isBoss?: boolean;
}

interface GameEvent {
  id: string;
  name: string;
  duration: number;
  effect: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MinigameData = Record<string, any>;

interface Virus {
  id: number;
  type: VirusTypeKey;
  minigame: string;
  health: number;
  maxHealth: number;
  x: number;
  y: number;
  createdAt: number;
  data: MinigameData;
  canMutate?: boolean;
}

interface GameState {
  running: boolean;
  phase: PhaseKey;
  progress: number;
  score: number;
  combo: number;
  maxCombo: number;
  virusesEliminated: number;
  startTime: number;
  endTime: number | null;
  activeViruses: Virus[];
  activeEvent: GameEvent | null;
  eventTimeout: ReturnType<typeof setTimeout> | null;
  spawnInterval: ReturnType<typeof setInterval> | null;
  gameLoopInterval: ReturnType<typeof setInterval> | null;
  controlsInverted: boolean;
  speedMultiplier: number;
  screenDark: boolean;
  activeTypingVirusId: number | null; // Track which typing virus is currently being typed
}

interface VirusOverloadUi {
  start?: HTMLElement;
  setupPhase: HTMLElement;
  gamePhase: HTMLElement;
  endPhase: HTMLElement;
  timerEl?: HTMLElement;
  phaseEl: HTMLElement;
  scoreEl?: HTMLElement;
  comboEl?: HTMLElement;
  virusCountEl?: HTMLElement;
  gameArea: HTMLElement;
  virusContainer: HTMLElement;
  eventBanner: HTMLElement;
  eventText: HTMLElement;
  resultEl: HTMLElement;
  resultScore: HTMLElement;
  resultTime: HTMLElement;
  resultVirus: HTMLElement;
  restartBtn?: HTMLElement;
  backBtn?: HTMLElement;
}

const PHASES: Record<PhaseKey, PhaseInfo> = {
  INFILTRATION: { name: 'INFILTRACIÓN', start: 0, end: 20, color: '#22c55e' },
  PROPAGATION: { name: 'PROPAGACIÓN', start: 20, end: 50, color: '#eab308' },
  OVERLOAD: { name: 'SOBRECARGA', start: 50, end: 80, color: '#f97316' },
  COLLAPSE: { name: 'COLAPSO', start: 80, end: 100, color: '#ef4444' }
};

const VIRUS_TYPES: Record<VirusTypeKey, VirusTypeInfo> = {
  BASIC: { name: 'Básico', color: '#22c55e', health: 1, points: 100 },
  RESISTANT: { name: 'Resistente', color: '#eab308', health: 3, points: 250 },
  MUTANT: { name: 'Mutante', color: '#ef4444', health: 2, points: 300, canMutate: true },
  BOSS: { name: 'Jefe', color: '#a855f7', health: 10, points: 1000, isBoss: true }
};

const EVENTS: GameEvent[] = [
  { id: 'power_outage', name: '⚠️ Corte de energía', duration: 2000, effect: 'dark_screen' },
  { id: 'interference', name: '📡 Interferencia', duration: 3000, effect: 'glitch' },
  { id: 'inverted', name: '🔁 Controles invertidos', duration: 4000, effect: 'invert_controls' },
  { id: 'accelerated', name: '⏱️ Tiempo acelerado', duration: 5000, effect: 'speed_up' },
  { id: 'false_alarm', name: '📢 Alarma falsa', duration: 2000, effect: 'alarm' }
];

const MINIGAMES: string[] = [
  'click', 'type', 'skillcheck', 'colormatch',
  'arrow', 'password', 'memory', 'wire', 'rotate',
  'power', 'dna', 'signal', 'target', 'file',
  'firewall', 'spam', 'node', 'scan', 'hold',
  'rapid', 'sequence', 'math', 'balance'
];

/* ────────────────────────────────────────────
 * ESTADO DEL JUEGO
 * ──────────────────────────────────────────── */

let gameState: GameState = {
  running: false,
  phase: 'INFILTRATION',
  progress: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  virusesEliminated: 0,
  startTime: 0,
  endTime: null,
  activeViruses: [],
  activeEvent: null,
  eventTimeout: null,
  spawnInterval: null,
  gameLoopInterval: null,
  controlsInverted: false,
  speedMultiplier: 1,
  screenDark: false,
  activeTypingVirusId: null // Track which typing virus is currently being typed
};

let ui: VirusOverloadUi = {} as VirusOverloadUi;
let audioContext: AudioContext | null = null;

/* ────────────────────────────────────────────
 * UTILIDADES
 * ──────────────────────────────────────────── */

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// shuffle: ver GameHelpers.shuffle (js/utils/gameHelpers.ts)

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getCurrentPhase(): PhaseInfo & { key: PhaseKey } {
  for (const key in PHASES) {
    const phase = PHASES[key as PhaseKey];
    if (gameState.progress >= phase.start && gameState.progress < phase.end) {
      return { key: key as PhaseKey, ...phase };
    }
  }
  return { key: 'COLLAPSE', ...PHASES.COLLAPSE };
}

/* ────────────────────────────────────────────
 * SISTEMA DE AUDIO
 * ──────────────────────────────────────────── */

function initAudio(): void {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function playSound(type: string): void {
  if (!audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  gainNode.gain.value = 0.3;
  
  switch(type) {
    case 'spawn':
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    case 'eliminate':
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      break;
    case 'combo':
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'event':
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'phase':
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(500, audioContext.currentTime + 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      break;
    case 'gameover':
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      break;
  }
}

/* ────────────────────────────────────────────
 * GENERACIÓN DE VIRUS
 * ──────────────────────────────────────────── */

function createVirus(): Virus {
  const phase = getCurrentPhase();
  let type: VirusTypeKey;
  
  // Probabilidades de tipo según fase
  const rand = Math.random();
  if (phase.key === 'INFILTRATION') {
    type = rand < 0.8 ? 'BASIC' : 'RESISTANT';
  } else if (phase.key === 'PROPAGATION') {
    type = rand < 0.5 ? 'BASIC' : rand < 0.8 ? 'RESISTANT' : 'MUTANT';
  } else if (phase.key === 'OVERLOAD') {
    type = rand < 0.3 ? 'BASIC' : rand < 0.6 ? 'RESISTANT' : rand < 0.9 ? 'MUTANT' : 'BOSS';
  } else {
    type = rand < 0.2 ? 'BASIC' : rand < 0.4 ? 'RESISTANT' : rand < 0.7 ? 'MUTANT' : 'BOSS';
  }

  const virusType = VIRUS_TYPES[type];
  const minigame = pick(MINIGAMES);
  
  return {
    id: Date.now() + Math.random(),
    type: type,
    minigame: minigame,
    health: virusType.health,
    maxHealth: virusType.health,
    x: randInt(15, 85),
    y: randInt(15, 75),
    createdAt: Date.now(),
    data: generateMinigameData(minigame)
  };
}

/** Exportada solo para tests (ver test/virusOverloadPasswordMinigame.test.ts):
 *  es una función pura, no necesita pasar por init()/DOM para probar
 *  que el índice `correct` siempre corresponde a la palabra `target`
 *  mostrada, incluso después de shufflear `options`. */
export function generateMinigameData(minigame: string): MinigameData {
  switch(minigame) {
    case 'type':
      return { code: generateCode(4), input: '' };
    case 'skillcheck':
      return { targetAngle: randInt(0, 360), currentAngle: 0 };
    case 'arrow':
      return { direction: pick(['↑', '↓', '←', '→']) };
    case 'colormatch':
      return { textColor: pick(['rojo', 'azul', 'verde', 'amarillo']), 
               textWord: pick(['rojo', 'azul', 'verde', 'amarillo']) };
    case 'password': {
      // Bug: `correct` quedaba hardcodeado en 0, pero `options` se
      // shufflea — el índice 0 del array YA shuffleado no tiene
      // relación con ninguna palabra en particular, así que el botón
      // "correcto" terminaba siendo esencialmente al azar (1/4), y
      // encima no había ninguna pista visible que indicara cuál
      // palabra era la correcta (ver renderMinigameLabel: el caso
      // 'password' solo pintaba los 4 botones, sin mostrar un target).
      // Fix: elegimos la palabra correcta ANTES de shufflear, y
      // recalculamos su índice en el array ya shuffleado — y la
      // mostramos como pista (ver renderMinigameLabel).
      const words = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'];
      const target = pick(words);
      const options = GameHelpers.shuffle(words);
      return { options, correct: options.indexOf(target), target };
    }
    case 'memory':
      return { sequence: GameHelpers.shuffle([1, 2, 3, 4]).slice(0, 3), input: [] };
    case 'wire':
      return { connected: false };
    case 'rotate':
      return { rotation: randInt(0, 3), target: 0 };
    case 'power':
      return { level: randInt(30, 70), target: 50 };
    case 'dna':
      return { fragments: GameHelpers.shuffle(['A', 'T', 'G', 'C']).slice(0, 4), ordered: [] };
    case 'signal':
      return { frequency: randInt(0, 100), target: 50 };
    case 'target':
      return { hits: 0, required: 3 };
    case 'file':
      return { dragged: false };
    case 'firewall':
      return { blocked: false };
    case 'spam':
      // Bug: acá se creaban los campos `cleaned`/`total`, pero tanto
      // el click handler (case 'spam' en handleVirusClick) como
      // updateVirusVisual leen/escriben `hits` (con fallback `|| 0`,
      // por eso no rompía nada visiblemente) — `cleaned`/`total`
      // quedaban seteados una vez y nunca se leían en ningún lado.
      // Se unifica al mismo esquema que 'target'/'node' (`hits` +
      // `required`), que es el que el resto del código realmente usa.
      return { hits: 0, required: 3 };
    case 'node':
      return { hits: 0, required: 3 };
    case 'scan':
      return { hits: 0, required: 5 };
    case 'hold':
      return { key: pick(['A', 'S', 'D', 'F']), held: 0, required: 1000 };
    case 'rapid':
      return { key: pick(['SPACE', 'ENTER']), presses: 0, required: 5 };
    case 'sequence':
      return { sequence: GameHelpers.shuffle(['A', 'S', 'D', 'F']).slice(0, 3), index: 0 };
    case 'math': {
      const a = randInt(1, 10);
      const b = randInt(1, 10);
      const ops = ['+', '-'];
      const op = pick(ops);
      const answer = op === '+' ? a + b : a - b;
      return { question: `${a} ${op} ${b}`, answer: answer, input: '' };
    }
    case 'balance':
      return { position: 50, target: 50, direction: 1 };
    default:
      return {};
  }
}

/* ────────────────────────────────────────────
 * RENDERIZADO DE VIRUS
 * ──────────────────────────────────────────── */

function renderVirus(virus: Virus): HTMLElement {
  const virusEl = document.createElement('div');
  virusEl.className = 'virus-entity';
  virusEl.dataset.id = String(virus.id);
  virusEl.style.left = virus.x + '%';
  virusEl.style.top = virus.y + '%';
  virusEl.style.borderColor = VIRUS_TYPES[virus.type].color;
  
  virusEl.innerHTML = `
    <div class="virus-icon">🦠</div>
    <div class="virus-health-bar">
      <div class="virus-health-fill" style="width: ${(virus.health / virus.maxHealth) * 100}%"></div>
    </div>
    <div class="virus-minigame">${getMinigameHTML(virus)}</div>
  `;
  
  virusEl.addEventListener('click', (e) => handleVirusClick(e, virus));
  
  return virusEl;
}

function getMinigameHTML(virus: Virus): string {
  switch(virus.minigame) {
    case 'click':
      return '<span class="minigame-label">¡CLIC!</span>';
    case 'type':
      return `<span class="minigame-label">Escribe: ${virus.data.code}</span>`;
    case 'skillcheck':
      return '<span class="minigame-label">⭕ ESPACIO</span>';
    case 'arrow':
      return `<span class="minigame-label">${virus.data.direction}</span>`;
    case 'colormatch':
      return `<span class="minigame-label" style="color: ${getColorCSS(virus.data.textColor)}">${virus.data.textWord}</span>`;
    case 'password':
      return `<span class="minigame-label">Clave: ${virus.data.target}</span>` +
        virus.data.options.map((opt: string, i: number) =>
          `<button class="password-option" data-index="${i}">${opt}</button>`
        ).join('');
    case 'memory':
      return '<span class="minigame-label">🧠 CLIC</span>';
    case 'wire':
      return '<span class="minigame-label">🔗 CLIC</span>';
    case 'rotate':
      return '<span class="minigame-label">🔄 CLIC</span>';
    case 'power':
      return '<span class="minigame-label">⚡ CLIC</span>';
    case 'dna':
      return '<span class="minigame-label">🧬 CLIC</span>';
    case 'signal':
      return '<span class="minigame-label">📡 CLIC</span>';
    case 'target':
      return '<span class="minigame-label">🎯 CLIC x3</span>';
    case 'file':
      return '<span class="minigame-label">💾 CLIC</span>';
    case 'firewall':
      return '<span class="minigame-label">🚨 CLIC</span>';
    case 'spam':
      return '<span class="minigame-label">💥 CLIC x3</span>';
    case 'node':
      return '<span class="minigame-label">🛰️ CLIC x3</span>';
    case 'scan':
      return '<span class="minigame-label">💉 CLIC x5</span>';
    case 'hold':
      return `<span class="minigame-label">⏳ MANTÉN ${virus.data.key}</span>`;
    case 'rapid':
      return `<span class="minigame-label">⚡ RÁPIDO ${virus.data.key}</span>`;
    case 'sequence':
      return `<span class="minigame-label">🔢 ${virus.data.sequence.join('→')}</span>`;
    case 'math':
      return `<span class="minigame-label">🔢 ${virus.data.question}=?</span>`;
    case 'balance':
      return '<span class="minigame-label">⚖️ A/D</span>';
    default:
      return '<span class="minigame-label">🎯</span>';
  }
}

function getColorCSS(colorName: string): string {
  const colors: Record<string, string> = { rojo: '#ef4444', azul: '#3b82f6', verde: '#22c55e', amarillo: '#eab308' };
  return colors[colorName] || '#ffffff';
}

/* ────────────────────────────────────────────
 * MANEJO DE INTERACCIÓN CON VIRUS
 * ──────────────────────────────────────────── */

function handleVirusClick(e: MouseEvent, virus: Virus): void {
  e.stopPropagation();
  
  if (gameState.controlsInverted) {
    // En modo controles invertidos, el clic falla aleatoriamente
    if (Math.random() < 0.3) {
      gameState.combo = 0;
      updateUI();
      return;
    }
  }

  switch(virus.minigame) {
    case 'click':
      damageVirus(virus, 1);
      break;
    case 'type':
      // El typing se maneja con eventos de teclado global
      break;
    case 'skillcheck':
      // El skill check se maneja con tecla SPACE
      break;
    case 'arrow':
      // Las flechas se manejan con eventos de teclado
      break;
    case 'colormatch':
      damageVirus(virus, 1);
      break;
    case 'password': {
      const target = e.target as HTMLElement;
      const btn = target.closest('.password-option') as HTMLElement | null;
      if (btn) {
        const index = parseInt(btn.dataset.index || '0', 10);
        if (index === virus.data.correct) {
          damageVirus(virus, 1);
        } else {
          gameState.combo = 0;
          updateUI();
        }
      }
      break;
    }
    case 'memory':
    case 'wire':
    case 'rotate':
    case 'power':
    case 'dna':
    case 'signal':
    case 'file':
    case 'firewall':
      damageVirus(virus, 1);
      break;
    case 'target':
    case 'spam':
    case 'node':
      virus.data.hits = (virus.data.hits || 0) + 1;
      if (virus.data.hits >= virus.data.required) {
        damageVirus(virus, 1);
      } else {
        updateVirusVisual(virus);
      }
      break;
    case 'scan':
      virus.data.hits = (virus.data.hits || 0) + 1;
      if (virus.data.hits >= virus.data.required) {
        damageVirus(virus, 1);
      } else {
        updateVirusVisual(virus);
      }
      break;
    default:
      damageVirus(virus, 1);
  }
}

function damageVirus(virus: Virus, damage: number): void {
  virus.health -= damage;
  
  if (virus.health <= 0) {
    eliminateVirus(virus);
  } else {
    // Actualizar visualmente
    const virusEl = document.querySelector(`[data-id="${virus.id}"]`);
    if (virusEl) {
      const healthFill = virusEl.querySelector('.virus-health-fill') as HTMLElement | null;
      if (healthFill) {
        healthFill.style.width = `${(virus.health / virus.maxHealth) * 100}%`;
      }
    }
    playSound('eliminate');
  }
}

function eliminateVirus(virus: Virus): void {
  const index = gameState.activeViruses.findIndex(v => v.id === virus.id);
  if (index > -1) {
    gameState.activeViruses.splice(index, 1);
    gameState.virusesEliminated++;
    
    // Calcular puntos
    const basePoints = VIRUS_TYPES[virus.type].points;
    const comboMultiplier = 1 + (gameState.combo * 0.1);
    const points = Math.round(basePoints * comboMultiplier);
    gameState.score += points;
    
    gameState.combo++;
    if (gameState.combo > gameState.maxCombo) {
      gameState.maxCombo = gameState.combo;
    }
    
    // Eliminar del DOM
    const virusEl = document.querySelector(`[data-id="${virus.id}"]`) as HTMLElement | null;
    if (virusEl) {
      virusEl.style.transform = 'scale(0)';
      setTimeout(() => virusEl.remove(), 200);
    }
    
    playSound('combo');
    updateUI();
  }
}

/* ────────────────────────────────────────────
 * EVENTOS ALEATORIOS
 * ──────────────────────────────────────────── */

function triggerRandomEvent(): void {
  if (gameState.activeEvent || gameState.phase === 'INFILTRATION') return;
  
  const event = pick(EVENTS);
  gameState.activeEvent = event;
  
  // Mostrar banner
  ui.eventBanner.classList.remove('hidden');
  ui.eventText.textContent = event.name;
  playSound('event');
  
  // Aplicar efecto
  applyEventEffect(event.effect);
  
  // Programar fin del evento
  gameState.eventTimeout = setTimeout(() => {
    endEvent();
  }, event.duration);
}

function applyEventEffect(effect: string): void {
  const gameArea = ui.gameArea;
  
  switch(effect) {
    case 'dark_screen':
      gameArea.classList.add('dark-screen');
      gameState.screenDark = true;
      break;
    case 'glitch':
      gameArea.classList.add('glitch-effect');
      break;
    case 'invert_controls':
      gameState.controlsInverted = true;
      break;
    case 'speed_up':
      gameState.speedMultiplier = 2;
      break;
    case 'alarm':
      gameArea.classList.add('alarm-effect');
      break;
  }
}

function endEvent(): void {
  if (!gameState.activeEvent) return;
  
  const gameArea = ui.gameArea;
  gameArea.classList.remove('dark-screen', 'glitch-effect', 'alarm-effect');
  gameState.controlsInverted = false;
  gameState.speedMultiplier = 1;
  gameState.screenDark = false;
  
  ui.eventBanner.classList.add('hidden');
  gameState.activeEvent = null;
  gameState.eventTimeout = null;
}

/* ────────────────────────────────────────────
 * MANEJO DE TECLADO
 * ──────────────────────────────────────────── */

function handleKeyPress(e: KeyboardEvent): void {
  if (!gameState.running) return;
  
  const key = e.key.toUpperCase();
  
  // Buscar virus de tipo 'type' - procesar solo el activo
  let activeVirus: Virus | null | undefined = null;
  
  // Si hay un virus activo, usar ese
  if (gameState.activeTypingVirusId) {
    activeVirus = gameState.activeViruses.find(v => v.id === gameState.activeTypingVirusId && v.minigame === 'type');
  }
  
  // Si no hay virus activo o fue eliminado, buscar el más antiguo
  if (!activeVirus) {
    const typeViruses = gameState.activeViruses
      .filter(v => v.minigame === 'type')
      .sort((a, b) => a.createdAt - b.createdAt);
    
    if (typeViruses.length > 0) {
      activeVirus = typeViruses[0];
      gameState.activeTypingVirusId = activeVirus.id;
    }
  }
  
  if (activeVirus) {
    const expectedChar = activeVirus.data.code[activeVirus.data.input.length];
    if (key === expectedChar) {
      activeVirus.data.input += key;
      if (activeVirus.data.input === activeVirus.data.code) {
        damageVirus(activeVirus, activeVirus.maxHealth);
        gameState.activeTypingVirusId = null; // Reset active virus
      } else {
        // Actualizar visualmente
        updateVirusVisual(activeVirus);
      }
    }
    // Si la tecla no coincide, no hacer nada (no resetear)
  }
  
  // Math minigame - type the answer
  const mathViruses = gameState.activeViruses.filter(v => v.minigame === 'math');
  if (mathViruses.length > 0) {
    const mathVirus = mathViruses[0];
    if (key >= '0' && key <= '9' || key === '-') {
      mathVirus.data.input += key;
      const answer = mathVirus.data.answer.toString();
      if (mathVirus.data.input === answer) {
        damageVirus(mathVirus, mathVirus.maxHealth);
      } else if (mathVirus.data.input.length >= answer.length) {
        mathVirus.data.input = ''; // Reset if wrong
      }
      updateVirusVisual(mathVirus);
    }
  }
  
  // Hold minigame - track key down
  const holdViruses = gameState.activeViruses.filter(v => v.minigame === 'hold');
  holdViruses.forEach(virus => {
    if (key === virus.data.key && !virus.data.isHolding) {
      virus.data.isHolding = true;
      virus.data.holdStart = Date.now();
      virus.data.holdInterval = setInterval(() => {
        const elapsed = Date.now() - virus.data.holdStart;
        virus.data.held = elapsed;
        if (elapsed >= virus.data.required) {
          clearInterval(virus.data.holdInterval);
          damageVirus(virus, 1);
        } else {
          updateVirusVisual(virus);
        }
      }, 50);
    }
  });
  
  // Rapid minigame - press key rapidly
  const rapidViruses = gameState.activeViruses.filter(v => v.minigame === 'rapid');
  rapidViruses.forEach(virus => {
    if (key === virus.data.key || (virus.data.key === 'SPACE' && e.code === 'Space')) {
      virus.data.presses++;
      if (virus.data.presses >= virus.data.required) {
        damageVirus(virus, 1);
      } else {
        updateVirusVisual(virus);
      }
    }
  });
  
  // Sequence minigame - press keys in order
  const seqViruses = gameState.activeViruses.filter(v => v.minigame === 'sequence');
  seqViruses.forEach(virus => {
    const expected = virus.data.sequence[virus.data.index];
    if (key === expected) {
      virus.data.index++;
      if (virus.data.index >= virus.data.sequence.length) {
        damageVirus(virus, 1);
      } else {
        updateVirusVisual(virus);
      }
    }
  });
  
  // Balance minigame - use A/D to balance
  const balanceViruses = gameState.activeViruses.filter(v => v.minigame === 'balance');
  balanceViruses.forEach(virus => {
    if (key === 'A') {
      virus.data.position = Math.max(0, virus.data.position - 5);
    } else if (key === 'D') {
      virus.data.position = Math.min(100, virus.data.position + 5);
    }
    if (Math.abs(virus.data.position - virus.data.target) < 10) {
      virus.data.balanceTime = (virus.data.balanceTime || 0) + 1;
      if (virus.data.balanceTime >= 20) {
        damageVirus(virus, 1);
      }
    } else {
      virus.data.balanceTime = 0;
    }
    updateVirusVisual(virus);
  });
  
  // Skill check con SPACE - simplificado: siempre funciona
  if (e.code === 'Space') {
    e.preventDefault();
    gameState.activeViruses.forEach(virus => {
      if (virus.minigame === 'skillcheck') {
        damageVirus(virus, 1);
      }
    });
  }
  
  // Flechas - procesar solo el más antiguo
  const arrowMap: Record<string, string> = { 'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→' };
  const arrow = arrowMap[e.code];
  if (arrow) {
    e.preventDefault();
    const arrowViruses = gameState.activeViruses
      .filter(v => v.minigame === 'arrow' && v.data.direction === arrow)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    if (arrowViruses.length > 0) {
      damageVirus(arrowViruses[0], arrowViruses[0].maxHealth);
    }
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (!gameState.running) return;
  
  const key = e.key.toUpperCase();
  
  // Hold minigame - reset on key up
  const holdViruses = gameState.activeViruses.filter(v => v.minigame === 'hold');
  holdViruses.forEach(virus => {
    if (key === virus.data.key && virus.data.isHolding) {
      virus.data.isHolding = false;
      if (virus.data.holdInterval) {
        clearInterval(virus.data.holdInterval);
        virus.data.holdInterval = null;
      }
      virus.data.held = 0;
      updateVirusVisual(virus);
    }
  });
}

function updateVirusVisual(virus: Virus): void {
  const virusEl = document.querySelector(`[data-id="${virus.id}"]`);
  if (!virusEl) return;
  
  const label = virusEl.querySelector('.minigame-label') as HTMLElement | null;
  if (!label) return;
  
  if (virus.minigame === 'type') {
    const typed = virus.data.input;
    const remaining = virus.data.code.slice(typed.length);
    label.innerHTML = `<span style="color:#22c55e">${typed}</span>${remaining}`;
  } else if (['target', 'spam', 'node'].includes(virus.minigame)) {
    const hits = virus.data.hits || 0;
    const required = virus.data.required;
    label.innerHTML = `${(label.textContent || '').split(' ')[0]} ${hits}/${required}`;
  } else if (virus.minigame === 'scan') {
    const hits = virus.data.hits || 0;
    const required = virus.data.required;
    label.innerHTML = `${(label.textContent || '').split(' ')[0]} ${hits}/${required}`;
  } else if (virus.minigame === 'hold') {
    const elapsed = virus.data.held || 0;
    const required = virus.data.required;
    const progress = Math.min(100, (elapsed / required) * 100);
    label.innerHTML = `⏳ ${Math.floor(progress)}%`;
  } else if (virus.minigame === 'rapid') {
    const presses = virus.data.presses || 0;
    const required = virus.data.required;
    label.innerHTML = `⚡ ${presses}/${required}`;
  } else if (virus.minigame === 'sequence') {
    const seq = virus.data.sequence;
    const idx = virus.data.index;
    const display = seq.map((k: string, i: number) => i < idx ? `<span style="color:#22c55e">${k}</span>` : k).join('→');
    label.innerHTML = `🔢 ${display}`;
  } else if (virus.minigame === 'math') {
    const input = virus.data.input || '';
    label.innerHTML = `🔢 ${virus.data.question}=<span style="color:#22c55e">${input}</span>`;
  } else if (virus.minigame === 'balance') {
    const pos = virus.data.position;
    const time = virus.data.balanceTime || 0;
    label.innerHTML = `⚖️ ${pos}% (${time}/20)`;
  }
}

/* ────────────────────────────────────────────
 * GAME LOOP
 * ──────────────────────────────────────────── */

function gameLoop(): void {
  if (!gameState.running) return;
  
  // Actualizar progreso
  const elapsed = Date.now() - gameState.startTime;
  const totalTime = 120000; // 2 minutos
  gameState.progress = Math.min(100, (elapsed / totalTime) * 100);
  
  // Verificar cambio de fase
  const newPhase = getCurrentPhase();
  if (newPhase.key !== gameState.phase) {
    gameState.phase = newPhase.key;
    playSound('phase');
    applyPhaseEffects(newPhase);
    
    // Actualizar spawn rate cuando cambia la fase
    updateSpawnRate();
  }
  
  // Eventos aleatorios en fases avanzadas
  if (gameState.phase !== 'INFILTRATION' && Math.random() < 0.01) {
    triggerRandomEvent();
  }
  
  // Mutación de virus mutantes
  gameState.activeViruses.forEach(virus => {
    if (virus.type === 'MUTANT' && virus.canMutate && Math.random() < 0.005) {
      virus.minigame = pick(MINIGAMES);
      virus.data = generateMinigameData(virus.minigame);
      virus.canMutate = false;
      // Re-renderizar
      const virusEl = document.querySelector(`[data-id="${virus.id}"]`);
      if (virusEl) {
        const minigameEl = virusEl.querySelector('.virus-minigame');
        if (minigameEl) {
          minigameEl.innerHTML = getMinigameHTML(virus);
        }
      }
    }
  });
  
  // Actualizar skill checks
  gameState.activeViruses.forEach(virus => {
    if (virus.minigame === 'skillcheck') {
      virus.data.currentAngle = (virus.data.currentAngle + 3 * gameState.speedMultiplier) % 360;
      const virusEl = document.querySelector(`[data-id="${virus.id}"]`);
      if (virusEl) {
        const label = virusEl.querySelector('.minigame-label') as HTMLElement | null;
        if (label) {
          label.style.transform = `rotate(${virus.data.currentAngle}deg)`;
        }
      }
    }
  });
  
  updateUI();
  
  // Verificar fin del juego
  if (gameState.progress >= 100) {
    endGame(true);
  }
}

function applyPhaseEffects(phase: PhaseInfo & { key?: PhaseKey }): void {
  ui.phaseEl.textContent = phase.name;
  ui.phaseEl.style.color = phase.color;
  
  // Efectos visuales según fase
  const gameArea = ui.gameArea;
  gameArea.classList.remove('phase-infiltration', 'phase-propagation', 'phase-overload', 'phase-collapse');
  
  // Obtener el key de la fase (manejar tanto objetos con key como objetos directos de PHASES)
  const phaseKey = phase.key || (Object.keys(PHASES) as PhaseKey[]).find(k => PHASES[k] === phase) || 'INFILTRATION';
  gameArea.classList.add(`phase-${phaseKey.toLowerCase()}`);
}

function updateSpawnRate(): void {
  if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
  
  let spawnRate: number;
  switch(gameState.phase) {
    case 'INFILTRATION': spawnRate = 3000; break;
    case 'PROPAGATION': spawnRate = 2000; break;
    case 'OVERLOAD': spawnRate = 1200; break;
    case 'COLLAPSE': spawnRate = 800; break;
    default: spawnRate = 3000;
  }
  spawnRate /= gameState.speedMultiplier;
  
  gameState.spawnInterval = setInterval(spawnVirus, spawnRate);
}

function spawnVirus(): void {
  if (!gameState.running) return;
  
  // Limitar número máximo de virus según fase
  const maxViruses = gameState.phase === 'COLLAPSE' ? 15 : 
                    gameState.phase === 'OVERLOAD' ? 10 : 
                    gameState.phase === 'PROPAGATION' ? 6 : 3;
  
  if (gameState.activeViruses.length < maxViruses) {
    const virus = createVirus();
    gameState.activeViruses.push(virus);
    
    const virusEl = renderVirus(virus);
    ui.virusContainer.appendChild(virusEl);
    
    playSound('spawn');
  }
}

/* ────────────────────────────────────────────
 * UI
 * ──────────────────────────────────────────── */

function updateUI(): void {
  if (ui.timerEl) {
    const elapsed = Date.now() - gameState.startTime;
    const remaining = Math.max(0, 120000 - elapsed);
    ui.timerEl.textContent = (remaining / 1000).toFixed(1) + 's';
  }
  
  if (ui.scoreEl) {
    ui.scoreEl.textContent = String(gameState.score);
  }
  
  if (ui.comboEl) {
    ui.comboEl.textContent = String(gameState.combo);
  }
  
  if (ui.virusCountEl) {
    ui.virusCountEl.textContent = String(gameState.activeViruses.length);
  }
}

/* ────────────────────────────────────────────
 * CONTROL DEL JUEGO
 * ──────────────────────────────────────────── */

function startGame(): void {
  initAudio();
  
  gameState = {
    running: true,
    phase: 'INFILTRATION',
    progress: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    virusesEliminated: 0,
    startTime: Date.now(),
    endTime: null,
    activeViruses: [],
    activeEvent: null,
    eventTimeout: null,
    spawnInterval: null,
    gameLoopInterval: null,
    controlsInverted: false,
    speedMultiplier: 1,
    screenDark: false,
    activeTypingVirusId: null
  };
  
  ui.setupPhase.classList.add('hidden');
  ui.gamePhase.classList.remove('hidden');
  ui.endPhase.classList.add('hidden');
  
  ui.virusContainer.innerHTML = '';
  ui.eventBanner.classList.add('hidden');
  
  applyPhaseEffects({ key: 'INFILTRATION', ...PHASES.INFILTRATION });
  updateUI();
  
  // Iniciar spawner con el rate correcto para la fase inicial
  updateSpawnRate();
  
  // Iniciar game loop
  gameState.gameLoopInterval = setInterval(gameLoop, 100);
  
  // Event listeners para teclado
  document.addEventListener('keydown', handleKeyPress);
  document.addEventListener('keyup', handleKeyUp);
}

function endGame(completed: boolean): void {
  gameState.running = false;
  gameState.endTime = Date.now();
  
  if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
  if (gameState.gameLoopInterval) clearInterval(gameState.gameLoopInterval);
  if (gameState.eventTimeout) clearTimeout(gameState.eventTimeout);
  // Cada virus del minijuego "hold" tiene su propio setInterval
  // (virus.data.holdInterval), limpiado normalmente en handleKeyUp al
  // soltar la tecla. Si el jugador salía del juego con una tecla
  // mantenida, ese interval no estaba cubierto por los 3 de arriba y
  // seguía corriendo — llamando updateVirusVisual/damageVirus sobre
  // una partida ya terminada.
  gameState.activeViruses.forEach(v => {
    if (v.data?.holdInterval) {
      clearInterval(v.data.holdInterval);
      v.data.holdInterval = null;
    }
  });
  
  document.removeEventListener('keydown', handleKeyPress);
  document.removeEventListener('keyup', handleKeyUp);
  
  endEvent();
  
  ui.gamePhase.classList.add('hidden');
  ui.endPhase.classList.remove('hidden');
  
  const timeSurvived = (((gameState.endTime as number) - gameState.startTime) / 1000).toFixed(1);
  
  ui.resultScore.textContent = String(gameState.score);
  ui.resultTime.textContent = timeSurvived + 's';
  ui.resultVirus.textContent = String(gameState.virusesEliminated);
  
  if (completed) {
    ui.resultEl.textContent = '¡SISTEMA PURGADO!';
    ui.resultEl.style.color = '#22c55e';
    playSound('phase');
  } else {
    ui.resultEl.textContent = 'SISTEMA COMPROMETIDO';
    ui.resultEl.style.color = '#ef4444';
    playSound('gameover');
  }
  
  if (window.Leaderboard) {
    window.Leaderboard.save('virusOverload', gameState.score);
  }
}

function stopGame(): void {
  if (gameState.running) {
    gameState.running = false;
    if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
    if (gameState.gameLoopInterval) clearInterval(gameState.gameLoopInterval);
    if (gameState.eventTimeout) clearTimeout(gameState.eventTimeout);
    gameState.activeViruses.forEach(v => {
      if (v.data?.holdInterval) {
        clearInterval(v.data.holdInterval);
        v.data.holdInterval = null;
      }
    });
    // Bug: solo se removía 'keydown', nunca 'keyup' (a diferencia de
    // endGame(), que remueve ambos) — si el jugador salía de la vista
    // a mitad de partida (en vez de llegar a game over), el listener
    // de 'keyup' quedaba pegado a `document` para siempre, así que
    // handleKeyUp seguía ejecutándose (y potencialmente tocando
    // gameState de una partida ya "detenida") en cada tecla soltada
    // durante el resto de la sesión.
    document.removeEventListener('keydown', handleKeyPress);
    document.removeEventListener('keyup', handleKeyUp);
    endEvent();
  }
}

/* ────────────────────────────────────────────
 * REGISTRO DEL JUEGO
 * ──────────────────────────────────────────── */

export function init(uiElement: GameUi) {
  const uiElements = uiElement as unknown as VirusOverloadUi;
  ui = uiElements;
  devLog('[Virus Overload] UI Elements:', ui);

  if (ui.start) {
    ui.start.addEventListener('click', (e) => {
      e.preventDefault();
      devLog('[Virus Overload] Start button clicked');
      startGame();
    });
  } else {
    console.warn('[Virus Overload] Start button not found');
  }

  if (ui.restartBtn) {
    ui.restartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startGame();
    });
  }

  if (ui.backBtn) {
    ui.backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      ViewManager.backToMenu('home');
    });
  }
}

export function start() {
  // Resetear UI al entrar
  if (ui.setupPhase) ui.setupPhase.classList.remove('hidden');
  if (ui.gamePhase) ui.gamePhase.classList.add('hidden');
  if (ui.endPhase) ui.endPhase.classList.add('hidden');
}

export function stop() {
  stopGame();
}

