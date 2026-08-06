/**
 * js/views/matchWaiting.ts
 *
 * Template de la vista genérica de espera "match-waiting": una sola
 * vista reusada por los 4 juegos multiplayer que necesitan un mínimo de
 * jugadores antes de arrancar (Simon, Arrow, Termita, Signal
 * Triangulation, Centro de Control — Letters Fall queda fuera a
 * propósito, tiene su propio flujo sobre multiplayerSystem). Ver
 * matchWaiting.logic.ts para la lógica (polling/Realtime vía
 * utils/matchWaitingAdapter.ts) y utils/matchWaitingContext.ts para
 * cómo sabe qué juego está esperando. Importado directo por
 * matchWaiting.logic.ts (patrón de vista de sistema, sin pasar por
 * core/viewTemplates.ts — ver comentario en ese archivo de lógica).
 *
 * Reusa el lenguaje visual del modal de configuración de
 * views/onlineLobby.ts (`.ol-modal-*`) en vez de inventar clases
 * nuevas — mismo proyecto, mismo contexto (previo a entrar al juego).
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="lobby-inner">
        <div class="lobby-ambient" aria-hidden="true"></div>

        <div class="ol-modal" role="status" aria-live="polite" style="margin: 4rem auto; max-width: 420px;">
          <div class="ol-modal-header">
            <span class="ol-modal-icon" id="mwIcon">🎮</span>
            <div>
              <h3 class="ol-modal-title" id="mwTitle">Esperando jugadores…</h3>
              <p class="ol-modal-sub" id="mwSub">La partida arranca automáticamente al completarse.</p>
            </div>
          </div>

          <p class="ol-modal-hint" id="mwCountLabel">0 / 0 jugadores</p>
          <p class="ol-modal-sub mw-elapsed" id="mwElapsed" aria-live="polite"></p>

          <div class="ol-modal-error hidden" id="mwTimeoutWarning" role="alert">
            Está tardando más de lo normal. El rival puede haberse desconectado —
            podés seguir esperando o cancelar.
          </div>

          <div class="ol-modal-error hidden" id="mwError" role="alert"></div>

          <button class="ol-modal-primary-btn" id="mwLeaveBtn" type="button">
            Cancelar y salir
          </button>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
