import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/lobbyRendererFavoriteKeydown.test.ts
 *
 * Motivación: la card (<article role="listitem">) ya no es interactiva
 * — el contenido "abrible" vive dentro de un <button class="card-open-btn">
 * real, y .card-favorite-btn es un <button> real hermano de ese botón,
 * no descendiente. Cada uno se abre/activa solo con su propio 'click'
 * nativo (que el navegador ya sintetiza correctamente desde Enter/
 * Espacio cuando el foco está en un <button>), así que no hace falta
 * ningún manejo manual de keydown ni filtrado por e.target para evitar
 * que activar un botón dispare también al otro.
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

describe('LobbyRenderer — favoritos y apertura de juego son botones independientes', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="gameList"></div>
      <div id="filterBar"><button class="filter-btn" data-filter="TODOS">TODOS</button></div>
    `;
  });

  it('click en .card-favorite-btn activa solo el favorito, no navega al juego', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: Favorites } = await import('../js/favoritesManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');

    GameRegistry.register({
      id: 'termita', name: 'Termita', tag: 'TEST', accent: '#000', icon: '🐜',
      num: '01', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    LobbyRenderer.render();

    const favBtn = document.querySelector<HTMLButtonElement>('.card-favorite-btn');
    expect(favBtn).toBeTruthy();

    favBtn!.click();

    expect(Favorites.toggle).toHaveBeenCalledWith('termita');
    expect(ViewManager.showView).not.toHaveBeenCalled();
  });

  it('click en .card-open-btn navega al juego', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');

    GameRegistry.register({
      id: 'simon', name: 'Simon', tag: 'TEST', accent: '#000', icon: '🎵',
      num: '02', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    LobbyRenderer.render();

    const openBtn = document.querySelector<HTMLButtonElement>(
      '.game-card[data-game-id="simon"] .card-open-btn'
    );
    expect(openBtn).toBeTruthy();

    openBtn!.click();

    expect(ViewManager.showView).toHaveBeenCalledWith('simon');
  });
});
