/**
 * js/views/ranking.ts
 *
 * Template de la vista "Ranking" (antes public/views/ranking.html).
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
          <h2>Ranking</h2>
          <p>Tabla de los mejores récords por módulo. Compite contra tus propias marcas.</p>
          <div class="ranking-list" id="rankingList"></div>
        </div>

        <div class="card">
          <h2>Scoreboard global</h2>
          <p data-ui="globalScoresHint">Mejores puntuaciones de todos los jugadores registrados, por módulo.</p>
          <div class="ranking-global-controls">
            <label for="globalScoresGameSelect">Módulo</label>
            <select id="globalScoresGameSelect" data-ui="globalScoresGameSelect"></select>
          </div>
          <div class="ranking-list" data-ui="globalScoresList" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
