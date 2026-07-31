import type { ViewTemplate } from '../types/game.js';

const template = (): string => `
  <div class="game-view-inner scx-view">
    <button class="back-btn" data-back-to="skillchecks" data-back-label="← Volver"></button>
    <div class="scx-card">
      <h2>Hold &amp; Release</h2>
      <p class="scx-sub">Mantené ESPACIO para cargar y soltá en la zona verde</p>
      <div class="hr-gauge" aria-hidden="true">
        <div id="hrZone" class="hr-zone"></div>
        <div id="hrFill" class="hr-fill"></div>
      </div>
      <button id="hrStart" class="scx-btn">Empezar</button>
      <div class="scx-stats">
        <div>Score<span id="hrScore">0</span></div>
        <div>Combo<span id="hrCombo">0</span></div>
        <div>Best<span id="hrBest">0</span></div>
      </div>
      <div id="hrResult" class="scx-result" role="status" aria-live="polite"></div>
    </div>
  </div>
`;

export default template satisfies ViewTemplate;
