import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameConfig } from '../js/core/gameRegistry';

/**
 * Tests de humo para GameRegistry, en el mismo espíritu que
 * viewTemplates.test.ts: cerrar el hueco entre "compila" y "funciona en
 * runtime". El tipo GameConfig ya garantiza la forma de cada campo en
 * tiempo de compilación, pero no garantiza:
 *
 *  - que cada juego real se registre sin lanzar (efecto secundario al
 *    importar el módulo, fuera del alcance de tsc);
 *  - que los campos que lobbyRenderer.ts consume directamente para
 *    pintar las cards (tag, accent, num, description, difficulty) tengan
 *    valores no vacíos y dentro de rango — un string vacío o un
 *    `difficulty` fuera de 1..5 compila perfectamente pero rompe
 *    visualmente el lobby sin ningún error en consola;
 *  - que no haya dos juegos con el mismo id (Map los pisaría en
 *    silencio, con el último import ganando sin ningún aviso).
 *
 * Se importa js/games/index.ts, el barrel real que main.ts usa en
 * producción, para que este test corra contra el registro completo de
 * juegos reales (26 al momento de escribir esto, ver `games.length` más
 * abajo — el número cambia con cada juego agregado/quitado, por eso el
 * assert usa `toBeGreaterThan` en vez de un valor fijo) y no una lista
 * de mocks inventados a mano.
 */

/** Rango de dificultad que lobbyRenderer.ts asume al pintar los puntos (MAX_DIFFICULTY_DOTS = 5). */
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 5;

/**
 * IDs de vistas en js/core/viewTemplates.ts que intencionalmente NO
 * tienen juego registrado en GameRegistry: son pantallas informativas
 * (manual, configuración, estadísticas, progreso, ranking, cuenta) sin
 * lógica de juego propia. Documentado aquí para que una futura
 * desincronización real (un juego que debería estar y no está) se note
 * por comparación con esta lista conocida, en vez de perderse entre
 * "siempre fue así".
 *
 * Nota: 'estadisticas-avanzadas', 'logros', 'multiplayer',
 * 'personalizacion', 'social' y 'torneos' NO aparecen acá ni como
 * huérfanas: no tienen (ni deben tener) entrada en viewTemplates.ts en
 * absoluto, así que `orphanViews` (que solo recorre las keys de
 * viewTemplates.ts) nunca las va a encontrar. Estas 6 vistas de sistema
 * están registradas en GameRegistry como juegos ocultos (`hidden: true`,
 * vía registerSystemViews.ts) con su propio `init`/`stop` en
 * *.logic.ts, que inyecta su HTML directamente en el contenedor — sin
 * pasar por viewTemplates.ts. Antes tenían AMBAS cosas a la vez (una
 * entrada duplicada en viewTemplates.ts que inyectaba el mismo HTML que
 * su propio logic.ts volvía a inyectar después, pisándose entre sí),
 * lo cual dejaba el contenedor vacío para siempre tras la primera vez
 * que se salía y volvía a entrar a la vista (ver
 * GameRegistry.stopGame). El index.html correspondiente tampoco tiene
 * ya `data-lazy="1"` en estas 6 secciones, por la misma razón.
 */
const VIEWS_WITHOUT_GAME = ['configuracion', 'cuenta', 'estadisticas', 'manual', 'progreso', 'ranking'];

/**
 * IDs de juegos registrados en GameRegistry que intencionalmente NO
 * tienen entrada en viewTemplates.ts porque viven en su propia página
 * HTML standalone en vez de una sección data-lazy de index.html (ver
 * vite.config.ts para el patrón de entry point múltiple). Vacía por
 * ahora: el único caso que hubo, "radar" (radar.html), fue eliminado.
 */
const GAMES_WITHOUT_LAZY_VIEW: string[] = [];

