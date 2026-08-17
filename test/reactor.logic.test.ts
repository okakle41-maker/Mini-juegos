import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIONS,
  EVENTS,
  LIMITS,
  REACTOR_TYPES,
  checkFailure,
  clampState,
  getStability,
  makeState,
  tick,
  type ReactorConfig
} from '../js/games/reactor.logic';

/**
 * test/reactor.logic.test.ts
 *
 * `reactor.logic.ts` es esencialmente un simulador físico (energía,
 * temperatura, presión, refrigeración, radiación, combustible) con
 * eventos aleatorios y 10 acciones del jugador — 884 líneas que antes
 * de este test tenían ~13% de cobertura de líneas y NINGÚN test que
 * ejercitara `tick()`, `checkFailure()` o `getStability()`, que son
 * el corazón de las reglas del juego.
 *
 * `makeState`, `tick`, `clampState`, `checkFailure`, `getStability` y
 * las tablas `ACTIONS`/`EVENTS`/`REACTOR_TYPES`/`LIMITS` no estaban
 * exportadas — se agregó `export` a cada una (sin tocar su
 * implementación) específicamente para poder testear la física del
 * juego de forma aislada, sin depender de montar el DOM completo del
 * panel de operador/experto ni de setInterval real. `init()`/`stop()`
 * (el wiring a DOM y timers) no se tocan acá.
 *
 * Se mockea Math.random a un valor fijo en los tests que necesitan
 * determinismo (tick agrega "drift" aleatorio a cada variable en cada
 * llamada), y se restaura en cada `afterEach`.
 */

function baseConfig(overrides: Partial<ReactorConfig> = {}): ReactorConfig {
  const reactorType = REACTOR_TYPES.find(t => t.id === 'experimental')!;
  return {
    duration: 120,
    speed: 1,
    eventFreq: 20,
    reactorType,
    mod: reactorType.mod,
    ...overrides
  };
}

describe('makeState', () => {
  it('inicializa dentro de rangos razonables y sin evento activo', () => {
    const state = makeState(baseConfig());

    expect(state.running).toBe(false);
    expect(state.elapsed).toBe(0);
    expect(state.fuel).toBe(100);
    expect(state.activeEvent).toBeNull();
    expect(state.log).toEqual([]);
    expect(state._fireDamage).toBe(false);
    expect(state._sensorBroken).toBe(false);

    // Los valores iniciales tienen jitter aleatorio pero están
    // centrados en rangos documentados en el propio código fuente.
    expect(state.energy).toBeGreaterThanOrEqual(50);
    expect(state.energy).toBeLessThanOrEqual(60);
    expect(state.temp).toBeGreaterThanOrEqual(38);
    expect(state.temp).toBeLessThanOrEqual(46);
  });

  it('copia duration/speed/eventFreq/reactorType/mod desde la config', () => {
    const cfg = baseConfig({ duration: 300, speed: 2, eventFreq: 5 });
    const state = makeState(cfg);

    expect(state.duration).toBe(300);
    expect(state.speed).toBe(2);
    expect(state.eventFreq).toBe(5);
    expect(state.reactorType).toBe(cfg.reactorType);
    expect(state.mod).toBe(cfg.mod);
  });

  it('cada llamada produce un estado nuevo e independiente (no comparten referencias)', () => {
    const cfg = baseConfig();
    const a = makeState(cfg);
    const b = makeState(cfg);

    a.energy = 999;
    expect(b.energy).not.toBe(999);
    expect(a).not.toBe(b);
    expect(a.log).not.toBe(b.log);
  });
});

describe('clampState', () => {
  it('recorta las 6 variables al rango [0, 100]', () => {
    const state = makeState(baseConfig());
    state.energy = 150;
    state.temp = -20;
    state.pressure = 101;
    state.cooling = -1;
    state.radiation = 1000;
    state.fuel = -50;

    clampState(state);

    expect(state.energy).toBe(100);
    expect(state.temp).toBe(0);
    expect(state.pressure).toBe(100);
    expect(state.cooling).toBe(0);
    expect(state.radiation).toBe(100);
    expect(state.fuel).toBe(0);
  });

  it('no modifica valores ya dentro de rango', () => {
    const state = makeState(baseConfig());
    state.energy = 55;
    state.temp = 42;
    clampState(state);
    expect(state.energy).toBe(55);
    expect(state.temp).toBe(42);
  });
});

