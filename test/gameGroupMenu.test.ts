import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/gameGroupMenu.test.ts
 *
 * Cubre el flujo de la card agrupadora "Clásicos" (ver
 * js/games/classicsHub.ts, js/utils/gameGroupMenuController.tsx,
 * js/components/GameGroupMenu.tsx):
 *
 * 1. LobbyRenderer.onCardClick ahora recibe un segundo argumento
 *    (anchorEl, el botón .card-open-btn real que originó el click) —
 *    ver el cambio de firma en lobbyRenderer.tsx. Se verifica que
 *    llega el elemento correcto, no solo que se llama.
 * 2. createGameGroupClickHandler: para un id agrupado (classics-hub),
 *    abre el popover en vez de navegar; para cualquier otro id,
 *    navega normal (ViewManager.showView) — el fallback tiene que
 *    seguir funcionando o el resto del lobby se rompe.
 * 3. Elegir un juego dentro del popover navega a ESE juego (no al
 *    hub) y cierra el menú.
 * 4. Escape cierra el menú sin navegar a ningún lado.
 * 5. Un id de grupo que no resuelve a ningún GameConfig real (typo)
 *    no revienta: simplemente no abre nada.
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

function baseGameConfig(id: string, name: string) {
  return {
    id, name, tag: 'TEST', accent: '#ef4444', icon: '💣',
    num: '01', description: '', difficulty: 1,
    init: () => {}, stop: () => {},
  };
}

