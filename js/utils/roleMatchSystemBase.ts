/**
 * js/utils/roleMatchSystemBase.ts
 *
 * Boilerplate compartido por los minijuegos cooperativos de N jugadores
 * con roles fijos dentro de un lobby: signalTriangulationSystem (3),
 * shipControlSystem (4), fragmentedLabyrinthSystem (4).
 *
 * Extraído después de comparar los 3 archivos línea por línea (ver
 * discusión previa a esta clase): NO todo lo que se veía repetido lo
 * era en verdad. `leaveCurrentMatch()` en particular tiene una
 * estrategia distinta en Fragmented Labyrinth (guarda optimista con
 * `.eq('status','playing')`) que en Signal Triangulation/Ship Control
 * (select previo + update) — forzar eso a un método común habría
 * cambiado comportamiento real, así que se queda en cada archivo. Lo
 * que SÍ es idéntico en estructura, y vive acá:
 *
 *   - init de Supabase + espera de inicialización + requireClient()
 *   - requireAuthenticatedPlayerId() (exige sesión real, sin caer a un
 *     id anónimo — los 3 juegos comparten esa decisión de producto)
 *   - loadLobbyMatches(): trae las partidas 'waiting'/'playing' del
 *     lobby actual y arranca la suscripción a nivel de lobby
 *   - setupLobbyRealtimeSubscriptions / teardownLobbyRealtimeSubscriptions
 *   - teardownMatchRealtimeSubscriptions (el setup de la suscripción a
 *     UNA partida puntual sigue en cada archivo: el filtro de columnas
 *     que dispara el handler varía por juego — event:'*' en ST/SC vs
 *     event:'UPDATE' en FL — y no vale la pena parametrizar eso acá)
 *
 * Cada juego provee, vía el constructor, los puntos que sí varían:
 * nombre de tabla, nombre del módulo (para logs), mensaje de "necesitás
 * sesión", prefijo de canal de lobby, nombre de evento base para los
 * CustomEvent, el set de status que cuentan como "terminada" (para
 * saber cuándo borrar una fila de lobbyMatches en vez de actualizarla),
 * y una función `rowToMatch` para el mapeo fila→tipo específico del
 * juego (no se puede generalizar sin perder tipado fuerte del lado de
 * cada módulo).
 */

