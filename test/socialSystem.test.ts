import { beforeEach, describe, expect, it, vi } from 'vitest';

// SocialSystem se exporta como singleton. Su constructor llama a
// loadLocalData() (síncrono, lee localStorage) y dispara
// initializeSupabase() de forma NO bloqueante (`void promise.catch()`)
// — como no se espera esa promesa, en los tests el singleton queda con
// supabaseClient = null e isConnected = false, que es exactamente el
// estado que cada método async chequea antes de intentar I/O
// (`if (this.supabaseClient && this.isConnected) { ... }`). Esto
// permite testear toda la lógica local (state, eventos, localStorage)
// sin mockear el cliente de Supabase.
//
// Cada test necesita un módulo fresco vía vi.resetModules() +
// re-import dinámico — mismo patrón que el resto de singletons de este
// proyecto — para partir de un estado limpio.

const getUserMock = vi.fn();
vi.mock('../js/authManager', () => ({
  default: { getUser: getUserMock, ready: vi.fn().mockResolvedValue(undefined) },
}));

async function freshSocial(): Promise<typeof import('../js/socialSystem').default> {
  vi.resetModules();
  (localStorage.getItem as any).mockReturnValue(null);
  getUserMock.mockReturnValue(null); // sin sesión por defecto
  return (await import('../js/socialSystem')).default;
}

describe('SocialSystem — carga inicial', () => {
  it('sin nada guardado, arranca con listas vacías y stats en cero', async () => {
    const social = await freshSocial();

    expect(social.getFriends()).toEqual([]);
    expect(social.getFriendRequests()).toEqual([]);
    expect(social.getAvailableClans()).toEqual([]);
    expect(social.getProfilePosts()).toEqual([]);
    expect(social.getKudos()).toEqual([]);
    expect(social.getSocialStats()).toEqual({
      friendsCount: 0,
      clanMembersCount: 0,
      kudosReceived: 0,
      kudosGiven: 0,
      postsCount: 0,
      likesReceived: 0,
    });
  });
});

describe('SocialSystem — posts de perfil', () => {
  let social: Awaited<ReturnType<typeof freshSocial>>;

  beforeEach(async () => {
    social = await freshSocial();
  });

  it('createProfilePost agrega el post al principio de la lista (más reciente primero)', () => {
    social.createProfilePost('Primero', 'status');
    social.createProfilePost('Segundo', 'status');

    const posts = social.getProfilePosts();
    expect(posts).toHaveLength(2);
    expect(posts[0].content).toBe('Segundo');
    expect(posts[1].content).toBe('Primero');
  });

  it('createProfilePost incrementa postsCount en las stats', () => {
    social.createProfilePost('Hola', 'status');
    expect(social.getSocialStats().postsCount).toBe(1);
  });

  it('createProfilePost usa "anon" como playerId si no hay sesión', () => {
    social.createProfilePost('Hola', 'status');
    expect(social.getProfilePosts()[0].playerId).toBe('anon');
  });

  it('createProfilePost usa el id real del usuario autenticado si hay sesión', () => {
    getUserMock.mockReturnValue({ id: 'user_123', username: 'Ana' });
    social.createProfilePost('Hola', 'status');

    expect(social.getProfilePosts()[0].playerId).toBe('user_123');
    expect(social.getProfilePosts()[0].playerName).toBe('Ana');
  });

  it('createProfilePost dispara "social:post_created"', () => {
    const handler = vi.fn();
    window.addEventListener('social:post_created', handler);

    social.createProfilePost('Hola', 'status');

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('social:post_created', handler);
  });

  it('getProfilePosts(playerId) filtra solo los posts de ese jugador', () => {
    getUserMock.mockReturnValue({ id: 'user_a', username: 'A' });
    social.createProfilePost('Post de A', 'status');
    getUserMock.mockReturnValue({ id: 'user_b', username: 'B' });
    social.createProfilePost('Post de B', 'status');

    const postsDeA = social.getProfilePosts('user_a');
    expect(postsDeA).toHaveLength(1);
    expect(postsDeA[0].content).toBe('Post de A');
  });

  it('likePost incrementa likes del post correcto y no toca otros posts', () => {
    social.createProfilePost('Post 1', 'status');
    social.createProfilePost('Post 2', 'status');
    const [post2, post1] = social.getProfilePosts(); // unshift: post2 queda primero

    social.likePost(post1.id);

    expect(social.getProfilePosts().find((p) => p.id === post1.id)?.likes).toBe(1);
    expect(social.getProfilePosts().find((p) => p.id === post2.id)?.likes).toBe(0);
  });

  it('likePost sobre un id inexistente no lanza y no dispara el evento', () => {
    const handler = vi.fn();
    window.addEventListener('social:post_liked', handler);

    expect(() => social.likePost('no_existe')).not.toThrow();
    expect(handler).not.toHaveBeenCalled();

    window.removeEventListener('social:post_liked', handler);
  });

  it('addComment agrega el comentario al post correcto', () => {
    social.createProfilePost('Post 1', 'status');
    const [post] = social.getProfilePosts();

    social.addComment(post.id, 'Buen post!');

    const updated = social.getProfilePosts().find((p) => p.id === post.id);
    expect(updated?.comments).toHaveLength(1);
    expect(updated?.comments[0].content).toBe('Buen post!');
  });

  it('addComment sobre un id inexistente no lanza', () => {
    expect(() => social.addComment('no_existe', 'hola')).not.toThrow();
  });
});

