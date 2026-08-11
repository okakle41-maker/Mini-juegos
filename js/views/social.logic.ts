/**
 * Social View Logic
 * Lógica para la vista del sistema social
 */

import { socialSystem } from '../socialSystem.js';
import { template } from './social.js';
import { escapeHtml } from '../security.js';
import { hydrateBackButtons } from '../utils/backButton.js';
import { onClickAsync } from '../utils/asyncEventHandler.js';
import { describeMatchError } from '../utils/describeMatchError.js';

let eventListeners: Array<() => void> = [];
// (Sistema de caché de elementos DOM eliminado: getElement() nunca
// se llamaba en este archivo, así que cachedElements tampoco tenía
// nada real que limpiar.)

export function init(): void {
  const container = document.getElementById('social');
  if (!container) return;

  container.innerHTML = template();
  hydrateBackButtons(container);
  renderSocialStats();
  renderFriends();
  setupEventListeners();
  setupSocialListeners();
}

function renderSocialStats(): void {
  const stats = socialSystem.getSocialStats();
  document.getElementById('friends-count')!.textContent = stats.friendsCount.toString();
  document.getElementById('kudos-received')!.textContent = stats.kudosReceived.toString();
}

function renderFriends(): void {
  const friends = socialSystem.getFriends();
  const friendsList = document.getElementById('friends-list');
  
  if (friendsList) {
    friendsList.innerHTML = friends.length > 0 ? friends.map(friend => `
      <div class="friend-card">
        <span class="friend-avatar">${escapeHtml(friend.avatar)}</span>
        <div class="friend-info">
          <h4 class="friend-name">${escapeHtml(friend.name)}</h4>
          <span class="friend-status friend-status--${friend.status}">${friend.status}</span>
        </div>
        ${friend.isFavorite ? '<span class="friend-favorite">⭐</span>' : ''}
      </div>
    `).join('') : '<p class="no-friends">No tienes amigos aún</p>';
  }
}

function setupEventListeners(): void {
  // Social tabs
  document.querySelectorAll('.social-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('social-tab--active'));
      tab.classList.add('social-tab--active');
      switchSocialTab((tab as HTMLElement).dataset.tab || 'friends');
    });
  });

  // Añadir amigo
  document.getElementById('add-friend-btn')?.addEventListener('click', onClickAsync(async () => {
    const playerId = prompt('Ingresa el ID del jugador:');
    const playerName = prompt('Ingresa el nombre del jugador:');
    if (playerId && playerName) {
      try {
        await socialSystem.sendFriendRequest(playerId, playerName);
        alert('Solicitud enviada');
      } catch (err) {
        alert(describeMatchError(err, 'No se pudo enviar la solicitud.'));
      }
    }
  }));

  // Solicitudes de amistad
  document.getElementById('friend-requests-btn')?.addEventListener('click', () => {
    document.getElementById('friend-requests-modal')!.style.display = 'block';
    renderFriendRequests();
  });

  document.getElementById('close-requests-btn')?.addEventListener('click', () => {
    document.getElementById('friend-requests-modal')!.style.display = 'none';
  });

  // Crear post
  document.getElementById('create-post-btn')?.addEventListener('click', () => {
    const content = (document.getElementById('post-input') as HTMLTextAreaElement).value;
    const type = (document.getElementById('post-type') as HTMLSelectElement).value;
    if (content.trim()) {
      socialSystem.createProfilePost(content, type as any);
      (document.getElementById('post-input') as HTMLTextAreaElement).value = '';
      renderPosts();
    }
  });

  // Chat tabs
  document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('chat-tab--active'));
      tab.classList.add('chat-tab--active');
      switchChatTab((tab as HTMLElement).dataset.chat || 'global');
    });
  });

  // Enviar mensaje social
  document.getElementById('social-chat-send-btn')?.addEventListener('click', onClickAsync(async () => {
    const input = document.getElementById('social-chat-input') as HTMLInputElement;
    const message = input.value.trim();
    if (message) {
      await socialSystem.sendChatMessage('global', message);
      input.value = '';
    }
  }));
}

