/**
 * js/views/shipControl.ts
 *
 * Template de la vista "Centro de Control de una Nave" — minijuego
 * cooperativo de 4 jugadores simultáneos con ROLES FIJOS Y ASIMÉTRICOS
 * (a diferencia de las 4 antenas intercambiables de Signal
 * Triangulation, acá cada rol ve un panel completamente distinto — ver
 * ship-control-design.md sección 1 y 7).
 *
 * Estructura:
 *   - scLoginRequired: mismo criterio que Signal Triangulation, exige sesión.
 *   - scWaitingPanel: selección de rol (4 botones, se deshabilita el
 *     ocupado) mientras la partida está en 'waiting'.
 *   - 4 paneles de juego, uno por rol (scNavPanel/scSensorsPanel/
 *     scEnergyPanel/scCommsPanel) — solo uno se muestra a la vez, el que
 *     corresponde al rol propio (ver shipControl.logic.ts).
 *   - scEventBanner: común a los 4 paneles, muestra el mensaje narrativo
 *     filtrado a MI rol para el evento activo (o nada si no hay evento
 *     activo, o si mi rol no tiene mensaje para este evento en particular
 *     — ver get_my_ship_events, migration_017 sección 3.4).
 *   - scMatchResult: pantalla final (completed/failed/abandoned).
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="sc-game-container">
          <div class="sc-card">
            <div class="sc-header">
              <div>
                <h2>Centro de Control</h2>
                <p>Cuatro roles, una nave. Nadie ve lo mismo que el resto — coordínense por voz.</p>
              </div>
              <div class="sc-status">
                <span data-ui="scLivesLabel">❤️ 3</span>
              </div>
            </div>

            <div data-ui="scLoginRequired" class="sc-message hidden" role="status">
              Necesitás iniciar sesión para jugar Centro de Control — cada rol tiene información que ocultarle a los demás, así que hace falta identidad real.
            </div>

            <div data-ui="scWaitingPanel" class="sc-waiting-panel hidden" role="status" aria-live="polite">
              <p data-ui="scWaitingMessage">Elegí tu rol para esta misión.</p>
              <div class="sc-role-picker" data-ui="scRolePicker">
                <button type="button" class="sc-role-btn" data-role="navigation">🧭 Navegación</button>
                <button type="button" class="sc-role-btn" data-role="sensors">📡 Sensores</button>
                <button type="button" class="sc-role-btn" data-role="energy">⚡ Energía</button>
                <button type="button" class="sc-role-btn" data-role="comms">📻 Comunicaciones</button>
              </div>
              <div data-ui="scRoleError" class="sc-role-error hidden" role="alert"></div>
            </div>

            <div data-ui="scEventBanner" class="sc-event-banner hidden" role="status" aria-live="assertive">
              <span data-ui="scEventMessage"></span>
              <span data-ui="scEventTimer" class="sc-event-timer"></span>
            </div>

            <!-- Panel Navegación: rumbo, velocidad, mapa sin peligros -->
            <div data-ui="scNavPanel" class="sc-role-panel hidden">
              <h3>🧭 Navegación</h3>
              <div class="sc-nav-readout">
                <div>Rumbo: <strong data-ui="scHeadingValue">0°</strong></div>
                <div>Velocidad: <strong data-ui="scSpeedValue">0</strong></div>
                <div>Posición: <strong data-ui="scPositionValue">—</strong></div>
              </div>
              <label class="sc-slider-label">
                Rumbo (0-359°)
                <input type="range" min="0" max="359" step="1" data-ui="scHeadingSlider" class="sc-slider" />
              </label>
              <label class="sc-slider-label">
                Velocidad (0-100)
                <input type="range" min="0" max="100" step="1" data-ui="scSpeedSlider" class="sc-slider" />
              </label>
              <button data-ui="scConfirmEvasionBtn" class="sc-action-btn hidden">Confirmar maniobra de evasión</button>
            </div>

            <!-- Panel Sensores: peligros en mapa, sin posición propia -->
            <div data-ui="scSensorsPanel" class="sc-role-panel hidden">
              <h3>📡 Sensores</h3>
              <div data-ui="scSensorReading" class="sc-sensor-reading">Sin lecturas activas.</div>
              <div data-ui="scTrajectoryLocked" class="sc-trajectory-note hidden">Esperando a que Comunicaciones decodifique la trayectoria...</div>
              <label class="sc-slider-label hidden" data-ui="scBearingInputWrap">
                Rumbo de evasión calculado (0-359°)
                <input type="number" min="0" max="359" step="1" data-ui="scBearingInput" />
              </label>
              <button data-ui="scSubmitBearingBtn" class="sc-action-btn hidden">Enviar rumbo de evasión</button>
            </div>

            <!-- Panel Energía: 5 barras redistribuibles -->
            <div data-ui="scEnergyPanel" class="sc-role-panel hidden">
              <h3>⚡ Energía</h3>
              <div class="sc-power-bars">
                <label>Escudos <input type="range" min="0" max="100" data-ui="scPowerShields" class="sc-slider" /> <span data-ui="scPowerShieldsValue">20</span></label>
                <label>Motores <input type="range" min="0" max="100" data-ui="scPowerEngines" class="sc-slider" /> <span data-ui="scPowerEnginesValue">20</span></label>
                <label>Comunicaciones <input type="range" min="0" max="100" data-ui="scPowerComms" class="sc-slider" /> <span data-ui="scPowerCommsValue">20</span></label>
                <label>Armas <input type="range" min="0" max="100" data-ui="scPowerWeapons" class="sc-slider" /> <span data-ui="scPowerWeaponsValue">20</span></label>
                <label>Soporte vital <input type="range" min="0" max="100" data-ui="scPowerLifeSupport" class="sc-slider" /> <span data-ui="scPowerLifeSupportValue">20</span></label>
              </div>
              <div data-ui="scPowerTotal" class="sc-power-total">Total: 100 / 100</div>
              <button data-ui="scApplyPowerBtn" class="sc-action-btn">Aplicar distribución</button>
              <div data-ui="scSequencePanel" class="sc-sequence-panel hidden">
                <p>Secuencia de reactor — seguí el orden que te retransmita Comunicaciones:</p>
                <div data-ui="scSequenceButtons" class="sc-sequence-buttons"></div>
              </div>
            </div>

            <!-- Panel Comunicaciones: mensajes codificados, decodificación -->
            <div data-ui="scCommsPanel" class="sc-role-panel hidden">
              <h3>📻 Comunicaciones</h3>
              <div data-ui="scCommsMessage" class="sc-comms-message">Sin mensajes del ordenador.</div>
              <div data-ui="scMorseWrap" class="sc-morse-wrap hidden">
                <button type="button" data-ui="scPlayMorseBtn" class="sc-action-btn sc-morse-play-btn hidden">🔊 Escuchar código</button>
                <label>
                  Código decodificado
                  <input type="text" data-ui="scCodeInput" placeholder="ej. 349" />
                </label>
                <label data-ui="scChecksumWrap" class="hidden">
                  Dígito de checksum
                  <input type="number" data-ui="scChecksumInput" min="0" max="9" />
                </label>
                <button data-ui="scSubmitCodeBtn" class="sc-action-btn">Retransmitir</button>
              </div>
            </div>

            <div data-ui="scActionResult" class="sc-action-result hidden" role="status" aria-live="polite"></div>
            <div data-ui="scMatchResult" class="sc-match-result hidden" role="status" aria-live="assertive"></div>
            <button data-ui="backToLobby" class="hidden" data-back-to="online-lobby">Volver al lobby online</button>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
