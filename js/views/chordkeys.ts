import type { ViewTemplate } from '../types/game.js';

const template = (): string => `
  <div class="game-view-inner scx-view">
    <button class="back-btn" data-back-to="skillchecks" data-back-label="← Volver"></button>
    <div class="scx-card">
      <h2>Chord Keys</h2>
      <p class="scx-sub">Pulsá todas las teclas a la vez</p>
      <div id="ckDisplay" class="ck-display" aria-live="polite"></div>
      <div class="scx-timer"><div id="ckTimerFill" class="scx-timer-fill"></div></div>
      <button id="ckStart" class="scx-btn">Empezar</button>
      <div class="scx-stats">
        <div>Score<span id="ckScore">0</span></div>
        <div>Combo<span id="ckCombo">0</span></div>
        <div>Best<span id="ckBest">0</span></div>
      </div>
      <div id="ckResult" class="scx-result" role="status" aria-live="polite"></div>
    </div>
  </div>
`;

export default template satisfies ViewTemplate;
