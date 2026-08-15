/**
 * js/games/bombdefusal.solvers.ts
 *
 * Reglas de resolución de cada módulo (basadas en el manual, no en
 * estado de UI) más los helpers de generación aleatoria que usan.
 * Extraído de bombdefusal.logic.ts como parte de dividir ese archivo
 * (antes 3212 líneas).
 */

import GameHelpers from '../utils/gameHelpers.js';
import {
  FREQS, FREQ_LABELS, SCREEN_OPTS, SIMON_COLORS,
  KNOB_POSITIONS, MAZE_SIZE, PORT_OFFSETS, SEQUENCE_NUMBERS,
  MATH_OPERATIONS, WORD_WORDS, MATCHING_SYMBOLS, CIPHER_ALPHABET,
  KEYPAD_GRID, MORSE_WORDS
} from './bombdefusal.data.js';

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// shuffle: ver GameHelpers.shuffle (js/utils/gameHelpers.ts)

export function genSerial() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

export function genBatteryLevel() {
  return randInt(1, 4);
}

export function genPortType() {
  const ports = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
  return pick(ports);
}

export function genPortCount() {
  return randInt(1, 6);
}

export function serialLastDigitEven(serial: string) {
  const d = serial.slice(-1);
  return '02468'.includes(d);
}

export function countColor(wires: string[], color: string) {
  return wires.filter(w => w === color).length;
}

export function lastIndexOfColor(wires: string[], color: string) {
  for (let i = wires.length - 1; i >= 0; i--) {
    if (wires[i] === color) return i;
  }
  return -1;
}

/* ── Solvers (reglas del manual) ── */