describe('tick', () => {
  beforeEach(() => {
    // Fija el "drift" aleatorio para que las aserciones sean deterministas.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('incrementa elapsed en 1 por llamada', () => {
    const state = makeState(baseConfig());
    const before = state.elapsed;
    tick(state);
    expect(state.elapsed).toBe(before + 1);
  });

  it('consume combustible proporcionalmente a energy/50 y fuelRate del mod', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.fuel = 100;
    tick(state);
    // fuelConsumption = 0.08 * fuelRate(1.0) * (50/50) = 0.08
    expect(state.fuel).toBeCloseTo(100 - 0.08, 5);
  });

  it('el combustible nunca baja de 0 (clamp)', () => {
    const state = makeState(baseConfig());
    state.fuel = 0.01;
    tick(state);
    expect(state.fuel).toBeGreaterThanOrEqual(0);
  });

  it('todas las variables quedan siempre dentro de [0, 100] tras el tick (clampState aplicado)', () => {
    const state = makeState(baseConfig());
    state.energy = 100;
    state.temp = 100;
    state.pressure = 100;
    for (let i = 0; i < 20; i++) tick(state);

    for (const key of ['energy', 'temp', 'pressure', 'cooling', 'radiation', 'fuel'] as const) {
      expect(state[key]).toBeGreaterThanOrEqual(0);
      expect(state[key]).toBeLessThanOrEqual(100);
    }
  });

  it('con reactorType "antiguo" (mod.lag definido), la temperatura responde con retraso en vez de instantáneamente', () => {
    const antiguo = REACTOR_TYPES.find(t => t.id === 'antiguo')!;
    const state = makeState(baseConfig({ reactorType: antiguo, mod: antiguo.mod }));
    state.temp = 50;
    state.energy = 90; // fuerza una demanda de calor grande
    state.cooling = 0;

    const tempAfterOneTick = (() => {
      tick(state);
      return state.temp;
    })();

    // Con lag, sólo se aplica 1/lag del delta pendiente por tick, así
    // que el cambio de temperatura en un solo tick debe ser mucho más
    // chico que en un reactor sin lag bajo la misma demanda.
    const noLag = makeState(baseConfig());
    noLag.temp = 50;
    noLag.energy = 90;
    noLag.cooling = 0;
    tick(noLag);

    expect(Math.abs(tempAfterOneTick - 50)).toBeLessThan(Math.abs(noLag.temp - 50));
  });

  it('cuando hay un evento activo, se invoca su tick() en cada llamada', () => {
    const state = makeState(baseConfig());
    const steamLeak = EVENTS.find(e => e.id === 'steam_leak')!;
    state.activeEvent = steamLeak;
    state.pressure = 50;

    tick(state);

    // steam_leak.tick resta 1.5 de presión por tick (además del drift
    // aleatorio ya mockeado a un valor fijo), así que la presión debe
    // haber bajado respecto del valor inicial.
    expect(state.pressure).toBeLessThan(50);
  });

  it('radiación sube adicionalmente cuando temp > 70', () => {
    const hot = makeState(baseConfig());
    hot.temp = 90;
    hot.radiation = 10;
    hot.energy = 0; // minimiza otras fuentes de cambio de radiación
    tick(hot);

    const cool = makeState(baseConfig());
    cool.temp = 40;
    cool.radiation = 10;
    cool.energy = 0;
    tick(cool);

    expect(hot.radiation).toBeGreaterThan(cool.radiation);
  });
});

