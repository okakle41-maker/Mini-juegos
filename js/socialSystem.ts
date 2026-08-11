/**
 * Social System - Complete social features
 * Sistema social completo con amigos, chat, clanes y muro de perfil
 */

import Auth from './authManager.js';
import type { SupabaseClient, RealtimePostgresChangesPayload, RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  level: number;
  status: 'online' | 'playing' | 'away' | 'offline';
  currentGame?: string;
  lastSeen: number;
  isFavorite: boolean;
}

interface Clan {
  id: string;
  name: string;
  tag: string;
  description: string;
  leaderId: string;
  memberCount: number;
  level: number;
  xp: number;
  createdAt: number;
  isMember: boolean;
  role: 'leader' | 'officer' | 'member';
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system' | 'achievement' | 'challenge';
}

interface ProfilePost {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  type: 'achievement' | 'score' | 'status' | 'challenge';
  gameId?: string;
  score?: number;
  achievementId?: string;
  likes: number;
  comments: Comment[];
  timestamp: number;
}

interface Comment {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  timestamp: number;
}

interface Kudos {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  reason: string;
  timestamp: number;
}

interface SocialStats {
  friendsCount: number;
  clanMembersCount: number;
  kudosReceived: number;
  kudosGiven: number;
  postsCount: number;
  likesReceived: number;
}

/**
 * Filas crudas de Supabase (snake_case), ver
 * supabase/migration_006_social_tournaments.sql.
 */
interface FriendRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

interface FriendRow {
  id: string;
  player1_id: string;
  player2_id: string;
  friend_name: string;
  friend_avatar: string | null;
  friend_level: number | null;
  status: 'online' | 'playing' | 'away' | 'offline';
  current_game: string | null;
  last_seen: string;
  is_favorite: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ClanRow {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  leader_id: string;
  member_count: number;
  level: number;
  xp: number;
  created_at: string;
  updated_at: string;
}

interface ClanMemberRow {
  id: string;
  clan_id: string;
  player_id: string;
  role: 'leader' | 'officer' | 'member';
  joined_at: string;
}

interface ChatMessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  type: 'text' | 'system' | 'achievement' | 'challenge';
  created_at: string;
}

class SocialSystem {
  private friends: Map<string, Friend> = new Map();
  private friendRequests: Map<string, Friend> = new Map();
  private clans: Map<string, Clan> = new Map();
  private currentClan: Clan | null = null;
  private chatMessages: Map<string, ChatMessage[]> = new Map();
  private profilePosts: ProfilePost[] = [];
  private kudos: Kudos[] = [];
  private receivedKudos: Kudos[] = [];
  private socialStats: SocialStats;
  
  private storageKeys = {
    friends: 'social-friends',
    requests: 'social-requests',
    clans: 'social-clans',
    currentClan: 'social-current-clan',
    chat: 'social-chat',
    posts: 'social-posts',
    kudos: 'social-kudos',
    receivedKudos: 'social-received-kudos',
    stats: 'social-stats'
  };

  private supabaseClient: SupabaseClient | null = null;
  private isConnected: boolean = false;
  // Guardadas para poder limpiarlas si en el futuro se agrega un
  // disconnect() (ver el mismo patrón ya resuelto en
  // multiplayerSystem.ts). Hoy no hay ningún disconnect() en este
  // sistema, así que estos canales quedan abiertos durante toda la
  // sesión de la app — eso no cambia con este fix, solo deja de
  // descartarse la referencia a las suscripciones sin necesidad.
  private realtimeSubscriptions: Map<string, unknown> = new Map();

  constructor() {
    this.socialStats = {
      friendsCount: 0,
      clanMembersCount: 0,
      kudosReceived: 0,
      kudosGiven: 0,
      postsCount: 0,
      likesReceived: 0
    };
    
    this.loadLocalData();
    void this.initializeSupabase().catch((err: unknown) => {
      console.error('[SocialSystem] Error durante la inicialización:', err);
    });
  }

  /**
   * Id del jugador autenticado (auth.uid()), o null si no hay sesión.
   * Todas las tablas sociales usan RLS basado en auth.uid()::text, así
   * que cualquier operación remota sin sesión real va a ser rechazada
   * por el backend — mejor no intentarla y avisar explícitamente.
   */
  private currentPlayerId(): string | null {
    return Auth.getUser()?.id ?? null;
  }

