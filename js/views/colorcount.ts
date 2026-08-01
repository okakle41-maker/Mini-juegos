/**
 * js/views/colorcount.ts
 *
 * Template de la vista "Color Count" (antes public/views/colorcount.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="colorcount-card">
          <div class="colorcount-header">
            <div>
              <h2>Color Count</h2>
              <p>Cuenta cuántos cuadrados del color objetivo aparecen y selecciona la respuesta correcta.</p>
            </div>
            <div class="colorcount-status">
              <span data-ui="colorcountTimer">Tiempo: 0.0s</span>
              <span data-ui="colorcountLevel">Nivel: 0 / 5</span>
              <span data-ui="colorcountScore">Puntos: 0</span>
            </div>
          </div>
          <div class="colorcount-board">
            <div data-ui="colorcountQuestion" class="colorcount-question" role="status" aria-live="polite">COUNT THE RED SQUARES</div>
            <div data-ui="colorcountGrid" class="colorcount-grid"></div>
          </div>
          <div class="colorcount-controls">
            <label>Dificultad:
              <select data-ui="colorcountDifficulty">
                <option value="easy">Fácil</option>
                <option value="normal" selected>Normal</option>
                <option value="hard">Difícil</option>
                <option value="extreme">Extremo</option>
              </select>
            </label>
            <label>Tu respuesta:
              <input data-ui="colorcountAnswer" type="number" min="0" placeholder="0" disabled style="width:80px">
            </label>
            <button data-ui="colorcountSubmit" disabled>Enviar</button>
            <button data-ui="start">Iniciar</button>
          </div>
          <div data-ui="colorcountAnswers" class="colorcount-answer-list"></div>
          <div data-ui="colorcountMessage" class="colorcount-message" role="status" aria-live="polite">Pulsa iniciar para comenzar.</div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
