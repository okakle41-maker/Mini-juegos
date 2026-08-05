/**
 * js/signalTriangulationSystem.ts
 *
 * Sistema de datos para "Signal Triangulation" — minijuego cooperativo
 * de EXACTAMENTE 4 jugadores simultáneos, sin modo solo. Paralelo a
 * lobbySystem.ts (que modela sub-partidas 1v1 de Simon/Arrow/Termita),
 * no una extensión de él — ver el diseño auditado en
 * supabase/migration_016_signal_triangulation.sql para la justificación
 * completa de por qué esto vive en tablas y un módulo nuevos en vez de
 * reusar lobby_matches.
 *
 * Reusa lobbySystem.getCurrentLobby() para el descubrimiento de partida
 * (código de sala, lista de presentes) — este módulo NO duplica esa
 * lógica, solo agrega la sub-partida de 4 jugadores dentro de un lobby
 * ya existente.
 *
 * Requiere sesión iniciada (Auth.getUser()) para jugar — a diferencia
 * del resto del sistema de lobby, que acepta jugadores anónimos. Esto
 * es una decisión de producto explícita (ver diseño, sección 2.3): acá
 * sí hay información que ocultar entre los propios jugadores del
 * equipo (la celda elegida por cada uno), y un player_id de texto
 * libre sin auth.uid() real no da ninguna garantía de identidad para
 * la política de RLS de signal_triangulation_locks.
 *
 * El solver de generación/verificación de niveles NO vive acá ni en
 * ningún otro archivo bajo js/ — vive exclusivamente en la función RPC
 * `generate_signal_triangulation_round` (security definer, Postgres).
 * Este módulo solo invoca ese RPC por nombre; nunca calcula ni conoce
 * la fuente oculta.
 */

import { lobbySystem } from './lobbySystem.js';
import ErrorLogger from './core/errorLogger.js';
import { RoleMatchSystemBase, type RoleMatchSystemConfig } from './utils/roleMatchSystemBase.js';

export type STMatchStatus = 'waiting' | 'playing' | 'completed' | 'abandoned';
export type STRoundStatus = 'active' | 'solved' | 'failed';

/** 1-based: 1→(0,0), 2→(9,0), 3→(9,9), 4→(0,9). Ver ANTENAS más abajo. */
export type STSlot = 1 | 2 | 3 | 4;

export const ANTENNAS: Record<STSlot, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 9, y: 0 },
  3: { x: 9, y: 9 },
  4: { x: 0, y: 9 }
};

export interface STMatch {
  id: string;
  lobbyId: string;
  status: STMatchStatus;
  /** slot -> playerId | null, en el orden fijo 1..4 (ver ANTENNAS). */
  players: Record<STSlot, string | null>;
  currentRound: 1 | 2;
  roundsWon: number;
  maxAttemptsPerRound: number;
}

export interface STRoundPublic {
  id: string;
  matchId: string;
  roundNumber: 1 | 2;
  attemptNumber: number;
  status: STRoundStatus;
}

/** La propia fila de lock — nunca la de otro jugador (ver RLS). */
export interface STOwnLock {
  roundId: string;
  playerId: string;
  distance: number;
  guessX: number | null;
  guessY: number | null;
  lockedAt: string | null;
}

/** Estado agregado y anónimo del resto del equipo — nunca expone celdas. */
export interface STTeamLockStatus {
  roundId: string;
  playerId: string;
  hasLocked: boolean;
}

class SignalTriangulationSystem extends RoleMatchSystemBase<STMatch> {
  private currentRound: STRoundPublic | null = null;

  constructor() {
    const config: RoleMatchSystemConfig<STMatch> = {
      table: 'signal_triangulation_matches',
      moduleName: 'signalTriangulationSystem',
      gameLabel: 'Signal Triangulation',
      lobbyChannelPrefix: 'st_lobby_matches',
      eventPrefix: 'st',
      // 'completed'/'abandoned' — mismo criterio que leaveCurrentMatch()
      // más abajo, que también trata esos dos como estado final.
      terminalStatuses: ['abandoned', 'completed'],
      rowToMatch: (row: any) => this.rowToMatch(row),
      getMatchId: (match: STMatch) => match.id
    };
    super(config);
  }