  private currentPlayerName(): string {
    return Auth.getUser()?.username ?? 'Jugador';
  }

  private async initializeSupabase(): Promise<void> {
    try {
      const { getSupabaseClient } = await import('./core/supabaseClient.js');
      this.supabaseClient = await getSupabaseClient();
      this.isConnected = true;
      this.setupRealtimeSubscriptions();
      await Auth.ready();
      await this.loadInitialData();
    } catch (e) {
      console.error('[Social] Failed to initialize Supabase:', e);
      this.isConnected = false;
    }
  }

  /**
   * Carga inicial real desde Supabase. Sin esto, al recargar la página
   * solo se ve lo que quedó en localStorage de una sesión anterior —
   * los datos del servidor solo llegaban antes vía eventos Realtime
   * mientras la pestaña seguía abierta, así que un amigo agregado desde
   * otro dispositivo nunca aparecía hasta el próximo evento en vivo.
   */
  private async loadInitialData(): Promise<void> {
    const myId = this.currentPlayerId();
    if (!myId || !this.supabaseClient) return;

    try {
      const [friendsRes, requestsRes, clansRes, chatRes] = await Promise.all([
        this.supabaseClient
          .from('friends')
          .select('*')
          .or(`player1_id.eq.${myId},player2_id.eq.${myId}`),
        this.supabaseClient
          .from('friend_requests')
          .select('*')
          .eq('receiver_id', myId)
          .eq('status', 'pending'),
        this.supabaseClient
          .from('clans')
          .select('*, clan_members!inner(player_id, role)')
          .eq('clan_members.player_id', myId),
        this.supabaseClient
          .from('chat_messages')
          .select('*')
          .eq('chat_id', 'global')
          .order('created_at', { ascending: true })
          .limit(50)
      ]);

      if (friendsRes.data) {
        for (const row of friendsRes.data) {
          const friend: Friend = {
            id: row.player1_id === myId ? row.player2_id : row.player1_id,
            name: row.friend_name,
            avatar: row.friend_avatar || '👤',
            level: row.friend_level || 1,
            status: row.status || 'offline',
            currentGame: row.current_game,
            lastSeen: new Date(row.last_seen).getTime(),
            isFavorite: row.is_favorite || false
          };
          this.friends.set(friend.id, friend);
        }
        this.socialStats.friendsCount = this.friends.size;
      }

      if (requestsRes.data && requestsRes.data.length > 0) {
        // friend_requests no tiene nombre denormalizado — a diferencia de
        // `friends` (que sí guarda friend_name en el INSERT de
        // acceptFriendRequest), acá solo hay sender_id. Se resuelve el
        // username real vía `profiles` (select público, ver
        // profiles_select_all en schema.sql) en vez de mostrar el uuid
        // crudo como si fuera un nombre — y, más importante, en vez de
        // que ese mismo uuid termine persistido como `friend_name` al
        // aceptar la solicitud (ver acceptFriendRequest más abajo).
        const senderIds = requestsRes.data.map((row: FriendRequestRow) => row.sender_id);
        const { data: profilesData } = await this.supabaseClient
          .from('profiles')
          .select('id, username')
          .in('id', senderIds);
        const usernameById = new Map<string, string>((profilesData ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));

        for (const row of requestsRes.data) {
          this.friendRequests.set(row.sender_id, {
            id: row.sender_id,
            name: usernameById.get(row.sender_id) ?? 'Jugador',
            avatar: '👤',
            level: 1,
            status: 'offline',
            lastSeen: Date.now(),
            isFavorite: false
          });
        }
      }

      if (clansRes.data) {
        type ClanWithMembership = ClanRow & {
          clan_members: Pick<ClanMemberRow, 'player_id' | 'role'> | Pick<ClanMemberRow, 'player_id' | 'role'>[];
        };
        for (const row of clansRes.data as ClanWithMembership[]) {
          const membership = Array.isArray(row.clan_members) ? row.clan_members[0] : row.clan_members;
          const clan: Clan = {
            id: row.id,
            name: row.name,
            tag: row.tag,
            description: row.description ?? '',
            leaderId: row.leader_id,
            memberCount: row.member_count,
            level: row.level || 1,
            xp: row.xp || 0,
            createdAt: new Date(row.created_at).getTime(),
            isMember: true,
            role: membership?.role || 'member'
          };
          this.clans.set(clan.id, clan);
          if (clan.leaderId === myId || membership) {
            this.currentClan = clan;
          }
        }
        this.socialStats.clanMembersCount = this.currentClan?.memberCount || 0;
      }

      if (chatRes.data) {
        const messages: ChatMessage[] = chatRes.data.map((row: ChatMessageRow) => ({
          id: row.id,
          senderId: row.sender_id,
          senderName: row.sender_name,
          senderAvatar: row.sender_avatar || '👤',
          content: row.content,
          timestamp: new Date(row.created_at).getTime(),
          type: row.type || 'text'
        }));
        this.chatMessages.set('global', messages);
      }

      this.saveLocalData();
      window.dispatchEvent(new CustomEvent('social:initial_data_loaded'));
    } catch (e) {
      console.error('[Social] Failed to load initial data:', e);
    }
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.supabaseClient || !this.isConnected) return;

