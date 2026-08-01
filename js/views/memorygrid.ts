/**
 * js/views/memorygrid.ts
 *
 * Template de la vista "Memory Grid" (antes public/views/memorygrid.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 *
 * Modularización: el markup se arma con funciones pequeñas — intro, panel
 * de selects/números, panel de checkboxes, área de juego (HUD + tablero) —
 * en vez de un único string de ~160 líneas. Aquí el patrón dominante no es
 * tanto repetición de un mismo componente (como en progresstiming o
 * bombdefusal) sino un formulario largo con muchos controles: separar por
 * grupo lógico de opciones ayuda más a la lectura que generar por datos.
 */
import type { ViewTemplate } from '../types/game.js';

/** Cabecera con título y explicación de las reglas del juego. */
function renderIntro(): string {
  return `
      <h2>Memory Grid</h2>

      <p>
        Atraviesa la cuadrícula desde <strong>S</strong> hasta <strong>E</strong>.
        Cada casilla indica cuántos pasos debes moverte en una dirección permitida.
        Memoriza los números mientras se muestran y planifica la ruta antes de que desaparezcan.
      </p>`;
}

/** Controles de tipo select/number: tamaño, rango de valores, direcciones, tiempos y límites. */
function renderSelectAndNumberControls(): string {
  return `
        <label>
          Tamaño
          <select data-ui="size">
            <option value="4" selected>4×4</option>
            <option value="5">5×5</option>
            <option value="6">6×6</option>
            <option value="7">7×7</option>
            <option value="8">8×8</option>
          </select>
        </label>

        <label>
          Valor mínimo
          <input data-ui="minVal" type="number" value="1" min="1" max="5">
        </label>

        <label>
          Valor máximo
          <input data-ui="maxVal" type="number" value="3" min="1" max="6">
        </label>

        <label>
          Direcciones
          <select data-ui="dirMode">
            <option value="cardinal" selected>Arriba / abajo / izq / der</option>
            <option value="all8">+ diagonales</option>
            <option value="knight">Caballo (L)</option>
          </select>
        </label>

        <label>
          Tiempo memorización (ms)
          <select data-ui="showTime">
            <option value="1000">1000</option>
            <option value="2000">2000</option>
            <option value="3000" selected>3000</option>
            <option value="5000">5000</option>
            <option value="8000">8000</option>
          </select>
        </label>

        <label>
          Tiempo límite (s)
          <select data-ui="timeLimit">
            <option value="30">30</option>
            <option value="60" selected>60</option>
            <option value="90">90</option>
            <option value="120">120</option>
            <option value="0">Sin límite</option>
          </select>
        </label>

        <label>
          Vidas
          <input data-ui="livesInput" type="number" value="3" min="1" max="9">
        </label>

        <label>
          Máx. errores
          <select data-ui="maxErrors">
            <option value="0" selected>Sin límite</option>
            <option value="3">3</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
        </label>

        <label>
          Máx. movimientos
          <select data-ui="maxMoves">
            <option value="0" selected>Sin límite</option>
            <option value="8">8</option>
            <option value="12">12</option>
            <option value="16">16</option>
          </select>
        </label>`;
}

/** Controles de tipo checkbox: modos de juego, ayudas visuales y opciones extra. */
function renderCheckboxControls(): string {
  return `
        <label class="checkbox">
          <input data-ui="useLives" type="checkbox" checked>
          Modo con vidas
        </label>

        <label class="checkbox">
          <input data-ui="allowRepeat" type="checkbox">
          Permitir repetir casillas
        </label>

        <label class="checkbox">
          <input data-ui="allowUndo" type="checkbox" checked>
          Permitir deshacer
        </label>

        <label class="checkbox">
          <input data-ui="showPath" type="checkbox" checked>
          Mostrar ruta recorrida
        </label>

        <label class="checkbox">
          <input data-ui="showHints" type="checkbox">
          Mostrar pistas (movimientos válidos)
        </label>

        <label class="checkbox">
          <input data-ui="revealOnVisit" type="checkbox" checked>
          Revelar número al visitar casilla
        </label>

        <label class="checkbox">
          <input data-ui="addTraps" type="checkbox">
          Casillas trampa extra
        </label>

        <label class="checkbox">
          <input data-ui="showSolutionOnEnd" type="checkbox" checked>
          Mostrar solución al fallar
        </label>`;
}

/** Panel completo de configuración: agrupa selects/números y checkboxes. */
function renderControlsPanel(): string {
  return `
      <div class="controls">
        ${renderSelectAndNumberControls()}
        ${renderCheckboxControls()}
      </div>`;
}

/** HUD durante la partida: vidas, movimientos, errores y timer. */
function renderHud(): string {
  return `
      <div class="mg-hud">
        <span data-ui="lives" role="status" aria-live="polite">❤️❤️❤️</span>
        <span data-ui="movesEl" role="status" aria-live="polite">Movimientos: 0</span>
        <span data-ui="errorsEl" role="status" aria-live="polite"></span>
        <span data-ui="timerEl"></span>
      </div>`;
}

/** Área de juego: botones de inicio/deshacer, HUD, estado, tablero y resultado. */
function renderGameArea(): string {
  return `
      <button data-ui="start">Empezar</button>
      <button data-ui="undoBtn" class="mg-undo-btn" hidden>Deshacer</button>
      ${renderHud()}

      <div data-ui="status" class="mg-status" role="status" aria-live="polite">Configura y pulsa Empezar</div>

      <div data-ui="board" class="mg-board"></div>

      <div data-ui="result" class="result" role="status" aria-live="polite"></div>`;
}

const template = (): string => {
  return `
  <div class="game-view-inner">

    <button class="back-btn" data-back-to="home"></button>

    <div class="card">
      ${renderIntro()}
      ${renderControlsPanel()}
      ${renderGameArea()}

    </div>

  </div>
`;
};

export default template satisfies ViewTemplate;
