/**
 * js/views/rhythmArrows.ts
 *
 * Template de la vista "Rhythm Arrows", siguiendo el mismo patrón que
 * views/arrow.ts: función TS que devuelve el markup, traída por
 * viewManager vía import() dinámico (code-splitting de Vite).
 *
 * El área de juego (data-ui="rhythmSvg") es un <svg> vacío que
 * rhythmArrows.logic.ts puebla dinámicamente al arrancar cada partida
 * (vértices, conexiones y línea de ritmo se generan en runtime, no hay
 * markup fijo acá — ver buildSvg() en la lógica).
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="rhythm-arrows-container">
          <div class="rhythm-arrows-card">
            <div class="rhythm-arrows-header">
              <div>
                <h2>Rhythm Arrows</h2>
                <p>Seguí la línea y presioná la flecha justo cuando llega al vértice. No es velocidad, es sincronización.</p>
              </div>
              <div class="rhythm-arrows-status">
                <span data-ui="rhythmCompleted">0 / 4</span>
                <span data-ui="rhythmTime">0.0s</span>
              </div>
            </div>
            <div class="rhythm-arrows-controls">
              <label>Figura:
                <select data-ui="rhythmSides">
                  <option value="3">Triángulo</option>
                  <option value="4" selected>Cuadrado</option>
                  <option value="5">Pentágono</option>
                  <option value="6">Hexágono</option>
                  <option value="8">Octágono</option>
                </select>
              </label>
              <label>Velocidad:
                <select data-ui="rhythmSpeed">
                  <option value="slow">Lenta</option>
                  <option value="normal" selected>Normal</option>
                  <option value="fast">Rápida</option>
                  <option value="veryfast">Muy rápida</option>
                </select>
              </label>
              <label>Precisión:
                <select data-ui="rhythmPrecision">
                  <option value="relaxed">Relajada</option>
                  <option value="normal" selected>Normal</option>
                  <option value="tight">Ajustada</option>
                  <option value="extreme">Extrema</option>
                </select>
              </label>
              <label class="rhythm-arrows-checkbox-row">
                <input type="checkbox" data-ui="rhythmShowTarget">
                <span>Mostrar punto exacto</span>
              </label>
            </div>
            <div class="rhythm-arrows-svg-wrapper">
              <svg data-ui="rhythmSvg" class="rhythm-arrows-svg"></svg>
              <div data-ui="rhythmFeedback" class="rhythm-arrows-feedback"></div>
            </div>
            <div class="rhythm-arrows-footer">
              <span data-ui="rhythmRecord">Récord: ☆☆☆</span>
            </div>
            <button data-ui="start" class="rhythm-arrows-start-btn">Iniciar</button>
            <div data-ui="rhythmMessage" class="rhythm-arrows-message hidden" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
