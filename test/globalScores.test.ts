/**
 * Tests para globalScores.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const scoresInsert = vi.fn();
const bestScoresSelect = vi.fn();

// getSupabaseClientImpl es reasignable por test para simular un fallo de
// red al cargar el SDK (import() dinámico rechazando) — por defecto
// resuelve el cliente mockeado normal.
let getSupabaseClientImpl = async () => ({
  from: (table: string) => {
    if (table === 'scores') {
      return { insert: scoresInsert };
    }
    if (table === 'best_scores') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: bestScoresSelect,
            }),
          }),
        }),
      };
    }
    throw new Error(`tabla inesperada en el mock: ${table}`);
  },
});

vi.mock('../js/core/supabaseClient', () => ({
  getSupabaseClient: () => getSupabaseClientImpl(),
}));

const getUserMock = vi.fn();
vi.mock('../js/authManager', () => ({
  default: { getUser: getUserMock },
}));

const showToastMock = vi.fn();
vi.mock('../js/toast', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

const errorLoggerMock = { log: vi.fn(), setSink: vi.fn(), recent: () => [], clear: vi.fn() };
vi.mock('../js/core/errorLogger', () => ({
  default: errorLoggerMock,
}));

describe('globalScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseClientImpl = async () => ({
      from: (table: string) => {
        if (table === 'scores') {
          return { insert: scoresInsert };
        }
        if (table === 'best_scores') {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: bestScoresSelect,
                }),
              }),
            }),
          };
        }
        throw new Error(`tabla inesperada en el mock: ${table}`);
      },
    });
    scoresInsert.mockResolvedValue({ error: null });
    bestScoresSelect.mockResolvedValue({ data: [], error: null });
    errorLoggerMock.log.mockClear();
  });

  describe('submitScore', () => {
    it('no llama a Supabase si no hay sesión activa', async () => {
      getUserMock.mockReturnValue(null);
      const { submitScore } = await import('../js/globalScores');

      await submitScore('termita', 42);

      expect(scoresInsert).not.toHaveBeenCalled();
    });

    it('inserta el score con el user_id de la sesión activa', async () => {
      getUserMock.mockReturnValue({ id: 'u1', username: 'Jugador1' });
      const { submitScore } = await import('../js/globalScores');

      await submitScore('termita', 42, 5);

      expect(scoresInsert).toHaveBeenCalledWith({
        user_id: 'u1',
        game_key: 'termita',
        value: 42,
        total: 5,
      });
    });

    it('pasa total: null cuando no se provee total', async () => {
      getUserMock.mockReturnValue({ id: 'u1', username: 'Jugador1' });
      const { submitScore } = await import('../js/globalScores');

      await submitScore('typix', 3);

      expect(scoresInsert).toHaveBeenCalledWith(
        expect.objectContaining({ total: null })
      );
    });

    it('loguea el error vía ErrorLogger si el insert falla, sin lanzar', async () => {
      getUserMock.mockReturnValue({ id: 'u1', username: 'Jugador1' });
      scoresInsert.mockResolvedValue({ error: { message: 'network error' } });
      const { submitScore } = await import('../js/globalScores');

      await expect(submitScore('termita', 42)).resolves.toBeUndefined();
      expect(errorLoggerMock.log).toHaveBeenCalled();
    });

    it('no lanza (unhandled rejection) si falla la carga del SDK — se llama fire-and-forget sin catch desde leaderboardManager.ts', async () => {
      getUserMock.mockReturnValue({ id: 'u1', username: 'Jugador1' });
      getSupabaseClientImpl = () => Promise.reject(new Error('Failed to fetch dynamically imported module'));
      const { submitScore } = await import('../js/globalScores');

      await expect(submitScore('termita', 42)).resolves.toBeUndefined();
      expect(errorLoggerMock.log).toHaveBeenCalledWith(
        'globalScores.submitScore',
        expect.any(Error),
        expect.anything()
      );
    });

    it('muestra un toast de advertencia genérico si el insert falla por un error que no es rate limit', async () => {
      getUserMock.mockReturnValue({ id: 'u1', username: 'Jugador1' });
      scoresInsert.mockResolvedValue({ error: { message: 'connection timeout' } });
      const { submitScore } = await import('../js/globalScores');

      await submitScore('termita', 42);

      expect(showToastMock).toHaveBeenCalledWith(
        expect.stringMatching(/no se pudo subir/i),
        expect.objectContaining({ variant: 'warning' })
      );
    });

    it('muestra un mensaje específico de rate limit cuando el trigger SQL rechaza con P0001', async () => {
      getUserMock.mockReturnValue({ id: 'u1', username: 'Jugador1' });
      scoresInsert.mockResolvedValue({
        error: { code: 'P0001', message: 'Demasiadas puntuaciones enviadas en poco tiempo. Esperá un momento.' },
      });
      const { submitScore } = await import('../js/globalScores');

      await submitScore('termita', 42);

      expect(showToastMock).toHaveBeenCalledWith(
        expect.stringMatching(/muy rápido/i),
        expect.objectContaining({ variant: 'warning' })
      );
      // No debe mostrar además el toast genérico de "no se pudo subir" —
      // el caso de rate limit devuelve (return) antes de llegar a esa rama.
      expect(showToastMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchGlobalTop', () => {
    it('devuelve las filas mapeadas desde best_scores', async () => {
      bestScoresSelect.mockResolvedValue({
        data: [{ username: 'Ana', value: 99, total: 5, created_at: '2026-01-01T00:00:00.000Z' }],
        error: null,
      });
      const { fetchGlobalTop } = await import('../js/globalScores');

      const rows = await fetchGlobalTop('termita');

      expect(rows).toEqual([
        { username: 'Ana', value: 99, total: 5, createdAt: '2026-01-01T00:00:00.000Z' },
      ]);
    });

    it('devuelve array vacío (no lanza) si la consulta falla', async () => {
      bestScoresSelect.mockResolvedValue({ data: null, error: { message: 'boom' } });
      const { fetchGlobalTop } = await import('../js/globalScores');

      const rows = await fetchGlobalTop('termita');

      expect(rows).toEqual([]);
      expect(errorLoggerMock.log).toHaveBeenCalled();
    });

    it('devuelve array vacío (no lanza) si falla la carga del SDK', async () => {
      getSupabaseClientImpl = () => Promise.reject(new Error('Failed to fetch dynamically imported module'));
      const { fetchGlobalTop } = await import('../js/globalScores');

      const rows = await fetchGlobalTop('termita');

      expect(rows).toEqual([]);
      expect(errorLoggerMock.log).toHaveBeenCalledWith(
        'globalScores.fetchGlobalTop',
        expect.any(Error),
        expect.anything()
      );
    });
  });
});
