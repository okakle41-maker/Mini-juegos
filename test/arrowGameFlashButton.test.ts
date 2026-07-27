import { beforeEach, describe, expect, it, vi } from 'vitest';
import viewTemplate from '../js/views/arrow';
import type { GameUi } from '../js/types/game';

/**
 * test/arrowGameFlashButton.test.ts
 *
 * Motivación: `flashButton(key, correct)` en arrowGame.logic.ts recibía
 * `correct` (los 2 call sites en handleInput sí distinguen true/false)
 * pero el cuerpo de la función ignoraba el parámetro y siempre aplicaba
 * la misma clase `active`, sin importar si la tecla presionada era la
 * correcta o no — a diferencia de `.arrow-display` (el símbolo central),
 * que sí distingue con `.correct`/`.wrong`. Ver la sección "Pendiente /
 * decisión de producto" del README (ahora resuelta).
 *
 * Se decidió reusar la misma paleta verde/roja que .arrow-display.correct
 * y .arrow-display.wrong ya usan, vía nuevas clases CSS
 * .active-success/.active-fail en arrow.css, en vez de introducir colores
 * nuevos.
 *
 * Monta el HTML real de la vista (no un mock a mano) y arma el objeto
 * `ui` de la misma forma que GameRegistry.resolveUi() en producción —
 * recorriendo [data-ui] dentro de la sección — para que el test detecte
 * si algún data-ui usado por flashButton deja de existir en la vista real.
 */

function mountArrowView(): GameUi {
  document.body.innerHTML = `<section id="arrow">${viewTemplate()}</section>`;
  const section = document.getElementById('arrow')!;
  const ui: GameUi = {};
  section.querySelectorAll<HTMLElement>('[data-ui]').forEach((el) => {
    const key = el.dataset.ui;
    if (key) ui[key] = el;
  });
  return ui;
}

/** Arranca la partida (equivalente a clickear "Iniciar"): handleInput
 * tiene guards `if (!this.state.active) return`, así que simular teclas
 * antes de esto no dispara flashButton en absoluto. */
function startGame(ui: GameUi): void {
  (ui.start as HTMLButtonElement).click();
}

function getTouchButton(key: string): HTMLElement {
  const btn = document.querySelector<HTMLElement>(`button[data-key="${key}"]`);
  if (!btn) throw new Error(`No se encontró el botón táctil para ${key}`);
  return btn;
}

describe('arrowGame: flashButton distingue acierto/fallo en el D-pad táctil', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('una tecla correcta aplica active-success, no active-fail', async () => {
    const { init } = await import('../js/games/arrowGame.logic');
    const ui = mountArrowView();
    init(ui);
    startGame(ui);

    // La secuencia se genera al azar (generateSequence en
    // arrowGame.logic.ts), así que no hay forma de saber de antemano cuál
    // de las 4 flechas es la correcta para el primer paso. Probamos las
    // 4: como currentStep no avanza hasta un acierto, como máximo una de
    // ellas produce active-success y el resto active-fail sin afectarse
    // entre sí (cada intento fallido no completa el paso).
    const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    let successBtn: Element | undefined;
    for (const key of ARROW_KEYS) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key }));
      const btn = getTouchButton(key);
      if (btn.classList.contains('active-success')) {
        successBtn = btn;
        break;
      }
      expect(btn.classList.contains('active-fail')).toBe(true);
    }

    expect(successBtn).toBeTruthy();
    expect(successBtn!.classList.contains('active-fail')).toBe(false);

    vi.useRealTimers();
  });

  it('la clase de feedback se remueve después del timeout, igual que active', async () => {
    const { init } = await import('../js/games/arrowGame.logic');
    const ui = mountArrowView();
    init(ui);
    startGame(ui);

    // Cualquier tecla de flecha dispara flashButton con active o
    // active-fail (ver test anterior); para este test solo nos importa
    // que la clase se limpie tras el timeout, no cuál se aplicó.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    const btn = getTouchButton('ArrowUp');
    const hadFeedback = btn.classList.contains('active-success') || btn.classList.contains('active-fail');
    expect(hadFeedback).toBe(true);

    vi.advanceTimersByTime(200);

    expect(btn.classList.contains('active')).toBe(false);
    expect(btn.classList.contains('active-success')).toBe(false);
    expect(btn.classList.contains('active-fail')).toBe(false);

    vi.useRealTimers();
  });

  it('una tecla sin flecha asociada no crashea flashButton', async () => {
    const { init } = await import('../js/games/arrowGame.logic');
    const ui = mountArrowView();

    expect(() => init(ui)).not.toThrow();
    startGame(ui);

    // Tecla que no forma parte del set de flechas: handleInput la
    // procesa como fallo (isCorrect === false), no debería crashear ni
    // aunque no exista un botón data-key="q" en el D-pad.
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    }).not.toThrow();

    vi.useRealTimers();
  });
});
