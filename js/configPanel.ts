/**
 * configPanel.ts — Conecta los selectores de tema del sitio con
 * BackgroundManager.
 *
 * Hay DOS selectores de tema en el DOM, históricamente sin conectar a
 * nada (existían como HTML puro):
 *   - #themeSelect      → en el header (index.html, siempre presente)
 *   - #configThemeSelect → dentro de la vista "Configuración"
 *     (js/views/configuracion.ts, inyectada de forma lazy)
 * Ambos deben aplicar el mismo tema y quedar sincronizados entre sí.
 * Usamos delegación de eventos sobre `document`, así no importa si el
 * markup todavía no existe en el momento en que este módulo se carga:
 * los listeners igual capturan los eventos una vez la vista se hidrata.
 */

import BackgroundManager from './backgroundManager.js';

const THEME_STORAGE_KEY = 'st_theme';
const THEME_SELECT_IDS = ['themeSelect', 'configThemeSelect'];

type ThemeValue = 'dark' | 'pixel';

function isThemeValue(value: string): value is ThemeValue {
  return value === 'dark' || value === 'pixel';
}

function safeGetStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Tracking Prevention (Edge), modo privado estricto, o storage
    // bloqueado en iframes: no debe impedir que el resto de la app
    // (sobre todo el registro de listeners más abajo) funcione.
    return null;
  }
}

function safeSetStoredTheme(value: ThemeValue): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Persistencia best-effort: si el storage está bloqueado, el tema
    // igual se aplica para la sesión actual, solo no sobrevive a un reload.
  }
}

function applyStoredTheme(): void {
  const stored = safeGetStoredTheme();
  if (stored && isThemeValue(stored)) {
    BackgroundManager.setTheme(stored);
  }
}

/** Refleja el tema actual del body en TODOS los selectores presentes
 *  en el DOM ahora mismo (header + configuración, si están montados). */
function syncAllSelectsWithCurrentTheme(): void {
  const current = document.body.getAttribute('data-theme');
  if (!current || !isThemeValue(current)) return;

  THEME_SELECT_IDS.forEach(id => {
    const select = document.getElementById(id);
    if (select instanceof HTMLSelectElement) select.value = current;
  });
}

function bindDelegatedListeners(): void {
  // 'change' en <select> no burbujea en navegadores muy viejos, pero sí
  // en todos los evergreen actuales (Chrome/Edge/Firefox/Safari). Se
  // deja en document (no en cada select directo) porque #configThemeSelect
  // se inyecta de forma lazy y todavía no existe cuando este módulo corre.
  document.addEventListener('change', (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!THEME_SELECT_IDS.includes(target.id)) return;

    const value = target.value;
    if (!isThemeValue(value)) return;

    BackgroundManager.setTheme(value);
    safeSetStoredTheme(value);
    // BackgroundManager.setTheme ya dispara 'theme-changed', que a su
    // vez llama a syncAllSelectsWithCurrentTheme — así el OTRO select
    // (el que el usuario no tocó) queda sincronizado también.
  });

  // Cada vez que se muestra una vista (incluida "configuracion" la
  // primera vez que se hidrata), reflejamos el tema actual en los
  // selectores que ya existan en el DOM en ese momento.
  document.addEventListener('view-shown', syncAllSelectsWithCurrentTheme);
  document.addEventListener('theme-changed', syncAllSelectsWithCurrentTheme);
}

function init(): void {
  try {
    applyStoredTheme();
  } catch (err) {
    console.error('[configPanel] applyStoredTheme falló, continuando sin tema guardado:', err);
  }
  bindDelegatedListeners();
  // El #themeSelect del header ya está en el DOM desde el primer paint
  // (no es lazy como el de Configuración), así que lo sincronizamos ya.
  syncAllSelectsWithCurrentTheme();
}

init();

export default { init };
