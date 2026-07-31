/**
 * Social System - Complete social features
 * Sistema social completo con amigos, chat, clanes y muro de perfil
 */

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

  private supabaseClient: any = null;
  private isConnected: boolean = false;

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
    this.initializeSupabase();
  }

  private async initializeSupabase(): Promise<void> {
    try {
      const { getSupabaseClient } = await import('./core/supabaseClient.js');
      this.supabaseClient = await getSupabaseClient();
      this.isConnected = true;
      this.setupRealtimeSubscriptions();
    } catch (e) {
      console.error('[Social] Failed to initialize Supabase:', e);
      this.isConnected = false;
    }
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.supabaseClient || !this.isConnected) return;

    // Subscribe to friend status updates
    const friendsSubscription = this.supabaseClient
      .channel('friends')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, (payload: any) => {
        this.handleFriendUpdate(payload);
      })
      .subscribe();

    // Subscribe to clan updates
    const clanSubscription = this.supabaseClient
      .channel('clans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clans' }, (payload: any) => {
        this.handleClanUpdate(payload);
      })
      .subscribe();

    // Subscribe to chat messages
    const chatSubscription = this.supabaseClient
      .channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        this.handleChatMessage(payload);
      })
      .subscribe();
  }

  private handleFriendUpdate(payload: any): void {
    const { eventType, new: newRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const friend: Friend = {
        id: newRecord.friend_id,
        name: newRecord.friend_name,
        avatar: newRecord.friend_avatar || '👤',
        level: newRecord.friend_level || 1,
        status: newRecord.status || 'offline',
        currentGame: newRecord.current_game,
        lastSeen: new Date(newRecord.last_seen).getTime(),
        isFavorite: newRecord.is_favorite || false
      };

      this.friends.set(friend.id, friend);
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:friend_updated', {
        detail: { friend }
      }));
    } else if (eventType === 'DELETE') {
      this.friends.delete(payload.old.friend_id);
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('social:friend_removed', {
        detail: { friendId: payload.old.friend_id }
      }));
    }
  }

  private handleClanUpdate(payload: any): void {
    const { eventType, new: newRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const clan: Clan = {
        id: newRecord.id,
        name: newRecord.name,
        tag: newRecord.tag,
        description: newRecord.description,
        leaderId: newRecord.leader_id,
        memberCount: newRecord.member_count,
        level: newRecord.level || 1,
        xp: newRecord.xp || 0,
        createdAt: new Date(newRecord.created_at).getTime(),
        isMember: newRecord.is_member || false,
        role: newRecord.role || 'member'
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

  private handleChatMessage(payload: any): void {
    const message: ChatMessage = {
      id: payload.new.id,
      senderId: payload.new.sender_id,
      senderName: payload.new.sender_name,
      senderAvatar: payload.new.sender_avatar || '👤',
      content: payload.new.content,
      timestamp: new Date(payload.new.created_at).getTime(),
      type: payload.new.type || 'text'
    };

    const chatId = payload.new.chat_id || 'global';
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
    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('friend_requests')
          .insert({
            sender_id: (window as any).progressionSystem?.getCurrentLevel() || 'unknown',
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

  async acceptFriendRequest(playerId: string): Promise<void> {
    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('receiver_id', playerId);

        await this.supabaseClient
          .from('friends')
          .insert({
            player1_id: (window as any).progressionSystem?.getCurrentLevel() || 'unknown',
            player2_id: playerId,
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
    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('friend_requests')
          .update({ status: 'declined' })
          .eq('receiver_id', playerId);
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
    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('friends')
          .delete()
          .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
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
    const clanId = `clan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const clan: Clan = {
      id: clanId,
      name,
      tag,
      description,
      leaderId: 'current_player', // Would be actual player ID
      memberCount: 1,
      level: 1,
      xp: 0,
      createdAt: Date.now(),
      isMember: true,
      role: 'leader'
    };

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('clans')
          .insert({
            id: clanId,
            name,
            tag,
            description,
            leader_id: clan.leaderId,
            member_count: 1,
            level: 1,
            xp: 0,
            created_at: new Date().toISOString()
          });
      } catch (e) {
        console.error('[Social] Failed to create clan:', e);
      }
    }

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

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('clan_members')
          .insert({
            clan_id: clanId,
            player_id: 'current_player',
            role: 'member',
            joined_at: new Date().toISOString()
          });

        await this.supabaseClient
          .from('clans')
          .update({ member_count: clan.memberCount + 1 })
          .eq('id', clanId);
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

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('clan_members')
          .delete()
          .eq('player_id', 'current_player');

        await this.supabaseClient
          .from('clans')
          .update({ member_count: this.currentClan.memberCount - 1 })
          .eq('id', this.currentClan.id);
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
      senderId: 'current_player',
      senderName: 'You',
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
      playerId: 'current_player',
      playerName: 'You',
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
        playerId: 'current_player',
        playerName: 'You',
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
      fromPlayerId: 'current_player',
      fromPlayerName: 'You',
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
  (window as any).socialSystem = socialSystem;
}

export default socialSystem;
