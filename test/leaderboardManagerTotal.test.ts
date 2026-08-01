import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/leaderboardManagerTotal.test.ts
 *
 * Motivación: `Leaderboard.save(gameKey, value, total)` recibía `total`
 * (simon.logic.ts y termita.logic.ts lo pasan como cantidad de rondas
 * configuradas para la partida) pero lo descartaba en silencio — no
 * había ningún campo en LeaderboardEntry para persistirlo, así que un
 * récord de "8 aciertos" no distinguía si la partida era de 8/8 rondas
 * o 8/20. Ver la sección "Pendiente / decisión de producto" del README
 * (ahora resuelta) para el contexto completo de por qué no se tocó
 * antes: decidir cómo mostrarlo requería una decisión de producto, no
 * solo destapar el dato.
 *
 * Se decidió persistirlo en `meta.total` (el campo `meta` ya existía y
 * ya era opcional) en vez de agregar un campo propio a LeaderboardEntry,
 * para no requerir migrar entradas guardadas antes de este cambio.
 */

describe('Leaderboard.save persiste total en meta.total', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('guarda meta.total cuando se pasa un total numérico', async () => {
    const { default: Leaderboard, getEntryTotal } = await import('../js/leaderboardManager');

    Leaderboard.save('simon', 8, 20);

    const entry = Leaderboard.get('simon')[0];
    expect(entry.value).toBe(8);
    expect(getEntryTotal(entry)).toBe(20);
  });

  it('no agrega meta.total cuando el llamador no pasa total (comportamiento retrocompatible)', async () => {
    const { default: Leaderboard, getEntryTotal } = await import('../js/leaderboardManager');

    // La mayoría de los juegos llama a save(gameKey, value) sin total —
    // esto no debe crashear ni inventar un total inexistente.
    Leaderboard.save('circle-game', 1500);

    const entry = Leaderboard.get('circle-game')[0];
    expect(getEntryTotal(entry)).toBeNull();
  });

  it('preserva el resto de meta al agregar total', async () => {
    const { default: Leaderboard, getEntryTotal } = await import('../js/leaderboardManager');

    Leaderboard.save('termita', 12, 15, { difficulty: 'hard' });

    const entry = Leaderboard.get('termita')[0];
    expect(entry.meta?.difficulty).toBe('hard');
    expect(getEntryTotal(entry)).toBe(15);
  });

  it('getEntryTotal devuelve null ante datos corruptos o de forma inesperada (no crashea)', async () => {
    const { getEntryTotal } = await import('../js/leaderboardManager');

    expect(getEntryTotal({ value: 1, timestamp: '', meta: { total: 'no-es-un-numero' } })).toBeNull();
    expect(getEntryTotal({ value: 1, timestamp: '' })).toBeNull();
  });
});