  /**
   * Crea una partida de Signal Triangulation dentro del lobby actual y
   * ocupa el slot 1 (antena (0,0)). Los otros 3 jugadores se unen con
   * joinMatch() a los slots 2/3/4 restantes.
   */
  async createMatch(settings: Record<string, any> = {}): Promise<STMatch> {
    await this.waitForInitialization();
    const lobby = lobbySystem.getCurrentLobby();
    if (!lobby) throw new Error('No estás en ningún lobby.');
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();
    const matchId = crypto.randomUUID();

    const { error } = await client.from('signal_triangulation_matches').insert({
      id: matchId,
      lobby_id: lobby.id,
      status: 'waiting',
      player1_id: playerId,
      settings
    });
    if (error) {
      if (error.message?.includes('player_already_in_active_match')) {
        throw new Error('Ya tenés una partida de Signal Triangulation activa. Salí de ella antes de crear otra.');
      }
      throw new Error(`No se pudo crear la partida: ${error.message}`);
    }

    const match: STMatch = {
      id: matchId,
      lobbyId: lobby.id,
      status: 'waiting',
      players: { 1: playerId, 2: null, 3: null, 4: null },
      currentRound: 1,
      roundsWon: 0,
      maxAttemptsPerRound: 5
    };
    this.currentMatch = match;
    this.lobbyMatches.set(match.id, match);
    this.setupMatchRealtimeSubscriptions(matchId);
    window.dispatchEvent(new CustomEvent('st:match_created', { detail: { match } }));
    window.dispatchEvent(new CustomEvent('st:matches_changed', { detail: { matches: this.getMatches() } }));
    return match;
  }

