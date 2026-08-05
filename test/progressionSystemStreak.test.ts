import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/progressionSystemStreak.test.ts
 *
 * Motivación: updateStreak() se llama desde completeQuest(), que se
 * dispara una vez POR CADA quest completada — y en un día normal el
 * jugador puede completar varias (hasta 5 quests diarias). La
 * condición `daysSinceLastReset <= 1` incrementaba el streak en cada
 * una de esas llamadas, así que completar 3 quests el mismo día sumaba
 * +3 al streak en vez de +1 por día.
 */
describe('ProgressionSystem — streak no se infla por completar varias quests el mismo día', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('completar varias quests el mismo día solo suma 1 al streak', async () => {
    const { default: progressionSystem } = await import('../js/progressionSystem');

    const streakBefore = progressionSystem.getStreak();

    const quests = progressionSystem.getDailyQuests();
    // Completamos manualmente el progreso de al menos 2 quests
    // distintas del mismo día, vía las APIs públicas.
    progressionSystem.updateQuestProgress('play_games', quests.find(q => q.type === 'play_games')!.target);
    progressionSystem.updateQuestProgress('complete_games', quests.find(q => q.type === 'complete_games')!.target);

    const streakAfter = progressionSystem.getStreak();

    // Antes del fix, dos quests completadas el mismo día sumaban +2.
    expect(streakAfter - streakBefore).toBe(1);
  });
});
