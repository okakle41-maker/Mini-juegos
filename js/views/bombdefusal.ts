/**
 * js/views/bombdefusal.ts
 *
 * Template de la vista "Bomb Defusal" (antes public/views/bombdefusal.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 *
 * Modularización: el markup se arma con funciones pequeñas, una por sección
 * visual (configuración, HUD, panel operador, panel experto), en vez de un
 * único string de ~230 líneas. La lista de tipos de módulo aparecía dos
 * veces en el original (chips de configuración + botones de navegación del
 * manual), 28 líneas casi idénticas cada vez: ahora vive una sola vez como
 * MODULE_TYPES y ambos bloques se generan a partir de ese array, así que
 * añadir o quitar un tipo de módulo es un cambio de una línea en un solo
 * lugar en vez de dos ediciones manuales sincronizadas a mano.
 */
import type { ViewTemplate } from '../types/game.js';

/** Tipos de módulo disponibles: id usado en `value`/`data-target`, y label mostrado. */
const MODULE_TYPES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'wires', label: 'Cables' },
  { id: 'buttons', label: 'Botones' },
  { id: 'symbols', label: 'Símbolos' },
  { id: 'memory', label: 'Memoria' },
  { id: 'screen', label: 'Pantalla' },
  { id: 'frequency', label: 'Frecuencias' },
  { id: 'colors', label: 'Colores' },
  { id: 'pattern', label: 'Patrones' },
  { id: 'switches', label: 'Interruptores' },
  { id: 'code', label: 'Código' },
  { id: 'keypad', label: 'Teclado' },
  { id: 'morse', label: 'Morse' },
  { id: 'password', label: 'Contraseña' },
  { id: 'simon', label: 'Simon' },
  { id: 'knobs', label: 'Perillas' },
  { id: 'maze', label: 'Laberinto' },
  { id: 'timer', label: 'Cronómetro' },
  { id: 'sequence', label: 'Secuencia' },
  { id: 'binary', label: 'Binario' },
  { id: 'math', label: 'Matemáticas' },
  { id: 'word', label: 'Palabra' },
  { id: 'reaction', label: 'Reacción' },
  { id: 'matching', label: 'Parejas' },
  { id: 'cipher', label: 'Cifrado' },
  { id: 'timing', label: 'Sincronía' },
  { id: 'coordinates', label: 'Coordenadas' },
  { id: 'battery', label: 'Batería' },
  { id: 'ports', label: 'Puertos' },
  { id: 'compass', label: 'Brújula' },
  { id: 'slots', label: 'Ranuras' },
];

/** Chips de checkbox para elegir qué tipos de módulo permitir en la partida. */
function renderModuleTypeChips(): string {
  return MODULE_TYPES.map(
    (m) =>
      `<label class="bd-mod-chip" data-ui-all="modTypeChips"><input type="checkbox" value="${m.id}" checked> ${m.label}</label>`
  ).join('\n              ');
}

/** Botones de navegación del manual técnico, uno por tipo de módulo. */
function renderManualNavButtons(): string {
  return MODULE_TYPES.map(
    (m) =>
      `<button type="button" class="bd-manual-link" data-target="#man-${m.id}">${m.label}</button>`
  ).join('\n                ');
}

/** Fase de configuración: tiempo, módulos, strikes, dificultad y tipos permitidos. */
function renderSetupPhase(): string {
  return `
        <!-- Fase: configuración -->
        <div data-ui="setupPhase" class="bd-phase bd-phase--active card">
          <h2>💣 Bomb Defusal</h2>
          <p>Desactiva todos los módulos antes de que explote la bomba. Como <strong>Operador</strong> interactúas con la bomba; como <strong>Experto</strong> consultas el manual técnico. En solitario alterna entre ambos roles.</p>

          <div class="bd-setup-grid controls">
            <div class="bd-field">
              <label for="bd-time">Tiempo inicial</label>
              <select data-ui="timeLimit" id="bd-time">
                <option value="600">10 min</option>
                <option value="420">7 min</option>
                <option value="300" selected>5 min</option>
                <option value="180">3 min</option>
                <option value="120">2 min</option>
              </select>
            </div>
            <div class="bd-field">
              <label for="bd-modules">Módulos</label>
              <select data-ui="moduleCount" id="bd-modules">
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4" selected>4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="8">8</option>
                <option value="10">10</option>
                <option value="12">12</option>
                <option value="15">15</option>
              </select>
            </div>
            <div class="bd-field">
              <label for="bd-strikes">Errores máximos</label>
              <select data-ui="maxStrikes" id="bd-strikes">
                <option value="0">Sin límite</option>
                <option value="1">1 strike</option>
                <option value="2" selected>2 strikes</option>
                <option value="3">3 strikes</option>
              </select>
            </div>
            <div class="bd-field">
              <label for="bd-diff">Dificultad</label>
              <select data-ui="difficulty" id="bd-diff">
                <option value="1">1 — Básica</option>
                <option value="2">2 — Fácil</option>
                <option value="3" selected>3 — Media</option>
                <option value="4">4 — Difícil</option>
                <option value="5">5 — Extrema</option>
              </select>
            </div>
            <div class="bd-field">
              <label for="bd-anim">Velocidad animaciones</label>
              <select data-ui="animSpeed" id="bd-anim">
                <option value="600">Lenta</option>
                <option value="400" selected>Normal</option>
                <option value="200">Rápida</option>
              </select>
            </div>
            <div class="bd-field">
              <label>Módulos repetidos</label>
              <label class="bd-mod-chip">
                <input type="checkbox" data-ui="allowDup"> Permitir tipos duplicados
              </label>
            </div>
            <div class="bd-field">
              <label for="bd-volume">Volumen de sonido</label>
              <input type="range" data-ui="volume" id="bd-volume" min="0" max="100" value="30">
            </div>
          </div>

          <div class="bd-field">
            <label>Tipos de módulo permitidos</label>
            <div class="bd-mod-types">
              ${renderModuleTypeChips()}
            </div>
          </div>

          <button type="button" data-ui="start" class="bd-start-btn">Iniciar desactivación</button>
        </div>`;
}

