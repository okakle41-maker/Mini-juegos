import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/lobbyRendererFavoriteKeydown.test.ts
 *
 * Motivación: renderCards() registra un listener 'keydown' en la card
 * completa (Enter/Espacio → abrir el juego), pensado para navegación
 * por teclado sobre la card misma. Pero .card-favorite-btn es un
 * <button> real anidado adentro, focuseable de forma independiente.
 * El 'keydown' de Enter/Espacio con foco en ese botón burbujea hasta
 * la card ANTES de que el navegador sintetice el 'click' nativo del
 * botón (que sí tiene stopPropagation() en su propio listener) — sin
 * filtrar por e.target, el handler de la card interpretaba esa tecla
 * como "abrir el juego" además de activar el botón de favoritos, dos
 * acciones cuando el usuario solo quería una.
 */
vi.mock('../js/core/viewManager', () => ({
  default: { showView: vi.fn() },
}));
vi.mock('../js/favoritesManager', () => ({
  default: {
    isFavorite: vi.fn().mockReturnValue(false),
    toggle: vi.fn(),
    refreshCard: vi.fn(),
  },
}));
vi.mock('../js/leaderboardManager', () => ({
  default: {
    get: vi.fn().mockReturnValue([]),
    renderBadges: vi.fn(),
  },
}));

describe('LobbyRenderer — keydown en el botón de favoritos no debe abrir el juego', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="gameList"></div>
      <div id="filterBar"><button class="filter-btn" data-filter="TODOS">TODOS</button></div>
    `;
  });

  it('Enter con foco en .card-favorite-btn solo activa el botón, no navega al juego', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');

    GameRegistry.register({
      id: 'termita', name: 'Termita', tag: 'TEST', accent: '#000', icon: '🐜',
      num: '01', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    LobbyRenderer.render();

    const favBtn = document.querySelector<HTMLButtonElement>('.card-favorite-btn');
    expect(favBtn).toBeTruthy();

    const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    favBtn!.dispatchEvent(keydownEvent);

    expect(ViewManager.showView).not.toHaveBeenCalled();
  });

  it('Enter con foco en la card (no en el botón de favoritos) sí navega al juego', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');

    GameRegistry.register({
      id: 'simon', name: 'Simon', tag: 'TEST', accent: '#000', icon: '🎵',
      num: '02', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    LobbyRenderer.render();

    const card = document.querySelector<HTMLElement>('.game-card[data-game-id="simon"]');
    expect(card).toBeTruthy();

    const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card!.dispatchEvent(keydownEvent);

    expect(ViewManager.showView).toHaveBeenCalledWith('simon');
  });
});
