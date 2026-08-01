/**
 * js/views/reactor.ts
 *
 * Template de la vista "Reactor" (antes public/views/reactor.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 *
 * Modularización: el markup se arma con funciones pequeñas, una por sección
 * visual (configuración, barra de estado, panel de variables, panel de
 * acciones, pantalla final), en vez de un único string de ~180 líneas. Las
 * 6 variables del reactor (energía, temperatura, presión, refrigeración,
 * radiación, combustible) seguían el mismo patrón visual repetido casi
 * palabra por palabra: ahora se generan desde REACTOR_VARS, con los límites
 * (`rx-bar-limit`) como campo opcional para las variables que los tienen.
 */
import type { ViewTemplate } from '../types/game.js';

interface ReactorVar {
  /** Sufijo usado en data-ui (energyVal/energyBar) y clase de color (rx-bar-energy). */
  key: string;
  icon: string;
  label: string;
  /** Valor inicial mostrado antes de que el juego calcule el real. */
  initialValue: string;
  /** Ancho inicial de la barra de relleno, en %. */
  fillWidth: number;
  /** Posiciones (en %) de los marcadores de límite seguro; vacío si no aplica. */
  limits?: number[];
  /** Margen superior extra antes de esta variable (solo la usa "Combustible" hoy). */
  extraTopMargin?: boolean;
}

const REACTOR_VARS: ReactorVar[] = [
  { key: 'energy', icon: '⚡', label: 'Energía', initialValue: '—%', fillWidth: 55, limits: [10, 90] },
  { key: 'temp', icon: '🌡️', label: 'Temperatura', initialValue: '—°C', fillWidth: 42, limits: [20, 80] },
  { key: 'pressure', icon: '💨', label: 'Presión', initialValue: '—%', fillWidth: 48, limits: [15, 85] },
  { key: 'cooling', icon: '❄️', label: 'Refrigeración', initialValue: '—%', fillWidth: 40 },
  { key: 'radiation', icon: '☢️', label: 'Radiación', initialValue: '—%', fillWidth: 8, limits: [60] },
  { key: 'fuel', icon: '🔋', label: 'Combustible', initialValue: '100%', fillWidth: 100 },
];

/** Una fila de variable del reactor: etiqueta + valor + barra con sus límites. */
function renderReactorVar(v: ReactorVar): string {
  const limitMarkers = (v.limits ?? [])
    .map((pos) => `<div class="rx-bar-limit" style="left:${pos}%"></div>`)
    .join('\n                ');

  return `
            <!-- ${v.label} -->
            <div class="rx-var">
              <div class="rx-var-header">
                <span class="rx-var-label">${v.icon} ${v.label}</span>
                <span data-ui="${v.key}Val" class="rx-var-value">${v.initialValue}</span>
              </div>
              <div data-ui="${v.key}Bar" class="rx-bar-track">
                <div class="rx-bar-fill rx-bar-${v.key}" style="width:${v.fillWidth}%"></div>
                ${limitMarkers}
              </div>
            </div>`;
}

/** Pantalla de configuración: duración, velocidad, frecuencia de eventos y tipo de reactor. */
function renderSetupPhase(): string {
  return `
      <!-- ── PANTALLA DE CONFIGURACIÓN ── -->
      <div data-ui="setupPhase" class="rx-setup">
        <div class="controls">
          <label>Duración:
            <select data-ui="durationSel">
              <option value="60">1 minuto</option>
              <option value="90" selected>90 segundos</option>
              <option value="120">2 minutos</option>
              <option value="180">3 minutos</option>
            </select>
          </label>
          <label>Velocidad:
            <select data-ui="speedSel">
              <option value="0.6">Lenta</option>
              <option value="1" selected>Normal</option>
              <option value="1.5">Rápida</option>
              <option value="2">Frenética</option>
            </select>
          </label>
          <label>Frecuencia de eventos:
            <select data-ui="eventsSel">
              <option value="0.5">Pocos</option>
              <option value="1" selected>Normal</option>
              <option value="2">Frecuentes</option>
              <option value="3">Caótico</option>
            </select>
          </label>
        </div>

        <div class="rx-panel-title" style="font-family:var(--font-mono);font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--text-dim);margin-bottom:.6rem">
          Tipo de reactor
        </div>
        <div class="rx-reactor-types">
          <button data-ui-all="typeButtons" data-reactor-id="experimental" class="rx-type-btn" type="button"></button>
          <button data-ui-all="typeButtons" data-reactor-id="antiguo"      class="rx-type-btn" type="button"></button>
          <button data-ui-all="typeButtons" data-reactor-id="compacto"     class="rx-type-btn" type="button"></button>
          <button data-ui-all="typeButtons" data-reactor-id="militar"      class="rx-type-btn" type="button"></button>
          <button data-ui-all="typeButtons" data-reactor-id="dañado"       class="rx-type-btn" type="button"></button>
        </div>

        <button data-ui="start" type="button">Iniciar Reactor</button>
      </div>`;
}

