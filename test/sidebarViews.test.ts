import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/favoritesManager', () => ({
  default: { count: () => 1 }
}));

function dispatchViewShown(id: string): void {
  document.dispatchEvent(new CustomEvent('view-shown', { detail: { id } }));
}

describe('SidebarViews', () => {
  beforeEach(() => {
    vi.resetModules();
    // DOM real: los mismos contenedores que existen de verdad en
    // js/views/estadisticas.ts, progreso.ts, ranking.ts y manual.ts —
    // no un #sidebar-content que index.html nunca tuvo.
    document.body.innerHTML = `
      <section id="estadisticas"><div class="stats-grid" id="statsGrid"></div><div id="statsByCategory"></div></section>
      <section id="progreso"><div class="progress-list" id="progressList"></div></section>
      <section id="ranking"><div class="ranking-list" id="rankingList"></div></section>
      <section id="manual"><div class="manual-list" id="manualList"></div></section>
    `;
  });

  it('renderiza estadísticas reales a partir del registro y favoritos al recibir view-shown', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    // sidebarViews.ts se registra como listener de 'view-shown' apenas se
    // importa (side-effect import, igual que en main.ts), así que hay que
    // importarlo después de tener el DOM y el registro listos.
    await import('../js/sidebarViews');

    GameRegistry.register({
      id: 'termita', name: 'Termita', tag: 'TEST', accent: '#000', icon: '🐜',
      num: '01', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });
    GameRegistry.register({
      id: 'simon', name: 'Simon', tag: 'TEST', accent: '#000', icon: '🎵',
      num: '02', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    dispatchViewShown('estadisticas');

    const grid = document.getElementById('statsGrid');
    expect(grid?.innerHTML).toContain('MÓDULOS TOTALES');
    expect(grid?.innerHTML).toContain('2');
    expect(grid?.innerHTML).toContain('FAVORITOS');
    expect(grid?.innerHTML).toContain('1');
  });

  it('no toca el DOM si se dispara view-shown para una vista que no es del sidebar', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    await import('../js/sidebarViews');

    GameRegistry.register({
      id: 'termita', name: 'Termita', tag: 'TEST', accent: '#000', icon: '🐜',
      num: '01', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    dispatchViewShown('termita');

    expect(document.getElementById('statsGrid')?.innerHTML).toBe('');
  });

  it('renderiza el ranking ordenado por mejor puntuación', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    await import('../js/sidebarViews');

    GameRegistry.register({
      id: 'termita', name: 'Termita', tag: 'TEST', accent: '#000', icon: '🐜',
      num: '01', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });
    GameRegistry.register({
      id: 'simon', name: 'Simon', tag: 'TEST', accent: '#000', icon: '🎵',
      num: '02', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    Leaderboard.save('termita', 10);
    Leaderboard.save('simon', 50);

    dispatchViewShown('ranking');

    const list = document.getElementById('rankingList');
    const simonIndex = list!.innerHTML.indexOf('Simon');
    const termitaIndex = list!.innerHTML.indexOf('Termita');
    expect(simonIndex).toBeGreaterThan(-1);
    expect(termitaIndex).toBeGreaterThan(-1);
    expect(simonIndex).toBeLessThan(termitaIndex); // 50 > 10, va primero
  });

  it('muestra el mensaje vacío en ranking cuando no hay récords', async () => {
    const { default: GameRegistry } = await import('../js/core/gameRegistry');
    await import('../js/sidebarViews');

    GameRegistry.register({
      id: 'termita', name: 'Termita', tag: 'TEST', accent: '#000', icon: '🐜',
      num: '01', description: '', difficulty: 1,
      init: () => {}, stop: () => {}
    });

    dispatchViewShown('ranking');

    expect(document.getElementById('rankingList')?.innerHTML).toContain('Todavía no hay récords');
  });
});
