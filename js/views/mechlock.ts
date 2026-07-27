/**
 * js/views/mechlock.ts
 *
 * Template de la vista "Mech Lock" (antes public/views/mechlock.html).
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
      <h2>Cerradura Mecánica</h2>
      <p>Has encontrado una enorme cerradura mecánica. No hay llave: solo un mecanismo de engranajes, pestillos, imanes y contrapesos. Interactúa con <strong>palancas</strong>, <strong>ruedas</strong> y <strong>embragues</strong> para hacer que el <strong>cerrojo principal</strong> se retraiga. Descubre cómo se conecta todo experimentando.</p>
      <div class="controls">
        <label>Tamaño
          <select data-ui="size">
            <option value="small">Pequeño (10)</option>
            <option value="medium" selected>Mediano (20)</option>
            <option value="large">Grande (40)</option>
          </select>
        </label>
        <label>Dificultad
          <select data-ui="difficulty">
            <option value="0">Muy fácil (todo visible)</option>
            <option value="1" selected>Normal</option>
            <option value="2">Difícil (oculto)</option>
          </select>
        </label>
        <div class="ml-checks">
          <label><input type="checkbox" data-ui="optMagnets" checked> Imanes</label>
          <label><input type="checkbox" data-ui="optChains" checked> Cadenas</label>
          <label><input type="checkbox" data-ui="optWeights" checked> Contrapesos</label>
          <label><input type="checkbox" data-ui="optClutches" checked> Embragues</label>
          <label><input type="checkbox" data-ui="optShowConn" checked> Mostrar conexiones</label>
          <label><input type="checkbox" data-ui="optTimer"> Tiempo límite</label>
        </div>
      </div>
      <button data-ui="start">Generar mecanismo</button>
      <div data-ui="hud" style="margin-top:10px"></div>
      <div data-ui="board"></div>
      <div data-ui="info" class="result" role="status" aria-live="polite"></div>
    </div>
  </div>
`;
};

export default template satisfies ViewTemplate;