describe('Contrato GameRegistry (juegos reales)', () => {
  let games: GameConfig[];

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';

    // Igual que en sidebarViews.test.ts: import dinámico DESPUÉS de
    // resetModules() para que GameRegistry y games/index.ts compartan la
    // misma instancia recién evaluada del singleton.
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    await import('../js/games/index');
    games = GameRegistry.all();
  });

  it('registra una cantidad sustancial de juegos sin lanzar', () => {
    // No un número exacto (se rompería con cada juego nuevo/quitado):
    // un umbral bajo detecta que el barrel casi no registró nada, sin
    // acoplar el test al conteo exacto de módulos del proyecto.
    expect(games.length).toBeGreaterThan(20);
  });

  it('ningún id se repite en el registro final (Map pisaría el juego anterior en silencio)', () => {
    // Nota: si dos módulos reales compartieran id, Map ya habría hecho el
    // "pisado" antes de que este test corra — GameRegistry.all() solo
    // vería el último. Esa colisión real se detecta indirectamente en el
    // test de "vistas huérfanas" de abajo (el juego pisado desaparece del
    // registro y su vista en viewTemplates.ts queda sin juego asociado,
    // fuera de la lista documentada). Este test cubre que, dado el
    // registro que sea, no haya sorpresas adicionales dentro de él.
    const ids = games.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(['id', 'name', 'tag', 'accent', 'icon', 'num', 'description'] as const)(
    'todos los juegos tienen "%s" no vacío',
    (field) => {
      for (const game of games) {
        expect(String(game[field] ?? '').trim(), `${game.id}.${field}`).not.toBe('');
      }
    }
  );

  it(`todos los juegos tienen difficulty entre ${MIN_DIFFICULTY} y ${MAX_DIFFICULTY}`, () => {
    for (const game of games) {
      expect(game.difficulty, game.id).toBeGreaterThanOrEqual(MIN_DIFFICULTY);
      expect(game.difficulty, game.id).toBeLessThanOrEqual(MAX_DIFFICULTY);
    }
  });

  it('todos los juegos exponen init y stop como funciones', () => {
    // Nota: para un juego migrado a `GameConfig.logic` (ver arrowGame.ts),
    // `init`/`stop` aquí son stubs que lanzan si se llaman directamente
    // — siguen siendo "funciones" a efectos de este test, que solo
    // verifica la forma del tipo. La prueba de que el camino `logic` se
    // resuelve de verdad y no cae en el stub vive en el siguiente test.
    for (const game of games) {
      expect(typeof game.init, game.id).toBe('function');
      expect(typeof game.stop, game.id).toBe('function');
    }
  });

  it('juegos migrados a GameConfig.logic: ensureInit resuelve la lógica real, no el stub directo', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: GameInstanceRegistry } = await import('../js/core/gameInstanceRegistry');

    const migratedGames = games.filter((g) => typeof g.logic === 'function');

    // Si este array queda vacío por error (p. ej. alguien revierte la
    // migración de arrow sin darse cuenta), el test de abajo pasaría
    // trivialmente sin verificar nada — este assert lo evita.
    expect(migratedGames.length, 'no hay ningún juego usando GameConfig.logic').toBeGreaterThan(0);

    for (const game of migratedGames) {
      document.body.innerHTML = `<div id="${game.id}"></div>`;

      // Si ensureInit llamara al stub directo en vez de resolver
      // `logic()`, el stub lanzaría (ver arrowGame.ts) y esto fallaría.
      await expect(GameRegistry.ensureInit(game.id), game.id).resolves.toBeUndefined();

      GameInstanceRegistry.clear(game.id);
    }
  }, 15000); // 15s timeout for initializing all games in sequence

  it('cada juego visible tiene su vista lazy correspondiente en viewTemplates (salvo las documentadas)', async () => {
    const { viewTemplates } = await import('../js/core/viewTemplates');
    const viewIds = new Set(Object.keys(viewTemplates));

    for (const game of games) {
      if (GAMES_WITHOUT_LAZY_VIEW.includes(game.id)) continue;
      expect(viewIds.has(game.id), `falta viewTemplates['${game.id}']`).toBe(true);
    }
  });

  it('las vistas sin juego son exactamente las documentadas (ninguna otra quedó huérfana)', async () => {
    const { viewTemplates } = await import('../js/core/viewTemplates');
    const gameIds = new Set(games.map((g) => g.id));

    const orphanViews = Object.keys(viewTemplates)
      .filter((id) => !gameIds.has(id))
      .sort();

    expect(orphanViews).toEqual([...VIEWS_WITHOUT_GAME].sort());
  });
});

