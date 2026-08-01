/**
 * js/views/neuralfragment.ts
 *
 * Template de la vista "Neural Fragment" (antes public/views/neuralfragment.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="card" role="region" aria-labelledby="neuralfragment-title">
          <h2 id="neuralfragment-title">Neural Fragment Hack</h2>
          <p>Reconstruye fragmentos de memoria corrupta. Filtra el ruido y restaura los datos perdidos antes de que la conexión se cierre.</p>
          <div class="controls">
            <label for="difficultySelect">Nivel de dificultad:
              <select id="difficultySelect" data-ui="difficultySelect">
                <option value="easy">Fácil</option>
                <option value="normal" selected>Normal</option>
                <option value="hard">Difícil</option>
              </select>
            </label>
            <label for="fragmentCountSelect">Número de fragmentos:
              <select id="fragmentCountSelect" data-ui="fragmentCountSelect">
                <option value="3">3 fragmentos</option>
                <option value="5" selected>5 fragmentos</option>
                <option value="7">7 fragmentos</option>
              </select>
            </label>
          </div>
          <button data-ui="start" aria-label="Iniciar juego Neural Fragment Hack">Iniciar Hack</button>
          <div data-ui="fragmentDisplay" class="fragment-display" role="img" aria-label="Fragmento de memoria a reconstruir"></div>
          <div data-ui="optionsGrid" class="options-grid" role="group" aria-label="Opciones de respuesta"></div>
          <div data-ui="messageEl" class="message info" role="status" aria-live="polite">Esperando inicio...</div>
          <div class="game-stats">
            <span data-ui="scoreEl">Puntuación: 0</span>
            <span data-ui="roundEl">Ronda: 1/5</span>
            <span data-ui="timerEl">Tiempo: --</span>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
