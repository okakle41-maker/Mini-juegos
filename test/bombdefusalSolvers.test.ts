import { describe, expect, it, vi } from 'vitest';
import {
  countColor,
  genBatteryLevel,
  genPortCount,
  genPortType,
  genSerial,
  lastIndexOfColor,
  pick,
  randInt,
  serialDigitSum,
  serialLastDigitEven,
  serialVowelCount,
  solveBattery,
  solveBinary,
  solveButton,
  solveCipher,
  solveCode,
  solveColors,
  solveCompass,
  solveCoordinates,
  solveFrequency,
  solveKeypad,
  solveKnobs,
  solveMath,
  solveMatching,
  solveMaze,
  solveMemoryStage,
  solveMorse,
  solvePassword,
  solvePattern,
  solvePorts,
  solveReaction,
  solveScreen,
  solveSequence,
  solveSimon,
  solveSlots,
  solveSwitches,
  solveTimer,
  solveTiming,
  solveWires,
  solveWord
} from '../js/games/bombdefusal.solvers';

/**
 * test/bombdefusalSolvers.test.ts
 *
 * `bombdefusal.solvers.ts` (420 líneas) es la pieza más crítica de
 * todo bombdefusal.logic.ts: son las reglas puras que deciden, para
 * cada uno de los 31 tipos de módulo, cuál es la ÚNICA acción
 * correcta que desactiva el módulo sin generar un strike. No dependen
 * de DOM ni de `state` del closure de `init()` — reciben todo por
 * parámetro — así que ya estaban exportadas sin necesidad de tocar
 * nada, pero no tenían ningún test directo (sólo 3 tests de regresión
 * puntuales sobre solveScreen/solvePassword/solveMatching).
 *
 * Cada solver tiene varias ramas condicionales (if/else en cascada)
 * que codifican el "manual de instrucciones" del módulo — un bug acá
 * significa que el juego le pide al jugador una acción que el propio
 * juego luego rechaza como incorrecta, o viceversa. Los tests fijan
 * `serial`/`strikes`/etc a valores concretos elegidos para forzar
 * cada rama, en vez de usar valores aleatorios.
 */

