/**
 * perfMode.ts — Conecta el toggle "MODO BAJO CONSUMO" de Configuración
 * con `body.perf-mode` (ver bloque `body.perf-mode` al final de
 * css/styles.css y el chequeo en customCursor.ts init()).
 *
 * Antes, `perf-mode` solo se podía activar con `?perf=1` en la URL
 * (ver main.ts) — útil para diagnosticar con el trace de Performance,
 * pero invisible/no persistente para un usuario real. Este módulo
 * agrega:
 *   1. Persistencia en localStorage (vía safeStorage), para que la
 *      preferencia sobreviva a un reload sin depender del query string.
 *   2. Un toggle real en Configuración (#configPerfModeToggle) que
 *      añade/quita la clase en caliente, sin necesitar recargar la
 *      página — `body.perf-mode *` en CSS aplica al instante. Al
 *      activarlo apagamos el cursor personalizado a mano (destroy());
 *      al desactivarlo lo reinicializamos a mano también (destroy()
 *      + init()), para que el efecto sea reversible en caliente sin
 *      pedirle al usuario que recargue la página.
 *
 * El query string `?perf=1` (ver main.ts) sigue funcionando igual que
 * antes para pruebas puntuales, pero NO se persiste — es un flag de
 * sesión, no cambia la preferencia guardada del usuario.
 */

import safeStorage from './core/safeStorage.js';
import CustomCursorInstance from './customCursor.js';

const PERF_MODE_STORAGE_KEY = 'st_perf_mode';
const TOGGLE_ID = 'configPerfModeToggle';

function isPerfModeEnabled(): boolean {
  return document.body.classList.contains('perf-mode');
}

function setPerfMode(enabled: boolean, opts: { persist: boolean } = { persist: true }): void {
  document.body.classList.toggle('perf-mode', enabled);

  if (opts.persist) {
    safeStorage.setString(PERF_MODE_STORAGE_KEY, enabled ? '1' : '0');
  }

  // customCursor.init() ya corrió en DOMContentLoaded y solo chequea
  // `perf-mode` una vez; si el usuario activa el modo a mitad de
  // sesión con el cursor personalizado ya en marcha, hay que apagarlo
  // a mano acá (destroy() cancela el RAF y quita los listeners).
  //
  // Al desactivarlo, reinicializamos también a mano: destroy() es
  // seguro de llamar siempre (idempotente incluso si el cursor nunca
  // se había activado, ver customCursor.ts), así que llamarlo antes
  // de init() evita el riesgo de duplicar listeners sin depender de
  // si esta llamada activó perf-mode en algún momento anterior de la
  // sesión. Antes esto quedaba pendiente de un reload manual — exactamente
  // el bug reportado ("desactivé el modo bajo consumo y el cursor
  // gamer no volvía a activarse ni con Ctrl+Shift+R", porque el reload
  // por sí solo no alcanza: la preferencia guardada en localStorage
  // seguía marcando perf-mode activo, así que initCursor() no hacía nada).
  CustomCursorInstance.destroy();
  if (!enabled) {
    CustomCursorInstance.init();
  }
}

/** Refleja el estado actual en el checkbox de Configuración, si está
 *  montado en el DOM en este momento (la vista es lazy). */
function syncToggleWithCurrentState(): void {
  const toggle = document.getElementById(TOGGLE_ID);
  if (toggle instanceof HTMLInputElement) {
    toggle.checked = isPerfModeEnabled();
  }
}

function bindDelegatedListener(): void {
  // Delegado en document (no en el toggle directo) porque la vista de
  // Configuración se inyecta de forma lazy — mismo patrón que
  // configPanel.ts con los <select> de tema.
  document.addEventListener('change', (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.id !== TOGGLE_ID) return;
    setPerfMode(target.checked);
  });

  document.addEventListener('view-shown', syncToggleWithCurrentState);
}

function init(): void {
  // Restaura la preferencia guardada. Si `?perf=1` ya la activó para
  // esta sesión (ver main.ts, corre antes que este módulo), no la
  // pisamos con un '0' guardado — el query string manda para la
  // sesión actual.
  if (!isPerfModeEnabled()) {
    const stored = safeStorage.getString(PERF_MODE_STORAGE_KEY, '0');
    if (stored === '1') {
      setPerfMode(true, { persist: false });
    }
  }

  bindDelegatedListener();
  syncToggleWithCurrentState();
}

init();

export default { setPerfMode, isPerfModeEnabled };
