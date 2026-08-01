/**
 * js/views/typix.ts
 *
 * Template de la vista "Typix" (antes public/views/typix.html).
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
      <h2>Typix</h2>
      <p>Adivina el código de 5 dígitos en un máximo de 6 intentos. Por cada intento verás un resumen: <strong>!</strong> por cada dígito en la posición correcta y <strong>*</strong> por cada dígito que existe pero está en otra posición — sin decirte cuáles son.</p>

      <div class="typix-header">
        <div id="typixTimer">60</div>
      </div>

      <div id="typixBoard" class="typix-board" role="status" aria-live="polite"></div>




      <div class="typix-options">
        <label class="typix-option">
        <input type="checkbox" id="typixUniqueDigits">
         Sin repeticiones
        </label>

        <label class="typix-option">
        <input type="checkbox" id="typixShowDigits">
         Números
        </label>
      </div>

      <input
       id="typixInput"
       maxlength="5"
       inputmode="numeric"
        pattern="[0-9]*"
        aria-label="Código de 5 dígitos a adivinar"
      >
      <button id="typixGuessBtn">
        Intentar
      </button>
      <div id="typixMessage" class="typix-message" role="status" aria-live="polite"></div>
    </div>
  </div>
`;
};

export default template satisfies ViewTemplate;
