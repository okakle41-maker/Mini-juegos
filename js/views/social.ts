/**
 * Social View Template
 * Vista para el sistema social completo
 */
import type { ViewTemplate } from '../types/game';

export function template(): string {
  return `
    <div class="social-view">
      <div class="social-header">
        <h2 class="social-title">👥 Social</h2>
        <div class="social-stats">
          <div class="stat-item">
            <span class="stat-value" id="friends-count">0</span>
            <span class="stat-label">Amigos</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="kudos-received">0</span>
            <span class="stat-label">Kudos</span>
          </div>
        </div>
      </div>

      <!-- Social Tabs -->
      <div class="social-tabs">
        <button class="social-tab social-tab--active" data-tab="friends">👥 Amigos</button>
        <button class="social-tab" data-tab="clan">🏰 Clan</button>
        <button class="social-tab" data-tab="chat">💬 Chat</button>
        <button class="social-tab" data-tab="profile">📝 Perfil</button>
      </div>

      <!-- Friends Tab -->
      <div class="social-tab-content" id="friends-tab">
        <div class="friends-section">
          <h3 class="section-title">👥 Amigos</h3>
          <div class="section-decorative">
            <span>👥</span><span>🤝</span><span>💬</span>
          </div>
          <div class="friends-actions">
            <button class="action-btn" id="add-friend-btn">➕ Añadir Amigo</button>
            <button class="action-btn" id="friend-requests-btn">📬 Solicitudes (<span id="requests-count">0</span>)</button>
          </div>
          <div class="friends-list" id="friends-list">
            <!-- Los amigos se generan dinámicamente -->
          </div>
        </div>
        <div class="friend-requests-modal" id="friend-requests-modal" style="display: none;">
          <h4 class="modal-title">Solicitudes de Amistad</h4>
          <div class="requests-list" id="requests-list">
            <!-- Las solicitudes se generan dinámicamente -->
          </div>
          <button class="close-modal-btn" id="close-requests-btn">Cerrar</button>
        </div>
      </div>

      <!-- Clan Tab -->
      <div class="social-tab-content" id="clan-tab" style="display: none;">
        <div class="clan-section" id="no-clan-section">
          <h3 class="section-title">🏰 Unirse a un Clan</h3>
          <div class="section-decorative">
            <span>🏰</span><span>⚔️</span><span>🛡️</span>
          </div>
          <div class="available-clans" id="available-clans">
            <!-- Los clanes disponibles se generan dinámicamente -->
          </div>
          <button class="action-btn" id="create-clan-btn">🏰 Crear Clan</button>
        </div>
        <div class="clan-section" id="my-clan-section" style="display: none;">
          <h3 class="section-title">Mi Clan</h3>
          <div class="clan-info" id="clan-info">
            <!-- La info del clan se genera dinámicamente -->
          </div>
          <div class="clan-members" id="clan-members">
            <!-- Los miembros del clan se generan dinámicamente -->
          </div>
          <button class="action-btn danger" id="leave-clan-btn">🚪 Salir del Clan</button>
        </div>
      </div>

      <!-- Chat Tab -->
      <div class="social-tab-content" id="chat-tab" style="display: none;">
        <div class="chat-section">
          <h3 class="section-title">💬 Chat</h3>
          <div class="section-decorative">
            <span>💬</span><span>📢</span><span>🔔</span>
          </div>
          <div class="chat-tabs">
            <button class="chat-tab chat-tab--active" data-chat="global">🌐 Global</button>
            <button class="chat-tab" data-chat="clan">🏰 Clan</button>
            <button class="chat-tab" data-chat="private">💬 Privado</button>
          </div>
          <div class="chat-container">
            <div class="chat-messages" id="social-chat-messages">
              <!-- Los mensajes se generan dinámicamente -->
            </div>
            <div class="chat-input-container">
              <input type="text" class="chat-input" id="social-chat-input" placeholder="Escribe un mensaje..." aria-label="Mensaje de chat">
              <button class="chat-send-btn" id="social-chat-send-btn">Enviar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Profile Tab -->
      <div class="social-tab-content" id="profile-tab" style="display: none;">
        <div class="profile-section">
          <h3 class="section-title">📝 Muro de Perfil</h3>
          <div class="section-decorative">
            <span>📝</span><span>📸</span><span>❤️</span>
          </div>
          <div class="create-post">
            <textarea class="post-input" id="post-input" placeholder="¿Qué quieres compartir?" aria-label="Contenido de la publicación"></textarea>
            <div class="post-options">
              <select class="post-type" id="post-type" aria-label="Tipo de publicación">
                <option value="status">Estado</option>
                <option value="achievement">Logro</option>
                <option value="score">Puntuación</option>
              </select>
              <button class="post-btn" id="create-post-btn">📝 Publicar</button>
            </div>
          </div>
          <div class="posts-feed" id="posts-feed">
            <!-- Los posts se generan dinámicamente -->
          </div>
        </div>
        <div class="kudos-section">
          <h3 class="section-title">💪 Kudos Recibidos</h3>
          <div class="kudos-list" id="kudos-list">
            <!-- Los kudos se generan dinámicamente -->
          </div>
        </div>
      </div>
    </div>
  `;
}

export default template satisfies ViewTemplate;
