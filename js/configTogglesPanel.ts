/**
 * configTogglesPanel.ts — Conecta los toggles de Configuración que
 * existían como HTML puro sin ningún listener detrás:
 * `#configSfxToggle`, `#configMusicToggle`, `#configCursorToggle`.
 *
 * Los tres aparecían marcados ("checked") en el markup, dando a
 * entender que ya estaban activos y eran controlables — pero nada
 * escuchaba su evento `change`, así que tocarlos no tenía ningún
 * efecto. Mismo patrón que ya se dio con `perf-mode` (ver
 * js/perfMode.ts): la mitad de la implementación (el toggle visible,
 * o en este caso la clase CSS `body.cursor-disabled`) ya existía,
 * solo faltaba conectarla.
 *
 * `#configVfxToggle` ("EFECTOS VISUALES") queda deliberadamente FUERA
 * de este módulo: a diferencia de SFX/Música/Cursor, no hay ningún
 * `enable()`/`disable()` ni clase CSS ya preparada para "desactivar
 * efectos visuales" en general — conectarlo implicaría inventar ese
 * sistema desde cero. Ya existen dos mecanismos reales y probados que
 * cubren ese terreno (`body.reduced-motion`, gestionado por
 * accessibilityToggles.ts, y `body.perf-mode`, ver perfMode.ts); sumar
 * un tercer sistema paralelo sin una definición clara de qué debe
 * apagar exactamente sería más probable que confundiera al usuario
 * (¿por qué hay dos/tres toggles distintos de "menos efectos"?) que
 * ayudarlo.
 */

import safeStorage from './core/safeStorage.js';
import uiSoundEffects from './uiSoundEffects.js';
import audioManager from './audioManager.js';
import CustomCursorInstance from './customCursor.js';

const SFX_STORAGE_KEY = 'st_sfx_enabled';
const CURSOR_STORAGE_KEY = 'st_cursor_enabled';

const SFX_TOGGLE_ID = 'configSfxToggle';
const MUSIC_TOGGLE_ID = 'configMusicToggle';
const CURSOR_TOGGLE_ID = 'configCursorToggle';

// ---------------------------------------------------------------
// SFX: uiSoundEffects (clicks/hover de UI) + audioManager (sonidos
// de gameplay dentro de cada juego) son dos módulos separados — "
// EFECTOS DE SONIDO" en Configuración es la etiqueta genérica que un
// usuario esperaría controle AMBOS a la vez, no solo uno.
// ---------------------------------------------------------------

function applySfxEnabled(enabled: boolean): void {
  if (enabled) {
    uiSoundEffects.enable();
    audioManager.unmute();
  } else {
    uiSoundEffects.disable();
    audioManager.mute();
  }
}

function isSfxEnabled(): boolean {
  // audioManager no expone un getter de "enabled" (solo isMuted, que
  // es la negación), así que basta con consultar uno de los dos —
  // ambos se mueven siempre juntos a través de applySfxEnabled.
  return !audioManager.isMuted();
}

function initSfx(): void {
  const stored = safeStorage.getString(SFX_STORAGE_KEY, '1');
  applySfxEnabled(stored !== '0');
}

// ---------------------------------------------------------------
// Cursor: reusa la clase `body.cursor-disabled` que ya existía en
// css/styles.css sin que nada la aplicara nunca (ver bloque
// "Cursor disabled state"). No llamamos a CustomCursorInstance.destroy()
// aquí: la clase CSS ya oculta #cursorGlow/#cursorRing con
// `display:none` y restaura el cursor nativo del sistema
// (`cursor: auto`), que es toda la superficie visible del feature.
// Sí seguimos destruyendo los listeners si el usuario lo desactiva a
// mitad de sesión, por la misma razón que en perfMode.ts: evitar que seguir
// escuchando mousemove sin ningún efecto visible sea trabajo desperdiciado.
// ---------------------------------------------------------------

function applyCursorEnabled(enabled: boolean): void {
  document.body.classList.toggle('cursor-disabled', !enabled);
  if (!enabled) {
    CustomCursorInstance.destroy();
  }
  // Si se reactiva a mitad de sesión, no volvemos a llamar init():
  // mismo motivo documentado en perfMode.ts — evitar duplicar
  // listeners si el usuario alterna varias veces sin recargar. La
  // clase CSS por sí sola ya "esconde" el cursor personalizado
  // aunque sus listeners de mousemove sigan sin correr hasta el
  // próximo reload.
}

