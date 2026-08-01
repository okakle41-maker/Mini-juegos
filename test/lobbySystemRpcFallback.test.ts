/**
 * lobbySystem: createLobby/joinLobby no deben depender ciegamente de
 * que el cliente de Supabase exponga .rpc().
 *
 * Motivo: purge_stale_lobbies() (ver migration_009_lobby_expiration.sql)
 * se invoca de forma oportunista al crear/unirse a un lobby. Si el
 * cliente real en runtime no expone .rpc (versión vieja de
 * @supabase/supabase-js cacheada en el build, mock/stub en algún
 * entorno, etc.), llamarlo sin chequear revienta con
 * "client.rpc is not a function" ANTES de llegar a crear el lobby —
 * bug real reportado en producción como "t.cpr (...) is not a
 * function" (nombre minificado de `client.rpc`). createLobby/joinLobby
 * deben degradar con gracia: seguir funcionando sin purgar, no fallar
 * la operación completa por un método opcional ausente.
 */
import { describe, it, expect, vi } from 'vitest';

function createChainableMock(includeRpc: boolean): any {
  const chainable: any = {
    channel: vi.fn(() => chainable),
    on: vi.fn(() => chainable),
    subscribe: vi.fn(() => chainable),
    removeChannel: vi.fn(),
    from: vi.fn(() => chainable),
    select: vi.fn(() => chainable),
    insert: vi.fn(async () => ({ data: null, error: null })),
    update: vi.fn(() => chainable),
    delete: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  if (includeRpc) {
    chainable.rpc = vi.fn(async () => ({ data: null, error: null }));
  }
  return chainable;
}

vi.mock('../js/authManager', () => ({
  default: {
    getUser: (): null => null,
    ready: async (): Promise<void> => {},
  },
}));

describe('lobbySystem sin client.rpc disponible', () => {
  it('createLobby funciona igual si el cliente no tiene .rpc', async () => {
    vi.resetModules();
    vi.doMock('../js/core/supabaseClient', () => ({
      getSupabaseClient: async () => createChainableMock(false),
    }));
    const { lobbySystem } = await import('../js/lobbySystem.js');

    const lobby = await lobbySystem.createLobby();

    expect(lobby).toBeTruthy();
    expect(lobby.roomCode).toHaveLength(4);
  });

  it('joinLobby no revienta por .rpc ausente antes de llegar a buscar el código', async () => {
    vi.resetModules();
    vi.doMock('../js/core/supabaseClient', () => ({
      getSupabaseClient: async () => createChainableMock(false),
    }));
    const { lobbySystem } = await import('../js/lobbySystem.js');

    // Sin lobby con ese código (maybeSingle ya devuelve { data: null }
    // por default en createChainableMock): joinLobby debe fallar con el
    // error de negocio esperado ("no existe"), no con un TypeError
    // sobre .rpc — confirma que la ausencia de rpc no interrumpe el
    // flujo antes de llegar a la búsqueda real.
    await expect(lobbySystem.joinLobby('AB3C')).rejects.toThrow(/no existe/i);
  });

  it('createLobby sigue funcionando cuando .rpc SÍ está disponible (caso normal)', async () => {
    vi.resetModules();
    vi.doMock('../js/core/supabaseClient', () => ({
      getSupabaseClient: async () => createChainableMock(true),
    }));
    const { lobbySystem } = await import('../js/lobbySystem.js');

    const lobby = await lobbySystem.createLobby();
    expect(lobby).toBeTruthy();
  });
});
