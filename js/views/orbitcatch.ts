import type { ViewTemplate } from '../types/game.js';

const template = (): string => `
  <div class="game-view-inner scx-view">
    <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>
    <div class="scx-card">
      <h2>Orbit Catch</h2>
      <p class="scx-sub">Pulsá ESPACIO cuando el punto pase por la zona</p>
      <div class="oc-ring" aria-hidden="true">
        <div id="ocZone" class="oc-zone"></div>
        <div id="ocOrbit" class="oc-dot"></div>
      </div>
      <button id="ocStart" class="scx-btn">Empezar</button>
      <div class="scx-stats">
        <div>Score<span id="ocScore">0</span></div>
        <div>Combo<span id="ocCombo">0</span></div>
        <div>Best<span id="ocBest">0</span></div>
      </div>
      <div id="ocResult" class="scx-result" role="status" aria-live="polite"></div>
    </div>
  </div>
`;

export default template satisfies ViewTemplate;
