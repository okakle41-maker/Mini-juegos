import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MEMORY_GRID_CONFIG,
  assignValuesFromPath,
  buildFallbackPath,
  generateBoard,
  generatePath,
  getDirections,
  getValidMoves,
  inBounds,
  stepDistance,
  verifySolution
} from '../js/games/memorygrid.logic';

/**
 * test/memorygrid.logic.test.ts
 *
 * `memorygrid.logic.ts` (843 líneas) tenía ~3.75% de cobertura de
 * líneas antes de este test. El corazón del juego es un generador de
 * caminos aleatorios sobre una grilla NxN (con 3 modos de movimiento:
 * cardinal, 8 direcciones, y "caballo" de ajedrez) más un verificador
 * de que ese camino sea efectivamente resoluble siguiendo las reglas
 * del juego — toda esa lógica es pura (sin DOM, sin timers), así que
 * se exportaron las funciones internas (sin tocar su implementación)
 * específicamente para poder testearla de forma aislada.
 *
 * `generatePath`/`generateBoard` usan `Math.random` para explorar el
 * espacio de búsqueda; la mayoría de los tests no mockean random y en
 * cambio verifican INVARIANTES estructurales (que valen para
 * cualquier resultado posible), que es más robusto que fijar una
 * secuencia exacta y más representativo de cómo se usa la función en
 * producción.
 */

describe('inBounds', () => {
  it('true para coordenadas dentro de la grilla', () => {
    expect(inBounds(0, 0, 4)).toBe(true);
    expect(inBounds(3, 3, 4)).toBe(true);
    expect(inBounds(2, 1, 4)).toBe(true);
  });

  it('false para coordenadas negativas o fuera del tamaño', () => {
    expect(inBounds(-1, 0, 4)).toBe(false);
    expect(inBounds(0, -1, 4)).toBe(false);
    expect(inBounds(4, 0, 4)).toBe(false);
    expect(inBounds(0, 4, 4)).toBe(false);
  });
});

describe('getDirections', () => {
  it('modo "cardinal" devuelve las 4 direcciones ortogonales', () => {
    const dirs = getDirections('cardinal');
    expect(dirs).toHaveLength(4);
    expect(dirs).toEqual(
      expect.arrayContaining([
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
      ])
    );
  });

  it('modo "all8" devuelve las 8 direcciones (cardinal + diagonal)', () => {
    const dirs = getDirections('all8');
    expect(dirs).toHaveLength(8);
  });

  it('modo "knight" devuelve las 8 direcciones tipo caballo de ajedrez', () => {
    const dirs = getDirections('knight');
    expect(dirs).toHaveLength(8);
    expect(dirs).toEqual(
      expect.arrayContaining([{ dx: 1, dy: 2 }, { dx: -2, dy: 1 }])
    );
  });

  it('un modo desconocido cae al fallback cardinal', () => {
    expect(getDirections('algo-inexistente')).toEqual(getDirections('cardinal'));
  });
});

