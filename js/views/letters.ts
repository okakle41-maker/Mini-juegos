/**
 * js/views/letters.ts
 *
 * Template de la vista "Letters Fall". Agregado: panel de modo coop.
 * Al entrar a la vista se muestra primero `data-ui="lettersModePanel"`
 * (Solo / Crear sala / Unirse a sala) — el tablero de juego
 * (`lettersCard`) queda oculto hasta que el jugador elige "Solo" o
 * hasta que la sala coop conecta con el otro jugador. Ver
 * lettersFall.logic.ts para el manejo de estos tres caminos y
 * core/roomManager.ts para el transporte en tiempo real de la sala.
 *
 * En modo coop, `lettersCard` se marca con `data-role="viewer"` o
 * `data-role="typer"` para que css/letters.css pueda ocultar el área
 * de palabras al typer y el input al viewer sin duplicar markup.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>

        <div class="letters-card letters-mode-panel" data-ui="lettersModePanel">
          <div class="letters-header">
            <div>
              <h2>Letters Fall</h2>
              <p>Escribe las palabras antes de que lleguen a la zona roja. Jugá solo, o en cooperativo: una persona ve las palabras caer y la otra solo escribe.</p>
            </div>
          </div>

          <div class="letters-mode-options">
            <button data-ui="modeSolo" class="letters-mode-btn">
              <strong>Solo</strong>
              <span>Ves las palabras y escribís vos mismo, en un solo dispositivo.</span>
            </button>
            <button data-ui="modeCreate" class="letters-mode-btn">
              <strong>Crear sala coop</strong>
              <span>Generá un código y elegí tu rol. Compartí el código con la otra persona.</span>
            </button>
            <button data-ui="modeJoin" class="letters-mode-btn">
              <strong>Unirse a sala</strong>
              <span>Ingresá el código que te compartieron y elegí tu rol.</span>
            </button>
          </div>

          <div data-ui="roleChooser" class="letters-role-chooser hidden">
            <p data-ui="roleChooserLabel">Elegí tu rol:</p>
            <div class="letters-mode-options">
              <button data-ui="roleViewer" class="letters-mode-btn">
                <strong>👀 Viewer</strong>
                <span>Ves las palabras caer. No podés escribir.</span>
              </button>
              <button data-ui="roleTyper" class="letters-mode-btn">
                <strong>⌨️ Typer</strong>
                <span>Escribís lo que el viewer te va marcando. No ves las palabras.</span>
              </button>
            </div>
            <div class="letters-join-code hidden" data-ui="joinCodeRow">
              <label>Código de sala:
                <input data-ui="joinCodeInput" type="text" maxlength="4" autocomplete="off" placeholder="Ej: QXWM" aria-label="Código de sala" />
              </label>
            </div>
            <button data-ui="roleConfirm" class="letters-start-btn" disabled>Continuar</button>
            <button data-ui="roleBack" class="letters-mode-back">← Volver</button>
          </div>

          <div data-ui="roomStatus" class="letters-room-status hidden" role="status" aria-live="polite">
            <p data-ui="roomStatusText"></p>
            <p data-ui="roomCodeDisplay" class="letters-room-code hidden"></p>
            <button data-ui="roomCancel" class="letters-mode-back">Cancelar</button>
          </div>
        </div>

        <div class="letters-card hidden" data-ui="lettersCard">
          <div class="letters-header">
            <div>
              <h2>Letters Fall</h2>
              <p>Escribe las palabras antes de que lleguen a la zona roja. Cada nivel aumenta la dificultad.</p>
            </div>
            <div class="letters-stats">
              <span data-ui="lettersLevel">Nivel: 1</span>
              <span data-ui="lettersDifficulty">Dificultad: Normal</span>
              <span data-ui="lettersScore">Puntuación: 0</span>
              <span data-ui="lettersBest">Mejor: 0</span>
              <span data-ui="lettersRoleBadge" class="letters-role-badge hidden"></span>
            </div>
          </div>
          <div class="letters-controls" data-ui="lettersControls">
            <label>Dificultad:
              <select data-ui="lettersDifficultySelect">
                <option value="easy">Easy</option>
                <option value="normal" selected>Normal</option>
                <option value="hard">Hard</option>
                <option value="chuchu">Chuchu</option>
              </select>
            </label>
            <button data-ui="start" class="letters-start-btn">Iniciar</button>
          </div>
          <div data-ui="lettersArea" class="letters-area">
            <div class="letters-lives" data-ui="lettersLives"></div>
            <div data-ui="lettersDanger" class="letters-danger"></div>
          </div>
          <div class="letters-input-row">
            <input data-ui="lettersInput" type="text" autocomplete="off" placeholder="Escribe aquí..." aria-label="Escribe la palabra que está cayendo" />
            <div data-ui="lettersMessage" class="letters-message" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
