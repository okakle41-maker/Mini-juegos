import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categorySlug } from '../js/utils/categorySlug';

describe('categorySlug', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(categorySlug('PERCEPCIÓN')).toBe('percepcion');
    expect(categorySlug('ANÁLISIS')).toBe('analisis');
    expect(categorySlug('LÓGICA')).toBe('logica');
    expect(categorySlug('REFLEJOS')).toBe('reflejos');
  });
});

describe('Leaderboard.getBest / getHistory', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('getBest devuelve el máximo aunque no sea la partida más reciente', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');

    Leaderboard.save('arrow', 40);
    Leaderboard.save('arrow', 90);
    Leaderboard.save('arrow', 55);

    const best = Leaderboard.getBest('arrow');
    expect(best?.value).toBe(90);
    // get()[0] sigue siendo la más reciente
    expect(Leaderboard.get('arrow')[0].value).toBe(55);
  });

  it('getHistory ordena de más antigua a más reciente', async () => {
    vi.useFakeTimers();
    const { default: Leaderboard } = await import('../js/leaderboardManager');

    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    Leaderboard.save('simon', 3, 10);
    vi.setSystemTime(new Date('2026-01-02T12:00:00.000Z'));
    Leaderboard.save('simon', 7, 10);
    vi.setSystemTime(new Date('2026-01-03T12:00:00.000Z'));
    Leaderboard.save('simon', 5, 10);

    const history = Leaderboard.getHistory('simon');
    expect(history.map(e => e.value)).toEqual([3, 7, 5]);
    vi.useRealTimers();
  });

  it('isNewRecord compara contra el mejor real, no contra el último', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');

    expect(Leaderboard.save('typix', 50)?.isNewRecord).toBe(true);
    expect(Leaderboard.save('typix', 80)?.isNewRecord).toBe(true);
    expect(Leaderboard.save('typix', 60)?.isNewRecord).toBe(false);
    expect(Leaderboard.save('typix', 80)?.isNewRecord).toBe(false);
    expect(Leaderboard.save('typix', 81)?.isNewRecord).toBe(true);
  });
});