  /**
   * Se une a una partida en 'waiting' ocupando el primer slot libre
   * (2, 3 o 4 — nunca 1, que ya está ocupado por quien la creó). Si los
   * 4 slots ya están llenos, falla explícitamente — la UI no debería
   * ofrecer el botón en ese caso, pero esto cubre la condición de
   * carrera de varias personas uniéndose casi al mismo tiempo.
   */
  async joinMatch(matchId: string): Promise<STMatch> {
    await this.waitForInitialization();
    const lobby = lobbySystem.getCurrentLobby();
    if (!lobby) throw new Error('No estás en ningún lobby.');
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();

    const { data: row, error: fetchError } = await client
      .from('signal_triangulation_matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    if (fetchError) throw new Error(`No se pudo buscar la partida: ${fetchError.message}`);
    if (!row) throw new Error('Esa partida ya no existe.');
    if (row.status !== 'waiting') throw new Error('Esa partida ya no está disponible para unirse.');

    // Elige el primer slot libre 2..4. player1_id nunca está libre (lo
    // llena createMatch() siempre) — si por algún motivo estuviera
    // vacío, esta partida está en un estado inconsistente y se prefiere
    // fallar explícito antes que un jugador se una como "creador
    // fantasma".
    const slotColumns: Array<{ slot: STSlot; column: 'player1_id' | 'player2_id' | 'player3_id' | 'player4_id' }> = [
      { slot: 1, column: 'player1_id' },
      { slot: 2, column: 'player2_id' },
      { slot: 3, column: 'player3_id' },
      { slot: 4, column: 'player4_id' }
    ];
    const freeSlot = slotColumns.find(({ column }) => !row[column]);
    if (!freeSlot) throw new Error('Esa partida ya tiene 4 jugadores.');

    const allFilledAfterThis = slotColumns.every(
      ({ column }) => row[column] || column === freeSlot.column
    );

    const { error: updateError, data: updated } = await client
      .from('signal_triangulation_matches')
      .update({
        [freeSlot.column]: playerId,
        status: allFilledAfterThis ? 'playing' : 'waiting',
        started_at: allFilledAfterThis ? new Date().toISOString() : row.started_at
      })
      // Cierra la ventana de carrera entre el select y este update: si
      // otro jugador ocupó este mismo slot en el medio, la condición
      // .is(column, null) hace que el update no afecte ninguna fila.
      .eq('id', matchId)
      .eq('status', 'waiting')
      .is(freeSlot.column, null)
      .select()
      .maybeSingle();

    if (updateError) {
      if (updateError.message?.includes('player_already_in_active_match')) {
        throw new Error('Ya tenés una partida de Signal Triangulation activa. Salí de ella antes de unirte a otra.');
      }
      throw new Error(`No se pudo unir a la partida: ${updateError.message}`);
    }
    if (!updated) throw new Error('Otro jugador ocupó ese lugar justo antes que vos. Probá de nuevo.');

    const match = this.rowToMatch(updated);
    this.currentMatch = match;
    this.lobbyMatches.set(match.id, match);
    this.setupMatchRealtimeSubscriptions(matchId);

    if (allFilledAfterThis) {
      // Los 4 slots se acaban de llenar: dispara la generación de la
      // ronda 1, intento 1. Solo lo hace quien completó el último slot
      // (evita 4 llamadas redundantes al RPC si cada cliente intentara
      // dispararlo por su cuenta al ver status='playing' por Realtime).
      try {
        await client.rpc('generate_signal_triangulation_round', {
          p_match_id: matchId,
          p_round_number: 1,
          p_attempt_number: 1
        });
      } catch (e) {
        ErrorLogger?.log('signalTriangulationSystem.joinMatch.generateRound', e, { matchId });
      }
    }

    window.dispatchEvent(new CustomEvent('st:match_joined', { detail: { match } }));
    window.dispatchEvent(new CustomEvent('st:matches_changed', { detail: { matches: this.getMatches() } }));
    return match;
  }

  getCurrentRound(): STRoundPublic | null {
    return this.currentRound;
  }

  /** Mi slot (1-4) dentro de la partida actual, o null si no soy jugador de ella. */
  mySlot(): STSlot | null {
    if (!this.currentMatch) return null;
    let playerId: string;
    try {
      playerId = this.requireAuthenticatedPlayerId();
    } catch {
      return null;
    }
    const entry = (Object.entries(this.currentMatch.players) as Array<[string, string | null]>)
      .find(([, id]) => id === playerId);
    return entry ? (Number(entry[0]) as STSlot) : null;
  }

  /**
   * Trae la ronda activa (o la última resuelta) de la partida actual vía
   * la vista pública — NUNCA la tabla base
   * signal_triangulation_rounds, que no tiene select otorgado a
   * anon/authenticated (ver RLS en la migración). source_x/source_y no
   * existen en esta vista y por lo tanto no pueden filtrarse por acá.
   */
  async refreshCurrentRound(): Promise<STRoundPublic | null> {
    if (!this.currentMatch) return null;
    const client = this.requireClient();
    const { data, error } = await client
      .from('signal_triangulation_rounds_public')
      .select('*')
      .eq('match_id', this.currentMatch.id)
      .order('round_number', { ascending: false })
      .order('attempt_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      ErrorLogger?.log('signalTriangulationSystem.refreshCurrentRound', error, {});
      return null;
    }
    if (!data) return null;
    const round = this.rowToRoundPublic(data);
    this.currentRound = round;
    return round;
  }

  /**
   * Trae mi propia fila de lock (distancia + celda elegida) para la
   * ronda dada. Solo mi propia fila es legible (RLS,
   * str_locks_select_own_full) — pedir la de otro jugador simplemente
   * devuelve 0 filas, nunca un error, así que no hace falta chequear el
   * player_id acá: la base de datos ya lo garantiza.
   */
  async getMyLock(roundId: string): Promise<STOwnLock | null> {
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();
    const { data, error } = await client
      .from('signal_triangulation_locks')
      .select('*')
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (error) {
      ErrorLogger?.log('signalTriangulationSystem.getMyLock', error, {});
      return null;
    }
    if (!data) return null;
    return this.rowToOwnLock(data);
  }

  /**
   * Estado agregado del equipo para la ronda dada — solo el booleano de
   * lockeado por jugador (nunca guess_x/guess_y ajeno), vía la vista
   * pública signal_triangulation_locks_public.
   */
  async getTeamLockStatus(roundId: string): Promise<STTeamLockStatus[]> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('signal_triangulation_locks_public')
      .select('*')
      .eq('round_id', roundId);
    if (error) {
      ErrorLogger?.log('signalTriangulationSystem.getTeamLockStatus', error, {});
      return [];
    }
    return (data ?? []).map((row: any) => ({
      roundId: row.round_id,
      playerId: row.player_id,
      hasLocked: row.has_locked
    }));
  }