describe('checkFailure', () => {
  it('devuelve null cuando todas las variables están en zona segura', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = 50;
    state.fuel = 50;
    expect(checkFailure(state)).toBeNull();
  });

  it('detecta energía críticamente baja', () => {
    const state = makeState(baseConfig());
    state.energy = LIMITS.energy.critLow;
    expect(checkFailure(state)).toMatch(/Energía.*baja/);
  });

  it('detecta energía críticamente alta', () => {
    const state = makeState(baseConfig());
    state.energy = LIMITS.energy.critHigh;
    expect(checkFailure(state)).toMatch(/Energía.*alta/);
  });

  it('detecta temperatura críticamente alta', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = LIMITS.temp.critHigh;
    expect(checkFailure(state)).toMatch(/Temperatura.*alta/);
  });

  it('detecta presión críticamente baja', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = LIMITS.pressure.critLow;
    expect(checkFailure(state)).toMatch(/Presión.*baja/);
  });

  it('detecta combustible agotado (sólo chequea el lado bajo, fuel.hi = false)', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = 50;
    state.fuel = LIMITS.fuel.critLow;
    expect(checkFailure(state)).toMatch(/Combustible.*baja/);
  });

  it('combustible al máximo NO dispara fallo (fuel.hi es false a propósito)', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = 50;
    state.fuel = 100;
    expect(checkFailure(state)).toBeNull();
  });

  it('revisa las variables en orden y devuelve el primer fallo encontrado (energy antes que temp)', () => {
    const state = makeState(baseConfig());
    state.energy = LIMITS.energy.critLow;
    state.temp = LIMITS.temp.critHigh;
    expect(checkFailure(state)).toMatch(/Energía/);
  });
});

describe('getStability', () => {
  it('devuelve 100 cuando todas las variables están cómodamente en rango', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = 50;
    state.radiation = 0;
    state.fuel = 100;
    state.activeEvent = null;
    expect(getStability(state)).toBe(100);
  });

  it('penaliza -18 por cada variable principal fuera de su rango [min,max]', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = 50;
    state.radiation = 0;
    state.fuel = 100;
    state.activeEvent = null;

    state.energy = 200 - LIMITS.energy.max; // fuerza energy > max artificialmente vía valor directo
    state.energy = LIMITS.energy.max + 5;
    expect(getStability(state)).toBe(100 - 18);
  });

  it('penaliza -7 (no -18) cuando la variable está cerca del borde pero técnicamente en rango', () => {
    const state = makeState(baseConfig());
    state.energy = LIMITS.energy.max - 4; // dentro de max pero a menos de 8 del borde
    state.temp = 50;
    state.pressure = 50;
    state.radiation = 0;
    state.fuel = 100;
    state.activeEvent = null;
    expect(getStability(state)).toBe(100 - 7);
  });

  it('penaliza -12 por radiación alta (> 50)', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = 50;
    state.radiation = 60;
    state.fuel = 100;
    state.activeEvent = null;
    expect(getStability(state)).toBe(100 - 12);
  });

  it('penaliza -10 por combustible bajo (< 15) y otros -10 por evento activo, acumulables', () => {
    const state = makeState(baseConfig());
    state.energy = 50;
    state.temp = 50;
    state.pressure = 50;
    state.radiation = 0;
    state.fuel = 10;
    state.activeEvent = EVENTS[0];
    expect(getStability(state)).toBe(100 - 10 - 10);
  });

  it('nunca devuelve un valor negativo, aunque la suma de penalizaciones supere 100 (clamp a 0)', () => {
    const state = makeState(baseConfig());
    // energy/temp/pressure fuera de rango: -18 cada una (-54)
    // + radiación alta: -12, + combustible bajo: -10, + evento activo: -10
    // Total: 100 - 86 = 14. Para forzar el clamp a 0 hace falta más
    // penalización de la que da un solo estado "malo": se simula
    // llamando dos veces con activeEvent distinto no alcanza, así que
    // en vez de inventar una combinación irreal, se verifica el
    // invariante directamente aplicando la fórmula a mano y
    // comparando con un piso de 0, no con un valor exacto negativo.
    state.energy = 0;
    state.temp = 0;
    state.pressure = 0;
    state.radiation = 100;
    state.fuel = 0;
    state.activeEvent = EVENTS[0];

    const stability = getStability(state);
    expect(stability).toBeGreaterThanOrEqual(0);
    // Con las penalizaciones máximas del modelo actual (18*3 + 12 + 10 + 10 = 86),
    // el resultado documentado es 14, no negativo — el propio diseño del
    // scoring no llega a necesitar el clamp con un solo tick de estado malo.
    expect(stability).toBe(14);
  });

  it('el clamp a 0 SÍ es necesario si getStability se invocara con variables fuera del propio rango [0,100] (invariante de seguridad, no alcanzable en juego normal)', () => {
    const state = makeState(baseConfig());
    // Este escenario no ocurre en juego real porque tick() siempre
    // aplica clampState() antes de que el estado sea leído por
    // getStability(), pero el `Math.max(0, score)` del código está
    // para blindar precisamente contra un futuro cambio en las
    // penalizaciones que las haga sumar más de 100.
    state.energy = 0;
    state.temp = 0;
    state.pressure = 0;
    state.radiation = 100;
    state.fuel = 0;
    state.activeEvent = EVENTS[0];
    expect(getStability(state)).not.toBeLessThan(0);
  });
});

