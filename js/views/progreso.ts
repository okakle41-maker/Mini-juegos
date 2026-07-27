/**
 * js/views/progreso.ts
 *
 * Template de la vista "Progreso" (antes public/views/progreso.html).
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
          <h2>Progreso</h2>
          <p>Tu avance en cada módulo. Los récords se guardan automáticamente al terminar una partida.</p>
          <div class="progress-list" id="progressList"></div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