describe('SocialSystem — kudos', () => {
  let social: Awaited<ReturnType<typeof freshSocial>>;

  beforeEach(async () => {
    social = await freshSocial();
  });

  it('sendKudos agrega el kudos y lo asocia al destinatario', () => {
    social.sendKudos('player_x', 'Xavier', '¡Gran partida!');

    const kudos = social.getKudos();
    expect(kudos).toHaveLength(1);
    expect(kudos[0].toPlayerId).toBe('player_x');
    expect(kudos[0].reason).toBe('¡Gran partida!');
  });

  it('sendKudos incrementa kudosGiven en las stats', () => {
    social.sendKudos('player_x', 'Xavier', 'motivo');
    expect(social.getSocialStats().kudosGiven).toBe(1);
  });

  it('sendKudos NO modifica kudosReceived ni getReceivedKudos (eso solo llega vía Supabase real)', () => {
    // receivedKudos se llena únicamente desde el handler de Realtime
    // (datos del servidor), nunca localmente al enviar un kudos propio
    // — se documenta este límite real: sin conexión, "kudos recibidos"
    // nunca refleja kudos entrantes.
    social.sendKudos('player_x', 'Xavier', 'motivo');

    expect(social.getReceivedKudos()).toEqual([]);
    expect(social.getSocialStats().kudosReceived).toBe(0);
  });

  it('sendKudos dispara "social:kudos_sent"', () => {
    const handler = vi.fn();
    window.addEventListener('social:kudos_sent', handler);

    social.sendKudos('player_x', 'Xavier', 'motivo');

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('social:kudos_sent', handler);
  });
});

describe('SocialSystem — amigos (favoritos, filtros)', () => {
  it('setFavoriteFriend sobre un amigo inexistente no lanza y no dispara evento', async () => {
    const social = await freshSocial();
    const handler = vi.fn();
    window.addEventListener('social:friend_favorite_changed', handler);

    expect(() => social.setFavoriteFriend('no_existe', true)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();

    window.removeEventListener('social:friend_favorite_changed', handler);
  });

  it('getFavoriteFriends solo devuelve los marcados como favoritos', async () => {
    // No hay API pública para agregar amigos sin Supabase; se simula el
    // estado post-sync insertando directamente en el Map interno, algo
    // que loadInitialData() haría en producción tras el fetch real.
    const social = await freshSocial();
    (social as any).friends.set('f1', {
      id: 'f1', name: 'Uno', avatar: '👤', level: 1, status: 'online', lastSeen: Date.now(), isFavorite: false,
    });
    (social as any).friends.set('f2', {
      id: 'f2', name: 'Dos', avatar: '👤', level: 1, status: 'online', lastSeen: Date.now(), isFavorite: false,
    });

    social.setFavoriteFriend('f1', true);

    const favorites = social.getFavoriteFriends();
    expect(favorites.map((f) => f.id)).toEqual(['f1']);
  });

  it('getOnlineFriends incluye tanto "online" como "playing", excluye "offline"/"away"', async () => {
    const social = await freshSocial();
    const base = { name: 'X', avatar: '👤', level: 1, lastSeen: Date.now(), isFavorite: false };
    (social as any).friends.set('f1', { ...base, id: 'f1', status: 'online' });
    (social as any).friends.set('f2', { ...base, id: 'f2', status: 'playing' });
    (social as any).friends.set('f3', { ...base, id: 'f3', status: 'offline' });
    (social as any).friends.set('f4', { ...base, id: 'f4', status: 'away' });

    const online = social.getOnlineFriends();
    expect(online.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
  });
});

describe('SocialSystem — solicitudes de amistad (sin sesión)', () => {
  it('sendFriendRequest sin sesión no lanza y no dispara el evento', async () => {
    const social = await freshSocial(); // getUserMock devuelve null por defecto
    const handler = vi.fn();
    window.addEventListener('social:friend_request_sent', handler);

    await social.sendFriendRequest('otro', 'Otro');

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('social:friend_request_sent', handler);
  });

  it('sendFriendRequest con sesión dispara el evento aunque no haya conexión a Supabase', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    const handler = vi.fn();
    window.addEventListener('social:friend_request_sent', handler);

    await social.sendFriendRequest('otro', 'Otro');

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('social:friend_request_sent', handler);
  });

  it('acceptFriendRequest quita la solicitud de la lista local', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    (social as any).friendRequests.set('sender_1', {
      id: 'sender_1', name: 'Sender', avatar: '👤', level: 1, status: 'offline', lastSeen: Date.now(), isFavorite: false,
    });

    await social.acceptFriendRequest('sender_1');

    expect(social.getFriendRequests()).toEqual([]);
  });

  it('declineFriendRequest quita la solicitud de la lista local', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    (social as any).friendRequests.set('sender_1', {
      id: 'sender_1', name: 'Sender', avatar: '👤', level: 1, status: 'offline', lastSeen: Date.now(), isFavorite: false,
    });

    await social.declineFriendRequest('sender_1');

    expect(social.getFriendRequests()).toEqual([]);
  });
});