import Auth from '../authManager.js';
import { lobbySystem } from '../lobbySystem.js';
import ErrorLogger from '../core/errorLogger.js';
import type { SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * import() dinámico inline en vez de un import estático de
 * supabaseClient.ts arriba del archivo — ver el comentario homónimo en
 * authManager.ts para el porqué: un solo import estático de
 * supabaseClient.ts en cualquiera de sus 4 consumidores le impedía a
 * Rolldown separar '@supabase/supabase-js' en su propio chunk lazy
 * para los otros tres también.
 */
async function getSupabaseClientLazy(): Promise<SupabaseClient> {
  const { getSupabaseClient } = await import('../core/supabaseClient.js');
  return getSupabaseClient();
}

export interface RoleMatchSystemConfig<TMatch> {
  /** Nombre de la tabla de partidas (sin "public."), p.ej. 'ship_control_matches'. */
  table: string;
  /** Prefijo para logs de ErrorLogger, p.ej. 'shipControlSystem'. */
  moduleName: string;
  /** Nombre del juego tal como debe aparecer en el mensaje de "necesitás sesión", p.ej. 'Centro de Control'. */
  gameLabel: string;
  /** Prefijo del canal Realtime de lobby, p.ej. 'sc_lobby_matches'. */
  lobbyChannelPrefix: string;
  /** Prefijo de los CustomEvent que dispara este módulo, p.ej. 'sc' → 'sc:matches_changed'. */
  eventPrefix: string;
  /** Status de `status` que cuentan como partida terminada — esas filas se BORRAN de lobbyMatches en vez de actualizarse. */
  terminalStatuses: string[];
  /**
   * Mapea una fila cruda de Supabase al tipo de partida específico del
   * juego. `row` se tipa `unknown` (no `any`) a propósito: cada juego
   * que extiende esta base tiene su propia tabla/esquema (Signal
   * Triangulation, Ship Control, Fragmented Labyrinth), así que esta
   * clase base no puede — ni debe — conocer su forma. Cada
   * implementación de rowToMatch hace el cast/validación puntual a su
   * propio tipo de fila.
   */
  rowToMatch: (row: unknown) => TMatch;
  /** Extrae el `id` de una TMatch ya mapeada (evita asumir que siempre se llama `.id`). */
  getMatchId: (match: TMatch) => string;
}

export abstract class RoleMatchSystemBase<TMatch> {
  protected supabaseClient: SupabaseClient | null = null;
  protected isConnected = false;
  protected initPromise: Promise<void>;

  protected currentMatch: TMatch | null = null;
  protected channels: RealtimeChannel[] = [];

  /**
   * Partidas 'waiting'/'playing' que este cliente conoce del lobby
   * actual — igual rol que lobbySystem.matches para lobby_matches.
   */
  protected lobbyMatches: Map<string, TMatch> = new Map();
  protected lobbyChannel: RealtimeChannel | null = null;

  protected readonly config: RoleMatchSystemConfig<TMatch>;

  constructor(config: RoleMatchSystemConfig<TMatch>) {
    this.config = config;
    this.initPromise = this.initializeSupabase();
  }

  private async initializeSupabase(): Promise<void> {
    try {
      this.supabaseClient = await getSupabaseClientLazy();
      this.isConnected = true;
    } catch (e) {
      ErrorLogger?.log(`${this.config.moduleName}.init`, e, {});
      this.isConnected = false;
    }
  }

  protected async waitForInitialization(): Promise<void> {
    await this.initPromise;
  }

  protected requireClient(): SupabaseClient {
    if (!this.supabaseClient || !this.isConnected) {
      throw new Error('No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.');
    }
    return this.supabaseClient;
  }

  /**
   * Id real del jugador — a diferencia de lobbySystem.currentPlayerId(),
   * acá NO se cae a un id anónimo de localStorage: los 3 juegos que usan
   * esta base exigen sesión iniciada porque hay algo que ocultar entre
   * los propios jugadores del equipo. Lanza si no hay sesión, para que
   * el llamador (la UI de "unirse a esta partida") pueda redirigir a
   * login en vez de que el insert falle silenciosamente recién al
   * escribir en la tabla de estado oculto.
   */
  requireAuthenticatedPlayerId(): string {
    const user = Auth.getUser();
    if (!user) {
      throw new Error(`Necesitás iniciar sesión para jugar ${this.config.gameLabel}.`);
    }
    return user.id;
  }

  isPlayerEligible(): boolean {
    return Auth.isLoggedIn();
  }

  getCurrentMatch(): TMatch | null {
    return this.currentMatch;
  }

  /**
   * Partidas 'waiting'/'playing' conocidas del lobby actual — igual rol
   * que lobbySystem.getMatches() para lobby_matches.
   */
  getMatches(): TMatch[] {
    return Array.from(this.lobbyMatches.values());
  }

  /**
   * Trae las partidas 'waiting'/'playing' del lobby actual y arranca la
   * suscripción Realtime a nivel de lobby (no de una partida puntual).
   * Se debe llamar al entrar a la vista que muestra la lista, no
   * automáticamente al construirse el módulo, porque no tiene sentido
   * mantener esta suscripción activa mientras el usuario está jugando
   * otra cosa.
   */
  async loadLobbyMatches(): Promise<TMatch[]> {
    await this.waitForInitialization();
    const lobby = lobbySystem.getCurrentLobby();
    if (!lobby) {
      this.lobbyMatches.clear();
      return [];
    }
    const client = this.requireClient();

    const { data, error } = await client
      .from(this.config.table)
      .select('*')
      .eq('lobby_id', lobby.id)
      .in('status', ['waiting', 'playing']);
    if (error) {
      ErrorLogger?.log(`${this.config.moduleName}.loadLobbyMatches`, error, {});
      return this.getMatches();
    }

    this.lobbyMatches.clear();
    (data ?? []).forEach((row: unknown) => {
      const match = this.config.rowToMatch(row);
      this.lobbyMatches.set(this.config.getMatchId(match), match);
    });

    this.setupLobbyRealtimeSubscriptions(lobby.id);
    return this.getMatches();
  }

  /**
   * Detiene la suscripción a nivel de lobby (lista de partidas) sin
   * afectar una eventual suscripción a la partida propia — se llama al
   * salir de la vista que muestra la lista.
   */
  stopWatchingLobbyMatches(): void {
    this.teardownLobbyRealtimeSubscriptions();
  }

  /**
   * Suscripción a nivel de LOBBY (todas las partidas de este juego en
   * el lobby actual, no solo la propia) — análoga a lobbySystem's
   * matchesChannel para lobby_matches. Mantiene lobbyMatches actualizado
   * y dispara `${eventPrefix}:matches_changed`. Independiente de la
   * suscripción a una partida puntual (esa sigue viviendo en cada
   * archivo concreto, con su propio filtro de eventos) — ambas pueden
   * estar activas a la vez sin pisarse (channels distintos).
   */
  protected setupLobbyRealtimeSubscriptions(lobbyId: string): void {
    if (!this.supabaseClient || !this.isConnected) return;
    this.teardownLobbyRealtimeSubscriptions();

    this.lobbyChannel = this.supabaseClient
      .channel(`${this.config.lobbyChannelPrefix}_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: this.config.table, filter: `lobby_id=eq.${lobbyId}` }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        this.handleLobbyMatchesUpdate(payload);
      })
      .subscribe();
  }

  protected teardownLobbyRealtimeSubscriptions(): void {
    if (!this.supabaseClient || !this.lobbyChannel) return;
    this.supabaseClient.removeChannel(this.lobbyChannel).catch((error: unknown) => {
      ErrorLogger?.log(`${this.config.moduleName}.teardownLobbyRealtimeSubscriptions`, error, {});
    });
    this.lobbyChannel = null;
  }

  protected teardownMatchRealtimeSubscriptions(): void {
    if (!this.supabaseClient) return;
    const client = this.supabaseClient;
    this.channels.forEach((ch) => {
      client.removeChannel(ch).catch((error: unknown) => {
        ErrorLogger?.log(`${this.config.moduleName}.teardownMatchRealtimeSubscriptions`, error, {});
      });
    });
    this.channels = [];
  }

  private handleLobbyMatchesUpdate(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): void {
    const { eventType } = payload;
    const newRow = payload.new as Record<string, unknown> | undefined;
    const oldRow = payload.old as Record<string, unknown> | undefined;

    if (eventType === 'DELETE' || this.config.terminalStatuses.includes(newRow?.status as string)) {
      const id = (newRow?.id ?? oldRow?.id) as string | undefined;
      if (id) this.lobbyMatches.delete(id);
    } else if (newRow) {
      const match = this.config.rowToMatch(newRow);
      this.lobbyMatches.set(this.config.getMatchId(match), match);
    }

    window.dispatchEvent(new CustomEvent(`${this.config.eventPrefix}:matches_changed`, { detail: { matches: this.getMatches() } }));
  }
}
