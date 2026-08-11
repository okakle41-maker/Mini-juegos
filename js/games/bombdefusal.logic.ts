/**
 * js/games/bombdefusal.logic.ts
 *
 * Lógica pesada extraída de bombdefusal.ts para lazy loading — ver
 * `logic` en bombdefusal.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameHelpers from '../utils/gameHelpers.js';
import Leaderboard from '../leaderboardManager.js';

interface BombState {
  playing: boolean;
  serial: string;
  timeLeft: number;
  totalTime: number;
  strikes: number;
  maxStrikes: number;
  indicatorLit: boolean;
  modules: BombModule[];
  animMs: number;
  role: string;
  buttonLight: boolean;
  batteryLevel: number;
  portType: string;
  portCount: number;
}

/**
 * Cada módulo de la bomba tenía antes `data: Record<string, any>` y
 * `getSolution: (bomb?) => any` — TypeScript no verificaba nada de la
 * forma real de cada uno de los 31 tipos. `solvePassword` (ver más
 * abajo) tenía justamente ese problema: recibía `clues` pero lo
 * ignoraba al calcular la solución, calculándola sobre el universo
 * completo de palabras en vez del subconjunto realmente mostrado en
 * pantalla — ya arreglado.
 *
 * Ahora `BombModule` es una discriminated union por `type`: cada
 * `XModule` fija la forma real de `data` y el tipo de retorno real de
 * `getSolution` (tomado de su función `solveX` correspondiente, ver
 * "Solvers" más abajo). Las funciones `renderX(mod, ...)` más adelante
 * en este archivo se tipan con el miembro específico de la unión (p.ej.
 * `renderWires(mod: WiresModule, ...)`) en vez de `BombModule` genérico,
 * así que TypeScript narrowea automáticamente en `renderModuleBody`
 * (el `if (mod.type === 'wires') renderWires(mod, ...)`) y avisa si se
 * intenta leer `mod.data.algoQueNoExiste` para ese tipo específico.
 */

interface WiresModule {
  type: 'wires';
  solved: boolean;
  data: { wires: string[]; cutIndex: number | null };
  getSolution: (bomb: BombState) => { wireIndex: number };
}

interface ButtonsModule {
  type: 'buttons';
  solved: boolean;
  data: { color: string; label: string; pressed: boolean; holding: boolean; strikesAtStart: number };
  getSolution: (bomb: BombState) => { action: 'hold' | 'tap'; releaseOnSecondDigit?: number; releaseOnLight?: boolean };
}

interface SymbolsModule {
  type: 'symbols';
  solved: boolean;
  data: { symbols: string[]; order: string[]; step: number };
  getSolution: () => { order: string[] };
}

interface MemoryModule {
  type: 'memory';
  solved: boolean;
  data: { stage: number; display: number; labels: number[]; history: Array<{ position: number; label: number }> };
  getSolution: (bomb: BombState) => { position: number };
}

