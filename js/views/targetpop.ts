import type { ViewTemplate } from '../types/game.js';

const template = (): string => `
  <div class="game-view-inner scx-view">
    <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>
    <div class="scx-card scx-card--wide">
      <h2>Target Pop</h2>
      <p class="scx-sub">Tocá los blancos antes de que desaparezcan</p>
      <div class="scx-stats">
        <div>Score<span id="tpScore">0</span></div>
        <div>Combo<span id="tpCombo">0</span></div>
        <div>Vidas<span id="tpLives">3</span></div>
        <div>Best<span id="tpBest">0</span></div>
      </div>
      <div id="tpArena" class="tp-arena" aria-label="Área de blancos"></div>
      <button id="tpStart" class="scx-btn">Empezar</button>
      <div id="tpResult" class="scx-result" role="status" aria-live="polite"></div>
    </div>
  </div>
`;

export default template satisfies ViewTemplate;
