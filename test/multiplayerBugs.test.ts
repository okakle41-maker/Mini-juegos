import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Espera el evento 'view-shown' que ViewManager dispara dentro de
 * initGame() al terminar de montar+inicializar una vista. Desde que
 * showView() anima la salida de la vista anterior antes de montar la
 * siguiente (ver viewManager.ts), ese montaje ya no cae en un timeout
 * fijo corto — awaitear el evento real es correcto tanto con
 * transición como sin ella.
 */
function waitForViewShown(id: string): Promise<void> {
  return new Promise((resolve) => {
    const onShown = (e: Event) => {
      if ((e as CustomEvent).detail?.id === id) {
        document.removeEventListener('view-shown', onShown);
        resolve();
      }
    };
    document.addEventListener('view-shown', onShown);
  });
}


// Mock lobbySystem para no depender de red/websocket real
vi.mock('../js/lobbySystem.js', () => {
  let currentLobby: any = null;
  return {
    lobbySystem: {
      createLobby: vi.fn(async (): Promise<any> => {
        currentLobby = { roomCode: 'AB3C', players: [{ id: 'p1', username: 'Yo', status: 'idle' }], hostId: 'p1' };
        return currentLobby;
      }),
      joinLobby: vi.fn(async () => { currentLobby = { roomCode: 'ZZ99', players: [], hostId: 'x' }; }),
      leaveLobby: vi.fn(async () => { currentLobby = null; }),
      getCurrentLobby: vi.fn(() => currentLobby),
      getMatches: vi.fn(() => []),
      currentPlayerId: vi.fn(() => 'p1'),
      createMatch: vi.fn(async () => {}),
      joinMatchAsPlayer: vi.fn(async () => {}),
      spectateMatch: vi.fn(async () => {})
    }
  };
});

vi.mock('../js/multiplayerSystem.js', () => ({
  multiplayerSystem: {
    isConnectedToServer: () => true,
    getAllLeaderboards: () => new Map(),
    getLeaderboard: (): any[] => [],
    sendMatchMessage: vi.fn()
  }
}));

import GameRegistry from '../js/core/gameRegistry.js';
import ViewManager from '../js/core/viewManager.js';

if (typeof window.showView !== 'function') {
  window.showView = (id: string) => ViewManager.showView(id);
}
if (typeof window.backToMenu !== 'function') {
  window.backToMenu = (id?: string) => ViewManager.backToMenu(id);
}

describe('bug fixes: multiplayer lobby code + back navigation', () => {
  beforeEach(async () => {
    GameRegistry.reset();
    document.body.innerHTML = `
      <section id="multiplayer" class="view hidden"></section>
      <section id="online-lobby" class="view hidden"></section>
    `;

    const multiplayerLogic = await import('../js/views/multiplayer.logic.js');
    const onlineLobbyLogic = await import('../js/views/onlineLobby.logic.js');

    GameRegistry.register({
      id: 'multiplayer', name: 'Multiplayer', tag: '', accent: '', icon: '', num: '', description: '', difficulty: 0,
      hidden: true,
      init: multiplayerLogic.init,
      stop: multiplayerLogic.stop
    });

    GameRegistry.register({
      id: 'online-lobby', name: 'Online Lobby', tag: '', accent: '', icon: '', num: '', description: '', difficulty: 0,
      hidden: true,
      init: onlineLobbyLogic.init,
      stop: onlineLobbyLogic.stop
    });
  });

  it('bug 1: room code stays visible after creating a lobby (no auto-navigation)', async () => {
    const shown = waitForViewShown('multiplayer');
    ViewManager.showView('multiplayer');
    await shown;

    const createBtn = document.getElementById('lobby-create-btn') as HTMLButtonElement;
    expect(createBtn).toBeTruthy();
    createBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should still be on multiplayer view (not navigated away)
    expect(ViewManager.getCurrentView()).toBe('multiplayer');

    const codeDisplay = document.getElementById('lobby-code-display');
    expect(codeDisplay?.textContent).toBe('AB3C');

    const lobbyActive = document.getElementById('lobby-active');
    expect(lobbyActive?.classList.contains('hidden')).toBe(false);
  });

  it('bug 2: can navigate back from multiplayer to home via back-btn', async () => {
    document.body.innerHTML += `<section id="home" class="view hidden"></section>`;
    GameRegistry.register({
      id: 'home', name: 'Home', tag: '', accent: '', icon: '', num: '', description: '', difficulty: 0,
      hidden: true, init: () => {}, stop: () => {}
    });

    const shownMultiplayer = waitForViewShown('multiplayer');
    ViewManager.showView('multiplayer');
    await shownMultiplayer;

    const backBtn = document.querySelector('#multiplayer .back-btn[data-back-to]') as HTMLElement;
    expect(backBtn).toBeTruthy();
    expect(backBtn.dataset.hydrated).toBe('true');

    const shownHome = waitForViewShown('home');
    backBtn.click();
    await shownHome;

    expect(ViewManager.getCurrentView()).toBe('home');
  });

  it('bug 2b: can navigate back and forth between multiplayer and online-lobby repeatedly', async () => {
    const shownMultiplayer1 = waitForViewShown('multiplayer');
    ViewManager.showView('multiplayer');
    await shownMultiplayer1;

    const createBtn = document.getElementById('lobby-create-btn') as HTMLButtonElement;
    createBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const goOnlineBtn = document.getElementById('lobby-go-online-btn') as HTMLButtonElement;
    expect(goOnlineBtn).toBeTruthy();
    const shownOnlineLobby1 = waitForViewShown('online-lobby');
    goOnlineBtn.click();
    await shownOnlineLobby1;

    expect(ViewManager.getCurrentView()).toBe('online-lobby');
    // room code badge should be visible here too
    const badge = document.getElementById('onlineLobbyCodeValue');
    expect(badge?.textContent).toBe('AB3C');

    const backBtn = document.querySelector('#online-lobby .back-btn[data-back-to]') as HTMLElement;
    expect(backBtn).toBeTruthy();
    const shownMultiplayer2 = waitForViewShown('multiplayer');
    backBtn.click();
    await shownMultiplayer2;

    expect(ViewManager.getCurrentView()).toBe('multiplayer');
    // lobby-active should still show since lobby persists
    expect(document.getElementById('lobby-code-display')?.textContent).toBe('AB3C');

    // and back again to online-lobby, repeatedly, to catch any staleness
    const shownOnlineLobby2 = waitForViewShown('online-lobby');
    goOnlineBtn.click();
    await shownOnlineLobby2;
    expect(ViewManager.getCurrentView()).toBe('online-lobby');
  });
});
