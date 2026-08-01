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

      <!-- Lobby grupal: hasta 8 jugadores, sub-partidas 1v1 de Simon/
           Arrow/Termita dentro del mismo grupo -->
      <div class="lobby-section" id="lobby-section">
        <h3 class="section-title">👥 Lobby Grupal (hasta 8 jugadores)</h3>
        <div class="section-decorative">
          <span>👥</span><span>🎮</span><span>🏆</span>
        </div>

        <div id="lobby-entry" class="lobby-entry">
          <div class="matchmaking-form">
            <button class="match-btn" id="lobby-create-btn">🆕 Crear Lobby</button>
          </div>
          <div class="matchmaking-form">
            <div class="form-group">
              <label for="lobby-join-code">Código de lobby</label>
              <input type="text" id="lobby-join-code" placeholder="Ej: AB3C" maxlength="4">
            </div>
            <button class="match-btn" id="lobby-join-btn">🔑 Unirse a Lobby</button>
          </div>
          <div class="lobby-error hidden" id="lobby-error" role="alert"></div>
        </div>

        <div id="lobby-active" class="lobby-active hidden">
          <div class="lobby-code-banner">
            <span>Código del lobby: </span>
            <span id="lobby-code-display" style="font-weight:bold; letter-spacing:2px;"></span>
            <button class="lobby-leave-btn" id="lobby-leave-btn">🚪 Salir del lobby</button>
          </div>

          <div class="lobby-players-section">
            <h4 class="subsection-title">Jugadores (<span id="lobby-player-count">0</span>/8)</h4>
            <div class="lobby-players-list" id="lobby-players-list"></div>
          </div>

          <div class="lobby-new-match-section">
            <h4 class="subsection-title">Crear partida</h4>
            <div class="matchmaking-form">
              <div class="form-group">
                <label for="lobby-game-select">Juego</label>
                <select id="lobby-game-select">
                  <option value="simon">Simon Dice</option>
                  <option value="arrow">Desafío Flechas</option>
                  <option value="termita">Termita</option>
                </select>
              </div>
              <button class="match-btn" id="lobby-create-match-btn">🆚 Crear Partida</button>
            </div>
          </div>

          <div class="lobby-matches-section">
            <h4 class="subsection-title">Partidas en el lobby</h4>
            <div class="lobby-matches-list" id="lobby-matches-list">
              <p class="no-matches">Todavía no hay partidas. ¡Creá una!</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Salas 1v1 sueltas: hoy solo Letters Fall (coop asimétrico,
           roles viewer/typer) las usa — Simon/Arrow/Termita se juegan
           desde el Lobby Grupal de arriba. -->
      <div class="matchmaking-section">
        <h3 class="section-title">🔤 Caída de Letras (coop 1v1)</h3>
        <div class="section-decorative">
          <span>🎮</span><span>⚔️</span><span>🏆</span>
        </div>
        <p class="section-hint">Caída de Letras es cooperativo entre dos: usá el botón de abajo para crear o unirte a su propia sala.</p>
        <div class="matchmaking-form">
          <button class="match-btn" id="letters-room-btn">🔤 Ir a Caída de Letras</button>
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
    </div>
  `;
}

export default template satisfies ViewTemplate;