describe('GameRegistry — comportamiento en runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('ensureInit llama a init() una sola vez y registra su stop()', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    document.body.innerHTML = '<div id="smoke-game"><button data-ui="start"></button></div>';

    const init = vi.fn();
    const stop = vi.fn();

    GameRegistry.register({
      id: 'smoke-game',
      name: 'Smoke Game',
      tag: 'TEST',
      accent: '#000',
      icon: '🧪',
      num: '00',
      description: 'juego sintético para el test de humo',
      difficulty: 1,
      init,
      stop,
    });

    await GameRegistry.ensureInit('smoke-game');
    await GameRegistry.ensureInit('smoke-game'); // idempotente: no debe volver a inicializar

    expect(init).toHaveBeenCalledTimes(1);

    GameRegistry.stopGame('smoke-game');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('con GameConfig.logic: resuelve el import() dinámico y solo lo importa una vez', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    document.body.innerHTML = '<div id="lazy-game"></div>';

    const init = vi.fn();
    const stop = vi.fn();
    const logic = vi.fn(async () => ({ init, stop }));

    GameRegistry.register({
      id: 'lazy-game',
      name: 'Lazy Game',
      tag: 'TEST',
      accent: '#000',
      icon: '💤',
      num: '00',
      description: 'juego con lógica cargada bajo demanda',
      difficulty: 1,
      // init/stop directos quedan sin usar cuando `logic` está presente
      // (ver prioridad documentada en GameConfig.logic); se dejan como
      // stubs solo porque el tipo los exige.
      init: () => {
        throw new Error('no debería llamarse: logic tiene prioridad');
      },
      stop: () => {
        throw new Error('no debería llamarse: logic tiene prioridad');
      },
      logic,
    });

    await GameRegistry.ensureInit('lazy-game');
    await GameRegistry.ensureInit('lazy-game'); // idempotente

    // El loader de `logic` solo debe resolverse una vez, no en cada
    // ensureInit — si esto falla en 2, el chunk lazy se está
    // reimportando en cada visita a la vista en vez de cachearse.
    expect(logic).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);

    GameRegistry.stopGame('lazy-game');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('un error dentro de init() no revienta el registro completo', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    document.body.innerHTML = '<div id="broken-game"></div>';

    GameRegistry.register({
      id: 'broken-game',
      name: 'Broken Game',
      tag: 'TEST',
      accent: '#000',
      icon: '💥',
      num: '00',
      description: 'juego que falla a propósito',
      difficulty: 1,
      init: () => {
        throw new Error('fallo intencional');
      },
      stop: () => {},
    });

    // ensureInit atrapa el error internamente (ver gameRegistry.ts) — no
    // debe propagarse ni dejar el registro en un estado roto.
    await expect(GameRegistry.ensureInit('broken-game')).resolves.not.toThrow();
    expect(GameRegistry.get('broken-game')).toBeDefined();
  });

  it('con GameConfig.logic: un error dentro del import() tampoco revienta el registro', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    document.body.innerHTML = '<div id="broken-lazy-game"></div>';

    GameRegistry.register({
      id: 'broken-lazy-game',
      name: 'Broken Lazy Game',
      tag: 'TEST',
      accent: '#000',
      icon: '💥',
      num: '00',
      description: 'juego cuyo import() dinámico falla a propósito',
      difficulty: 1,
      init: () => {},
      stop: () => {},
      logic: async () => {
        throw new Error('fallo intencional en el import() dinámico');
      },
    });

    await expect(GameRegistry.ensureInit('broken-lazy-game')).resolves.not.toThrow();
    expect(GameRegistry.get('broken-lazy-game')).toBeDefined();
  });
});

