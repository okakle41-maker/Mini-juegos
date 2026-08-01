/**
 * js/views/rapidlines-game.ts
 *
 * Template de la vista "Rapid Lines" (antes public/views/rapidlines-game.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
    <div class="rapid-card">
        <button class="back-btn" data-back-to="skillchecks" data-back-label="← Volver"></button>
        <h2>Rapid Lines</h2>
        <div class="rapid-hud">
            <div class="hud-box">
                <span>Score</span>
                <strong id="rapidScore">0</strong>
            </div>
            <div class="hud-box">
                <span>Combo</span>
                <strong id="rapidCombo">0</strong>
            </div>
            <div class="hud-box">
                <span>Best</span>
                <strong id="rapidBest">0</strong>
              </div>
                    <div class="hud-box">
                  <span>Tiempo</span>
                  <strong id="rapidTime">60</strong>
                  </div>
                  <div class="hud-box">
                  <span>Precisión</span>
                  <strong id="rapidAccuracy">100%</strong>
              </div>
        </div>
        <div id="rapidArena" aria-hidden="true">
          <div id="rapidOverlay"></div>
            <div id="rapidCenter"></div>
            <div id="rapidEffects"></div>
            <div id="rapidGameOver" class="hidden">
              <h2>GAME OVER</h2>
               <p id="rapidGameOverText"></p>
                <button id="rapidRestart">
                   Reintentar
              </button>
               <button id="rapidBack">
              Volver
              </button>
         </div>
        </div>

      <div class="rapid-config">

    <div class="config-item">
        <label for="cfgStartSpeed">Velocidad inicial</label>
        <input id="cfgStartSpeed" type="number" step="0.1" value="6">
    </div>

    <div class="config-item">
        <label for="cfgSpeedIncrease">Aceleración</label>
        <input id="cfgSpeedIncrease" type="number" step="0.05" value="0.15">
    </div>

    <div class="config-item">
        <label for="cfgMaxSpeed">Velocidad máxima</label>
        <input id="cfgMaxSpeed" type="number" step="0.5" value="14">
    </div>

    <div class="config-item">
        <label for="cfgMaxArrows">Flechas</label>
        <input id="cfgMaxArrows" type="number" min="1" value="1">
    </div>

    <div class="config-item">
        <label for="cfgTime">Tiempo</label>
        <input id="cfgTime" type="number" min="5" value="60">
    </div>

    <div class="config-buttons">
      
            <button id="saveRapidConfig">
            Guardar
        </button>

        <button id="resetRapidConfig">
            Restablecer
        </button>
    </div>
</div>
        <button id="startRapid">
            Empezar
        </button>
        <div id="rapidResult" role="status" aria-live="polite"></div>
    </div>
`;
};

export default template satisfies ViewTemplate;
