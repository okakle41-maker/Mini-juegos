/**
 * Regresión: dos bugs de re-entrada en multiplayerSystem.handleMatchUpdate
 * y uno de propagación de scores en lobbySystem.handleMatchUpdate.
 *
 * Bug 1 (multiplayerSystem): handleMatchUpdate volvía a llamar
 * startMatch()/endMatch() completos (que a su vez vuelven a escribir a
 * Supabase) cada vez que veía status:'playing'/'completed' por Realtime
 * — incluyendo el eco del propio update que ese mismo startMatch()/
 * endMatch() acababa de disparar. Si el callback de Realtime llega antes
 * de que el `await` original termine de aplicar su efecto local
 * (startedAt/currentMatch=null), esto reentra en loop.
 *
 * Bug 2 (multiplayerSystem, modo Versus de Letters Fall): cuando el
 * jugador A cierra su partida antes que B, el UPDATE de Realimente que
 * eso dispara llegaba también al cliente de B — y hacía que B perdiera
 * su currentMatch (puesto en null por el endMatch() reentrante) ANTES
 * de que B llamara a su propio finishRoomMatch(). El resultado de B se
 * perdía en silencio.
 *
 * Bug 3 (lobbySystem): handleMatchUpdate nunca propagaba `scores` de la
 * fila real al reconstruir currentMatch tras un UPDATE — el rival nunca
 * se enteraba del score que el otro lado reportó.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    is: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
  };
  return chainable;
}

vi.mock('../js/core/supabaseClient', () => ({
  getSupabaseClient: async () => createChainableMock(),
}));

describe('multiplayerSystem.handleMatchUpdate: no reentra sobre su propio eco', () => {
  let multiplayerSystem: typeof import('../js/multiplayerSystem').multiplayerSystem;

  beforeEach(async () => {
    vi.resetModules();
    ({ multiplayerSystem } = await import('../js/multiplayerSystem.js'));
    await multiplayerSystem.waitForInitialization();
    multiplayerSystem.resetData();
    await multiplayerSystem.setPlayerStatus({ id: 'player-A', name: 'A', avatar: '👤', level: 1, status: 'online' });
  });

  it('no vuelve a llamar startMatch/endMatch (no reescribe Supabase) al reflejar un status ya visto', async () => {
    (multiplayerSystem as any).currentMatch = {
      id: 'match1', gameId: 'letters', players: [], status: 'waiting',
      createdAt: Date.now(), scores: new Map(), settings: {}
    };

    const updateSpy = vi.spyOn(multiplayerSystem as any, 'startMatch');
    const endSpy = vi.spyOn(multiplayerSystem as any, 'endMatch');

    // Simula el evento de Realtime que llega tras un update a 'playing'
    // (eco del propio cambio, o el cambio que originó el rival).
    (multiplayerSystem as any).handleMatchUpdate({
      eventType: 'UPDATE',
      new: { id: 'match1', status: 'playing', players: [], settings: {} }
    });

    // El handler debe reflejar el estado local (startedAt seteado) sin
    // volver a invocar startMatch()/endMatch() — esos dos son quienes
    // ORIGINAN el update; volver a llamarlos desde el reflejo del
    // propio eco reescribiría Supabase de nuevo innecesariamente y, en
    // el peor caso (broadcast que llega antes de que el primer await
    // resuelva), reentra en loop.
    expect(updateSpy).not.toHaveBeenCalled();
    expect(endSpy).not.toHaveBeenCalled();
    expect(multiplayerSystem.getCurrentMatch()?.status).toBe('playing');
    expect(multiplayerSystem.getCurrentMatch()?.startedAt).toBeDefined();
  });

  it('procesar el mismo status "playing" dos veces seguidas no lo re-marca (idempotente)', async () => {
    (multiplayerSystem as any).currentMatch = {
      id: 'match1', gameId: 'letters', players: [], status: 'waiting',
      createdAt: Date.now(), scores: new Map(), settings: {}
    };

    (multiplayerSystem as any).handleMatchUpdate({
      eventType: 'UPDATE',
      new: { id: 'match1', status: 'playing', players: [], settings: {} }
    });
    const firstStartedAt = multiplayerSystem.getCurrentMatch()?.startedAt;

    await new Promise((r) => setTimeout(r, 5));

    (multiplayerSystem as any).handleMatchUpdate({
      eventType: 'UPDATE',
      new: { id: 'match1', status: 'playing', players: [], settings: {} }
    });

    // startedAt no debe cambiar en el segundo evento — confirma que la
    // transición 'playing' se procesa una sola vez.
    expect(multiplayerSystem.getCurrentMatch()?.startedAt).toBe(firstStartedAt);
  });
});

describe('multiplayerSystem: modo Versus — el rival no pierde su currentMatch antes de reportar', () => {
  let multiplayerSystem: typeof import('../js/multiplayerSystem').multiplayerSystem;

  beforeEach(async () => {
    vi.resetModules();
    ({ multiplayerSystem } = await import('../js/multiplayerSystem.js'));
    await multiplayerSystem.waitForInitialization();
    multiplayerSystem.resetData();
  });

  it('B conserva currentMatch (con el score de A ya incorporado) cuando A cierra la partida primero', async () => {
    await multiplayerSystem.setPlayerStatus({ id: 'player-B', name: 'B', avatar: '👤', level: 1, status: 'online' });
    (multiplayerSystem as any).currentMatch = {
      id: 'match1', gameId: 'letters', players: [], status: 'playing',
      createdAt: Date.now(), scores: new Map(), settings: {}
    };

    // Simula el UPDATE de Realtime que llega cuando A (el rival) cierra
    // su partida primero — B todavía no llamó a finishRoomMatch.
    (multiplayerSystem as any).handleMatchUpdate({
      eventType: 'UPDATE',
      new: {
        id: 'match1', status: 'completed', players: [], settings: {},
        scores: JSON.stringify([['player-A', 100]]),
        winner_id: null
      }
    });

    const matchAfterRivalFinished = multiplayerSystem.getCurrentMatch();
    expect(matchAfterRivalFinished).not.toBeNull();
    expect(matchAfterRivalFinished?.scores.get('player-A')).toBe(100);

    // B ahora termina su propia partida — finishRoomMatch no debe ser
    // un no-op silencioso.
    await multiplayerSystem.finishRoomMatch(80);

    // El resultado de B debe haberse incorporado (currentMatch recién
    // ahora pasa a null, tras el propio endMatch() de B).
    expect(multiplayerSystem.getCurrentMatch()).toBeNull();
  });

  it('si el propio jugador ya reportó su score, currentMatch sí se limpia al ver "completed"', async () => {
    await multiplayerSystem.setPlayerStatus({ id: 'player-A', name: 'A', avatar: '👤', level: 1, status: 'online' });
    (multiplayerSystem as any).currentMatch = {
      id: 'match1', gameId: 'letters', players: [], status: 'playing',
      createdAt: Date.now(), scores: new Map([['player-A', 100]]), settings: {}
    };

    (multiplayerSystem as any).handleMatchUpdate({
      eventType: 'UPDATE',
      new: {
        id: 'match1', status: 'completed', players: [], settings: {},
        scores: JSON.stringify([['player-A', 100]]),
        winner_id: 'player-A'
      }
    });

    expect(multiplayerSystem.getCurrentMatch()).toBeNull();
  });
});

describe('lobbySystem.handleMatchUpdate: propaga scores reales de la fila', () => {
  let lobbySystem: typeof import('../js/lobbySystem').lobbySystem;

  beforeEach(async () => {
    vi.resetModules();
    ({ lobbySystem } = await import('../js/lobbySystem.js'));
  });

  it('incorpora newRow.scores al reflejar un match completado', () => {
    (lobbySystem as any).currentMatch = {
      id: 'm1', lobbyId: 'l1', gameId: 'simon', status: 'playing',
      player1Id: 'p1', player2Id: 'p2', settings: {}, spectatorIds: [], scores: {}
    };

    (lobbySystem as any).handleMatchUpdate({
      eventType: 'UPDATE',
      new: { id: 'm1', status: 'completed', scores: { p1: 40, p2: 55 } },
      old: null
    });

    expect(lobbySystem.getCurrentMatch()?.scores).toEqual({ p1: 40, p2: 55 });
  });
});
