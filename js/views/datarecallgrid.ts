/**
 * js/views/datarecallgrid.ts
 *
 * Template de la vista "Data Recall Grid" (antes public/views/datarecallgrid.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="card" role="region" aria-labelledby="datarecallgrid-title">
          <h2 id="datarecallgrid-title">Data Recall Grid</h2>
          <p>Memoriza la red de datos y responde bajo presión. Escanea, recuerda, responde.</p>
          <div class="controls">
            <label for="objectCountSelect">Número de objetos a memorizar:
              <select id="objectCountSelect" data-ui="objectCountSelect" aria-describedby="objectCountDesc">
                <option value="4">4 objetos</option>
                <option value="6" selected>6 objetos</option>
                <option value="8">8 objetos</option>
              </select>
            </label>
            <span id="objectCountDesc" class="sr-only">Cantidad de objetos que aparecerán en la cuadrícula</span>
            <label for="displayTimeSelect">Tiempo de visualización en segundos:
              <select id="displayTimeSelect" data-ui="displayTimeSelect">
                <option value="3">3 segundos</option>
                <option value="5" selected>5 segundos</option>
                <option value="7">7 segundos</option>
              </select>
            </label>
            <label for="questionCountSelect">Número de preguntas:
              <select id="questionCountSelect" data-ui="questionCountSelect">
                <option value="3">3 preguntas</option>
                <option value="5" selected>5 preguntas</option>
                <option value="7">7 preguntas</option>
              </select>
            </label>
          </div>
          <button data-ui="start" aria-label="Iniciar juego Data Recall Grid">Iniciar Escaneo</button>
          <div data-ui="gridDisplay" class="grid-display" role="img" aria-label="Cuadrícula de objetos para memorizar"></div>
          <div data-ui="questionDisplay" class="question-display" role="region" aria-live="polite" aria-atomic="true"></div>
          <div class="answer-section">
            <input data-ui="answerInput" id="answerInput" type="text" placeholder="Respuesta..." disabled aria-label="Tu respuesta">
            <button data-ui="submitBtn" disabled aria-label="Enviar respuesta">Enviar</button>
          </div>
          <div data-ui="messageEl" class="message info" role="status" aria-live="polite">Esperando inicio...</div>
          <div class="game-stats">
            <span data-ui="scoreEl">Score: 0</span>
            <span data-ui="questionCountEl">Question: 0/5</span>
            <span data-ui="timerEl">Tiempo: --</span>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
