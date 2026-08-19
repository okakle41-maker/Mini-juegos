import type { ViewTemplate } from '../types/game.js';

const template = (): string => `
  <div class="game-view-inner scx-view">
    <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>
    <div class="scx-card">
      <h2>Lane Dodge</h2>
      <p class="scx-sub">Esquivá con ← → o A D</p>
      <div id="ldTrack" class="ld-track" aria-hidden="true">
        <div class="ld-lane-bg"></div>
        <div class="ld-lane-bg"></div>
        <div class="ld-lane-bg"></div>
        <div id="ldPlayer" class="ld-player ld-lane-1"></div>
      </div>
      <button id="ldStart" class="scx-btn">Empezar</button>
      <div class="scx-stats">
        <div>Score<span id="ldScore">0</span></div>
        <div>Best<span id="ldBest">0</span></div>
      </div>
      <div id="ldResult" class="scx-result" role="status" aria-live="polite"></div>
    </div>
  </div>
`;

export default template satisfies ViewTemplate;
