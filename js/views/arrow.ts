/**
 * js/views/arrow.ts
 *
 * Template de la vista "Arrow Game" (antes public/views/arrow.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="arrow-game-container">
          <div class="arrow-card">
            <div class="arrow-header">
              <div>
                <h2>Desafío de Flechas</h2>
                <p>Completa la secuencia antes de que se acabe el tiempo. Usa el teclado o toca las flechas.</p>
              </div>
              <div class="arrow-status">
                <span data-ui="arrowPercent">0%</span>
                <span data-ui="arrowTime">15.0s</span>
              </div>
            </div>
            <div class="arrow-controls">
              <label>Dificultad:
                <select data-ui="arrowLevel">
                  <option value="easy">Fácil</option>
                  <option value="normal" selected>Normal</option>
                  <option value="hard">Difícil</option>
                </select>
              </label>
              <label>Pasos: <input data-ui="arrowLength" type="number" min="10" max="30" value="20" style="width:72px"></label>
              <label>Tiempo (s): <input data-ui="arrowTimeInput" type="number" min="5" max="30" value="15" style="width:72px"></label>
            </div>
            <div class="arrow-progress-wrapper">
              <div data-ui="arrowProgress" class="arrow-progress"></div>
            </div>
            <div data-ui="arrowSplit" class="arrow-rival-panel hidden" aria-hidden="true">
              <span data-ui="arrowRivalLabel" class="arrow-split-label">Rival</span>
              <div data-ui="arrowRivalDisplay" class="arrow-rival-display">↑</div>
              <div class="arrow-rival-stats">
                <span data-ui="arrowRivalCombo">Combo: 0</span>
              </div>
            </div>
            <div class="arrow-display-wrapper">
              <div data-ui="arrowDisplay" class="arrow-display" role="status" aria-live="assertive">↑</div>
              <div class="arrow-display-info">
                <span data-ui="arrowStep">0 / 20</span>
                <span data-ui="arrowCombo">Combo: 0</span>
              </div>
              <div data-ui="arrowSequence" class="arrow-sequence" aria-live="polite"></div>
            </div>
            <div class="arrow-footer">
              <span data-ui="arrowRecord">Récord: 0%</span>
              <span data-ui="arrowResult"></span>
            </div>
            <button data-ui="start" class="arrow-start-btn">Iniciar</button>
            <div class="arrow-touch-controls" data-ui="arrowButtons">
              <button type="button" class="arrow-touch-btn arrow-touch-btn--up" data-key="ArrowUp" aria-label="Arriba">↑</button>
              <button type="button" class="arrow-touch-btn arrow-touch-btn--left" data-key="ArrowLeft" aria-label="Izquierda">←</button>
              <button type="button" class="arrow-touch-btn arrow-touch-btn--down" data-key="ArrowDown" aria-label="Abajo">↓</button>
              <button type="button" class="arrow-touch-btn arrow-touch-btn--right" data-key="ArrowRight" aria-label="Derecha">→</button>
            </div>
            <div data-ui="arrowMessage" class="arrow-message hidden" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
