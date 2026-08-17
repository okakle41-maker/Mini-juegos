import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameUi } from '../js/types/game';

/**
 * test/simon.logic.test.ts
 *
 * `simon.logic.ts` (365 líneas) tenía ~4% de cobertura de líneas antes
 * de este test — cero tests ejercitaban la mecánica real del juego
 * (generar secuencia, detectar acierto/fallo, avanzar de ronda,
 * terminar el juego, atajos de teclado). Se mockea `lobbySystem` sin
 * match activo (currentMatch: null) para correr el juego en modo
 * single-player puro, sin la complejidad de sincronización 1v1 — esa
 * parte ya la cubre test/multiplayerSplitViewHostStart.test.ts por
 * separado.
 *
 * Se monta la vista real (js/views/simon.ts) y se resuelve `ui` de la
 * misma forma que GameRegistry.resolveUi() en producción, siguiendo el
 * patrón ya usado en test/arrowGameFlashButton.test.ts.
 */

vi.mock('../js/lobbySystem', () => {
  return {
    lobbySystem: {
      getCurrentMatch: () => null,
      currentPlayerId: () => 'player-1',
      sendGameEvent: vi.fn(async () => {}),
      completeMatch: vi.fn(async () => {}),
      leaveCurrentMatch: vi.fn(async () => {})
    }
  };
});

vi.mock('../js/audioManager', () => ({
  default: { play: vi.fn() }
}));

async function mountRealSimonView(): Promise<GameUi> {
  const { default: viewTemplate } = await import('../js/views/simon');
  document.body.innerHTML = `<section id="simon">${viewTemplate()}</section>`;
  const section = document.getElementById('simon')!;
  const ui: GameUi = {};
  section.querySelectorAll<HTMLElement>('[data-ui]').forEach((el) => {
    const key = el.dataset.ui;
    if (key) ui[key] = el;
  });
  return ui;
}

function setConfig(ui: GameUi, opts: { colorCount?: number; baseLength?: number; speed?: number; rounds?: number }) {
  if (opts.colorCount !== undefined) (ui.colorCount as HTMLSelectElement).value = String(opts.colorCount);
  if (opts.baseLength !== undefined) (ui.baseLength as HTMLInputElement).value = String(opts.baseLength);
  if (opts.speed !== undefined) (ui.simonSpeed as HTMLInputElement).value = String(opts.speed);
  if (opts.rounds !== undefined) (ui.simonRounds as HTMLInputElement).value = String(opts.rounds);
}

function getBoardButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.simon-button'));
}

function pressColor(color: string) {
  const btn = document.querySelector<HTMLButtonElement>(`[data-color="${color}"]`);
  if (!btn) throw new Error(`No se encontró el botón de color ${color}`);
  btn.click();
}

/** Avanza el reloj falso en pasos pequeños en vez de un solo salto
 * grande: playSimonSequence() reagenda un nuevo setTimeout dentro de
 * cada callback (recursión con setTimeout), y un solo
 * advanceTimersByTimeAsync(N) grande no siempre re-dispara todos los
 * timers encadenados que se van creando durante el propio avance. */
async function advanceInSteps(totalMs: number, stepMs = 10): Promise<void> {
  let remaining = totalMs;
  while (remaining > 0) {
    const step = Math.min(stepMs, remaining);
    await vi.advanceTimersByTimeAsync(step);
    remaining -= step;
  }
}

describe('simon.logic: configuración inicial y tablero', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('crea tantos botones como colorCount indica, con data-color único cada uno', async () => {
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4 });
    init(ui);

    (ui.start as HTMLButtonElement).click();

    const buttons = getBoardButtons();
    expect(buttons.length).toBe(4);
    const colors = buttons.map(b => b.dataset.color);
    expect(new Set(colors).size).toBe(4);
  });

  it('acepta el máximo de colores permitido por el <select> (6) sin recortarlo', async () => {
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 6 });
    init(ui);
    (ui.start as HTMLButtonElement).click();
    expect(getBoardButtons().length).toBe(6);
  });

  it('un valor de colorCount inválido/vacío cae al fallback de 4 colores (parseInt NaN || 4)', async () => {
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    init(ui);
    // Fuerza un value fuera de las <option> del <select>; en jsdom (y
    // en un navegador real) esto deja el <select> sin selección válida
    // (value === ''), así que beginSimonGame() cae al `|| 4` de
    // parseInt(value, 10) || 4 en vez de al Math.min/Math.max de arriba.
    (ui.colorCount as HTMLSelectElement).value = '999';
    (ui.start as HTMLButtonElement).click();
    expect(getBoardButtons().length).toBe(4);
  });

  it('la longitud de la primera secuencia coincide con baseLength configurado', async () => {
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4, baseLength: 5, speed: 200 });
    init(ui);
    (ui.start as HTMLButtonElement).click();

    // playSimonSequence reproduce con setTimeout(speed) entre pasos;
    // avanzamos el reloj falso lo suficiente para que termine de
    // reproducirse toda la secuencia y quede en turno del jugador.
    await advanceInSteps(500 + 200 * 6 + 1000);

    const info = ui.info as HTMLElement;
    expect(info.textContent).toMatch(/Tu turno: reproduce la secuencia de 5 colores/);
  });
});

