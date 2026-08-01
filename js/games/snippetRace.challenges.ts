/**
 * Desafíos de Snippet Race — pool filtrable por dificultad.
 * Tipos: fill (hueco), fix (typo/bug), line (línea faltante).
 */

import { escapeHtml } from '../security';

export type SnippetType = 'fill' | 'fix' | 'line';
export type SnippetLang = 'js' | 'ts' | 'pseudo';

export interface SnippetChallenge {
  id: string;
  type: SnippetType;
  difficulty: 1 | 2 | 3;
  lang: SnippetLang;
  prompt: string;
  code: string;
  answer: string;
  alternatives?: string[];
  hint?: string;
  timeLimitSec?: number;
}

export const CHALLENGES: SnippetChallenge[] = [
  // —— Cadete (fill + fix simples) ——
  {
    id: 'fill-double',
    type: 'fill',
    difficulty: 1,
    lang: 'js',
    prompt: 'Completá el return para duplicar x',
    code: 'function double(x) {\n  return ___;\n}',
    answer: 'x * 2',
    alternatives: ['x*2', '2 * x', '2*x'],
    hint: 'Multiplicá x por 2',
  },
  {
    id: 'fix-const',
    type: 'fix',
    difficulty: 1,
    lang: 'js',
    prompt: 'Corregí el typo',
    code: 'cosnt name = "bot";',
    answer: 'const name = "bot";',
    alternatives: ['const name = "bot"'],
  },
  {
    id: 'fill-len',
    type: 'fill',
    difficulty: 1,
    lang: 'js',
    prompt: 'Devolvé la cantidad de elementos',
    code: 'function size(arr) {\n  return ___;\n}',
    answer: 'arr.length',
  },
  {
    id: 'fix-funcion',
    type: 'fix',
    difficulty: 1,
    lang: 'js',
    prompt: 'Corregí la palabra clave',
    code: 'functon greet() {\n  return "hi";\n}',
    answer: 'function greet() {\n  return "hi";\n}',
    alternatives: ['function greet() {\n  return "hi"\n}'],
  },
  {
    id: 'fill-true',
    type: 'fill',
    difficulty: 1,
    lang: 'js',
    prompt: 'Devolvé verdadero',
    code: 'function always() {\n  return ___;\n}',
    answer: 'true',
  },
  {
    id: 'fill-join',
    type: 'fill',
    difficulty: 1,
    lang: 'js',
    prompt: 'Uní el array con guiones',
    code: 'const s = parts.___("-");',
    answer: 'join',
  },
  {
    id: 'fix-return',
    type: 'fix',
    difficulty: 1,
    lang: 'js',
    prompt: 'Corregí return',
    code: 'function id(x) {\n  retrun x;\n}',
    answer: 'function id(x) {\n  return x;\n}',
    alternatives: ['function id(x) {\n  return x\n}'],
  },
  {
    id: 'fill-toUpper',
    type: 'fill',
    difficulty: 1,
    lang: 'js',
    prompt: 'Pasá a mayúsculas',
    code: 'const up = text.___();',
    answer: 'toUpperCase',
    alternatives: ['toUpperCase()'],
  },

  // —— Operador (fill + fix + line) ——
  {
    id: 'line-push',
    type: 'line',
    difficulty: 2,
    lang: 'js',
    prompt: 'Agregá 42 al final del array',
    code: 'const list = [1, 2];\n// ← línea que falta',
    answer: 'list.push(42);',
    alternatives: ['list.push(42)'],
  },
  {
    id: 'line-map',
    type: 'line',
    difficulty: 2,
    lang: 'js',
    prompt: 'Escribí la línea que transforma cada n en n*2',
    code: 'const nums = [1, 2, 3];\n// ← línea que falta\nconsole.log(doubled);',
    answer: 'const doubled = nums.map(n => n * 2);',
    alternatives: [
      'const doubled = nums.map(n => n*2);',
      'const doubled = nums.map((n) => n * 2);',
      'const doubled = nums.map(n => n * 2)',
    ],
  },
  {
    id: 'fix-eq',
    type: 'fix',
    difficulty: 2,
    lang: 'js',
    prompt: 'Comparación estricta',
    code: 'if (status = "ready") {\n  start();\n}',
    answer: 'if (status === "ready") {\n  start();\n}',
    alternatives: [
      'if (status === "ready") {\n  start()\n}',
      'if (status === \'ready\') {\n  start();\n}',
    ],
  },
  {
    id: 'fill-filter',
    type: 'fill',
    difficulty: 2,
    lang: 'js',
    prompt: 'Solo los pares',
    code: 'const evens = nums.filter(n => ___);',
    answer: 'n % 2 === 0',
    alternatives: ['n % 2 == 0', '!(n % 2)', 'n%2===0'],
  },
  {
    id: 'fill-includes',
    type: 'fill',
    difficulty: 2,
    lang: 'js',
    prompt: '¿El array contiene "bot"?',
    code: 'const ok = tags.___("bot");',
    answer: 'includes',
  },
  {
    id: 'fix-else',
    type: 'fix',
    difficulty: 2,
    lang: 'js',
    prompt: 'Corregí el else if',
    code: 'if (n > 0) {\n  pos();\n} esle if (n < 0) {\n  neg();\n}',
    answer: 'if (n > 0) {\n  pos();\n} else if (n < 0) {\n  neg();\n}',
  },
  {
    id: 'line-find',
    type: 'line',
    difficulty: 2,
    lang: 'js',
    prompt: 'Encontrá el primer ítem con id === 3',
    code: 'const items = [{ id: 1 }, { id: 3 }];\n// ← línea que falta',
    answer: 'const found = items.find(i => i.id === 3);',
    alternatives: [
      'const found = items.find(i => i.id === 3)',
      'const found = items.find((i) => i.id === 3);',
    ],
  },
  {
    id: 'fill-ternary',
    type: 'fill',
    difficulty: 2,
    lang: 'js',
    prompt: 'Completá el ternario',
    code: 'const label = ok ? "yes" : ___;',
    answer: '"no"',
    alternatives: ["'no'"],
  },
  {
    id: 'line-filter-map',
    type: 'line',
    difficulty: 2,
    lang: 'js',
    prompt: 'Filtrá positivos y multiplicá por 10',
    code: 'const raw = [-1, 2, 3];\n// ← línea que falta',
    answer: 'const out = raw.filter(n => n > 0).map(n => n * 10);',
    alternatives: [
      'const out = raw.filter(n => n > 0).map(n => n*10);',
      'const out = raw.filter((n) => n > 0).map((n) => n * 10);',
    ],
  },

  // —— Elite ——
  {
    id: 'line-reduce',
    type: 'line',
    difficulty: 3,
    lang: 'js',
    prompt: 'Sumá todos los valores del array',
    code: 'const values = [4, 8, 15, 16];\n// ← línea que falta',
    answer: 'const total = values.reduce((a, b) => a + b, 0);',
    alternatives: [
      'const total = values.reduce((a, b) => a + b);',
      'const total = values.reduce((sum, n) => sum + n, 0);',
      'const total = values.reduce((a, b) => a + b, 0)',
    ],
  },
  {
    id: 'fix-async',
    type: 'fix',
    difficulty: 3,
    lang: 'js',
    prompt: 'Falta await',
    code: 'async function load() {\n  const data = fetch("/api");\n  return data.json();\n}',
    answer: 'async function load() {\n  const data = await fetch("/api");\n  return data.json();\n}',
    alternatives: [
      'async function load() {\n  const data = await fetch(\'/api\');\n  return data.json();\n}',
    ],
  },
  {
    id: 'fill-ts-type',
    type: 'fill',
    difficulty: 3,
    lang: 'ts',
    prompt: 'Anotá el tipo de retorno',
    code: 'function isReady(s: string)___ {\n  return s === "ready";\n}',
    answer: ': boolean',
    alternatives: [':boolean', ': Boolean'],
  },
  {
    id: 'fill-optional',
    type: 'fill',
    difficulty: 3,
    lang: 'ts',
    prompt: 'Optional chaining: completá entre user y .profile',
    code: 'const name = user___.profile.name;',
    answer: '?',
    hint: 'Escribí solo ? — queda user?.profile.name',
  },
  {
    id: 'line-promise-all',
    type: 'line',
    difficulty: 3,
    lang: 'js',
    prompt: 'Esperá ambas promesas en paralelo',
    code: 'const a = fetch("/a");\nconst b = fetch("/b");\n// ← línea que falta',
    answer: 'const [ra, rb] = await Promise.all([a, b]);',
    alternatives: [
      'const [ra, rb] = await Promise.all([a, b])',
      'const results = await Promise.all([a, b]);',
    ],
  },
  {
    id: 'fix-ternary',
    type: 'fix',
    difficulty: 3,
    lang: 'js',
    prompt: 'Corregí el ternario (falta :)',
    code: 'const label = ok ? "yes" "no";',
    answer: 'const label = ok ? "yes" : "no";',
    alternatives: ['const label = ok ? "yes" : "no"'],
  },
  {
    id: 'fill-nullish',
    type: 'fill',
    difficulty: 3,
    lang: 'js',
    prompt: 'Nullish coalescing: default "anon"',
    code: 'const name = user.name ___ "anon";',
    answer: '??',
    alternatives: ['??'],
  },
  {
    id: 'line-sort',
    type: 'line',
    difficulty: 3,
    lang: 'js',
    prompt: 'Ordená números ascendente (copia, no mutés el original)',
    code: 'const nums = [3, 1, 2];\n// ← línea que falta',
    answer: 'const sorted = [...nums].sort((a, b) => a - b);',
    alternatives: [
      'const sorted = nums.slice().sort((a, b) => a - b);',
      'const sorted = [...nums].sort((a, b) => a - b)',
    ],
  },
  {
    id: 'fix-const-reassign',
    type: 'fix',
    difficulty: 3,
    lang: 'js',
    prompt: 'No se puede reasignar const — usá let',
    code: 'const count = 0;\ncount = count + 1;',
    answer: 'let count = 0;\ncount = count + 1;',
    alternatives: ['let count = 0;\ncount += 1;'],
  },
];

