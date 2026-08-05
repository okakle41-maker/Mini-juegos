/**
 * leaderboardManager.ts — Sistema de puntuaciones y récords
 * Versión TypeScript con tipos fuertes
 */

import safeStorage from './core/safeStorage.js';
import { submitScore } from './globalScores.js';
import achievementManager from './achievements.js';
import progressionSystem from './progressionSystem.js';

export interface LeaderboardEntry {
  value: number;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface LeaderboardConfig {
  format?: (value: number) => string;
  maxEntries?: number;
}

type LeaderboardStore = Record<string, LeaderboardEntry[]>;

function isLeaderboardStore(value: unknown): value is LeaderboardStore {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entries) =>
      Array.isArray(entries) &&
      entries.every(
        (e) => typeof e === 'object' && e !== null && typeof (e as { value?: unknown }).value === 'number'
      )
  );
}

export class LeaderboardManager {
  private storageKey = 'minijuegos_leaderboard';
  private data: LeaderboardStore = {};
  private configs: Record<string, LeaderboardConfig> = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    this.data = safeStorage.getJSON<LeaderboardStore>(this.storageKey, {}, {
      validate: isLeaderboardStore,
    });
  }

  private saveToStorage(): void {
    safeStorage.setJSON(this.storageKey, this.data);
  }

  /**
   * Guarda una puntuación y retorna si es nuevo récord.
   *
   * `total` es opcional y representa, cuando el llamador lo pasa, la
   * cantidad de rondas/intentos configurados para esa partida (ej. Simon
   * y Termita dejan elegir entre 5-20 rondas). Se persiste como
   * `meta.total` — no como campo propio de LeaderboardEntry, para no
   * migrar el tipo — así "score: 8" se puede mostrar junto a "de 20
   * rondas" en vez de solo el número pelado, sin romper entradas guardadas
   * antes de este cambio (simplemente no tendrán meta.total y no se
   * muestra la fracción, ver renderProgress()/renderRanking() en
   * sidebarViews.ts).
   */
  save(gameKey: string, value: number, total?: number, meta: Record<string, unknown> = {}): { isNewRecord: boolean; value: number } | null {
    if (!gameKey || typeof value !== 'number') return null;

    if (!this.data[gameKey]) this.data[gameKey] = [];

    const entries = this.data[gameKey];
    const previousBest = entries.length === 0
      ? null
      : entries.reduce((best, entry) => (entry.value >= best.value ? entry : best));
    const isNewRecord = previousBest === null || value > previousBest.value;

    const entryMeta = typeof total === 'number' ? { ...meta, total } : meta;

    // Añadir nueva entrada
    entries.unshift({
      value,
      timestamp: new Date().toISOString(),
      meta: entryMeta
    });

    // Mantener solo los mejores N por VALOR, no los N más recientes —
    // pero preservando el orden cronológico (más reciente primero) del
    // array resultante, del que dependen otros módulos (ver
    // lobbyRenderer.ts: lastPlayedOf() lee get(gameId)[0] asumiendo que
    // es la partida más reciente).
    //
    // Antes, `entries.length = maxEntries` cortaba el array tal cual
    // quedaba tras el unshift() de arriba — como cada partida nueva
    // entra al frente, eso conservaba las `maxEntries` partidas más
    // RECIENTES, no las de mayor puntaje (pese a que el comentario de
    // este método decía "mejores N"). Un récord histórico alto se
    // perdía en silencio en cuanto el jugador acumulaba `maxEntries`
    // partidas más sin volver a superarlo: caía fuera del array
    // recortado y getBest()/el badge del lobby empezaban a reportar un
    // valor menor al verdadero mejor histórico.
    //
    // Fix: se identifican las `maxEntries` entradas de mayor `value`
    // (ordenando una copia, nunca el array real) y se recorta
    // preservando el orden cronológico original entre esas elegidas.
    const maxEntries = this.configs[gameKey]?.maxEntries ?? 10;
    if (entries.length > maxEntries) {
      const keep = new Set(
        [...entries]
          .sort((a, b) => b.value - a.value)
          .slice(0, maxEntries)
      );
      this.data[gameKey] = entries.filter((entry) => keep.has(entry));
    }

    this.saveToStorage();
    this.renderBadges();

    // Conecta cada partida jugada con los sistemas de logros y
    // progresión. Antes de este cambio, `save()` (el único punto que
    // los 23 juegos llaman al terminar una partida) no avisaba ni a
    // achievementManager ni a progressionSystem: sus métodos de
    // tracking (trackGamePlayed, updateQuestProgress, addXP, etc.)
    // nunca se invocaban desde ningún lado del código productivo. El
    // resultado era que toda la UI de logros y progresión (niveles,
    // XP, skill tree, daily quests) funcionaba perfectamente pero
    // nunca avanzaba: un jugador podía jugar cientos de partidas y
    // seguir en nivel 1 con todos los logros bloqueados.
    //
    // Solo enganchamos acá lo que se puede derivar honestamente de los
    // datos que `save()` realmente tiene (gameKey, value, isNewRecord):
    // partida jugada, quests de tipo "jugar N partidas"/"jugar este
    // juego"/"alcanzar X puntos", y XP base por partida. Dejamos
    // afuera trackGameCompleted() de achievements.ts (que exige
    // `duration` y `perfect`, datos que esta capa no tiene de forma
    // confiable) para no inventar esos valores — un juego que sí sepa
    // su duración real y si fue perfecto puede llamarlo directo.
    try {
      achievementManager.trackGamePlayed(gameKey);
      progressionSystem.updateQuestProgress('play_games', 1);
      progressionSystem.updateQuestProgress('play_specific', 1, gameKey);
      progressionSystem.updateQuestProgress('high_score', value, gameKey);
      progressionSystem.addXP(10, gameKey);
    } catch (error) {
      // No dejamos que un fallo en logros/progresión (p.ej. localStorage
      // lleno) impida que se guarde el score, que es lo esencial.
      window.ErrorLogger?.log('leaderboardManager.save.progressionHook', error, { gameKey });
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('leaderboard:updated', { detail: { gameKey, value, isNewRecord } }));
    }

    // Fire-and-forget: el guardado local de arriba ya se completó y es
    // lo que garantiza que el jugador vea su récord al instante, sin
    // esperar a la red. Si no hay sesión o Supabase falla, submitScore
    // no hace nada (ver globalScores.ts) — el juego funciona igual.
    void submitScore(gameKey, value, total);

    return { isNewRecord, value };
  }

  /**
   * Obtiene los récords de un juego
   */
  get(gameKey: string): LeaderboardEntry[] {
    return this.data[gameKey] || [];
  }

  /**
   * Mejor puntuación de un juego (por value), o null si no hay partidas.
   * `get()[0]` es la partida más reciente (unshift al guardar), no el
   * máximo — usar este helper cuando se necesita el récord real.
   */
  getBest(gameKey: string): LeaderboardEntry | null {
    const entries = this.get(gameKey);
    if (entries.length === 0) return null;
    return entries.reduce((best, entry) => (entry.value >= best.value ? entry : best));
  }

  /**
   * Historial cronológico (más antigua → más reciente) para gráficos
   * de evolución personal. Copia el array; no muta el store.
   */
  getHistory(gameKey: string): LeaderboardEntry[] {
    return [...this.get(gameKey)].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Aplana todas las entradas de todos los juegos en un único array,
   * ignorando a qué juego pertenece cada una. Usado por el HUD lateral
   * (panel "SEMANA") para contar partidas jugadas por día, sin importar
   * el minijuego — a diferencia de get(), que es por-juego.
   */
  getAllEntries(): LeaderboardEntry[] {
    return Object.values(this.data).flat();
  }

  /**
   * Renderiza badges en las tarjetas del lobby
   * Selector alineado a css/styles.css: .card-record-badge (con atributo hidden)
   */
  renderBadges(): void {
    document.querySelectorAll<HTMLElement>('.game-card').forEach((card) => {
      const gameId = card.getAttribute('data-game-id');
      if (!gameId) return;

      const best = this.getBest(gameId);
      const badgeEl = card.querySelector<HTMLElement>('.card-record-badge');
      if (!badgeEl) return;

      if (best) {
        const formatted = this.configs[gameId]?.format
          ? this.configs[gameId].format!(best.value)
          : best.value.toString();
        const total = getEntryTotal(best);
        const label = total !== null ? `${formatted}/${total}` : formatted;

        badgeEl.textContent = `⬡ ${label}`;
        badgeEl.hidden = false;
      } else {
        badgeEl.hidden = true;
      }
    });
  }

  /**
   * Configura formato y opciones por juego
   */
  setConfig(gameKey: string, config: LeaderboardConfig): void {
    this.configs[gameKey] = config;
  }

  /**
   * Limpia todos los datos (útil para testing)
   */
  clear(): void {
    this.data = {};
    this.saveToStorage();
  }
}

// Instancia única
const Leaderboard = new LeaderboardManager();

export default Leaderboard;

/**
 * Lee `meta.total` de una entrada de forma segura, si está presente.
 * `meta` es `Record<string, unknown>`, así que esto centraliza el único
 * guard de tipo necesario en vez de repetir `typeof entry.meta?.total ===
 * 'number'` en cada vista que quiera mostrar la fracción "score/total"
 * (ver renderProgress()/renderRanking() en sidebarViews.ts).
 */
export function getEntryTotal(entry: LeaderboardEntry): number | null {
  const total = entry.meta?.total;
  return typeof total === 'number' ? total : null;
}

// Compatibilidad legacy
window.Leaderboard = Leaderboard;