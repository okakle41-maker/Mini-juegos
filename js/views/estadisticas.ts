/**
 * js/views/estadisticas.ts
 *
 * Template de la vista "Estadísticas" (antes public/views/estadisticas.html).
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
          <h2>Estadísticas</h2>
          <p>Resumen global de tu actividad de entrenamiento. Sesiones, módulos completados y rendimiento por categoría.</p>
          <div class="stats-grid" id="statsGrid"></div>
          <div class="stats-by-category" id="statsByCategory"></div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
