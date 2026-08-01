/**
 * Multiplayer System - Real-time multiplayer
 * Sistema de multiplayer en tiempo real usando Supabase Realtime
 */

interface Player {
  id: string;
  name: string;
  avatar: string;
  level: number;
  status: 'online' | 'playing' | 'away';
  currentGame?: string;
  score?: number;
  /**
   * Rol dentro del match, para juegos coop asimétricos (Letters Fall:
   * 'viewer' ve las palabras caer, 'typer' solo tiene el input). No lo
   * usa el flujo de matchmaking por skill — ahí ambos jugadores compiten
   * en igualdad y `role` queda undefined.
   */
  role?: string;
}

interface Match {
  id: string;
  gameId: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'completed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  winner?: string;
  scores: Map<string, number>;
  /**
   * Presente solo en salas creadas por `createRoomMatch`/`joinRoomMatch`
   * (emparejamiento manual elegido por el jugador, no matchmaking
   * automático). Ausente en matches de matchmaking por skill.
   */
  roomCode?: string;
  /**
   * Configuración de dificultad fijada por quien crea la sala (ver
   * createRoomMatch). El jugador que se une la recibe de solo lectura —
   * nunca puede pisarla — así ambos juegan con los mismos parámetros.
   * Forma libre: cada juego define qué claves espera (p.ej. simon:
   * { colorCount, baseLength, speed, rounds }).
   */
  settings?: Record<string, any>;
}

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  gameId: string;
  timestamp: number;
}

class MultiplayerSystem {
  private currentMatch: Match | null = null;
  private liveLeaderboards: Map<string, LeaderboardEntry[]> = new Map();
  private playerStatus: Player | null = null;
  private subscriptions: Map<string, any> = new Map();
  private isConnected: boolean = false;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void>;
  
  private storageKey = 'multiplayer-data';
  private supabaseClient: any = null;

  constructor() {
    this.loadLocalData();
    this.initializationPromise = this.initializeSupabase();
  }

  private async initializeSupabase(): Promise<void> {
    try {
      const { getSupabaseClient } = await import('./core/supabaseClient.js');
      this.supabaseClient = await getSupabaseClient();
      this.isConnected = true;
      this.setupRealtimeSubscriptions();
    } catch (e) {
      console.error('[Multiplayer] Failed to initialize Supabase:', e);
      this.isConnected = false;
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * Wait for Supabase initialization to complete before proceeding.
   * Use this when you need to ensure the system is ready.
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.supabaseClient || !this.isConnected) return;

    // Subscribe to live matches
    const matchesSubscription = this.supabaseClient
      .channel('live_matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches' }, (payload: any) => {
        this.handleMatchUpdate(payload);
      })
      .subscribe();

    this.subscriptions.set('matches', matchesSubscription);

    // Nota: no existe tabla live_leaderboard en el schema real — los
    // leaderboards "en vivo" corren siempre en memoria local (ver
    // updateLeaderboard/getLeaderboard más abajo), no hay suscripción
    // Realtime para ellos.

