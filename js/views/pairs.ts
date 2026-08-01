/**
 * js/views/pairs.ts
 *
 * Template de la vista "Pairs" (antes public/views/pairs.html).
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
          <h2>Pairs</h2>
          <p>Voltea dos cartas por turno. Si los íconos coinciden, el par queda descubierto. Encuentra todos los pares antes de que se acabe el tiempo.</p>

          <div class="pairs-diff-row">
            <button class="pairs-diff-btn pairs-diff--active" data-ui-all="pairsDiffBtns" data-pairs="12" data-time="90" aria-pressed="true">FÁCIL · 12 pares · 90s</button>
            <button class="pairs-diff-btn" data-ui-all="pairsDiffBtns" data-pairs="16" data-time="90" aria-pressed="false">MEDIO · 16 pares · 90</button>
            <button class="pairs-diff-btn" data-ui-all="pairsDiffBtns" data-pairs="20" data-time="90" aria-pressed="false">DIFÍCIL · 20 pares · 90s</button>
          </div>

          <div class="pairs-timerbar-wrap">
            <div data-ui="pairsTimerBar" class="pairs-timerbar"></div>
          </div>

          <div class="pairs-stats">
            <div class="pairs-stat">
              <span class="pairs-stat-label">Intentos</span>
              <span class="pairs-stat-val" data-ui="pairsMovesEl">0</span>
            </div>
            <div class="pairs-stat">
              <span class="pairs-stat-label">Pares</span>
              <span class="pairs-stat-val" data-ui="pairsPairsEl">0</span>
            </div>
            <div class="pairs-stat">
              <span class="pairs-stat-label">Tiempo</span>
              <span class="pairs-stat-val" data-ui="pairsTimeEl">90</span>
            </div>
          </div>

          <div data-ui="pairsBoard" class="pairs-board"></div>

          <div data-ui="pairsMessage" class="pairs-message" role="status" aria-live="polite"></div>

          <button data-ui="startPairs" class="pairs-restart-btn">↺ Reiniciar</button>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
