/**
 * js/games/bombdefusal.factories.ts
 *
 * Funciones createXModule() que generan el estado inicial de cada uno
 * de los 31 tipos de módulo, más MODULE_FACTORIES (el dispatch por
 * 'type' que usa init() al armar una bomba nueva). Extraído de
 * bombdefusal.logic.ts como parte de dividir ese archivo (antes
 * 3212 líneas).
 */

import GameHelpers from '../utils/gameHelpers.js';
import type {
  BombState, BombModule, WiresModule, ButtonsModule, SymbolsModule,
  MemoryModule, ScreenModule, FrequencyModule, ColorsModule, PatternModule,
  SwitchesModule, CodeModule, KeypadModule, MorseModule, PasswordModule,
  SimonModule, KnobsModule, MazeModule, TimerModule, SequenceModule,
  BinaryModule, MathModule, WordModule, ReactionModule, MatchingModule,
  CipherModule, TimingModule, CoordinatesModule, BatteryModule, PortsModule,
  CompassModule, SlotsModule
} from './bombdefusal.types.js';
import {
  WIRE_COLORS, BTN_COLORS, BTN_LABELS, FREQ_LABELS, SCREEN_MSGS,
  COLOR_NAMES, PASSWORD_WORDS, WORD_WORDS, KEYPAD_GRID, MORSE_WORDS
} from './bombdefusal.data.js';
import {
  randInt, pick, solveWires, solveButton, solveMemoryStage, solveScreen,
  solveFrequency, solveColors, solvePattern, solveSwitches, solveCode,
  solveKeypad, solveMorse, solvePassword, solveSimon, solveKnobs, solveMaze,
  solveTimer, solveSequence, solveBinary, solveMath, solveWord, solveReaction,
  solveMatching, solveCipher, solveTiming, solveCoordinates, solveBattery,
  solvePorts, solveCompass, solveSlots
} from './bombdefusal.solvers.js';