describe('GameGroupMenu — flujo de la card agrupadora', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="gameList"></div>
      <div id="filterBar"><button class="filter-btn" data-filter="TODOS">TODOS</button></div>
    `;
  });

  afterEach(() => {
    // El popover se monta en un contenedor propio anexado a <body>
    // (ver ensureMounted en gameGroupMenuController.tsx), fuera de
    // #gameList — sin limpiar esto, el contenedor de un test anterior
    // (con su propio popover ya montado) queda huérfano en <body> y
    // contamina el siguiente test.
    document.querySelectorAll('.game-group-menu-container').forEach((el) => el.remove());
  });

  it('onCardClick recibe el .card-open-btn real de la card clickeada como segundo argumento', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');

    GameRegistry.register(baseGameConfig('termita', 'Termita'));

    const onCardClick = vi.fn();
    LobbyRenderer.render({ onCardClick });

    const openBtn = document.querySelector<HTMLButtonElement>(
      '.game-card[data-game-id="termita"] .card-open-btn'
    );
    expect(openBtn).toBeTruthy();

    openBtn!.click();

    expect(onCardClick).toHaveBeenCalledTimes(1);
    const [calledGame, calledAnchor] = onCardClick.mock.calls[0];
    expect(calledGame.id).toBe('termita');
    expect(calledAnchor).toBe(openBtn);
  });

  it('createGameGroupClickHandler: un id agrupado abre el popover en vez de navegar', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');
    const { createGameGroupClickHandler } = await import('../js/utils/gameGroupMenuController');

    GameRegistry.register(baseGameConfig('classics-hub', 'Clásicos'));
    GameRegistry.register(baseGameConfig('bombdefusal', 'Bomb Defusal'));
    GameRegistry.register(baseGameConfig('reactor', 'Reactor Nuclear'));

    LobbyRenderer.render({
      onCardClick: createGameGroupClickHandler({
        'classics-hub': ['bombdefusal', 'reactor'],
      }),
    });

    const openBtn = document.querySelector<HTMLButtonElement>(
      '.game-card[data-game-id="classics-hub"] .card-open-btn'
    );
    openBtn!.click();

    // No navega directo al hub — el popover es el que decide el
    // destino real cuando el usuario elige un juego adentro.
    expect(ViewManager.showView).not.toHaveBeenCalled();

    const menu = document.querySelector('.game-group-menu');
    expect(menu).toBeTruthy();
    expect(menu?.textContent).toContain('Bomb Defusal');
    expect(menu?.textContent).toContain('Reactor Nuclear');
  });

  it('elegir un juego del popover navega a ESE juego y cierra el menú', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');
    const { createGameGroupClickHandler } = await import('../js/utils/gameGroupMenuController');

    GameRegistry.register(baseGameConfig('classics-hub', 'Clásicos'));
    GameRegistry.register(baseGameConfig('bombdefusal', 'Bomb Defusal'));
    GameRegistry.register(baseGameConfig('reactor', 'Reactor Nuclear'));

    LobbyRenderer.render({
      onCardClick: createGameGroupClickHandler({
        'classics-hub': ['bombdefusal', 'reactor'],
      }),
    });

    document
      .querySelector<HTMLButtonElement>('.game-card[data-game-id="classics-hub"] .card-open-btn')!
      .click();

    const items = document.querySelectorAll<HTMLButtonElement>('.game-group-menu-item');
    expect(items.length).toBe(2);

    const reactorItem = Array.from(items).find((el) => el.textContent?.includes('Reactor Nuclear'));
    expect(reactorItem).toBeTruthy();
    reactorItem!.click();

    expect(ViewManager.showView).toHaveBeenCalledWith('reactor');
    // El menú se desmonta al elegir (ver onSelect en GameGroupMenu.tsx
    // llamando también a onClose) — no debería quedar visible.
    expect(document.querySelector('.game-group-menu')).toBeFalsy();
  });

  it('Escape cierra el popover sin navegar a ningún lado', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');
    const { createGameGroupClickHandler } = await import('../js/utils/gameGroupMenuController');

    GameRegistry.register(baseGameConfig('classics-hub', 'Clásicos'));
    GameRegistry.register(baseGameConfig('bombdefusal', 'Bomb Defusal'));

    LobbyRenderer.render({
      onCardClick: createGameGroupClickHandler({
        'classics-hub': ['bombdefusal'],
      }),
    });

    document
      .querySelector<HTMLButtonElement>('.game-card[data-game-id="classics-hub"] .card-open-btn')!
      .click();

    // Los useEffect de Preact se agendan vía requestAnimationFrame (con
    // fallback a setTimeout(35) si rAF no está disponible/no dispara —
    // ver el bundle de preact/hooks), no como microtask puro: un
    // simple `await Promise.resolve()` no alcanza en jsdom. Se espera
    // un tick de reloj real para dar tiempo a que el efecto corra y
    // registre el listener de Escape.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.querySelector('.game-group-menu')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.game-group-menu')).toBeFalsy();
    expect(ViewManager.showView).not.toHaveBeenCalled();
  });

  it('un grupo con ids que no resuelven a ningún GameConfig real no abre ningún menú (ni revienta)', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');
    const { createGameGroupClickHandler } = await import('../js/utils/gameGroupMenuController');

    GameRegistry.register(baseGameConfig('classics-hub', 'Clásicos'));
    // Ningún 'bombdefusal-typo' registrado a propósito.

    LobbyRenderer.render({
      onCardClick: createGameGroupClickHandler({
        'classics-hub': ['bombdefusal-typo'],
      }),
    });

    const openBtn = document.querySelector<HTMLButtonElement>(
      '.game-card[data-game-id="classics-hub"] .card-open-btn'
    );

    expect(() => openBtn!.click()).not.toThrow();
    expect(document.querySelector('.game-group-menu')).toBeFalsy();
  });
});

/**
 * Migración de Skill Check (ver js/games/Skillcheck.ts): la card
 * "Skill Check" pasó del hub de "cubos" (js/views/skillchecks.ts +
 * skillchecksHub.logic.ts, ambos eliminados) al mismo mecanismo de
 * menú flotante que "Clásicos". A diferencia del describe de arriba
 * (que usa GameConfig de prueba genéricos), este usa el registro REAL
 * de juegos (js/games/index.ts) para verificar que la migración
 * agrupa exactamente los 15 juegos correctos con sus nombres reales
 * — no solo que el mecanismo genérico del popover funciona.
 */
describe('GameGroupMenu — migración real de Skill Check', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="gameList"></div>
      <div id="filterBar"><button class="filter-btn" data-filter="TODOS">TODOS</button></div>
    `;
  });

  afterEach(() => {
    document.querySelectorAll('.game-group-menu-container').forEach((el) => el.remove());
  });

  it('SKILLCHECKS_HUB_GAME_IDS tiene exactamente los 15 juegos migrados, sin duplicados', async () => {
    const { SKILLCHECKS_HUB_GAME_IDS } = await import('../js/games/Skillcheck');

    const expected = [
      'rapidlines-game', 'circle-game', 'maze-game', 'keyspam-game',
      'sequence-game', 'rhythmclick', 'progresstiming', 'multipoint',
      'bouncebar', 'holdrelease', 'targetpop', 'chordkeys',
      'orbitcatch', 'lanedodge', 'pipealign',
    ];

    expect([...SKILLCHECKS_HUB_GAME_IDS]).toEqual(expected);
    expect(new Set(SKILLCHECKS_HUB_GAME_IDS).size).toBe(SKILLCHECKS_HUB_GAME_IDS.length);
  });

  it('click en la card real "Skill Check" abre el popover con los 15 juegos reales del registro', async () => {
    // Import real de todo js/games/index.ts (no baseGameConfig de
    // prueba): registra los ~37 GameConfig reales del proyecto,
    // incluida la card 'skillchecks' migrada y sus 15 agrupados.
    await import('../js/games/index');
    const { default: ViewManager } = await import('../js/core/viewManager');
    const { default: LobbyRenderer } = await import('../js/lobbyRenderer');
    const { createGameGroupClickHandler } = await import('../js/utils/gameGroupMenuController');
    const { SKILLCHECKS_HUB_GAME_IDS } = await import('../js/games/Skillcheck');
    const { CLASSICS_HUB_GAME_IDS } = await import('../js/games/classicsHub');

    LobbyRenderer.render({
      onCardClick: createGameGroupClickHandler({
        'classics-hub': CLASSICS_HUB_GAME_IDS,
        'skillchecks': SKILLCHECKS_HUB_GAME_IDS,
      }),
    });

    const openBtn = document.querySelector<HTMLButtonElement>(
      '.game-card[data-game-id="skillchecks"] .card-open-btn'
    );
    expect(openBtn).toBeTruthy();

    openBtn!.click();

    expect(ViewManager.showView).not.toHaveBeenCalled();

    const items = document.querySelectorAll('.game-group-menu-item');
    expect(items.length).toBe(15);

    const menu = document.querySelector('.game-group-menu');
    // Nombres reales tal como están en cada GameConfig (ver
    // js/games/rapidlines.ts, Maze/maze.ts, keyspam/keyspam.ts,
    // etc.) — confirma que el popover resuelve GameRegistry.get()
    // correctamente para cada id migrado, no solo que hay 15 <li>.
    expect(menu?.textContent).toContain('Rapid Lines');
    expect(menu?.textContent).toContain('Circle');
    expect(menu?.textContent).toContain('Maze');
    expect(menu?.textContent).toContain('Key Spam');
    expect(menu?.textContent).toContain('Sequence');
    expect(menu?.textContent).toContain('Rhythm Click');
    expect(menu?.textContent).toContain('Pipe Align');

    // Elegir "Maze" navega a ese juego puntual y cierra el popover.
    const mazeItem = Array.from(items).find((el) => el.textContent?.includes('Maze'));
    expect(mazeItem).toBeTruthy();
    (mazeItem as HTMLButtonElement).click();

    expect(ViewManager.showView).toHaveBeenCalledWith('maze-game');
    expect(document.querySelector('.game-group-menu')).toBeFalsy();
  });

  it('la card "skillchecks" ya no tiene entrada en viewTemplates (la vista de cubos fue eliminada)', async () => {
    const { viewTemplates } = await import('../js/core/viewTemplates');
    expect(viewTemplates['skillchecks']).toBeUndefined();
  });
});
