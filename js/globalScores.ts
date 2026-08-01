/**
 * globalScores.ts — Puente entre el leaderboard local y el scoreboard
 * global (Supabase). Separado de leaderboardManager.ts a propósito:
 *
 *   - leaderboardManager.ts sigue siendo 100% local y síncrono, sin
 *     dependencia de red — el juego funciona offline exactamente igual
 *     que antes de agregar cuentas de usuario.
 *   - Este módulo es la única parte de la app que le habla a la red
 *     para scores. Si Supabase está caído o el usuario no tiene
 *     conexión, `submitScore` falla en silencio (logueado vía
 *     ErrorLogger) sin afectar el guardado local, que ya ocurrió antes
 *     de que se llame a este módulo.
 *
 * La seguridad real de "no podés subir un score a nombre de otro
 * usuario" la impone Row Level Security en la base de datos (ver
 * supabase/schema.sql: scores_insert_own exige auth.uid() = user_id),
 * no este archivo — cualquier intento de falsear el user_id desde acá
 * sería rechazado igual por la base de datos.
 */

import { getSupabaseClient } from './core/supabaseClient.js';
import Auth from './authManager.js';
import { showToast } from './toast.js';
import ErrorLogger from './core/errorLogger.js';

export interface GlobalScoreRow {
  username: string;
  value: number;
  total: number | null;
  createdAt: string;
}

/**
 * Sube el score a la tabla global si hay un usuario logueado. No hace
 * nada (silenciosamente) si no hay sesión — el guardado local en
 * leaderboardManager.ts ya ocurrió de todas formas, así que el jugador
 * sin cuenta no pierde su récord local por no estar logueado.
 */
export async function submitScore(gameKey: string, value: number, total?: number): Promise<void> {
  const user = Auth.getUser();
  if (!user) return;

  // Se llama como `void submitScore(...)` fire-and-forget desde
  // leaderboardManager.ts, sin .catch() en el call site — si
  // getSupabaseClient() rechaza (p.ej. offline al terminar una
  // partida, el import() dinámico del SDK no puede descargar), sin
  // este try/catch era un unhandled promise rejection real en cada
  // partida jugada sin conexión, no solo un score no subido.
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('scores').insert({
      user_id: user.id,
      game_key: gameKey,
      value,
      total: typeof total === 'number' ? total : null,
    });

    if (error) {
      ErrorLogger.log('globalScores.submitScore', error, { gameKey, value });
      // El trigger de supabase/migration_002_rate_limit_scores.sql
      // rechaza con SQLSTATE P0001 y un mensaje propio cuando el
      // usuario superó el umbral de scores por minuto — se distingue
      // ese caso para mostrar un mensaje específico en vez del genérico
      // de "no se pudo subir", que induciría a pensar que es un
      // problema de red y no algo que se resuelve solo esperando.
      if (error.code === 'P0001' || /demasiadas puntuaciones/i.test(error.message ?? '')) {
        showToast('Estás enviando puntuaciones muy rápido. Esperá un momento.', {
          variant: 'warning',
        });
        return;
      }
      // Tu récord local ya está guardado (leaderboardManager.ts, antes de
      // esta llamada) — este toast es solo para que sepas que no llegó al
      // ranking global, no una advertencia de que perdiste tu progreso.
      showToast('No se pudo subir tu puntuación al ranking global. Tu récord local está a salvo.', {
        variant: 'warning',
      });
    }
  } catch (error) {
    ErrorLogger.log('globalScores.submitScore', error, { gameKey, value });
    showToast('No se pudo subir tu puntuación al ranking global. Tu récord local está a salvo.', {
      variant: 'warning',
    });
  }
}

/**
 * Trae el top N del scoreboard global de un juego, usando la vista
 * best_scores (ya filtra al mejor score de cada usuario en ese juego,
 * ver supabase/schema.sql) para no traer partidas repetidas del mismo
 * jugador y tener que deduplicar en el cliente.
 */
export async function fetchGlobalTop(gameKey: string, limit = 10): Promise<GlobalScoreRow[]> {
  // sidebarViews.ts hace `await fetchGlobalTop(...)` sin su propio
  // try/catch — si getSupabaseClient() rechaza acá, sin este try/catch
  // el error se propagaría y probablemente rompería el render de esa
  // vista en vez de simplemente devolver [] como ya se hace para el
  // resto de los casos de error de esta función.
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('best_scores')
      .select('username, value, total, created_at')
      .eq('game_key', gameKey)
      .order('value', { ascending: false })
      .limit(limit);

    if (error || !data) {
      ErrorLogger.log('globalScores.fetchGlobalTop', error, { gameKey });
      return [];
    }

    return data.map((row) => ({
      username: row.username,
      value: row.value,
      total: row.total,
      createdAt: row.created_at,
    }));
  } catch (error) {
    ErrorLogger.log('globalScores.fetchGlobalTop', error, { gameKey });
    return [];
  }
}