interface ScreenModule {
  type: 'screen';
  solved: boolean;
  data: { msg: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { answer: string };
}

interface FrequencyModule {
  type: 'frequency';
  solved: boolean;
  data: { labelA: string; labelB: string };
  getSolution: () => { freq: string };
}

interface ColorsModule {
  type: 'colors';
  solved: boolean;
  data: { colors: string[]; step: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { order: string[] };
}

interface PatternModule {
  type: 'pattern';
  solved: boolean;
  data: { size: number; litCount: number; decoy: number[]; selected: Set<number>; strikesAtStart: number };
  getSolution: (bomb: BombState) => { cells: number[] };
}

interface SwitchesModule {
  type: 'switches';
  solved: boolean;
  data: { states: boolean[]; strikesAtStart: number };
  getSolution: (bomb: BombState) => { states: boolean[] };
}

interface CodeModule {
  type: 'code';
  solved: boolean;
  data: { input: string };
  getSolution: (bomb: BombState) => { code: string };
}

interface KeypadModule {
  type: 'keypad';
  solved: boolean;
  data: { symbols: string[]; step: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { order: string[] };
}

interface MorseModule {
  type: 'morse';
  solved: boolean;
  data: { code: string; options: string[] };
  getSolution: () => { letter: string };
}

interface PasswordModule {
  type: 'password';
  solved: boolean;
  data: { clues: string[]; input: string };
  getSolution: (bomb: BombState) => { password: string };
}

interface SimonModule {
  type: 'simon';
  solved: boolean;
  data: { sequenceLength: number; step: number; playerSequence: string[]; strikesAtStart: number };
  getSolution: (bomb: BombState) => { colors: string[] };
}

interface KnobsModule {
  type: 'knobs';
  solved: boolean;
  data: { positions: number[]; strikesAtStart: number };
  getSolution: (bomb: BombState) => { positions: string[] };
}

interface MazeModule {
  type: 'maze';
  solved: boolean;
  data: { playerRow: number; playerCol: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { row: number; col: number };
}

interface TimerModule {
  type: 'timer';
  solved: boolean;
  data: { stopped: boolean; stopSecond: number | null; strikesAtStart: number };
  getSolution: (bomb: BombState) => { targetSecond: number };
}

interface SequenceModule {
  type: 'sequence';
  solved: boolean;
  data: { step: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { order: string[] };
}

interface BinaryModule {
  type: 'binary';
  solved: boolean;
  data: { input: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { binary: string };
}

interface MathModule {
  type: 'math';
  solved: boolean;
  data: { answer: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { a: number; b: number; op: string; result: number };
}

interface WordModule {
  type: 'word';
  solved: boolean;
  data: { word: string; revealed: string[]; input: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { word: string };
}

interface ReactionModule {
  type: 'reaction';
  solved: boolean;
  data: { lit: boolean; litTime: number | null; pressed: boolean; strikesAtStart: number };
  getSolution: (bomb: BombState) => { targetMs: number };
}

interface MatchingModule {
  type: 'matching';
  solved: boolean;
  // `board`: el tablero de 8 símbolos (4 pares) ya barajado, fijado una sola
  // vez al crear el módulo (ver createMatchingModule). Antes no
  // existía este campo: renderMatching llamaba mod.getSolution(state)
  // para armar el tablero visible, y como getSolution() invoca
  // solveMatching() (que hace su propio shuffle() interno cada vez que
  // se llama), el tablero completo se regeneraba con símbolos y
  // posiciones NUEVOS en cada re-render — es decir, en cada click del
  // jugador. El módulo era literalmente imposible de resolver: no
  // había forma de "recordar" dónde estaba un símbolo, porque cambiaba
  // antes del segundo click de cada intento de par.
  data: { selected: number[]; matched: number[]; board: string[] };
  getSolution: (bomb: BombState) => { pairs: string[][] };
}

interface CipherModule {
  type: 'cipher';
  solved: boolean;
  data: { input: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { original: string; encoded: string; shift: number };
}

interface TimingModule {
  type: 'timing';
  solved: boolean;
  data: { synced: boolean; strikesAtStart: number };
  getSolution: (bomb: BombState) => { offset: number };
}

interface CoordinatesModule {
  type: 'coordinates';
  solved: boolean;
  data: { x: string; y: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { x: number; y: number };
}

interface BatteryModule {
  type: 'battery';
  solved: boolean;
  data: { selectedLevel: number | null };
  getSolution: (bomb: BombState) => { targetLevel: number };
}

interface PortsModule {
  type: 'ports';
  solved: boolean;
  data: { selectedPort: string | null };
  getSolution: (bomb: BombState) => { targetPort: string };
}

interface CompassModule {
  type: 'compass';
  solved: boolean;
  data: { currentDirection: string; selectedDirection: string | null; strikesAtStart: number };
  getSolution: (bomb: BombState) => { targetDirection: string };
}

interface SlotsModule {
  type: 'slots';
  solved: boolean;
  data: { selectedSlot: number | null };
  getSolution: (bomb: BombState) => { targetSlot: number };
}

type BombModule =
  | WiresModule | ButtonsModule | SymbolsModule | MemoryModule | ScreenModule
  | FrequencyModule | ColorsModule | PatternModule | SwitchesModule | CodeModule
  | KeypadModule | MorseModule | PasswordModule | SimonModule | KnobsModule
  | MazeModule | TimerModule | SequenceModule | BinaryModule | MathModule
  | WordModule | ReactionModule | MatchingModule | CipherModule | TimingModule
  | CoordinatesModule | BatteryModule | PortsModule | CompassModule | SlotsModule;

let timerInterval: ReturnType<typeof setInterval> | null = null;
let holdInterval: ReturnType<typeof setInterval> | null = null;
let activeState: BombState | null = null;
let audioContext: AudioContext | null = null;
const soundEnabled = true;
let soundVolume = 0.3;

function initAudio() {
  if (!audioContext) {
    audioContext = new ((window.AudioContext || window.webkitAudioContext) as typeof AudioContext)();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch((err: unknown) => {
      console.error('[BombDefusal] Error al reanudar el audio:', err);
    });
  }
}

function playSound(type: string) {
  if (!soundEnabled || !audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  gainNode.gain.value = soundVolume;
  
  switch(type) {
    case 'success':
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'error':
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
    case 'strike':
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      break;
    case 'win':
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.3);
      oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.45);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      break;
    case 'lose':
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime + 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      break;
    case 'click':
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
      break;
  }
}

function setVolume(vol: number) {
  soundVolume = Math.max(0, Math.min(1, vol));
}

const WIRE_COLORS = ['red', 'blue', 'yellow', 'white', 'black'];
const BTN_COLORS = ['blue', 'white', 'yellow', 'red'];
const BTN_LABELS = ['PRESIONAR', 'MANTENER', 'ABORTAR', 'DETONAR', 'ACTIVAR'];
const FREQS = ['3.55', '3.70', '3.85', '4.00', '4.15', '4.30'];
const FREQ_LABELS = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'];
const SCREEN_MSGS = ['SÍ', 'NO', 'ARRIBA', 'ABAJO', 'IZQ', 'DER', '¿?', '88:88', '12:34', '99:99'];
const SCREEN_OPTS = ['SÍ', 'NO', 'ARRIBA', 'ABAJO', 'IZQ', 'DER', 'LISTO', 'ESPERA'];

const MODULE_NAMES: Record<string, string> = {
  wires: 'Cables',
  buttons: 'Botones',
  symbols: 'Símbolos',
  memory: 'Memoria',
  screen: 'Pantalla',
  frequency: 'Frecuencias',
  colors: 'Colores',
  pattern: 'Patrones',
  switches: 'Interruptores',
  code: 'Código',
  keypad: 'Teclado',
  morse: 'Morse',
  password: 'Contraseña',
  simon: 'Simon',
  knobs: 'Perillas',
  maze: 'Laberinto',
  timer: 'Cronómetro',
  sequence: 'Secuencia',
  binary: 'Binario',
  math: 'Matemáticas',
  word: 'Palabra',
  reaction: 'Reacción',
  matching: 'Parejas',
  cipher: 'Cifrado',
  timing: 'Sincronía',
  coordinates: 'Coordenadas',
  battery: 'Batería',
  ports: 'Puertos',
  compass: 'Brújula',
  slots: 'Ranuras'
};

const COLOR_NAMES = ['rojo', 'azul', 'verde', 'amarillo'];
const COLOR_CSS = { rojo: '#ef4444', azul: '#3b82f6', verde: '#22c55e', amarillo: '#eab308' };
const PASSWORD_WORDS = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL'];
const SIMON_COLORS = ['red', 'blue', 'green', 'yellow'];
const KNOB_POSITIONS = ['IZQ', 'ARRIBA', 'DER', 'ABAJO'];
const MAZE_SIZE = 5;
const PORT_OFFSETS: Record<string, number> = {
  'DVI': 0, 'Parallel': 1, 'PS/2': 2, 'RJ-45': 3, 'Stereo RCA': 4, 'USB': 5
};
const SEQUENCE_NUMBERS = ['1', '2', '3', '4', '5'];
const MATH_OPERATIONS = ['+', '-', '×'];
const WORD_WORDS = ['BOMBA', 'FUEGO', 'TIEMPO', 'CABLE', 'SECRETO', 'CODIGO', 'PULSAR', 'DETENER'];
const MATCHING_SYMBOLS = ['★', 'Ω', '©', 'λ', 'Ϙ', '¶', '¿', '♡'];
const CIPHER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const KEYPAD_GRID = ['λ', 'ψ', 'Ω', 'Ϙ', '☆', '¿', '¶', '♡', 'β'];
/** Nombre legible por símbolo, para aria-label — el motor de síntesis
 *  del lector de pantalla puede no verbalizar bien (o de forma
 *  distinguible entre sí) glyphs poco comunes como Ϙ, ¶ o ☆ vs ★. */
const SYMBOL_NAMES: Record<string, string> = {
  '★': 'estrella rellena', '☆': 'estrella vacía', 'Ω': 'omega', '©': 'copyright',
  'λ': 'lambda', 'Ϙ': 'koppa', '¶': 'párrafo', '¿': 'interrogación invertida',
  '♡': 'corazón', 'ψ': 'psi', 'β': 'beta', '?': 'interrogación',
};
const MORSE_WORDS = [
  { code: '·−·−', letter: 'C' },
  { code: '−··', letter: 'D' },
  { code: '·', letter: 'E' },
  { code: '··−·', letter: 'F' },
  { code: '−−·', letter: 'G' },
  { code: '····', letter: 'H' },
  { code: '··', letter: 'I' },
  { code: '·−−−', letter: 'J' },
  { code: '−·−', letter: 'K' },
  { code: '·−··', letter: 'L' },
  { code: '−−', letter: 'M' },
  { code: '−·', letter: 'N' },
  { code: '−−−', letter: 'O' },
  { code: '·−−·', letter: 'P' },
  { code: '−−·−', letter: 'Q' },
  { code: '·−·', letter: 'R' },
  { code: '···', letter: 'S' },
  { code: '−', letter: 'T' }
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// shuffle: ver GameHelpers.shuffle (js/utils/gameHelpers.ts)

function genSerial() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function genBatteryLevel() {
  return randInt(1, 4);
}

function genPortType() {
  const ports = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
  return pick(ports);
}

function genPortCount() {
  return randInt(1, 6);
}

function serialLastDigitEven(serial: string) {
  const d = serial.slice(-1);
  return '02468'.includes(d);
}

function countColor(wires: string[], color: string) {
  return wires.filter(w => w === color).length;
}

function lastIndexOfColor(wires: string[], color: string) {
  for (let i = wires.length - 1; i >= 0; i--) {
    if (wires[i] === color) return i;
  }
  return -1;
}

/* ── Solvers (reglas del manual) ── */

function solveWires(wires: string[], serial: string) {
  const n = wires.length;
  const reds = countColor(wires, 'red');
  const blues = countColor(wires, 'blue');
  const yellows = countColor(wires, 'yellow');
  const blacks = countColor(wires, 'black');

  if (n === 3) {
    if (reds === 0) return 1;
    if (blues === 1) return wires.indexOf('blue');
    return n - 1;
  }
  if (n === 4) {
    if (reds > 1) return lastIndexOfColor(wires, 'red');
    if (wires[n - 1] === 'yellow' && reds === 0) return 0;
    if (blues === 1) return 0;
    return 1;
  }
  if (n === 5) {
    if (wires[n - 1] === 'black') return 3;
    if (reds === 1 && yellows > 1) return 0;
    if (blacks === 0) return 1;
    return 0;
  }
  if (n === 6) {
    if (yellows === 0 && serialLastDigitEven(serial)) return 2;
    if (yellows === 1 && countColor(wires, 'white') > 1) return 3;
    if (reds === 0) return 1;
    return 0;
  }
  return 0;
}

function solveButton(
  color: string, label: string, serial: string, strikes: number, indicatorLit: boolean
): { action: 'hold' | 'tap'; releaseOnSecondDigit?: number; releaseOnLight?: boolean } {
  const vowel = /[AEIOU]/.test(serial[0]);
  if (color === 'blue' && label === 'ABORTAR') return { action: 'hold', releaseOnSecondDigit: 1 };
  if (color === 'white' && indicatorLit) return { action: 'tap' };
  if (color === 'yellow') return { action: 'hold', releaseOnLight: true };
  if (color === 'red' && label === 'DETONAR') return { action: 'tap' };
  if (color === 'red' && strikes > 0) return { action: 'hold', releaseOnLight: true };
  if (color === 'white') return { action: 'tap' };
  if (color === 'blue' && !vowel) return { action: 'tap' };
  return { action: 'hold', releaseOnLight: true };
}

function solveMemoryStage(stage: number, display: number, history: Array<{ position: number; label: number }>) {
  const labels = history.map(h => h.label);
  const positions = history.map(h => h.position);

  if (stage === 1) {
    if (display === 1) return 1;
    if (display === 4) return 3;
    return 0;
  }
  if (stage === 2) {
    if (display === 1) return labels.indexOf(1);
    if (display === 4) return 0;
    if (display === 2) return positions[0];
    return 1;
  }
  if (stage === 3) {
    if (display === 3) return labels.indexOf(3);
    if (display === 1) return labels.indexOf(1);
    return 2;
  }
  if (stage === 4) {
    if (display === 4) return positions[0];
    if (display === 2) return 0;
    return positions[1];
  }
  if (display === 1) return 0;
  if (display === 2) return positions[1];
  if (display === 4) return positions[0];
  return 1;
}

function solveScreen(msg: string, serial: string, strikes: number) {
  const lastDigit = parseInt(serial.slice(-1), 10) || 0;
  const vowel = /[AEIOU]/.test(serial[0]);

  if (msg === 'SÍ') return strikes > 0 ? 'NO' : 'SÍ';
  if (msg === 'NO') return vowel ? 'SÍ' : 'NO';
  if (msg === 'ARRIBA') return 'ABAJO';
  if (msg === 'ABAJO') return lastDigit % 2 === 0 ? 'ARRIBA' : 'IZQ';
  if (msg === 'IZQ') return 'DER';
  if (msg === 'DER') return strikes > 0 ? 'ESPERA' : 'LISTO';
  if (msg === '¿?') return 'SÍ';
  if (msg === '88:88') return 'ESPERA';
  if (msg === '12:34') return lastDigit <= 5 ? 'IZQ' : 'DER';
  if (msg === '99:99') return 'ABAJO';
  return pick(SCREEN_OPTS);
}

function serialDigitSum(serial: string) {
  let sum = 0;
  for (const ch of serial) {
    const d = parseInt(ch, 10);
    if (!isNaN(d)) sum += d;
  }
  return sum;
}

function serialVowelCount(serial: string) {
  return (serial.match(/[AEIOU]/gi) || []).length;
}

function solveFrequency(labelA: string, labelB: string) {
  const idxA = FREQ_LABELS.indexOf(labelA);
  const idxB = FREQ_LABELS.indexOf(labelB);
  const map = [
    ['3.55', '3.70'], ['3.70', '3.85'], ['3.85', '4.00'],
    ['4.00', '4.15'], ['4.15', '4.30'], ['4.30', '3.55']
  ];
  if (idxA >= 0 && idxB >= 0) {
    const pair = map[(idxA + idxB) % map.length];
    return pair[0];
  }
  return FREQS[0];
}

function solveColors(serial: string, strikes: number, indicatorLit: boolean, batteryLevel: number) {
  const orders = [
    ['rojo', 'azul', 'verde', 'amarillo'],
    ['azul', 'verde', 'amarillo', 'rojo'],
    ['verde', 'amarillo', 'rojo', 'azul'],
    ['amarillo', 'rojo', 'azul', 'verde']
  ];
  let idx = (serialDigitSum(serial) + batteryLevel) % 4;
  if (strikes > 0) idx = (idx + strikes) % 4;
  let order = orders[idx].slice();
  if (indicatorLit) order = order.slice(1);
  return order;
}

function solvePattern(litCount: number, serial: string, strikes: number, portCount: number) {
  const size = 5;
  const cells = [];
  const vowel = /[AEIOU]/.test(serial[0]);

  if (litCount === 4) {
    [[0, 0], [0, 4], [4, 0], [4, 4]].forEach(([r, c]) => cells.push(r * size + c));
  } else if (litCount === 5) {
    [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [0, 2], [1, 2], [3, 2], [4, 2]].forEach(([r, c]) => cells.push(r * size + c));
  } else {
    if (vowel) {
      for (let r = 0; r < size; r++) cells.push(r * size + 2);
    } else {
      for (let c = 0; c < size; c++) cells.push(2 * size + c);
    }
  }

  if (strikes > 0 || portCount > 3) {
    return cells.map(i => {
      const r = Math.floor(i / size);
      const c = i % size;
      return r * size + (size - 1 - c);
    });
  }
  return cells;
}

function solveSwitches(serial: string, strikes: number, indicatorLit: boolean) {
  const last = serial.slice(-1);
  const lastDigit = parseInt(last, 10);
  const sw1 = !isNaN(lastDigit) && lastDigit % 2 === 0;
  const sw2 = indicatorLit;
  const sw3 = (strikes + serialDigitSum(serial)) % 2 === 1;
  return [sw1, sw2, sw3];
}

function solveCode(serial: string) {
  const code = (serialDigitSum(serial) * 7 + serialVowelCount(serial) * 13) % 10000;
  return code.toString().padStart(4, '0');
}

function solveKeypad(serial: string, strikes: number, indicatorLit: boolean) {
  const first = serial[0].toUpperCase();
  const col3 = [KEYPAD_GRID[2], KEYPAD_GRID[5], KEYPAD_GRID[8]];
  const row1 = [KEYPAD_GRID[0], KEYPAD_GRID[1], KEYPAD_GRID[2]];
  let order = first <= 'M' ? row1 : col3;
  order = order.slice();
  if (indicatorLit) order = ['¶'].concat(order.filter(s => s !== '¶'));
  if (strikes > 0) order = order.slice().reverse();
  return order;
}

function solveMorse(code: string) {
  const found = MORSE_WORDS.find(w => w.code === code);
  return found ? found.letter : 'E';
}

// Antes: `clues` se recibía pero no se usaba para calcular la
// solución — el índice se calculaba sobre las 8 palabras completas de
// PASSWORD_WORDS, no sobre las 4 `clues` que createPasswordModule
// elige al azar y muestra como los únicos botones tocables por el
// jugador (ver renderPassword). Con probabilidad ~50% (la palabra
// correcta cae fuera de las 4 elegidas al azar) el módulo quedaba sin
// solución posible en pantalla — el jugador no podía completarlo sin
// importar qué botón tocara. Fix: el índice se calcula sobre `clues`
// (el subconjunto real de 4 palabras mostrado), así la respuesta
// siempre es una de las opciones visibles.
function solvePassword(clues: string[], serial: string) {
  const digitSum = serialDigitSum(serial);
  const vowelCount = serialVowelCount(serial);
  const idx = (digitSum + vowelCount) % clues.length;
  return clues[idx];
}

function solveSimon(serial: string, strikes: number) {
  const lastDigit = parseInt(serial.slice(-1), 10) || 0;
  const vowel = /[AEIOU]/.test(serial[0]);
  
  let colors = SIMON_COLORS.slice();
  if (strikes > 0) colors = colors.reverse();
  if (vowel) colors = [colors[1], colors[0], colors[3], colors[2]];
  if (lastDigit % 2 === 0) colors = [colors[2], colors[3], colors[0], colors[1]];
  
  return colors;
}

function solveKnobs(serial: string, strikes: number, indicatorLit: boolean, portType: string) {
  const digitSum = serialDigitSum(serial);
  const positions = [];
  const portOffset = PORT_OFFSETS[portType] || 0;
  
  for (let i = 0; i < 3; i++) {
    let idx = (digitSum + i + strikes + portOffset) % KNOB_POSITIONS.length;
    if (indicatorLit && i === 1) idx = (idx + 2) % KNOB_POSITIONS.length;
    positions.push(KNOB_POSITIONS[idx]);
  }
  
  return positions;
}

function solveMaze(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const exitRow = (digitSum + batteryLevel) % MAZE_SIZE;
  const exitCol = (digitSum + strikes) % MAZE_SIZE;
  return { row: exitRow, col: exitCol };
}

function solveTimer(serial: string, strikes: number, portCount: number) {
  const digitSum = serialDigitSum(serial);
  const targetSecond = (digitSum + strikes + portCount) % 60;
  return targetSecond;
}

function solveSequence(serial: string, strikes: number, portType: string) {
  const digitSum = serialDigitSum(serial);
  const portOffset = PORT_OFFSETS[portType] || 0;
  const startIdx = (digitSum + portOffset) % SEQUENCE_NUMBERS.length;
  let order = SEQUENCE_NUMBERS.slice(startIdx).concat(SEQUENCE_NUMBERS.slice(0, startIdx));
  if (strikes > 0) order = order.reverse();
  return order;
}

function solveBinary(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const target = (digitSum + strikes + batteryLevel * 2) % 32;
  return target.toString(2).padStart(5, '0');
}

function solveMath(serial: string, strikes: number, portCount: number) {
  const digitSum = serialDigitSum(serial);
  const a = (digitSum + portCount) % 10;
  const b = (digitSum + strikes) % 10;
  const op = MATH_OPERATIONS[digitSum % MATH_OPERATIONS.length];
  let result;
  if (op === '+') result = a + b;
  else if (op === '-') result = Math.abs(a - b);
  else result = a * b;
  return { a, b, op, result };
}

function solveWord(serial: string, strikes: number, portType: string) {
  const digitSum = serialDigitSum(serial);
  const portOffset = PORT_OFFSETS[portType] || 0;
  const idx = (digitSum + strikes + portOffset) % WORD_WORDS.length;
  return WORD_WORDS[idx];
}

function solveReaction(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const targetMs = 2000 + (digitSum * 100) + (strikes * 200) + (batteryLevel * 50);
  return targetMs;
}

function solveMatching() {
  const pairs = [];
  const symbols = GameHelpers.shuffle(MATCHING_SYMBOLS.slice());
  for (let i = 0; i < 4; i++) {
    pairs.push([symbols[i * 2], symbols[i * 2 + 1]]);
  }
  return pairs;
}

function solveCipher(serial: string, strikes: number, portCount: number) {
  const digitSum = serialDigitSum(serial);
  const shift = (digitSum + strikes + portCount) % 26;
  const original = pick(WORD_WORDS);
  let encoded = '';
  for (const char of original) {
    const idx = CIPHER_ALPHABET.indexOf(char);
    if (idx >= 0) {
      const newIdx = (idx + shift) % 26;
      encoded += CIPHER_ALPHABET[newIdx];
    } else {
      encoded += char;
    }
  }
  return { original, encoded, shift };
}

function solveTiming(serial: string, strikes: number, portType: string) {
  const digitSum = serialDigitSum(serial);
  const portOffset = PORT_OFFSETS[portType] || 0;
  const offset = (digitSum + strikes + portOffset) % 10;
  return offset;
}

function solveCoordinates(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const x = (digitSum + strikes + batteryLevel) % 10;
  const y = (digitSum + strikes * 2) % 10;
  return { x, y };
}

function solveBattery(serial: string) {
  const digitSum = serialDigitSum(serial);
  const targetLevel = (digitSum % 4) + 1;
  return targetLevel;
}

function solvePorts(serial: string) {
  const digitSum = serialDigitSum(serial);
  const targetPortIndex = digitSum % 6;
  const portTypes = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
  return portTypes[targetPortIndex];
}

function solveCompass(serial: string, strikes: number) {
  const digitSum = serialDigitSum(serial);
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const targetIndex = (digitSum + strikes) % 8;
  return directions[targetIndex];
}

function solveSlots(batteryLevel: number, portCount: number, serial: string) {
  const digitSum = serialDigitSum(serial);
  const targetSlot = (digitSum + batteryLevel + portCount) % 5;
  return targetSlot;
}

/* ── Module factories ── */

function createWiresModule(difficulty: number): WiresModule {
  const count = randInt(3, difficulty >= 4 ? 6 : 5);
  const wires: string[] = [];
  for (let i = 0; i < count; i++) wires.push(pick(WIRE_COLORS));
  return {
    type: 'wires',
    solved: false,
    data: { wires, cutIndex: null },
    getSolution(this: WiresModule, bomb: BombState) {
      return { wireIndex: solveWires(wires, bomb.serial) };
    }
  };
}

function createButtonsModule(bomb: BombState): ButtonsModule {
  return {
    type: 'buttons',
    solved: false,
    data: {
      color: pick(BTN_COLORS),
      label: pick(BTN_LABELS),
      pressed: false,
      holding: false,
      strikesAtStart: bomb.strikes
    },
    getSolution(this: ButtonsModule, bomb: BombState) {
      return solveButton(
        this.data.color, this.data.label,
        bomb.serial, this.data.strikesAtStart, bomb.indicatorLit
      );
    }
  };
}

function createSymbolsModule(): SymbolsModule {
  const ruleSets = [
    ['©', '★', '?', 'λ'],
    ['λ', '?', '★', 'Ϙ'],
    ['Ϙ', '¶', '★', 'λ'],
    ['Ω', '¿', '?', '★']
  ];
  const order = pick(ruleSets);
  const symbols = GameHelpers.shuffle(order.slice());
  return {
    type: 'symbols',
    solved: false,
    data: { symbols, order, step: 0 },
    getSolution(this: SymbolsModule) {
      return { order: this.data.order };
    }
  };
}

function createMemoryModule(): MemoryModule {
  const labels = GameHelpers.shuffle([0, 1, 2, 3]);
  return {
    type: 'memory',
    solved: false,
    data: {
      stage: 1,
      display: randInt(1, 4),
      labels,
      history: []
    },
    getSolution(this: MemoryModule, _bomb: BombState) {
      const d = this.data;
      return {
        position: solveMemoryStage(d.stage, d.display, d.history)
      };
    }
  };
}

function createScreenModule(bomb: BombState): ScreenModule {
  const msg = pick(SCREEN_MSGS);
  return {
    type: 'screen',
    solved: false,
    data: { msg, strikesAtStart: bomb.strikes },
    getSolution(this: ScreenModule, bomb: BombState) {
      return { answer: solveScreen(this.data.msg, bomb.serial, this.data.strikesAtStart) };
    }
  };
}

function createFrequencyModule(): FrequencyModule {
  const labelA = pick(FREQ_LABELS);
  let labelB = pick(FREQ_LABELS);
  while (labelB === labelA) labelB = pick(FREQ_LABELS);
  return {
    type: 'frequency',
    solved: false,
    data: { labelA, labelB },
    getSolution(this: FrequencyModule) {
      return { freq: solveFrequency(this.data.labelA, this.data.labelB) };
    }
  };
}

function createColorsModule(bomb: BombState): ColorsModule {
  const colors = GameHelpers.shuffle(COLOR_NAMES.slice());
  return {
    type: 'colors',
    solved: false,
    data: { colors, step: 0, strikesAtStart: bomb.strikes },
    getSolution(this: ColorsModule, bomb: BombState) {
      return { order: solveColors(bomb.serial, this.data.strikesAtStart, bomb.indicatorLit, bomb.batteryLevel) };
    }
  };
}

function createPatternModule(bomb: BombState): PatternModule {
  const size = 5;
  const litCount = pick([4, 5, 6]);
  const decoy = new Set<number>();
  while (decoy.size < litCount) decoy.add(randInt(0, size * size - 1));
  return {
    type: 'pattern',
    solved: false,
    data: { size, litCount, decoy: [...decoy], selected: new Set(), strikesAtStart: bomb.strikes },
    getSolution(this: PatternModule, bomb: BombState) {
      return { cells: solvePattern(this.data.litCount, bomb.serial, this.data.strikesAtStart, bomb.portCount) };
    }
  };
}

function createSwitchesModule(bomb: BombState): SwitchesModule {
  return {
    type: 'switches',
    solved: false,
    data: {
      states: [Math.random() > 0.5, Math.random() > 0.5, Math.random() > 0.5],
      strikesAtStart: bomb.strikes
    },
    getSolution(this: SwitchesModule, bomb: BombState) {
      return { states: solveSwitches(bomb.serial, this.data.strikesAtStart, bomb.indicatorLit) };
    }
  };
}

function createCodeModule(): CodeModule {
  return {
    type: 'code',
    solved: false,
    data: { input: '' },
    getSolution(this: CodeModule, bomb: BombState) {
      return { code: solveCode(bomb.serial) };
    }
  };
}

function createKeypadModule(bomb: BombState): KeypadModule {
  return {
    type: 'keypad',
    solved: false,
    data: { symbols: KEYPAD_GRID.slice(), step: 0, strikesAtStart: bomb.strikes },
    getSolution(this: KeypadModule, bomb: BombState) {
      return { order: solveKeypad(bomb.serial, this.data.strikesAtStart, bomb.indicatorLit) };
    }
  };
}

function createMorseModule(): MorseModule {
  const entry = pick(MORSE_WORDS);
  const distractors = GameHelpers.shuffle(
    MORSE_WORDS.filter(w => w.letter !== entry.letter).map(w => w.letter)
  ).slice(0, 3);
  const options = GameHelpers.shuffle([entry.letter, ...distractors]);
  return {
    type: 'morse',
    solved: false,
    data: { code: entry.code, options },
    getSolution(this: MorseModule) {
      return { letter: solveMorse(this.data.code) };
    }
  };
}

function createPasswordModule(): PasswordModule {
  const clues = GameHelpers.shuffle(PASSWORD_WORDS.slice()).slice(0, 4);
  return {
    type: 'password',
    solved: false,
    data: { clues, input: '' },
    getSolution(this: PasswordModule, bomb: BombState) {
      return { password: solvePassword(this.data.clues, bomb.serial) };
    }
  };
}

function createSimonModule(bomb: BombState): SimonModule {
  const sequenceLength = randInt(4, 6);
  return {
    type: 'simon',
    solved: false,
    data: { sequenceLength, step: 0, playerSequence: [], strikesAtStart: bomb.strikes },
    getSolution(this: SimonModule, bomb: BombState) {
      return { colors: solveSimon(bomb.serial, this.data.strikesAtStart) };
    }
  };
}

function createKnobsModule(bomb: BombState): KnobsModule {
  return {
    type: 'knobs',
    solved: false,
    data: { positions: [0, 0, 0], strikesAtStart: bomb.strikes },
    getSolution(this: KnobsModule, bomb: BombState) {
      return { positions: solveKnobs(bomb.serial, this.data.strikesAtStart, bomb.indicatorLit, bomb.portType) };
    }
  };
}

function createMazeModule(bomb: BombState): MazeModule {
  return {
    type: 'maze',
    solved: false,
    data: { playerRow: 0, playerCol: 0, strikesAtStart: bomb.strikes },
    getSolution(this: MazeModule, bomb: BombState) {
      return solveMaze(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel);
    }
  };
}

function createTimerModule(bomb: BombState): TimerModule {
  return {
    type: 'timer',
    solved: false,
    data: { stopped: false, stopSecond: null, strikesAtStart: bomb.strikes },
    getSolution(this: TimerModule, bomb: BombState) {
      return { targetSecond: solveTimer(bomb.serial, this.data.strikesAtStart, bomb.portCount) };
    }
  };
}

function createSequenceModule(bomb: BombState): SequenceModule {
  return {
    type: 'sequence',
    solved: false,
    data: { step: 0, strikesAtStart: bomb.strikes },
    getSolution(this: SequenceModule, bomb: BombState) {
      return { order: solveSequence(bomb.serial, this.data.strikesAtStart, bomb.portType) };
    }
  };
}

function createBinaryModule(bomb: BombState): BinaryModule {
  return {
    type: 'binary',
    solved: false,
    data: { input: '', strikesAtStart: bomb.strikes },
    getSolution(this: BinaryModule, bomb: BombState) {
      return { binary: solveBinary(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel) };
    }
  };
}

function createMathModule(bomb: BombState): MathModule {
  return {
    type: 'math',
    solved: false,
    data: { answer: '', strikesAtStart: bomb.strikes },
    getSolution(this: MathModule, bomb: BombState) {
      return solveMath(bomb.serial, this.data.strikesAtStart, bomb.portCount);
    }
  };
}

function createWordModule(bomb: BombState): WordModule {
  const word = pick(WORD_WORDS);
  return {
    type: 'word',
    solved: false,
    data: { word, revealed: [], input: '', strikesAtStart: bomb.strikes },
    getSolution(this: WordModule, bomb: BombState) {
      return { word: solveWord(bomb.serial, this.data.strikesAtStart, bomb.portType) };
    }
  };
}

function createReactionModule(bomb: BombState): ReactionModule {
  return {
    type: 'reaction',
    solved: false,
    data: { lit: false, litTime: null, pressed: false, strikesAtStart: bomb.strikes },
    getSolution(this: ReactionModule, bomb: BombState) {
      return { targetMs: solveReaction(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel) };
    }
  };
}

function createMatchingModule(): MatchingModule {
  // El tablero (8 símbolos, 4 pares, ya barajado) se genera UNA SOLA
  // VEZ acá y se guarda en `data.board` — no en cada render. Ver el
  // comentario en la interfaz MatchingModule para el bug que esto
  // corrige: antes el tablero se recalculaba con símbolos y
  // posiciones distintos en cada re-render, haciendo el módulo
  // irresoluble.
  const pairs = solveMatching();
  const board = GameHelpers.shuffle(pairs.flat().slice());
  return {
    type: 'matching',
    solved: false,
    data: { selected: [], matched: [], board },
    getSolution(this: MatchingModule, _bomb: BombState) {
      return { pairs };
    }
  };
}

function createCipherModule(bomb: BombState): CipherModule {
  return {
    type: 'cipher',
    solved: false,
    data: { input: '', strikesAtStart: bomb.strikes },
    getSolution(this: CipherModule, bomb: BombState) {
      return solveCipher(bomb.serial, this.data.strikesAtStart, bomb.portCount);
    }
  };
}

function createTimingModule(bomb: BombState): TimingModule {
  return {
    type: 'timing',
    solved: false,
    data: { synced: false, strikesAtStart: bomb.strikes },
    getSolution(this: TimingModule, bomb: BombState) {
      return { offset: solveTiming(bomb.serial, this.data.strikesAtStart, bomb.portType) };
    }
  };
}

function createCoordinatesModule(bomb: BombState): CoordinatesModule {
  return {
    type: 'coordinates',
    solved: false,
    data: { x: '', y: '', strikesAtStart: bomb.strikes },
    getSolution(this: CoordinatesModule, bomb: BombState) {
      return solveCoordinates(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel);
    }
  };
}

function createBatteryModule(): BatteryModule {
  return {
    type: 'battery',
    solved: false,
    data: { selectedLevel: null },
    getSolution(this: BatteryModule, bomb: BombState) {
      return { targetLevel: solveBattery(bomb.serial) };
    }
  };
}

function createPortsModule(): PortsModule {
  return {
    type: 'ports',
    solved: false,
    data: { selectedPort: null },
    getSolution(this: PortsModule, bomb: BombState) {
      return { targetPort: solvePorts(bomb.serial) };
    }
  };
}

function createCompassModule(bomb: BombState): CompassModule {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return {
    type: 'compass',
    solved: false,
    data: { currentDirection: pick(directions), selectedDirection: null, strikesAtStart: bomb.strikes },
    getSolution(this: CompassModule, bomb: BombState) {
      return { targetDirection: solveCompass(bomb.serial, this.data.strikesAtStart) };
    }
  };
}

function createSlotsModule(): SlotsModule {
  return {
    type: 'slots',
    solved: false,
    data: { selectedSlot: null },
    getSolution(this: SlotsModule, bomb: BombState) {
      return { targetSlot: solveSlots(bomb.batteryLevel, bomb.portCount, bomb.serial) };
    }
  };
}

// Bug de "strikes en vivo desincroniza la solución" (mismo patrón que
// bombdefusalScreenStrikeDrift.test.ts): 19 de los 31 tipos de módulo
// (buttons, screen, colors, pattern, switches, keypad, simon, knobs,
// maze, timer, sequence, binary, math, word, reaction, cipher, timing,
// coordinates, compass) tenían su `solve*` leyendo `bomb.strikes` en
// vivo desde `getSolution(state)`. Como `getSolution` se invoca de
// nuevo en cada click/render, un strike en CUALQUIER OTRO módulo
// cambiaba silenciosamente la respuesta correcta de estos, sin que la
// pista mostrada en pantalla (fijada una sola vez al crear el módulo)
// cambiara para avisarlo. La solución: cada módulo afectado guarda
// `data.strikesAtStart = bomb.strikes` en el momento de su creación
// (siempre 0, porque `generateBomb` corre una sola vez al iniciar la
// partida, antes de que exista ningún strike) y su `getSolution` usa
// ese valor congelado en vez de `bomb.strikes` en vivo. Por eso las
// factories de estos 19 tipos ahora reciben `bomb: BombState` como
// segundo parámetro.
const MODULE_FACTORIES: Record<string, (difficulty: number, bomb: BombState) => BombModule> = {
  wires: (difficulty) => createWiresModule(difficulty),
  buttons: (_difficulty, bomb) => createButtonsModule(bomb),
  symbols: () => createSymbolsModule(),
  memory: () => createMemoryModule(),
  screen: (_difficulty, bomb) => createScreenModule(bomb),
  frequency: () => createFrequencyModule(),
  colors: (_difficulty, bomb) => createColorsModule(bomb),
  pattern: (_difficulty, bomb) => createPatternModule(bomb),
  switches: (_difficulty, bomb) => createSwitchesModule(bomb),
  code: () => createCodeModule(),
  keypad: (_difficulty, bomb) => createKeypadModule(bomb),
  morse: () => createMorseModule(),
  password: () => createPasswordModule(),
  simon: (_difficulty, bomb) => createSimonModule(bomb),
  knobs: (_difficulty, bomb) => createKnobsModule(bomb),
  maze: (_difficulty, bomb) => createMazeModule(bomb),
  timer: (_difficulty, bomb) => createTimerModule(bomb),
  sequence: (_difficulty, bomb) => createSequenceModule(bomb),
  binary: (_difficulty, bomb) => createBinaryModule(bomb),
  math: (_difficulty, bomb) => createMathModule(bomb),
  word: (_difficulty, bomb) => createWordModule(bomb),
  reaction: (_difficulty, bomb) => createReactionModule(bomb),
  matching: () => createMatchingModule(),
  cipher: (_difficulty, bomb) => createCipherModule(bomb),
  timing: (_difficulty, bomb) => createTimingModule(bomb),
  coordinates: (_difficulty, bomb) => createCoordinatesModule(bomb),
  battery: () => createBatteryModule(),
  ports: () => createPortsModule(),
  compass: (_difficulty, bomb) => createCompassModule(bomb),
  slots: () => createSlotsModule()
};

function buildManualHTML() {
  return `
    <div class="bd-manual-intro">
      <p class="bd-manual-callsign">📻 <strong>MANUAL TÉCNICO EOD · PROTOCOLOS DE DESACTIVACIÓN</strong></p>
      <p><em>Este manual contiene los procedimientos estándar para la desactivación de dispositivos explosivos improvisados. Siga las instrucciones en orden. Verifique todos los datos con el Operador antes de proceder. La precisión es crítica.</em></p>
      <p class="bd-manual-warn">⚠️ <strong>Terminología:</strong> <code>Serial</code> = código alfanumérico del dispositivo · <code>Indicador</code> = LED de estado (activo/inactivo) · <code>Strikes</code> = errores acumulados · <code>Dígitos</code> = caracteres numéricos del serial · <code>Vocales</code> = A, E, I, O, U. Requerido para cálculos.</p>
    </div>

    <h3 id="man-wires">📕 Protocolo W · Desarmado de cableado</h3>
    <p class="bd-manual-flavor"><em>Identifique el cable correcto según el número de hilos y su configuración de colores. Solicite al Operador que describa los cables de arriba a abajo.</em></p>
    <ul>
      <li><strong>3 hilos:</strong> Sin cables rojos → corte el del medio. Con exactamente un cable azul → corte el azul. En cualquier otro caso → corte el último.</li>
      <li><strong>4 hilos:</strong> Con más de un cable rojo → corte el último cable rojo. Con cable amarillo al final y sin cables rojos → corte el primero. Con exactamente un cable azul → corte el primero. En otros casos → corte el segundo.</li>
      <li><strong>5 hilos:</strong> Con cable negro al final → corte el cuarto. Con exactamente un cable rojo y más de un cable amarillo → corte el primero. Sin cables negros → corte el segundo. En otros casos → corte el primero.</li>
      <li><strong>6 hilos:</strong> Sin cables amarillos y último dígito del serial par → corte el tercero. Con exactamente un cable amarillo y más de un cable blanco → corte el cuarto. Sin cables rojos → corte el segundo. En otros casos → corte el primero.</li>
    </ul>

    <h3 id="man-buttons">📗 Protocolo B · Pulsadores armados</h3>
    <p class="bd-manual-flavor"><em>Determine la acción requerida según el color del botón y su etiqueta. Evalúe las condiciones en orden.</em></p>
    <ul>
      <li>Botón azul con etiqueta "ABORTAR" → mantenga presionado, libere cuando el dígito de las unidades del temporizador coincida.</li>
      <li>Botón blanco con indicador activo → pulse brevemente.</li>
      <li>Botón amarillo → mantenga presionado, libere cuando el indicador se ilumine.</li>
      <li>Botón rojo con etiqueta "DETONAR" → pulse brevemente.</li>
      <li>Botón rojo con strikes > 0 → mantenga presionado, libere cuando el indicador se ilumine.</li>
      <li>Botón blanco (sin indicador) → pulse brevemente.</li>
      <li>Botón azul sin vocal en el serial → pulse brevemente.</li>
      <li>Cualquier otro caso → mantenga presionado, libere cuando el indicador se ilumine.</li>
    </ul>

    <h3 id="man-symbols">📒 Protocolo Σ · Glifos cirílicos</h3>
    <p class="bd-manual-flavor"><em>Identifique el orden de pulsación según los símbolos presentes. Cuatro símbolos deben pulsarse en secuencia.</em></p>
    <ul>
      <li>Pulse los símbolos en el orden especificado, uno tras otro.</li>
      <li>Con ★ y © → pulse ©, ★, ?, λ.</li>
      <li>Con λ y ? → pulse λ, ?, ★, Ϙ.</li>
      <li>Con ¶ y Ϙ → pulse Ϙ, ¶, ★, λ.</li>
      <li>Con Ω y ¿ → pulse Ω, ¿, ?, ★.</li>
    </ul>

    <h3 id="man-memory">📘 Protocolo M · Secuencia de memoria volátil</h3>
    <p class="bd-manual-flavor"><em>Cinco etapas secuenciales. La pantalla muestra un número (1-4). Los botones tienen etiquetas (0-3). Registre cada etapa.</em></p>
    <ul>
      <li><strong>Etapa 1:</strong> Display=1 → posición 1. Display=4 → posición 3. Otros → posición 0.</li>
      <li><strong>Etapa 2:</strong> Display=1 → botón con etiqueta 1. Display=4 → posición 0. Display=2 → misma posición que etapa 1. Otros → posición 1.</li>
      <li><strong>Etapa 3:</strong> Display=3 → botón con etiqueta 3. Display=1 → botón con etiqueta 1. Otros → posición 2.</li>
      <li><strong>Etapa 4:</strong> Display=4 → posición de etapa 1. Display=2 → posición 0. Otros → posición de etapa 2.</li>
      <li><strong>Etapa 5:</strong> Display=1 → posición 0. Display=2 → posición de etapa 2. Display=4 → posición de etapa 1. Otros → posición de etapa 3.</li>
    </ul>

    <h3 id="man-screen">📕 Protocolo P · Pantalla parlante</h3>
    <p class="bd-manual-flavor"><em>La pantalla muestra un mensaje. Determine la respuesta correcta según el mensaje y las condiciones del dispositivo.</em></p>
    <ul>
      <li>"SÍ" → responda "SÍ" si strikes=0, de lo contrario "NO".</li>
      <li>"NO" → responda "SÍ" si el serial comienza con vocal, de lo contrario "NO".</li>
      <li>"ARRIBA" → responda "ABAJO".</li>
      <li>"ABAJO" → responda "ARRIBA" si último dígito par, de lo contrario "IZQ".</li>
      <li>"IZQ" → responda "DER".</li>
      <li>"DER" → responda "ESPERA" si strikes>0, de lo contrario "LISTO".</li>
      <li>"¿?" → responda "SÍ". "88:88" → responda "ESPERA". "12:34" → responda "IZQ" si último dígito ≤5, de lo contrario "DER". "99:99" → responda "ABAJO".</li>
    </ul>

    <h3 id="man-frequency">📗 Protocolo F · Sintonía de detonador</h3>
    <p class="bd-manual-flavor"><em>El módulo muestra dos etiquetas OTAN. Conviértalas a índices numéricos (Alfa=0, Bravo=1, etc.), sume y determine la banda.</em></p>
    <ul>
      <li>Índice de banda = (índice etiqueta A + índice etiqueta B) mod 6.</li>
      <li>Cada banda permite dos frecuencias: la inferior y la superior.</li>
      <li>Banda 0 → 3.55 o 3.70 MHz. Banda 1 → 3.70 o 3.85 MHz. Banda 2 → 3.85 o 4.00 MHz. Banda 3 → 4.00 o 4.15 MHz. Banda 4 → 4.15 o 4.30 MHz. Banda 5 → 4.30 o 3.55 MHz.</li>
      <li>Seleccione la frecuencia inferior de la banda calculada.</li>
    </ul>

    <h3 id="man-colors">📒 Protocolo C · Cromática Hostil</h3>
    <p class="bd-manual-flavor"><em>Cuatro pulsos de color. Determine el punto de inicio según la suma de dígitos del serial y el nivel de batería.</em></p>
    <ul>
      <li>Secuencia base: rojo, azul, verde, amarillo.</li>
      <li>Índice de inicio = (suma de dígitos del serial + nivel de batería + strikes) mod 4.</li>
      <li>Si el indicador está activo, omita el primer color de la secuencia.</li>
      <li>Pulse los colores en el orden determinado, comenzando desde el índice calculado.</li>
    </ul>

    <h3 id="man-pattern">📘 Protocolo Π · Patrón fantasma</h3>
    <p class="bd-manual-flavor"><em>El módulo muestra celdas iluminadas. El patrón correcto depende del número de celdas iluminadas, el serial y el conteo de puertos.</em></p>
    <ul>
      <li>Cuadrícula 5×5.</li>
      <li>4 celdas iluminadas → seleccione las cuatro esquinas (0,0), (0,4), (4,0), (4,4).</li>
      <li>5 celdas iluminadas → seleccione la cruz central: fila 2 completa y columna 2 completa.</li>
      <li>6 celdas iluminadas → si el serial comienza con consonante, seleccione la fila central (fila 2). Si comienza con vocal, seleccione la columna central (columna 2).</li>
      <li>Si strikes > 0 o conteo de puertos > 3, invierta horizontalmente el patrón (espejo).</li>
    </ul>

    <h3 id="man-switches">📕 Protocolo S · Interruptores tácticos</h3>
    <p class="bd-manual-flavor"><em>Tres interruptores. Determine cuáles deben estar activos según las condiciones del dispositivo.</em></p>
    <ul>
      <li>Interruptor 1: activo si el último carácter del serial es un dígito par.</li>
      <li>Interruptor 2: activo si el indicador está iluminado.</li>
      <li>Interruptor 3: activo si (suma de dígitos del serial + strikes) es impar.</li>
    </ul>

    <h3 id="man-code">📗 Protocolo K · Código de anulación</h3>
    <p class="bd-manual-flavor"><em>Calcule el código de anulación de cuatro dígitos basándose en el serial del dispositivo.</em></p>
    <ul>
      <li>Calcule la suma de los dígitos del serial y cuente las vocales en la parte alfabética.</li>
      <li>Código = (suma de dígitos × 7 + conteo de vocales × 13) mod 10000.</li>
      <li>Formatee el resultado con exactamente 4 dígitos, anteponiendo ceros si es necesario.</li>
      <li>El Operador debe ingresar este código.</li>
    </ul>

    <h3 id="man-keypad">📒 Protocolo T · Teclado rúnico</h3>
    <p class="bd-manual-flavor"><em>Determine la secuencia de pulsación según el serial y el estado del indicador. El teclado tiene una distribución fija de 3×3.</em></p>
    <ul>
      <li>Distribución: fila superior [λ, ψ, Ω], fila central [Ϙ, ☆, ¿], fila inferior [¶, ♡, β].</li>
      <li>Si la primera letra del serial está en A-M: pulse la fila superior de izquierda a derecha.</li>
      <li>Si está en N-Z: pulse la columna derecha de arriba a abajo.</li>
      <li>Si el indicador está activo: pulse ¶ primero, luego continúe con la secuencia.</li>
      <li>Si strikes > 0: invierta el orden de la secuencia.</li>
    </ul>

    <h3 id="man-morse">📘 Protocolo · — · · Morse Bravo</h3>
    <p class="bd-manual-flavor"><em>El módulo transmite un código Morse. Identifique la letra correspondiente.</em></p>
    <ul>
      <li>Cartilla Morse (·=punto, −=raya): E·, T−, A·−, I··, S···, N−·, O−−−, M−−, R·−·, L·−··.</li>
      <li>Letras adicionales: C·−·−, D−···, F··−··, G−−··, H····, J·−−−, K−·−, P·−−··, Q−−·−.</li>
      <li>Si la letra no está en la cartilla, elimínela por exclusión de las opciones.</li>
    </ul>

    <h3 id="man-password">📕 Protocolo Ψ · Contraseña OTAN</h3>
    <p class="bd-manual-flavor"><em>Determine la contraseña correcta de las cuatro opciones mostradas.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial + conteo de vocales) mod 8.</li>
      <li>Léxico OTAN: 0=ALFA, 1=BRAVO, 2=CHARLIE, 3=DELTA, 4=ECHO, 5=FOXTROT, 6=GOLF, 7=HOTEL.</li>
      <li>Seleccione la palabra en la posición calculada.</li>
    </ul>

    <h3 id="man-simon">📗 Protocolo Σi · Eco lumínico</h3>
    <p class="bd-manual-flavor"><em>El módulo muestra una secuencia de colores. Determine la secuencia de respuesta aplicando transformaciones.</em></p>
    <ul>
      <li>Secuencia base: rojo, azul, verde, amarillo.</li>
      <li>Si strikes > 0: invierta la secuencia.</li>
      <li>Si el serial comienza con vocal: intercambie los dos primeros y los dos últimos colores.</li>
      <li>Si el último dígito del serial es par: rote dos posiciones (tercero y cuarto al frente).</li>
      <li>Aplique las transformaciones en orden y repita la secuencia resultante.</li>
    </ul>

    <h3 id="man-knobs">📒 Protocolo Δ · Perillas balísticas</h3>
    <p class="bd-manual-flavor"><em>Tres perillas con cuatro posiciones cada una. Calcule la orientación correcta para cada una según el tipo de puerto.</em></p>
    <ul>
      <li>Ciclo de posiciones: izquierda, arriba, derecha, abajo.</li>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Para la perilla i (0,1,2): índice = (suma de dígitos del serial + i + strikes + offset puerto) mod 4.</li>
      <li>Si el indicador está activo: añada 2 al índice de la perilla central (i=1).</li>
      <li>Oriente cada perilla según el índice calculado.</li>
    </ul>

    <h3 id="man-maze">📘 Protocolo L · Cartografía del laberinto</h3>
    <p class="bd-manual-flavor"><em>Determine las coordenadas de salida en una cuadrícula 5×5. El Operador comienza en (0,0).</em></p>
    <ul>
      <li>Fila de salida = (suma de dígitos del serial + nivel de batería) mod 5.</li>
      <li>Columna de salida = (suma de dígitos del serial + strikes) mod 5.</li>
      <li>Dirija al Operador con movimientos cardinales hasta la salida.</li>
    </ul>

    <h3 id="man-timer">📕 Protocolo χ · Cronómetro al filo</h3>
    <p class="bd-manual-flavor"><em>Determine el segundo exacto en que el Operador debe detener el cronómetro según el conteo de puertos.</em></p>
    <ul>
      <li>Segundo objetivo = (suma de dígitos del serial + strikes + conteo de puertos) mod 60.</li>
      <li>El Operador debe detener el cronómetro cuando el display muestre exactamente ese segundo.</li>
    </ul>

    <h3 id="man-sequence">📗 Protocolo N · Secuencia numérica</h3>
    <p class="bd-manual-flavor"><em>Determine el punto de inicio de la secuencia numérica 1-2-3-4-5 según el tipo de puerto.</em></p>
    <ul>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Índice de inicio = (suma de dígitos del serial + offset puerto) mod 5.</li>
      <li>Comience desde el número en el índice calculado y continúe cíclicamente (1→2→3→4→5→1).</li>
      <li>Si strikes > 0: invierta la secuencia.</li>
    </ul>

    <h3 id="man-binary">📒 Protocolo 01 · Cifra binaria</h3>
    <p class="bd-manual-flavor"><em>Convierta un valor decimal a binario de 5 bits según el nivel de batería.</em></p>
    <ul>
      <li>Valor = (suma de dígitos del serial + strikes + nivel de batería × 2) mod 32.</li>
      <li>Convierta a binario con exactamente 5 bits (anteponga ceros si es necesario).</li>
      <li>El Operador debe ingresar los bits del más significativo al menos significativo.</li>
    </ul>

    <h3 id="man-math">📘 Protocolo Σ+ · Aritmética bajo fuego</h3>
    <p class="bd-manual-flavor"><em>Calcule una operación aritmética basada en el serial y el conteo de puertos.</em></p>
    <ul>
      <li>Operando A = (suma de dígitos del serial + conteo de puertos) mod 10.</li>
      <li>Operando B = (suma de dígitos del serial + strikes) mod 10.</li>
      <li>Operación: si (suma de dígitos mod 3) = 0 → suma, = 1 → resta, = 2 → multiplicación.</li>
      <li>El resultado debe ser no negativo. El Operador ingresa el resultado.</li>
    </ul>

    <h3 id="man-word">📕 Protocolo Ω · Palabra clave</h3>
    <p class="bd-manual-flavor"><em>Determine la palabra clave del léxico EOD según el tipo de puerto.</em></p>
    <ul>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Índice = (suma de dígitos del serial + strikes + offset puerto) mod 8.</li>
      <li>Léxico EOD: 0=BOMBA, 1=FUEGO, 2=TIEMPO, 3=CABLE, 4=SECRETO, 5=CODIGO, 6=PULSAR, 7=DETENER.</li>
      <li>Seleccione la palabra en la posición calculada.</li>
    </ul>

    <h3 id="man-reaction">📗 Protocolo R · Reflejo controlado</h3>
    <p class="bd-manual-flavor"><em>Determine el tiempo de reacción objetivo en milisegundos según el nivel de batería.</em></p>
    <ul>
      <li>Tiempo base = 2000 ms.</li>
      <li>Añada 100 ms por cada unidad en la suma de dígitos del serial.</li>
      <li>Añada 200 ms por cada strike acumulado.</li>
      <li>Añada 50 ms por cada nivel de batería.</li>
      <li>El Operador debe presionar dentro de ±200 ms del objetivo tras el encendido del indicador.</li>
    </ul>

    <h3 id="man-matching">📒 Protocolo ⇆ · Pares espejo</h3>
    <p class="bd-manual-flavor"><em>Memorice las posiciones de los símbolos para encontrar las parejas coincidentes.</em></p>
    <ul>
      <li>Ocho casillas con cuatro parejas de símbolos.</li>
      <li>Las parejas correctas permanecen visibles; las incorrectas se ocultan.</li>
      <li>Registre las coordenadas de cada símbolo revelado.</li>
    </ul>

    <h3 id="man-cipher">📘 Protocolo Φ · Cifrado César</h3>
    <p class="bd-manual-flavor"><em>Descifre un mensaje cifrado con desplazamiento César según el conteo de puertos.</em></p>
    <ul>
      <li>Desplazamiento = (suma de dígitos del serial + strikes + conteo de puertos) mod 26.</li>
      <li>Para descifrar: retroceda cada letra del mensaje cifrado por el desplazamiento.</li>
      <li>El alfabeto es circular (Z → A).</li>
    </ul>

    <h3 id="man-timing">📕 Protocolo τ · Sincronía dual</h3>
    <p class="bd-manual-flavor"><em>Determine el desfase requerido entre dos relojes según el tipo de puerto.</em></p>
    <ul>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Desfase = (suma de dígitos del serial + strikes + offset puerto) mod 10 segundos.</li>
      <li>El segundo reloj debe estar desfasado del primero por el valor calculado.</li>
      <li>Especifique si el desfase es positivo (adelante) o negativo (atrás).</li>
    </ul>

    <h3 id="man-coordinates">📗 Protocolo XY · Coordenadas tácticas</h3>
    <p class="bd-manual-flavor"><em>Calcule dos coordenadas (X, Y) en el rango 0-9 según el nivel de batería.</em></p>
    <ul>
      <li>Coordenada X = (suma de dígitos del serial + strikes + nivel de batería) mod 10.</li>
      <li>Coordenada Y = (suma de dígitos del serial + strikes × 2) mod 10.</li>
      <li>El Operador debe ingresar ambas coordenadas.</li>
    </ul>

    <h3 id="man-battery">📕 Protocolo 🔋 · Nivel de batería</h3>
    <p class="bd-manual-flavor"><em>Determine el nivel de batería correcto según el serial.</em></p>
    <ul>
      <li>Nivel objetivo = ((suma de dígitos del serial) mod 4) + 1.</li>
      <li>Rango válido: 1-4.</li>
      <li>El Operador debe seleccionar el nivel calculado.</li>
    </ul>

    <h3 id="man-ports">📗 Protocolo ⚓ · Identificación de puertos</h3>
    <p class="bd-manual-flavor"><em>Determine el puerto correcto de la lista disponible.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial) mod 6.</li>
      <li>Puertos: 0=DVI, 1=Parallel, 2=PS/2, 3=RJ-45, 4=Stereo RCA, 5=USB.</li>
      <li>El Operador debe seleccionar el puerto en la posición calculada.</li>
    </ul>

    <h3 id="man-compass">📘 Protocolo 🧭 · Orientación cardinal</h3>
    <p class="bd-manual-flavor"><em>Determine la dirección cardinal correcta según el serial y strikes.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial + strikes) mod 8.</li>
      <li>Direcciones: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW.</li>
      <li>El Operador debe seleccionar la dirección calculada.</li>
    </ul>

    <h3 id="man-slots">📕 Protocolo ☰ · Ranuras de seguridad</h3>
    <p class="bd-manual-flavor"><em>Determine la ranura segura basándose en el nivel de batería, puertos y serial.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial + nivel de batería + conteo de puertos) mod 5.</li>
      <li>Rango válido: 0-4.</li>
      <li>El Operador debe seleccionar la ranura calculada.</li>
    </ul>

    <div class="bd-manual-outro">
      <p><em>📻 <strong>NOTA:</strong> Este manual es referencia técnica. Siga los procedimientos con precisión. La seguridad del personal depende del cumplimiento estricto de los protocolos.</em></p>
    </div>
  `;
}

interface BombdefusalUi {
  setupPhase: HTMLElement;
  gamePhase: HTMLElement;
  start?: HTMLElement;
  restart?: HTMLElement;
  timeLimit: HTMLInputElement;
  moduleCount: HTMLInputElement;
  maxStrikes: HTMLInputElement;
  difficulty: HTMLInputElement;
  animSpeed: HTMLInputElement;
  allowDup: HTMLInputElement;
  modTypeChips: HTMLElement[];
  roleOperator: HTMLElement;
  roleExpert: HTMLElement;
  operatorPanel: HTMLElement;
  expertPanel: HTMLElement;
  bombGrid: HTMLElement;
  manualContent: HTMLElement;
  manualNav: HTMLElement;
  timerEl: HTMLElement;
  timerBar: HTMLElement;
  strikesEl: HTMLElement;
  modulesEl: HTMLElement;
  serialEl: HTMLElement;
  indicatorEl: HTMLElement;
  batteryLevelEl?: HTMLElement;
  portTypeEl?: HTMLElement;
  portCountEl?: HTMLElement;
  info: HTMLElement;
  result: HTMLElement;
}

export function init(rawUi: GameUi) {
  const ui = rawUi as unknown as BombdefusalUi;
  const {
    setupPhase, gamePhase, start, restart,
    timeLimit, moduleCount, maxStrikes, difficulty, animSpeed, allowDup,
    modTypeChips, roleOperator, roleExpert,
    operatorPanel, expertPanel, bombGrid, manualContent, manualNav,
    timerEl, timerBar, strikesEl, modulesEl, serialEl, indicatorEl,
    batteryLevelEl, portTypeEl, portCountEl,
    info, result
  } = ui;

  if (!start) return;

  manualContent.innerHTML = buildManualHTML();

  manualNav.querySelectorAll<HTMLElement>('.bd-manual-link').forEach(link => {
    link.addEventListener('click', () => {
      const target = manualContent.querySelector(link.dataset.target as string);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const state: BombState = {
    playing: false,
    serial: '',
    timeLeft: 300,
    totalTime: 300,
    strikes: 0,
    maxStrikes: 3,
    indicatorLit: false,
    modules: [],
    animMs: 400,
    role: 'operator',
    buttonLight: false,
    batteryLevel: 0,
    portType: '',
    portCount: 0
  };
  activeState = state;

  function getConfig() {
    const types: string[] = [];
    modTypeChips.forEach(chip => {
      const input = chip.querySelector('input');
      if (input && input.checked) types.push(input.value);
    });
    const volumeInput = document.querySelector<HTMLInputElement>('[data-ui="volume"]');
    if (volumeInput) {
      setVolume(parseInt(volumeInput.value, 10) / 100);
    }
    return {
      totalTime: parseInt(timeLimit.value, 10) || 300,
      moduleCount: parseInt(moduleCount.value, 10) || 4,
      maxStrikes: parseInt(maxStrikes.value, 10),
      difficulty: parseInt(difficulty.value, 10) || 3,
      animMs: parseInt(animSpeed.value, 10) || 400,
      allowDup: allowDup.checked,
      types: types.length ? types : Object.keys(MODULE_FACTORIES)
    };
  }

  function setPhase(phase: string) {
    setupPhase.classList.toggle('bd-phase--active', phase === 'setup');
    gamePhase.classList.toggle('bd-phase--active', phase === 'game');
  }

  function setRole(role: string) {
    state.role = role;
    roleOperator.classList.toggle('bd-role-btn--active', role === 'operator');
    roleOperator.setAttribute('aria-pressed', String(role === 'operator'));
    roleExpert.classList.toggle('bd-role-btn--active', role === 'expert');
    roleExpert.setAttribute('aria-pressed', String(role === 'expert'));
    operatorPanel.classList.toggle('bd-panel--visible', role === 'operator');
    expertPanel.classList.toggle('bd-panel--visible', role === 'expert');
  }

  function updateHud() {
    const mins = Math.floor(state.timeLeft / 60);
    const secs = state.timeLeft % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    const pct = (state.timeLeft / state.totalTime) * 100;
    timerBar.style.width = pct + '%';
    timerBar.style.background = pct > 40 ? 'var(--accent)' : pct > 15 ? '#f97316' : '#ef4444';
    strikesEl.textContent = state.maxStrikes > 0
      ? `${state.strikes} / ${state.maxStrikes}`
      : `${state.strikes} (∞)`;
    modulesEl.textContent = String(state.modules.filter(m => !m.solved).length);
    serialEl.textContent = state.serial;
    indicatorEl.querySelector('.bd-indicator-dot')?.classList.toggle(
      'bd-indicator-dot--lit', state.indicatorLit
    );
    
    // Update device components
    if (batteryLevelEl) batteryLevelEl.textContent = state.batteryLevel > 0 ? `${state.batteryLevel}/4` : '--';
    if (portTypeEl) portTypeEl.textContent = state.portType || '--';
    if (portCountEl) portCountEl.textContent = state.portCount > 0 ? String(state.portCount) : '--';
  }

  function setInfo(msg: string, type?: string) {
    info.textContent = msg;
    info.className = 'bd-info' + (type ? ` bd-info--${type}` : '');
  }

  function generateBomb(cfg: ReturnType<typeof getConfig>) {
    const pool = cfg.types.slice();
    const modules: BombModule[] = [];
    const used = new Set<string>();

    for (let i = 0; i < cfg.moduleCount; i++) {
      let type;
      if (cfg.allowDup) {
        type = pick(pool);
      } else {
        const available = pool.filter(t => !used.has(t));
        type = available.length ? pick(available) : pick(pool);
        used.add(type);
      }
      const factory = MODULE_FACTORIES[type];
      // `state` ya tiene `strikes = 0` en este punto (generateBomb se
      // llama una sola vez, al iniciar la partida, antes de que pueda
      // existir ningún strike). Se lo pasamos a cada factory para que
      // pueda fijar `data.strikesAtStart` en el momento de creación —
      // ver el comentario en cada interfaz *Module afectada.
      if (factory) modules.push(factory(cfg.difficulty, state));
    }
    return modules;
  }

  function onModuleStrike(modEl: HTMLElement | null) {
    playSound('strike');
    if (state.maxStrikes > 0) {
      state.strikes += 1;
      if (modEl) {
        modEl.classList.add('bd-module--strike', 'bd-module--error');
        setTimeout(() => modEl.classList.remove('bd-module--strike', 'bd-module--error'), 500);
      }
      updateHud();
      // .find() puede no encontrar módulo sin resolver (caso borde: el
      // strike que dispara el fin del juego llega justo cuando ya no
      // queda ninguno) — ?.type entonces es undefined, y MODULE_NAMES
      // es Record<string,string> (no acepta indexar con undefined).
      // El '' ya cubría ese caso para el string final; solo se separa
      // el índice para que el tipo sea correcto sin cambiar el output.
      const strikeModType = state.modules.find(m => !m.solved)?.type;
      setInfo(`¡Strike! Error en módulo ${(strikeModType ? MODULE_NAMES[strikeModType] : '') || ''}.`, 'fail');
      if (state.strikes >= state.maxStrikes) endGame(false);
    } else {
      setInfo('Error en módulo — sin límite de strikes activo.', 'fail');
    }
  }

  function onModuleSolved(mod: BombModule, modEl: HTMLElement | null) {
    playSound('success');
    mod.solved = true;
    if (modEl) {
      modEl.classList.add('bd-module--success');
      setTimeout(() => modEl.classList.remove('bd-module--success'), 500);
    }
    updateHud();
    const left = state.modules.filter(m => !m.solved).length;
    setInfo(`Módulo ${MODULE_NAMES[mod.type]} desactivado. Quedan ${left}.`, 'ok');
    if (left === 0) endGame(true);
  }

  function renderModules() {
    bombGrid.innerHTML = '';
    state.modules.forEach((mod) => {
      const el = document.createElement('div');
      el.className = 'bd-module' + (mod.solved ? ' bd-module--solved' : '');
      el.innerHTML = `<div class="bd-module-tag">${MODULE_NAMES[mod.type]}</div><div class="bd-module-body"></div>`;
      const body = el.querySelector<HTMLElement>('.bd-module-body')!;
      if (!mod.solved) renderModuleBody(mod, body, el);
      else body.innerHTML = '<span style="color:#86efac;font-size:0.8rem">✓ DESACTIVADO</span>';
      bombGrid.appendChild(el);
    });
  }

  function renderModuleBody(mod: BombModule, body: HTMLElement, modEl: HTMLElement) {
    if (mod.type === 'wires') renderWires(mod, body, modEl);
    else if (mod.type === 'buttons') renderButtons(mod, body, modEl);
    else if (mod.type === 'symbols') renderSymbols(mod, body, modEl);
    else if (mod.type === 'memory') renderMemory(mod, body, modEl);
    else if (mod.type === 'screen') renderScreen(mod, body, modEl);
    else if (mod.type === 'frequency') renderFrequency(mod, body, modEl);
    else if (mod.type === 'colors') renderColors(mod, body, modEl);
    else if (mod.type === 'pattern') renderPattern(mod, body, modEl);
    else if (mod.type === 'switches') renderSwitches(mod, body, modEl);
    else if (mod.type === 'code') renderCode(mod, body, modEl);
    else if (mod.type === 'keypad') renderKeypad(mod, body, modEl);
    else if (mod.type === 'morse') renderMorse(mod, body, modEl);
    else if (mod.type === 'password') renderPassword(mod, body, modEl);
    else if (mod.type === 'simon') renderSimon(mod, body, modEl);
    else if (mod.type === 'knobs') renderKnobs(mod, body, modEl);
    else if (mod.type === 'maze') renderMaze(mod, body, modEl);
    else if (mod.type === 'timer') renderTimer(mod, body, modEl);
    else if (mod.type === 'sequence') renderSequence(mod, body, modEl);
    else if (mod.type === 'binary') renderBinary(mod, body, modEl);
    else if (mod.type === 'math') renderMath(mod, body, modEl);
    else if (mod.type === 'word') renderWord(mod, body, modEl);
    else if (mod.type === 'reaction') renderReaction(mod, body, modEl);
    else if (mod.type === 'matching') renderMatching(mod, body, modEl);
    else if (mod.type === 'cipher') renderCipher(mod, body, modEl);
    else if (mod.type === 'timing') renderTiming(mod, body, modEl);
    else if (mod.type === 'coordinates') renderCoordinates(mod, body, modEl);
    else if (mod.type === 'battery') renderBattery(mod, body, modEl);
    else if (mod.type === 'ports') renderPorts(mod, body, modEl);
    else if (mod.type === 'compass') renderCompass(mod, body, modEl);
    else if (mod.type === 'slots') renderSlots(mod, body, modEl);
  }

  function renderWires(mod: WiresModule, body: HTMLElement, modEl: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'bd-wires';
    mod.data.wires.forEach((color, i) => {
      const w = document.createElement('div');
      w.className = `bd-wire bd-wire--${color}`;
      if (mod.data.cutIndex === i) w.classList.add('bd-wire--cut');
      w.title = `Cable ${i + 1}`;
      w.setAttribute('role', 'button');
      w.setAttribute('tabindex', '0');
      const cutLabel = mod.data.cutIndex === i ? ', cortado' : '';
      w.setAttribute('aria-label', `Cable ${i + 1}, color ${color}${cutLabel}`);
      const cutWire = () => {
        if (mod.solved || mod.data.cutIndex !== null) return;
        const sol = mod.getSolution(state).wireIndex;
        mod.data.cutIndex = i;
        if (i === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      };
      w.addEventListener('click', cutWire);
      w.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cutWire();
        }
      });
      wrap.appendChild(w);
    });
    body.appendChild(wrap);
  }

  function renderButtons(mod: ButtonsModule, body: HTMLElement, modEl: HTMLElement) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bd-big-btn bd-big-btn--${mod.data.color}`;
    btn.textContent = mod.data.label.slice(0, 6);
    btn.setAttribute(
      'aria-label',
      `Botón ${mod.data.label}, color ${mod.data.color}. Mantené presionado y soltá según la regla del manual.`
    );

    const label = document.createElement('div');
    label.className = 'bd-btn-label';
    label.textContent = mod.data.label;

    const light = document.createElement('div');
    light.className = 'bd-indicator';
    light.innerHTML = '<span class="bd-indicator-dot"></span> Luz estado';
    // querySelector siempre encuentra el <span> recién creado en la
    // línea de arriba (mismo elemento, sin async entre medio) — el
    // '!' es seguro acá, TS solo no puede saberlo porque no hay forma
    // de expresar "el innerHTML que acabo de asignar" como tipo.
    const lightDot = light.querySelector('.bd-indicator-dot')!;
    light.setAttribute('role', 'status');
    light.setAttribute('aria-live', 'polite');
    light.setAttribute('aria-label', 'Luz de estado: apagada');

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let holdStart = 0;

    function finishButton(success: boolean) {
      if (mod.solved) return;
      mod.data.pressed = true;
      if (success) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    }

    function startHold() {
      if (mod.solved || mod.data.holding) return;
      mod.data.holding = true;
      holdStart = Date.now();
      state.buttonLight = false;
      lightDot.classList.remove('bd-indicator-dot--lit');
      light.setAttribute('aria-label', 'Luz de estado: apagada');

      const sol = mod.getSolution(state);
      if (sol.action === 'hold') {
        holdTimer = setTimeout(() => {
          state.buttonLight = true;
          lightDot.classList.add('bd-indicator-dot--lit');
          light.setAttribute('aria-label', 'Luz de estado: encendida');
        }, state.animMs * 2);
      }
    }

    function endHold() {
      if (mod.solved || !mod.data.holding) return;
      mod.data.holding = false;
      if (holdTimer) clearTimeout(holdTimer);

      const sol = mod.getSolution(state);
      const elapsed = Date.now() - holdStart;
      const secs = state.timeLeft % 60;
      let success: boolean;

      if (sol.action === 'tap') {
        success = elapsed < 250;
      } else if (sol.releaseOnSecondDigit === 1) {
        success = Math.floor(secs / 10) === 1 || secs % 10 === 1;
      } else if (sol.releaseOnLight) {
        success = state.buttonLight;
      } else {
        success = elapsed > 300;
      }

      finishButton(success);
    }

    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', endHold);
    btn.addEventListener('mouseleave', () => {
      if (mod.data.holding) {
        mod.data.holding = false;
        if (holdTimer) clearTimeout(holdTimer);
      }
    });

    // Enter/Espacio no disparan mousedown/mouseup en un <button> — sin
    // esto, la mecánica de "mantener presionado" (idéntica a la de
    // mouse) sería inalcanzable por teclado. keydown con e.repeat evita
    // reiniciar el hold en cada repetición automática del navegador.
    btn.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        startHold();
      }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        endHold();
      }
    });

    body.appendChild(btn);
    body.appendChild(label);
    body.appendChild(light);
  }

  function renderSymbols(mod: SymbolsModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-symbols-grid';
    mod.data.symbols.forEach((sym: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-symbol-btn';
      b.textContent = sym;
      b.setAttribute('aria-label', SYMBOL_NAMES[sym] || sym);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const expected = mod.data.order[mod.data.step];
        if (sym === expected) {
          mod.data.step += 1;
          if (mod.data.step >= mod.data.order.length) onModuleSolved(mod, modEl);
          else setInfo(`Símbolos: ${mod.data.step}/${mod.data.order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  function renderMemory(mod: MemoryModule, body: HTMLElement, modEl: HTMLElement) {
    const disp = document.createElement('div');
    disp.className = 'bd-mem-display';
    disp.textContent = String(mod.data.display);
    disp.setAttribute('role', 'status');
    disp.setAttribute('aria-live', 'polite');
    disp.setAttribute('aria-label', `Pantalla: número ${mod.data.display}`);

    const btns = document.createElement('div');
    btns.className = 'bd-mem-btns';
    mod.data.labels.forEach((lab, pos) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-mem-btn';
      b.textContent = String(lab);
      b.setAttribute('aria-label', `Posición ${pos + 1}, etiqueta ${lab}`);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution(state).position;
        if (pos === sol) {
          mod.data.history.push({ position: pos, label: lab });
          if (mod.data.stage >= 5) {
            onModuleSolved(mod, modEl);
          } else {
            mod.data.stage += 1;
            mod.data.display = randInt(1, 4);
            setInfo(`Memoria: etapa ${mod.data.stage}/5`, 'ok');
          }
        } else {
          mod.data.stage = 1;
          mod.data.display = randInt(1, 4);
          mod.data.history = [];
          onModuleStrike(modEl);
        }
        renderModules();
      });
      btns.appendChild(b);
    });

    body.appendChild(disp);
    body.appendChild(btns);
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Etapa ${mod.data.stage}/5`;
    body.appendChild(hint);
  }

  function renderScreen(mod: ScreenModule, body: HTMLElement, modEl: HTMLElement) {
    const disp = document.createElement('div');
    disp.className = 'bd-screen-display';
    disp.textContent = mod.data.msg;
    disp.setAttribute('role', 'status');
    disp.setAttribute('aria-live', 'polite');

    const opts = document.createElement('div');
    opts.className = 'bd-screen-options';
    SCREEN_OPTS.forEach(opt => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-screen-opt';
      b.textContent = opt;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution(state).answer;
        if (opt === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      opts.appendChild(b);
    });

    body.appendChild(disp);
    body.appendChild(opts);
  }

  function renderFrequency(mod: FrequencyModule, body: HTMLElement, modEl: HTMLElement) {
    const labels = document.createElement('div');
    labels.className = 'bd-freq-labels';
    labels.textContent = `${mod.data.labelA} · ${mod.data.labelB}`;

    const dial = document.createElement('div');
    dial.className = 'bd-freq-dial';
    FREQS.forEach(freq => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-freq-opt';
      b.textContent = freq;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution().freq;
        if (freq === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      dial.appendChild(b);
    });

    body.appendChild(labels);
    body.appendChild(dial);
  }

  function renderColors(mod: ColorsModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-colors-grid';
    mod.data.colors.forEach(color => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-color-btn';
      b.style.background = COLOR_CSS[color as keyof typeof COLOR_CSS];
      b.setAttribute('aria-label', `Color ${color}`);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const expected = mod.getSolution(state).order[mod.data.step];
        if (color === expected) {
          mod.data.step += 1;
          if (mod.data.step >= mod.getSolution(state).order.length) onModuleSolved(mod, modEl);
          else setInfo(`Colores: ${mod.data.step}/${mod.getSolution(state).order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Secuencia ${mod.data.step}/${mod.getSolution(state).order.length}`;
    body.appendChild(grid);
    body.appendChild(hint);
  }

  function renderPattern(mod: PatternModule, body: HTMLElement, modEl: HTMLElement) {
    const { size, litCount, decoy, selected } = mod.data;
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `${litCount} celdas iluminadas (señuelo)`;

    const grid = document.createElement('div');
    grid.className = 'bd-pattern-grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    for (let i = 0; i < size * size; i++) {
      const row = Math.floor(i / size) + 1;
      const col = (i % size) + 1;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bd-pattern-cell';
      if (decoy.includes(i)) cell.classList.add('bd-pattern-cell--decoy');
      if (selected.has(i)) cell.classList.add('bd-pattern-cell--sel');
      cell.setAttribute('aria-pressed', String(selected.has(i)));
      const decoyLabel = decoy.includes(i) ? ', señuelo' : '';
      cell.setAttribute('aria-label', `Celda fila ${row}, columna ${col}${decoyLabel}`);
      cell.addEventListener('click', () => {
        if (mod.solved) return;
        if (selected.has(i)) selected.delete(i);
        else selected.add(i);
        renderModules();
      });
      grid.appendChild(cell);
    }

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Confirmar';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = new Set(mod.getSolution(state).cells);
      const sel = selected;
      const match = sol.size === sel.size && [...sol].every(c => sel.has(c));
      if (match) onModuleSolved(mod, modEl);
      else {
        selected.clear();
        onModuleStrike(modEl);
      }
      renderModules();
    });

    body.appendChild(hint);
    body.appendChild(grid);
    body.appendChild(confirm);
  }

  function renderSwitches(mod: SwitchesModule, body: HTMLElement, modEl: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'bd-switches-wrap';
    mod.data.states.forEach((on, i) => {
      const row = document.createElement('div');
      row.className = 'bd-switch-row';
      const lbl = document.createElement('span');
      lbl.textContent = `SW${i + 1}`;
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'bd-switch' + (on ? ' bd-switch--on' : '');
      sw.textContent = on ? 'ON' : 'OFF';
      sw.setAttribute('aria-pressed', String(on));
      sw.setAttribute('aria-label', `Interruptor ${i + 1}`);
      sw.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.states[i] = !mod.data.states[i];
        renderModules();
      });
      row.appendChild(lbl);
      row.appendChild(sw);
      wrap.appendChild(row);
    });

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Confirmar';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).states;
      const match = sol.every((v, i) => v === mod.data.states[i]);
      if (match) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    });

    body.appendChild(wrap);
    body.appendChild(confirm);
  }

  function renderCode(mod: CodeModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(4, '_').split('').join(' ');
    display.setAttribute('role', 'status');
    display.setAttribute('aria-live', 'polite');
    display.setAttribute(
      'aria-label',
      mod.data.input ? `Código ingresado: ${mod.data.input.split('').join(' ')}` : 'Código vacío'
    );

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(d);
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= 4) return;
        mod.data.input += d;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).code;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderKeypad(mod: KeypadModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-keypad-grid';
    mod.data.symbols.forEach((sym: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-symbol-btn';
      b.textContent = sym;
      b.setAttribute('aria-label', SYMBOL_NAMES[sym] || sym);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const order = mod.getSolution(state).order;
        const expected = order[mod.data.step];
        if (sym === expected) {
          mod.data.step += 1;
          if (mod.data.step >= order.length) onModuleSolved(mod, modEl);
          else setInfo(`Teclado: ${mod.data.step}/${order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Teclas ${mod.data.step}/${mod.getSolution(state).order.length}`;
    body.appendChild(grid);
    body.appendChild(hint);
  }

  function renderMorse(mod: MorseModule, body: HTMLElement, modEl: HTMLElement) {
    const disp = document.createElement('div');
    disp.className = 'bd-morse-display';
    disp.textContent = mod.data.code;

    const opts = document.createElement('div');
    opts.className = 'bd-morse-opts';
    mod.data.options.forEach(letter => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-screen-opt';
      b.textContent = letter;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution().letter;
        if (letter === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      opts.appendChild(b);
    });

    body.appendChild(disp);
    body.appendChild(opts);
  }

  function renderPassword(mod: PasswordModule, body: HTMLElement, modEl: HTMLElement) {
    const clues = document.createElement('div');
    clues.className = 'bd-password-clues';
    clues.textContent = 'Posibles: ' + mod.data.clues.join(', ');

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(6, '_').split('').join(' ');

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(4, 1fr)';
    mod.data.clues.forEach(word => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key bd-code-key--wide';
      b.textContent = word;
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length > 0) return;
        mod.data.input = word;
        renderModules();
      });
      pad.appendChild(b);
    });

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = '';
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).password;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(clues);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderSimon(mod: SimonModule, body: HTMLElement, modEl: HTMLElement) {
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Secuencia: ${mod.data.step + 1}/${mod.data.sequenceLength}`;

    const grid = document.createElement('div');
    grid.className = 'bd-simon-grid';
    SIMON_COLORS.forEach((color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `bd-simon-btn bd-simon-btn--${color}`;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const order = mod.getSolution(state).colors;
        const expected = order[mod.data.step];
        if (color === expected) {
          mod.data.step += 1;
          if (mod.data.step >= mod.data.sequenceLength) onModuleSolved(mod, modEl);
          else setInfo(`Simon: ${mod.data.step + 1}/${mod.data.sequenceLength}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });

    body.appendChild(hint);
    body.appendChild(grid);
  }

  // BUG DE JUEGO (no código muerto, mismo espíritu que la nota en
  // solvePassword): `getSolution(state).positions` (ver solveKnobs)
  // devuelve un array de LABELS de KNOB_POSITIONS (p.ej. ['IZQ', 'DER']),
  // pero el chequeo de "confirmar" más abajo hace
  // `KNOB_POSITIONS[pos] === KNOB_POSITIONS[current[i]]` tratando cada
  // `pos` como si fuera un ÍNDICE numérico. `KNOB_POSITIONS['IZQ']` es
  // `undefined` (acceso de string como key en un array), así que la
  // comparación solo puede dar `true` si ambos lados son `undefined` —
  // el módulo de knobs no tiene forma correcta de resolverse tal como
  // está. Encontrado al tipar BombModule como discriminated union: con
  // `data: Record<string, any>` esto compilaba sin avisar nada. No lo
  // arreglo acá, igual que solvePassword: es un bug de lógica de juego,
  // fuera del alcance de esta migración de tipos.
  function renderKnobs(mod: KnobsModule, body: HTMLElement, modEl: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'bd-knobs-wrap';
    mod.data.positions.forEach((pos, i) => {
      const row = document.createElement('div');
      row.className = 'bd-knob-row';
      const lbl = document.createElement('span');
      lbl.className = 'bd-btn-label';
      lbl.textContent = `K${i + 1}`;
      const controls = document.createElement('div');
      controls.className = 'bd-knob-controls';
      
      KNOB_POSITIONS.forEach((position, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bd-knob-btn' + (pos === idx ? ' bd-knob-btn--active' : '');
        b.textContent = position[0];
        b.addEventListener('click', () => {
          if (mod.solved) return;
          mod.data.positions[i] = idx;
          renderModules();
        });
        controls.appendChild(b);
      });
      
      row.appendChild(lbl);
      row.appendChild(controls);
      wrap.appendChild(row);
    });

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Confirmar';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).positions;
      const current = mod.data.positions;
      const match = sol.every((pos, i) => (KNOB_POSITIONS as any)[pos] === (KNOB_POSITIONS as any)[current[i]]);
      if (match) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    });

    body.appendChild(wrap);
    body.appendChild(confirm);
  }

  function renderMaze(mod: MazeModule, body: HTMLElement, modEl: HTMLElement) {
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Pos: (${mod.data.playerRow},${mod.data.playerCol})`;

    const grid = document.createElement('div');
    grid.className = 'bd-maze-grid';
    grid.style.gridTemplateColumns = `repeat(${MAZE_SIZE}, 1fr)`;

    for (let r = 0; r < MAZE_SIZE; r++) {
      for (let c = 0; c < MAZE_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'bd-maze-cell';
        if (r === mod.data.playerRow && c === mod.data.playerCol) {
          cell.classList.add('bd-maze-cell--player');
          cell.textContent = '●';
        }
        grid.appendChild(cell);
      }
    }

    const controls = document.createElement('div');
    controls.className = 'bd-maze-controls';
    const directions = [
      { label: '↑', dr: -1, dc: 0 },
      { label: '↓', dr: 1, dc: 0 },
      { label: '←', dr: 0, dc: -1 },
      { label: '→', dr: 0, dc: 1 }
    ];
    directions.forEach(dir => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-maze-btn';
      b.textContent = dir.label;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const newRow = mod.data.playerRow + dir.dr;
        const newCol = mod.data.playerCol + dir.dc;
        if (newRow >= 0 && newRow < MAZE_SIZE && newCol >= 0 && newCol < MAZE_SIZE) {
          mod.data.playerRow = newRow;
          mod.data.playerCol = newCol;
          const sol = mod.getSolution(state);
          if (newRow === sol.row && newCol === sol.col) {
            onModuleSolved(mod, modEl);
          }
          renderModules();
        }
      });
      controls.appendChild(b);
    });

    body.appendChild(hint);
    body.appendChild(grid);
    body.appendChild(controls);
  }

  function renderTimer(mod: TimerModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-timer-display';
    display.textContent = mod.data.stopped ? `: ${mod.data.stopSecond}s` : ': --';

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'bd-pattern-confirm';
    stopBtn.textContent = 'STOP';
    stopBtn.addEventListener('click', () => {
      if (mod.solved || mod.data.stopped) return;
      const secs = state.timeLeft % 60;
      mod.data.stopped = true;
      mod.data.stopSecond = secs;
      const sol = mod.getSolution(state).targetSecond;
      if (secs === sol) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    });

    body.appendChild(display);
    body.appendChild(stopBtn);
  }

  function renderSequence(mod: SequenceModule, body: HTMLElement, modEl: HTMLElement) {
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Paso ${mod.data.step + 1}/5`;

    const grid = document.createElement('div');
    grid.className = 'bd-sequence-grid';
    SEQUENCE_NUMBERS.forEach(num => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-sequence-btn';
      b.textContent = num;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const order = mod.getSolution(state).order;
        const expected = order[mod.data.step];
        if (num === expected) {
          mod.data.step += 1;
          if (mod.data.step >= order.length) onModuleSolved(mod, modEl);
          else setInfo(`Secuencia: ${mod.data.step + 1}/${order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });

    body.appendChild(hint);
    body.appendChild(grid);
  }

  function renderBinary(mod: BinaryModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(5, '_').split('').join(' ');

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let i = 0; i < 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = i === 0 ? '0' : '1';
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= 5) return;
        mod.data.input += b.textContent;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).binary;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderMath(mod: MathModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state);
    const equation = document.createElement('div');
    equation.className = 'bd-math-equation';
    equation.textContent = `${sol.a} ${sol.op} ${sol.b} = ?`;

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.answer || '_';

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(d);
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.answer.length >= 3) return;
        mod.data.answer += d;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.answer = mod.data.answer.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (parseInt(mod.data.answer, 10) === sol.result) onModuleSolved(mod, modEl);
      else {
        mod.data.answer = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(equation);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderWord(mod: WordModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-word-display';
    display.textContent = mod.data.input.padEnd(6, '_').split('').join(' ');

    const letters = document.createElement('div');
    letters.className = 'bd-word-letters';
    const sol = mod.getSolution(state).word as string;
    const available = GameHelpers.shuffle(sol.split(''));
    available.forEach(letter => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-word-btn';
      b.textContent = letter;
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= sol.length) return;
        mod.data.input += letter;
        renderModules();
      });
      letters.appendChild(b);
    });

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(display);
    body.appendChild(letters);
    body.appendChild(actions);
  }