/** Normaliza respuesta: CRLF→LF, trim líneas, colapsa espacios. */
export function normalize(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim()
    .replace(/\s+/g, ' ');
}

export function checkAnswer(input: string, ch: SnippetChallenge): boolean {
  const n = normalize(input);
  if (n === normalize(ch.answer)) return true;
  return (ch.alternatives ?? []).some((a) => normalize(a) === n);
}

export function shufflePool(pool: SnippetChallenge[]): SnippetChallenge[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Cadete: solo difficulty 1 (fill/fix).
 * Operador: difficulty ≤ 2.
 * Elite: todos.
 */
export function filterPool(difficulty: number): SnippetChallenge[] {
  const validDifficulty = (difficulty >= 1 && difficulty <= 3) ? difficulty : 2;
  if (validDifficulty === 1) {
    return CHALLENGES.filter((c) => c.difficulty === 1 && c.type !== 'line');
  }
  return CHALLENGES.filter((c) => c.difficulty <= validDifficulty);
}

export function renderSnippetHtml(ch: SnippetChallenge): string {
  const escaped = escapeHtml(ch.code);
  if (ch.type === 'fill') {
    return escaped.replace(/___/g, '<span class="sr-gap">___</span>');
  }
  if (ch.type === 'line') {
    return escaped.replace(
      /\/\/ ← línea que falta/g,
      '<span class="sr-missing">// ← línea que falta</span>'
    );
  }
  const lines = escaped.split('\n');
  if (lines.length === 1) {
    return `<span class="sr-bug">${lines[0]}</span>`;
  }
  const bugIdx = lines.findIndex((l) =>
    /cosnt|functon|retrun|esle|\s=\s"[^"]+"\)|fetch\(|\?\s"[^"]+"\s"|const count/i.test(l)
  );
  const idx = bugIdx >= 0 ? bugIdx : 0;
  lines[idx] = `<span class="sr-bug">${lines[idx]}</span>`;
  return lines.join('\n');
}