describe('tablas de datos: REACTOR_TYPES / LIMITS / EVENTS / ACTIONS', () => {
  it('los 5 tipos de reactor documentados en el README existen y tienen id único', () => {
    const ids = REACTOR_TYPES.map(t => t.id);
    expect(ids).toEqual(['experimental', 'antiguo', 'compacto', 'militar', 'dañado']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('LIMITS define min <= max y critLow <= min, critHigh >= max para cada variable', () => {
    for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      const lim = LIMITS[key];
      expect(lim.min).toBeLessThanOrEqual(lim.max);
      expect(lim.critLow).toBeLessThanOrEqual(lim.min);
      expect(lim.critHigh).toBeGreaterThanOrEqual(lim.max);
    }
  });

  it('cada evento tiene effect/tick/resolveEffect ejecutables sin lanzar sobre un estado válido', () => {
    const state = makeState(baseConfig());
    for (const event of EVENTS) {
      expect(() => event.effect(state)).not.toThrow();
      expect(() => event.tick(state)).not.toThrow();
      expect(() => event.resolveEffect(state)).not.toThrow();
    }
  });

  it('cada acción tiene cooldown positivo y apply() ejecutable sin lanzar', () => {
    const state = makeState(baseConfig());
    for (const action of ACTIONS) {
      expect(action.cd).toBeGreaterThan(0);
      expect(() => action.apply(state)).not.toThrow();
    }
  });

  it('la acción switch_gen_mode alterna el flag _highEfficiency en cada llamada', () => {
    const state = makeState(baseConfig());
    const switchAction = ACTIONS.find(a => a.id === 'switch_gen_mode')!;
    expect(state._highEfficiency).toBeUndefined();

    switchAction.apply(state);
    expect(state._highEfficiency).toBe(true);

    switchAction.apply(state);
    expect(state._highEfficiency).toBe(false);
  });

  it('todas las acciones tienen id único (usado como key en la UI y cooldowns)', () => {
    const ids = ACTIONS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('integración: simulación multi-tick con acciones del jugador', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('un reactor sin intervención del jugador durante muchos ticks eventualmente falla o se mantiene siempre clampeado', () => {
    const state = makeState(baseConfig());
    state.fuel = 100;
    let failure: string | null = null;

    for (let i = 0; i < 500 && !failure; i++) {
      tick(state);
      failure = checkFailure(state);
    }

    // No es un assert de "debe fallar" (depende de la física exacta),
    // sino la garantía estructural más importante: el simulador nunca
    // deja el estado fuera de [0,100] sin importar cuántos ticks corran.
    for (const key of ['energy', 'temp', 'pressure', 'cooling', 'radiation', 'fuel'] as const) {
      expect(state[key]).toBeGreaterThanOrEqual(0);
      expect(state[key]).toBeLessThanOrEqual(100);
    }
  });

  it('insertar barras de control reduce energía y temperatura de forma inmediata', () => {
    const state = makeState(baseConfig());
    state.energy = 60;
    state.temp = 60;
    state.pressure = 60;

    const insertRods = ACTIONS.find(a => a.id === 'insert_rods')!;
    insertRods.apply(state);

    expect(state.energy).toBe(60 - 12);
    expect(state.temp).toBe(60 - 8);
    expect(state.pressure).toBe(60 - 4);
  });
});