  function renderReaction(mod: ReactionModule, body: HTMLElement, modEl: HTMLElement) {
    const indicator = document.createElement('div');
    indicator.className = 'bd-reaction-indicator' + (mod.data.lit ? ' bd-reaction-indicator--lit' : '');
    indicator.textContent = mod.data.lit ? '¡PULSA!' : 'ESPERA...';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bd-pattern-confirm';
    btn.textContent = 'PULSAR';
    btn.addEventListener('click', () => {
      if (mod.solved || mod.data.pressed) return;
      mod.data.pressed = true;
      if (mod.data.lit) {
        // lit y litTime siempre se asignan juntos (ver el único punto
        // donde se ponen: mod.data.lit = true seguido de litTime =
        // Date.now(), más abajo en este mismo archivo) — dentro de
        // este if, litTime nunca es null en runtime, aunque el tipo
        // number|null no lo exprese.
        const elapsed = Date.now() - mod.data.litTime!;
        const sol = mod.getSolution(state).targetMs;
        if (Math.abs(elapsed - sol) <= 200) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
      } else {
        onModuleStrike(modEl);
      }
      renderModules();
    });

    if (!mod.data.lit && !mod.data.pressed) {
      const delay = randInt(2000, 5000);
      setTimeout(() => {
        // Guard ampliado: el guard original solo miraba el estado de
        // ESTE módulo (mod.solved / mod.data.pressed), no si el juego
        // en sí seguía activo. Si el usuario salía de la partida
        // (stop()) mientras este timeout de 2-5s estaba pendiente y
        // el módulo no había sido tocado, igual disparaba y
        // reconstruía todo el tablero (renderModules) en una vista
        // ya cerrada.
        if (!state.playing) return;
        if (!mod.solved && !mod.data.pressed) {
          mod.data.lit = true;
          mod.data.litTime = Date.now();
          renderModules();
        }
      }, delay);
    }

    body.appendChild(indicator);
    body.appendChild(btn);
  }