    // Subscribe to friend status updates
    const friendsSubscription = this.supabaseClient
      .channel('friends')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, (payload: RealtimePostgresChangesPayload<FriendRow>) => {
        this.handleFriendUpdate(payload);
      })
      .subscribe();
    this.realtimeSubscriptions.set('friends', friendsSubscription);

    // Subscribe to clan updates
    const clanSubscription = this.supabaseClient
      .channel('clans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clans' }, (payload: RealtimePostgresChangesPayload<ClanRow>) => {
        this.handleClanUpdate(payload);
      })
      .subscribe();
    this.realtimeSubscriptions.set('clans', clanSubscription);

    // Subscribe to chat messages
    const chatSubscription = this.supabaseClient
      .channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: RealtimePostgresInsertPayload<ChatMessageRow>) => {
        this.handleChatMessage(payload);
      })
      .subscribe();
    this.realtimeSubscriptions.set('chat', chatSubscription);
  }

  /**
   * La tabla `friends` (migration_006) no tiene columna `friend_id` — es
   * una fila simétrica por PAR de jugadores (`player1_id`/`player2_id`,
   * ver migración). El id del amigo, desde la perspectiva de quien
   * mira, es "el otro" de los dos — mismo cálculo que loadInitialData()
   * ya hace al cargar la lista inicial. Antes este handler leía
   * `newRecord.friend_id` (columna inexistente, siempre `undefined`) y
   * cada evento de Realtime en el canal `friends` terminaba guardando
   * una entrada con `id: undefined` en vez de actualizar/crear la fila
   * correcta del amigo real.
   */
  private friendIdFromRow(row: { player1_id: string; player2_id: string }): string | null {
    const myId = this.currentPlayerId();
    if (!myId) return null;
    if (row.player1_id === myId) return row.player2_id;
    if (row.player2_id === myId) return row.player1_id;
    return null; // fila de otro par de jugadores, no debería llegar acá (RLS)
  }

  private handleFriendUpdate(payload: RealtimePostgresChangesPayload<FriendRow>): void {
    const { eventType } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const newRecord = payload.new;
      const friendId = this.friendIdFromRow(newRecord);
      if (!friendId) return;

      const friend: Friend = {
        id: friendId,
        name: newRecord.friend_name,
        avatar: newRecord.friend_avatar || '👤',
        level: newRecord.friend_level || 1,
        status: newRecord.status || 'offline',
        currentGame: newRecord.current_game ?? undefined,
        lastSeen: new Date(newRecord.last_seen).getTime(),
        isFavorite: newRecord.is_favorite || false
      };

      this.friends.set(friend.id, friend);
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:friend_updated', {
        detail: { friend }
      }));
    } else if (eventType === 'DELETE') {
      const oldRecord = payload.old as Partial<FriendRow>;
      const friendId = oldRecord.player1_id && oldRecord.player2_id
        ? this.friendIdFromRow(oldRecord as FriendRow)
        : null;
      if (!friendId) return;
      this.friends.delete(friendId);
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:friend_removed', {
        detail: { friendId }
      }));
    }
  }

  private handleClanUpdate(payload: RealtimePostgresChangesPayload<ClanRow>): void {
    const { eventType } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const newRecord = payload.new;
      // is_member/role no son columnas de clans (esa tabla no sabe
      // nada de "quién pregunta") — son estado derivado de si el
      // jugador actual tiene o no una fila en clan_members para este
      // clan. Se preserva lo que ya sabíamos localmente en vez de leer
      // columnas inexistentes que siempre venían undefined/false.
      const existing = this.clans.get(newRecord.id);
      const myId = this.currentPlayerId();
      const isMe = existing?.isMember || newRecord.leader_id === myId;

      const clan: Clan = {
        id: newRecord.id,
        name: newRecord.name,
        tag: newRecord.tag,
        description: newRecord.description ?? '',
        leaderId: newRecord.leader_id,
        memberCount: newRecord.member_count,
        level: newRecord.level || 1,
        xp: newRecord.xp || 0,
        createdAt: new Date(newRecord.created_at).getTime(),
        isMember: isMe,
        role: existing?.role || (newRecord.leader_id === myId ? 'leader' : 'member')
      };

      this.clans.set(clan.id, clan);
      if (clan.isMember) {
        this.currentClan = clan;
      }
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:clan_updated', {
        detail: { clan }
      }));
    }
  }

  private handleChatMessage(payload: RealtimePostgresInsertPayload<ChatMessageRow>): void {
    const newRecord = payload.new;
    const message: ChatMessage = {
      id: newRecord.id,
      senderId: newRecord.sender_id,
      senderName: newRecord.sender_name,
      senderAvatar: newRecord.sender_avatar || '👤',
      content: newRecord.content,
      timestamp: new Date(newRecord.created_at).getTime(),
      type: newRecord.type || 'text'
    };

    const chatId = newRecord.chat_id || 'global';
    const messages = this.chatMessages.get(chatId) || [];
    messages.push(message);
    this.chatMessages.set(chatId, messages);
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:chat_message', {
      detail: { message, chatId }
    }));
  }

  private loadLocalData(): void {
    const friendsData = localStorage.getItem(this.storageKeys.friends);
    if (friendsData) {
      try {
        this.friends = new Map(JSON.parse(friendsData));
      } catch (e) {
        console.error('[Social] Failed to load friends:', e);
      }
    }

    const requestsData = localStorage.getItem(this.storageKeys.requests);
    if (requestsData) {
      try {
        this.friendRequests = new Map(JSON.parse(requestsData));
      } catch (e) {
        console.error('[Social] Failed to load requests:', e);
      }
    }

    const clansData = localStorage.getItem(this.storageKeys.clans);
    if (clansData) {
      try {
        this.clans = new Map(JSON.parse(clansData));
      } catch (e) {
        console.error('[Social] Failed to load clans:', e);
      }
    }

    const currentClanData = localStorage.getItem(this.storageKeys.currentClan);
    if (currentClanData) {
      try {
        this.currentClan = JSON.parse(currentClanData);
      } catch (e) {
        console.error('[Social] Failed to load current clan:', e);
      }
    }

    const chatData = localStorage.getItem(this.storageKeys.chat);
    if (chatData) {
      try {
        this.chatMessages = new Map(JSON.parse(chatData));
      } catch (e) {
        console.error('[Social] Failed to load chat:', e);
      }
    }

    const postsData = localStorage.getItem(this.storageKeys.posts);
    if (postsData) {
      try {
        this.profilePosts = JSON.parse(postsData);
      } catch (e) {
        console.error('[Social] Failed to load posts:', e);
      }
    }

    const kudosData = localStorage.getItem(this.storageKeys.kudos);
    if (kudosData) {
      try {
        this.kudos = JSON.parse(kudosData);
      } catch (e) {
        console.error('[Social] Failed to load kudos:', e);
      }
    }

    const receivedKudosData = localStorage.getItem(this.storageKeys.receivedKudos);
    if (receivedKudosData) {
      try {
        this.receivedKudos = JSON.parse(receivedKudosData);
      } catch (e) {
        console.error('[Social] Failed to load received kudos:', e);
      }
    }

    const statsData = localStorage.getItem(this.storageKeys.stats);
    if (statsData) {
      try {
        this.socialStats = JSON.parse(statsData);
      } catch (e) {
        console.error('[Social] Failed to load stats:', e);
      }
    }
  }

  private saveLocalData(): void {
    localStorage.setItem(this.storageKeys.friends, JSON.stringify([...this.friends]));
    localStorage.setItem(this.storageKeys.requests, JSON.stringify([...this.friendRequests]));
    localStorage.setItem(this.storageKeys.clans, JSON.stringify([...this.clans]));
    localStorage.setItem(this.storageKeys.currentClan, JSON.stringify(this.currentClan));
    localStorage.setItem(this.storageKeys.chat, JSON.stringify([...this.chatMessages]));
    localStorage.setItem(this.storageKeys.posts, JSON.stringify(this.profilePosts));
    localStorage.setItem(this.storageKeys.kudos, JSON.stringify(this.kudos));
    localStorage.setItem(this.storageKeys.receivedKudos, JSON.stringify(this.receivedKudos));
    localStorage.setItem(this.storageKeys.stats, JSON.stringify(this.socialStats));
  }

  // Friend system
  async sendFriendRequest(playerId: string, playerName: string): Promise<void> {
    const myId = this.currentPlayerId();
    if (!myId) {
      console.error('[Social] Cannot send friend request: no session');
      return;
    }

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('friend_requests')
          .insert({
            sender_id: myId,
            receiver_id: playerId,
            status: 'pending',
            created_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Social] Failed to send friend request:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('social:friend_request_sent', {
      detail: { playerId, playerName }
    }));
  }

  /**
   * playerId acá es el id de quien ENVIÓ la solicitud (sender), tal
   * como lo expone getFriendRequests()/renderFriendRequests() — no el
   * receptor (que siempre es el usuario actual). El update y el insert
   * tienen que filtrar/usar los ids correctos en cada rol, o la fila
   * nunca se encuentra (y con RLS, ni siquiera pasaría el check).
   */
  async acceptFriendRequest(playerId: string): Promise<void> {
    const myId = this.currentPlayerId();
    if (!myId) {
      console.error('[Social] Cannot accept friend request: no session');
      return;
    }

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('sender_id', playerId)
          .eq('receiver_id', myId);

        // this.friendRequests.get(playerId)?.name ya viene resuelto a un
        // username real desde loadInitialData (ver el fetch a `profiles`
        // ahí) — el fallback final a 'Jugador' (no a `playerId`) evita
        // que un uuid crudo quede persistido para siempre como
        // friend_name si por algún motivo la solicitud no estaba en el
        // mapa local (p.ej. aceptada desde otra pestaña).
        await this.supabaseClient
          .from('friends')
          .insert({
            player1_id: myId,
            player2_id: playerId,
            friend_name: this.friendRequests.get(playerId)?.name || 'Jugador',
            created_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Social] Failed to accept friend request:', e);
      }
    }

    this.friendRequests.delete(playerId);
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:friend_request_accepted', {
      detail: { playerId }
    }));
  }

  async declineFriendRequest(playerId: string): Promise<void> {
    const myId = this.currentPlayerId();

    if (this.supabaseClient && this.isConnected && myId) {
      try {
        await this.supabaseClient
          .from('friend_requests')
          .update({ status: 'declined' })
          .eq('sender_id', playerId)
          .eq('receiver_id', myId);
      } catch (e) {
        console.error('[Social] Failed to decline friend request:', e);
      }
    }

    this.friendRequests.delete(playerId);
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:friend_request_declined', {
      detail: { playerId }
    }));
  }

  async removeFriend(playerId: string): Promise<void> {
    const myId = this.currentPlayerId();

    if (this.supabaseClient && this.isConnected && myId) {
      try {
        // Acotado al par (yo, playerId): el .or() original borraba
        // cualquier fila donde apareciera playerId, incluidas amistades
        // de ese jugador con terceros que no tienen nada que ver conmigo.
        await this.supabaseClient
          .from('friends')
          .delete()
          .or(`and(player1_id.eq.${myId},player2_id.eq.${playerId}),and(player1_id.eq.${playerId},player2_id.eq.${myId})`);
      } catch (e) {
        console.error('[Social] Failed to remove friend:', e);
      }
    }

    this.friends.delete(playerId);
    this.socialStats.friendsCount = this.friends.size;
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:friend_removed', {
      detail: { playerId }
    }));
  }

  setFavoriteFriend(playerId: string, isFavorite: boolean): void {
    const friend = this.friends.get(playerId);
    if (friend) {
      friend.isFavorite = isFavorite;
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:friend_favorite_changed', {
        detail: { playerId, isFavorite }
      }));
    }
  }

  getFriends(): Friend[] {
    return [...this.friends.values()];
  }

  getFavoriteFriends(): Friend[] {
    return [...this.friends.values()].filter(f => f.isFavorite);
  }

  getOnlineFriends(): Friend[] {
    return [...this.friends.values()].filter(f => f.status === 'online' || f.status === 'playing');
  }

  getFriendRequests(): Friend[] {
    return [...this.friendRequests.values()];
  }

  // Clan system
  async createClan(name: string, tag: string, description: string): Promise<void> {
    const myId = this.currentPlayerId();
    if (!myId) {
      console.error('[Social] Cannot create clan: no session');
      return;
    }

    let clanId = `clan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (this.supabaseClient && this.isConnected) {
      try {
        // clans.id es uuid con default gen_random_uuid(); dejamos que
        // Postgres lo genere en vez de insertar un string tipo
        // "clan_1234..." que rompería el tipo de la columna.
        const { data, error } = await this.supabaseClient
          .from('clans')
          .insert({
            name,
            tag,
            description,
            leader_id: myId,
            member_count: 1,
            level: 1,
            xp: 0,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!error && data) {
          clanId = data.id;
          await this.supabaseClient
            .from('clan_members')
            .insert({
              clan_id: clanId,
              player_id: myId,
              role: 'leader',
              joined_at: new Date().toISOString()
            });
        }
      } catch (e) {
        console.error('[Social] Failed to create clan:', e);
      }
    }

    const clan: Clan = {
      id: clanId,
      name,
      tag,
      description,
      leaderId: myId,
      memberCount: 1,
      level: 1,
      xp: 0,
      createdAt: Date.now(),
      isMember: true,
      role: 'leader'
    };

    this.clans.set(clanId, clan);
    this.currentClan = clan;
    this.socialStats.clanMembersCount = 1;
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:clan_created', {
      detail: { clan }
    }));
  }

  async joinClan(clanId: string): Promise<void> {
    const clan = this.clans.get(clanId);
    if (!clan) return;

    const myId = this.currentPlayerId();
    if (!myId) {
      console.error('[Social] Cannot join clan: no session');
      return;
    }

    if (this.supabaseClient && this.isConnected) {
      try {
        // member_count se recalcula solo vía trigger (ver migración 007)
        await this.supabaseClient
          .from('clan_members')
          .insert({
            clan_id: clanId,
            player_id: myId,
            role: 'member',
            joined_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Social] Failed to join clan:', e);
      }
    }

    clan.isMember = true;
    clan.memberCount++;
    clan.role = 'member';
    this.currentClan = clan;
    this.socialStats.clanMembersCount = clan.memberCount;
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:clan_joined', {
      detail: { clan }
    }));
  }

  async leaveClan(): Promise<void> {
    if (!this.currentClan) return;

    const myId = this.currentPlayerId();
    if (!myId) {
      console.error('[Social] Cannot leave clan: no session');
      return;
    }

    if (this.supabaseClient && this.isConnected) {
      try {
        // Acotado al clan actual: el .eq('player_id', ...) original sin
        // filtrar por clan_id borraba TODAS las membresías del jugador,
        // no solo la del clan que está dejando.
        // member_count se recalcula solo vía trigger (ver migración 007)
        await this.supabaseClient
          .from('clan_members')
          .delete()
          .eq('player_id', myId)
          .eq('clan_id', this.currentClan.id);
      } catch (e) {
        console.error('[Social] Failed to leave clan:', e);
      }
    }

    this.currentClan.isMember = false;
    this.currentClan.memberCount--;
    this.currentClan = null;
    this.socialStats.clanMembersCount = 0;
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:clan_left'));
  }

  getCurrentClan(): Clan | null {
    return this.currentClan;
  }

  getAvailableClans(): Clan[] {
    return [...this.clans.values()].filter(c => !c.isMember);
  }

  // Chat system
  async sendChatMessage(chatId: string, content: string, type: ChatMessage['type'] = 'text'): Promise<void> {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: this.currentPlayerId() || 'anon',
      senderName: this.currentPlayerName(),
      senderAvatar: '👤',
      content,
      timestamp: Date.now(),
      type
    };

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('chat_messages')
          .insert({
            id: message.id,
            chat_id: chatId,
            sender_id: message.senderId,
            sender_name: message.senderName,
            sender_avatar: message.senderAvatar,
            content: message.content,
            type: message.type,
            created_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Social] Failed to send chat message:', e);
      }
    }

    const messages = this.chatMessages.get(chatId) || [];
    messages.push(message);
    this.chatMessages.set(chatId, messages);
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:chat_message_sent', {
      detail: { message, chatId }
    }));
  }

  getChatMessages(chatId: string): ChatMessage[] {
    return this.chatMessages.get(chatId) || [];
  }

  // Profile posts
  createProfilePost(content: string, type: ProfilePost['type'], gameId?: string, score?: number, achievementId?: string): void {
    const post: ProfilePost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playerId: this.currentPlayerId() || 'anon',
      playerName: this.currentPlayerName(),
      content,
      type,
      gameId,
      score,
      achievementId,
      likes: 0,
      comments: [],
      timestamp: Date.now()
    };

    this.profilePosts.unshift(post);
    this.socialStats.postsCount++;
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:post_created', {
      detail: { post }
    }));
  }

  likePost(postId: string): void {
    const post = this.profilePosts.find(p => p.id === postId);
    if (post) {
      post.likes++;
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:post_liked', {
        detail: { postId }
      }));
    }
  }

  addComment(postId: string, content: string): void {
    const post = this.profilePosts.find(p => p.id === postId);
    if (post) {
      const comment: Comment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        playerId: this.currentPlayerId() || 'anon',
        playerName: this.currentPlayerName(),
        content,
        timestamp: Date.now()
      };

      post.comments.push(comment);
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:comment_added', {
        detail: { postId, comment }
      }));
    }
  }

  getProfilePosts(playerId?: string): ProfilePost[] {
    if (playerId) {
      return this.profilePosts.filter(p => p.playerId === playerId);
    }
    return this.profilePosts;
  }

  // Kudos system
  sendKudos(toPlayerId: string, toPlayerName: string, reason: string): void {
    const kudos: Kudos = {
      id: `kudos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromPlayerId: this.currentPlayerId() || 'anon',
      fromPlayerName: this.currentPlayerName(),
      toPlayerId,
      toPlayerName,
      reason,
      timestamp: Date.now()
    };

    this.kudos.push(kudos);
    this.socialStats.kudosGiven++;
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('social:kudos_sent', {
      detail: { kudos }
    }));
  }

  getKudos(): Kudos[] {
    return this.kudos;
  }

  getReceivedKudos(): Kudos[] {
    return this.receivedKudos;
  }

  // Social stats
  getSocialStats(): SocialStats {
    return { ...this.socialStats };
  }

  // Reset
  resetSocialData(): void {
    this.friends.clear();
    this.friendRequests.clear();
    this.clans.clear();
    this.currentClan = null;
    this.chatMessages.clear();
    this.profilePosts = [];
    this.kudos = [];
    this.receivedKudos = [];
    this.socialStats = {
      friendsCount: 0,
      clanMembersCount: 0,
      kudosReceived: 0,
      kudosGiven: 0,
      postsCount: 0,
      likesReceived: 0
    };
    this.saveLocalData();
  }
}

// Singleton instance
export const socialSystem = new SocialSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.socialSystem = socialSystem;
}

export default socialSystem;