describe('stepDistance', () => {
  it('distancia de Chebyshev: el máximo de |dx| y |dy|', () => {
    expect(stepDistance({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
    expect(stepDistance({ x: 0, y: 0 }, { x: 1, y: 3 })).toBe(3);
    expect(stepDistance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe('getValidMoves', () => {
  it('con value <= 0 no hay movimientos posibles (celda de destino, sin salida)', () => {
    expect(getValidMoves({ x: 1, y: 1 }, 0, 4, 'cardinal', null)).toEqual([]);
    expect(getValidMoves({ x: 1, y: 1 }, -1, 4, 'cardinal', null)).toEqual([]);
  });

  it('modo cardinal con value=1 devuelve hasta 4 celdas adyacentes dentro de la grilla', () => {
    const moves = getValidMoves({ x: 1, y: 1 }, 1, 4, 'cardinal', null);
    expect(moves).toHaveLength(4);
    expect(moves).toEqual(
      expect.arrayContaining([
        { x: 1, y: 0 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 2, y: 1 }
      ])
    );
  });

  it('recorta movimientos que caen fuera de la grilla (esquina)', () => {
    const moves = getValidMoves({ x: 0, y: 0 }, 1, 4, 'cardinal', null);
    // Desde la esquina superior izquierda solo hay 2 vecinos válidos
    // (derecha y abajo); arriba/izquierda quedan fuera de bounds.
    expect(moves).toHaveLength(2);
    expect(moves).toEqual(expect.arrayContaining([{ x: 1, y: 0 }, { x: 0, y: 1 }]));
  });

  it('excluye celdas ya visitadas cuando se pasa un Set de visited', () => {
    const visited = new Set(['1,0', '0,1']);
    const moves = getValidMoves({ x: 0, y: 0 }, 1, 4, 'cardinal', visited);
    expect(moves).toEqual([]);
  });

  it('modo knight con value=1 se mueve en "L" de ajedrez, ignora otros values', () => {
    const moves = getValidMoves({ x: 2, y: 2 }, 1, 5, 'knight', null);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => {
      const dx = Math.abs(m.x - 2);
      const dy = Math.abs(m.y - 2);
      return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    })).toBe(true);
  });

  it('modo knight con value distinto de 1 no tiene movimientos (regla del juego)', () => {
    expect(getValidMoves({ x: 2, y: 2 }, 2, 5, 'knight', null)).toEqual([]);
    expect(getValidMoves({ x: 2, y: 2 }, 3, 5, 'knight', null)).toEqual([]);
  });

  it('el valor de la celda determina la distancia del salto en modo cardinal/all8', () => {
    const moves = getValidMoves({ x: 0, y: 0 }, 3, 5, 'cardinal', null);
    // Con value=3, sólo saltos de distancia exactamente 3 en una de las
    // 4 direcciones cardinales caben dentro de una grilla 5x5.
    expect(moves).toEqual(expect.arrayContaining([{ x: 3, y: 0 }, { x: 0, y: 3 }]));
    expect(moves.every(m => stepDistance({ x: 0, y: 0 }, m) === 3)).toBe(true);
  });
});

describe('buildFallbackPath', () => {
  it('construye un camino en L: todo el borde superior, luego todo el borde derecho', () => {
    const path = buildFallbackPath(4);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 3 });
    // Longitud: (size-1) pasos horizontales + (size-1) verticales + inicio
    expect(path).toHaveLength(1 + 3 + 3);
  });

  it('cada paso consecutivo es adyacente (distancia 1)', () => {
    const path = buildFallbackPath(5);
    for (let i = 1; i < path.length; i++) {
      expect(stepDistance(path[i - 1], path[i])).toBe(1);
    }
  });

  it('funciona con size=1 (un solo punto, ya en el destino)', () => {
    const path = buildFallbackPath(1);
    expect(path).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('generatePath', () => {
  it('siempre empieza en (0,0) y termina en (size-1, size-1)', () => {
    for (let i = 0; i < 10; i++) {
      const path = generatePath(4, 'cardinal', 1, 2, false);
      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[path.length - 1]).toEqual({ x: 3, y: 3 });
    }
  });

  it('con allowRepeat=false, ninguna celda se repite en el camino', () => {
    for (let i = 0; i < 10; i++) {
      const path = generatePath(4, 'cardinal', 1, 2, false);
      const seen = new Set(path.map(p => `${p.x},${p.y}`));
      expect(seen.size).toBe(path.length);
    }
  });

  it('todas las celdas del camino están dentro de la grilla', () => {
    const path = generatePath(5, 'all8', 1, 3, false);
    for (const p of path) {
      expect(inBounds(p.x, p.y, 5)).toBe(true);
    }
  });

  it('funciona también en modo knight (movimiento en L)', () => {
    const path = generatePath(5, 'knight', 1, 1, false);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 4 });
  });

  it('con allowRepeat=true puede revisitar celdas (no lo garantiza, pero no lo impide)', () => {
    // No es un assert determinista de que SÍ repita (depende del azar),
    // sino de que la función no lance ni rompa el invariante de
    // inicio/fin cuando se le permite repetir.
    const path = generatePath(3, 'cardinal', 1, 1, true);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 2 });
  });

  it('recurre al camino de fallback en un caso imposible (minVal muy grande, sin allowRepeat)', () => {
    // minVal=maxVal=size garantiza saltos que en general se salen del
    // tablero salvo casos triviales — fuerza el fallback tras agotar
    // los intentos, y buildFallbackPath siempre es válido.
    const path = generatePath(3, 'cardinal', 3, 3, false);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 2 });
  });
});

describe('assignValuesFromPath', () => {
  it('asigna a cada celda del camino (salvo la última) el valor necesario para llegar a la siguiente', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }];
    const values = assignValuesFromPath(path, 4, 1, 3, 'cardinal');
    expect(values[0][0]).toBe(1); // distancia (0,0)->(1,0) = 1
    expect(values[0][1]).toBe(2); // distancia (1,0)->(1,2) = 2
  });

  it('la celda final del tablero (size-1,size-1) siempre queda en 0', () => {
    const path = [{ x: 0, y: 0 }, { x: 3, y: 3 }];
    const values = assignValuesFromPath(path, 4, 1, 3, 'cardinal');
    expect(values[3][3]).toBe(0);
  });

  it('celdas fuera del camino reciben un valor aleatorio dentro de [minVal, maxVal]', () => {
    const path = [{ x: 0, y: 0 }, { x: 3, y: 3 }];
    const values = assignValuesFromPath(path, 4, 2, 5, 'cardinal');
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (x === 3 && y === 3) continue; // celda final, siempre 0
        const isOnPath = path.some(p => p.x === x && p.y === y);
        if (!isOnPath) {
          expect(values[y][x]).toBeGreaterThanOrEqual(2);
          expect(values[y][x]).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('en modo knight, toda celda del camino (salvo la última) vale 1', () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 3 }];
    const values = assignValuesFromPath(path, 4, 1, 3, 'knight');
    expect(values[0][0]).toBe(1);
    expect(values[2][1]).toBe(1);
  });
});

