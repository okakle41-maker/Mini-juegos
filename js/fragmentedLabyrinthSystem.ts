/**
 * js/fragmentedLabyrinthSystem.ts
 *
 * Sistema de datos para "Fragmented Labyrinth" — minijuego cooperativo
 * de EXACTAMENTE 4 jugadores simultáneos con roles fijos A/B/C/D,
 * portado desde el prototipo standalone en "minijuegos a futuri/
 * fragmentad-labyrinth" (servidor Node + WebSocket propio, con estado
 * del laberinto y posición del personaje en memoria de proceso).
 *
 * Paralelo a signalTriangulationSystem.ts, mismo patrón general:
 *   - Reusa lobbySystem.getCurrentLobby() para descubrimiento de sala.
 *   - Autoridad de juego en Postgres (RPC security definer + RLS), no
 *     en un servidor Node propio — ver supabase/migration_018_fragmented_labyrinth.sql.
 *   - Solo el rol A puede mover al personaje; B/C/D solo ven su
 *     cuadrante y coordinan por voz externa (sin chat integrado en este
 *     port inicial, ver decisión de producto en la migración).
 *
 * Diferencia clave respecto a Signal Triangulation: acá el "cuadrante
 * propio" no es una fila de tabla suscribible directamente por Realtime
 * (fragmented_labyrinth_state no tiene SELECT otorgado, ver RLS en la
 * migración) — es el resultado de invocar el RPC
 * get_my_labyrinth_view(match_id), que hay que re-invocar cada vez que
 * fragmented_labyrinth_matches cambia (moves/status), no solo al entrar
 * a la vista.
 */

import { lobbySystem } from './lobbySystem.js';
import ErrorLogger from './core/errorLogger.js';
import { RoleMatchSystemBase, type RoleMatchSystemConfig } from './utils/roleMatchSystemBase.js';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type FLMatchStatus = 'waiting' | 'playing' | 'won' | 'over';
export type FLRole = 'A' | 'B' | 'C' | 'D';
export type FLDirection = 'up' | 'down' | 'left' | 'right';

export const ROLE_DESCRIPTIONS: Record<FLRole, string> = {
  A: 'Controla al personaje + cuadrante superior-izquierdo',
  B: 'Cuadrante superior-derecho — guía por voz externa',
  C: 'Cuadrante inferior-izquierdo — guía por voz externa',
  D: 'Cuadrante inferior-derecho — guía por voz externa'
};

export interface FLMatch {
  id: string;
  lobbyId: string;
  status: FLMatchStatus;
  /** role -> playerId | null, en orden fijo A..D. */
  players: Record<FLRole, string | null>;
  durationSeconds: number;
  moves: number;
}

/** Resultado de get_my_labyrinth_view — solo el cuadrante propio. */
export interface FLView {
  role: FLRole;
  grid: string[][]; // '.' pasillo, '#' muro, 'S' inicio, 'E' salida
  offsetX: number;
  offsetY: number;
  exitInView: boolean;
  startInView: boolean;
  playerX: number;
  playerY: number;
  timeLeft: number;
  moves: number;
  status: FLMatchStatus;
}

export interface FLMoveResult {
  denied?: boolean;
  reason?: 'wall';
  status?: FLMatchStatus;
  moves?: number;
}

const ROLE_COLUMNS: Record<FLRole, 'role_a_id' | 'role_b_id' | 'role_c_id' | 'role_d_id'> = {
  A: 'role_a_id',
  B: 'role_b_id',
  C: 'role_c_id',
  D: 'role_d_id'
};

/**
 * Fila cruda de Supabase (snake_case), ver
 * supabase/migration_018_fragmented_labyrinth.sql. Solo las columnas
 * que rowToMatch() lee (deadline_at/started_at son estado interno del
 * temporizador server-side, no expuestos en FLMatch).
 */
interface FLMatchRow {
  id: string;
  lobby_id: string;
  status: FLMatchStatus;
  role_a_id: string | null;
  role_b_id: string | null;
  role_c_id: string | null;
  role_d_id: string | null;
  duration_seconds: number;
  moves: number;
}