describe('SocialSystem — clanes', () => {
  it('createClan sin sesión no crea el clan ni dispara el evento', async () => {
    const social = await freshSocial();
    const handler = vi.fn();
    window.addEventListener('social:clan_created', handler);

    await social.createClan('Mi Clan', 'MC', 'desc');

    expect(social.getCurrentClan()).toBeNull();
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('social:clan_created', handler);
  });

  it('createClan con sesión crea el clan localmente como líder', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });

    await social.createClan('Mi Clan', 'MC', 'desc');

    const clan = social.getCurrentClan();
    expect(clan).not.toBeNull();
    expect(clan?.name).toBe('Mi Clan');
    expect(clan?.role).toBe('leader');
    expect(clan?.memberCount).toBe(1);
    expect(social.getSocialStats().clanMembersCount).toBe(1);
  });

  it('joinClan sobre un clanId inexistente no lanza y no cambia el clan actual', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });

    await social.joinClan('no_existe');

    expect(social.getCurrentClan()).toBeNull();
  });

  it('joinClan llamado dos veces sobre el mismo clan NO infla memberCount (guard de isMember)', async () => {
    // Antes del fix, joinClan() no chequeaba `if (clan.isMember) return`
    // antes de incrementar clan.memberCount++, así que llamarlo dos
    // veces sobre el mismo clan inflaba el contador local cada vez.
    // Ahora, si ya soy miembro, joinClan() confirma el estado actual
    // sin reintentar el insert remoto ni tocar memberCount de nuevo.
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    (social as any).clans.set('c1', {
      id: 'c1', name: 'Clan', tag: 'CL', description: '', leaderId: 'otro',
      memberCount: 5, level: 1, xp: 0, createdAt: Date.now(), isMember: false, role: 'member',
    });

    await social.joinClan('c1');
    const countAfterFirstJoin = social.getCurrentClan()?.memberCount;
    await social.joinClan('c1'); // segunda vez sobre el mismo clan ya unido

    expect(social.getCurrentClan()?.memberCount).toBe(countAfterFirstJoin);
  });

  it('joinClan sobre un clan del que ya soy miembro no dispara "social:clan_joined" de nuevo', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    (social as any).clans.set('c1', {
      id: 'c1', name: 'Clan', tag: 'CL', description: '', leaderId: 'otro',
      memberCount: 1, level: 1, xp: 0, createdAt: Date.now(), isMember: false, role: 'member',
    });
    await social.joinClan('c1');

    const handler = vi.fn();
    window.addEventListener('social:clan_joined', handler);
    await social.joinClan('c1'); // segunda vez

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('social:clan_joined', handler);
  });

  it('leaveClan sin clan actual no lanza y no dispara el evento', async () => {
    const social = await freshSocial();
    const handler = vi.fn();
    window.addEventListener('social:clan_left', handler);

    await social.leaveClan();

    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener('social:clan_left', handler);
  });

  it('leaveClan limpia el clan actual y las stats', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    await social.createClan('Mi Clan', 'MC', 'desc');

    await social.leaveClan();

    expect(social.getCurrentClan()).toBeNull();
    expect(social.getSocialStats().clanMembersCount).toBe(0);
  });

  it('leaveClan con memberCount en 1 (único miembro) lo deja en 0', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    await social.createClan('Mi Clan', 'MC', 'desc');
    expect(social.getCurrentClan()?.memberCount).toBe(1);

    const clanRefBeforeLeaving = social.getCurrentClan();
    await social.leaveClan();

    expect(clanRefBeforeLeaving?.memberCount).toBe(0);
  });

  it('leaveClan con memberCount ya en 0 (estado desincronizado) no lo deja en negativo', async () => {
    // Antes del fix, this.currentClan.memberCount-- no tenía piso —
    // un memberCount local ya en 0 (por ejemplo, desincronizado del
    // servidor) hubiera quedado en -1. Ahora Math.max(0, ...) protege
    // ese caso, mismo patrón de clamp que ya usa advancedStats.ts.
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    await social.createClan('Mi Clan', 'MC', 'desc');
    (social as any).currentClan.memberCount = 0; // fuerza el estado desincronizado

    const clanRef = social.getCurrentClan();
    await social.leaveClan();

    expect(clanRef?.memberCount).toBe(0);
  });

  it('getAvailableClans excluye los clanes de los que ya soy miembro', async () => {
    const social = await freshSocial();
    (social as any).clans.set('c1', {
      id: 'c1', name: 'A', tag: 'A', description: '', leaderId: 'x',
      memberCount: 1, level: 1, xp: 0, createdAt: Date.now(), isMember: true, role: 'member',
    });
    (social as any).clans.set('c2', {
      id: 'c2', name: 'B', tag: 'B', description: '', leaderId: 'x',
      memberCount: 1, level: 1, xp: 0, createdAt: Date.now(), isMember: false, role: 'member',
    });

    expect(social.getAvailableClans().map((c) => c.id)).toEqual(['c2']);
  });
});