function isCursorEnabled(): boolean {
  return !document.body.classList.contains('cursor-disabled');
}

function initCursor(): void {
  const stored = safeStorage.getString(CURSOR_STORAGE_KEY, '1');
  if (stored === '0') {
    applyCursorEnabled(false);
  }
}

// ---------------------------------------------------------------
// Música: el reproductor (js/musicPlayer.ts) es un IIFE autocontenido
// sin ninguna API pública — no expone play()/pause() en `window`. En
// vez de duplicar su lógica interna (manejo de AudioContext, qué
// pista sonaba, animaciones del botón, persistencia en
// localStorage['mgb_paused']...) simulamos un click en su botón real
// #mpPlayPause, reusando TODO ese código ya probado. Leemos el estado
// real desde la clase `mp--playing` que el propio reproductor aplica
// a #musicPlayer, en vez de mantener nuestro propio booleano que
// podría desincronizarse si el usuario pausa/reanuda desde el widget
// directamente.
// ---------------------------------------------------------------

function isMusicPlaying(): boolean {
  return document.getElementById('musicPlayer')?.classList.contains('mp--playing') ?? false;
}

function toggleMusicViaWidget(): void {
  document.getElementById('mpPlayPause')?.click();
}

// ---------------------------------------------------------------
// Sincronización de los 3 checkboxes con el estado real, cada vez
// que la vista de Configuración se muestra (es lazy — puede no
// existir en el DOM todavía en el momento de este init()). Mismo
// patrón delegado que configPanel.ts / perfMode.ts.
// ---------------------------------------------------------------

function syncTogglesWithCurrentState(): void {
  const sfxToggle = document.getElementById(SFX_TOGGLE_ID);
  if (sfxToggle instanceof HTMLInputElement) sfxToggle.checked = isSfxEnabled();

  const cursorToggle = document.getElementById(CURSOR_TOGGLE_ID);
  if (cursorToggle instanceof HTMLInputElement) cursorToggle.checked = isCursorEnabled();

  const musicToggle = document.getElementById(MUSIC_TOGGLE_ID);
  if (musicToggle instanceof HTMLInputElement) musicToggle.checked = isMusicPlaying();
}

function bindDelegatedListeners(): void {
  document.addEventListener('change', (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.id === SFX_TOGGLE_ID) {
      applySfxEnabled(target.checked);
      safeStorage.setString(SFX_STORAGE_KEY, target.checked ? '1' : '0');
      return;
    }

    if (target.id === CURSOR_TOGGLE_ID) {
      applyCursorEnabled(target.checked);
      safeStorage.setString(CURSOR_STORAGE_KEY, target.checked ? '1' : '0');
      return;
    }

    if (target.id === MUSIC_TOGGLE_ID) {
      // No persistimos nada acá a propósito: el propio musicPlayer.ts
      // ya persiste su estado en localStorage['mgb_paused'] cuando
      // procesamos el click simulado más abajo — otra clave separada
      // acá terminaría desincronizada si el usuario también usa el
      // botón real del widget.
      toggleMusicViaWidget();
      return;
    }
  });

  // El botón real del reproductor puede cambiar de estado por fuera
  // de este panel (el usuario lo pausa/reanuda directo desde el
  // widget) — sincronizamos el checkbox de Configuración en cualquier
  // click sobre el widget real, además de al mostrar la vista.
  document.getElementById('mpPlayPause')?.addEventListener('click', () => {
    // El propio musicPlayer.ts todavía no terminó de togglear su
    // estado en este mismo tick (depende de una Promise de
    // `audio.play()`); una espera de 0ms alcanza para leer el estado
    // ya actualizado sin depender de un evento propio que el
    // reproductor no expone.
    setTimeout(syncTogglesWithCurrentState, 0);
  });

  document.addEventListener('view-shown', syncTogglesWithCurrentState);
}

function init(): void {
  initSfx();
  initCursor();
  bindDelegatedListeners();
  syncTogglesWithCurrentState();
}

init();

export default { applySfxEnabled, applyCursorEnabled, isSfxEnabled, isCursorEnabled };