  function renderMatching(mod: MatchingModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-matching-grid';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';

    // Usa el tablero ya fijado en data.board (generado una sola vez en
    // createMatchingModule), no un tablero recalculado en cada render
    // — ver el comentario en la interfaz MatchingModule.
    const shuffled = mod.data.board;
    
    shuffled.forEach((sym, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-matching-card' + (mod.data.matched.includes(idx) ? ' bd-matching-card--matched' : '');
      b.textContent = mod.data.matched.includes(idx) || mod.data.selected.includes(idx) ? sym : '?';
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.matched.includes(idx)) return;
        
        if (mod.data.selected.length === 2) {
          mod.data.selected = [];
        }
        
        if (mod.data.selected.includes(idx)) {
          mod.data.selected = mod.data.selected.filter(i => i !== idx);
        } else {
          mod.data.selected.push(idx);
        }
        
        if (mod.data.selected.length === 2) {
          const [i1, i2] = mod.data.selected;
          if (shuffled[i1] === shuffled[i2]) {
            mod.data.matched.push(i1, i2);
            mod.data.selected = [];
            if (mod.data.matched.length === 8) onModuleSolved(mod, modEl);
          }
        }
        renderModules();
      });
      grid.appendChild(b);
    });

    body.appendChild(grid);
  }

