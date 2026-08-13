import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks alineados a la API real de cada módulo (ver achievements.ts,
// customizationSystem.ts, advancedStats.ts, socialSystem.ts,
// tournamentSystem.ts). Antes estos mocks exponían métodos que nunca
// existieron en ninguna versión de estos módulos (getAll,
// getUnlockedCount, getMetrics, getFriends/getClan/getProfile a nivel
// top del mock, on/off como si fueran event emitters) — no coincidían
// ni con la API vieja ni con la nueva, así que las cuatro vistas ya
// venían recibiendo `undefined` en cada llamada y dependían del hecho
// de que sus versiones .logic.ts originales escribían el markup
// estático (con el back-btn) ANTES de leer estos managers, así que un
// TypeError ahí nunca llegaba a impedir que el botón existiera. Con
// logros.logic.tsx y personalizacion.logic.tsx migrados a Preact
// (donde todo el árbol se monta en un solo render()), un mock que no
// responde a los métodos reales sí puede tirar abajo el componente
// completo — de ahí que haga falta que estos mocks devuelvan datos
// válidos y no solo objetos vacíos con nombres inventados.
vi.mock('../js/achievements.js', () => ({
  achievementManager: {
    getAchievements: (): any[] => [],
    getUnlockedAchievements: (): any[] => [],
    getAchievementProgress: (): number => 0,
    getTotalXP: (): number => 0,
    getUnlockedTitles: (): string[] => [],
    getActiveTitle: (): string => '',
    setActiveTitle: (): void => {},
    getUnlockedCosmetics: (): string[] => [],
  }
}));
vi.mock('../js/customizationSystem.js', () => ({
  customizationSystem: {
    getAvatars: (): any[] => [],
    getSkins: (): any[] => [],
    getSkinsByType: (): any[] => [],
    getSoundPacks: (): any[] => [],
    getProfileFrames: (): any[] => [],
    getVictoryAnimations: (): any[] => [],
    getThemes: (): any[] => [],
    getCurrentCustomization: (): any => ({
      activeAvatar: '', activeSkins: [], activeSoundPack: '',
      activeProfileFrame: '', activeVictoryAnimation: '', activeTheme: '', customThemes: []
    }),
    setActiveAvatar: (): boolean => true,
    toggleSkin: (): boolean => true,
    setActiveSoundPack: (): boolean => true,
    setActiveProfileFrame: (): boolean => true,
    setActiveVictoryAnimation: (): boolean => true,
    playVictoryAnimation: (): void => {},
    setActiveTheme: (): boolean => true,
    createCustomTheme: (): string => 'theme_custom',
  }
}));
vi.mock('../js/advancedStats.js', () => ({
  advancedStatsSystem: {
    getPerformanceMetrics: (): any => ({ accuracy: 0, speed: 0, consistency: 0, improvement: 0 }),
    getCognitiveProfile: (): any => ({}),
    getWeaknessAnalysis: (): any[] => [],
    getStrengthAnalysis: (): any[] => [],
    getCategoryAnalysis: (): any => ({}),
    getHeatmapData: (): any[] => [],
    getWeeklyPlaytime: (): number[] => [],
    getMonthlyPlaytime: (): number[] => [],
    getPredictionData: (): any => ({}),
    exportStats: (): string => '{}',
    importStats: (): boolean => true,
    resetStats: (): void => {},
  }
}));
vi.mock('../js/socialSystem.js', () => ({
  socialSystem: {
    getFriends: (): any[] => [],
    getFriendRequests: (): any[] => [],
    sendFriendRequest: (): void => {},
    acceptFriendRequest: (): void => {},
    declineFriendRequest: (): void => {},
    getChatMessages: (): any[] => [],
    sendChatMessage: (): void => {},
    getProfilePosts: (): any[] => [],
    createProfilePost: (): void => {},
    getSocialStats: (): any => ({
      friendsCount: 0, clanMembersCount: 0, kudosReceived: 0, kudosGiven: 0, postsCount: 0, likesReceived: 0
    }),
  }
}));
vi.mock('../js/tournamentSystem.js', () => ({
  tournamentSystem: {
    getActiveTournaments: (): any[] => [],
    getTournamentHistory: (): any[] => [],
    registerForTournament: (): boolean => true,
    getEvents: (): any[] => [],
    getActiveEvents: (): any[] => [],
    getCurrentEvent: (): any => null,
    applyEventTheme: (): void => {},
    removeEventTheme: (): void => {},
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
