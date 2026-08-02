/**
 * test/multiplayerSplitViewHostStart.test.ts
 *
 * Regresión: antes cualquiera de los dos jugadores de una sub-partida
 * del lobby (Simon/Arrow/Termita) podía presionar "Empezar" por su
 * cuenta, cada uno arrancando en un momento distinto con su propia
 * secuencia — sin ningún control de quién decide cuándo arranca la
 * partida. Ahora solo el anfitrión (player1Id de la sub-partida, ver
 * lobbySystem.createMatch) puede iniciar, y su arranque se transmite
 * al rival vía broadcastStart()/onStart() para que ambos empiecen en
 * el mismo instante — ver js/utils/multiplayerSplitView.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/lobbySystem', () => {
  const state: {
    currentMatch: any;
    currentPlayerId: string;
    lastSentEvent: { type: string; payload: unknown } | null;
  } = {
    currentMatch: null,
    currentPlayerId: 'player-1',
    lastSentEvent: null,
  };

  return {
    lobbySystem: {
      getCurrentMatch: () => state.currentMatch,
      currentPlayerId: () => state.currentPlayerId,
      sendGameEvent: vi.fn(async (type: string, payload: unknown) => {
        state.lastSentEvent = { type, payload };
        // Simula el broadcast real: dispara el mismo evento DOM que
        // lobbySystem dispara al recibir un lobby_match_messages nuevo
        // vía realtime (ver multiplayer:game_event en lobbySystem.ts),
        // para poder probar onStart() end-to-end en un mismo test.
        window.dispatchEvent(new CustomEvent('multiplayer:game_event', { detail: { type, payload } }));
      }),
      __setTestState: (next: Partial<typeof state>) => Object.assign(state, next),
      __getTestState: () => state,
    },
  };
});

import { setupSplitView } from '../js/utils/multiplayerSplitView.js';
import { lobbySystem } from '../js/lobbySystem.js';

const setTestState = (lobbySystem as any).__setTestState as (s: any) => void;

function fakeUi(): any {
  return {}; // setupSplitView solo usa ui[`${prefix}Split`]/ui[`${prefix}Rival`], ambos opcionales
}

beforeEach(() => {
  setTestState({ currentMatch: null, currentPlayerId: 'player-1', lastSentEvent: null });
});

describe('setupSplitView: isHost', () => {
  it('es true para player1Id (quien creó la sub-partida)', () => {
    setTestState({
      currentMatch: { gameId: 'simon', player1Id: 'player-1', player2Id: 'player-2' },
      currentPlayerId: 'player-1',
    });
    const split = setupSplitView('simon', fakeUi(), 'simon');
    expect(split.isMultiplayer).toBe(true);
    expect(split.isHost).toBe(true);
    expect(split.isSpectating).toBe(false);
  });

  it('es false para player2Id (el rival, no anfitrión)', () => {
    setTestState({
      currentMatch: { gameId: 'simon', player1Id: 'player-1', player2Id: 'player-2' },
      currentPlayerId: 'player-2',
    });
    const split = setupSplitView('simon', fakeUi(), 'simon');
    expect(split.isMultiplayer).toBe(true);
    expect(split.isHost).toBe(false);
    expect(split.isSpectating).toBe(false);
  });

  it('es false para un espectador', () => {
    setTestState({
      currentMatch: { gameId: 'simon', player1Id: 'player-1', player2Id: 'player-2' },
      currentPlayerId: 'player-3',
    });
    const split = setupSplitView('simon', fakeUi(), 'simon');
    expect(split.isHost).toBe(false);
    expect(split.isSpectating).toBe(true);
  });

  it('es false en modo solo-jugador (sin match activo)', () => {
    setTestState({ currentMatch: null, currentPlayerId: 'player-1' });
    const split = setupSplitView('simon', fakeUi(), 'simon');
    expect(split.isMultiplayer).toBe(false);
    expect(split.isHost).toBe(false);
  });
});

describe('setupSplitView: broadcastStart / onStart', () => {
  it('el host puede emitir broadcastStart y el rival lo recibe vía onStart', async () => {
    setTestState({
      currentMatch: { gameId: 'simon', player1Id: 'player-1', player2Id: 'player-2' },
      currentPlayerId: 'player-1',
    });
    const hostSplit = setupSplitView('simon', fakeUi(), 'simon');

    setTestState({ currentPlayerId: 'player-2' });
    const rivalSplit = setupSplitView('simon', fakeUi(), 'simon');

    const rivalStartHandler = vi.fn();
    rivalSplit.onStart(rivalStartHandler);

    hostSplit.broadcastStart();
    await new Promise((r) => setTimeout(r, 0));

    expect(rivalStartHandler).toHaveBeenCalledTimes(1);
  });

  it('broadcastStart no hace nada si quien lo llama no es host (no-op silencioso)', async () => {
    setTestState({
      currentMatch: { gameId: 'simon', player1Id: 'player-1', player2Id: 'player-2' },
      currentPlayerId: 'player-2', // el rival, no el host
    });
    const rivalSplit = setupSplitView('simon', fakeUi(), 'simon');

    rivalSplit.broadcastStart();
    await new Promise((r) => setTimeout(r, 0));

    expect(lobbySystem.sendGameEvent).not.toHaveBeenCalled();
  });

  it('la señal de arranque no se confunde con onRivalEvent de otros tipos', async () => {
    setTestState({
      currentMatch: { gameId: 'simon', player1Id: 'player-1', player2Id: 'player-2' },
      currentPlayerId: 'player-1',
    });
    const hostSplit = setupSplitView('simon', fakeUi(), 'simon');

    setTestState({ currentPlayerId: 'player-2' });
    const rivalSplit = setupSplitView('simon', fakeUi(), 'simon');

    const rivalStartHandler = vi.fn();
    const rivalFlashHandler = vi.fn();
    rivalSplit.onStart(rivalStartHandler);
    rivalSplit.onRivalEvent('simon:flash', rivalFlashHandler);

    hostSplit.broadcastStart();
    await new Promise((r) => setTimeout(r, 0));

    expect(rivalStartHandler).toHaveBeenCalledTimes(1);
    expect(rivalFlashHandler).not.toHaveBeenCalled();
  });

  it('cleanup() vacía los handlers de onStart registrados', async () => {
    setTestState({
      currentMatch: { gameId: 'simon', player1Id: 'player-1', player2Id: 'player-2' },
      currentPlayerId: 'player-1',
    });
    const hostSplit = setupSplitView('simon', fakeUi(), 'simon');

    setTestState({ currentPlayerId: 'player-2' });
    const rivalSplit = setupSplitView('simon', fakeUi(), 'simon');
    const rivalStartHandler = vi.fn();
    rivalSplit.onStart(rivalStartHandler);
    rivalSplit.cleanup();

    hostSplit.broadcastStart();
    await new Promise((r) => setTimeout(r, 0));

    expect(rivalStartHandler).not.toHaveBeenCalled();
  });
});
