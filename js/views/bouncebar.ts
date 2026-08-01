/**
 * js/views/bouncebar.ts
 *
 * Template de la vista "Bouncebar / Multipoint (bar)" (antes public/views/bouncebar.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
  <div class="game-view-inner">
    <button class="back-btn" data-back-to="skillchecks"></button>
    <div id="bouncebar-root"></div>
  </div>
`;
};

export default template satisfies ViewTemplate;
