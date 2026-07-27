/**
 * js/views/configuracion.ts
 *
 * Template de la vista "Configuración" (antes public/views/configuracion.html).
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
          <h2>Configuración</h2>
          <p>Personaliza tu experiencia de entrenamiento. El tema y el volumen se guardan automáticamente.</p>
          <div class="config-section">
            <div class="config-row">
              <span class="config-label" id="configThemeLabel">TEMA</span>
              <select id="configThemeSelect" class="config-select" aria-labelledby="configThemeLabel">
                <option value="dark">Oscuro</option>
                <option value="pixel">🕹️ Pixel Lab</option>
              </select>
            </div>
            <div class="config-row">
              <span class="config-label" id="configSfxLabel">EFECTOS DE SONIDO</span>
              <label class="config-toggle">
                <input type="checkbox" id="configSfxToggle" checked aria-labelledby="configSfxLabel">
                <span class="config-toggle-slider"></span>
              </label>
            </div>
            <div class="config-row">
              <span class="config-label" id="configMusicLabel">MÚSICA DE FONDO</span>
              <label class="config-toggle">
                <input type="checkbox" id="configMusicToggle" checked aria-labelledby="configMusicLabel">
                <span class="config-toggle-slider"></span>
              </label>
            </div>
            <div class="config-row">
              <span class="config-label" id="configCursorLabel">CURSOR GAMER</span>
              <label class="config-toggle">
                <input type="checkbox" id="configCursorToggle" checked aria-labelledby="configCursorLabel">
                <span class="config-toggle-slider"></span>
              </label>
            </div>
            <div class="config-row">
              <span class="config-label" id="configVfxLabel">EFECTOS VISUALES</span>
              <label class="config-toggle">
                <input type="checkbox" id="configVfxToggle" checked aria-labelledby="configVfxLabel">
                <span class="config-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="config-danger">
            <button id="configResetBtn" class="config-danger-btn">BORRAR TODOS LOS RÉCORDS</button>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
