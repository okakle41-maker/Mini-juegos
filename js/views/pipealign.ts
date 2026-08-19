import type { ViewTemplate } from '../types/game.js';

const template = (): string => `
  <div class="game-view-inner scx-view">
    <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>
    <div class="scx-card">
      <h2>Pipe Align</h2>
      <p class="scx-sub">Girá los tubos hasta conectar entrada y salida</p>
      <div class="scx-stats">
        <div>Score<span id="paScore">0</span></div>
        <div>Nivel<span id="paLevel">1</span></div>
        <div>Best<span id="paBest">0</span></div>
      </div>
      <div class="scx-timer"><div id="paTimerFill" class="scx-timer-fill"></div></div>
      <div id="paGrid" class="pa-grid" aria-label="Cuadrícula de tubos"></div>
      <button id="paStart" class="scx-btn">Empezar</button>
      <div id="paResult" class="scx-result" role="status" aria-live="polite"></div>
    </div>
  </div>
`;

export default template satisfies ViewTemplate;
