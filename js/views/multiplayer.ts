/**
 * Multiplayer View Template
 * Vista para el sistema de multiplayer en tiempo real
 */
import type { ViewTemplate } from '../types/game';

export function template(): string {
  return `
    <div class="multiplayer-view">
      <div class="multiplayer-header">
        <button class="back-btn" data-back-to="home"></button>
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
          <div class="lobby-code-hint" style="margin: 0.5rem 0; opacity: 0.85;">
            Compartí este código con tus amigos para que se unan.
          </div>
          <button class="match-btn" id="lobby-go-online-btn">🌐 Ir a elegir juego</button>

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

          <!-- Signal Triangulation: coop de EXACTAMENTE 4 jugadores, sin
               modo solo, sin selector de juego (es el único juego de este
               tipo) — lista aparte de lobby-matches-section porque su
               forma de partida es distinta (4 slots en vez de 1v1) y
               porque requiere sesión iniciada (ver
               signalTriangulationSystem.ts). -->
          <div class="lobby-st-section" id="lobby-st-section">
            <h4 class="subsection-title">📡 Signal Triangulation (4 jugadores)</h4>
            <p class="lobby-st-hint" style="margin: 0.25rem 0 0.75rem; opacity: 0.85; font-size: 0.85em;">
              Cooperativo puro — cada jugador ve solo su propia distancia a una señal oculta y deben coordinarse por voz. Requiere sesión iniciada.
            </p>
            <div id="lobby-st-login-required" class="lobby-error hidden" role="alert">
              Necesitás iniciar sesión para crear o unirte a una partida de Signal Triangulation.
            </div>
            <button class="match-btn" id="lobby-st-create-btn">📡 Crear partida de Signal Triangulation</button>
            <div class="lobby-st-matches-list" id="lobby-st-matches-list">
              <p class="no-matches">Todavía no hay partidas de Signal Triangulation. ¡Creá una!</p>
            </div>
          </div>
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
