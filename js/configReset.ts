/**
 * configReset.ts — Conecta el botón "BORRAR TODOS LOS RÉCORDS" de la vista
 * Configuración (js/views/configuracion.ts, #configResetBtn) con
 * Leaderboard.clear().
 *
 * El botón existía en el markup sin ningún listener; css/styles.css ya
 * define `.config-danger-btn--confirm` (con animación de pulso) para un
 * estado de confirmación que nada llegaba a activar. Igual que
 * configPanel.ts, usamos delegación de eventos sobre `document` porque la
 * vista "configuracion" se hidrata de forma lazy y el botón no existe en
 * el DOM cuando este módulo se carga.
 *
 * Requiere doble clic (primer clic arma la confirmación, segundo clic
 * ejecuta) para evitar borrar todos los récords por un clic accidental.
 * La confirmación se descarta sola a los 4s o si el usuario cambia de
 * vista sin confirmar.
 */

import Leaderboard from './leaderboardManager.js';

const RESET_BTN_ID = 'configResetBtn';
const CONFIRM_CLASS = 'config-danger-btn--confirm';
const CONFIRM_TIMEOUT_MS = 4000;

let confirmTimer: ReturnType<typeof setTimeout> | null = null;

function clearConfirmState(btn: HTMLButtonElement): void {
  if (confirmTimer) {
    clearTimeout(confirmTimer);
    confirmTimer = null;
  }
  btn.classList.remove(CONFIRM_CLASS);
  btn.textContent = 'BORRAR TODOS LOS RÉCORDS';
}

function armConfirmState(btn: HTMLButtonElement): void {
  btn.classList.add(CONFIRM_CLASS);
  btn.textContent = '¿SEGURO? TOCA DE NUEVO PARA CONFIRMAR';
  confirmTimer = setTimeout(() => clearConfirmState(btn), CONFIRM_TIMEOUT_MS);
}

function handleClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const btn = target.closest<HTMLButtonElement>(`#${RESET_BTN_ID}`);
  if (!btn) return;

  if (!btn.classList.contains(CONFIRM_CLASS)) {
    armConfirmState(btn);
    return;
  }

  Leaderboard.clear();
  clearConfirmState(btn);
  btn.textContent = 'RÉCORDS BORRADOS ✓';
  setTimeout(() => {
    btn.textContent = 'BORRAR TODOS LOS RÉCORDS';
  }, 1500);
}

// Si el usuario navega a otra vista con la confirmación armada, la
// descartamos: no queremos que un clic en un botón similar de otra
// vista, mostrado después, se interprete como la confirmación.
function handleViewShown(): void {
  const btn = document.getElementById(RESET_BTN_ID) as HTMLButtonElement | null;
  if (btn && btn.classList.contains(CONFIRM_CLASS)) {
    clearConfirmState(btn);
  }
}

document.addEventListener('click', handleClick);
document.addEventListener('view-shown', handleViewShown);