export function solveWires(wires: string[], serial: string) {
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

export function solveButton(
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

export function solveMemoryStage(stage: number, display: number, history: Array<{ position: number; label: number }>) {
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

export function solveScreen(msg: string, serial: string, strikes: number) {
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

export function serialDigitSum(serial: string) {
  let sum = 0;
  for (const ch of serial) {
    const d = parseInt(ch, 10);
    if (!isNaN(d)) sum += d;
  }
  return sum;
}

export function serialVowelCount(serial: string) {
  return (serial.match(/[AEIOU]/gi) || []).length;
}

export function solveFrequency(labelA: string, labelB: string) {
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

export function solveColors(serial: string, strikes: number, indicatorLit: boolean, batteryLevel: number) {
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

export function solvePattern(litCount: number, serial: string, strikes: number, portCount: number) {
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

export function solveSwitches(serial: string, strikes: number, indicatorLit: boolean) {
  const last = serial.slice(-1);
  const lastDigit = parseInt(last, 10);
  const sw1 = !isNaN(lastDigit) && lastDigit % 2 === 0;
  const sw2 = indicatorLit;
  const sw3 = (strikes + serialDigitSum(serial)) % 2 === 1;
  return [sw1, sw2, sw3];
}

export function solveCode(serial: string) {
  const code = (serialDigitSum(serial) * 7 + serialVowelCount(serial) * 13) % 10000;
  return code.toString().padStart(4, '0');
}

export function solveKeypad(serial: string, strikes: number, indicatorLit: boolean) {
  const first = serial[0].toUpperCase();
  const col3 = [KEYPAD_GRID[2], KEYPAD_GRID[5], KEYPAD_GRID[8]];
  const row1 = [KEYPAD_GRID[0], KEYPAD_GRID[1], KEYPAD_GRID[2]];
  let order = first <= 'M' ? row1 : col3;
  order = order.slice();
  if (indicatorLit) order = ['¶'].concat(order.filter(s => s !== '¶'));
  if (strikes > 0) order = order.slice().reverse();
  return order;
}

export function solveMorse(code: string) {
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
export function solvePassword(clues: string[], serial: string) {
  const digitSum = serialDigitSum(serial);
  const vowelCount = serialVowelCount(serial);
  const idx = (digitSum + vowelCount) % clues.length;
  return clues[idx];
}

export function solveSimon(serial: string, strikes: number) {
  const lastDigit = parseInt(serial.slice(-1), 10) || 0;
  const vowel = /[AEIOU]/.test(serial[0]);
  
  let colors = SIMON_COLORS.slice();
  if (strikes > 0) colors = colors.reverse();
  if (vowel) colors = [colors[1], colors[0], colors[3], colors[2]];
  if (lastDigit % 2 === 0) colors = [colors[2], colors[3], colors[0], colors[1]];
  
  return colors;
}

export function solveKnobs(serial: string, strikes: number, indicatorLit: boolean, portType: string) {
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

export function solveMaze(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const exitRow = (digitSum + batteryLevel) % MAZE_SIZE;
  const exitCol = (digitSum + strikes) % MAZE_SIZE;
  return { row: exitRow, col: exitCol };
}

export function solveTimer(serial: string, strikes: number, portCount: number) {
  const digitSum = serialDigitSum(serial);
  const targetSecond = (digitSum + strikes + portCount) % 60;
  return targetSecond;
}

export function solveSequence(serial: string, strikes: number, portType: string) {
  const digitSum = serialDigitSum(serial);
  const portOffset = PORT_OFFSETS[portType] || 0;
  const startIdx = (digitSum + portOffset) % SEQUENCE_NUMBERS.length;
  let order = SEQUENCE_NUMBERS.slice(startIdx).concat(SEQUENCE_NUMBERS.slice(0, startIdx));
  if (strikes > 0) order = order.reverse();
  return order;
}

export function solveBinary(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const target = (digitSum + strikes + batteryLevel * 2) % 32;
  return target.toString(2).padStart(5, '0');
}

export function solveMath(serial: string, strikes: number, portCount: number) {
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

export function solveWord(serial: string, strikes: number, portType: string) {
  const digitSum = serialDigitSum(serial);
  const portOffset = PORT_OFFSETS[portType] || 0;
  const idx = (digitSum + strikes + portOffset) % WORD_WORDS.length;
  return WORD_WORDS[idx];
}

export function solveReaction(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const targetMs = 2000 + (digitSum * 100) + (strikes * 200) + (batteryLevel * 50);
  return targetMs;
}

export function solveMatching() {
  const pairs = [];
  const symbols = GameHelpers.shuffle(MATCHING_SYMBOLS.slice());
  for (let i = 0; i < 4; i++) {
    pairs.push([symbols[i * 2], symbols[i * 2 + 1]]);
  }
  return pairs;
}

export function solveCipher(serial: string, strikes: number, portCount: number) {
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

export function solveTiming(serial: string, strikes: number, portType: string) {
  const digitSum = serialDigitSum(serial);
  const portOffset = PORT_OFFSETS[portType] || 0;
  const offset = (digitSum + strikes + portOffset) % 10;
  return offset;
}

export function solveCoordinates(serial: string, strikes: number, batteryLevel: number) {
  const digitSum = serialDigitSum(serial);
  const x = (digitSum + strikes + batteryLevel) % 10;
  const y = (digitSum + strikes * 2) % 10;
  return { x, y };
}

export function solveBattery(serial: string) {
  const digitSum = serialDigitSum(serial);
  const targetLevel = (digitSum % 4) + 1;
  return targetLevel;
}

export function solvePorts(serial: string) {
  const digitSum = serialDigitSum(serial);
  const targetPortIndex = digitSum % 6;
  const portTypes = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
  return portTypes[targetPortIndex];
}

export function solveCompass(serial: string, strikes: number) {
  const digitSum = serialDigitSum(serial);
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const targetIndex = (digitSum + strikes) % 8;
  return directions[targetIndex];
}

export function solveSlots(batteryLevel: number, portCount: number, serial: string) {
  const digitSum = serialDigitSum(serial);
  const targetSlot = (digitSum + batteryLevel + portCount) % 5;
  return targetSlot;
}
