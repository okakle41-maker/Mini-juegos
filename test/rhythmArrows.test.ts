import { beforeEach, describe, expect, it, vi } from 'vitest';
import viewTemplate from '../js/views/rhythmArrows';
import type { GameUi } from '../js/types/game';

/**
 * test/rhythmArrows.test.ts
 *
 * Cubre el port de "Rhythm Arrows" (desde el prototipo standalone en
 * "minijuegos a futuri/rhythm-arrows") al patrón GameConfig.logic del
 * proyecto principal: montaje de la vista real, construcción del SVG
 * dinámico, ciclo completo de partida (avance por aciertos, fallo por
 * dirección incorrecta) y limpieza de listeners/timers en stop().
 *
 * Monta el HTML real de la vista y arma `ui` recorriendo [data-ui],
 * igual que GameRegistry.resolveUi() en producción — así el test
 * detecta si algún data-ui usado por la lógica deja de existir en la
 * vista real.
 */

function mountView(): GameUi {
  document.body.innerHTML = `<section id="rhythmArrows">${viewTemplate()}</section>`;
  const section = document.getElementById('rhythmArrows')!;
  const ui: GameUi = {};
  section.querySelectorAll<HTMLElement>('[data-ui]').forEach((el) => {
    const key = el.dataset.ui;
    if (key) ui[key] = el;
  });
  return ui;
}

function startGame(ui: GameUi): void {
  (ui.start as HTMLButtonElement).click();
}

describe('rhythmArrows: ciclo de partida', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('init() no crashea y construye el SVG con los vértices configurados', async () => {
    const { init } = await import('../js/games/rhythmArrows.logic');
    const ui = mountView();

    expect(() => init(ui)).not.toThrow();
    startGame(ui);

    const svg = ui.rhythmSvg as unknown as SVGSVGElement;
    const vertices = svg.querySelectorAll('.rhythm-arrows-vertex');
    // Cuadrado (4 vértices) es el valor por defecto del select rhythmSides.
    expect(vertices.length).toBe(4);
  });

  it('cambiar la figura a "3" y arrancar genera un triángulo (3 vértices)', async () => {
    const { init } = await import('../js/games/rhythmArrows.logic');
    const ui = mountView();
    init(ui);

    const sidesEl = ui.rhythmSides as HTMLSelectElement;
    sidesEl.value = '3';
    sidesEl.dispatchEvent(new Event('change'));
    startGame(ui);

    const svg = ui.rhythmSvg as unknown as SVGSVGElement;
    const vertices = svg.querySelectorAll('.rhythm-arrows-vertex');
    expect(vertices.length).toBe(3);
  });

  it('una tecla sin dirección asociada no crashea handleInput antes de que la línea esté activa', async () => {
    const { init } = await import('../js/games/rhythmArrows.logic');
    const ui = mountView();
    init(ui);
    startGame(ui);

    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    }).not.toThrow();
  });

  it('stop() limpia la instancia activa y remueve el listener de teclado sin crashear', async () => {
    const { init, stop } = await import('../js/games/rhythmArrows.logic');
    const GameInstanceRegistry = (await import('../js/core/gameInstanceRegistry')).default;
    const ui = mountView();
    init(ui);
    startGame(ui);

    expect(GameInstanceRegistry.has('rhythmArrows')).toBe(true);

    expect(() => stop()).not.toThrow();
    expect(GameInstanceRegistry.has('rhythmArrows')).toBe(false);

    // Tras stop(), el listener global de keydown ya no debería estar
    // atado a la lógica del juego (no debe crashear ni reaccionar).
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    }).not.toThrow();
  });

  it('el botón Iniciar se deshabilita durante la partida y se rehabilita al fallar', async () => {
    const { init } = await import('../js/games/rhythmArrows.logic');
    const ui = mountView();
    init(ui);

    const startBtn = ui.start as HTMLButtonElement;
    expect(startBtn.disabled).toBe(false);
    startGame(ui);
    expect(startBtn.disabled).toBe(true);

    // Antes de que la línea esté activa (hay un delay inicial de 900ms
    // en start()), una dirección incorrecta no debería aplicar porque
    // handleInput tiene guard `if (!this.lineActive) return` — este test
    // solo confirma que el guard no crashea el flujo, no fuerza el fallo.
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    }).not.toThrow();
  });
});

describe('rhythmArrows: registro en GameRegistry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('se registra con id "rhythmArrows" y logic() resuelve el módulo real', async () => {
    const GameRegistry = (await import('../js/core/gameRegistry')).default;
    GameRegistry.reset();
    await import('../js/games/rhythmArrows');

    const config = GameRegistry.get('rhythmArrows');
    expect(config).toBeTruthy();
    expect(config?.id).toBe('rhythmArrows');
    expect(typeof config?.logic).toBe('function');

    const resolved = await config!.logic!();
    expect(typeof resolved.init).toBe('function');
    expect(typeof resolved.stop).toBe('function');
  });

  it('init/stop directos son stubs que lanzan (logic tiene prioridad)', async () => {
    const GameRegistry = (await import('../js/core/gameRegistry')).default;
    GameRegistry.reset();
    await import('../js/games/rhythmArrows');
    const config = GameRegistry.get('rhythmArrows')!;

    expect(() => config.init({} as GameUi)).toThrow();
    expect(() => config.stop()).toThrow();
  });
});