/** HUD superior durante la partida: tiempo, strikes, módulos, serial. */
function renderHud(): string {
  return `
          <div class="bd-hud">
            <div class="bd-hud-box bd-hud--danger">
              <span>Tiempo</span>
              <strong data-ui="timerEl">5:00</strong>
            </div>
            <div class="bd-hud-box bd-hud--warn">
              <span>Strikes</span>
              <strong data-ui="strikesEl">0 / 2</strong>
            </div>
            <div class="bd-hud-box">
              <span>Módulos</span>
              <strong data-ui="modulesEl">4</strong>
            </div>
            <div class="bd-hud-box">
              <span>Serial</span>
              <strong data-ui="serialEl" style="font-size:0.85rem">------</strong>
            </div>
          </div>`;
}

/** Panel con nivel de batería, tipo y conteo de puertos del dispositivo. */
function renderDeviceComponents(): string {
  return `
          <!-- Componentes del dispositivo -->
          <div class="bd-device-components">
            <div class="bd-device-title">⚙️ Componentes del dispositivo</div>
            <div class="bd-device-grid">
              <div class="bd-device-item">
                <span class="bd-device-label">Nivel de batería</span>
                <span data-ui="batteryLevelEl" class="bd-device-value">--</span>
              </div>
              <div class="bd-device-item">
                <span class="bd-device-label">Tipo de puerto</span>
                <span data-ui="portTypeEl" class="bd-device-value">--</span>
              </div>
              <div class="bd-device-item">
                <span class="bd-device-label">Conteo de puertos</span>
                <span data-ui="portCountEl" class="bd-device-value">--</span>
              </div>
            </div>
          </div>`;
}

/** Vista operador: la caja de la bomba con la grilla de módulos interactivos. */
function renderOperatorPanel(): string {
  return `
            <div data-ui="operatorPanel" class="bd-panel bd-panel--visible">
              <div class="bd-panel-head">Vista operador — interactúa con los módulos</div>
              <div class="bd-bomb-case">
                <div class="bd-serial-row">
                  <span>Consulta el serial en el HUD ↑</span>
                  <span data-ui="indicatorEl" class="bd-indicator">
                    Indicador <span class="bd-indicator-dot"></span>
                  </span>
                </div>
                <div data-ui="bombGrid" class="bd-modules-grid"></div>
              </div>
            </div>`;
}

/** Vista experto: navegación del manual técnico + contenido de la regla seleccionada. */
function renderExpertPanel(): string {
  return `
            <div data-ui="expertPanel" class="bd-panel">
              <div class="bd-panel-head">Manual técnico — reglas de desactivación</div>
              <div data-ui="manualNav" class="bd-manual-nav">
                ${renderManualNavButtons()}
              </div>
              <div data-ui="manualContent" class="bd-manual"></div>
            </div>`;
}

/** Fase de partida completa: HUD, componentes, barra de tiempo y ambos paneles (operador/experto). */
function renderGamePhase(): string {
  return `
        <!-- Fase: partida -->
        <div data-ui="gamePhase" class="bd-phase card">
          <h2>💣 Bomba activa</h2>
          ${renderHud()}
          ${renderDeviceComponents()}

          <div class="bd-timer-bar-wrap">
            <div data-ui="timerBar" class="bd-timer-bar"></div>
          </div>

          <div class="bd-role-bar">
            <button type="button" data-ui="roleOperator" class="bd-role-btn bd-role-btn--active" aria-pressed="true">💣 Operador</button>
            <button type="button" data-ui="roleExpert" class="bd-role-btn" aria-pressed="false">📖 Experto (Manual)</button>
          </div>

          <div class="bd-panels">
            ${renderOperatorPanel()}
            ${renderExpertPanel()}
          </div>

          <div data-ui="info" class="bd-info" role="status" aria-live="polite"></div>
          <div data-ui="result" class="result" role="status" aria-live="polite"></div>
          <button type="button" data-ui="restart" class="bd-start-btn" style="margin-top:0.75rem;background:rgba(255,255,255,0.08);border:1px solid var(--border)">← Volver a configuración</button>
        </div>`;
}

const template = (): string => {
  return `
      <div class="game-view-inner bd-wrap">
        <button class="back-btn" data-back-to="home"></button>
        ${renderSetupPhase()}
        ${renderGamePhase()}
      </div>
    `;
};

export default template satisfies ViewTemplate;