class FragmentedLabyrinthSystem extends RoleMatchSystemBase<FLMatch> {
  private lastView: FLView | null = null;

  constructor() {
    const config: RoleMatchSystemConfig<FLMatch> = {
      table: 'fragmented_labyrinth_matches',
      moduleName: 'fragmentedLabyrinthSystem',
      gameLabel: 'Fragmented Labyrinth',
      lobbyChannelPrefix: 'fl_lobby_matches',
      eventPrefix: 'fl',
      // 'over'/'won' — mismo set que handleLobbyMatchesUpdate usaba
      // antes de esta migración (distinto de ST/SC: FL no usa
      // 'completed'/'abandoned' como nombres de estado terminal).
      terminalStatuses: ['over', 'won'],
      rowToMatch: (row: unknown) => this.rowToMatch(row as FLMatchRow),
      getMatchId: (match: FLMatch) => match.id
    };
    super(config);
  }

  private rowToMatch(row: FLMatchRow): FLMatch {
    return {
      id: row.id,
      lobbyId: row.lobby_id,
      status: row.status,
      players: {
        A: row.role_a_id,
        B: row.role_b_id,
        C: row.role_c_id,
        D: row.role_d_id
      },
      durationSeconds: row.duration_seconds,
      moves: row.moves
    };
  }

  /** Crea la partida y ocupa el rol A (controla al personaje). */
  async createMatch(durationSeconds = 120): Promise<FLMatch> {
    await this.waitForInitialization();
    const lobby = lobbySystem.getCurrentLobby();
    if (!lobby) throw new Error('No estás en ningún lobby.');
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();
    const matchId = crypto.randomUUID();

    const { error } = await client.from('fragmented_labyrinth_matches').insert({
      id: matchId,
      lobby_id: lobby.id,
      status: 'waiting',
      role_a_id: playerId,
      duration_seconds: durationSeconds
    });
    if (error) {
      if (error.message?.includes('player_already_in_active_fl_match')) {
        throw new Error('Ya tenés una partida de Fragmented Labyrinth activa. Salí de ella antes de crear otra.');
      }
      throw new Error(`No se pudo crear la partida: ${error.message}`);
    }

    const match: FLMatch = {
      id: matchId,
      lobbyId: lobby.id,
      status: 'waiting',
      players: { A: playerId, B: null, C: null, D: null },
      durationSeconds,
      moves: 0
    };
    this.currentMatch = match;
    this.lobbyMatches.set(match.id, match);
    this.setupMatchRealtimeSubscriptions(matchId);
    window.dispatchEvent(new CustomEvent('fl:match_created', { detail: { match } }));
    window.dispatchEvent(new CustomEvent('fl:matches_changed', { detail: { matches: this.getMatches() } }));
    return match;
  }

