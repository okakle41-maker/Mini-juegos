/**
 * Setup file para Vitest
 * Configura el ambiente de testing y mocks necesarios
 */

import { vi } from 'vitest';

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