  /**
   * Mueve mi marcador (sin confirmar) — upsert continuo mientras discuto
   * por voz. No-op de guard si ya lockeé (decisión de producto: sin
   * des-lockeo, ver diseño sección 5) — la UI debe deshabilitar el
   * control de todos modos, esto es una segunda barrera del lado del
   * sistema, no solo de la vista.
   */
  async updateGuess(roundId: string, x: number, y: number): Promise<void> {
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();

    const existing = await this.getMyLock(roundId);
    if (existing?.lockedAt) return; // ya confirmado, no se puede tocar (sin des-lockeo)

    const { error } = await client
      .from('signal_triangulation_locks')
      .update({ guess_x: x, guess_y: y, updated_at: new Date().toISOString() })
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .is('locked_at', null);
    if (error) {
      ErrorLogger?.log('signalTriangulationSystem.updateGuess', error, { roundId, x, y });
    }
  }

  /**
   * Confirma mi celda actual (LOCK). Requiere que ya haya una celda
   * elegida (guess_x/guess_y no nulos) — no tiene sentido lockear sin
   * haber elegido nada. El trigger server-side
   * (resolve_signal_triangulation_round) es quien compara los 4 LOCKs y
   * decide solved/failed una vez que los 4 confirmaron; este método
   * solo escribe la propia confirmación.
   */
  async lockGuess(roundId: string): Promise<void> {
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();

    const existing = await this.getMyLock(roundId);
    if (!existing) throw new Error('Todavía no se cargó tu distancia para esta ronda.');
    if (existing.lockedAt) return; // ya lockeado, no-op (sin des-lockeo)
    if (existing.guessX === null || existing.guessY === null) {
      throw new Error('Elegí una celda en el tablero antes de confirmar.');
    }

    const { error } = await client
      .from('signal_triangulation_locks')
      .update({ locked_at: new Date().toISOString() })
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .is('locked_at', null);
    if (error) {
      ErrorLogger?.log('signalTriangulationSystem.lockGuess', error, { roundId });
      throw new Error(`No se pudo confirmar: ${error.message}`);
    }
  }

  /**
   * Vuelve al lobby sin abandonarlo por completo (igual criterio que
   * lobbySystem.leaveCurrentMatch): marca la partida 'abandoned' si
   * seguía en curso y libera el estado local. No hay concepto de
   * "espectador" en este juego (a diferencia de Simon/Arrow/Termita) —
   * los 4 slots son siempre jugadores activos, nunca espectadores, así
   * que salir de una partida en curso siempre cuenta como abandono del
   * equipo completo, no solo del que sale.
   */
  async leaveCurrentMatch(): Promise<void> {
    if (!this.currentMatch) return;
    const client = this.supabaseClient;
    const matchId = this.currentMatch.id;

    if (client && this.isConnected) {
      try {
        const { data: row } = await client
          .from('signal_triangulation_matches')
          .select('status')
          .eq('id', matchId)
          .maybeSingle();
        if (row && row.status !== 'completed' && row.status !== 'abandoned') {
          await client.from('signal_triangulation_matches').update({ status: 'abandoned' }).eq('id', matchId);
        }
      } catch (e) {
        ErrorLogger?.log('signalTriangulationSystem.leaveCurrentMatch', e, {});
      }
    }
    this.teardownMatchRealtimeSubscriptions();
    this.lobbyMatches.delete(matchId);
    this.currentMatch = null;
    this.currentRound = null;
    window.dispatchEvent(new CustomEvent('st:match_left'));
    window.dispatchEvent(new CustomEvent('st:matches_changed', { detail: { matches: this.getMatches() } }));
  }

