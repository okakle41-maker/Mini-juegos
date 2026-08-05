/**
 * Tests para achievements.ts — getAchievementProgress()
 *
 * Cubre dos bugs encontrados en la barra de progreso de logros
 * (js/views/logros.logic.ts lee este valor directamente):
 *
 * 1. Los logros 'sequential' (chain_master_1/2/3) leían la clave fija
 *    'sequential_progress', pero trackSequentialProgress() guarda bajo
 *    `sequential_${chainId}` — nunca coincidían, así que la barra se
 *    quedaba en 0% aunque hubiera progreso real.
 * 2. Los logros 'game_specific' con condition no acumulativa (p.ej.
 *    'avg_reaction' de arrow_speed, que requiere un promedio MENOR al
 *    valor, o 'perfect', que es booleano) usaban el conteo de partidas
 *    jugadas como si fuera el progreso, dando porcentajes sin relación
 *    con el requisito real.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AchievementManager.getAchievementProgress', () => {
  let achievementManager: typeof import('../js/achievements').default;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    const mod = await import('../js/achievements');
    achievementManager = mod.default;
  });

  it('refleja el progreso de una cadena secuencial (chain_master_2)', () => {
    // Sin progreso todavía: 0%
    expect(achievementManager.getAchievementProgress('chain_master_2')).toBe(0);

    // trackSequentialProgress guarda bajo `sequential_chain_master`
    // (chainId derivado del id del logro sin el sufijo numérico).
    // chain_master_2 requiere value=2, así que con step=1 debe marcar
    // 50%, no seguir en 0%.
    (achievementManager as any).trackSequentialProgress('chain_master', 1);

    expect(achievementManager.getAchievementProgress('chain_master_2')).toBe(50);
  });

  it('no usa el conteo de partidas jugadas como progreso de un logro por avg_reaction', () => {
    // arrow_speed: game_specific, condition 'avg_reaction', value 500.
    // Simulamos que el jugador jugó varias partidas de 'arrow' sin
    // cumplir el umbral todavía: el conteo de partidas sube mucho,
    // pero eso no debería traducirse en progreso hacia el logro.
    for (let i = 0; i < 50; i++) {
      achievementManager.trackGamePlayed('arrow');
    }

    const progress = achievementManager.getAchievementProgress('arrow_speed');
    // Antes del fix esto daba (50 / 500) * 100 = 10%, un número sin
    // relación con el tiempo de reacción real.
    expect(progress).toBe(0);
  });

  it('sigue calculando bien el progreso de logros acumulativos normales (games_played)', () => {
    for (let i = 0; i < 5; i++) {
      achievementManager.trackGamePlayed('termita');
    }
    // ten_games requiere 10 partidas jugadas en total.
    expect(achievementManager.getAchievementProgress('ten_games')).toBe(50);
  });
});
