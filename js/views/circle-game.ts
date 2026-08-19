/**
 * js/views/circle-game.ts
 *
 * Template de la vista "Circle Game (Skillcheck)" (antes public/views/circle-game.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
  <div class="game-view-inner">
    <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>
    <div class="circle-card">
      <h2>Circle Skill Check</h2>
      <div class="circle-wrapper">
      <div class="circle-ring" aria-hidden="true">
          <div id="circleTarget"></div>
          <div id="circleNeedle"></div>
      </div>
      </div>
      <button id="startCircle">Empezar</button>
                      <div class="circle-stats">
                    <div>
                        Score
                        <span id="circleScore">0</span>
                    </div>
                    <div>
                        Combo
                        <span id="circleCombo">0</span>
                    </div>
                    <div>
                        Best
                        <span id="circleBest">0</span>
                    </div>
                </div>
      <div id="circleResult"></div>
    </div>
  </div>
`;
};

export default template satisfies ViewTemplate;