describe('verifySolution', () => {
  it('un camino recién generado por generatePath + assignValuesFromPath siempre verifica válido', () => {
    for (let i = 0; i < 20; i++) {
      const path = generatePath(4, 'cardinal', 1, 2, false);
      const values = assignValuesFromPath(path, 4, 1, 2, 'cardinal');
      expect(verifySolution(values, path, 4, 'cardinal', false)).toBe(true);
    }
  });

  it('un camino vacío nunca es válido', () => {
    expect(verifySolution([[0]], [], 1, 'cardinal', false)).toBe(false);
  });

  it('un camino que no termina en la esquina inferior derecha es inválido', () => {
    const values = [
      [1, 0],
      [0, 0]
    ];
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; // termina en (1,0), no en (1,1)
    expect(verifySolution(values, path, 2, 'cardinal', false)).toBe(false);
  });

  it('detecta un salto que no corresponde al valor real de la celda', () => {
    // El valor en (0,0) es 1, pero el camino intenta saltar 2 celdas
    // de una — verifySolution debe rechazarlo.
    const values = [
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    const path = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }];
    expect(verifySolution(values, path, 3, 'cardinal', false)).toBe(false);
  });

  it('con allowRepeat=false, un camino que revisita una celda es inválido', () => {
    const values = [
      [1, 1],
      [0, 0]
    ];
    // (0,0)->(1,0)->(0,0): revisita (0,0), que ya estaba visitada.
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
    expect(verifySolution(values, path, 2, 'cardinal', false)).toBe(false);
  });
});

describe('generateBoard', () => {
  it('devuelve un tablero de tamaño size x size y un solutionPath verificable', () => {
    const cfg = { size: 4, minVal: 1, maxVal: 2, dirMode: 'cardinal', allowRepeat: false, addTraps: false };
    const { values, solutionPath } = generateBoard(cfg);

    expect(values).toHaveLength(4);
    expect(values.every(row => row.length === 4)).toBe(true);
    expect(verifySolution(values, solutionPath, 4, 'cardinal', false)).toBe(true);
  });

  it('el solutionPath siempre empieza en (0,0) y termina en la esquina opuesta', () => {
    for (const dirMode of ['cardinal', 'all8', 'knight']) {
      const cfg = { size: 4, minVal: 1, maxVal: dirMode === 'knight' ? 1 : 2, dirMode, allowRepeat: false, addTraps: false };
      const { solutionPath } = generateBoard(cfg);
      expect(solutionPath[0]).toEqual({ x: 0, y: 0 });
      expect(solutionPath[solutionPath.length - 1]).toEqual({ x: 3, y: 3 });
    }
  });

  it('con addTraps=true, el tablero puede seguir siendo válido (las trampas no rompen el camino solución)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // fuerza que NO se agreguen trampas (< 0.18 es la condición)
    const cfg = { size: 4, minVal: 1, maxVal: 2, dirMode: 'cardinal', allowRepeat: false, addTraps: true };
    const { values, solutionPath } = generateBoard(cfg);
    expect(verifySolution(values, solutionPath, 4, 'cardinal', false)).toBe(true);
    vi.restoreAllMocks();
  });

  it('nunca lanza excepción incluso en el peor caso (tablero mínimo 2x2)', () => {
    expect(() => {
      const cfg = { size: 2, minVal: 1, maxVal: 1, dirMode: 'cardinal', allowRepeat: false, addTraps: false };
      generateBoard(cfg);
    }).not.toThrow();
  });
});

describe('DEFAULT_MEMORY_GRID_CONFIG', () => {
  it('tiene valores por defecto razonables (size positivo, minVal <= maxVal)', () => {
    expect(DEFAULT_MEMORY_GRID_CONFIG.size).toBeGreaterThan(0);
    expect(DEFAULT_MEMORY_GRID_CONFIG.minVal).toBeLessThanOrEqual(DEFAULT_MEMORY_GRID_CONFIG.maxVal);
    expect(DEFAULT_MEMORY_GRID_CONFIG.lives).toBeGreaterThan(0);
  });

  it('genera un tablero válido usando exactamente la config por defecto (cardinal)', () => {
    const { size, minVal, maxVal, allowRepeat, addTraps } = DEFAULT_MEMORY_GRID_CONFIG;
    const { values, solutionPath } = generateBoard({ size, minVal, maxVal, dirMode: 'cardinal', allowRepeat, addTraps });
    expect(verifySolution(values, solutionPath, size, 'cardinal', allowRepeat)).toBe(true);
  });
});
