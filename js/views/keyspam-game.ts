/**
 * js/views/keyspam-game.ts
 *
 * Template de la vista "Key Spam" (antes public/views/keyspam-game.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
    <div class="keyspam-card">
        <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>
        <h2>Key Spam</h2>
        <div class="keyspam-hud">
            <div class="hud-box">
                <span>Nivel</span>
                <strong id="keyspamLevel">1</strong>
            </div>
            <div class="hud-box">
                <span>Tiempo</span>
                <strong id="keyspamTime">8</strong>
            </div>
            <div class="hud-box">
                <span>Pulsaciones</span>
                <strong id="keyspamHits">0 / 20</strong>
            </div>
        </div>
        <div id="keyspamBoard">
            <div id="keyspamKey" role="status" aria-live="assertive">
                E
            </div>
            <div id="keyspamProgress">
                <div id="keyspamProgressFill"></div>
            </div>
            <div id="keyspamMessage">
                Pulsa la tecla mostrada
            </div>
        </div>
        <button id="startKeySpam">
            Empezar
        </button>
        <div id="keyspamResult" role="status" aria-live="polite"></div>
    </div>
`;
};

export default template satisfies ViewTemplate;