  private rowToMatch(row: any): STMatch {
    return {
      id: row.id,
      lobbyId: row.lobby_id,
      status: row.status,
      players: {
        1: row.player1_id,
        2: row.player2_id,
        3: row.player3_id,
        4: row.player4_id
      },
      currentRound: row.current_round,
      roundsWon: row.rounds_won,
      maxAttemptsPerRound: row.max_attempts_per_round
    };
  }

  private rowToRoundPublic(row: any): STRoundPublic {
    return {
      id: row.id,
      matchId: row.match_id,
      roundNumber: row.round_number,
      attemptNumber: row.attempt_number,
      status: row.status
    };
  }

  private rowToOwnLock(row: any): STOwnLock {
    return {
      roundId: row.round_id,
      playerId: row.player_id,
      distance: row.distance,
      guessX: row.guess_x,
      guessY: row.guess_y,
      lockedAt: row.locked_at
    };
  }

  // ── Realtime ─────────────────────────────────────────────────────────

  /**
   * Se suscribe a los cambios de la partida y — filtrado por la propia
   * fila — a los propios locks. NO se suscribe sin filtro a
   * signal_triangulation_locks completa (esa tabla contiene guess_x/
   * guess_y de los otros 3 jugadores, y aunque el select vía REST está
   * bloqueado por RLS, el canal de Realtime crudo de Postgres puede no
   * respetar esa misma política — ver la nota extensa en la sección 6
   * de la migración). El estado agregado del resto del equipo
   * ("N de 4 lockeados") se refresca sondeando
   * signal_triangulation_locks_public por REST, no por Realtime directo
   * sobre la tabla base.
   */
  private setupMatchRealtimeSubscriptions(matchId: string): void {
    if (!this.supabaseClient || !this.isConnected) return;
    this.teardownMatchRealtimeSubscriptions();

    const matchChannel = this.supabaseClient
      .channel(`st_match_${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'signal_triangulation_matches', filter: `id=eq.${matchId}` }, (payload: any) => {
        this.handleMatchUpdate(payload);
      })
      .subscribe();

    let ownLockChannel: any = null;
    try {
      const playerId = this.requireAuthenticatedPlayerId();
      ownLockChannel = this.supabaseClient
        .channel(`st_own_lock_${matchId}_${playerId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'signal_triangulation_locks', filter: `player_id=eq.${playerId}` }, (payload: any) => {
          window.dispatchEvent(new CustomEvent('st:my_lock_changed', { detail: { row: payload.new ?? payload.old } }));
        })
        .subscribe();
    } catch {
      // Sin sesión: no debería llegar hasta acá (createMatch/joinMatch ya
      // exigen auth), pero si pasara, simplemente no hay canal propio de
      // locks que suscribir.
    }

    this.channels = ownLockChannel ? [matchChannel, ownLockChannel] : [matchChannel];
  }

  private handleMatchUpdate(payload: any): void {
    const newRow = payload.new;
    if (!newRow || !this.currentMatch || newRow.id !== this.currentMatch.id) return;
    this.currentMatch = this.rowToMatch(newRow);
    this.lobbyMatches.set(this.currentMatch.id, this.currentMatch);
    window.dispatchEvent(new CustomEvent('st:match_changed', { detail: { match: this.currentMatch } }));
  }
}

export const signalTriangulationSystem = new SignalTriangulationSystem();
export default signalTriangulationSystem;
