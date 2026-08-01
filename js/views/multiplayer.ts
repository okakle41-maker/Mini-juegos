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

      <!-- Salas por código -->
      <div class="matchmaking-section">
        <h3 class="section-title">🚪 Salas por Código</h3>
        <div class="section-decorative">
          <span>🎮</span><span>⚔️</span><span>🏆</span>
        </div>
        <div class="matchmaking-form">
          <div class="form-group">
            <label for="room-game-select">Juego</label>
            <select id="room-game-select">
              <option value="simon">Simon Dice</option>
              <option value="arrow">Desafío Flechas</option>
              <option value="termita">Termita</option>
              <option value="letters">Caída de Letras</option>
            </select>
          </div>
          <button class="match-btn" id="create-room-btn">🆕 Crear Sala</button>
        </div>

        <!-- Dificultad: la fija quien crea la sala, aplica a ambos jugadores -->
        <div class="room-settings" id="room-settings-simon">
          <p class="room-settings-title">Dificultad (aplica a ambos jugadores)</p>
          <div class="form-group">
            <label for="room-simon-colors">Colores (4-6)</label>
            <input type="number" id="room-simon-colors" min="4" max="6" value="4">
          </div>
          <div class="form-group">
            <label for="room-simon-baselength">Longitud inicial</label>
            <input type="number" id="room-simon-baselength" min="1" value="3">
          </div>
          <div class="form-group">
            <label for="room-simon-speed">Velocidad (ms)</label>
            <input type="number" id="room-simon-speed" min="200" max="2000" step="100" value="700">
          </div>
          <div class="form-group">
            <label for="room-simon-rounds">Rondas</label>
            <input type="number" id="room-simon-rounds" min="1" max="20" value="5">
          </div>
        </div>

        <div class="room-settings" id="room-settings-arrow" style="display:none;">
          <p class="room-settings-title">Dificultad (aplica a ambos jugadores)</p>
          <div class="form-group">
            <label for="room-arrow-steps">Cantidad de flechas (10-30)</label>
            <input type="number" id="room-arrow-steps" min="10" max="30" value="20">
          </div>
          <div class="form-group">
            <label for="room-arrow-time">Tiempo (segundos, 5-30)</label>
            <input type="number" id="room-arrow-time" min="5" max="30" value="15">
          </div>
        </div>

        <div class="room-settings" id="room-settings-termita" style="display:none;">
          <p class="room-settings-title">Dificultad (aplica a ambos jugadores)</p>
          <div class="form-group">
            <label for="room-termita-size">Tamaño de cuadrícula</label>
            <select id="room-termita-size">
              <option value="4">4 por 4</option>
              <option value="5" selected>5 por 5</option>
              <option value="6">6 por 6</option>
              <option value="8">8 por 8</option>
              <option value="10">10 por 10</option>
            </select>
          </div>
          <div class="form-group">
            <label for="room-termita-targets">Objetivos a memorizar</label>
            <input type="number" id="room-termita-targets" min="1" max="20" value="4">
          </div>
          <div class="form-group">
            <label for="room-termita-showtime">Tiempo de exhibición (ms)</label>
            <input type="number" id="room-termita-showtime" min="100" step="100" value="800">
          </div>
          <div class="form-group">
            <label for="room-termita-rounds">Rondas</label>
            <input type="number" id="room-termita-rounds" min="1" value="5">
          </div>
        </div>

        <div class="room-settings" id="room-settings-letters" style="display:none;">
          <p class="room-settings-title">Caída de Letras tiene su propia pantalla de sala (roles Viewer/Typer) — al crear o unirte acá se te lleva directo ahí.</p>
        </div>

        <div class="matchmaking-status" id="room-created-status" style="display: none;">
          <div class="queue-info">
            <span>Código de sala: </span>
            <span id="room-code-display" style="font-weight:bold; letter-spacing:2px;"></span>
          </div>
          <span>Compartí este código con la otra persona para que se una.</span>
        </div>
        <div class="matchmaking-form">
          <div class="form-group">
            <label for="join-room-code">Código de sala</label>
            <input type="text" id="join-room-code" placeholder="Ej: AB3C" maxlength="4">
          </div>
          <button class="match-btn" id="join-room-btn">🔑 Unirse a Sala</button>
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
