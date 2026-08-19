/**
 * js/views/rhythmclick.ts
 *
 * Template de la vista "Rhythm Click" (antes public/views/rhythmclick.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `

    <div class="rhythm-card">

        <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>

        <h2>Rhythm Click</h2>

        <div class="rhythm-hud">

            <div class="hud-box">
                <span>Nivel</span>
                <strong id="rhythmLevel">1</strong>
            </div>

            <div class="hud-box">
                <span>Tiempo</span>
                <strong id="rhythmTime">30</strong>
            </div>

            <div class="hud-box">
                <span>Puntuación</span>
                <strong id="rhythmScore">0</strong>
            </div>

        </div>

        <div id="rhythmBoard">

            <div id="rhythmArena" aria-hidden="true"></div>

        </div>

        <button id="startRhythm">
            Empezar
        </button>

        <div id="rhythmResult" role="status" aria-live="polite"></div>

    </div>

`;
};

export default template satisfies ViewTemplate;
