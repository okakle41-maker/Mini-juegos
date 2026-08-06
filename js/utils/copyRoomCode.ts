/**
 * js/utils/copyRoomCode.ts
 *
 * Botón "Copiar" reutilizable para cualquier elemento que muestre un
 * código de sala/lobby (`textContent` = código). Usado por:
 *   - js/games/lettersFall.logic.ts (sala 1v1/coop de Letters Fall)
 *   - js/views/multiplayer.logic.ts (banner de lobby grupal)
 *   - js/views/onlineLobby.logic.ts (badge de "Lobby Online")
 *
 * Ver `.copy-code-btn` en css/letters.css y css/multiplayer.css para
 * el estilo — cada vista lo tunea con su propio acento de color, pero
 * el componente (markup + comportamiento) es el mismo en los tres
 * lugares.
 */

import notificationSystem from '../notificationSystem.js';

const COPIED_LABEL = '✓ Copiado';
const DEFAULT_LABEL = '📋 Copiar';
const RESET_DELAY_MS = 1500;

/**
 * Inserta (o reemplaza, si ya existe) un botón "Copiar" inmediatamente
 * después de `displayEl`, que copia `displayEl.textContent` al
 * portapapeles al hacer click.
 *
 * Es seguro llamarlo más de una vez sobre el mismo `displayEl` (por
 * ejemplo, cada vez que se actualiza el código mostrado): si ya existe
 * un botón con el `buttonId` dado, se reutiliza en vez de duplicarlo.
 *
 * @param displayEl Elemento cuyo `textContent` es el código a copiar.
 * @param buttonId  Id único para el botón — permite ubicarlo en tests
 *                  o estilizarlo puntualmente si hace falta.
 */
export function attachCopyButton(displayEl: HTMLElement, buttonId: string): HTMLButtonElement {
  const existing = document.getElementById(buttonId) as HTMLButtonElement | null;
  const btn = existing ?? document.createElement('button');

  if (!existing) {
    btn.id = buttonId;
    btn.type = 'button';
    btn.className = 'copy-code-btn';
    displayEl.insertAdjacentElement('afterend', btn);
  }

  btn.textContent = DEFAULT_LABEL;
  btn.setAttribute('aria-label', 'Copiar código de sala');

  // Reemplazamos el listener anterior (si lo hubiera, de una llamada
  // previa a attachCopyButton) clonando el nodo — más simple y menos
  // propenso a errores que trackear y remover el handler a mano.
  const freshBtn = btn.cloneNode(true) as HTMLButtonElement;
  btn.replaceWith(freshBtn);

  let resetTimeout: ReturnType<typeof setTimeout> | null = null;

  freshBtn.addEventListener('click', () => {
    const code = displayEl.textContent?.trim() ?? '';
    if (!code) return;

    copyToClipboard(code)
      .then(() => {
        freshBtn.textContent = COPIED_LABEL;
        notificationSystem?.success?.('¡Copiado!', 'Código de sala copiado al portapapeles');

        if (resetTimeout) clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => {
          freshBtn.textContent = DEFAULT_LABEL;
          resetTimeout = null;
        }, RESET_DELAY_MS);
      })
      .catch(() => {
        // Sin permiso de portapapeles u otro fallo — no rompemos la
        // UI, el código ya está visible en `displayEl` para copiarlo
        // a mano.
        freshBtn.textContent = DEFAULT_LABEL;
      });
  });

  return freshBtn;
}

/**
 * `navigator.clipboard` requiere contexto seguro (https/localhost) y
 * puede no existir en navegadores viejos o webviews restrictivos — se
 * degrada a `document.execCommand('copy')` sobre un textarea oculto.
 */
async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand copy failed');
  } finally {
    textarea.remove();
  }
}
