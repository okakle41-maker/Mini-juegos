/**
 * js/views/simon.ts
 *
 * Template de la vista "Simon" (antes public/views/simon.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="card">
          <h2>Simon Dice</h2>
          <p>Repite la secuencia de colores que aparece. Ajusta la dificultad con el número de colores, la longitud inicial, la velocidad de reproducción y las rondas.</p>
          <div class="controls">
            <label>Colores:
              <select data-ui="colorCount">
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
            </label>
            <label>Longitud inicial: <input data-ui="baseLength" type="number" min="1" value="3" style="width:64px"></label>
            <label>Velocidad (ms): <input data-ui="simonSpeed" type="number" min="200" value="700" style="width:80px"></label>
            <label>Rondas: <input data-ui="simonRounds" type="number" min="1" value="5" style="width:64px"></label>
          </div>
          <button data-ui="start">Empezar</button>
          <div data-ui="simonSplit" class="simon-split hidden">
            <div class="simon-split-side">
              <span class="simon-split-label">Vos</span>
              <div data-ui="simonBoard" class="simon-board hidden"></div>
            </div>
            <div class="simon-split-side">
              <span data-ui="simonRivalLabel" class="simon-split-label">Rival</span>
              <div data-ui="simonRival" class="simon-board simon-rival" aria-hidden="true"></div>
            </div>
          </div>
          <div data-ui="info" class="result" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
