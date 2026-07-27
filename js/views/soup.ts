/**
 * js/views/soup.ts
 *
 * Template de la vista "Hacking Device" (antes public/views/soup.html).
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
          <h2>Hacking Device</h2>
          <p>
            Encuentra la secuencia objetivo dentro de la cuadrícula antes de que termine el tiempo.
          </p>
          <!-- CONFIGURACIÓN -->
          <div class="hacking-settings">
            <!-- DIFICULTAD -->
            <div class="settings-box difficulty">
              <h3>Dificultad</h3>
              <label>
                Conjunto de símbolos
            <div class="symbol-selector">
              <button class="symbol-chip active" data-value="letters" aria-pressed="true">Letras</button>
              <button class="symbol-chip active" data-value="numbers" aria-pressed="true">Números</button>
              <button class="symbol-chip active" data-value="symbols" aria-pressed="true">Símbolos</button>

              <button class="symbol-chip" data-value="greek" aria-pressed="false">Griegos</button>
              <button class="symbol-chip" data-value="runes" aria-pressed="false">Runas</button>
              <button class="symbol-chip" data-value="braille" aria-pressed="false">Braille</button>

              <button class="symbol-chip" data-value="cyrillic" aria-pressed="false">Ruso</button>
              <button class="symbol-chip" data-value="arabic" aria-pressed="false">Árabe</button>
              <button class="symbol-chip" data-value="chinese" aria-pressed="false">Chino</button>
            </div>
              </label>
              <label>
                Tamaño de la cuadrícula
                <input
                  data-ui="hackingSize"
                  type="number"
                  min="5"
                  max="20"
                  value="10">
              </label>
              <label>
                Longitud objetivo
                <input
                  data-ui="hackingLength"
                  type="number"
                  min="1"
                  max="4"
                  value="2">
              </label>
            </div>
            <!-- PARTIDA -->
            <div class="settings-box match">
              <h3>Partida</h3>
              <label>
                Tiempo límite (segundos)
                <input
                  data-ui="hackingTime"
                  type="number"
                  min="3"
                  value="15">
              </label>
              <label>
                Número de rondas
                <input
                  data-ui="hackingRounds"
                  type="number"
                  min="1"
                  value="5">
              </label>
            </div>
            <!-- OPCIONES -->
            <div class="settings-box options">
              <h3>Opciones</h3>
              <label class="checkbox-row">
                <input
                  data-ui="hackingMoveAll"
                  type="checkbox"
                  checked>
                <span>Mover todas las celdas</span>
              </label>
              <label class="checkbox-row">
                <input
                  data-ui="hackingHighlightTarget"
                  type="checkbox">
                <span>Iluminar objetivo</span>
              </label>
            </div>

          </div>

          <!-- HUD -->
          <div class="hacking-top">
            <div class="stats">
              <span data-ui="hackingStreak">STREAK: 0</span>
              <span data-ui="hackingMax">MAX STREAK: 0</span>
              <span data-ui="hackingTimer">TIEMPO: 0.0s</span>
            </div>
            <div data-ui="hackingTarget" class="hacking-target" role="status" aria-live="polite">
              OBJETIVO:
              <strong></strong>
            </div>
          </div>
          <button data-ui="start">
            Iniciar Hacking
          </button>
          <div
            data-ui="hackingBoard"
            class="hacking-board hidden"
            aria-hidden="true">
          </div>
          <div data-ui="hackingInfo" class="result" role="status" aria-live="polite"></div>
        </div>

      </div>
    `;
};

export default template satisfies ViewTemplate;
