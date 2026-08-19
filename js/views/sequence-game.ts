/**
 * js/views/sequence-game.ts
 *
 * Template de la vista "Sequence" (antes public/views/sequence-game.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
    <div class="sequence-card">
        <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>
        <h2>Sequence</h2>
        <!-- HUD -->
        <div class="sequence-hud">
            <div class="hud-box">
                <span>Nivel</span>
                <strong id="sequenceLevel">1</strong>
            </div>
            <div class="hud-box">
                <span>Tiempo</span>
                <strong id="sequenceTime">8</strong>
            </div>
            <div class="hud-box">
                <span>Progreso</span>
                <strong id="sequenceProgress">0 / 3</strong>
            </div>
        </div>
        <!-- Zona del juego -->
        <div id="sequenceBoard">
            <div id="sequenceNodes">
                <button class="sequence-node" data-id="0" aria-label="Nodo 1"></button>
                <button class="sequence-node" data-id="1" aria-label="Nodo 2"></button>
                <button class="sequence-node" data-id="2" aria-label="Nodo 3"></button>
                <button class="sequence-node" data-id="3" aria-label="Nodo 4"></button>
                <button class="sequence-node" data-id="4" aria-label="Nodo 5"></button>
                <button class="sequence-node" data-id="5" aria-label="Nodo 6"></button>
            </div>
        </div>
        <button id="startSequence">
            Empezar
        </button>
        <div id="sequenceResult" role="status" aria-live="polite"></div>
    </div>
`;
};

export default template satisfies ViewTemplate;
