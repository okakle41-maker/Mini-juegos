/**
 * js/views/manual.ts
 *
 * Template de la vista "Manual" (antes public/views/manual.html).
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
          <h2>Manual</h2>
          <p>Guía de referencia. Cada módulo entrena un vector cognitivo distinto. Selecciona el que más necesite tu bot.</p>
          <div class="manual-list" id="manualList"></div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
