/**
 * js/views/termita.ts
 *
 * Template de la vista "Termita" (antes public/views/termita.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
       <button class="back-btn" data-back-to="home"></button>
        <div class="card" role="region" aria-labelledby="termita-title">
          <h2 id="termita-title">Termita</h2>
          <p>Se mostrará una rejilla de cubos; algunos se iluminan y desaparecen. Señala los cubos que viste iluminados.</p>
          <div class="controls">
            <label for="gridSize">Tamaño de la rejilla:
              <select id="gridSize" data-ui="gridSize">
                <option value="4">4 por 4</option>
                <option value="5">5 por 5</option>
                <option value="6">6 por 6</option>
                <option value="8">8 por 8</option>
                <option value="10">10 por 10</option>
              </select>
            </label>
            <label for="targets">Número de objetivos: <input id="targets" data-ui="targets" type="number" min="1" value="4" style="width:64px" aria-describedby="targetsDesc"></label>
            <span id="targetsDesc" class="sr-only">Cantidad de cubos que se iluminarán</span>
            <label for="showTime">Tiempo visible en milisegundos: <input id="showTime" data-ui="showTime" type="number" min="100" value="800" style="width:80px"></label>
            <label for="rounds">Número de rondas: <input id="rounds" data-ui="rounds" type="number" min="1" value="5" style="width:64px"></label>
          </div>
          <button data-ui="start" aria-label="Iniciar juego Termita">Empezar</button>
          <div data-ui="termitaSplit" class="termita-split hidden">
            <div class="termita-split-side">
              <span data-ui="termitaOwnLabel" class="termita-split-label hidden">Vos</span>
              <div data-ui="grid" class="grid hidden" role="grid" aria-label="Rejilla de cubos interactiva"></div>
            </div>
            <div class="termita-split-side">
              <span data-ui="termitaRivalLabel" class="termita-split-label">Rival</span>
              <div data-ui="termitaRival" class="grid termita-rival" aria-hidden="true"></div>
            </div>
          </div>
          <div data-ui="info" class="result" role="status" aria-live="polite"></div>
          <button data-ui="backToLobby" class="hidden" data-back-to="online-lobby">Volver al lobby online</button>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
