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
}

interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  gameId: string;
  timestamp: number;
}

interface MatchmakingRequest {
  id: string;
  playerId: string;
  gameId: string;
  skillLevel: number;
  preferredRegion?: string;
  createdAt: number;
}

class MultiplayerSystem {
  private currentMatch: Match | null = null;
  private matchmakingQueue: MatchmakingRequest[] = [];
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

    // Subscribe to matchmaking queue
    const matchmakingSubscription = this.supabaseClient
      .channel('matchmaking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchmaking_queue' }, (payload: any) => {
        this.handleMatchmakingUpdate(payload);
      })
      .subscribe();

    this.subscriptions.set('matchmaking', matchmakingSubscription);

    // Subscribe to live matches
    const matchesSubscription = this.supabaseClient
      .channel('live_matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches' }, (payload: any) => {
        this.handleMatchUpdate(payload);
      })
      .subscribe();

    this.subscriptions.set('matches', matchesSubscription);

    // Subscribe to live leaderboards
    const leaderboardSubscription = this.supabaseClient
      .channel('leaderboards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_leaderboard' }, (payload: any) => {
        this.handleLeaderboardUpdate(payload);
      })
      .subscribe();

    this.subscriptions.set('leaderboard', leaderboardSubscription);

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

  private handleMatchmakingUpdate(payload: any): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        this.matchmakingQueue.push(newRecord);
        this.checkMatchmaking();
        break;
      case 'DELETE':
        this.matchmakingQueue = this.matchmakingQueue.filter(req => req.id !== oldRecord.id);
        break;
    }

    window.dispatchEvent(new CustomEvent('multiplayer:matchmaking_update', {
      detail: { queue: this.matchmakingQueue }
    }));
  }

  private handleMatchUpdate(payload: any): void {
    const { eventType, new: newRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (newRecord.id === this.currentMatch?.id) {
        this.currentMatch = { ...this.currentMatch, ...newRecord };
        
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

  private handleLeaderboardUpdate(payload: any): void {
    const { eventType, new: newRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const gameId = newRecord.gameId;
      const currentLeaderboard = this.liveLeaderboards.get(gameId) || [];
      
      const existingIndex = currentLeaderboard.findIndex(e => e.playerId === newRecord.playerId);
      if (existingIndex >= 0) {
        currentLeaderboard[existingIndex] = newRecord;
      } else {
        currentLeaderboard.push(newRecord);
      }

      // Sort by score descending
      currentLeaderboard.sort((a, b) => b.score - a.score);
      
      // Keep only top 100
      this.liveLeaderboards.set(gameId, currentLeaderboard.slice(0, 100));
    }

    window.dispatchEvent(new CustomEvent('multiplayer:leaderboard_update', {
      detail: { leaderboards: this.liveLeaderboards }
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

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('players')
          .upsert({
            id: sanitizedPlayer.id,
            name: sanitizedPlayer.name,
            avatar: sanitizedPlayer.avatar,
            level: sanitizedPlayer.level,
            status: sanitizedPlayer.status,
            current_game: sanitizedPlayer.currentGame,
            updated_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Multiplayer] Failed to update player status:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('multiplayer:player_status_changed', {
      detail: { player: sanitizedPlayer }
    }));
  }

  getPlayerStatus(): Player | null {
    return this.playerStatus;
  }

  // Matchmaking
  async joinMatchmaking(gameId: string, skillLevel: number = 1): Promise<void> {
    if (!this.playerStatus) {
      throw new Error('Player status not set');
    }

    const request: MatchmakingRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playerId: this.playerStatus.id,
      gameId,
      skillLevel,
      createdAt: Date.now()
    };

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('matchmaking_queue')
          .insert({
            player_id: request.playerId,
            game_id: request.gameId,
            skill_level: request.skillLevel,
            created_at: new Date(request.createdAt).toISOString()
          });
      } catch (e) {
        console.error('[Multiplayer] Failed to join matchmaking:', e);
        throw e;
      }
    } else {
      // Fallback to local queue for offline mode
      this.matchmakingQueue.push(request);
      this.checkMatchmaking();
    }

    window.dispatchEvent(new CustomEvent('multiplayer:matchmaking_joined', {
      detail: { gameId, skillLevel }
    }));
  }

  async leaveMatchmaking(): Promise<void> {
    if (!this.playerStatus) return;

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('matchmaking_queue')
          .delete()
          .eq('player_id', this.playerStatus.id);
      } catch (e) {
        console.error('[Multiplayer] Failed to leave matchmaking:', e);
      }
    } else {
      this.matchmakingQueue = this.matchmakingQueue.filter(
        req => req.playerId !== this.playerStatus?.id
      );
    }

    window.dispatchEvent(new CustomEvent('multiplayer:matchmaking_left'));
  }

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
   */
  async createRoomMatch(gameId: string, role: string): Promise<Match> {
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
          players: [{ id: playerId, role, joined_at: Date.now() }]
        });

      if (!error) {
        const match: Match = {
          id: matchId,
          gameId,
          roomCode,
          players: [player],
          status: 'waiting',
          createdAt: Date.now(),
          scores: new Map()
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
      scores: new Map()
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
          scores: new Map()
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

  private checkMatchmaking(): void {
    // Simple matchmaking: match players with similar skill levels
    const gameGroups = new Map<string, MatchmakingRequest[]>();
    
    this.matchmakingQueue.forEach(req => {
      const group = gameGroups.get(req.gameId) || [];
      group.push(req);
      gameGroups.set(req.gameId, group);
    });

    gameGroups.forEach((requests, gameId) => {
      if (requests.length >= 2) {
        // Sort by skill level and match closest pairs
        requests.sort((a, b) => Math.abs(a.skillLevel - b.skillLevel) - Math.abs(b.skillLevel - a.skillLevel));
        
        // Create match for first two players
        this.createMatch(requests[0], requests[1], gameId);
        
        // Remove matched players from queue
        this.matchmakingQueue = this.matchmakingQueue.filter(
          req => req.playerId !== requests[0].playerId && req.playerId !== requests[1].playerId
        );
      }
    });
  }

  private async createMatch(player1: MatchmakingRequest, player2: MatchmakingRequest, gameId: string): Promise<void> {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const match: Match = {
      id: matchId,
      gameId,
      players: [
        { id: player1.playerId, name: 'Player 1', avatar: '👤', level: player1.skillLevel, status: 'online' },
        { id: player2.playerId, name: 'Player 2', avatar: '👤', level: player2.skillLevel, status: 'online' }
      ],
      status: 'waiting',
      createdAt: Date.now(),
      scores: new Map()
    };

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_matches')
          .insert({
            id: matchId,
            game_id: gameId,
            player1_id: player1.playerId,
            player2_id: player2.playerId,
            status: 'waiting',
            created_at: new Date(match.createdAt).toISOString()
          });
      } catch (e) {
        console.error('[Multiplayer] Failed to create match:', e);
      }
    }

    if (player1.playerId === this.playerStatus?.id || player2.playerId === this.playerStatus?.id) {
      this.currentMatch = match;
      window.dispatchEvent(new CustomEvent('multiplayer:match_found', {
        detail: { match }
      }));
    }
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

  async endMatch(): Promise<void> {
    if (!this.currentMatch) return;

    // Determine winner
    let winner = '';
    let maxScore = -1;
    
    this.currentMatch.scores.forEach((score, playerId) => {
      if (score > maxScore) {
        maxScore = score;
        winner = playerId;
      }
    });

    this.currentMatch.winner = winner;
    this.currentMatch.status = 'completed';
    this.currentMatch.completedAt = Date.now();

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_matches')
          .update({ 
            status: 'completed',
            winner_id: winner,
            completed_at: new Date().toISOString()
          })
          .eq('id', this.currentMatch.id);

        // Update leaderboard
        if (winner === this.playerStatus?.id) {
          await this.updateLeaderboard(this.currentMatch.gameId, maxScore);
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
  async updateLeaderboard(gameId: string, score: number): Promise<void> {
    if (!this.playerStatus) return;

    const entry: LeaderboardEntry = {
      playerId: this.playerStatus.id,
      playerName: this.playerStatus.name,
      score,
      gameId,
      timestamp: Date.now()
    };

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('live_leaderboard')
          .upsert({
            player_id: entry.playerId,
            player_name: entry.playerName,
            score: entry.score,
            game_id: entry.gameId,
            updated_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Multiplayer] Failed to update leaderboard:', e);
      }
    } else {
      // Local leaderboard fallback
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
    }

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
  async spectateMatch(matchId: string): Promise<void> {
    if (this.supabaseClient && this.isConnected) {
      try {
        const { data } = await this.supabaseClient
          .from('live_matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (data) {
          window.dispatchEvent(new CustomEvent('multiplayer:spectating_started', {
            detail: { match: data }
          }));
        }
      } catch (e) {
        console.error('[Multiplayer] Failed to spectate match:', e);
      }
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
    this.matchmakingQueue = [];
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