describe('simon.logic: jugar una ronda', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('presionar la secuencia correcta completa la ronda y avanza a la siguiente', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // siempre elige colors[0] ("red" con colorCount>=1)
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4, baseLength: 2, speed: 100, rounds: 3 });
    init(ui);
    (ui.start as HTMLButtonElement).click();

    // Deja que termine de reproducirse la secuencia (2 colores).
    await advanceInSteps(500 + 100 * 3 + 1000);

    // Con Math.random mockeado a 0, la secuencia generada es siempre
    // el primer color de la lista: 'red'.
    pressColor('red');
    await vi.advanceTimersByTimeAsync(0);
    pressColor('red');
    await vi.advanceTimersByTimeAsync(0);

    const info = ui.info as HTMLElement;
    expect(info.textContent).toMatch(/Correcto\. Preparando siguiente ronda/);
  });

  it('presionar un color incorrecto termina el juego inmediatamente', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // secuencia esperada: 'red'
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4, baseLength: 2, speed: 100, rounds: 3 });
    init(ui);
    (ui.start as HTMLButtonElement).click();

    await advanceInSteps(500 + 100 * 3 + 1000);

    pressColor('blue'); // color incorrecto a propósito

    const info = ui.info as HTMLElement;
    expect(info.textContent).toMatch(/Fallaste en el intento 1/);
    // El botón "Empezar" vuelve a habilitarse tras game over.
    expect((ui.start as HTMLButtonElement).disabled).toBe(false);
  });

  it('completar todas las rondas configuradas termina el juego con mensaje de victoria', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4, baseLength: 1, speed: 50, rounds: 1 });
    init(ui);
    (ui.start as HTMLButtonElement).click();

    await advanceInSteps(500 + 50 * 2 + 1000);
    pressColor('red');

    const info = ui.info as HTMLElement;
    expect(info.textContent).toMatch(/¡Felicidades! Juego completado\. Puntuación: 1\/1/);
  });

  it('los botones quedan deshabilitados mientras se reproduce la secuencia (no es el turno del jugador)', async () => {
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4, baseLength: 3, speed: 300 });
    init(ui);
    (ui.start as HTMLButtonElement).click();

    // Justo después de arrancar, antes de que termine de reproducirse
    // la secuencia completa.
    await advanceInSteps(500);
    const buttons = getBoardButtons();
    expect(buttons.every(b => b.disabled)).toBe(true);
  });
});

describe('simon.logic: soporte de teclado', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('las teclas 1-4 disparan el mismo color que clickear el botón correspondiente', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4, baseLength: 1, speed: 50, rounds: 2 });
    init(ui);
    (ui.start as HTMLButtonElement).click();
    await advanceInSteps(500 + 50 * 2 + 1000);

    // La tecla '1' corresponde al primer color del tablero (index 0),
    // que con Math.random mockeado a 0 es siempre 'red' (el esperado).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));

    const info = ui.info as HTMLElement;
    expect(info.textContent).toMatch(/Correcto\. Preparando siguiente ronda/);
  });

  it('las teclas fuera de colorCount configurado se ignoran sin lanzar', async () => {
    const { init } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 2, baseLength: 1, speed: 50, rounds: 2 });
    init(ui);
    (ui.start as HTMLButtonElement).click();
    await advanceInSteps(500 + 50 * 2 + 1000);

    // Tecla '6' no tiene botón correspondiente con colorCount=2.
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '6' }));
    }).not.toThrow();
  });

  it('stop() remueve el listener de teclado global (no reacciona a teclas tras detener el juego)', async () => {
    const { init, stop } = await import('../js/games/simon.logic');
    const ui = await mountRealSimonView();
    setConfig(ui, { colorCount: 4, baseLength: 1, speed: 50, rounds: 2 });
    init(ui);
    (ui.start as HTMLButtonElement).click();
    await advanceInSteps(500 + 50 * 2 + 1000);

    stop();

    const infoBefore = (ui.info as HTMLElement).textContent;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    const infoAfter = (ui.info as HTMLElement).textContent;

    // Tras stop(), el juego ya no reacciona a la tecla — el texto de
    // info no cambia por la pulsación.
    expect(infoAfter).toBe(infoBefore);
  });
});
