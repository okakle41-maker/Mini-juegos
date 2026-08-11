/**
 * js/shipControlSystem.ts
 *
 * Sistema de datos para "Centro de Control de una Nave" — minijuego
 * cooperativo de EXACTAMENTE 4 jugadores simultáneos, sin modo solo.
 * Paralelo a signalTriangulationSystem.ts (mismo criterio de "tabla
 * nueva paralela, reusa lobbies/lobby_players") — ver el diseño
 * auditado en supabase/migration_017_ship_control.sql para la
 * justificación completa.
 *
 * Diferencia estructural clave respecto a signalTriangulationSystem:
 * SigTri es una decisión puntual por ronda (source_x/source_y fija
 * hasta que se resuelve); acá el estado (ship_control_state) cambia
 * continuamente mientras la partida corre, y hay un flujo de eventos
 * server-generados con probabilidad creciente en vez de "rondas". Este
 * módulo por eso expone:
 *   - un polling loop (`tick`) que dispara tick_ship_control_match cada
 *     pocos segundos mientras la partida está en curso — reemplaza al
 *     disparador temporizado que en otro proyecto sería un cron job
 *     (ver migration_017, sección 4: el proyecto NO tiene pg_cron);
 *   - getMyView(), que devuelve la vista filtrada por ROL (no por
 *     jugador anónimo) combinando la vista SQL correspondiente
 *     (ship_control_state_navigation / _energy) con
 *     get_my_ship_events() para el rol propio.
 *
 * Requiere sesión iniciada, igual criterio y mismo motivo que Signal
 * Triangulation (hay información que ocultar entre los propios
 * jugadores del equipo — acá, entre roles).
 *
 * La generación de eventos (Morse, checksum, ruido de sensor, secuencia
 * de encendido) NO vive acá ni en ningún otro archivo bajo js/ — vive
 * exclusivamente en las funciones RPC security definer de
 * migration_017_ship_control.sql. Este módulo solo invoca esos RPCs por
 * nombre.
 */

import { lobbySystem } from './lobbySystem.js';
import ErrorLogger from './core/errorLogger.js';
import { RoleMatchSystemBase, type RoleMatchSystemConfig } from './utils/roleMatchSystemBase.js';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type SCMatchStatus = 'waiting' | 'playing' | 'completed' | 'abandoned' | 'failed';
export type SCDifficulty = 'normal' | 'dificil';
export type SCRole = 'navigation' | 'sensors' | 'energy' | 'comms';

const ROLE_COLUMNS: Record<SCRole, string> = {
  navigation: 'navigation_player_id',
  sensors: 'sensors_player_id',
  energy: 'energy_player_id',
  comms: 'comms_player_id'
};

const ALL_ROLES: SCRole[] = ['navigation', 'sensors', 'energy', 'comms'];

export interface SCMatch {
  id: string;
  lobbyId: string;
  status: SCMatchStatus;
  difficulty: SCDifficulty;
  players: Record<SCRole, string | null>;
  lives: number;
  maxLives: number;
  destinationX: number | null;
  destinationY: number | null;
  eventsSurvived: number;
  eventsFailed: number;
}

/** Estado de navegación — solo visible para el rol 'navigation'. */
export interface SCNavigationState {
  headingDeg: number;
  speed: number;
  positionX: number;
  positionY: number;
}

/** Estado de energía — solo visible para el rol 'energy'. */
export interface SCEnergyState {
  powerShields: number;
  powerEngines: number;
  powerComms: number;
  powerWeapons: number;
  powerLifeSupport: number;
}

/** Un evento activo, ya filtrado a lo que le corresponde a MI rol (ver get_my_ship_events). */
export interface SCEvent {
  id: string;
  eventCode: string;
  status: 'active' | 'resolved' | 'failed';
  message: string | null;
  deadlineAt: string;
  triggeredAt: string;
  /** Solo presente si mi rol es 'sensors'. */
  sensorReading: { bearing: number; distance: number } | null;
  /** Solo presente si mi rol es 'sensors' — gatea submit_evasion_bearing. */
  trajectoryUnlocked: boolean | null;
  /**
   * Patrón Morse en '.'/'-' (símbolos separados por ' / '), YA
   * CALCULADO server-side vía encode_ship_morse sobre
   * hidden_solution.morse_code — no es la solución en sí (esa nunca sale
   * del servidor), es el sonido que Comunicaciones debe escuchar y
   * decodificar, igual que role_messages_resolved.comms.text para el
   * resto del mensaje. Solo presente si mi rol es 'comms' Y el evento
   * activo requiere Morse (null en caso contrario — ver get_my_ship_events,
   * migration_017 sección 3.4).
   */
  morsePattern: string | null;
}

