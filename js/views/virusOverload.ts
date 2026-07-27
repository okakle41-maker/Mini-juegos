/**
 * js/views/virusOverload.ts
 *
 * Template de la vista "Virus Overload" (antes public/views/virusOverload.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
  <div class="game-view-inner">
    <button class="back-btn" data-back-to="home"></button>
    
    <!-- Setup Phase -->
    <div data-ui="setupPhase" class="setup-phase">
      <h2>🦠 VIRUS OVERLOAD</h2>
      <p>Sobrevive a la infección del sistema. Elimina virus antes de que el sistema colapse. Cada fase trae nuevos desafíos y eventos aleatorios.</p>
      
      <div class="phase-info">
        <div class="phase-card infiltration">
          <h3>Fase 1: Infiltración</h3>
          <p>Virus lentos, sin eventos</p>
        </div>
        <div class="phase-card propagation">
          <h3>Fase 2: Propagación</h3>
          <p>Interfaz se corrompe</p>
        </div>
        <div class="phase-card overload">
          <h3>Fase 3: Sobrecarga</h3>
          <p>Eventos aleatorios activos</p>
        </div>
        <div class="phase-card collapse">
          <h3>Fase 4: Colapso</h3>
          <p>Caos total, sobrevive</p>
        </div>
      </div>
      
      <button data-ui="start" class="primary">INICIAR PURGA</button>
    </div>
    
    <!-- Game Phase -->
    <div data-ui="gamePhase" class="game-phase hidden">
      <div class="game-header">
        <div class="game-stats">
          <div class="stat-item">
            <span class="stat-label">Tiempo</span>
            <span data-ui="timerEl" class="stat-value">120.0s</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Puntos</span>
            <span data-ui="scoreEl" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Combo</span>
            <span data-ui="comboEl" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Virus</span>
            <span data-ui="virusCountEl" class="stat-value">0</span>
          </div>
        </div>
        <div data-ui="phaseEl" class="phase-indicator" style="color: #22c55e;" role="status" aria-live="polite">INFILTRACIÓN</div>
      </div>
      
      <div data-ui="gameArea" class="game-area">
        <div data-ui="virusContainer" class="virus-container"></div>
        
        <div data-ui="eventBanner" class="event-banner hidden" role="alert" aria-live="assertive">
          <div data-ui="eventText" class="event-text">EVENTO</div>
        </div>
      </div>
    </div>
    
    <!-- End Phase -->
    <div data-ui="endPhase" class="end-phase hidden">
      <h2 data-ui="resultEl" role="status" aria-live="polite">SISTEMA COMPROMETIDO</h2>
      
      <div class="result-stats">
        <div class="result-stat">
          <div class="result-stat-label">Puntuación</div>
          <div data-ui="resultScore" class="result-stat-value">0</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-label">Tiempo</div>
          <div data-ui="resultTime" class="result-stat-value">0s</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-label">Virus Eliminados</div>
          <div data-ui="resultVirus" class="result-stat-value">0</div>
        </div>
      </div>
      
      <div class="buttons">
        <button data-ui="restartBtn" class="primary">REINTENTAR</button>
        <button data-ui="backBtn" onclick="window.backToMenu('home')">VOLVER AL LOBBY</button>
      </div>
    </div>
  </div>
`;
};

export default template satisfies ViewTemplate;
