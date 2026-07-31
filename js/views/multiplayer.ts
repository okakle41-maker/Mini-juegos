/**
 * Multiplayer View Template
 * Vista para el sistema de multiplayer en tiempo real
 */
import type { ViewTemplate } from '../types/game';

export function template(): string {
  return `
    <div class="multiplayer-view">
      <div class="multiplayer-header">
        <h2 class="multiplayer-title">🎮 Multiplayer</h2>
        <div class="connection-status" id="connection-status">
          <span class="status-dot"></span>
          <span class="status-text">Conectado</span>
        </div>
      </div>

      <!-- Matchmaking -->
      <div class="matchmaking-section">
        <h3 class="section-title">🔍 Buscar Partida</h3>
        <div class="section-decorative">
          <span>🎮</span><span>⚔️</span><span>🏆</span>
        </div>
        <div class="matchmaking-form">
          <div class="form-group">
            <label for="match-game-select">Juego</label>
            <select id="match-game-select">
              <option value="simon">Simon Dice</option>
              <option value="arrow">Desafío Flechas</option>
              <option value="termita">Termita</option>
              <option value="letters">Caída de Letras</option>
            </select>
          </div>
          <div class="form-group">
            <label for="match-skill-select">Nivel de Habilidad</label>
            <select id="match-skill-select">
              <option value="1">Principiante</option>
              <option value="2">Intermedio</option>
              <option value="3">Avanzado</option>
              <option value="4">Experto</option>
              <option value="5">Maestro</option>
            </select>
          </div>
          <button class="match-btn" id="find-match-btn">🎯 Buscar Partida</button>
          <button class="match-btn danger" id="cancel-match-btn" style="display: none;">❌ Cancelar</button>
        </div>
        <div class="matchmaking-status" id="matchmaking-status" style="display: none;">
          <div class="searching-animation">
            <div class="spinner"></div>
            <span>Buscando oponente...</span>
          </div>
          <div class="queue-info">
            <span>Jugadores en cola: </span>
            <span id="queue-count">0</span>
          </div>
        </div>
      </div>

      <!-- Current Match -->
      <div class="current-match-section" id="current-match-section" style="display: none;">
        <h3 class="section-title">⚔️ Partida en Curso</h3>
        <div class="match-info">
          <div class="match-players">
            <div class="player-card">
              <span class="player-avatar" id="player1-avatar">👤</span>
              <span class="player-name" id="player1-name">Jugador 1</span>
              <span class="player-score" id="player1-score">0</span>
            </div>
            <div class="vs-divider">VS</div>
            <div class="player-card">
              <span class="player-avatar" id="player2-avatar">👤</span>
              <span class="player-name" id="player2-name">Jugador 2</span>
              <span class="player-score" id="player2-score">0</span>
            </div>
          </div>
          <div class="match-timer">
            <span class="timer-icon">⏱️</span>
            <span class="timer-value" id="match-timer">00:00</span>
          </div>
        </div>
        <div class="match-actions">
          <button class="match-action-btn" id="ready-btn">✅ Listo</button>
          <button class="match-action-btn danger" id="leave-match-btn">🚪 Abandonar</button>
        </div>
      </div>

      <!-- Live Leaderboards -->
      <div class="leaderboards-section">
        <h3 class="section-title">🏆 Leaderboards en Vivo</h3>
        <div class="section-decorative">
          <span>🏆</span><span>🥇</span><span>🥈</span>
        </div>
        <div class="leaderboard-tabs">
          <button class="leaderboard-tab leaderboard-tab--active" data-game="simon">Simon</button>
          <button class="leaderboard-tab" data-game="arrow">Flechas</button>
          <button class="leaderboard-tab" data-game="termita">Termita</button>
          <button class="leaderboard-tab" data-game="letters">Letras</button>
        </div>
        <div class="leaderboard-list" id="leaderboard-list">
          <!-- El leaderboard se genera dinámicamente -->
        </div>
      </div>

      <!-- Chat -->
      <div class="chat-section">
        <h3 class="section-title">💬 Chat Global</h3>
        <div class="section-decorative">
          <span>💬</span><span>📢</span><span>🔔</span>
        </div>
        <div class="chat-container">
          <div class="chat-messages" id="chat-messages">
            <!-- Los mensajes se generan dinámicamente -->
          </div>
          <div class="chat-input-container">
            <input type="text" class="chat-input" id="chat-input" placeholder="Escribe un mensaje..." aria-label="Mensaje de chat">
            <button class="chat-send-btn" id="chat-send-btn">Enviar</button>
          </div>
        </div>
      </div>

      <!-- Spectator Mode -->
      <div class="spectator-section">
        <h3 class="section-title">👁️ Modo Espectador</h3>
        <div class="section-decorative">
          <span>👁️</span><span>🎥</span><span>📺</span>
        </div>
        <div class="spectator-form">
          <div class="form-group">
            <label for="spectator-match-id">ID de Partida</label>
            <input type="text" id="spectator-match-id" placeholder="Ingresa el ID de la partida">
          </div>
          <button class="spectator-btn" id="spectate-btn">👁️ Ver Partida</button>
        </div>
        <div class="active-matches" id="active-matches">
          <h4 class="subsection-title">Partidas Activas</h4>
          <div class="matches-list">
            <!-- Las partidas activas se generan dinámicamente -->
          </div>
        </div>
      </div>
    </div>
  `;
}

export default template satisfies ViewTemplate;
