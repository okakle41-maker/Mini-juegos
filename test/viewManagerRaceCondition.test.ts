import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mockea GameRegistry.ensureInit para contar/registrar en qué orden se
 * inicializan los juegos, y viewTemplates para controlar manualmente
 * cuándo resuelve el import() dinámico de cada vista lazy — necesario
 * para poder reproducir la carrera "navegar a A, y antes de que A
 * termine de cargar, navegar a B" de forma determinística.
 */
const { ensureInit, stopGame } = vi.hoisted(() => ({
  ensureInit: vi.fn(async (_id: string) => {}),
  stopGame: vi.fn((_id: string) => {}),
}));

vi.mock('../js/core/gameRegistry', () => ({
  default: { ensureInit, stopGame },
}));

vi.mock('../js/backgroundManager', () => ({
  default: { onViewChange: vi.fn() },
}));

vi.mock('../js/utils/backButton', () => ({
  hydrateBackButtons: vi.fn(),
}));

describe('ViewManager: navegación rápida entre dos vistas lazy', () => {
  beforeEach(() => {
    vi.resetModules();
    ensureInit.mockClear();
    stopGame.mockClear();
    document.body.innerHTML = `
      <section id="gameA" class="view hidden" data-lazy="1"></section>
      <section id="gameB" class="view hidden" data-lazy="1"></section>
    `;
  });

  /**
   * Regresión: showView('A') dispara loadLazyView('A') (import()
   * asíncrono) y encadena `.then(initGame)` sin cancelación. Si el
   * usuario navega a B antes de que ese import() resuelva,
   * currentViewId ya pasó a 'B' — pero cuando la promesa de A
   * finalmente resuelve, initGame() para 'A' se ejecuta de todos
   * modos, llamando a GameRegistry.ensureInit('A') e inicializando
   * (rAF loops, listeners, timers) un juego que el usuario ya no está
   * viendo y que nadie va a detener con stopGame, porque stopGame solo
   * se dispara al ENTRAR a la siguiente vista, no al abandonar la
   * actual a mitad de una carga en curso.
   */
  it('no debe inicializar la vista A si el usuario ya navegó a B antes de que A terminara de cargar', async () => {
    let resolveA: (mod: { default: () => string }) => void;
    const pendingA = new Promise<{ default: () => string }>((resolve) => {
      resolveA = resolve;
    });

    vi.doMock('../js/core/viewTemplates', () => ({
      viewTemplates: {
        gameA: () => pendingA,
        gameB: () => Promise.resolve({ default: () => '<div data-ui="x"></div>' }),
      },
    }));

    const { default: ViewManager } = await import('../js/core/viewManager');

    // 1) Navega a A — el import() de su template queda pendiente.
    ViewManager.showView('gameA');

    // 2) Antes de que A resuelva, el usuario navega a B.
    ViewManager.showView('gameB');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(ViewManager.getCurrentView()).toBe('gameB');
    ensureInit.mockClear();

    // 3) Recién ahora resuelve el import() de A, que había quedado
    // pendiente desde el paso 1.
    resolveA!({ default: () => '<div data-ui="y"></div>' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // GameA no debería inicializarse: el usuario nunca llegó a verla
    // (navegó a B antes de que terminara de cargar).
    expect(ensureInit).not.toHaveBeenCalledWith('gameA');
  });

  /**
   * Regresión secundaria: antes, un segundo showView('A') mientras la
   * primera carga de 'A' seguía en curso (A→B→A rápido) veía
   * `loadingViews.has('A') === true` y retornaba de inmediato como si
   * ya hubiera terminado, disparando initGame() con el HTML todavía
   * sin hidratar. Ahora ambas navegaciones a 'A' comparten la misma
   * promesa en vuelo, así que la segunda espera a que el import()
   * real termine antes de inicializar.
   */
  it('una segunda navegación al mismo id mientras carga espera la promesa real, no inicializa con HTML vacío', async () => {
    let resolveA: (mod: { default: () => string }) => void;
    const pendingA = new Promise<{ default: () => string }>((resolve) => {
      resolveA = resolve;
    });
    let loadCount = 0;

    vi.doMock('../js/core/viewTemplates', () => ({
      viewTemplates: {
        gameA: () => {
          loadCount += 1;
          return pendingA;
        },
        gameB: () => Promise.resolve({ default: () => '<div data-ui="x"></div>' }),
      },
    }));

    const { default: ViewManager } = await import('../js/core/viewManager');

    ViewManager.showView('gameA');
    ViewManager.showView('gameB');
    ViewManager.showView('gameA'); // vuelve a A antes de que la carga original termine
    await Promise.resolve();
    await Promise.resolve();

    ensureInit.mockClear();
    resolveA!({ default: () => '<div data-ui="y"></div>' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // El template solo debe pedirse una vez (no una por cada
    // showView('gameA')), y gameA sí debe terminar inicializándose
    // porque es la vista donde el usuario quedó parado al final.
    expect(loadCount).toBe(1);
    expect(ensureInit).toHaveBeenCalledWith('gameA');
    expect(document.getElementById('gameA')?.innerHTML).toContain('data-ui="y"');
  });
});
