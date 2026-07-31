/**
 * js/views/progreso.ts
 *
 * Template de la vista "Progreso" (antes public/views/progreso.html).
 * Incluye el bloque "Comparar con vos mismo": selector de módulo +
 * sparkline de evolución personal (rellenado por sidebarViews.ts).
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="card">
          <h2>Progreso</h2>
          <p>Tu avance en cada módulo. Los récords se guardan automáticamente al terminar una partida.</p>

          <section class="self-compare" aria-labelledby="selfCompareTitle">
            <div class="self-compare-head">
              <h3 id="selfCompareTitle">Comparar con vos mismo</h3>
              <label class="self-compare-label" for="selfCompareSelect">Módulo</label>
              <select id="selfCompareSelect" class="self-compare-select" aria-describedby="selfCompareHint"></select>
            </div>
            <p id="selfCompareHint" class="self-compare-hint">Evolución de tus últimas partidas en este módulo.</p>
            <div class="self-compare-stats" id="selfCompareStats" aria-live="polite"></div>
            <div class="self-compare-chart" id="selfCompareChart" role="img" aria-label="Gráfico de evolución de puntuación"></div>
          </section>

          <div class="progress-list" id="progressList"></div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
