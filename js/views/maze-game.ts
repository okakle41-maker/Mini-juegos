/**
 * js/views/maze-game.ts
 *
 * Template de la vista "Maze" (antes public/views/maze-game.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
    <div class="maze-card">
        <button class="back-btn" data-back-to="skillchecks" data-back-label="← Volver"></button>
        <h2>Maze</h2>
        <div class="maze-hud">
            <div class="hud-box">
                <span>Nivel</span>
                <strong id="mazeLevel">1</strong>
            </div>
            <div class="hud-box">
                <span>Tiempo</span>
                <strong id="mazeTime">60</strong>
            </div>
            <div class="hud-box">
                <span>Movimientos</span>
                <strong id="mazeMoves">0</strong>
            </div>
        </div>
<div id="mazeBoard" aria-hidden="true">

    <div id="mazeContainer">

        <div id="mazeGrid"></div>
        <div id="mazeFog"></div>
        <div id="mazeEffects"></div>
        <div id="mazePlayer"></div>

    </div>

</div>
        <button id="startMaze">
            Empezar
        </button>
        <div id="mazeResult" role="status" aria-live="polite"></div>
    </div>
`;
};

export default template satisfies ViewTemplate;
