/**
 * js/views/signalTriangulation.ts
 *
 * Template de la vista "Signal Triangulation" — minijuego cooperativo
 * de 4 jugadores simultáneos (sin modo solo). Cada jugador ve:
 *   - su antena fija (esquina asignada por slot),
 *   - su distancia Manhattan a la fuente oculta (único número visible),
 *   - un tablero 10x10 para elegir/lockear su celda,
 *   - un botón LOCK,
 *   - el estado agregado y anónimo del equipo ("N de 4 confirmaron").
 *
 * No hay panel de "rival" ni tablero espejo (a diferencia de
 * Simon/Arrow/Termita) — mostrar la celda de otro jugador rompería la
 * mecánica. Ver js/utils/teamLockView.ts para el helper de
 * sincronización, deliberadamente más simple que
 * multiplayerSplitView.ts.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="st-game-container">
          <div class="st-card">
            <div class="st-header">
              <div>
                <h2>Signal Triangulation</h2>
                <p>Comuniquense por voz: cada uno ve solo su propia distancia a la señal oculta. Intersecten sus datos y marquen los 4 la misma celda.</p>
              </div>
              <div class="st-status">
                <span data-ui="stRoundLabel">Ronda 1 / 2</span>
              </div>
            </div>

            <div data-ui="stLoginRequired" class="st-message hidden" role="status">
              Necesitás iniciar sesión para jugar Signal Triangulation — acá cada jugador tiene información que ocultarle a los demás, así que hace falta identidad real.
            </div>

            <div data-ui="stWaitingPanel" class="st-waiting-panel hidden" role="status" aria-live="polite">
              <p data-ui="stWaitingMessage">Esperando a que se completen los 4 jugadores...</p>
              <div data-ui="stSlotsList" class="st-slots-list"></div>
            </div>

            <div data-ui="stPlayPanel" class="st-play-panel hidden">
              <div class="st-antenna-info">
                <span>Tu antena:</span>
                <strong data-ui="stAntennaCorner">(0,0)</strong>
              </div>

              <div class="st-distance-display" role="status" aria-live="polite">
                <span class="st-distance-label">Tu distancia a la señal</span>
                <span data-ui="stDistance" class="st-distance-value">—</span>
              </div>

              <div data-ui="stBoard" class="st-board" role="grid" aria-label="Tablero 10 por 10, elegí una celda"></div>

              <div data-ui="stGuessLabel" class="st-guess-label">Ninguna celda elegida todavía</div>

              <button data-ui="stLockBtn" class="st-lock-btn" disabled>Confirmar (LOCK)</button>

              <div data-ui="stTeamStatus" class="st-team-status" role="status" aria-live="polite">0 de 4 confirmaron su posición</div>

              <div data-ui="stRoundResult" class="st-round-result hidden" role="status" aria-live="assertive"></div>
            </div>

            <div data-ui="stMatchResult" class="st-match-result hidden" role="status" aria-live="assertive"></div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
