/**
 * Lobby System - Grupo de hasta 8 jugadores con sub-partidas 1v1
 *
 * A diferencia de MultiplayerSystem (js/multiplayerSystem.ts, salas
 * `live_matches` de exactamente 2 jugadores con un game_id fijo desde su
 * creación), esto modela un grupo más grande: hasta 8 personas entran a un
 * mismo lobby por código, y dentro de él arman sub-partidas 1v1 de
 * Simon/Arrow/Termita libremente — cada jugador está en un único estado a
 * la vez (parado en el lobby, esperando rival, jugando, o especteando a
 * otra sub-partida en curso). Ver supabase/migration_008_lobbies.sql.
 *
 * Los tres juegos siguen usando exactamente el mismo protocolo de eventos
 * (sendEvent/onRivalEvent vía js/utils/multiplayerSplitView.ts) que ya
 * usaban con MultiplayerSystem — lo único que cambia es de dónde sale el
 * "match actual" y a qué tabla se transmiten los eventos.
 */

import Auth from './authManager.js';
import { getSupabaseClient } from './core/supabaseClient.js';
import ErrorLogger from './core/errorLogger.js';

export type LobbyGameId = 'simon' | 'arrow' | 'termita';
export type LobbyPlayerStatus = 'idle' | 'waiting_match' | 'playing' | 'spectating';

export interface LobbyPlayer {
  id: string;
  username: string;
  status: LobbyPlayerStatus;
  currentMatchId: string | null;
}

export interface Lobby {
  id: string;
  roomCode: string;
  hostId: string;
  players: LobbyPlayer[];
}

export interface LobbyMatch {
  id: string;
  lobbyId: string;
  gameId: LobbyGameId;
  status: 'waiting' | 'playing' | 'completed' | 'abandoned';
  player1Id: string;
  player2Id: string | null;
  settings: Record<string, any>;
  spectatorIds: string[];
  /**
   * Puntaje reportado por cada jugador (player_id -> score), ver
   * completeMatch(). Puede tener 0, 1 o 2 entradas según cuántos
   * jugadores ya reportaron el suyo — nunca asumir que ambas claves
   * están presentes.
   */
  scores: Record<string, number>;
}

const MAX_LOBBY_PLAYERS = 8;
const ANON_ID_STORAGE_KEY = 'lobby_anon_player_id';

