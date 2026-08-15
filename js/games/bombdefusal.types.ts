/**
 * js/games/bombdefusal.types.ts
 *
 * Tipos e interfaces del minijuego de desactivación de bombas, extraídos
 * de bombdefusal.logic.ts como parte de dividir ese archivo (antes
 * 3212 líneas). Ver bombdefusal.logic.ts para el porqué de la
 * discriminated union BombModule.
 */

export interface BombState {
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

export interface WiresModule {
  type: 'wires';
  solved: boolean;
  data: { wires: string[]; cutIndex: number | null };
  getSolution: (bomb: BombState) => { wireIndex: number };
}

export interface ButtonsModule {
  type: 'buttons';
  solved: boolean;
  data: { color: string; label: string; pressed: boolean; holding: boolean; strikesAtStart: number };
  getSolution: (bomb: BombState) => { action: 'hold' | 'tap'; releaseOnSecondDigit?: number; releaseOnLight?: boolean };
}

export interface SymbolsModule {
  type: 'symbols';
  solved: boolean;
  data: { symbols: string[]; order: string[]; step: number };
  getSolution: () => { order: string[] };
}

export interface MemoryModule {
  type: 'memory';
  solved: boolean;
  data: { stage: number; display: number; labels: number[]; history: Array<{ position: number; label: number }> };
  getSolution: (bomb: BombState) => { position: number };
}

export interface ScreenModule {
  type: 'screen';
  solved: boolean;
  data: { msg: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { answer: string };
}

export interface FrequencyModule {
  type: 'frequency';
  solved: boolean;
  data: { labelA: string; labelB: string };
  getSolution: () => { freq: string };
}

export interface ColorsModule {
  type: 'colors';
  solved: boolean;
  data: { colors: string[]; step: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { order: string[] };
}

export interface PatternModule {
  type: 'pattern';
  solved: boolean;
  data: { size: number; litCount: number; decoy: number[]; selected: Set<number>; strikesAtStart: number };
  getSolution: (bomb: BombState) => { cells: number[] };
}

export interface SwitchesModule {
  type: 'switches';
  solved: boolean;
  data: { states: boolean[]; strikesAtStart: number };
  getSolution: (bomb: BombState) => { states: boolean[] };
}

export interface CodeModule {
  type: 'code';
  solved: boolean;
  data: { input: string };
  getSolution: (bomb: BombState) => { code: string };
}

export interface KeypadModule {
  type: 'keypad';
  solved: boolean;
  data: { symbols: string[]; step: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { order: string[] };
}

export interface MorseModule {
  type: 'morse';
  solved: boolean;
  data: { code: string; options: string[] };
  getSolution: () => { letter: string };
}

export interface PasswordModule {
  type: 'password';
  solved: boolean;
  data: { clues: string[]; input: string };
  getSolution: (bomb: BombState) => { password: string };
}

export interface SimonModule {
  type: 'simon';
  solved: boolean;
  data: { sequenceLength: number; step: number; playerSequence: string[]; strikesAtStart: number };
  getSolution: (bomb: BombState) => { colors: string[] };
}

export interface KnobsModule {
  type: 'knobs';
  solved: boolean;
  data: { positions: number[]; strikesAtStart: number };
  getSolution: (bomb: BombState) => { positions: string[] };
}

export interface MazeModule {
  type: 'maze';
  solved: boolean;
  data: { playerRow: number; playerCol: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { row: number; col: number };
}

export interface TimerModule {
  type: 'timer';
  solved: boolean;
  data: { stopped: boolean; stopSecond: number | null; strikesAtStart: number };
  getSolution: (bomb: BombState) => { targetSecond: number };
}

export interface SequenceModule {
  type: 'sequence';
  solved: boolean;
  data: { step: number; strikesAtStart: number };
  getSolution: (bomb: BombState) => { order: string[] };
}

export interface BinaryModule {
  type: 'binary';
  solved: boolean;
  data: { input: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { binary: string };
}

export interface MathModule {
  type: 'math';
  solved: boolean;
  data: { answer: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { a: number; b: number; op: string; result: number };
}

export interface WordModule {
  type: 'word';
  solved: boolean;
  data: { word: string; revealed: string[]; input: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { word: string };
}

export interface ReactionModule {
  type: 'reaction';
  solved: boolean;
  data: { lit: boolean; litTime: number | null; pressed: boolean; strikesAtStart: number };
  getSolution: (bomb: BombState) => { targetMs: number };
}

export interface MatchingModule {
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

export interface CipherModule {
  type: 'cipher';
  solved: boolean;
  data: { input: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { original: string; encoded: string; shift: number };
}

export interface TimingModule {
  type: 'timing';
  solved: boolean;
  data: { synced: boolean; strikesAtStart: number };
  getSolution: (bomb: BombState) => { offset: number };
}

export interface CoordinatesModule {
  type: 'coordinates';
  solved: boolean;
  data: { x: string; y: string; strikesAtStart: number };
  getSolution: (bomb: BombState) => { x: number; y: number };
}

export interface BatteryModule {
  type: 'battery';
  solved: boolean;
  data: { selectedLevel: number | null };
  getSolution: (bomb: BombState) => { targetLevel: number };
}

export interface PortsModule {
  type: 'ports';
  solved: boolean;
  data: { selectedPort: string | null };
  getSolution: (bomb: BombState) => { targetPort: string };
}

export interface CompassModule {
  type: 'compass';
  solved: boolean;
  data: { currentDirection: string; selectedDirection: string | null; strikesAtStart: number };
  getSolution: (bomb: BombState) => { targetDirection: string };
}

export interface SlotsModule {
  type: 'slots';
  solved: boolean;
  data: { selectedSlot: number | null };
  getSolution: (bomb: BombState) => { targetSlot: number };
}

export type BombModule =
  | WiresModule | ButtonsModule | SymbolsModule | MemoryModule | ScreenModule
  | FrequencyModule | ColorsModule | PatternModule | SwitchesModule | CodeModule
  | KeypadModule | MorseModule | PasswordModule | SimonModule | KnobsModule
  | MazeModule | TimerModule | SequenceModule | BinaryModule | MathModule
  | WordModule | ReactionModule | MatchingModule | CipherModule | TimingModule
  | CoordinatesModule | BatteryModule | PortsModule | CompassModule | SlotsModule;