export function createWiresModule(difficulty: number): WiresModule {
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

export function createButtonsModule(bomb: BombState): ButtonsModule {
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

export function createSymbolsModule(): SymbolsModule {
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

export function createMemoryModule(): MemoryModule {
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

export function createScreenModule(bomb: BombState): ScreenModule {
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

export function createFrequencyModule(): FrequencyModule {
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

export function createColorsModule(bomb: BombState): ColorsModule {
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

export function createPatternModule(bomb: BombState): PatternModule {
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

export function createSwitchesModule(bomb: BombState): SwitchesModule {
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

export function createCodeModule(): CodeModule {
  return {
    type: 'code',
    solved: false,
    data: { input: '' },
    getSolution(this: CodeModule, bomb: BombState) {
      return { code: solveCode(bomb.serial) };
    }
  };
}

export function createKeypadModule(bomb: BombState): KeypadModule {
  return {
    type: 'keypad',
    solved: false,
    data: { symbols: KEYPAD_GRID.slice(), step: 0, strikesAtStart: bomb.strikes },
    getSolution(this: KeypadModule, bomb: BombState) {
      return { order: solveKeypad(bomb.serial, this.data.strikesAtStart, bomb.indicatorLit) };
    }
  };
}

export function createMorseModule(): MorseModule {
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

export function createPasswordModule(): PasswordModule {
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

export function createSimonModule(bomb: BombState): SimonModule {
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

export function createKnobsModule(bomb: BombState): KnobsModule {
  return {
    type: 'knobs',
    solved: false,
    data: { positions: [0, 0, 0], strikesAtStart: bomb.strikes },
    getSolution(this: KnobsModule, bomb: BombState) {
      return { positions: solveKnobs(bomb.serial, this.data.strikesAtStart, bomb.indicatorLit, bomb.portType) };
    }
  };
}

export function createMazeModule(bomb: BombState): MazeModule {
  return {
    type: 'maze',
    solved: false,
    data: { playerRow: 0, playerCol: 0, strikesAtStart: bomb.strikes },
    getSolution(this: MazeModule, bomb: BombState) {
      return solveMaze(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel);
    }
  };
}

export function createTimerModule(bomb: BombState): TimerModule {
  return {
    type: 'timer',
    solved: false,
    data: { stopped: false, stopSecond: null, strikesAtStart: bomb.strikes },
    getSolution(this: TimerModule, bomb: BombState) {
      return { targetSecond: solveTimer(bomb.serial, this.data.strikesAtStart, bomb.portCount) };
    }
  };
}

export function createSequenceModule(bomb: BombState): SequenceModule {
  return {
    type: 'sequence',
    solved: false,
    data: { step: 0, strikesAtStart: bomb.strikes },
    getSolution(this: SequenceModule, bomb: BombState) {
      return { order: solveSequence(bomb.serial, this.data.strikesAtStart, bomb.portType) };
    }
  };
}

export function createBinaryModule(bomb: BombState): BinaryModule {
  return {
    type: 'binary',
    solved: false,
    data: { input: '', strikesAtStart: bomb.strikes },
    getSolution(this: BinaryModule, bomb: BombState) {
      return { binary: solveBinary(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel) };
    }
  };
}

export function createMathModule(bomb: BombState): MathModule {
  return {
    type: 'math',
    solved: false,
    data: { answer: '', strikesAtStart: bomb.strikes },
    getSolution(this: MathModule, bomb: BombState) {
      return solveMath(bomb.serial, this.data.strikesAtStart, bomb.portCount);
    }
  };
}

export function createWordModule(bomb: BombState): WordModule {
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

export function createReactionModule(bomb: BombState): ReactionModule {
  return {
    type: 'reaction',
    solved: false,
    data: { lit: false, litTime: null, pressed: false, strikesAtStart: bomb.strikes },
    getSolution(this: ReactionModule, bomb: BombState) {
      return { targetMs: solveReaction(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel) };
    }
  };
}

export function createMatchingModule(): MatchingModule {
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

export function createCipherModule(bomb: BombState): CipherModule {
  return {
    type: 'cipher',
    solved: false,
    data: { input: '', strikesAtStart: bomb.strikes },
    getSolution(this: CipherModule, bomb: BombState) {
      return solveCipher(bomb.serial, this.data.strikesAtStart, bomb.portCount);
    }
  };
}

export function createTimingModule(bomb: BombState): TimingModule {
  return {
    type: 'timing',
    solved: false,
    data: { synced: false, strikesAtStart: bomb.strikes },
    getSolution(this: TimingModule, bomb: BombState) {
      return { offset: solveTiming(bomb.serial, this.data.strikesAtStart, bomb.portType) };
    }
  };
}

export function createCoordinatesModule(bomb: BombState): CoordinatesModule {
  return {
    type: 'coordinates',
    solved: false,
    data: { x: '', y: '', strikesAtStart: bomb.strikes },
    getSolution(this: CoordinatesModule, bomb: BombState) {
      return solveCoordinates(bomb.serial, this.data.strikesAtStart, bomb.batteryLevel);
    }
  };
}

export function createBatteryModule(): BatteryModule {
  return {
    type: 'battery',
    solved: false,
    data: { selectedLevel: null },
    getSolution(this: BatteryModule, bomb: BombState) {
      return { targetLevel: solveBattery(bomb.serial) };
    }
  };
}

export function createPortsModule(): PortsModule {
  return {
    type: 'ports',
    solved: false,
    data: { selectedPort: null },
    getSolution(this: PortsModule, bomb: BombState) {
      return { targetPort: solvePorts(bomb.serial) };
    }
  };
}

export function createCompassModule(bomb: BombState): CompassModule {
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

export function createSlotsModule(): SlotsModule {
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
export const MODULE_FACTORIES: Record<string, (difficulty: number, bomb: BombState) => BombModule> = {
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
