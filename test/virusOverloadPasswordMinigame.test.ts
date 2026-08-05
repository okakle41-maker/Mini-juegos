import { describe, it, expect } from 'vitest';
import { generateMinigameData } from '../js/games/virusOverload.logic';

/**
 * test/virusOverloadPasswordMinigame.test.ts
 *
 * Bug: `generateMinigameData('password')` devolvía
 * `{ options: shuffle([...]), correct: 0 }` — `correct` estaba
 * hardcodeado en 0, pero `options` ya venía shuffleado, así que el
 * índice 0 del array shuffleado no correspondía a ninguna palabra en
 * particular (era, en la práctica, apuntar a una posición al azar).
 * Encima, `renderMinigameLabel` (caso 'password') nunca mostraba
 * ninguna pista de cuál era la palabra correcta: el jugador veía 4
 * botones sin ninguna señal de cuál clickear. El minijuego "clave" no
 * tenía forma de resolverse de manera informada.
 *
 * Fix: se elige la palabra correcta ANTES de shufflear, se calcula su
 * índice en el array ya shuffleado, y se expone como `target` para
 * mostrarla como pista.
 */
describe('virusOverload — minijuego "password"', () => {
  it('el índice `correct` siempre apunta a la posición real de `target` dentro de `options`', () => {
    for (let i = 0; i < 200; i++) {
      const data = generateMinigameData('password') as {
        options: string[];
        correct: number;
        target: string;
      };

      expect(data.options).toHaveLength(4);
      expect(data.options).toContain(data.target);
      expect(data.options[data.correct]).toBe(data.target);
    }
  });

  it('`target` es siempre una de las 4 palabras posibles', () => {
    const words = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'];
    for (let i = 0; i < 50; i++) {
      const data = generateMinigameData('password') as { target: string };
      expect(words).toContain(data.target);
    }
  });
});
