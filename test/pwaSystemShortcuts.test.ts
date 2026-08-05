import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/pwaSystemShortcuts.test.ts
 *
 * Motivación: dos guards en pwaSystem.ts chequeaban propiedades que
 * nunca existen en los objetos que consultaban:
 *
 * 1. setupAppShortcuts() exigía `'installPrompt' in window` — esa
 *    propiedad nunca se define en ningún lado (lo que sí se guarda es
 *    `window.deferredPrompt`, bajo otro nombre). El guard siempre daba
 *    false y el método retornaba temprano sin importar el estado real
 *    de instalación de la PWA.
 * 2. registerShortcuts() exigía `(window as any).userActivation` — la
 *    API real es `navigator.userActivation`, no algo en `window`. Con
 *    la propiedad buscada en el objeto equivocado, esto también daba
 *    siempre `undefined` y el método retornaba temprano.
 *
 * Resultado combinado: los app shortcuts (accesos directos como
 * "Jugar Simon" / "Ver Logros" en el ícono de la PWA instalada) nunca
 * llegaban a registrarse en ningún escenario real.
 */
describe('PWASystem — registro de app shortcuts', () => {
  const originalServiceWorker = (navigator as any).serviceWorker;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();

    // pwaSystem se auto-inicializa como singleton al importarse; sin
    // 'serviceWorker' in navigator, init() nunca entra al bloque que
    // llama setupAppShortcuts(), así que lo simulamos disponible.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(undefined),
        register: vi.fn().mockResolvedValue({}),
        ready: Promise.resolve({ shortcuts: { add: vi.fn() } }),
        addEventListener: vi.fn(),
      },
    });

    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker,
    });
    window.matchMedia = originalMatchMedia;
  });

  it('setupAppShortcuts registra shortcuts cuando la PWA está en display-mode standalone', async () => {
    const { pwaSystem } = await import('../js/pwaSystem');

    const readyPromise = (navigator as any).serviceWorker.ready as Promise<any>;
    const shortcutsResult = await readyPromise;
    const addSpy = shortcutsResult.shortcuts.add as ReturnType<typeof vi.fn>;

    pwaSystem.setupAppShortcuts();
    // registerShortcuts() encadena vía navigator.serviceWorker.ready.then(...)
    await Promise.resolve();
    await Promise.resolve();

    expect(addSpy).toHaveBeenCalled();
  });

  it('setupAppShortcuts no registra shortcuts si la PWA no está en modo standalone', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
    const { pwaSystem } = await import('../js/pwaSystem');

    const readyPromise = (navigator as any).serviceWorker.ready as Promise<any>;
    const shortcutsResult = await readyPromise;
    const addSpy = shortcutsResult.shortcuts.add as ReturnType<typeof vi.fn>;

    pwaSystem.setupAppShortcuts();
    await Promise.resolve();
    await Promise.resolve();

    expect(addSpy).not.toHaveBeenCalled();
  });
});
