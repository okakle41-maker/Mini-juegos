/**
 * js/games/bombdefusal.data.ts
 *
 * Tablas de datos estáticos (colores, etiquetas, palabras, nombres de
 * módulos) del minijuego de desactivación de bombas. Extraído de
 * bombdefusal.logic.ts — se usa tanto desde bombdefusal.solvers.ts /
 * bombdefusal.factories.ts (generar y resolver módulos) como desde el
 * render en bombdefusal.logic.ts (pintar la UI de cada módulo), por
 * eso vive en un archivo propio en vez de junto a los solvers.
 */

export const WIRE_COLORS = ['red', 'blue', 'yellow', 'white', 'black'];
export const BTN_COLORS = ['blue', 'white', 'yellow', 'red'];
export const BTN_LABELS = ['PRESIONAR', 'MANTENER', 'ABORTAR', 'DETONAR', 'ACTIVAR'];
export const FREQS = ['3.55', '3.70', '3.85', '4.00', '4.15', '4.30'];
export const FREQ_LABELS = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'];
export const SCREEN_MSGS = ['SÍ', 'NO', 'ARRIBA', 'ABAJO', 'IZQ', 'DER', '¿?', '88:88', '12:34', '99:99'];
export const SCREEN_OPTS = ['SÍ', 'NO', 'ARRIBA', 'ABAJO', 'IZQ', 'DER', 'LISTO', 'ESPERA'];

export const MODULE_NAMES: Record<string, string> = {
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

export const COLOR_NAMES = ['rojo', 'azul', 'verde', 'amarillo'];
export const COLOR_CSS = { rojo: '#ef4444', azul: '#3b82f6', verde: '#22c55e', amarillo: '#eab308' };
export const PASSWORD_WORDS = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL'];
export const SIMON_COLORS = ['red', 'blue', 'green', 'yellow'];
export const KNOB_POSITIONS = ['IZQ', 'ARRIBA', 'DER', 'ABAJO'];
export const MAZE_SIZE = 5;
export const PORT_OFFSETS: Record<string, number> = {
  'DVI': 0, 'Parallel': 1, 'PS/2': 2, 'RJ-45': 3, 'Stereo RCA': 4, 'USB': 5
};
export const SEQUENCE_NUMBERS = ['1', '2', '3', '4', '5'];
export const MATH_OPERATIONS = ['+', '-', '×'];
export const WORD_WORDS = ['BOMBA', 'FUEGO', 'TIEMPO', 'CABLE', 'SECRETO', 'CODIGO', 'PULSAR', 'DETENER'];
export const MATCHING_SYMBOLS = ['★', 'Ω', '©', 'λ', 'Ϙ', '¶', '¿', '♡'];
export const CIPHER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const KEYPAD_GRID = ['λ', 'ψ', 'Ω', 'Ϙ', '☆', '¿', '¶', '♡', 'β'];
/** Nombre legible por símbolo, para aria-label — el motor de síntesis
 *  del lector de pantalla puede no verbalizar bien (o de forma
 *  distinguible entre sí) glyphs poco comunes como Ϙ, ¶ o ☆ vs ★. */
export const SYMBOL_NAMES: Record<string, string> = {
  '★': 'estrella rellena', '☆': 'estrella vacía', 'Ω': 'omega', '©': 'copyright',
  'λ': 'lambda', 'Ϙ': 'koppa', '¶': 'párrafo', '¿': 'interrogación invertida',
  '♡': 'corazón', 'ψ': 'psi', 'β': 'beta', '?': 'interrogación',
};
export const MORSE_WORDS = [
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

