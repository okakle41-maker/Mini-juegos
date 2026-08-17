import { describe, expect, it } from 'vitest';
import {
  MODULE_FACTORIES,
  createBatteryModule,
  createBinaryModule,
  createButtonsModule,
  createCipherModule,
  createCodeModule,
  createColorsModule,
  createCompassModule,
  createCoordinatesModule,
  createFrequencyModule,
  createKeypadModule,
  createKnobsModule,
  createMathModule,
  createMatchingModule,
  createMazeModule,
  createMemoryModule,
  createMorseModule,
  createPasswordModule,
  createPatternModule,
  createPortsModule,
  createReactionModule,
  createScreenModule,
  createSequenceModule,
  createSimonModule,
  createSlotsModule,
  createSwitchesModule,
  createSymbolsModule,
  createTimerModule,
  createTimingModule,
  createWiresModule,
  createWordModule
} from '../js/games/bombdefusal.factories';
import type { BombState } from '../js/games/bombdefusal.types';

/**
 * test/bombdefusalFactories.test.ts
 *
 * `bombdefusal.factories.ts` (469 líneas) contiene las 31 funciones
 * `createXModule()` que generan el estado inicial de cada tipo de
 * módulo de la bomba, más `MODULE_FACTORIES` (el dispatch por
 * 'type'). Todas ya estaban exportadas y no dependen de DOM, pero no
 * tenían tests directos.
 *
 * El propio archivo fuente documenta un bug histórico ya corregido
 * (comentario sobre "strikes en vivo desincroniza la solución"): 19
 * de los 31 tipos deben congelar `data.strikesAtStart = bomb.strikes`
 * en el momento de creación, y su `getSolution()` debe usar ese valor
 * congelado, no `bomb.strikes` en vivo — de lo contrario un strike en
 * CUALQUIER OTRO módulo cambiaría silenciosamente la respuesta
 * correcta de este. Ese es el invariante que más vale la pena
 * verificar acá, junto con la forma general de cada módulo (`type`,
 * `solved: false` al nacer, `data` con las claves esperadas).
 */

function fakeBomb(overrides: Partial<BombState> = {}): BombState {
  return {
    playing: true,
    serial: 'A1B2C3',
    timeLeft: 300,
    totalTime: 300,
    strikes: 0,
    maxStrikes: 3,
    indicatorLit: false,
    modules: [],
    animMs: 500,
    role: 'defuser',
    buttonLight: false,
    batteryLevel: 2,
    portType: 'USB',
    portCount: 2,
    ...overrides
  };
}

describe('factories: forma inicial genérica', () => {
  it('todo módulo creado nace con solved: false', () => {
    expect(createWiresModule(2).solved).toBe(false);
    expect(createSymbolsModule().solved).toBe(false);
    expect(createBatteryModule().solved).toBe(false);
    expect(createButtonsModule(fakeBomb()).solved).toBe(false);
  });

  it('el `type` de cada módulo coincide con lo que espera MODULE_FACTORIES', () => {
    expect(createWiresModule(2).type).toBe('wires');
    expect(createButtonsModule(fakeBomb()).type).toBe('buttons');
    expect(createSymbolsModule().type).toBe('symbols');
    expect(createMemoryModule().type).toBe('memory');
    expect(createScreenModule(fakeBomb()).type).toBe('screen');
    expect(createFrequencyModule().type).toBe('frequency');
    expect(createColorsModule(fakeBomb()).type).toBe('colors');
    expect(createPatternModule(fakeBomb()).type).toBe('pattern');
    expect(createSwitchesModule(fakeBomb()).type).toBe('switches');
    expect(createCodeModule().type).toBe('code');
    expect(createKeypadModule(fakeBomb()).type).toBe('keypad');
    expect(createMorseModule().type).toBe('morse');
    expect(createPasswordModule().type).toBe('password');
    expect(createSimonModule(fakeBomb()).type).toBe('simon');
    expect(createKnobsModule(fakeBomb()).type).toBe('knobs');
    expect(createMazeModule(fakeBomb()).type).toBe('maze');
    expect(createTimerModule(fakeBomb()).type).toBe('timer');
    expect(createSequenceModule(fakeBomb()).type).toBe('sequence');
    expect(createBinaryModule(fakeBomb()).type).toBe('binary');
    expect(createMathModule(fakeBomb()).type).toBe('math');
    expect(createWordModule(fakeBomb()).type).toBe('word');
    expect(createReactionModule(fakeBomb()).type).toBe('reaction');
    expect(createMatchingModule().type).toBe('matching');
    expect(createCipherModule(fakeBomb()).type).toBe('cipher');
    expect(createTimingModule(fakeBomb()).type).toBe('timing');
    expect(createCoordinatesModule(fakeBomb()).type).toBe('coordinates');
    expect(createBatteryModule().type).toBe('battery');
    expect(createPortsModule().type).toBe('ports');
    expect(createCompassModule(fakeBomb()).type).toBe('compass');
    expect(createSlotsModule().type).toBe('slots');
  });
});