/** Barra superior de estado durante la partida: nombre, timer y estabilidad. */
function renderStatusBar(): string {
  return `
        <!-- Barra superior de estado -->
        <div class="rx-status-bar">
          <span class="rx-reactor-name" data-ui="reactorName">—</span>
          <span class="rx-timer" data-ui="timerEl">—:——</span>
          <!-- stabilityEl se actualiza en cada tick del render loop
               (varias veces por segundo, ver renderState en
               reactor.logic.ts) — aria-live acá anunciaría sin parar y
               ahogaría el resto de la UI. El evento crítico puntual
               (eventBanner, más abajo) sí lleva aria-live porque ese
               cambia con frecuencia aleatoria baja, no en cada tick. -->
          <span class="rx-stability stable" data-ui="stabilityEl">ESTABLE</span>
        </div>`;
}

/** Banner de evento activo, con botón para resolverlo. */
function renderEventBanner(): string {
  return `
        <!-- Banner de evento activo -->
        <div data-ui="eventBanner" class="rx-event-banner" role="alert" aria-live="assertive">
          <span data-ui="eventIcon" class="rx-event-icon">⚠️</span>
          <span data-ui="eventText">—</span>
          <button data-ui="eventResolveBtn" class="rx-event-resolve" type="button">Resolver</button>
        </div>`;
}

/** Panel izquierdo: las 6 variables del reactor + log de eventos. */
function renderVariablesPanel(): string {
  const vars = REACTOR_VARS.map(renderReactorVar).join('');

  return `
          <!-- Panel izquierdo: variables del reactor -->
          <div class="rx-panel">
            <div class="rx-panel-title">Estado del sistema</div>
            ${vars}

            <!-- Log de eventos -->
            <div class="rx-panel-title" style="margin-top:1rem">Registro de sistema</div>
            <div data-ui="logEl" class="rx-log"></div>
          </div>`;
}

/** Panel derecho: contenedor de acciones/controles disponibles. */
function renderActionsPanel(): string {
  return `
          <!-- Panel derecho: acciones -->
          <div class="rx-actions-panel">
            <div class="rx-panel-title">Controles</div>
            <div data-ui="actionsContainer" class="rx-actions-grid"></div>
          </div>`;
}

/** Pantalla de juego completa: status bar, evento, y layout de dos paneles. */
function renderGamePhase(): string {
  return `
      <!-- ── PANTALLA DE JUEGO ── -->
      <div data-ui="gamePhase" class="rx-game" style="display:none">
        ${renderStatusBar()}
        ${renderEventBanner()}

        <!-- Layout principal: panel de variables + panel de acciones -->
        <div class="rx-game-inner">
          ${renderVariablesPanel()}
          ${renderActionsPanel()}
        </div><!-- /rx-game-inner -->
      </div><!-- /rx-game -->`;
}

/** Pantalla final con resultado y botón para reiniciar configuración. */
function renderEndPhase(): string {
  return `
      <!-- ── PANTALLA FINAL ── -->
      <div data-ui="endPhase" style="display:none">
        <div data-ui="resultEl" class="result" role="status" aria-live="polite"></div>
        <button data-ui="restartBtn" type="button" style="margin-top:1rem">Volver a configurar</button>
      </div>`;
}

const template = (): string => {
  return `
  <div class="game-view-inner">
    <button class="back-btn" data-back-to="home"></button>

    <!-- Overlay de interferencia por radiación -->
    <div class="rx-radiation-overlay"></div>

    <div class="card">
      <h2>☢️ Reactor Nuclear</h2>
      <p>Mantén el reactor estable durante el tiempo configurado. Las variables están interconectadas: cada acción tiene consecuencias en cadena. Gestiona eventos aleatorios y aprende a anticiparte al comportamiento de tu reactor.</p>
      ${renderSetupPhase()}
      ${renderGamePhase()}
      ${renderEndPhase()}
    </div><!-- /card -->
  </div><!-- /game-view-inner -->
`;
};

export default template satisfies ViewTemplate;
