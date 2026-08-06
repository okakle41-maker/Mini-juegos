/**
 * accessibilityToggles.ts — Conecta `#reducedMotionToggle` y
 * `#highContrastToggle` (en index.html, dentro del panel de
 * Configuración) con las clases CSS que el resto del proyecto ya
 * espera: `body.reduced-motion` y `body.high-contrast`
 * (ver css/styles.css, css/lobby-themes.css, css/category-identity.css).
 *
 * Antes esto lo manejaba preferencesManager.ts, que además duplicaba
 * el manejo de `#themeSelect` ya cubierto por configPanel.ts (los dos
 * escribían sobre los mismos IDs del DOM). Al eliminar ese archivo por
 * ser deuda técnica conflictiva, se extrajo aquí SOLO la parte de
 * reducedMotion/highContrast, que no tenía ningún otro dueño real:
 * accessibilitySystem.ts (activo) no toca estos dos IDs en absoluto.
 *
 * Mismo patrón de inicialización que configPanel.ts: aplicar el valor
 * guardado ni bien carga el módulo, delegar el listener de `change` en
 * `document` (los toggles viven en el panel de Configuración, que
 * puede hidratarse de forma lazy) y re-sincronizar en `view-shown`.
 */

import safeStorage from './core/safeStorage.js';

const REDUCED_MOTION_KEY = 'accessibility_reduced_motion';
const HIGH_CONTRAST_KEY = 'accessibility_high_contrast';

const REDUCED_MOTION_TOGGLE_ID = 'reducedMotionToggle';
const HIGH_CONTRAST_TOGGLE_ID = 'highContrastToggle';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function getReducedMotion(): boolean {
  return safeStorage.getJSON<boolean>(REDUCED_MOTION_KEY, false, { validate: isBoolean });
}

function getHighContrast(): boolean {
  return safeStorage.getJSON<boolean>(HIGH_CONTRAST_KEY, false, { validate: isBoolean });
}

function applyReducedMotion(enabled: boolean): void {
  document.body.classList.toggle('reduced-motion', enabled);
}

function applyHighContrast(enabled: boolean): void {
  document.body.classList.toggle('high-contrast', enabled);
}

/** Refleja el estado guardado en los toggles y clases del body,
 *  para cualquier instancia de los toggles presente ahora mismo en
 *  el DOM (el panel de Configuración puede inyectarse de forma lazy). */
function syncTogglesWithCurrentState(): void {
  const reducedMotion = getReducedMotion();
  const highContrast = getHighContrast();

  applyReducedMotion(reducedMotion);
  applyHighContrast(highContrast);

  const reducedMotionToggle = document.getElementById(REDUCED_MOTION_TOGGLE_ID);
  if (reducedMotionToggle instanceof HTMLInputElement) {
    reducedMotionToggle.checked = reducedMotion;
  }

  const highContrastToggle = document.getElementById(HIGH_CONTRAST_TOGGLE_ID);
  if (highContrastToggle instanceof HTMLInputElement) {
    highContrastToggle.checked = highContrast;
  }
}

function bindDelegatedListeners(): void {
  document.addEventListener('change', (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.id === REDUCED_MOTION_TOGGLE_ID) {
      applyReducedMotion(target.checked);
      safeStorage.setJSON(REDUCED_MOTION_KEY, target.checked);
    } else if (target.id === HIGH_CONTRAST_TOGGLE_ID) {
      applyHighContrast(target.checked);
      safeStorage.setJSON(HIGH_CONTRAST_KEY, target.checked);
    }
  });

  document.addEventListener('view-shown', syncTogglesWithCurrentState);
}

function init(): void {
  // Las clases del body deben aplicarse ya, sin esperar a que el panel
  // de Configuración exista en el DOM (afectan animaciones/contraste
  // en toda la app, no solo dentro de ese panel).
  applyReducedMotion(getReducedMotion());
  applyHighContrast(getHighContrast());

  bindDelegatedListeners();
  syncTogglesWithCurrentState();
}

init();

export default { init };