/**
 * Fila cruda de Supabase (snake_case), ver
 * supabase/migration_017_ship_control.sql. Solo se listan las columnas
 * que rowToMatch() realmente lee (no todo el esquema — event_probability_*,
 * started_at, etc. son estado interno del servidor que este cliente
 * nunca necesita).
 */
interface SCMatchRow {
  id: string;
  lobby_id: string;
  status: SCMatchStatus;
  difficulty: SCDifficulty;
  navigation_player_id: string | null;
  sensors_player_id: string | null;
  energy_player_id: string | null;
  comms_player_id: string | null;
  lives: number;
  max_lives: number;
  destination_x: number | null;
  destination_y: number | null;
  events_survived: number;
  events_failed: number;
}

/** Fila devuelta por el RPC get_my_ship_events (ya filtrada por rol server-side). */
interface SCEventRpcRow {
  id: string;
  event_code: string;
  status: 'active' | 'resolved' | 'failed';
  message: string | null;
  deadline_at: string;
  triggered_at: string;
  sensor_reading: { bearing: number; distance: number } | null;
  trajectory_unlocked: boolean | null;
  morse_pattern: string | null;
}

class ShipControlSystem extends RoleMatchSystemBase<SCMatch> {
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const config: RoleMatchSystemConfig<SCMatch> = {
      table: 'ship_control_matches',
      moduleName: 'shipControlSystem',
      gameLabel: 'Centro de Control',
      lobbyChannelPrefix: 'sc_lobby_matches',
      eventPrefix: 'sc',
      // 'completed'/'abandoned'/'failed' — mismo set que
      // handleLobbyMatchesUpdate usaba antes de esta migración.
      terminalStatuses: ['abandoned', 'completed', 'failed'],
      rowToMatch: (row: unknown) => this.rowToMatch(row as SCMatchRow),
      getMatchId: (match: SCMatch) => match.id
    };
    super(config);
  }

  /**
   * Crea una partida dentro del lobby actual, ocupando el rol pedido.
   * A diferencia de Signal Triangulation (siempre slot 1 al crear), acá
   * el creador elige su rol explícitamente — los roles no son
   * intercambiables entre sí (Navegación no es "lo mismo" que
   * Comunicaciones desde el punto de vista de la UI a mostrar), así que
   * no tiene sentido asignar automáticamente "el primer slot libre"
   * como en SigTri.
   */
  async createMatch(role: SCRole, difficulty: SCDifficulty = 'normal'): Promise<SCMatch> {
    await this.waitForInitialization();
    const lobby = lobbySystem.getCurrentLobby();
    if (!lobby) throw new Error('No estás en ningún lobby.');
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();
    const matchId = crypto.randomUUID();

    const { error } = await client.from('ship_control_matches').insert({
      id: matchId,
      lobby_id: lobby.id,
      status: 'waiting',
      difficulty,
      [ROLE_COLUMNS[role]]: playerId
    });
    if (error) {
      if (error.message?.includes('player_already_in_active_match')) {
        throw new Error('Ya tenés una partida de Centro de Control activa. Salí de ella antes de crear otra.');
      }
      throw new Error(`No se pudo crear la partida: ${error.message}`);
    }

    const match: SCMatch = {
      id: matchId,
      lobbyId: lobby.id,
      status: 'waiting',
      difficulty,
      players: { navigation: null, sensors: null, energy: null, comms: null, [role]: playerId } as Record<SCRole, string | null>,
      lives: 3,
      maxLives: 3,
      destinationX: null,
      destinationY: null,
      eventsSurvived: 0,
      eventsFailed: 0
    };
    this.currentMatch = match;
    this.lobbyMatches.set(match.id, match);
    this.setupMatchRealtimeSubscriptions(matchId);
    window.dispatchEvent(new CustomEvent('sc:match_created', { detail: { match } }));
    window.dispatchEvent(new CustomEvent('sc:matches_changed', { detail: { matches: this.getMatches() } }));
    return match;
  }

  /**
   * Se une a una partida en 'waiting' ocupando el ROL pedido (no "el
   * primer libre" como en SigTri — acá el jugador elige qué rol quiere
   * jugar, la UI debe mostrar qué roles ya están ocupados vía
   * match.players antes de ofrecer el botón). Si el rol pedido ya está
   * ocupado, falla explícito — cubre la condición de carrera de dos
   * personas eligiendo el mismo rol casi al mismo tiempo.
   */
  async joinMatch(matchId: string, role: SCRole): Promise<SCMatch> {
    await this.waitForInitialization();
    const lobby = lobbySystem.getCurrentLobby();
    if (!lobby) throw new Error('No estás en ningún lobby.');
    const client = this.requireClient();
    const playerId = this.requireAuthenticatedPlayerId();

    const { data: row, error: fetchError } = await client
      .from('ship_control_matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    if (fetchError) throw new Error(`No se pudo buscar la partida: ${fetchError.message}`);
    if (!row) throw new Error('Esa partida ya no existe.');
    if (row.status !== 'waiting') throw new Error('Esa partida ya no está disponible para unirse.');

    const column = ROLE_COLUMNS[role];
    if (row[column]) throw new Error('Ese rol ya está ocupado — elegí otro.');

    const allFilledAfterThis = ALL_ROLES.every(
      (r) => (r === role) || row[ROLE_COLUMNS[r]]
    );

    const { error: updateError, data: updated } = await client
      .from('ship_control_matches')
      .update({ [column]: playerId })
      // Cierra la ventana de carrera: si otro jugador ocupó este mismo
      // rol en el medio, .is(column, null) hace que el update no
      // afecte ninguna fila.
      .eq('id', matchId)
      .eq('status', 'waiting')
      .is(column, null)
      .select()
      .maybeSingle();

    if (updateError) {
      if (updateError.message?.includes('player_already_in_active_match')) {
        throw new Error('Ya tenés una partida de Centro de Control activa. Salí de ella antes de unirte a otra.');
      }
      throw new Error(`No se pudo unir a la partida: ${updateError.message}`);
    }
    if (!updated) throw new Error('Otro jugador ocupó ese rol justo antes que vos. Probá de nuevo.');

    const match = this.rowToMatch(updated);
    this.currentMatch = match;
    this.lobbyMatches.set(match.id, match);
    this.setupMatchRealtimeSubscriptions(matchId);

    if (allFilledAfterThis) {
      // Los 4 roles se acaban de llenar: dispara start_ship_control_match
      // (elige destino, inicializa ship_control_state). Solo lo hace
      // quien completó el último rol, mismo criterio que
      // joinMatch->generate_signal_triangulation_round en SigTri, para
      // evitar 4 llamadas redundantes.
      try {
        await client.rpc('start_ship_control_match', { p_match_id: matchId });
      } catch (e) {
        ErrorLogger?.log('shipControlSystem.joinMatch.startMatch', e, { matchId });
      }
    }

    window.dispatchEvent(new CustomEvent('sc:match_joined', { detail: { match } }));
    window.dispatchEvent(new CustomEvent('sc:matches_changed', { detail: { matches: this.getMatches() } }));
    return match;
  }

  myRole(): SCRole | null {
    if (!this.currentMatch) return null;
    let playerId: string;
    try {
      playerId = this.requireAuthenticatedPlayerId();
    } catch {
      return null;
    }
    return ALL_ROLES.find((r) => this.currentMatch!.players[r] === playerId) ?? null;
  }

  /**
   * Trae mi estado filtrado por rol — SOLO la vista que corresponde
   * (ship_control_state_navigation o _energy). Sensores y Comunicaciones
   * no tienen vista sobre ship_control_state (su información vive 100%
   * en ship_control_events) — para esos dos roles este método devuelve
   * null, no un objeto vacío, para que el llamador no confunda "no hay
   * vista para este rol" con "la nave está en su estado inicial".
   */
  async getMyState(role: SCRole): Promise<SCNavigationState | SCEnergyState | null> {
    if (!this.currentMatch) return null;
    const client = this.requireClient();

    if (role === 'navigation') {
      const { data, error } = await client
        .from('ship_control_state_navigation')
        .select('*')
        .eq('match_id', this.currentMatch.id)
        .maybeSingle();
      if (error) { ErrorLogger?.log('shipControlSystem.getMyState.navigation', error, {}); return null; }
      if (!data) return null;
      return {
        headingDeg: data.heading_deg,
        speed: data.speed,
        positionX: data.position_x,
        positionY: data.position_y
      };
    }

    if (role === 'energy') {
      const { data, error } = await client
        .from('ship_control_state_energy')
        .select('*')
        .eq('match_id', this.currentMatch.id)
        .maybeSingle();
      if (error) { ErrorLogger?.log('shipControlSystem.getMyState.energy', error, {}); return null; }
      if (!data) return null;
      return {
        powerShields: data.power_shields,
        powerEngines: data.power_engines,
        powerComms: data.power_comms,
        powerWeapons: data.power_weapons,
        powerLifeSupport: data.power_life_support
      };
    }

    return null; // sensors/comms: sin vista sobre ship_control_state
  }

  /**
   * Trae los eventos activos filtrados a mi rol, vía la función RPC
   * get_my_ship_events (security definer) — nunca lee
   * ship_control_events directo (RLS se lo prohíbe explícitamente, ver
   * migración sección 3.4).
   */
  async getMyEvents(): Promise<SCEvent[]> {
    if (!this.currentMatch) return [];
    const client = this.requireClient();
    const { data, error } = await client.rpc('get_my_ship_events', { p_match_id: this.currentMatch.id });
    if (error) {
      ErrorLogger?.log('shipControlSystem.getMyEvents', error, {});
      return [];
    }
    return ((data ?? []) as SCEventRpcRow[]).map((e) => ({
      id: e.id,
      eventCode: e.event_code,
      status: e.status,
      message: e.message ?? null,
      deadlineAt: e.deadline_at,
      triggeredAt: e.triggered_at,
      sensorReading: e.sensor_reading
        ? { bearing: e.sensor_reading.bearing, distance: e.sensor_reading.distance }
        : null,
      trajectoryUnlocked: e.trajectory_unlocked ?? null,
      morsePattern: e.morse_pattern ?? null
    }));
  }

  /**
   * Envía una acción propia — punto de entrada ÚNICO hacia el servidor
   * para toda interacción de gameplay (girar, redistribuir energía,
   * decodificar código, calcular rumbo de evasión, paso de secuencia de
   * reactor). Nunca se valida nada de esto en el cliente más allá de lo
   * imprescindible para no mandar payloads obviamente vacíos — la
   * validación real (contra hidden_solution) vive exclusivamente en
   * submit_ship_action (security definer), ver migración sección 6.
   */
  async submitAction(actionType: string, payload: Record<string, unknown>): Promise<{ correct: boolean | null }> {
    if (!this.currentMatch) throw new Error('No hay partida activa.');
    const client = this.requireClient();
    const { data, error } = await client.rpc('submit_ship_action', {
      p_match_id: this.currentMatch.id,
      p_action_type: actionType,
      p_payload: payload
    });
    if (error) {
      throw new Error(error.message ?? 'No se pudo enviar la acción.');
    }
    return { correct: data?.correct ?? null };
  }

  /**
   * Arranca el polling que reemplaza al cron de servidor ausente (ver
   * migración, decisión #4): invoca tick_ship_control_match cada
   * `intervalMs` mientras la partida siga 'playing'. Debe llamarse una
   * sola vez al entrar a la vista de juego (cualquiera de los 4 roles
   * puede ser quien lo dispare — tick_ship_control_match es idempotente
   * en el sentido de que si ya hay un evento activo o la partida no
   * está jugándose, no hace nada) y detenerse con stopTicking() al
   * salir. 4000ms es un valor de partida razonable: bastante frecuente
   * para que la cadencia probabilística se sienta responsive, bastante
   * espaciado para no saturar de RPCs a una partida de 4 personas.
   */
  startTicking(intervalMs = 4000): void {
    this.stopTicking();
    this.tickTimer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  stopTicking(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.currentMatch || this.currentMatch.status !== 'playing') return;
    const client = this.requireClient();
    try {
      await client.rpc('tick_ship_control_match', { p_match_id: this.currentMatch.id });
    } catch (e) {
      ErrorLogger?.log('shipControlSystem.tick', e, {});
    }
  }

  /**
   * Vuelve al lobby sin abandonarlo por completo (mismo criterio que
   * signalTriangulationSystem.leaveCurrentMatch): marca la partida
   * 'abandoned' si seguía en curso.
   */
  async leaveCurrentMatch(): Promise<void> {
    if (!this.currentMatch) return;
    const client = this.supabaseClient;
    const matchId = this.currentMatch.id;

    this.stopTicking();

    if (client && this.isConnected) {
      try {
        const { data: row } = await client
          .from('ship_control_matches')
          .select('status')
          .eq('id', matchId)
          .maybeSingle();
        if (row && !['completed', 'abandoned', 'failed'].includes(row.status)) {
          await client.from('ship_control_matches').update({ status: 'abandoned' }).eq('id', matchId);
        }
      } catch (e) {
        ErrorLogger?.log('shipControlSystem.leaveCurrentMatch', e, {});
      }
    }
    this.teardownMatchRealtimeSubscriptions();
    this.lobbyMatches.delete(matchId);
    this.currentMatch = null;
    window.dispatchEvent(new CustomEvent('sc:match_left'));
    window.dispatchEvent(new CustomEvent('sc:matches_changed', { detail: { matches: this.getMatches() } }));
  }

  private rowToMatch(row: SCMatchRow): SCMatch {
    return {
      id: row.id,
      lobbyId: row.lobby_id,
      status: row.status,
      difficulty: row.difficulty,
      players: {
        navigation: row.navigation_player_id,
        sensors: row.sensors_player_id,
        energy: row.energy_player_id,
        comms: row.comms_player_id
      },
      lives: row.lives,
      maxLives: row.max_lives,
      destinationX: row.destination_x,
      destinationY: row.destination_y,
      eventsSurvived: row.events_survived,
      eventsFailed: row.events_failed
    };
  }

  // ── Realtime ─────────────────────────────────────────────────────────
  //
  // Solo ship_control_matches y ship_control_actions/event_progress
  // están habilitadas en la publicación de Realtime (ver migración,
  // sección 7) — ship_control_state y ship_control_events NUNCA se
  // consumen por Realtime crudo (contienen columnas por-rol y
  // hidden_solution respectivamente, que el canal no filtra por RLS).
  // El estado/eventos propios se refrescan por REST vía getMyState()/
  // getMyEvents(), invocados por el cliente de juego (shipControl.logic.ts)
  // en su propio polling corto, separado del tick de generación de
  // eventos de arriba.

  private setupMatchRealtimeSubscriptions(matchId: string): void {
    if (!this.supabaseClient || !this.isConnected) return;
    this.teardownMatchRealtimeSubscriptions();

    const matchChannel = this.supabaseClient
      .channel(`sc_match_${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ship_control_matches', filter: `id=eq.${matchId}` }, (payload: RealtimePostgresChangesPayload<SCMatchRow>) => {
        this.handleMatchUpdate(payload);
      })
      .subscribe();

    this.channels = [matchChannel];
  }

  private handleMatchUpdate(payload: RealtimePostgresChangesPayload<SCMatchRow>): void {
    const newRow = payload.new as Partial<SCMatchRow>;
    if (!newRow.id || !this.currentMatch || newRow.id !== this.currentMatch.id) return;
    this.currentMatch = this.rowToMatch(newRow as SCMatchRow);
    this.lobbyMatches.set(this.currentMatch.id, this.currentMatch);
    window.dispatchEvent(new CustomEvent('sc:match_changed', { detail: { match: this.currentMatch } }));
  }
}

export const shipControlSystem = new ShipControlSystem();
export default shipControlSystem;