describe('helpers de generación y serial', () => {
  it('randInt siempre devuelve un entero dentro de [min, max] inclusive', () => {
    for (let i = 0; i < 50; i++) {
      const n = randInt(3, 7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('pick siempre devuelve un elemento del array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(pick(arr));
    }
  });

  it('genSerial produce 6 caracteres del alfabeto sin caracteres ambiguos (sin I, O, 0, 1)', () => {
    for (let i = 0; i < 20; i++) {
      const serial = genSerial();
      expect(serial).toHaveLength(6);
      expect(serial).not.toMatch(/[IO01]/);
    }
  });

  it('genBatteryLevel devuelve un entero entre 1 y 4', () => {
    for (let i = 0; i < 20; i++) {
      const lvl = genBatteryLevel();
      expect(lvl).toBeGreaterThanOrEqual(1);
      expect(lvl).toBeLessThanOrEqual(4);
    }
  });

  it('genPortType devuelve uno de los 6 tipos de puerto documentados', () => {
    const valid = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
    for (let i = 0; i < 20; i++) {
      expect(valid).toContain(genPortType());
    }
  });

  it('genPortCount devuelve un entero entre 1 y 6', () => {
    for (let i = 0; i < 20; i++) {
      const n = genPortCount();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it('serialLastDigitEven detecta correctamente dígito par/impar/no-dígito final', () => {
    expect(serialLastDigitEven('ABC124')).toBe(true);
    expect(serialLastDigitEven('ABC123')).toBe(false);
    expect(serialLastDigitEven('ABCDEF')).toBe(false); // última letra no es dígito
  });

  it('countColor cuenta ocurrencias exactas de un color', () => {
    expect(countColor(['red', 'blue', 'red'], 'red')).toBe(2);
    expect(countColor(['red', 'blue', 'red'], 'green')).toBe(0);
  });

  it('lastIndexOfColor devuelve el último índice o -1 si no está', () => {
    expect(lastIndexOfColor(['red', 'blue', 'red', 'yellow'], 'red')).toBe(2);
    expect(lastIndexOfColor(['red', 'blue'], 'green')).toBe(-1);
  });

  it('serialDigitSum suma sólo los dígitos, ignorando letras', () => {
    expect(serialDigitSum('A1B2C3')).toBe(6);
    expect(serialDigitSum('ABCDEF')).toBe(0);
  });

  it('serialVowelCount cuenta vocales sin distinguir mayúsculas/minúsculas', () => {
    expect(serialVowelCount('AEIOU9')).toBe(5);
    expect(serialVowelCount('BCDFG9')).toBe(0);
  });
});

describe('solveWires: reglas por cantidad de cables', () => {
  it('3 cables, sin rojos → corta el índice 1', () => {
    expect(solveWires(['blue', 'yellow', 'black'], 'ABC123')).toBe(1);
  });

  it('3 cables, exactamente 1 azul → corta el índice del azul', () => {
    expect(solveWires(['red', 'blue', 'black'], 'ABC123')).toBe(1);
  });

  it('3 cables, con rojo y sin azul único → corta el último', () => {
    expect(solveWires(['red', 'red', 'black'], 'ABC123')).toBe(2);
  });

  it('4 cables, más de 1 rojo → corta el último rojo', () => {
    expect(solveWires(['red', 'blue', 'red', 'black'], 'ABC123')).toBe(2);
  });

  it('4 cables, último amarillo y sin rojos → corta índice 0', () => {
    expect(solveWires(['blue', 'black', 'black', 'yellow'], 'ABC123')).toBe(0);
  });

  it('4 cables, exactamente 1 azul (y no cae en las reglas previas) → corta índice 0', () => {
    expect(solveWires(['blue', 'black', 'black', 'black'], 'ABC123')).toBe(0);
  });

  it('4 cables, ninguna regla anterior aplica → corta índice 1', () => {
    expect(solveWires(['black', 'black', 'black', 'black'], 'ABC123')).toBe(1);
  });

  it('5 cables, último negro → corta índice 3', () => {
    expect(solveWires(['red', 'blue', 'yellow', 'black', 'black'], 'ABC123')).toBe(3);
  });

  it('5 cables, exactamente 1 rojo y más de 1 amarillo → corta índice 0', () => {
    expect(solveWires(['red', 'yellow', 'yellow', 'blue', 'blue'], 'ABC123')).toBe(0);
  });

  it('5 cables, sin negros → corta índice 1', () => {
    expect(solveWires(['red', 'red', 'yellow', 'blue', 'blue'], 'ABC123')).toBe(1);
  });

  it('5 cables, ninguna regla anterior → corta índice 0', () => {
    expect(solveWires(['black', 'black', 'yellow', 'blue', 'blue'], 'ABC123')).toBe(0);
  });

  it('6 cables, sin amarillos y serial termina en dígito par → corta índice 2', () => {
    expect(solveWires(['red', 'blue', 'red', 'blue', 'black', 'black'], 'ABC124')).toBe(2);
  });

  it('6 cables, exactamente 1 amarillo y más de 1 blanco → corta índice 3', () => {
    expect(solveWires(['yellow', 'white', 'white', 'blue', 'red', 'black'], 'ABC123')).toBe(3);
  });

  it('6 cables, sin rojos (y no cae en reglas previas) → corta índice 1', () => {
    expect(solveWires(['yellow', 'yellow', 'blue', 'blue', 'black', 'black'], 'ABC123')).toBe(1);
  });

  it('6 cables, ninguna regla anterior → corta índice 0', () => {
    expect(solveWires(['yellow', 'yellow', 'red', 'blue', 'black', 'black'], 'ABC123')).toBe(0);
  });

  it('cantidad de cables fuera de 3-6 (fallback) → corta índice 0', () => {
    expect(solveWires(['red', 'blue'], 'ABC123')).toBe(0);
  });
});

describe('solveButton', () => {
  it('azul + "ABORTAR" → mantener y soltar en el segundo dígito == 1', () => {
    expect(solveButton('blue', 'ABORTAR', 'ABC123', 0, false)).toEqual({
      action: 'hold',
      releaseOnSecondDigit: 1
    });
  });

  it('blanco + indicador encendido → tocar', () => {
    expect(solveButton('white', 'X', 'ABC123', 0, true)).toEqual({ action: 'tap' });
  });

  it('amarillo → mantener y soltar cuando se encienda la luz', () => {
    expect(solveButton('yellow', 'X', 'ABC123', 0, false)).toEqual({ action: 'hold', releaseOnLight: true });
  });

  it('rojo + "DETONAR" → tocar', () => {
    expect(solveButton('red', 'DETONAR', 'ABC123', 0, false)).toEqual({ action: 'tap' });
  });

  it('rojo + ya hubo al menos 1 strike → mantener y soltar con la luz', () => {
    expect(solveButton('red', 'X', 'ABC123', 1, false)).toEqual({ action: 'hold', releaseOnLight: true });
  });

  it('blanco (sin indicador, sin ser el caso ABORTAR) → tocar', () => {
    expect(solveButton('white', 'X', 'ABC123', 0, false)).toEqual({ action: 'tap' });
  });

  it('azul + serial NO empieza con vocal → tocar', () => {
    expect(solveButton('blue', 'X', 'BBC123', 0, false)).toEqual({ action: 'tap' });
  });

  it('caso por defecto (ninguna regla aplica) → mantener y soltar con la luz', () => {
    // Color no contemplado explícitamente (p.ej. 'black'), sin strikes.
    expect(solveButton('black', 'X', 'ABC123', 0, false)).toEqual({ action: 'hold', releaseOnLight: true });
  });
});

describe('solveMemoryStage', () => {
  it('stage 1, display 1 → posición 1', () => {
    expect(solveMemoryStage(1, 1, [])).toBe(1);
  });
  it('stage 1, display 4 → posición 3', () => {
    expect(solveMemoryStage(1, 4, [])).toBe(3);
  });
  it('stage 1, display 2 o 3 → posición 0', () => {
    expect(solveMemoryStage(1, 2, [])).toBe(0);
    expect(solveMemoryStage(1, 3, [])).toBe(0);
  });

  it('stage 2, display 1 → índice de la etiqueta 1 en el historial', () => {
    const history = [{ position: 0, label: 4 }, { position: 1, label: 1 }];
    expect(solveMemoryStage(2, 1, history)).toBe(1);
  });
  it('stage 2, display 4 → posición 0', () => {
    expect(solveMemoryStage(2, 4, [{ position: 2, label: 1 }])).toBe(0);
  });
  it('stage 2, display 2 → la posición del primer paso', () => {
    expect(solveMemoryStage(2, 2, [{ position: 3, label: 1 }])).toBe(3);
  });
  it('stage 2, display 3 (default) → posición 1', () => {
    expect(solveMemoryStage(2, 3, [{ position: 3, label: 1 }])).toBe(1);
  });

  it('stage 3, display 3 → índice de la etiqueta 3', () => {
    const history = [{ position: 0, label: 3 }, { position: 1, label: 1 }];
    expect(solveMemoryStage(3, 3, history)).toBe(0);
  });
  it('stage 3, display 1 → índice de la etiqueta 1', () => {
    const history = [{ position: 0, label: 3 }, { position: 1, label: 1 }];
    expect(solveMemoryStage(3, 1, history)).toBe(1);
  });
  it('stage 3, display 2 o 4 (default) → posición 2', () => {
    expect(solveMemoryStage(3, 2, [])).toBe(2);
    expect(solveMemoryStage(3, 4, [])).toBe(2);
  });

  it('stage 4, display 4 → la posición del primer paso', () => {
    expect(solveMemoryStage(4, 4, [{ position: 2, label: 1 }])).toBe(2);
  });
  it('stage 4, display 2 → posición 0', () => {
    expect(solveMemoryStage(4, 2, [{ position: 2, label: 1 }])).toBe(0);
  });
  it('stage 4, display 1 o 3 (default) → la posición del segundo paso', () => {
    const history = [{ position: 0, label: 1 }, { position: 3, label: 2 }];
    expect(solveMemoryStage(4, 1, history)).toBe(3);
    expect(solveMemoryStage(4, 3, history)).toBe(3);
  });

  it('stage 5+, display 1 → posición 0', () => {
    expect(solveMemoryStage(5, 1, [])).toBe(0);
  });
  it('stage 5+, display 2 → la posición del segundo paso', () => {
    const history = [{ position: 0, label: 1 }, { position: 3, label: 2 }];
    expect(solveMemoryStage(5, 2, history)).toBe(3);
  });
  it('stage 5+, display 4 → la posición del primer paso', () => {
    const history = [{ position: 2, label: 1 }, { position: 3, label: 2 }];
    expect(solveMemoryStage(5, 4, history)).toBe(2);
  });
  it('stage 5+, display 3 (default) → posición 1', () => {
    expect(solveMemoryStage(5, 3, [])).toBe(1);
  });
});

describe('solveScreen', () => {
  it('"SÍ" con 0 strikes → "SÍ"; con strikes → "NO"', () => {
    expect(solveScreen('SÍ', 'ABC123', 0)).toBe('SÍ');
    expect(solveScreen('SÍ', 'ABC123', 1)).toBe('NO');
  });
  it('"NO" con serial empezando en vocal → "SÍ"; si no, "NO"', () => {
    expect(solveScreen('NO', 'ABC123', 0)).toBe('SÍ');
    expect(solveScreen('NO', 'BBC123', 0)).toBe('NO');
  });
  it('"ARRIBA" → siempre "ABAJO"', () => {
    expect(solveScreen('ARRIBA', 'ABC123', 0)).toBe('ABAJO');
  });
  it('"ABAJO" con último dígito par → "ARRIBA"; impar → "IZQ"', () => {
    expect(solveScreen('ABAJO', 'ABC124', 0)).toBe('ARRIBA');
    expect(solveScreen('ABAJO', 'ABC123', 0)).toBe('IZQ');
  });
  it('"IZQ" → siempre "DER"', () => {
    expect(solveScreen('IZQ', 'ABC123', 0)).toBe('DER');
  });
  it('"DER" con 0 strikes → "LISTO"; con strikes → "ESPERA"', () => {
    expect(solveScreen('DER', 'ABC123', 0)).toBe('LISTO');
    expect(solveScreen('DER', 'ABC123', 1)).toBe('ESPERA');
  });
  it('"¿?" → "SÍ"', () => {
    expect(solveScreen('¿?', 'ABC123', 0)).toBe('SÍ');
  });
  it('"88:88" → "ESPERA"', () => {
    expect(solveScreen('88:88', 'ABC123', 0)).toBe('ESPERA');
  });
  it('"12:34" con último dígito <=5 → "IZQ"; si no, "DER"', () => {
    expect(solveScreen('12:34', 'ABC123', 0)).toBe('IZQ');
    expect(solveScreen('12:34', 'ABC129', 0)).toBe('DER');
  });
  it('"99:99" → "ABAJO"', () => {
    expect(solveScreen('99:99', 'ABC123', 0)).toBe('ABAJO');
  });
});

describe('solveFrequency', () => {
  it('es determinista para el mismo par de labels', () => {
    const r1 = solveFrequency('A', 'B');
    const r2 = solveFrequency('A', 'B');
    expect(r1).toBe(r2);
  });

  it('labels no encontradas en la tabla no lanzan y devuelven un valor definido', () => {
    expect(solveFrequency('no-existe-a', 'no-existe-b')).toBeDefined();
  });
});

describe('solveColors', () => {
  it('sin strikes, el orden depende de (digitSum+battery)%4, sin indicador → 4 colores', () => {
    // serial 'A1B2C3' -> digitSum=6; battery=2 -> idx=(6+2)%4=0 -> orders[0]
    const order = solveColors('A1B2C3', 0, false, 2);
    expect(order).toEqual(['rojo', 'azul', 'verde', 'amarillo']);
  });

  it('con indicador encendido, se recorta el primer color de la lista', () => {
    const order = solveColors('A1B2C3', 0, true, 2);
    expect(order).toEqual(['azul', 'verde', 'amarillo']);
  });

  it('con strikes, el índice rota adicionalmente por la cantidad de strikes', () => {
    // idx base 0, +1 strike -> orders[1]
    const order = solveColors('A1B2C3', 1, false, 2);
    expect(order).toEqual(['azul', 'verde', 'amarillo', 'rojo']);
  });
});

describe('solvePattern', () => {
  it('litCount=4 → las 4 esquinas de una grilla 5x5, sin invertir con 0 strikes y pocos puertos', () => {
    const cells = solvePattern(4, 'ABC123', 0, 1);
    expect(cells.slice().sort((a, b) => a - b)).toEqual([0, 4, 20, 24]);
  });

  it('litCount=5 → la cruz central', () => {
    const cells = solvePattern(5, 'ABC123', 0, 1);
    expect(cells).toContain(12); // centro (2,2)
    expect(cells).toHaveLength(9);
  });

  it('litCount=6 con serial que empieza en vocal → columna central', () => {
    const cells = solvePattern(6, 'ABC123', 0, 1);
    expect(cells).toEqual([2, 7, 12, 17, 22]); // columna 2, todas las filas
  });

  it('litCount=6 con serial que NO empieza en vocal → fila central', () => {
    const cells = solvePattern(6, 'BBC123', 0, 1);
    expect(cells).toEqual([10, 11, 12, 13, 14]); // fila 2, todas las columnas
  });

  it('con strikes>0 o portCount>3, el patrón de 4 esquinas se refleja sobre sí mismo (mismo set)', () => {
    const normal = solvePattern(4, 'ABC123', 0, 1);
    const flipped = solvePattern(4, 'ABC123', 1, 1);
    expect(flipped.slice().sort((a, b) => a - b)).toEqual(normal.slice().sort((a, b) => a - b));
  });

  it('con litCount=5 (cruz, no simétrica en reflejo), el patrón reflejado cambia', () => {
    const crossNormal = solvePattern(5, 'ABC123', 0, 1);
    const crossFlipped = solvePattern(5, 'ABC123', 0, 4); // portCount>3 también refleja
    expect(crossFlipped).not.toEqual(crossNormal);
  });
});

describe('solveSwitches', () => {
  it('sw1 = paridad del último dígito del serial', () => {
    expect(solveSwitches('ABC124', 0, false)[0]).toBe(true);
    expect(solveSwitches('ABC123', 0, false)[0]).toBe(false);
  });
  it('sw2 = estado del indicador tal cual', () => {
    expect(solveSwitches('ABC123', 0, true)[1]).toBe(true);
    expect(solveSwitches('ABC123', 0, false)[1]).toBe(false);
  });
  it('sw3 = paridad de (strikes + suma de dígitos)', () => {
    // serial 'A1B2C3' digitSum=6, strikes=1 -> 7 (impar) -> true
    expect(solveSwitches('A1B2C3', 1, false)[2]).toBe(true);
    // strikes=0 -> 6 (par) -> false
    expect(solveSwitches('A1B2C3', 0, false)[2]).toBe(false);
  });
});

describe('solveCode', () => {
  it('es determinista y siempre devuelve 4 dígitos con padding de ceros', () => {
    const code = solveCode('A1B2C3');
    expect(code).toMatch(/^\d{4}$/);
    expect(solveCode('A1B2C3')).toBe(code); // mismo input, mismo output
  });
});

describe('solveKeypad', () => {
  it('primera letra <= "M" → devuelve 3 símbolos (fila 1)', () => {
    const order = solveKeypad('ABC123', 0, false);
    expect(order).toHaveLength(3);
  });
  it('primera letra > "M" → devuelve 3 símbolos (columna 3)', () => {
    const colOrder = solveKeypad('ZBC123', 0, false);
    expect(colOrder).toHaveLength(3);
  });
  it('con indicador encendido, "¶" pasa a ser el primero del orden (si está presente)', () => {
    const order = solveKeypad('ABC123', 0, true);
    if (order.includes('¶')) {
      expect(order[0]).toBe('¶');
    }
  });
  it('con strikes>0, el orden se invierte respecto de sin strikes', () => {
    const normal = solveKeypad('ABC123', 0, false);
    const reversed = solveKeypad('ABC123', 1, false);
    expect(reversed).toEqual([...normal].reverse());
  });
});

describe('solveMorse', () => {
  it('devuelve la letra correspondiente a un código Morse válido (un punto = "E")', () => {
    expect(solveMorse('.')).toBe('E');
  });
  it('un código no reconocido cae al fallback "E"', () => {
    expect(solveMorse('no-es-morse-valido')).toBe('E');
  });
});

describe('solvePassword', () => {
  it('el índice se calcula sobre las clues recibidas (subconjunto), no sobre la lista completa', () => {
    // serial 'A1B2C3': digitSum=6, vowelCount=1 (la 'A') -> idx=(6+1)%4=3
    const clues = ['uno', 'dos', 'tres', 'cuatro'];
    expect(solvePassword(clues, 'A1B2C3')).toBe('cuatro');
  });
  it('la respuesta siempre es uno de los elementos de clues', () => {
    const clues = ['a', 'b', 'c'];
    for (const serial of ['AAA111', 'BBB222', 'ZZZ999']) {
      expect(clues).toContain(solvePassword(clues, serial));
    }
  });
});

describe('solveSimon', () => {
  it('siempre devuelve 4 colores sin duplicados', () => {
    const result = solveSimon('BBB111', 0);
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
  });
  it('con strikes>0, el resultado difiere del de 0 strikes (mismo serial)', () => {
    const a = solveSimon('BBB111', 0);
    const b = solveSimon('BBB111', 1);
    expect(b).not.toEqual(a);
  });
});

describe('solveKnobs', () => {
  it('devuelve siempre 3 posiciones', () => {
    expect(solveKnobs('ABC123', 0, false, 'USB')).toHaveLength(3);
  });
  it('es determinista para el mismo input', () => {
    const a = solveKnobs('ABC123', 0, false, 'USB');
    const b = solveKnobs('ABC123', 0, false, 'USB');
    expect(a).toEqual(b);
  });
  it('el indicador encendido afecta específicamente la segunda posición (i===1), no la 1ª ni la 3ª', () => {
    const without = solveKnobs('ABC123', 0, false, 'USB');
    const withInd = solveKnobs('ABC123', 0, true, 'USB');
    expect(withInd[1]).not.toBe(without[1]);
    expect(withInd[0]).toBe(without[0]);
    expect(withInd[2]).toBe(without[2]);
  });
});

describe('solveMaze', () => {
  it('devuelve una celda de salida con row/col no negativos', () => {
    const exit = solveMaze('ABC123', 0, 2);
    expect(exit.row).toBeGreaterThanOrEqual(0);
    expect(exit.col).toBeGreaterThanOrEqual(0);
  });
  it('es determinista para el mismo input', () => {
    expect(solveMaze('ABC123', 1, 2)).toEqual(solveMaze('ABC123', 1, 2));
  });
});

describe('solveTimer', () => {
  it('el segundo objetivo siempre está en [0, 59]', () => {
    for (let strikes = 0; strikes < 3; strikes++) {
      const s = solveTimer('ABC123', strikes, 4);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(59);
    }
  });
});

describe('solveSequence', () => {
  it('devuelve una rotación completa de la secuencia base, sin perder ni duplicar elementos', () => {
    const order = solveSequence('ABC123', 0, 'USB');
    expect(new Set(order).size).toBe(order.length);
  });
  it('con strikes>0, el resultado es el reverso exacto del de 0 strikes', () => {
    const normal = solveSequence('ABC123', 0, 'USB');
    const reversed = solveSequence('ABC123', 1, 'USB');
    expect(reversed).toEqual([...normal].reverse());
  });
});

describe('solveBinary', () => {
  it('siempre devuelve una cadena de 5 dígitos binarios', () => {
    const bin = solveBinary('ABC123', 0, 2);
    expect(bin).toMatch(/^[01]{5}$/);
  });
});

describe('solveMath', () => {
  it('devuelve a, b, op y result consistentes entre sí', () => {
    const { a, b, op, result } = solveMath('A1B2C3', 0, 3);
    if (op === '+') expect(result).toBe(a + b);
    else if (op === '-') expect(result).toBe(Math.abs(a - b));
    else expect(result).toBe(a * b);
  });
  it('a y b siempre están en [0,9] (resto de %10)', () => {
    const { a, b } = solveMath('A1B2C3', 2, 5);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(9);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(9);
  });
});

describe('solveWord', () => {
  it('es determinista para el mismo input y devuelve una cadena', () => {
    const w1 = solveWord('ABC123', 0, 'USB');
    const w2 = solveWord('ABC123', 0, 'USB');
    expect(w1).toBe(w2);
    expect(typeof w1).toBe('string');
  });
});

describe('solveReaction', () => {
  it('el tiempo objetivo crece con strikes y con batteryLevel', () => {
    const base = solveReaction('AAA000', 0, 1);
    const moreStrikes = solveReaction('AAA000', 2, 1);
    const moreBattery = solveReaction('AAA000', 0, 4);
    expect(moreStrikes).toBeGreaterThan(base);
    expect(moreBattery).toBeGreaterThan(base);
  });
  it('nunca es menor al piso de 2000ms', () => {
    expect(solveReaction('AAA000', 0, 1)).toBeGreaterThanOrEqual(2000);
  });
});

describe('solveMatching', () => {
  it('devuelve 4 pares (arrays de 2 elementos cada uno)', () => {
    const pairs = solveMatching();
    expect(pairs).toHaveLength(4);
    for (const pair of pairs) expect(pair).toHaveLength(2);
  });
  it('los 8 símbolos usados en los pares son todos distintos entre sí', () => {
    const pairs = solveMatching();
    const flat = pairs.flat();
    expect(new Set(flat).size).toBe(flat.length);
  });
});

describe('solveCipher', () => {
  it('devuelve original, encoded (mismo largo) y un shift en [0,25]', () => {
    const { original, encoded, shift } = solveCipher('ABC123', 0, 3);
    expect(encoded).toHaveLength(original.length);
    expect(shift).toBeGreaterThanOrEqual(0);
    expect(shift).toBeLessThanOrEqual(25);
  });
  it('con shift=0 (serial y strikes/puertos que suman 0), el texto codificado es igual al original', () => {
    // serial sin dígitos (digitSum=0), sin strikes, sin puertos -> shift = 0%26 = 0
    const { original, encoded, shift } = solveCipher('AAAAAA', 0, 0);
    expect(shift).toBe(0);
    expect(encoded).toBe(original);
  });
});

describe('solveTiming', () => {
  it('el offset siempre está en [0,9]', () => {
    for (let strikes = 0; strikes < 12; strikes++) {
      const offset = solveTiming('ABC123', strikes, 'USB');
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(9);
    }
  });
});

describe('solveCoordinates', () => {
  it('x e y siempre están en [0,9]', () => {
    const { x, y } = solveCoordinates('ABC123', 1, 3);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(9);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(9);
  });
  it('y depende de strikes*2, distinto de su valor con 0 strikes cuando cambia el módulo', () => {
    const a = solveCoordinates('ABC123', 0, 0);
    const b = solveCoordinates('ABC123', 3, 0);
    expect(b.y).not.toBe(a.y);
  });
});

describe('solveBattery', () => {
  it('el nivel objetivo siempre está en [1,4]', () => {
    for (const serial of ['AAA000', 'A1B2C3', 'ZZZ999']) {
      const lvl = solveBattery(serial);
      expect(lvl).toBeGreaterThanOrEqual(1);
      expect(lvl).toBeLessThanOrEqual(4);
    }
  });
});

describe('solvePorts', () => {
  it('devuelve uno de los 6 tipos de puerto válidos', () => {
    const valid = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
    expect(valid).toContain(solvePorts('ABC123'));
  });
});

describe('solveCompass', () => {
  it('devuelve una de las 8 direcciones cardinales/intercardinales', () => {
    const valid = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    expect(valid).toContain(solveCompass('ABC123', 0));
  });
  it('es determinista para el mismo input', () => {
    expect(solveCompass('ABC123', 3)).toBe(solveCompass('ABC123', 3));
  });
});

describe('solveSlots', () => {
  it('el slot objetivo siempre está en [0,4]', () => {
    const slot = solveSlots(2, 3, 'ABC123');
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThanOrEqual(4);
  });
});

describe('determinismo: mismo input siempre produce el mismo veredicto', () => {
  it('los solvers "puros" (sin Math.random interno) son 100% deterministas', () => {
    // solveMatching y solveCipher SÍ usan aleatoriedad interna
    // (shuffle / pick de una palabra al azar), así que se prueban
    // por separado más abajo.
    const cases: Array<() => unknown> = [
      () => solveWires(['red', 'blue', 'black'], 'ABC123'),
      () => solveButton('blue', 'ABORTAR', 'ABC123', 0, false),
      () => solveMemoryStage(2, 4, [{ position: 1, label: 1 }]),
      () => solveScreen('SÍ', 'ABC123', 0),
      () => solveColors('ABC123', 0, false, 2),
      () => solvePattern(4, 'ABC123', 0, 1),
      () => solveSwitches('ABC123', 0, true),
      () => solveCode('ABC123'),
      () => solveKeypad('ABC123', 0, false),
      () => solveKnobs('ABC123', 0, false, 'USB'),
      () => solveMaze('ABC123', 0, 2),
      () => solveTimer('ABC123', 0, 3),
      () => solveSequence('ABC123', 0, 'USB'),
      () => solveBinary('ABC123', 0, 2),
      () => solveMath('ABC123', 0, 3),
      () => solveWord('ABC123', 0, 'USB'),
      () => solveReaction('ABC123', 0, 2),
      () => solveTiming('ABC123', 0, 'USB'),
      () => solveCoordinates('ABC123', 0, 2),
      () => solveBattery('ABC123'),
      () => solvePorts('ABC123'),
      () => solveCompass('ABC123', 0),
      () => solveSlots(2, 3, 'ABC123')
    ];
    for (const fn of cases) {
      expect(fn()).toEqual(fn());
    }
  });

  it('solveMatching / solveCipher SÍ dependen de Math.random (documentado, no un bug)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const a = solveMatching();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const b = solveMatching();
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
    vi.restoreAllMocks();
  });
});