describe('GameRegistry.prefetch — precarga en hover/focus', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('dispara logic() pero NO llama a init() ni toca el DOM', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    // Deliberadamente sin <div id="prefetch-game">: si prefetch llamara
    // a resolveUi()/init() como ensureInit, este test lo notaría porque
    // no hay contenedor en el DOM al que enganchar data-ui.
    const init = vi.fn();
    const stop = vi.fn();
    const logic = vi.fn(async () => ({ init, stop }));

    GameRegistry.register({
      id: 'prefetch-game',
      name: 'Prefetch Game',
      tag: 'TEST',
      accent: '#000',
      icon: '⏩',
      num: '00',
      description: 'juego para verificar que prefetch no inicializa',
      difficulty: 1,
      init: () => { throw new Error('no debería llamarse desde prefetch'); },
      stop: () => { throw new Error('no debería llamarse desde prefetch'); },
      logic,
    });

    GameRegistry.prefetch('prefetch-game');

    // logic() es async — dejamos correr el microtask queue antes de
    // verificar que se disparó pero que init/stop siguen sin tocarse.
    await Promise.resolve();
    await Promise.resolve();

    expect(logic).toHaveBeenCalledTimes(1);
    expect(init).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('es idempotente: hover repetido no vuelve a invocar logic()', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    const logic = vi.fn(async () => ({ init: vi.fn(), stop: vi.fn() }));

    GameRegistry.register({
      id: 'prefetch-repeat',
      name: 'Prefetch Repeat',
      tag: 'TEST',
      accent: '#000',
      icon: '⏩',
      num: '00',
      description: 'hover múltiple sobre la misma card',
      difficulty: 1,
      init: () => {},
      stop: () => {},
      logic,
    });

    GameRegistry.prefetch('prefetch-repeat');
    GameRegistry.prefetch('prefetch-repeat');
    GameRegistry.prefetch('prefetch-repeat');
    await Promise.resolve();

    expect(logic).toHaveBeenCalledTimes(1);
  });

  it('ensureInit posterior reutiliza la promesa ya disparada por prefetch (no reimporta)', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    document.body.innerHTML = '<div id="prefetch-then-init"></div>';

    const init = vi.fn();
    const stop = vi.fn();
    const logic = vi.fn(async () => ({ init, stop }));

    GameRegistry.register({
      id: 'prefetch-then-init',
      name: 'Prefetch Then Init',
      tag: 'TEST',
      accent: '#000',
      icon: '⏩',
      num: '00',
      description: 'hover seguido de click real',
      difficulty: 1,
      init: () => { throw new Error('no debería llamarse: logic tiene prioridad'); },
      stop: () => { throw new Error('no debería llamarse: logic tiene prioridad'); },
      logic,
    });

    // Simula hover (prefetch) seguido del click real (ensureInit).
    GameRegistry.prefetch('prefetch-then-init');
    await GameRegistry.ensureInit('prefetch-then-init');

    // Si ensureInit no reutilizara la promesa cacheada por prefetch,
    // logic() se habría llamado 2 veces (una por cada uno).
    expect(logic).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('no-op silencioso para juegos sin GameConfig.logic (init/stop directos)', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    const init = vi.fn();
    const stop = vi.fn();

    GameRegistry.register({
      id: 'prefetch-no-logic',
      name: 'Prefetch No Logic',
      tag: 'TEST',
      accent: '#000',
      icon: '⏩',
      num: '00',
      description: 'juego sin logic, prefetch no debe hacer nada',
      difficulty: 1,
      init,
      stop,
    });

    expect(() => GameRegistry.prefetch('prefetch-no-logic')).not.toThrow();
    await Promise.resolve();

    expect(init).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('no-op para un id que no existe en el registro', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    expect(() => GameRegistry.prefetch('id-inexistente-xyz')).not.toThrow();
  });

  it('no vuelve a invocar logic() si el juego ya fue inicializado antes del hover', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    document.body.innerHTML = '<div id="already-init"></div>';

    const logic = vi.fn(async () => ({ init: vi.fn(), stop: vi.fn() }));

    GameRegistry.register({
      id: 'already-init',
      name: 'Already Init',
      tag: 'TEST',
      accent: '#000',
      icon: '⏩',
      num: '00',
      description: 'ya inicializado antes de cualquier hover',
      difficulty: 1,
      init: () => {},
      stop: () => {},
      logic,
    });

    await GameRegistry.ensureInit('already-init');
    expect(logic).toHaveBeenCalledTimes(1);

    // Un hover posterior sobre una card ya jugada no debe reimportar.
    GameRegistry.prefetch('already-init');
    await Promise.resolve();

    expect(logic).toHaveBeenCalledTimes(1);
  });

  it('un error en el import() durante prefetch no lanza y permite reintentar', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');

    let attempts = 0;
    const logic = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('fallo de red simulado');
      return { init: vi.fn(), stop: vi.fn() };
    });

    GameRegistry.register({
      id: 'prefetch-flaky',
      name: 'Prefetch Flaky',
      tag: 'TEST',
      accent: '#000',
      icon: '⏩',
      num: '00',
      description: 'primer intento de prefetch falla, el segundo funciona',
      difficulty: 1,
      init: () => {},
      stop: () => {},
      logic,
    });

    expect(() => GameRegistry.prefetch('prefetch-flaky')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(logic).toHaveBeenCalledTimes(1);

    // Tras el fallo, un segundo hover debe poder reintentar (la entrada
    // en el caché de promesas se limpia en el .catch() de prefetch).
    expect(() => GameRegistry.prefetch('prefetch-flaky')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(logic).toHaveBeenCalledTimes(2);
  });
});
