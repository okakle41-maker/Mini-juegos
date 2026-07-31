import { describe, expect, it } from 'vitest';
import {
  checkAnswer,
  normalize,
  type SnippetChallenge,
} from '../js/games/snippetRace.challenges';

describe('Snippet Race — normalización y validación', () => {
  it('normalize colapsa espacios y recorta', () => {
    expect(normalize('  x   *  2  ')).toBe('x * 2');
    expect(normalize('a\r\nb')).toBe('a b');
  });

  it('acepta answer y alternatives', () => {
    const ch: SnippetChallenge = {
      id: 't',
      type: 'fill',
      difficulty: 1,
      lang: 'js',
      prompt: '',
      code: 'return ___;',
      answer: 'x * 2',
      alternatives: ['x*2', '2 * x'],
    };
    expect(checkAnswer('x * 2', ch)).toBe(true);
    expect(checkAnswer('x*2', ch)).toBe(true);
    expect(checkAnswer('2 * x', ch)).toBe(true);
    expect(checkAnswer('x + 2', ch)).toBe(false);
  });

  it('ignora diferencias de whitespace multilínea en fix', () => {
    const ch: SnippetChallenge = {
      id: 'fix',
      type: 'fix',
      difficulty: 2,
      lang: 'js',
      prompt: '',
      code: 'if (a = 1) {}',
      answer: 'if (status === "ready") {\n  start();\n}',
      alternatives: ['if (status === "ready") {\n  start()\n}'],
    };
    expect(checkAnswer('if (status === "ready") {\n  start();\n}', ch)).toBe(true);
    expect(checkAnswer('if (status === "ready") { start(); }', ch)).toBe(true);
  });
});
