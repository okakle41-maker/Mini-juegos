import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regresión: el handler de Escape en keyboardShortcuts.ts leía
 * `(window as any).viewManager`, una propiedad que ViewManagerInstance
 * nunca expone (expone `window.showView`/`window.backToMenu`, ver el
 * final de core/viewManager.ts) — el atajo Escape no hacía nada en
 * ninguna vista, silenciosamente, porque `viewManager` siempre era
 * `undefined`.
 */
describe('keyboardShortcuts: atajo Escape', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    delete (window as any).viewManager;
    delete (window as any).backToMenu;
    delete (window as any).showView;
  });

  it('llama a window.backToMenu() al presionar Escape fuera de un input', async () => {
    const backToMenu = vi.fn();
    (window as any).backToMenu = backToMenu;

    await import('../js/keyboardShortcuts');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(backToMenu).toHaveBeenCalledTimes(1);
  });

  it('no lanza si window.backToMenu no está definido (defensivo)', async () => {
    await import('../js/keyboardShortcuts');

    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }).not.toThrow();
  });

  it('Escape dentro de un <input> no dispara el atajo (lo ignora el guard de foco)', async () => {
    const backToMenu = vi.fn();
    (window as any).backToMenu = backToMenu;
    await import('../js/keyboardShortcuts');

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    document.dispatchEvent(event);

    expect(backToMenu).not.toHaveBeenCalled();
  });
});
