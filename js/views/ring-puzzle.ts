/**
 * js/views/ring-puzzle.ts
 *
 * Template de la vista "Ring Puzzle" (antes public/views/ring-puzzle.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 *
 * Modularización: el markup se arma con funciones pequeñas, una por fase
 * del juego (menú, jugando, resultado) en vez de un único string de ~170
 * líneas. Los 4 sliders del menú (Anillos, Nodos, Colores, Tiempo) seguían
 * el mismo patrón visual con pequeñas variaciones (hint opcional bajo la
 * etiqueta): ahora se generan desde MENU_SLIDERS.
 */
import type { ViewTemplate } from '../types/game.js';

interface MenuSlider {
  /** Sufijo compartido por id/track/fill/input (ej. "rings" → #rp-val-rings). */
  key: string;
  label: string;
  /** Texto pequeño bajo la etiqueta; solo el slider de Anillos lo usa. */
  hint?: string;
  /** Valor inicial mostrado en el contador. */
  initialValue: string;
}

const MENU_SLIDERS: MenuSlider[] = [
  { key: 'rings', label: 'Anillos', hint: 'centro → exterior', initialValue: '3' },
  { key: 'nodes', label: 'Nodos por anillo', initialValue: '6' },
  { key: 'colors', label: 'Colores', initialValue: '4' },
  { key: 'time', label: 'Límite de tiempo', initialValue: '1m 30s' },
];

/** Una fila de slider del menú de configuración. */
function renderMenuSlider(s: MenuSlider): string {
  const headerId = `rp-label-${s.key}`;
  const headerInner = s.hint
    ? `<div>
                    <span class="rp-slider-label" id="${headerId}">${s.label}</span>
                    <span class="rp-slider-hint">${s.hint}</span>
                  </div>`
    : `<span class="rp-slider-label" id="${headerId}">${s.label}</span>`;

  return `
              <div class="rp-slider-row">
                <div class="rp-slider-header">
                  ${headerInner}
                  <span class="rp-slider-val" id="rp-val-${s.key}">${s.initialValue}</span>
                </div>
                <div class="rp-track" id="rp-track-${s.key}">
                  <div class="rp-track-fill" id="rp-fill-${s.key}"></div>
                  <input type="range" id="rp-input-${s.key}" aria-labelledby="${headerId}">
                </div>
              </div>`;
}

/** Fase de menú: sliders de configuración, toggle de colores repetidos y botones de inicio. */
function renderMenuPhase(): string {
  const [rings, nodes, colors, time] = MENU_SLIDERS.map(renderMenuSlider);

  return `
        <!-- PHASE: MENU -->
        <div id="rp-phase-menu" class="rp-phase active">
          <div class="rp-menu">
            <div class="rp-menu-title">
              <div class="rp-color-dots" data-ui="rpColorDots"></div>
              <h1>Ring Lock</h1>
              <p>Alinea · Confirma · Desbloquea</p>
            </div>

            <div class="rp-settings-card">
              <!-- Rings -->
              ${rings}

              <!-- Nodes -->
              ${nodes}

              <!-- Colors -->
              ${colors}

              <div class="rp-divider"></div>

              <!-- Repeated colors toggle -->
              <div class="rp-toggle-row">
                <div>
                  <div class="rp-toggle-label">Colores repetidos</div>
                  <div class="rp-toggle-sub">Más difícil — mismo color, distintas posiciones</div>
                </div>
                <button class="rp-switch on" id="rp-toggle-repeated" aria-label="Colores repetidos" aria-pressed="true">
                  <div class="rp-switch-thumb"></div>
                </button>
              </div>

              <div class="rp-divider"></div>

              <!-- Time -->
              ${time}
            </div>

            <button class="rp-start-btn" data-ui="rpStartBtn">Iniciar Puzzle</button>
            <button class="rp-reset-btn" data-ui="rpResetBtn">Restablecer valores</button>
          </div>
        </div>`;
}

/** Fase de juego: header con pills/errores, timer, tablero SVG y controles de rotación. */
function renderPlayingPhase(): string {
  return `
        <!-- PHASE: PLAYING -->
        <div id="rp-phase-playing" class="rp-phase">
          <div class="ringpuzzle-card">
            <!-- Header: pills + wrong count -->
            <div class="rp-header">
              <div style="min-width:2rem"></div>
              <div class="rp-ring-pills" data-ui="rpRingPills"></div>
              <div class="rp-wrong-count" data-ui="rpWrongCount"></div>
            </div>

            <!-- Timer -->
            <div class="rp-timer-row">
              <div class="rp-timer-track">
                <div class="rp-timer-fill" data-ui="rpTimerFill" style="width:100%"></div>
              </div>
              <span class="rp-timer-label" data-ui="rpTimerLabel">1:30</span>
            </div>

            <!-- Board -->
            <div class="rp-board">
              <svg data-ui="rpSvg"
                   width="560" height="560"
                   viewBox="0 0 560 560"
                   aria-hidden="true"
                   style="touch-action:none;user-select:none">
              </svg>
              <div class="rp-feedback" data-ui="rpFeedbackCorrect" role="status" aria-live="polite">
                <div class="rp-feedback-pill correct">✓ Anillo desbloqueado</div>
              </div>
              <div class="rp-feedback" data-ui="rpFeedbackWrong" role="status" aria-live="polite">
                <div class="rp-feedback-pill wrong">✗ −3s</div>
              </div>
            </div>

            <!-- Controls -->
            <div class="rp-controls">
              <button class="rp-btn" data-ui="rpRotLeft">←</button>
              <button class="rp-btn rp-btn-confirm" data-ui="rpConfirm">Confirmar</button>
              <button class="rp-btn" data-ui="rpRotRight">→</button>
            </div>

            <p class="rp-hint">arrastra · flechas · espacio para confirmar</p>
          </div>
        </div>`;
}

/** Fase de resultado: icono, título, estadísticas de la partida y acciones. */
function renderResultPhase(): string {
  return `
        <!-- PHASE: RESULT -->
        <div id="rp-phase-result" class="rp-phase">
          <div class="rp-result">
            <div class="rp-result-icon won" data-ui="rpResultIcon">🔓</div>
            <div style="text-align:center" role="status" aria-live="polite">
              <h1 class="rp-result-title" data-ui="rpResultTitle">Desbloqueado</h1>
              <p class="rp-result-sub" data-ui="rpResultSub"></p>
            </div>

            <div class="rp-stats-card">
              <div class="rp-stat-row">
                <span>Anillos desbloqueados</span>
                <span data-ui="rpStatRings">0 / 0</span>
              </div>
              <div class="rp-stat-row">
                <span>Intentos fallidos</span>
                <span data-ui="rpStatWrong">0</span>
              </div>
              <div class="rp-stat-row">
                <span>Penalización</span>
                <span data-ui="rpStatPenalty">−0s</span>
              </div>
              <div class="rp-stat-row" id="rp-stat-remaining-row" style="display:none">
                <span>Tiempo restante</span>
                <span data-ui="rpStatRemaining" style="color:#f97316">0:00</span>
              </div>
            </div>

            <div class="rp-result-actions">
              <button class="rp-retry-btn" data-ui="rpRetryBtn">Jugar de nuevo</button>
              <button class="rp-menu-btn" data-ui="rpMenuBtn">Cambiar configuración</button>
            </div>
          </div>
        </div>`;
}

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        ${renderMenuPhase()}
        ${renderPlayingPhase()}
        ${renderResultPhase()}

      </div>
    `;
};

export default template satisfies ViewTemplate;
