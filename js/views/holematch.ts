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
              <p>Presiona ESPACIO cuando el círculo pase sobre las casillas objetivo del recorrido.</p>
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
          <div class="holematch-guide">Usa ESPACIO para acertar las casillas objetivo en el momento justo.</div>
          <div class="holematch-progress-bar">
            <div class="holematch-progress-fill" data-ui="holematchProgressBar"></div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
