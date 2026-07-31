/**
 * js/views/snippet-race.ts
 *
 * Template de Snippet Race (lobby TIPEO). Contenido inyectado en
 * <section id="snippet-race"> vía viewManager.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => `
  <button class="back-btn" data-back-to="home" data-back-label="← Volver"></button>

  <div class="sr-card">
    <header class="sr-header">
      <div>
        <h2>Snippet Race</h2>
        <p>Completá o corregí el código. Velocidad y precisión cuentan.</p>
      </div>
      <div class="sr-status" data-ui="status">
        <span data-ui="roundLabel">RONDA —</span>
        <span data-ui="scoreLabel">0 PTS</span>
        <span data-ui="streakLabel" class="sr-streak" hidden></span>
        <span data-ui="timerLabel">00:00</span>
      </div>
    </header>

    <div class="sr-setup" data-ui="setup">
      <label>
        Rondas
        <select data-ui="roundsSelect" aria-label="Cantidad de rondas">
          <option value="5">5</option>
          <option value="10" selected>10</option>
          <option value="15">15</option>
        </select>
      </label>
      <label>
        Dificultad
        <select data-ui="difficultySelect" aria-label="Dificultad">
          <option value="1">Cadete</option>
          <option value="2" selected>Operador</option>
          <option value="3">Elite</option>
        </select>
      </label>
      <button type="button" data-ui="start" class="sr-start-btn">INICIAR</button>
    </div>

    <div class="sr-countdown" data-ui="countdown" hidden aria-live="assertive"></div>

    <div class="sr-play" data-ui="play" hidden>
      <div class="sr-prompt" data-ui="prompt">Completá el return</div>
      <div class="sr-lang" data-ui="langBadge">js</div>

      <pre class="sr-snippet" data-ui="snippet" aria-live="polite"></pre>

      <div class="sr-editor-wrap">
        <label class="sr-editor-label" for="sr-input">Tu código</label>
        <textarea
          id="sr-input"
          data-ui="input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          rows="3"
          placeholder="Escribí aquí…"
        ></textarea>
      </div>

      <div class="sr-actions">
        <button type="button" data-ui="submit" class="sr-submit">ENVIAR (Enter)</button>
        <button type="button" data-ui="skip" class="sr-skip">SALTAR (−pts)</button>
      </div>

      <div class="sr-message" data-ui="message" role="status" aria-live="polite"></div>

      <div class="sr-progress">
        <div class="sr-progress-bar" data-ui="progressBar"></div>
      </div>
    </div>

    <div class="sr-result" data-ui="result" hidden>
      <h3 data-ui="resultTitle">MISIÓN COMPLETA</h3>
      <p data-ui="resultStats"></p>
      <button type="button" data-ui="retry" class="sr-start-btn">REPETIR</button>
    </div>
  </div>
`;

export default template satisfies ViewTemplate;
