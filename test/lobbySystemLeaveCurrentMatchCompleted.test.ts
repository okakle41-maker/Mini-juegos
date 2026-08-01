import { describe, it, expect, vi } from 'vitest';

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
    delete: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: { status: 'completed' }, error: null })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  };
  return chainable;
}

vi.mock('../js/core/supabaseClient', () => ({
  getSupabaseClient: async () => createChainableMock(),
}));
vi.mock('../js/authManager', () => ({
  default: { getUser: (): null => null },
}));

describe('fix: leaveCurrentMatch no pisa un resultado ya completed', () => {
  it('no marca abandoned si la DB ya tiene status completed', async () => {
    const { lobbySystem } = await import('../js/lobbySystem.js');
    await (lobbySystem as any).waitForInitialization();
    const client = (lobbySystem as any).supabaseClient;

    (lobbySystem as any).currentLobby = { id: 'lobby1', roomCode: 'AB3C', hostId: 'p1', players: [] };
    (lobbySystem as any).currentMatch = {
      id: 'match1', lobbyId: 'lobby1', gameId: 'arrow', status: 'playing',
      player1Id: 'anon_me', player2Id: 'p2', settings: {}, spectatorIds: []
    };
    vi.spyOn(lobbySystem, 'currentPlayerId').mockReturnValue('anon_me');

    await lobbySystem.leaveCurrentMatch();

    const abandonedCall = client.update.mock.calls.find((args: any[]) => args[0]?.status === 'abandoned');
    expect(abandonedCall).toBeUndefined();
  });
});