    // Mensajes dentro de una sala (chat genérico y, para juegos coop
    // asimétricos como Letters Fall, el transporte de eventos de juego
    // — ver sendMatchMessage/handleMatchMessage y el protocolo descrito
    // ahí). Se suscribe siempre, no solo cuando hay currentMatch, porque
    // el match puede crearse/unirse después de este punto de arranque;
    // handleMatchMessage descarta cualquier mensaje que no sea del match
    // activo.
    const messagesSubscription = this.supabaseClient
      .channel('match_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_messages' }, (payload: any) => {
        this.handleMatchMessage(payload);
      })
      .subscribe();

    this.subscriptions.set('messages', messagesSubscription);
  }

  private handleMatchUpdate(payload: any): void {
    const { eventType, new: newRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (newRecord.id === this.currentMatch?.id) {
        // No spreadear newRecord tal cual: es una fila cruda de Postgres
        // (snake_case: game_id, room_code, players: [{id, role,
        // joined_at}]) y pisaría this.currentMatch.players (Player[]
        // con name/avatar/level/status) con esos objetos incompletos.
        // Se traducen a mano los únicos campos que de verdad pueden
        // cambiar server-side (status, players, settings) preservando
        // los Player ya conocidos localmente cuando existen.
        const rawPlayers: Array<{ id: string; role: string; joined_at: number }> = newRecord.players || [];
        const knownById = new Map(this.currentMatch.players.map((p) => [p.id, p]));
        const mergedPlayers: Player[] = rawPlayers.map((p) => {
          const known = knownById.get(p.id);
          return known
            ? { ...known, role: p.role }
            : { id: p.id, name: 'Jugador', avatar: '👤', level: 1, status: 'online', role: p.role };
        });

        this.currentMatch = {
          ...this.currentMatch,
          status: newRecord.status ?? this.currentMatch.status,
          players: mergedPlayers,
          settings: newRecord.settings ?? this.currentMatch.settings
        };

        if (newRecord.status === 'playing' && !this.currentMatch.startedAt) {
          this.currentMatch.startedAt = Date.now();
          this.startMatch();
        }
        
        if (newRecord.status === 'completed') {
          this.currentMatch.completedAt = Date.now();
          this.endMatch();
        }
      }
    }

    window.dispatchEvent(new CustomEvent('multiplayer:match_update', {
      detail: { match: this.currentMatch }
    }));
  }

  private handleMatchMessage(payload: any): void {
    const record = payload.new;
    if (!record || !this.currentMatch || record.match_id !== this.currentMatch.id) return;
    // No reflejar los propios mensajes: quien los envió ya actualizó su
    // UI de forma optimista al hacer sendMatchMessage/sendGameEvent, no
    // hace falta procesarlos de nuevo al volver por Realtime.
    if (record.player_id === this.playerStatus?.id) return;

    let parsed: { type: string; payload: unknown } | null = null;
    try {
      parsed = JSON.parse(record.message);
    } catch {
      // Mensaje de chat de texto plano (uso original de
      // sendMatchMessage) — no es un evento de juego estructurado.
      window.dispatchEvent(new CustomEvent('multiplayer:message_received', {
        detail: { playerId: record.player_id, message: record.message }
      }));
      return;
    }

    window.dispatchEvent(new CustomEvent('multiplayer:game_event', {
      detail: { playerId: record.player_id, type: parsed.type, payload: parsed.payload }
    }));
  }

  private loadLocalData(): void {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.playerStatus = data.playerStatus || null;
      } catch (e) {
        console.error('[Multiplayer] Failed to load local data:', e);
      }
    }
  }

  private saveLocalData(): void {
    localStorage.setItem(this.storageKey, JSON.stringify({
      playerStatus: this.playerStatus
    }));
  }

  // Player management
  async setPlayerStatus(player: Player): Promise<void> {
    // Use security module for sanitization
    const { escapeHtml, sanitizeInput } = await import('./security.js');
    const { notificationSystem } = await import('./notificationSystem.js');
    
    // Validate and sanitize player name to prevent XSS
    const sanitizedName = sanitizeInput(player.name, {
      maxLength: 50,
      allowHtml: false,
      allowScript: false
    });

    if (!sanitizedName || sanitizedName.length < 1) {
      notificationSystem.error('Error', 'Nombre de jugador inválido');
      throw new Error('Invalid player name');
    }

    const sanitizedPlayer: Player = {
      ...player,
      name: sanitizedName
    };

    this.playerStatus = sanitizedPlayer;
    this.saveLocalData();

    // Nota: no existe tabla `players` en el schema real — el estado
    // "conectado ahora" se mantiene solo local, no se persiste en
    // Supabase (antes intentaba un upsert contra una tabla inexistente
    // que fallaba silenciosamente en el catch).

    window.dispatchEvent(new CustomEvent('multiplayer:player_status_changed', {
      detail: { player: sanitizedPlayer }
    }));
  }

  getPlayerStatus(): Player | null {
    return this.playerStatus;
  }

  // Matchmaking automático por skill: eliminado. Usaba una tabla
  // (matchmaking_queue) que nunca existió en el schema real de
  // Supabase — el botón "Buscar partida" fallaba siempre en
  // producción. En su lugar, el multiplayer real de este proyecto son
  // las salas por código (createRoomMatch/joinRoomMatch más abajo),
  // que sí tienen tablas reales y funcionan de punta a punta.

  // ── Salas manuales por código (emparejamiento elegido por el jugador,
  // no matchmaking automático) ────────────────────────────────────────
  //
  // Usado por juegos coop asimétricos donde "el jugador más parecido en
  // skill" no aplica — los roles son intrínsecamente distintos (ver
  // Letters Fall: 'viewer' ve las palabras, 'typer' solo escribe). El
  // jugador que crea la sala comparte `roomCode` por fuera de la app
  // (voz, chat, etc.); el segundo jugador lo ingresa a mano.
  //
  // A diferencia del matchmaking automático, esto no tiene fallback
  // local: sin Supabase conectado, dos pestañas no tienen forma de
  // enterarse la una de la otra, así que se propaga el error para que
  // la UI lo muestre en vez de fallar en silencio.

  private generateRoomCode(): string {
    // Sin caracteres ambiguos (0/O, 1/I), para que sea fácil de
    // compartir de palabra o por escrito a mano.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  private ensurePlayerId(): string {
    if (!this.playerStatus) {
      this.playerStatus = {
        id: `player_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: 'Jugador',
        avatar: '👤',
        level: 1,
        status: 'online'
      };
      this.saveLocalData();
    }
    return this.playerStatus.id;
  }

  /**
   * Crea una sala nueva con un código al azar y queda como único
   * jugador (`status: 'waiting'`) hasta que alguien la completa vía
   * `joinRoomMatch`. Reintenta con otro código si el generado colisiona
   * con una sala activa (el índice único de la migración lo rechazaría
   * igual, pero reintentar acá evita mostrarle el error al usuario para
   * el caso normal de colisión, que es raro pero no imposible con solo
   * 4 caracteres).
   *
   * `settings` es la config de dificultad que el creador fija para
   * ambos jugadores (ver migración 008) — el que se une la recibe de
   * `joinRoomMatch`, nunca la elige él mismo.
   */
  async createRoomMatch(gameId: string, role: string, settings: Record<string, any> = {}): Promise<Match> {
    await this.waitForInitialization();
    if (!this.supabaseClient || !this.isConnected) {
      throw new Error('No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.');
    }
    const playerId = this.ensurePlayerId();
    const player: Player = { id: playerId, name: this.playerStatus!.name, avatar: this.playerStatus!.avatar, level: 1, status: 'online', role };

    for (let attempt = 0; attempt < 5; attempt++) {
      const roomCode = this.generateRoomCode();
      const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const { error } = await this.supabaseClient
        .from('live_matches')
        .insert({
          id: matchId,
          room_code: roomCode,
          game_id: gameId,
          status: 'waiting',
          players: [{ id: playerId, role, joined_at: Date.now() }],
          settings
        });

      if (!error) {
        const match: Match = {
          id: matchId,
          gameId,
          roomCode,
          players: [player],
          status: 'waiting',
          createdAt: Date.now(),
          scores: new Map(),
          settings
        };
        this.currentMatch = match;
        window.dispatchEvent(new CustomEvent('multiplayer:room_created', { detail: { match } }));
        return match;
      }
      // 23505 = unique_violation (colisión de room_code); cualquier otro
      // error no tiene sentido reintentarlo con un código distinto.
      if (error.code !== '23505') {
        throw new Error(`No se pudo crear la sala: ${error.message}`);
      }
    }
    throw new Error('No se pudo generar un código de sala único. Probá de nuevo.');
  }

  /**
   * Se une a una sala existente por código. Falla explícitamente si el
   * código no corresponde a ninguna sala en espera (a diferencia de
   * roomManager.ts sobre Realtime Broadcast, donde un código
   * inexistente simplemente no tenía con quién sincronizar — con tablas
   * reales sí podemos distinguir "no existe" de "existe, esperando" y
   * dar un mensaje más útil).
   */
  async joinRoomMatch(gameId: string, roomCode: string, role: string): Promise<Match> {
    await this.waitForInitialization();
    if (!this.supabaseClient || !this.isConnected) {
      throw new Error('No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.');
    }
    const playerId = this.ensurePlayerId();
    const normalizedCode = roomCode.toUpperCase().trim();

    const { data: existing, error: fetchError } = await this.supabaseClient
      .from('live_matches')
      .select('*')
      .eq('room_code', normalizedCode)
      .eq('game_id', gameId)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw new Error(`No se pudo buscar la sala: ${fetchError.message}`);
    if (!existing) throw new Error('No existe una sala activa con ese código para este juego.');

    const existingPlayers: Array<{ id: string; role: string; joined_at: number }> = existing.players || [];
    const alreadyIn = existingPlayers.some((p) => p.id === playerId);
    const nextPlayers = alreadyIn
      ? existingPlayers
      : [...existingPlayers, { id: playerId, role, joined_at: Date.now() }];

    const { error: updateError } = await this.supabaseClient
      .from('live_matches')
      .update({ players: nextPlayers, status: 'playing', started_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updateError) throw new Error(`No se pudo unir a la sala: ${updateError.message}`);

    const match: Match = {
      id: existing.id,
      gameId: existing.game_id,
      roomCode: existing.room_code,
      players: nextPlayers.map((p) => ({ id: p.id, name: 'Jugador', avatar: '👤', level: 1, status: 'online', role: p.role })),
      status: 'playing',
      createdAt: new Date(existing.created_at).getTime(),
      startedAt: Date.now(),
      scores: new Map(),
      // El que se une siempre recibe la config del creador, nunca la
      // fija — así ambos quedan garantizados de jugar con los mismos
      // parámetros de dificultad.
      settings: existing.settings || {}
    };
    this.currentMatch = match;
    window.dispatchEvent(new CustomEvent('multiplayer:room_joined', { detail: { match } }));
    window.dispatchEvent(new CustomEvent('multiplayer:match_started', { detail: { match } }));
    return match;
  }

  /**
   * Envía un evento de juego estructurado al otro jugador de la sala
   * (distinto de sendMatchMessage, que es texto de chat libre) —
   * reutiliza la misma tabla `match_messages`, serializando
   * `{ type, payload }` como el `message`. handleMatchMessage del otro
   * lado lo reconoce por ser JSON válido y lo redispara como
   * `multiplayer:game_event`.
   */
  async sendGameEvent(type: string, payload: unknown): Promise<void> {
    if (!this.currentMatch || !this.playerStatus || !this.supabaseClient) return;
    try {
      await this.supabaseClient.from('match_messages').insert({
        match_id: this.currentMatch.id,
        player_id: this.playerStatus.id,
        message: JSON.stringify({ type, payload })
      });
    } catch (e) {
      console.error('[Multiplayer] Failed to send game event:', e);
    }
  }

  /**
   * Suscribe (además de la suscripción global ya activa desde el
   * constructor) a los cambios de una sala puntual mientras se espera
   * al segundo jugador — usado por la UI de "esperando…" para saber en
   * el momento exacto en que `players` pasa a tener 2 entradas, sin
   * tener que hacer polling.
   */
  onRoomUpdate(matchId: string, handler: (match: Match) => void): () => void {
    if (!this.supabaseClient) return () => {};
    const channel = this.supabaseClient
      .channel(`live_matches:${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_matches', filter: `id=eq.${matchId}` }, (payload: any) => {
        const record = payload.new;
        const players: Array<{ id: string; role: string; joined_at: number }> = record.players || [];
        handler({
          id: record.id,
          gameId: record.game_id,
          roomCode: record.room_code,
          players: players.map((p) => ({ id: p.id, name: 'Jugador', avatar: '👤', level: 1, status: 'online', role: p.role })),
          status: record.status,
          createdAt: new Date(record.created_at).getTime(),
          scores: new Map(),
          settings: record.settings || {}
        });
      })
      .subscribe();

    return () => {
      this.supabaseClient?.removeChannel(channel);
    };
  }

  /** Marca la sala como abandonada y limpia el estado local. Llamar al
   * salir de la vista de sala, tanto si el jugador estaba esperando al
   * otro como si ya estaban jugando — evita que el room_code quede
   * reservado indefinidamente (ver índice único en la migración). */
  async leaveRoomMatch(): Promise<void> {
    if (!this.currentMatch) return;
    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_matches')
          .update({ status: 'abandoned' })
          .eq('id', this.currentMatch.id);
      } catch (e) {
        console.error('[Multiplayer] Failed to leave room match:', e);
      }
    }
    this.currentMatch = null;
  }

  // Match management
  getCurrentMatch(): Match | null {
    return this.currentMatch;
  }

  async startMatch(): Promise<void> {
    if (!this.currentMatch) return;

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_matches')
          .update({ 
            status: 'playing',
            started_at: new Date().toISOString()
          })
          .eq('id', this.currentMatch.id);
      } catch (e) {
        console.error('[Multiplayer] Failed to start match:', e);
      }
    }

    this.currentMatch.status = 'playing';
    this.currentMatch.startedAt = Date.now();

    window.dispatchEvent(new CustomEvent('multiplayer:match_started', {
      detail: { match: this.currentMatch }
    }));
  }

  async updateScore(score: number): Promise<void> {
    if (!this.currentMatch || !this.playerStatus) return;

    this.currentMatch.scores.set(this.playerStatus.id, score);

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_matches')
          .update({ 
            scores: JSON.stringify([...this.currentMatch.scores])
          })
          .eq('id', this.currentMatch.id);
      } catch (e) {
        console.error('[Multiplayer] Failed to update score:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('multiplayer:score_updated', {
      detail: { playerId: this.playerStatus.id, score }
    }));
  }

  /**
   * Cierra una partida jugada dentro de una sala por código (Simon/
   * Arrow/Termita), llamado por cada juego desde su punto de "fin de
   * partida" local (ver endSimonGame/endArrowGame/endTermitaGame).
   *
   * Antes de esto, ningún juego llamaba updateScore()/endMatch(): las
   * salas de live_matches se quedaban en status:'playing' para siempre
   * (el índice único de room_code solo libera el código en 'completed'/
   * 'abandoned', ver migration_005_coop_rooms.sql) y el leaderboard "en
   * vivo" nunca recibía datos de una partida real.
   *
   * A diferencia de endMatch() (pensado para un flujo con scores de
   * ambos jugadores ya sincronizados vía updateScore de los dos lados,
   * que Simon/Arrow/Termita no usan — transmiten el progreso por
   * sendGameEvent/split-view, no por la columna `scores`), acá solo se
   * conoce con certeza el score propio: se guarda con updateScore()
   * primero y luego se cierra la sala. El ganador solo se decide si el
   * Map de scores ya tiene la entrada del rival (por ejemplo, si el
   * rival cerró su partida un instante antes y ese `scores` llegó por
   * Realtime) — si no, se marca 'completed' sin winner en vez de
   * declarar ganador con datos incompletos.
   */
  async finishRoomMatch(finalScore: number): Promise<void> {
    if (!this.currentMatch || !this.playerStatus) return;
    await this.updateScore(finalScore);
    await this.endMatch();
  }

  async endMatch(): Promise<void> {
    if (!this.currentMatch) return;

    // Determine winner — solo si hay más de una entrada en scores
    // (juegos que no usan updateScore/finishRoomMatch de ambos lados
    // pueden llegar acá con un solo score propio; declarar "ganador" a
    // quien sea que tenga el único número cargado sería incorrecto).
    let winner = '';
    if (this.currentMatch.scores.size > 1) {
      let maxScore = -1;
      this.currentMatch.scores.forEach((score, playerId) => {
        if (score > maxScore) {
          maxScore = score;
          winner = playerId;
        }
      });
    }

    this.currentMatch.winner = winner || undefined;
    this.currentMatch.status = 'completed';
    this.currentMatch.completedAt = Date.now();

    const ownScore = this.playerStatus ? this.currentMatch.scores.get(this.playerStatus.id) : undefined;

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_matches')
          .update({ 
            status: 'completed',
            winner_id: winner || null,
            completed_at: new Date().toISOString()
          })
          .eq('id', this.currentMatch.id);

        // Actualiza el leaderboard en vivo con el score propio siempre
        // que se conozca, sea o no ganador de la comparación — así el
        // leaderboard "en vivo" (ver getLeaderboard/renderLeaderboards)
        // recibe datos de cada partida jugada, no solo de la que
        // resultó ganadora cuando hay ambos scores.
        if (ownScore !== undefined && (!winner || winner === this.playerStatus?.id)) {
          await this.updateLeaderboard(this.currentMatch.gameId, ownScore);
        }
      } catch (e) {
        console.error('[Multiplayer] Failed to end match:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('multiplayer:match_ended', {
      detail: { match: this.currentMatch, winner }
    }));

    this.currentMatch = null;
  }

  async leaveMatch(): Promise<void> {
    if (!this.currentMatch) return;

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_matches')
          .update({ status: 'abandoned' })
          .eq('id', this.currentMatch.id);
      } catch (e) {
        console.error('[Multiplayer] Failed to leave match:', e);
      }
    }

    this.currentMatch = null;
    window.dispatchEvent(new CustomEvent('multiplayer:match_left'));
  }

  // Leaderboard management
  // Nota: no existe tabla live_leaderboard en el schema real, así que
  // esto corre siempre en memoria local (se pierde al recargar). Antes
  // intentaba un upsert contra Supabase que fallaba silenciosamente.
  async updateLeaderboard(gameId: string, score: number): Promise<void> {
    if (!this.playerStatus) return;

    const entry: LeaderboardEntry = {
      playerId: this.playerStatus.id,
      playerName: this.playerStatus.name,
      score,
      gameId,
      timestamp: Date.now()
    };

    const currentLeaderboard = this.liveLeaderboards.get(gameId) || [];
    const existingIndex = currentLeaderboard.findIndex(e => e.playerId === entry.playerId);

    if (existingIndex >= 0) {
      if (score > currentLeaderboard[existingIndex].score) {
        currentLeaderboard[existingIndex] = entry;
      }
    } else {
      currentLeaderboard.push(entry);
    }

    currentLeaderboard.sort((a, b) => b.score - a.score);
    this.liveLeaderboards.set(gameId, currentLeaderboard.slice(0, 100));

    window.dispatchEvent(new CustomEvent('multiplayer:leaderboard_updated', {
      detail: { gameId, entry }
    }));
  }

  getLeaderboard(gameId: string): LeaderboardEntry[] {
    return this.liveLeaderboards.get(gameId) || [];
  }

  getAllLeaderboards(): Map<string, LeaderboardEntry[]> {
    return new Map(this.liveLeaderboards);
  }

  // Chat system
  async sendMatchMessage(message: string): Promise<void> {
    if (!this.currentMatch || !this.playerStatus) return;

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('match_messages')
          .insert({
            match_id: this.currentMatch.id,
            player_id: this.playerStatus.id,
            player_name: this.playerStatus.name,
            message,
            created_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Multiplayer: Failed to send message:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('multiplayer:message_sent', {
      detail: { message, playerId: this.playerStatus.id }
    }));
  }

  // Spectator mode

  /**
   * Lista salas activas (esperando o en curso) para mostrar en "Partidas
   * Activas" — sin esto el contenedor #active-matches en la UI nunca se
   * llenaba, porque nada hacía un select real contra live_matches.
   */
  async listActiveMatches(gameId?: string): Promise<Match[]> {
    if (!this.supabaseClient || !this.isConnected) return [];
    try {
      let query = this.supabaseClient
        .from('live_matches')
        .select('*')
        .in('status', ['waiting', 'playing'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (gameId) query = query.eq('game_id', gameId);

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        gameId: row.game_id,
        roomCode: row.room_code,
        players: (row.players || []).map((p: any) => ({
          id: p.id, name: 'Jugador', avatar: '👤', level: 1, status: 'online', role: p.role
        })),
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        scores: new Map(),
        settings: row.settings || {}
      }));
    } catch (e) {
      console.error('[Multiplayer] Failed to list active matches:', e);
      return [];
    }
  }

  async spectateMatch(matchId: string): Promise<Match | null> {
    if (!this.supabaseClient || !this.isConnected) return null;
    try {
      const { data } = await this.supabaseClient
        .from('live_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (!data) return null;

      const match: Match = {
        id: data.id,
        gameId: data.game_id,
        roomCode: data.room_code,
        players: (data.players || []).map((p: any) => ({
          id: p.id, name: 'Jugador', avatar: '👤', level: 1, status: 'online', role: p.role
        })),
        status: data.status,
        createdAt: new Date(data.created_at).getTime(),
        scores: new Map(),
        settings: data.settings || {}
      };

      window.dispatchEvent(new CustomEvent('multiplayer:spectating_started', {
        detail: { match }
      }));
      return match;
    } catch (e) {
      console.error('[Multiplayer] Failed to spectate match:', e);
      return null;
    }
  }

  // Connection status
  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  // Cleanup
  disconnect(): void {
    this.subscriptions.forEach((subscription) => {
      if (this.supabaseClient) {
        this.supabaseClient.removeChannel(subscription);
      }
    });
    this.subscriptions.clear();
    this.isConnected = false;
  }

  reconnect(): void {
    this.disconnect();
    this.initializeSupabase();
  }

  // Reset
  resetData(): void {
    this.currentMatch = null;
    this.liveLeaderboards.clear();
    this.playerStatus = null;
    this.saveLocalData();
  }
}

// Singleton instance
export const multiplayerSystem = new MultiplayerSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).multiplayerSystem = multiplayerSystem;
}

export default multiplayerSystem;
