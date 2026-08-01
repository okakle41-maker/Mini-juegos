/**
 * js/views/progresstiming.ts
 *
 * Template de la vista "Progress Timing" (antes public/views/progresstiming.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 *
 * Modularización: el markup se arma con varias funciones pequeñas, una por
 * sección visual (cabecera, previsualización, sliders, opciones básicas,
 * panel avanzado, botones, área de juego), en vez de un único string de
 * ~450 líneas. Cada función es privada al módulo y no se exporta: sigue
 * siendo un solo template() público de cara al resto de la app (mismo
 * contrato ViewTemplate = () => string que consume viewManager.ts), pero
 * internamente cada sección se puede leer, tocar o testear por separado.
 */
import type { ViewTemplate } from '../types/game.js';

/** Cabecera con botón de volver, título y subtítulo. */
function renderHeader(): string {
  return `
    <div class="pt-header">
        <button class="back-btn" data-back-to="skillchecks" data-back-label="← Volver"></button>
        <div>
            <div class="pt-title">Progress Timing</div>
            <div class="pt-subtitle">Configura la dificultad antes de comenzar</div>
        </div>
    </div>`;
}

/** Selector de modo Básico / Avanzado. */
function renderModeSection(): string {
  return `
    <div class="pt-section">
        <div class="pt-section-title">Modo</div>
        <div class="pt-mode">
            <button id="ptBasicMode" class="active" aria-pressed="true">Básico</button>
            <button id="ptAdvancedMode" aria-pressed="false">Avanzado</button>
        </div>
    </div>`;
}

/** Previsualización estática de la pista/target antes de iniciar. */
function renderPreviewSection(): string {
  return `
    <div class="pt-section">
        <div class="pt-section-title">Vista previa</div>
        <div class="pt-card">
            <div id="ptPreview" class="pt-preview">
                <div id="ptPreviewTrack" class="pt-track">
                    <div id="ptPreviewTarget" class="pt-target">
                        <div id="ptPreviewPerfect" class="pt-perfect"></div>
                    </div>
                    <div id="ptPreviewMarker" class="pt-marker"></div>
                </div>
            </div>
        </div>
    </div>`;
}

/** Slider individual con etiqueta y valor (velocidad, tamaño de zona, etc). */
function renderSliderCard(opts: {
  label: string;
  valueId: string;
  valueText: string;
  inputId: string;
  min: number;
  max: number;
  value: number;
}): string {
  return `
    <div class="pt-section">
        <div class="pt-card">
            <div class="pt-label">
                <span>${opts.label}</span>
                <span id="${opts.valueId}" class="pt-value">${opts.valueText}</span>
            </div>
            <input id="${opts.inputId}" class="pt-slider" type="range" aria-label="${opts.label}"
                   min="${opts.min}" max="${opts.max}" value="${opts.value}">
        </div>
    </div>`;
}

/** Switch individual (checkbox estilizado) con etiqueta. */
function renderSwitch(opts: { label: string; inputId: string; checked: boolean }): string {
  return `
    <div class="pt-switch">
        <span>${opts.label}</span>
        <label>
            <input id="${opts.inputId}" type="checkbox" aria-label="${opts.label}" ${opts.checked ? 'checked' : ''}>
            <span class="pt-toggle"></span>
        </label>
    </div>`;
}

/** Tarjeta con los dos switches básicos: Incremental y Zona móvil. */
function renderBasicOptionsSection(): string {
  return `
    <div class="pt-section">
        <div class="pt-card">
            ${renderSwitch({ label: 'Incremental', inputId: 'ptIncremental', checked: true })}
            ${renderSwitch({ label: 'Zona móvil', inputId: 'ptMovingZone', checked: false })}
        </div>
    </div>`;
}

/** Panel avanzado (oculto por defecto): grid de 4 switches incrementales. */
function renderAdvancedPanel(): string {
  const cards = [
    { label: 'Velocidad incremental', inputId: 'ptIncSpeed' },
    { label: 'Tamaño incremental', inputId: 'ptIncSize' },
    { label: 'Movimiento incremental', inputId: 'ptIncMove' },
    { label: 'Zona Perfect', inputId: 'ptPerfectEnabled' },
  ]
    .map(
      (c) => `
        <div class="pt-card">
            ${renderSwitch({ label: c.label, inputId: c.inputId, checked: true })}
        </div>`
    )
    .join('');

  return `
    <div id="ptAdvancedPanel" class="pt-advanced">
        <div class="pt-section">
            <div class="pt-section-title">Opciones avanzadas</div>
            <div class="pt-grid two">${cards}</div>
        </div>
    </div>`;
}

/** Botones de acción del panel de configuración: Aleatorio e Iniciar. */
function renderConfigButtons(): string {
  return `
    <div class="pt-buttons">
        <button id="ptRandom" class="pt-btn pt-random">🎲 Aleatorio</button>
        <button id="ptStart" class="pt-btn pt-start">▶ Iniciar</button>
    </div>`;
}

/** Panel de configuración completo: agrupa todas las secciones de arriba. */
function renderConfigPanel(): string {
  return `
    <div id="ptConfig" class="pt-config">
        <div class="pt-body">
            ${renderModeSection()}
            ${renderPreviewSection()}
            ${renderSliderCard({
              label: 'Velocidad',
              valueId: 'ptSpeedValue',
              valueText: '50%',
              inputId: 'ptSpeed',
              min: 10,
              max: 100,
              value: 50,
            })}
            ${renderSliderCard({
              label: 'Tamaño de la zona',
              valueId: 'ptSizeValue',
              valueText: '20%',
              inputId: 'ptZoneSize',
              min: 5,
              max: 35,
              value: 20,
            })}
            ${renderBasicOptionsSection()}
            ${renderAdvancedPanel()}
            ${renderConfigButtons()}
        </div>
    </div>`;
}

/** Área de juego activo: contador de ronda/resultado, pista, timer y partículas. */
function renderGameArea(): string {
  return `
    <div id="ptGame" class="pt-game">
        <div class="pt-gameInfo">
            <div class="pt-infoBox">
                <div class="pt-infoTitle">Ronda</div>
                <div id="ptRound" class="pt-infoValue">1</div>
            </div>
            <div class="pt-infoBox">
                <div class="pt-infoTitle">Resultado</div>
                <div id="ptState" class="pt-infoValue">-</div>
            </div>
        </div>

        <div class="pt-trackContainer" aria-hidden="true">
            <div id="ptTrack" class="pt-track">
                <div id="ptTarget" class="pt-target">
                    <div id="ptPerfect" class="pt-perfect"></div>
                </div>
                <div id="ptMarker" class="pt-marker"></div>
            </div>
        </div>

        <div id="ptResult" class="pt-result" role="status" aria-live="polite"></div>

        <div class="pt-timer">
            <div id="ptTimerFill" class="pt-timerFill"></div>
        </div>

        <div id="ptParticles" class="pt-particles"></div>
    </div>`;
}

const template = (): string => {
  return `
    ${renderHeader()}
    ${renderConfigPanel()}
    ${renderGameArea()}
  `;
};

export default template satisfies ViewTemplate;