  /**
   * Se une a una partida en 'waiting' ocupando el primer rol libre
   * (B, C o D — A siempre lo ocupa quien crea la partida). Cuando el
   * 4º rol se llena, dispara generate_fragmented_labyrinth() — solo
   * quien completó el último slot, mismo criterio que
   * signalTriangulationSystem.joinMatch para evitar 4 generaciones
   * redundantes.
   */
  async joinMatch(matchId: string): Promise<FLMatch> {
    await this.waitForInitialization();
    const lobby = lobbySystem.getCurrentLobby();
    if (!lobby) throw new Error('No estás en ningún lobby.');
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();

    const { data: row, error: fetchError } = await client
      .from('fragmented_labyrinth_matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    if (fetchError) throw new Error(`No se pudo buscar la partida: ${fetchError.message}`);
    if (!row) throw new Error('Esa partida ya no existe.');
    if (row.status !== 'waiting') throw new Error('Esa partida ya no está disponible para unirse.');

    const roleOrder: FLRole[] = ['A', 'B', 'C', 'D'];
    const freeRole = roleOrder.find((role) => !row[ROLE_COLUMNS[role]]);
    if (!freeRole) throw new Error('Esa partida ya tiene 4 jugadores.');

    const allFilledAfterThis = roleOrder.every(
      (role) => row[ROLE_COLUMNS[role]] || role === freeRole
    );

    const { error: updateError, data: updated } = await client
      .from('fragmented_labyrinth_matches')
      .update({
        [ROLE_COLUMNS[freeRole]]: playerId,
        status: allFilledAfterThis ? 'playing' : 'waiting'
      })
      // Cierra la ventana de carrera: si otro jugador ya ocupó este rol
      // en el medio, el update no afecta ninguna fila (mismo patrón que
      // signalTriangulationSystem.joinMatch).
      .eq('id', matchId)
      .eq('status', 'waiting')
      .is(ROLE_COLUMNS[freeRole], null)
      .select()
      .maybeSingle();

    if (updateError) {
      if (updateError.message?.includes('player_already_in_active_fl_match')) {
        throw new Error('Ya tenés una partida de Fragmented Labyrinth activa. Salí de ella antes de unirte a otra.');
      }
      throw new Error(`No se pudo unir a la partida: ${updateError.message}`);
    }
    if (!updated) throw new Error('Otro jugador ocupó ese rol justo antes que vos. Probá de nuevo.');

    const match = this.rowToMatch(updated);
    this.currentMatch = match;
    this.lobbyMatches.set(match.id, match);
    this.setupMatchRealtimeSubscriptions(matchId);

    if (allFilledAfterThis) {
      try {
        await client.rpc('generate_fragmented_labyrinth', { p_match_id: matchId });
      } catch (e) {
        ErrorLogger?.log('fragmentedLabyrinthSystem.joinMatch.generateLabyrinth', e, { matchId });
      }
    }

    window.dispatchEvent(new CustomEvent('fl:match_joined', { detail: { match } }));
    window.dispatchEvent(new CustomEvent('fl:matches_changed', { detail: { matches: this.getMatches() } }));
    return match;
  }

  /** Mi rol (A-D) dentro de la partida actual, o null si no soy jugador de ella. */
  myRole(): FLRole | null {
    if (!this.currentMatch) return null;
    let playerId: string;
    try {
      playerId = this.requireAuthenticatedPlayerId();
    } catch {
      return null;
    }
    const entry = (Object.entries(this.currentMatch.players) as Array<[FLRole, string | null]>)
      .find(([, id]) => id === playerId);
    return entry ? entry[0] : null;
  }

  getLastView(): FLView | null {
    return this.lastView;
  }

  /**
   * Trae mi cuadrante propio vía RPC — nunca hay un SELECT directo a
   * fragmented_labyrinth_state posible (ver RLS en la migración), así
   * que esta es la ÚNICA forma de leer el estado del juego. Hay que
   * volver a llamarla después de cada movimiento propio o cada vez que
   * fragmented_labyrinth_matches cambia (ver handleMatchUpdate), porque
   * el estado detallado no llega solo por Realtime.
   */
  async refreshMyView(): Promise<FLView | null> {
    if (!this.currentMatch) return null;
    const client = this.requireClient();
    try {
      const { data, error } = await client.rpc('get_my_labyrinth_view', {
        p_match_id: this.currentMatch.id
      });
      if (error) throw error;
      const view = data as FLView;
      this.lastView = view;
      window.dispatchEvent(new CustomEvent('fl:view_changed', { detail: { view } }));
      return view;
    } catch (e) {
      ErrorLogger?.log('fragmentedLabyrinthSystem.refreshMyView', e, { matchId: this.currentMatch.id });
      return null;
    }
  }

  /**
   * Mueve al personaje — solo válido si mi rol es 'A' (el RPC también
   * lo valida server-side, esto es solo para fallar rápido en el
   * cliente sin round-trip). Refresca mi vista después del intento
   * (incluso si fue denegado, porque timeLeft/status pueden haber
   * cambiado igual).
   */
  async move(direction: FLDirection): Promise<FLMoveResult> {
    if (!this.currentMatch) throw new Error('No hay partida activa.');
    if (this.myRole() !== 'A') throw new Error('Solo el Jugador A controla al personaje.');
    const client = this.requireClient();

    const { data, error } = await client.rpc('move_fragmented_labyrinth_character', {
      p_match_id: this.currentMatch.id,
      p_direction: direction
    });
    if (error) throw new Error(`No se pudo mover: ${error.message}`);

    await this.refreshMyView();
    return data as FLMoveResult;
  }

  /** Igual que lobbySystem.leaveCurrentMatch(): limpia estado local y suscripciones. */
  async leaveCurrentMatch(): Promise<void> {
    if (!this.currentMatch) return;
    const match = this.currentMatch;
    this.teardownMatchRealtimeSubscriptions();
    this.currentMatch = null;
    this.lastView = null;

    // Cualquier estado no-terminal ('waiting' o 'playing') debe cerrarse
    // acá, no solo 'playing': antes, si el rol A se iba mientras la
    // partida seguía en 'waiting' (esperando a B/C/D), la fila quedaba
    // 'waiting' para siempre — el trigger player_already_in_active_fl_match
    // (ver createMatch/joinMatch) la sigue considerando una partida activa
    // de ese jugador indefinidamente, y como currentMatch ya se limpió
    // acá arriba, no había ninguna forma de volver a llamar
    // leaveCurrentMatch() sobre ella: el jugador quedaba bloqueado para
    // siempre al intentar crear o unirse a cualquier partida nueva de
    // Fragmented Labyrinth.
    if (match.status === 'playing' || match.status === 'waiting') {
      try {
        const client = this.requireClient();
        await client
          .from('fragmented_labyrinth_matches')
          .update({ status: 'over' })
          .eq('id', match.id)
          .eq('status', match.status);
      } catch (e) {
        ErrorLogger?.log('fragmentedLabyrinthSystem.leaveCurrentMatch', e, { matchId: match.id });
      }
    }
    window.dispatchEvent(new CustomEvent('fl:match_left', { detail: { matchId: match.id } }));
  }

  // ── Realtime ──────────────────────────────────────────────────────────

  private setupMatchRealtimeSubscriptions(matchId: string): void {
    if (!this.supabaseClient || !this.isConnected) return;
    this.teardownMatchRealtimeSubscriptions();

    const matchChannel = this.supabaseClient
      .channel(`fl_match_${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fragmented_labyrinth_matches', filter: `id=eq.${matchId}` }, (payload: RealtimePostgresChangesPayload<FLMatchRow>) => {
        this.handleMatchUpdate(payload);
      })
      .subscribe();

    this.channels = [matchChannel];
  }

  /**
   * fragmented_labyrinth_state (donde vive el laberinto/posición real)
   * NO es suscribible directamente (sin SELECT otorgado, ver RLS) — así
   * que cada UPDATE de fragmented_labyrinth_matches (que sí cambia con
   * cada movimiento válido, ver moves++ en el RPC) dispara un
   * refreshMyView() para traer el cuadrante actualizado vía RPC. Esto
   * es lo que le permite a B/C/D ver moverse al personaje en su propio
   * cuadrante sin que ninguno de los 4 pueda leer el laberinto completo.
   */
  private handleMatchUpdate(payload: RealtimePostgresChangesPayload<FLMatchRow>): void {
    const newRow = payload.new as Partial<FLMatchRow>;
    if (!newRow.id || !this.currentMatch || newRow.id !== this.currentMatch.id) return;
    this.currentMatch = this.rowToMatch(newRow as FLMatchRow);
    this.lobbyMatches.set(this.currentMatch.id, this.currentMatch);
    window.dispatchEvent(new CustomEvent('fl:match_changed', { detail: { match: this.currentMatch } }));
    void this.refreshMyView();
  }
}

export const fragmentedLabyrinthSystem = new FragmentedLabyrinthSystem();
export default fragmentedLabyrinthSystem;
