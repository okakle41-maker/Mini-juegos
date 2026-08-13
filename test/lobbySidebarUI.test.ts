import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/lobbySidebarUI.test.ts
 *
 * Cubre dos bugs encontrados en lobbySidebarUI.ts:
 *
 * 1. performSearch() leía `.card-category`, una clase que solo existe
 *    en el CSS del estado "--loading" (skeleton), no en las cards
 *    reales que genera lobbyRenderer.ts (que usan `.card-tag`). Con el
 *    selector equivocado, `category` siempre era '' y buscar por
 *    categoría/tag ("MEMORIA", "REFLEJOS", etc.) en el buscador del
 *    lobby nunca encontraba nada.
 *
 * 2. initFavoritesCounter() delegaba el click en #gameList escuchando
 *    la fase de burbujeo por defecto, pero favBtn.addEventListener en
 *    lobbyRenderer.ts llama e.stopPropagation() — cortando la
 *    propagación antes de que llegara a #gameList. El contador de
 *    favoritos del sidebar nunca se actualizaba al tocar una estrella.
 *
 * Nota (Fase 3 de la migración a Preact, ver docs/ARCHITECTURE.md):
 * la búsqueda migró de una función standalone (performSearch) a
 * LobbyRenderer.setSearchQuery(), que combina búsqueda + filtro de
 * categoría sobre el estado interno de LobbyRenderer (this.gridEl,
 * poblado por LobbyRenderer.render()). El primer test ahora llama a
 * render() real con un GameConfig mínimo en vez de armar el DOM de la
 * card a mano sin que LobbyRenderer se entere — de lo contrario
 * setSearchQuery() no tendría ningún grid sobre el que operar.
 */
describe('lobbySidebarUI', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <input id="lobbySearch" />
      <div id="gameList"></div>
      <span id="favCountStat">0</span>
    `;
  });

  it('la búsqueda encuentra una card por su categoría/tag visible (.card-tag)', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');

    GameRegistry.register({
      id: 'termita', name: 'Termita', tag: 'MEMORIA', accent: '#000', icon: '🐜',
      num: '01', description: 'Un juego de reflejos y velocidad', difficulty: 1,
      init: () => {}, stop: () => {}
    });
    LobbyRenderer.render();

    await import('../js/lobbySidebarUI');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const input = document.getElementById('lobbySearch') as HTMLInputElement;
    const card = document.querySelector<HTMLElement>('.game-card[data-game-id="termita"]')!;
    expect(card).toBeTruthy();

    input.value = 'memoria';
    input.dispatchEvent(new Event('input'));

    // La búsqueda está debounced 150ms (ver initLobbySearch).
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(card.style.display).not.toBe('none');
  });

  it('el contador de favoritos se actualiza al hacer click en la estrella, pese al stopPropagation del botón', async () => {
    let favCount = 0;
    vi.doMock('../js/favoritesManager', () => ({
      default: {
        toggle: vi.fn().mockImplementation(() => {
          favCount = 1;
          return true;
        }),
        count: vi.fn().mockImplementation(() => favCount),
        isFavorite: vi.fn().mockReturnValue(false),
        refreshCard: vi.fn(),
      },
    }));

    document.body.innerHTML = `
      <input id="lobbySearch" />
      <div id="gameList">
        <article class="game-card" data-game-id="termita">
          <button class="card-favorite-btn" aria-pressed="false">☆</button>
          <h3 class="card-name">Termita</h3>
          <span class="card-tag">MEMORIA</span>
          <p class="card-desc">Un juego de reflejos y velocidad</p>
        </article>
      </div>
      <span id="favCountStat">0</span>
    `;

    await import('../js/lobbySidebarUI');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const favBtn = document.querySelector<HTMLButtonElement>('.card-favorite-btn')!;
    const favCountEl = document.getElementById('favCountStat')!;

    expect(favCountEl.textContent).toBe('0');

    // Simula el comportamiento real: el propio botón hace
    // Favorites.toggle() y stopPropagation() en su listener de click
    // (como en lobbyRenderer.tsx), lo que en el bug original impedía
    // que el click delegado en #gameList (fase de burbujeo) se
    // enterara.
    const { default: Favorites } = await import('../js/favoritesManager');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Favorites.toggle('termita');
    });
    favBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // updateFavCount() se agenda en un microtask tras el toggle.
    await Promise.resolve();
    await Promise.resolve();

    expect(favCountEl.textContent).toBe('1');
  });
});
