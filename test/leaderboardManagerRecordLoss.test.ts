import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/leaderboardManagerRecordLoss.test.ts
 *
 * Motivación: `save()` recorta `entries` a `maxEntries` (10 por
 * defecto) quedándose con las `maxEntries` PRIMERAS del array — que,
 * como cada partida nueva entra con `unshift()`, son las más
 * RECIENTES, no las de mayor valor. El propio comentario del código
 * dice "Mantener solo los mejores N", pero en realidad mantiene "los N
 * más recientes": si el jugador consigue su récord histórico y luego
 * juega `maxEntries` partidas más sin superarlo, esa entrada cae fuera
 * del array recortado y se pierde para siempre — `getBest()` (y el
 * badge del lobby, que lo usa) empiezan a mostrar un valor menor al
 * verdadero mejor histórico del jugador.
 */
describe('Leaderboard.save no debe perder el récord histórico al recortar a maxEntries', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('el récord más alto sobrevive aunque se jueguen más de maxEntries partidas después', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');

    // Primera partida: un récord alto y memorable.
    Leaderboard.save('simon', 999);
    expect(Leaderboard.getBest('simon')?.value).toBe(999);

    // maxEntries por defecto es 10 — juega 10 partidas más, todas con
    // puntajes bajos que nunca superan el récord original.
    for (let i = 0; i < 10; i++) {
      Leaderboard.save('simon', 5);
    }

    // El récord de 999 debería seguir siendo el "mejor" reportado,
    // aunque ya no esté entre las 10 entradas más recientes.
    expect(Leaderboard.getBest('simon')?.value).toBe(999);
  });

  it('con maxEntries configurado en un valor bajo, el récord también debe sobrevivir', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    Leaderboard.setConfig('termita', { maxEntries: 3 });

    Leaderboard.save('termita', 500);
    Leaderboard.save('termita', 1);
    Leaderboard.save('termita', 1);
    Leaderboard.save('termita', 1);
    Leaderboard.save('termita', 1); // ya son 5 partidas, maxEntries=3

    expect(Leaderboard.getBest('termita')?.value).toBe(500);
  });

  it('preserva el orden cronológico (más reciente primero) tras recortar, no lo reordena por valor', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    Leaderboard.setConfig('arrow', { maxEntries: 3 });

    // Partida vieja con récord alto, seguida de 3 partidas más nuevas
    // con puntajes menores (que quedan dentro de maxEntries=3 junto
    // con el récord).
    Leaderboard.save('arrow', 100); // récord, más antigua
    Leaderboard.save('arrow', 10);
    Leaderboard.save('arrow', 20);
    Leaderboard.save('arrow', 30); // la más reciente

    const entries = Leaderboard.get('arrow');
    expect(entries).toHaveLength(3);
    // get()[0] debe seguir siendo la partida MÁS RECIENTE (30), no la
    // de mayor valor (100) — otros módulos (lobbyRenderer.ts,
    // lastPlayedOf) dependen de este orden para mostrar "última vez
    // jugado".
    expect(entries[0].value).toBe(30);
  });
});
