/**
 * js/views/letters.ts
 *
 * Template de la vista "Letters Fall" (antes public/views/letters.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="letters-card">
          <div class="letters-header">
            <div>
              <h2>Letters Fall</h2>
              <p>Escribe las palabras antes de que lleguen a la zona roja. Cada nivel aumenta la dificultad.</p>
            </div>
            <div class="letters-stats">
              <span data-ui="lettersLevel">Nivel: 1</span>
              <span data-ui="lettersDifficulty">Dificultad: Normal</span>
              <span data-ui="lettersScore">Puntuación: 0</span>
              <span data-ui="lettersBest">Mejor: 0</span>
            </div>
          </div>
          <div data-ui="lettersArea" class="letters-area">
            <div class="letters-lives" data-ui="lettersLives"></div>
            <div data-ui="lettersDanger" class="letters-danger"></div>
          </div>
          <div class="letters-controls">
            <label>Dificultad:
              <select data-ui="lettersDifficultySelect">
                <option value="easy">Easy</option>
                <option value="normal" selected>Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <button data-ui="start" class="letters-start-btn">Iniciar</button>
          </div>
          <div class="letters-input-row">
            <input data-ui="lettersInput" type="text" autocomplete="off" placeholder="Escribe aquí..." aria-label="Escribe la palabra que está cayendo" />
            <div data-ui="lettersMessage" class="letters-message" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