function switchSocialTab(tab: string): void {
  document.querySelectorAll('.social-tab-content').forEach(content => {
    (content as HTMLElement).style.display = 'none';
  });
  
  const targetTab = document.getElementById(`${tab}-tab`);
  if (targetTab) {
    targetTab.style.display = 'block';
  }

  if (tab === 'friends') {
    renderFriends();
  } else if (tab === 'profile') {
    renderPosts();
  }
}

function switchChatTab(chat: string): void {
  renderChatMessages(chat);
}

function renderFriendRequests(): void {
  const requests = socialSystem.getFriendRequests();
  const requestsList = document.getElementById('requests-list');
  
  if (requestsList) {
    requestsList.innerHTML = requests.length > 0 ? requests.map(request => `
      <div class="request-card">
        <span class="request-name">${escapeHtml(request.name)}</span>
        <div class="request-actions">
          <button class="request-accept-btn" data-player-id="${request.id}">Aceptar</button>
          <button class="request-decline-btn" data-player-id="${request.id}">Rechazar</button>
        </div>
      </div>
    `).join('') : '<p class="no-requests">No tienes solicitudes pendientes</p>';

    // Añadir listeners a los botones
    document.querySelectorAll('.request-accept-btn').forEach(btn => {
      btn.addEventListener('click', onClickAsync(async () => {
        const playerId = (btn as HTMLElement).dataset.playerId;
        if (playerId) {
          await socialSystem.acceptFriendRequest(playerId);
          renderFriendRequests();
        }
      }));
    });

    document.querySelectorAll('.request-decline-btn').forEach(btn => {
      btn.addEventListener('click', onClickAsync(async () => {
        const playerId = (btn as HTMLElement).dataset.playerId;
        if (playerId) {
          await socialSystem.declineFriendRequest(playerId);
          renderFriendRequests();
        }
      }));
    });
  }
}

function renderPosts(): void {
  const posts = socialSystem.getProfilePosts();
  const postsFeed = document.getElementById('posts-feed');
  
  if (postsFeed) {
    postsFeed.innerHTML = posts.slice(0, 10).map(post => `
      <div class="post-card">
        <div class="post-header">
          <span class="post-author">${escapeHtml(post.playerName)}</span>
          <span class="post-time">${new Date(post.timestamp).toLocaleString()}</span>
        </div>
        <p class="post-content">${escapeHtml(post.content)}</p>
        <div class="post-actions">
          <button class="post-like-btn" data-post-id="${post.id}">
            ❤️ ${post.likes}
          </button>
          <button class="post-comment-btn" data-post-id="${post.id}">
            💬 ${post.comments.length}
          </button>
        </div>
      </div>
    `).join('');
  }
}

function renderChatMessages(chatId: string): void {
  const messages = socialSystem.getChatMessages(chatId);
  const chatMessages = document.getElementById('social-chat-messages');
  
  if (chatMessages) {
    chatMessages.innerHTML = messages.map(msg => `
      <div class="chat-message">
        <span class="chat-sender">${escapeHtml(msg.senderName)}:</span>
        <span class="chat-content">${escapeHtml(msg.content)}</span>
      </div>
    `).join('');
  }
}

function setupSocialListeners(): void {
  const friendUpdatedHandler = () => {
    renderFriends();
    renderSocialStats();
  };
  const chatMessageHandler = (e: any) => {
    const chatMessages = document.getElementById('social-chat-messages');
    if (chatMessages) {
      const msg = e.detail.message;
      chatMessages.innerHTML += `
        <div class="chat-message">
          <span class="chat-sender">${escapeHtml(msg.senderName)}:</span>
          <span class="chat-content">${escapeHtml(msg.content)}</span>
        </div>
      `;
    }
  };
  const postCreatedHandler = () => {
    renderPosts();
  };

  window.addEventListener('social:friend_updated', friendUpdatedHandler);
  window.addEventListener('social:chat_message', chatMessageHandler);
  window.addEventListener('social:post_created', postCreatedHandler);

  eventListeners.push(() => {
    window.removeEventListener('social:friend_updated', friendUpdatedHandler);
    window.removeEventListener('social:chat_message', chatMessageHandler);
    window.removeEventListener('social:post_created', postCreatedHandler);
  });
}

export function stop(): void {
  // Limpiar event listeners
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('social');
  if (container) {
    container.innerHTML = '';
  }
}
