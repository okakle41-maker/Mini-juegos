/**
 * js/views/holematch.ts
 *
 * Template de la vista "Hole Match" (antes public/views/holematch.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="holematch-card">
          <div class="holematch-header">
            <div>
              <h2>Hole Match</h2>
              <p>Presiona ESPACIO cuando el círculo pase sobre las casillas objetivo. Las casillas y el momento del rebote cambian en cada partida.</p>
            </div>
            <div class="holematch-status">
              <span data-ui="holematchProgress">Progreso: 0 / 4</span>
              <span data-ui="holematchMistakes">Errores: 0</span>
              <span data-ui="holematchTimer">Tiempo: 20.0s</span>
            </div>
          </div>
          <div data-ui="holematchBoard" class="holematch-board" aria-hidden="true"></div>
          <div class="holematch-message" data-ui="holematchMessage" role="status" aria-live="polite">Presiona iniciar para comenzar.</div>
          <div class="holematch-controls">
            <label>Dificultad:
              <select data-ui="holematchDifficulty">
                <option value="easy">Fácil</option>
                <option value="normal" selected>Normal</option>
                <option value="hard">Difícil</option>
              </select>
            </label>
            <label>Casillas:
              <input data-ui="holematchTargetCount" type="number" min="4" max="16" value="8" />
            </label>
            <button data-ui="start">Iniciar</button>
          </div>
          <div class="holematch-controls holematch-controls-advanced">
            <label class="holematch-slider-label">
              Velocidad <span data-ui="holematchSpeedVal">180</span>°/s
              <input data-ui="holematchSpeed" type="range" min="60" max="360" step="10" value="180" />
            </label>
            <label class="holematch-slider-label">
              Precisión (ventana) <span data-ui="holematchPrecisionVal">10°</span>
              <input data-ui="holematchPrecision" type="range" min="3" max="24" step="1" value="10" />
            </label>
            <label class="holematch-slider-label">
              Rebote mín. (s)
              <input data-ui="holematchFlipMin" type="number" min="0.3" max="10" step="0.1" value="1.2" />
            </label>
            <label class="holematch-slider-label">
              Rebote máx. (s)
              <input data-ui="holematchFlipMax" type="number" min="0.5" max="15" step="0.1" value="3.2" />
            </label>
          </div>
          <div class="holematch-guide">Usa ESPACIO para acertar las casillas objetivo en el momento justo.</div>
          <div class="holematch-progress-bar">
            <div class="holematch-progress-fill" data-ui="holematchProgressBar"></div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
