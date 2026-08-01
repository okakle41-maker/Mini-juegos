/**
 * test/configPanel.test.ts
 *
 * Reproduce el bug reportado: en navegadores con Tracking Prevention /
 * modo privado estricto, `localStorage.getItem` puede lanzar una
 * excepción. Como `configPanel.ts` llamaba a `applyStoredTheme()` (que
 * usa localStorage) de forma síncrona dentro de `init()`, ANTES de
 * `bindDelegatedListeners()`, una excepción ahí abortaba todo `init()`
 * y el listener de 'change' del selector de tema nunca se registraba
 * — por eso cambiar el <select> no hacía absolutamente nada.
 *
 * También cubre el selector real del header (#themeSelect, en
 * index.html) además del de la vista Configuración
 * (#configThemeSelect) — hay dos <select> de tema en el sitio y ambos
 * deben quedar conectados y sincronizados entre sí.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('configPanel — selectores de tema', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="themeSelect" class="theme-select">
        <option value="dark" selected>Oscuro</option>
        <option value="neon">💠 Neón</option>
      </select>
      <section id="configuracion"></section>
    `;
    vi.resetModules();
  });

  it('el selector de tema del header (#themeSelect) funciona aunque localStorage.getItem lance una excepción al iniciar', async () => {
    // Simula Tracking Prevention: cualquier acceso a localStorage falla.
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    };

    try {
      await import('../js/backgroundManager');
      await import('../js/configPanel');

      const select = document.getElementById('themeSelect') as HTMLSelectElement;
      expect(select).toBeTruthy();

      select.value = 'neon';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      // A pesar de que localStorage está bloqueado, el tema debe aplicarse
      // al DOM (persistencia entre sesiones es best-effort, pero la
      // sesión actual siempre debe reflejar el cambio).
      expect(document.body.getAttribute('data-theme')).toBe('neon');
    } finally {
      Storage.prototype.getItem = originalGetItem;
      Storage.prototype.setItem = originalSetItem;
    }
  });

  it('cambiar el selector del header también sincroniza el de la vista Configuración', async () => {
    localStorage.clear();
    await import('../js/backgroundManager');
    await import('../js/configPanel');

    const configTemplate = (await import('../js/views/configuracion')).default;
    document.getElementById('configuracion')!.innerHTML = configTemplate();

    const headerSelect = document.getElementById('themeSelect') as HTMLSelectElement;
    const configSelect = document.getElementById('configThemeSelect') as HTMLSelectElement;

    headerSelect.value = 'neon';
    headerSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(document.body.getAttribute('data-theme')).toBe('neon');
    expect(configSelect.value).toBe('neon');
  });
});