describe('factories: el bug de "strikes en vivo" no puede reaparecer (19 tipos afectados)', () => {
  it('buttons: getSolution usa strikesAtStart congelado, no bomb.strikes en vivo', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createButtonsModule(bomb);
    const solutionAtCreation = mod.getSolution(bomb);
    bomb.strikes = 2; // strike ocurre en OTRO módulo, después de crear este
    const solutionAfterStrike = mod.getSolution(bomb);
    expect(solutionAfterStrike).toEqual(solutionAtCreation);
  });

  it('screen: la pista mostrada sigue siendo válida aunque strikes cambie después de crear el módulo', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createScreenModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 3;
    const after = mod.getSolution(bomb);
    expect(after).toEqual(before);
  });

  it('colors: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createColorsModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('pattern: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createPatternModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('switches: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createSwitchesModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('keypad: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createKeypadModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('simon: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createSimonModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('knobs: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createKnobsModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('maze: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createMazeModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('timer: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createTimerModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('sequence: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createSequenceModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('binary: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createBinaryModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('math: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createMathModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('word: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createWordModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('reaction: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createReactionModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('cipher: el shift (que depende de strikesAtStart) permanece fijo aunque bomb.strikes mute después de la creación', () => {
    // A diferencia de los otros 18 tipos de esta sección, solveCipher
    // elige `original = pick(WORD_WORDS)` con Math.random en CADA
    // llamada a getSolution — por diseño, no por el bug de strikes en
    // vivo — así que `original`/`encoded` cambian entre invocaciones
    // sin importar strikesAtStart. Lo que sí debe permanecer
    // congelado es el `shift`, que es lo que depende de
    // data.strikesAtStart.
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createCipherModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    const after = mod.getSolution(bomb);
    expect(after.shift).toBe(before.shift);
  });

  it('timing: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createTimingModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('coordinates: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createCoordinatesModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });

  it('compass: no cambia de solución si bomb.strikes muta después de la creación', () => {
    const bomb = fakeBomb({ strikes: 0 });
    const mod = createCompassModule(bomb);
    const before = mod.getSolution(bomb);
    bomb.strikes = 1;
    expect(mod.getSolution(bomb)).toEqual(before);
  });
});

describe('factories: estructura de datos por módulo', () => {
  it('wires: genera entre 3 y 6 cables (5 con dificultad<4, 6 permitido con dificultad>=4), cutIndex null', () => {
    const mod = createWiresModule(2);
    expect(mod.data.wires.length).toBeGreaterThanOrEqual(3);
    expect(mod.data.wires.length).toBeLessThanOrEqual(5);
    expect(mod.data.cutIndex).toBeNull();

    const highDiff = createWiresModule(5);
    expect(highDiff.data.wires.length).toBeLessThanOrEqual(6);
  });

  it('symbols: 4 símbolos barajados, con "order" (la solución) fijo desde la creación', () => {
    const mod = createSymbolsModule();
    expect(mod.data.symbols).toHaveLength(4);
    expect(mod.data.order).toHaveLength(4);
    expect(mod.getSolution().order).toBe(mod.data.order);
  });

  it('memory: stage=1, display en [1,4], labels es una permutación de [0,1,2,3]', () => {
    const mod = createMemoryModule();
    expect(mod.data.stage).toBe(1);
    expect(mod.data.display).toBeGreaterThanOrEqual(1);
    expect(mod.data.display).toBeLessThanOrEqual(4);
    expect(mod.data.labels.slice().sort()).toEqual([0, 1, 2, 3]);
    expect(mod.data.history).toEqual([]);
  });

  it('frequency: labelA y labelB son siempre distintos entre sí', () => {
    for (let i = 0; i < 20; i++) {
      const mod = createFrequencyModule();
      expect(mod.data.labelA).not.toBe(mod.data.labelB);
    }
  });

  it('colors: 4 colores barajados, sin repetir', () => {
    const mod = createColorsModule(fakeBomb());
    expect(mod.data.colors).toHaveLength(4);
    expect(new Set(mod.data.colors).size).toBe(4);
  });

  it('pattern: litCount es 4, 5 o 6, y decoy tiene exactamente litCount celdas únicas', () => {
    for (let i = 0; i < 10; i++) {
      const mod = createPatternModule(fakeBomb());
      expect([4, 5, 6]).toContain(mod.data.litCount);
      expect(mod.data.decoy).toHaveLength(mod.data.litCount);
      expect(new Set(mod.data.decoy).size).toBe(mod.data.litCount);
    }
  });

  it('switches: 3 estados booleanos', () => {
    const mod = createSwitchesModule(fakeBomb());
    expect(mod.data.states).toHaveLength(3);
    for (const s of mod.data.states) expect(typeof s).toBe('boolean');
  });

  it('morse: options incluye la letra correcta entre 4 opciones sin duplicar', () => {
    const mod = createMorseModule();
    expect(mod.data.options).toHaveLength(4);
    expect(new Set(mod.data.options).size).toBe(4);
    expect(mod.data.options).toContain(mod.getSolution().letter);
  });

  it('password: exactamente 4 clues, y la solución está entre esas 4 (bug histórico corregido)', () => {
    for (let i = 0; i < 20; i++) {
      const mod = createPasswordModule();
      expect(mod.data.clues).toHaveLength(4);
      const bomb = fakeBomb();
      expect(mod.data.clues).toContain(mod.getSolution(bomb).password);
    }
  });

  it('simon: sequenceLength entre 4 y 6, arranca en step 0 sin secuencia del jugador', () => {
    const mod = createSimonModule(fakeBomb());
    expect(mod.data.sequenceLength).toBeGreaterThanOrEqual(4);
    expect(mod.data.sequenceLength).toBeLessThanOrEqual(6);
    expect(mod.data.step).toBe(0);
    expect(mod.data.playerSequence).toEqual([]);
  });

  it('matching: el tablero tiene 8 símbolos (4 pares) y coincide exactamente con getSolution().pairs', () => {
    const mod = createMatchingModule();
    expect(mod.data.board).toHaveLength(8);
    const { pairs } = mod.getSolution(fakeBomb());
    const boardSorted = mod.data.board.slice().sort();
    const pairsFlatSorted = pairs.flat().slice().sort();
    expect(boardSorted).toEqual(pairsFlatSorted);
  });

  it('compass: currentDirection es una de las 8 direcciones válidas', () => {
    const valid = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const mod = createCompassModule(fakeBomb());
    expect(valid).toContain(mod.data.currentDirection);
  });

  it('battery/ports/slots: nacen sin selección (null)', () => {
    expect(createBatteryModule().data.selectedLevel).toBeNull();
    expect(createPortsModule().data.selectedPort).toBeNull();
    expect(createSlotsModule().data.selectedSlot).toBeNull();
  });
});

describe('MODULE_FACTORIES: dispatch completo', () => {
  it('contiene exactamente los 31 tipos de módulo documentados', () => {
    const expectedTypes = [
      'wires', 'buttons', 'symbols', 'memory', 'screen', 'frequency', 'colors',
      'pattern', 'switches', 'code', 'keypad', 'morse', 'password', 'simon',
      'knobs', 'maze', 'timer', 'sequence', 'binary', 'math', 'word', 'reaction',
      'matching', 'cipher', 'timing', 'coordinates', 'battery', 'ports',
      'compass', 'slots'
    ];
    expect(Object.keys(MODULE_FACTORIES).sort()).toEqual(expectedTypes.sort());
  });

  it('cada factory registrada produce un módulo cuyo `type` coincide con su key en el dict', () => {
    const bomb = fakeBomb();
    for (const [key, factory] of Object.entries(MODULE_FACTORIES)) {
      const mod = factory(2, bomb);
      expect(mod.type).toBe(key);
    }
  });

  it('cada factory registrada produce un módulo con getSolution() ejecutable sin lanzar', () => {
    const bomb = fakeBomb();
    for (const factory of Object.values(MODULE_FACTORIES)) {
      const mod = factory(2, bomb);
      expect(() => mod.getSolution(bomb)).not.toThrow();
    }
  });

  it('llamar a la misma factory muchas veces nunca lanza (robustez ante distintas tiradas de dado)', () => {
    const bomb = fakeBomb();
    for (let i = 0; i < 5; i++) {
      for (const factory of Object.values(MODULE_FACTORIES)) {
        expect(() => factory(Math.floor(Math.random() * 6), bomb)).not.toThrow();
      }
    }
  });
});
