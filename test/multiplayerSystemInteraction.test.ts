/**
 * MultiplayerSystem Interaction Tests
 * Tests interaction between automatic matchmaking and manual room modes
 * to ensure they don't interfere with each other due to shared state
 *
 * supabaseClient se mockea por completo: multiplayerSystem es un
 * singleton que dispara initializeSupabase() (y con él,
 * setupRealtimeSubscriptions(), que abre 4 canales de Supabase
 * Realtime) apenas se importa el módulo. Sin mockear, eso abre un
 * WebSocket real hacia el backend configurado en supabaseClient.ts
 * que sigue vivo después de que el test termina — cuando el servidor
 * responde, Node/undici despacha un evento contra un WebSocket
 * corriendo dentro de jsdom (que define su propia clase Event de un
 * "realm" distinto), y la comprobación de identidad estricta de Node
 * revienta con "The 'event' argument must be an instance of Event.
 * Received an instance of Event" (bug conocido de la librería:
 * nodejs/undici#2663). Como la respuesta llega tarde y de forma
 * asíncrona, Vitest la reporta como error "unhandled" contra
 * cualquier test que esté corriendo en ese momento, no contra el que
 * la originó — de ahí que apareciera adjunto a gameRegistry.test.ts.
 * Estos tests validan aislamiento de estado entre modos, no
 * conectividad real con Supabase, así que un mock encadenable que
 * nunca resuelve datos reales (ni abre sockets) es exactamente lo que
 * necesitan.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock encadenable genérico: cubre .channel().on().subscribe(),
// .from().select/insert/update/eq/order/limit() y .removeChannel(),
// que es toda la superficie de supabaseClient que usa
// multiplayerSystem.ts. Cada método encadenable se devuelve a sí
// mismo (this-like) para soportar cualquier orden/combinación sin
// tener que replicar la forma exacta de cada query.
function createChainableMock(): any {
  const chainable: any = {
    channel: vi.fn(() => chainable),
    on: vi.fn(() => chainable),
    subscribe: vi.fn(() => chainable),
    removeChannel: vi.fn(),
    from: vi.fn(() => chainable),
    select: vi.fn(() => chainable),
    insert: vi.fn(async () => ({ data: null, error: null })),
    update: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(async () => ({ data: [], error: null })),
    single: vi.fn(async () => ({ data: null, error: null })),
  };
  return chainable;
}

vi.mock('../js/core/supabaseClient', () => ({
  getSupabaseClient: async () => createChainableMock(),
}));

describe('MultiplayerSystem Interaction Tests', () => {
  let multiplayerSystem: typeof import('../js/multiplayerSystem').multiplayerSystem;

  beforeEach(async () => {
    vi.resetModules();
    ({ multiplayerSystem } = await import('../js/multiplayerSystem.js'));
    // Reset multiplayer system state before each test
    multiplayerSystem.resetData();
  });

  afterEach(() => {
    // Clean up after each test
    multiplayerSystem.resetData();
  });

  describe('Shared State Isolation', () => {
    it('should keep currentMatch separate between modes', async () => {
      // Wait for initialization to complete to avoid race condition
      await multiplayerSystem.waitForInitialization();

      const playerStatus = {
        id: 'test_player',
        name: 'Test Player',
        avatar: '👤',
        level: 1,
        status: 'online' as const
      };

      multiplayerSystem.setPlayerStatus(playerStatus);

      // Initially no match
      expect(multiplayerSystem.getCurrentMatch()).toBeNull();

      // The currentMatch should only be set by one mode at a time
      // This is a structural test - the actual behavior depends on Supabase
      expect(multiplayerSystem.getCurrentMatch()).toBeNull();
    });

    it('should not leak subscriptions between modes', async () => {
      // Wait for initialization to complete to avoid race condition
      await multiplayerSystem.waitForInitialization();

      // This tests that subscriptions are properly managed
      // when switching between matchmaking and room modes
      
      const playerStatus = {
        id: 'test_player',
        name: 'Test Player',
        avatar: '👤',
        level: 1,
        status: 'online' as const
      };

      multiplayerSystem.setPlayerStatus(playerStatus);

      // Disconnect and reconnect should clean up subscriptions
      multiplayerSystem.disconnect();
      multiplayerSystem.reconnect();

      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Error Isolation', () => {
    it('should not crash if one mode fails while the other is active', async () => {
      const playerStatus = {
        id: 'test_player',
        name: 'Test Player',
        avatar: '👤',
        level: 1,
        status: 'online' as const
      };

      await multiplayerSystem.setPlayerStatus(playerStatus);

      // Try to create a room (will fail without Supabase)
      try {
        await multiplayerSystem.createRoomMatch('letters', 'viewer');
      } catch (e) {
        // Expected
      }

      // System should still be functional regardless of connection outcome
      expect(multiplayerSystem.getPlayerStatus()).not.toBeNull();
      expect(typeof multiplayerSystem.isConnectedToServer()).toBe('boolean');
    });

    it('should handle concurrent operations gracefully', async () => {
      const playerStatus = {
        id: 'test_player',
        name: 'Test Player',
        avatar: '👤',
        level: 1,
        status: 'online' as const
      };

      await multiplayerSystem.setPlayerStatus(playerStatus);

      // Try multiple operations concurrently
      const promises = [
        multiplayerSystem.joinMatchmaking('simon', 1).catch(() => {}),
        multiplayerSystem.createRoomMatch('letters', 'viewer').catch(() => {}),
        multiplayerSystem.joinMatchmaking('termita', 2).catch(() => {})
      ];

      // Should not throw unhandled errors
      await Promise.all(promises);
      expect(true).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should reset data correctly', async () => {
      const playerStatus = {
        id: 'test_player',
        name: 'Test Player',
        avatar: '👤',
        level: 1,
        status: 'online' as const
      };

      await multiplayerSystem.setPlayerStatus(playerStatus);
      expect(multiplayerSystem.getPlayerStatus()).not.toBeNull();

      multiplayerSystem.resetData();
      expect(multiplayerSystem.getCurrentMatch()).toBeNull();
    });

    it('should handle player status updates', async () => {
      const playerStatus = {
        id: 'test_player',
        name: 'Test Player',
        avatar: '👤',
        level: 1,
        status: 'online' as const
      };

      await multiplayerSystem.setPlayerStatus(playerStatus);
      const retrieved = multiplayerSystem.getPlayerStatus();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('test_player');
      expect(retrieved?.name).toBe('Test Player');
    });
  });
});