class LobbySystem {
  private supabaseClient: any = null;
  private isConnected = false;
  private currentLobby: Lobby | null = null;
  private currentMatch: LobbyMatch | null = null;
  /**
   * Sub-partidas que este cliente conoce dentro del lobby actual
   * (incluye las propias y las de terceros, para poder listarlas en la
   * UI y unirse a cualquiera como espectador). Se puebla con la carga
   * inicial (loadLobbyState) y se mantiene con Realtime.
   */
  private matches: Map<string, LobbyMatch> = new Map();
  /**
   * joined_at real (epoch ms) por player_id del lobby actual — no forma
   * parte de la interfaz pública LobbyPlayer (nadie más lo necesita),
   * pero leaveLobby() lo usa para decidir determinísticamente a quién
   * reasignar el host cuando el host actual se va: el jugador con
   * joined_at más antiguo entre los que quedan.
   */
  private lobbyPlayerJoinedAt: Map<string, number> = new Map();
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initializeSupabase();
  }

  private async initializeSupabase(): Promise<void> {
    try {
      this.supabaseClient = await getSupabaseClient();
      this.isConnected = true;
    } catch (e) {
      ErrorLogger?.log('lobbySystem.init', e, {});
      this.isConnected = false;
    }
  }

  private async waitForInitialization(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Id real del jugador si hay sesión (mismo id que usa el resto de la
   * app para amigos/clanes, así que un lobby de gente logueada puede
   * cruzar identidades con esos sistemas). Sin sesión, cae a un id
   * anónimo persistido en localStorage — el lobby, igual que
   * MultiplayerSystem, no exige cuenta para jugar.
   *
   * Público (no `private`): setupSplitView (multiplayerSplitView.ts)
   * necesita esto para decidir si quien mira la pantalla es jugador o
   * espectador de la sub-partida actual.
   */
  currentPlayerId(): string {
    const authId = Auth.getUser()?.id;
    if (authId) return authId;

    let anonId = localStorage.getItem(ANON_ID_STORAGE_KEY);
    if (!anonId) {
      anonId = `anon_${crypto.randomUUID()}`;
      localStorage.setItem(ANON_ID_STORAGE_KEY, anonId);
    }
    return anonId;
  }

  private currentUsername(): string {
    return Auth.getUser()?.username ?? 'Invitado';
  }

  private generateRoomCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  private requireClient(): any {
    if (!this.supabaseClient || !this.isConnected) {
      throw new Error('No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.');
    }
    return this.supabaseClient;
  }

  // ── Lobby lifecycle ──────────────────────────────────────────────────

  async createLobby(): Promise<Lobby> {
    await this.waitForInitialization();
    const client = this.requireClient();
    const hostId = this.currentPlayerId();

    // Oportunista: no hay cron (ver migration_009_lobby_expiration.sql),
    // así que cualquier intento de crear un lobby primero libera los
    // que quedaron abandonados (pestaña cerrada sin leaveLobby) — evita
    // que codes vencidos bloqueen para siempre a lobbies_active_room_code_key.
    // No se espera de forma bloqueante para el resto del flujo: si falla
    // (red, RPC no desplegado todavía) no debe impedir crear el lobby.
    //
    // El `typeof client.rpc === 'function'` no es paranoia sin motivo:
    // client viene de getSupabaseClient(), tipado como `any` en este
    // archivo — un cliente cacheado de una versión vieja del SDK (o un
    // mock/stub en algún entorno) puede no exponer .rpc en absoluto, y
    // llamarlo directo revienta con "client.rpc is not a function"
    // ANTES de llegar siquiera a intentar crear el lobby.
    //
    // try/catch en vez de .catch() encadenado: client.rpc(...) devuelve
    // un PostgrestFilterBuilder, no una Promise nativa — implementa
    // .then() (por eso funciona con await) pero deliberadamente NO
    // implementa .catch() ni .finally() como métodos propios. Encadenar
    // .catch() directo sobre eso rompe siempre con
    // "client.rpc(...).catch is not a function", sin importar versión
    // del SDK ni caché de navegador — no es un bug intermitente, hay
    // que envolver con try/catch si se quiere ignorar el error.
    if (typeof client.rpc === 'function') {
      try {
        await client.rpc('purge_stale_lobbies');
      } catch {
        // Oportunista: no debe impedir crear el lobby si falla.
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const roomCode = this.generateRoomCode();
      const lobbyId = crypto.randomUUID();

      const { error: lobbyError } = await client
        .from('lobbies')
        .insert({ id: lobbyId, room_code: roomCode, host_id: hostId, status: 'open' });

      if (lobbyError) {
        if (lobbyError.code === '23505') continue; // colisión de código, reintentar
        throw new Error(`No se pudo crear el lobby: ${lobbyError.message}`);
      }

      const { error: playerError } = await client
        .from('lobby_players')
        .insert({
          lobby_id: lobbyId,
          player_id: hostId,
          username: this.currentUsername(),
          status: 'idle'
        });
      if (playerError) {
        throw new Error(`No se pudo unir al lobby recién creado: ${playerError.message}`);
      }

      const lobby: Lobby = {
        id: lobbyId,
        roomCode,
        hostId,
        players: [{ id: hostId, username: this.currentUsername(), status: 'idle', currentMatchId: null }]
      };
      this.currentLobby = lobby;
      this.matches.clear();
      this.lobbyPlayerJoinedAt.clear();
      this.lobbyPlayerJoinedAt.set(hostId, Date.now());
      this.setupRealtimeSubscriptions();
      window.dispatchEvent(new CustomEvent('lobby:created', { detail: { lobby } }));
      return lobby;
    }
    throw new Error('No se pudo generar un código de lobby único. Probá de nuevo.');
  }

  /**
   * Se une a un lobby abierto por código. Rechaza explícitamente si ya
   * hay 8 jugadores (chequeo optimista en el cliente antes del insert,
   * además del trigger `enforce_lobby_capacity` en la base de datos que
   * es la barrera real ante condiciones de carrera de dos personas
   * uniéndose al mismo tiempo en el último cupo).
   */
  async joinLobby(roomCode: string): Promise<Lobby> {
    await this.waitForInitialization();
    const client = this.requireClient();
    const playerId = this.currentPlayerId();
    const normalizedCode = roomCode.toUpperCase().trim();

    // Mismo motivo que en createLobby: purga oportunista antes de
    // buscar, así un código que en teoría estaba "ocupado" por un
    // lobby abandonado hace rato queda libre para un lobby nuevo en
    // vez de fallar con "no existe" para siempre. Ver nota sobre el
    // typeof-check y el try/catch (en vez de .catch() encadenado, que
    // PostgrestFilterBuilder no soporta) en createLobby.
    if (typeof client.rpc === 'function') {
      try {
        await client.rpc('purge_stale_lobbies');
      } catch {
        // Oportunista: no debe impedir unirse al lobby si falla.
      }
    }

    const { data: lobbyRow, error: fetchError } = await client
      .from('lobbies')
      .select('*')
      .eq('room_code', normalizedCode)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw new Error(`No se pudo buscar el lobby: ${fetchError.message}`);
    if (!lobbyRow) throw new Error('No existe un lobby abierto con ese código.');

    const { data: playerRows, error: playersError } = await client
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyRow.id);
    if (playersError) throw new Error(`No se pudo leer el lobby: ${playersError.message}`);

    const existing = (playerRows ?? []).find((p: any) => p.player_id === playerId);
    if (!existing) {
      if ((playerRows?.length ?? 0) >= MAX_LOBBY_PLAYERS) {
        throw new Error('El lobby ya tiene 8 jugadores. No hay lugar disponible.');
      }
      const { error: insertError } = await client
        .from('lobby_players')
        .insert({
          lobby_id: lobbyRow.id,
          player_id: playerId,
          username: this.currentUsername(),
          status: 'idle'
        });
      if (insertError) {
        // 'lobby_full' es el error custom del trigger de capacidad —
        // mensaje amigable en vez del texto crudo de Postgres.
        if (insertError.message?.includes('lobby_full')) {
          throw new Error('El lobby ya tiene 8 jugadores. No hay lugar disponible.');
        }
        throw new Error(`No se pudo unir al lobby: ${insertError.message}`);
      }
    }

    const lobby = await this.loadLobbyState(lobbyRow.id, lobbyRow.room_code, lobbyRow.host_id);
    this.setupRealtimeSubscriptions();
    window.dispatchEvent(new CustomEvent('lobby:joined', { detail: { lobby } }));
    return lobby;
  }

  /**
   * Trae el estado completo de un lobby (jugadores + sub-partidas
   * activas) — usado tanto al unirse por primera vez como para
   * refrescar tras reconectar.
   */
  private async loadLobbyState(lobbyId: string, roomCode: string, hostId: string): Promise<Lobby> {
    const client = this.requireClient();

    const { data: playerRows } = await client
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyId);

    const { data: matchRows } = await client
      .from('lobby_matches')
      .select('*')
      .eq('lobby_id', lobbyId)
      .in('status', ['waiting', 'playing']);

    this.matches.clear();
    (matchRows ?? []).forEach((row: any) => {
      this.matches.set(row.id, this.rowToMatch(row));
    });

    this.lobbyPlayerJoinedAt.clear();
    (playerRows ?? []).forEach((row: any) => {
      this.lobbyPlayerJoinedAt.set(row.player_id, new Date(row.joined_at).getTime());
    });

    const lobby: Lobby = {
      id: lobbyId,
      roomCode,
      hostId,
      players: (playerRows ?? []).map((row: any) => ({
        id: row.player_id,
        username: row.username,
        status: row.status,
        currentMatchId: row.current_match_id
      }))
    };
    this.currentLobby = lobby;
    return lobby;
  }

  private rowToMatch(row: any): LobbyMatch {
    return {
      id: row.id,
      lobbyId: row.lobby_id,
      gameId: row.game_id,
      status: row.status,
      player1Id: row.player1_id,
      player2Id: row.player2_id,
      settings: row.settings ?? {},
      // spectator_ids no es una columna propia (current_match_id en
      // lobby_players ya identifica quién especta qué) — se deriva vía
      // getSpectatorsFor() a partir de this.currentLobby, no se guarda
      // acá para no duplicar la fuente de verdad.
      spectatorIds: [],
      scores: row.scores ?? {}
    };
  }

  getCurrentLobby(): Lobby | null {
    return this.currentLobby;
  }

  getMatches(): LobbyMatch[] {
    return Array.from(this.matches.values());
  }

  getSpectatorsFor(matchId: string): LobbyPlayer[] {
    if (!this.currentLobby) return [];
    return this.currentLobby.players.filter((p) => p.status === 'spectating' && p.currentMatchId === matchId);
  }

  /**
   * Sale del lobby. Si quien se va es el host y quedan más jugadores,
   * reasigna `host_id` al jugador con `joined_at` más antiguo entre los
   * que quedan (criterio simple y predecible: "el que lleva más tiempo
   * en el lobby"), antes de borrar la propia fila — así no hay ninguna
   * ventana en la que el lobby quede sin host asignado. Si el host era
   * el único jugador, se cierra el lobby (libera el código).
   */
  async leaveLobby(): Promise<void> {
    if (!this.currentLobby) return;
    const playerId = this.currentPlayerId();
    const client = this.supabaseClient;
    if (client && this.isConnected) {
      try {
        const isHost = this.currentLobby.hostId === playerId;
        const remainingPlayers = this.currentLobby.players.filter((p) => p.id !== playerId);

        if (isHost && remainingPlayers.length > 0) {
          // Reasigna ANTES de borrar la fila propia: si se hiciera al
          // revés, entre el delete y el update habría una ventana en la
          // que lobbies.host_id apunta a un player_id que ya no tiene
          // fila en lobby_players.
          const nextHost = [...remainingPlayers].sort((a, b) => {
            const aRow = this.lobbyPlayerJoinedAt.get(a.id) ?? 0;
            const bRow = this.lobbyPlayerJoinedAt.get(b.id) ?? 0;
            return aRow - bRow;
          })[0];

          await client.from('lobbies').update({ host_id: nextHost.id }).eq('id', this.currentLobby.id);
          window.dispatchEvent(new CustomEvent('lobby:host_changed', { detail: { hostId: nextHost.id } }));
        }

        await client.from('lobby_players').delete().eq('lobby_id', this.currentLobby.id).eq('player_id', playerId);

        if (isHost && remainingPlayers.length === 0) {
          await client.from('lobbies').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', this.currentLobby.id);
        }
      } catch (e) {
        ErrorLogger?.log('lobbySystem.leaveLobby', e, {});
      }
    }
    this.teardownRealtimeSubscriptions();
    this.currentLobby = null;
    this.currentMatch = null;
    this.matches.clear();
  }

  // ── Sub-partidas ─────────────────────────────────────────────────────

  /**
   * Crea una sub-partida 1v1 dentro del lobby actual y queda como
   * jugador 1, en estado 'waiting_match' hasta que alguien se une como
   * jugador 2. `settings` es la dificultad que este jugador fija —
   * igual que en MultiplayerSystem.createRoomMatch, quien se una la
   * recibe de solo lectura.
   *
   * Nota: no hay ninguna validación de que el host del LOBBY sea quien
   * crea partidas — cualquier jugador del lobby puede crear cuantas
   * sub-partidas quiera. Es intencional: el rol de "host" acá solo
   * importa para decidir cuándo cerrar el lobby entero al vaciarse
   * (leaveLobby), no para moderar quién puede jugar qué.
   */
  async createMatch(gameId: LobbyGameId, settings: Record<string, any> = {}): Promise<LobbyMatch> {
    if (!this.currentLobby) throw new Error('No estás en ningún lobby.');
    // Evita que un mismo jugador quede como player1Id de dos sub-partidas
    // a la vez: sin este guard, this.currentMatch se pisa con la nueva
    // partida y la anterior (todavía 'playing' en la fila real) queda
    // huérfana — nadie vuelve a llamar completeMatch/leaveCurrentMatch
    // sobre ella porque el cliente ya perdió la referencia. Ver auditoría
    // de roles: mismo problema que joinMatchAsPlayer más abajo.
    if (this.currentMatch && (this.currentMatch.status === 'playing' || this.currentMatch.status === 'waiting')) {
      throw new Error('Ya tenés una partida activa. Salí de ella antes de crear otra.');
    }
    const client = this.requireClient();
    const playerId = this.currentPlayerId();
    const matchId = crypto.randomUUID();

    const { error } = await client.from('lobby_matches').insert({
      id: matchId,
      lobby_id: this.currentLobby.id,
      game_id: gameId,
      status: 'waiting',
      player1_id: playerId,
      settings
    });
    if (error) {
      // 'player_already_in_active_match' es el error custom del trigger
      // de migration_011 — mismo patrón que 'lobby_full' más arriba:
      // mensaje amigable en vez del texto crudo de Postgres. El guard
      // de this.currentMatch al principio de este método ya cubre el
      // flujo normal de la UI; esto es la red de seguridad del servidor
      // para cuando ese guard se salta (dos pestañas, cliente
      // modificado, condición de carrera).
      if (error.message?.includes('player_already_in_active_match')) {
        throw new Error('Ya tenés una partida activa. Salí de ella antes de crear otra.');
      }
      throw new Error(`No se pudo crear la partida: ${error.message}`);
    }

    await client.from('lobby_players')
      .update({ status: 'waiting_match', current_match_id: matchId })
      .eq('lobby_id', this.currentLobby.id)
      .eq('player_id', playerId);

    const match: LobbyMatch = {
      id: matchId, lobbyId: this.currentLobby.id, gameId, status: 'waiting',
      player1Id: playerId, player2Id: null, settings, spectatorIds: [], scores: {}
    };
    this.matches.set(matchId, match);
    this.currentMatch = match;
    window.dispatchEvent(new CustomEvent('lobby:match_created', { detail: { match } }));
    return match;
  }

  /**
   * Se une como jugador 2 (rival) a una sub-partida en 'waiting'. Si ya
   * tiene 2 jugadores o no existe/no está en 'waiting', falla
   * explícitamente — la UI (lobby.logic.ts) no debería ofrecer el botón
   * en ese caso, pero esto cubre la condición de carrera de dos personas
   * tocando "unirse" casi al mismo tiempo.
   */
  async joinMatchAsPlayer(matchId: string): Promise<LobbyMatch> {
    if (!this.currentLobby) throw new Error('No estás en ningún lobby.');
    // Mismo guard que createMatch: sin esto, un jugador que ya es
    // player1Id/player2Id de una partida 'playing' o 'waiting' puede
    // unirse a una segunda como player2, this.currentMatch se
    // sobreescribe con la nueva, y la primera queda huérfana en memoria
    // (su completeMatch/leaveCurrentMatch terminaría actuando sobre la
    // partida equivocada). No cubre doble-click sobre la MISMA partida
    // (matchId === this.currentMatch.id) porque ese caso ya lo maneja
    // sin problema el .is('player2_id', null) de abajo.
    if (
      this.currentMatch &&
      this.currentMatch.id !== matchId &&
      (this.currentMatch.status === 'playing' || this.currentMatch.status === 'waiting')
    ) {
      throw new Error('Ya tenés una partida activa. Salí de ella antes de unirte a otra.');
    }
    const client = this.requireClient();
    const playerId = this.currentPlayerId();

    const { data: row, error: fetchError } = await client
      .from('lobby_matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    if (fetchError) throw new Error(`No se pudo buscar la partida: ${fetchError.message}`);
    if (!row || row.status !== 'waiting' || row.player2_id) {
      throw new Error('Esa partida ya no está disponible para unirse.');
    }

    const { error: updateError, data: updated } = await client
      .from('lobby_matches')
      .update({ status: 'playing', player2_id: playerId, started_at: new Date().toISOString() })
      // .is('player2_id', null) además del chequeo de arriba: cierra la
      // ventana de carrera entre el select y este update — si otro
      // jugador se coló en el medio, esta condición hace que la query no
      // afecte ninguna fila (updated queda null/vacío), chequeado abajo.
      .eq('id', matchId)
      .eq('status', 'waiting')
      .is('player2_id', null)
      .select()
      .maybeSingle();

    if (updateError) {
      // Ver comentario equivalente en createMatch: mismo trigger de
      // migration_011 protegiendo este UPDATE (rellena player2_id).
      if (updateError.message?.includes('player_already_in_active_match')) {
        throw new Error('Ya tenés una partida activa. Salí de ella antes de unirte a otra.');
      }
      throw new Error(`No se pudo unir a la partida: ${updateError.message}`);
    }
    if (!updated) throw new Error('Otro jugador se unió justo antes que vos. Probá con otra partida.');

    await client.from('lobby_players')
      .update({ status: 'playing', current_match_id: matchId })
      .eq('lobby_id', this.currentLobby.id)
      .eq('player_id', playerId);

    const match: LobbyMatch = {
      id: matchId, lobbyId: row.lobby_id, gameId: row.game_id, status: 'playing',
      player1Id: row.player1_id, player2Id: playerId, settings: row.settings ?? {}, spectatorIds: [],
      scores: row.scores ?? {}
    };
    this.matches.set(matchId, match);
    this.currentMatch = match;
    window.dispatchEvent(new CustomEvent('lobby:match_joined', { detail: { match } }));
    return match;
  }

  /**
   * Especta una sub-partida en curso: no ocupa el rol de jugador 2, solo
   * marca el estado propio en el lobby como 'spectating' apuntando a esa
   * partida — el split-screen de cada juego (Simon/Arrow/Termita) queda
   * en modo 100% solo-lectura de ambos lados cuando quien lo abre no es
   * player1Id ni player2Id de la partida actual.
   */
  async spectateMatch(matchId: string): Promise<LobbyMatch> {
    if (!this.currentLobby) throw new Error('No estás en ningún lobby.');
    const match = this.matches.get(matchId);
    if (!match) throw new Error('Esa partida ya no existe.');

    const client = this.supabaseClient;
    if (client && this.isConnected) {
      await client.from('lobby_players')
        .update({ status: 'spectating', current_match_id: matchId })
        .eq('lobby_id', this.currentLobby.id)
        .eq('player_id', this.currentPlayerId());
    }
    this.currentMatch = match;
    window.dispatchEvent(new CustomEvent('lobby:spectating', { detail: { match } }));
    return match;
  }

  /**
   * Vuelve al estado 'idle' del lobby (sale de jugar o de espectar) sin
   * abandonar el lobby entero. Si era jugador de una partida en curso,
   * la marca 'abandoned' — no queda una sub-partida fantasma esperando
   * un rival que nunca vuelve.
   */
  async leaveCurrentMatch(): Promise<void> {
    if (!this.currentLobby || !this.currentMatch) return;
    const playerId = this.currentPlayerId();
    const wasPlayer = this.currentMatch.player1Id === playerId || this.currentMatch.player2Id === playerId;
    const client = this.supabaseClient;
    const matchId = this.currentMatch.id;

    if (client && this.isConnected) {
      try {
        if (wasPlayer) {
          // No confiar en this.currentMatch.status (estado local en
          // memoria): completeMatch() no lo actualiza sincrónicamente
          // tras su propio update — la única vía es la actualización de
          // Realtime, que puede no haber llegado todavía si esto se
          // llama justo después de completeMatch() en el mismo flujo de
          // salida (ver stop() en simon/arrow/termita .logic.ts). Sin
          // releer, un 'completed' recién escrito por completeMatch()
          // podía pisarse acá mismo con 'abandoned' por una condición de
          // carrera, perdiendo el resultado ya reportado.
          const { data: row } = await client
            .from('lobby_matches')
            .select('status')
            .eq('id', matchId)
            .maybeSingle();
          if (row && row.status !== 'completed' && row.status !== 'abandoned') {
            await client.from('lobby_matches').update({ status: 'abandoned' }).eq('id', matchId);
          }
        }
        await client.from('lobby_players')
          .update({ status: 'idle', current_match_id: null })
          .eq('lobby_id', this.currentLobby.id)
          .eq('player_id', playerId);
      } catch (e) {
        ErrorLogger?.log('lobbySystem.leaveCurrentMatch', e, {});
      }
    }
    this.matches.delete(matchId);
    this.currentMatch = null;
    window.dispatchEvent(new CustomEvent('lobby:match_left'));
  }

  getCurrentMatch(): LobbyMatch | null {
    return this.currentMatch;
  }

  /**
   * Marca la sub-partida actual como terminada con el puntaje propio.
   * Cada jugador llama esto con su propio resultado al terminar su
   * partida (Simon/Termita no están sincronizados turno a turno entre
   * ambos lados — cada uno corre su propia secuencia — así que cada uno
   * reporta el suyo por separado en vez de que un solo lado decida el
   * resultado final de ambos). `scores` se actualiza acumulando ambos
   * valores según quién llama, sin pisar el del otro jugador si ya
   * había reportado el suyo.
   */
  async completeMatch(score: number): Promise<void> {
    if (!this.currentLobby || !this.currentMatch) return;
    const client = this.supabaseClient;
    if (!client || !this.isConnected) return;
    const playerId = this.currentPlayerId();
    const isPlayer1 = this.currentMatch.player1Id === playerId;

    try {
      const { data: row } = await client
        .from('lobby_matches')
        .select('scores, status')
        .eq('id', this.currentMatch.id)
        .maybeSingle();

      const scores = { ...(row?.scores ?? {}), [playerId]: score };
      const bothReported = this.currentMatch.player1Id in scores && this.currentMatch.player2Id && this.currentMatch.player2Id in scores;

      await client.from('lobby_matches').update({
        scores,
        // Solo se marca 'completed' (liberando a los jugadores de vuelta
        // a 'idle' del lado del lobby) una vez que AMBOS reportaron su
        // resultado — si se marcara con el primero, el segundo jugador
        // podría quedar con status='playing' en lobby_players sin una
        // sub-partida real que lo respalde del otro lado.
        status: bothReported ? 'completed' : row?.status,
        completed_at: bothReported ? new Date().toISOString() : null
      }).eq('id', this.currentMatch.id);

      if (bothReported) {
        await client.from('lobby_players')
          .update({ status: 'idle', current_match_id: null })
          .eq('lobby_id', this.currentLobby.id)
          .in('player_id', [this.currentMatch.player1Id, this.currentMatch.player2Id]);
      }
    } catch (e) {
      ErrorLogger?.log('lobbySystem.completeMatch', e, {});
    }
  }

  /**
   * Transmite un evento de juego dentro de la sub-partida actual —
   * misma forma que MultiplayerSystem.sendGameEvent, tabla distinta
   * (lobby_match_messages en vez de match_messages) para no mezclar
   * ambos sistemas de sala.
   */
  async sendGameEvent(type: string, payload: unknown): Promise<void> {
    if (!this.currentMatch || !this.supabaseClient) return;
    try {
      await this.supabaseClient.from('lobby_match_messages').insert({
        lobby_match_id: this.currentMatch.id,
        player_id: this.currentPlayerId(),
        message: JSON.stringify({ type, payload })
      });
    } catch (e) {
      ErrorLogger?.log('lobbySystem.sendGameEvent', e, {});
    }
  }

  // ── Realtime ─────────────────────────────────────────────────────────

  private channels: any[] = [];

  private setupRealtimeSubscriptions(): void {
    if (!this.supabaseClient || !this.isConnected || !this.currentLobby) return;
    this.teardownRealtimeSubscriptions();
    const lobbyId = this.currentLobby.id;

    const lobbyChannel = this.supabaseClient
      .channel(`lobby_${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, (payload: any) => {
        this.handleLobbyUpdate(payload);
      })
      .subscribe();

    const playersChannel = this.supabaseClient
      .channel(`lobby_players_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${lobbyId}` }, (payload: any) => {
        this.handlePlayerUpdate(payload);
      })
      .subscribe();

    const matchesChannel = this.supabaseClient
      .channel(`lobby_matches_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_matches', filter: `lobby_id=eq.${lobbyId}` }, (payload: any) => {
        this.handleMatchUpdate(payload);
      })
      .subscribe();

    const messagesChannel = this.supabaseClient
      .channel(`lobby_match_messages_${lobbyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_match_messages' }, (payload: any) => {
        this.handleMatchMessage(payload);
      })
      .subscribe();

    this.channels = [lobbyChannel, playersChannel, matchesChannel, messagesChannel];
  }

  private teardownRealtimeSubscriptions(): void {
    if (!this.supabaseClient) return;
    this.channels.forEach((ch) => this.supabaseClient.removeChannel(ch));
    this.channels = [];
  }

  /**
   * Refleja cambios en la fila de `lobbies` misma — hoy el único campo
   * que cambia después de creado el lobby es `host_id` (reasignación al
   * salir el host, ver leaveLobby) y `status` (cierre). Sin este canal,
   * los DEMÁS jugadores del lobby (no quien se fue) nunca se enteraban
   * de quién es el nuevo host — solo quien ejecutó la reasignación lo
   * sabía localmente.
   */
  private handleLobbyUpdate(payload: any): void {
    if (!this.currentLobby) return;
    const newRow = payload.new;
    if (!newRow) return;

    if (newRow.host_id && newRow.host_id !== this.currentLobby.hostId) {
      this.currentLobby.hostId = newRow.host_id;
      window.dispatchEvent(new CustomEvent('lobby:host_changed', { detail: { hostId: newRow.host_id } }));
    }
    if (newRow.status === 'closed') {
      window.dispatchEvent(new CustomEvent('lobby:closed'));
    }
  }

  private handlePlayerUpdate(payload: any): void {
    if (!this.currentLobby) return;
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'DELETE') {
      this.currentLobby.players = this.currentLobby.players.filter((p) => p.id !== oldRow.player_id);
      this.lobbyPlayerJoinedAt.delete(oldRow.player_id);
    } else {
      const player: LobbyPlayer = {
        id: newRow.player_id,
        username: newRow.username,
        status: newRow.status,
        currentMatchId: newRow.current_match_id
      };
      const idx = this.currentLobby.players.findIndex((p) => p.id === player.id);
      if (idx >= 0) this.currentLobby.players[idx] = player;
      else this.currentLobby.players.push(player);
      this.lobbyPlayerJoinedAt.set(player.id, new Date(newRow.joined_at).getTime());
    }

    window.dispatchEvent(new CustomEvent('lobby:players_changed', { detail: { players: this.currentLobby.players } }));
  }

  private handleMatchUpdate(payload: any): void {
    const { newRow, oldRow } = { newRow: payload.new, oldRow: payload.old };
    const eventType = payload.eventType;

    if (eventType === 'DELETE' || newRow?.status === 'abandoned' || newRow?.status === 'completed') {
      const id = newRow?.id ?? oldRow?.id;
      this.matches.delete(id);
      if (this.currentMatch?.id === id) {
        // No se limpia this.currentMatch acá de forma agresiva: el
        // propio juego (simon/arrow/termita .logic.ts) necesita seguir
        // leyendo el resultado final (status/scores) hasta que termine
        // de mostrar la pantalla de fin de partida; leaveCurrentMatch()
        // es quien realmente lo desengancha.
        //
        // scores: newRow?.scores (no this.currentMatch.scores) —
        // completeMatch() persiste el score de CADA jugador por
        // separado (ver comentario ahí); sin tomar el valor real de la
        // fila acá, el jugador que no originó este UPDATE (el rival)
        // seguía viendo currentMatch.scores vacío/desactualizado justo
        // cuando el juego necesita mostrar el resultado final de ambos.
        this.currentMatch = {
          ...this.currentMatch,
          status: newRow?.status ?? 'abandoned',
          scores: newRow?.scores ?? this.currentMatch.scores
        };
      }
    } else {
      const match = this.rowToMatch(newRow);
      this.matches.set(match.id, match);
      if (this.currentMatch?.id === match.id) this.currentMatch = match;
    }

    window.dispatchEvent(new CustomEvent('lobby:matches_changed', { detail: { matches: this.getMatches() } }));
  }

  private handleMatchMessage(payload: any): void {
    const record = payload.new;
    if (!record || !this.currentMatch || record.lobby_match_id !== this.currentMatch.id) return;
    // No reflejar los propios eventos, mismo criterio que
    // MultiplayerSystem.handleMatchMessage.
    if (record.player_id === this.currentPlayerId()) return;

    let parsed: { type: string; payload: unknown } | null = null;
    try {
      parsed = JSON.parse(record.message);
    } catch {
      return;
    }
    if (!parsed) return;

    window.dispatchEvent(new CustomEvent('multiplayer:game_event', {
      detail: { playerId: record.player_id, type: parsed.type, payload: parsed.payload }
    }));
  }
}

export const lobbySystem = new LobbySystem();
export default lobbySystem;