describe('SocialSystem — chat local', () => {
  it('sendChatMessage sin sesión igual agrega el mensaje local (usa "anon")', async () => {
    const social = await freshSocial();

    await social.sendChatMessage('global', 'Hola a todos');

    const messages = social.getChatMessages('global');
    expect(messages).toHaveLength(1);
    expect(messages[0].senderId).toBe('anon');
    expect(messages[0].content).toBe('Hola a todos');
  });

  it('getChatMessages sobre un chatId sin mensajes devuelve array vacío', async () => {
    const social = await freshSocial();
    expect(social.getChatMessages('nunca_usado')).toEqual([]);
  });

  it('sendChatMessage dispara "social:chat_message_sent" con el chatId correcto', async () => {
    const social = await freshSocial();
    const handler = vi.fn();
    window.addEventListener('social:chat_message_sent', handler);

    await social.sendChatMessage('sala1', 'hey');

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail as { chatId: string };
    expect(detail.chatId).toBe('sala1');
    window.removeEventListener('social:chat_message_sent', handler);
  });
});

describe('SocialSystem — resetSocialData', () => {
  it('limpia todo el estado social a sus valores iniciales', async () => {
    const social = await freshSocial();
    getUserMock.mockReturnValue({ id: 'me', username: 'Yo' });
    social.createProfilePost('Hola', 'status');
    social.sendKudos('otro', 'Otro', 'motivo');
    await social.createClan('Mi Clan', 'MC', 'desc');
    await social.sendChatMessage('global', 'hola');

    social.resetSocialData();

    expect(social.getProfilePosts()).toEqual([]);
    expect(social.getKudos()).toEqual([]);
    expect(social.getCurrentClan()).toBeNull();
    expect(social.getChatMessages('global')).toEqual([]);
    expect(social.getSocialStats()).toEqual({
      friendsCount: 0,
      clanMembersCount: 0,
      kudosReceived: 0,
      kudosGiven: 0,
      postsCount: 0,
      likesReceived: 0,
    });
  });

  it('persiste el estado reseteado en localStorage', async () => {
    const social = await freshSocial();
    social.createProfilePost('Hola', 'status');
    (localStorage.setItem as any).mockClear();

    social.resetSocialData();

    expect(localStorage.setItem).toHaveBeenCalled();
  });
});