  function renderCipher(mod: CipherModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state);
    const cipher = document.createElement('div');
    cipher.className = 'bd-cipher-text';
    cipher.textContent = `Cifrado: ${sol.encoded}`;
    
    const shiftInfo = document.createElement('div');
    shiftInfo.className = 'bd-btn-label';
    shiftInfo.textContent = `Desplazamiento: ${sol.shift}`;

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(6, '_').split('').join(' ');

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(6, 1fr)';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = letter;
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= 6) return;
        mod.data.input += letter;
        renderModules();
      });
      pad.appendChild(b);
    });

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (mod.data.input === sol.original) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(cipher);
    body.appendChild(shiftInfo);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderTiming(mod: TimingModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state).offset;
    const clock1 = document.createElement('div');
    clock1.className = 'bd-timing-clock';
    clock1.textContent = `Reloj 1: ${state.timeLeft % 60}s`;

    const clock2 = document.createElement('div');
    clock2.className = 'bd-timing-clock';
    clock2.textContent = `Reloj 2: ${((state.timeLeft % 60) + sol) % 60}s`;

    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Offset: +${sol}s`;

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Sincronizado';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      onModuleSolved(mod, modEl);
      renderModules();
    });

    body.appendChild(clock1);
    body.appendChild(clock2);
    body.appendChild(hint);
    body.appendChild(confirm);
  }

  function renderCoordinates(mod: CoordinatesModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state);
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = 'Introduce X, Y';

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = `X:${mod.data.x || '_'} Y:${mod.data.y || '_'}`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(d);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        if (mod.data.x.length < 1) mod.data.x += d;
        else if (mod.data.y.length < 1) mod.data.y += d;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.x = '';
      mod.data.y = '';
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (parseInt(mod.data.x, 10) === sol.x && parseInt(mod.data.y, 10) === sol.y) onModuleSolved(mod, modEl);
      else {
        mod.data.x = '';
        mod.data.y = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(hint);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderBattery(mod: BatteryModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.style.fontSize = '1rem';
    display.textContent = `Nivel actual: ${state.batteryLevel}/4`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(4, 1fr)';
    for (let i = 1; i <= 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(i);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedLevel = i;
        const sol = mod.getSolution(state);
        if (i === sol.targetLevel) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    }

    body.appendChild(display);
    body.appendChild(pad);
  }

  function renderPorts(mod: PortsModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-password-clues';
    display.textContent = `Puerto: ${state.portType} (Conteo: ${state.portCount})`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(3, 1fr)';
    const portTypes = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
    portTypes.forEach(port => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key bd-code-key--wide';
      b.textContent = port;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedPort = port;
        const sol = mod.getSolution(state);
        if (port === sol.targetPort) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    });

    body.appendChild(display);
    body.appendChild(pad);
  }

  function renderCompass(mod: CompassModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = `Dirección: ${mod.data.currentDirection}`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(4, 1fr)';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    directions.forEach(dir => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = dir;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedDirection = dir;
        const sol = mod.getSolution(state);
        if (dir === sol.targetDirection) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    });

    body.appendChild(display);
    body.appendChild(pad);
  }

  function renderSlots(mod: SlotsModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = `Batería: ${state.batteryLevel} | Puertos: ${state.portCount}`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let i = 0; i <= 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(i);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedSlot = i;
        const sol = mod.getSolution(state);
        if (i === sol.targetSlot) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    }

    body.appendChild(display);
    body.appendChild(pad);
  }

  function tick() {
    if (!state.playing) return;
    state.timeLeft -= 1;
    if (state.timeLeft % 7 === 0) state.indicatorLit = !state.indicatorLit;
    updateHud();
    if (state.timeLeft <= 0) endGame(false);
  }

  function startGame() {
    if (timerInterval) clearInterval(timerInterval);
    initAudio();
    const cfg = getConfig();
    state.playing = true;
    state.serial = genSerial();
    state.totalTime = cfg.totalTime;
    state.timeLeft = cfg.totalTime;
    state.strikes = 0;
    state.maxStrikes = cfg.maxStrikes;
    state.animMs = cfg.animMs;
    state.indicatorLit = Math.random() > 0.5;
    state.batteryLevel = genBatteryLevel();
    state.portType = genPortType();
    state.portCount = genPortCount();
    state.modules = generateBomb(cfg);
    state.role = 'operator';

    result.textContent = '';
    setPhase('game');
    setRole('operator');
    updateHud();
    renderModules();
setInfo('💣 Operador: desactiva módulos. Experto: consulta el manual. Alterna roles con los botones superiores.', 'info');

    timerInterval = setInterval(tick, 1000);
  }

  function endGame(won: boolean) {
    state.playing = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    const defused = state.modules.filter(m => m.solved).length;
    const score = defused * 1000 + (won ? state.timeLeft : 0);

    if (won) {
      playSound('win');
      result.textContent = `¡Bomba desactivada! Tiempo restante: ${timerEl.textContent} · Puntuación: ${score}`;
      result.style.color = '#86efac';
      setInfo('Todos los módulos desactivados. ¡Victoria!', 'ok');
    } else {
      playSound('lose');
      const reason = state.timeLeft <= 0 ? 'Tiempo agotado' : 'Demasiados strikes';
      result.textContent = `${reason}. Módulos desactivados: ${defused}/${state.modules.length} · Puntuación: ${score}`;
      result.style.color = '#fca5a5';
      setInfo(reason + '.', 'fail');
    }

    Leaderboard.save('bombdefusal', score);

    renderModules();
  }

  function stopGame() {
    state.playing = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    setPhase('setup');
    setInfo('', 'info');
  }

  roleOperator.addEventListener('click', () => setRole('operator'));
  roleExpert.addEventListener('click', () => setRole('expert'));
  start.addEventListener('click', startGame);
  if (restart) restart.addEventListener('click', stopGame);
}

export function stop() {
  if (activeState) activeState.playing = false;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
}

