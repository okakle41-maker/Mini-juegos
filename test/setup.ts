/**
 * Setup file para Vitest
 * Configura el ambiente de testing y mocks necesarios
 */

import { vi } from 'vitest';

// Red de seguridad para un bug conocido de undici (nodejs/undici#2663):
// cuando una respuesta WebSocket llega de forma asíncrona después de
// que su test terminó, Node despacha el evento contra una clase Event
// de un "realm" distinto a la que definió jsdom, y la comprobación
// estricta de identidad de Node revienta con "The 'event' argument
// must be an instance of Event. Received an instance of Event".
// Vitest reporta esto como error "unhandled" contra cualquier test
// que esté corriendo en ese momento (no contra el que lo originó),
// haciendo pasar un false positive por una falla real. La causa raíz
// (un WebSocket real de Supabase que sigue vivo tras un test) ya se
// mockea en los tests que la disparan; esto es una barrera adicional
// para que, si algún WebSocket real se escapa igual, no tumbe una
// corrida entera con un error que no tiene nada que ver con el código
// bajo test.
process.on('uncaughtException', (err: unknown) => {
  const isUndiciEventBug =
    err instanceof TypeError &&
    err.message.includes('must be an instance of Event');
  if (!isUndiciEventBug) throw err;
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = localStorageMock;

// Mock console methods para reducir ruido en tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Limpiar localStorage antes de cada test
beforeEach(() => {
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});

// Resetear el singleton GameRegistry después de cada test.
//
// GameRegistry es un singleton (una sola instancia por proceso de
// Vitest); si dos archivos de test registran un juego con el mismo id
// (p.ej. 'test-game'), el segundo test ve el estado que dejó el
// primero — un bug real que ya ocurrió una vez y que hasta ahora se
// evitaba solo porque test/gameRegistry.test.ts y
// test/gameRegistryIntegration.test.ts usan por casualidad ids
// distintos ('smoke-game'/'lazy-game' vs 'test-game-lifecycle'/
// 'test-game-cache'). Este afterEach es la barrera estructural: si
// algún test nuevo reutiliza un id ya usado en otro archivo, ya no
// puede chocar, sin depender de que cada autor de test lo recuerde.
//
// Import dinámico (no estático) porque algunos tests hacen
// vi.resetModules() y vuelven a importar gameRegistry como módulo
// fresco — importarlo de forma estática acá fijaría una única
// instancia del módulo para todo el setup, rompiendo ese patrón.
afterEach(async () => {
  try {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    GameRegistry.reset();
  } catch {
    // Si el módulo no llegó a cargarse en este test, no hay nada que resetear.
  }
});

// Resetear el singleton LobbyRenderer después de cada test.
//
// Mismo motivo que el reset de GameRegistry de arriba, pero para un bug
// distinto: LobbyRenderer.bindThemeChangeOnce() registra un listener de
// 'theme-changed' directo sobre `document`, una sola vez por instancia.
// Como LobbyRenderer es un singleton de módulo, ese listener sobrevive a
// vi.resetModules() entre tests — un test que llama LobbyRenderer.render()
// deja el listener vivo; si un test posterior en el mismo archivo dispara
// 'theme-changed' por cualquier vía (incluso indirecta, como importar un
// módulo que llama BackgroundManager.setTheme()), esa instancia vieja
// repinta sobre el DOM del test nuevo usando su this.lastOptions ya
// obsoleto, vaciando en silencio cualquier #gameList armado a mano por el
// test que está corriendo. Bug real encontrado en
// test/lobbySidebarUI.test.ts: el segundo `it` fallaba con
// "Cannot read properties of null" porque su propio markup de
// .card-favorite-btn desaparecía antes de la aserción.
afterEach(async () => {
  try {
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');
    LobbyRenderer.reset();
  } catch {
    // Si el módulo no llegó a cargarse en este test, no hay nada que resetear.
  }
});
