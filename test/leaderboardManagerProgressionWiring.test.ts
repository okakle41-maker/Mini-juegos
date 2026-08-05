import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/leaderboardManagerProgressionWiring.test.ts
 *
 * Motivación: ni achievementManager.trackGamePlayed()/trackGameCompleted()
 * ni progressionSystem.updateQuestProgress()/addXP() se llamaban desde
 * ningún lugar del código productivo. El único punto que los 23 juegos
 * llaman al terminar una partida es Leaderboard.save(). Resultado: toda
 * la UI de logros y progresión (niveles, XP, skill tree, daily quests)
 * funcionaba pero nunca avanzaba con el juego real — el jugador podía
 * jugar cientos de partidas y seguir en nivel 1 con todo bloqueado.
 *
 * Este test cubre que save() ahora efectivamente empuja el progreso
 * hacia esos dos sistemas.
 */
describe('Leaderboard.save conecta con achievementManager y progressionSystem', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('trackGamePlayed se dispara para el juego correcto al guardar un score', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    const { default: achievementManager } = await import('../js/achievements');

    expect(achievementManager.getAchievementProgress('ten_games')).toBe(0);

    for (let i = 0; i < 5; i++) {
      Leaderboard.save('simon', 42);
    }

    // ten_games requiere 10 partidas jugadas (cualquier juego).
    expect(achievementManager.getAchievementProgress('ten_games')).toBe(50);
  });

  it('el logro first_game se desbloquea jugando una sola partida vía Leaderboard.save', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    const { default: achievementManager } = await import('../js/achievements');

    expect(achievementManager.getAchievementById('first_game')?.unlocked).toBe(false);
    Leaderboard.save('termita', 10);
    expect(achievementManager.getAchievementById('first_game')?.unlocked).toBe(true);
  });

  it('progressionSystem gana XP al guardar un score', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    const { default: progressionSystem } = await import('../js/progressionSystem');

    const xpBefore = progressionSystem.getCurrentXP();
    Leaderboard.save('arrow', 7);
    expect(progressionSystem.getCurrentXP()).toBeGreaterThan(xpBefore);
  });

  it('la quest diaria "jugar N partidas" avanza al guardar scores', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    const { default: progressionSystem } = await import('../js/progressionSystem');

    const quest = progressionSystem.getDailyQuests().find(q => q.type === 'play_games');
    expect(quest?.progress).toBe(0);

    Leaderboard.save('simon', 1);

    const questAfter = progressionSystem.getDailyQuests().find(q => q.type === 'play_games');
    expect(questAfter?.progress).toBe(1);
  });

  it('un fallo en el hook de progresión no impide guardar el score', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    const { default: achievementManager } = await import('../js/achievements');

    vi.spyOn(achievementManager, 'trackGamePlayed').mockImplementation(() => {
      throw new Error('boom');
    });

    const result = Leaderboard.save('simon', 55);
    expect(result?.value).toBe(55);
    expect(Leaderboard.getBest('simon')?.value).toBe(55);
  });
});
