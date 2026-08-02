import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../js/achievements.js', () => ({
  achievementManager: {
    getAll: (): any[] => [], getUnlockedCount: (): number => 0, getTotalCount: (): number => 0,
    getTotalXP: (): number => 0, on: vi.fn(), off: vi.fn()
  }
}));
vi.mock('../js/customizationSystem.js', () => ({
  customizationSystem: {
    getAvatars: (): any[] => [], getSkins: (): any[] => [], getSoundPacks: (): any[] => [],
    getActiveAvatar: (): any => null, getActiveSkin: (): any => null, on: vi.fn(), off: vi.fn()
  }
}));
vi.mock('../js/advancedStats.js', () => ({
  advancedStatsSystem: {
    getMetrics: (): any => ({}), getCognitiveProfile: (): any => ({}),
    getWeaknesses: (): any[] => [], getStrengths: (): any[] => [], on: vi.fn(), off: vi.fn()
  }
}));
vi.mock('../js/socialSystem.js', () => ({
  socialSystem: {
    getFriends: (): any[] => [], getClan: (): any => null, getMessages: (): any[] => [],
    getProfile: (): any => ({}), getKudos: (): number => 0, on: vi.fn(), off: vi.fn()
  }
}));
vi.mock('../js/tournamentSystem.js', () => ({
  tournamentSystem: {
    getActiveTournaments: (): any[] => [], getTournamentHistory: (): any[] => [],
    getEvents: (): any[] => [], on: vi.fn(), off: vi.fn()
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

const cases: Array<{ id: string; logicPath: string }> = [
  { id: 'logros', logicPath: '../js/views/logros.logic.js' },
  { id: 'personalizacion', logicPath: '../js/views/personalizacion.logic.js' },
  { id: 'estadisticas-avanzadas', logicPath: '../js/views/estadisticasAvanzadas.logic.js' },
  { id: 'social', logicPath: '../js/views/social.logic.js' },
  { id: 'torneos', logicPath: '../js/views/torneos.logic.js' }
];

describe('bug fix: back-btn missing in non-lazy views without in-page back navigation', () => {
  beforeEach(() => {
    GameRegistry.reset();
    document.body.innerHTML = `
      <section id="home" class="view"></section>
      ${cases.map(c => `<section id="${c.id}" class="view hidden"></section>`).join('\n')}
    `;
    GameRegistry.register({
      id: 'home', name: '', tag: '', accent: '', icon: '', num: '', description: '', difficulty: 0,
      hidden: true, init: () => {}, stop: () => {}
    });
  });

  it.each(cases)('$id has a hydrated back-btn after init and navigates home on click', async ({ id, logicPath }) => {
    const logic = await import(/* @vite-ignore */ logicPath);
    GameRegistry.register({
      id, name: '', tag: '', accent: '', icon: '', num: '', description: '', difficulty: 0,
      hidden: true, init: logic.init, stop: logic.stop
    });

    ViewManager.showView(id);
    await new Promise(r => setTimeout(r, 0));

    const backBtn = document.getElementById(id)?.querySelector('.back-btn[data-back-to]') as HTMLElement | null;
    expect(backBtn, `expected a back-btn in #${id}`).toBeTruthy();
    expect(backBtn!.dataset.hydrated).toBe('true');

    backBtn!.click();
    await new Promise(r => setTimeout(r, 0));

    expect(ViewManager.getCurrentView()).toBe('home');
  });
});
