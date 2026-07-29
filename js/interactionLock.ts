/**
 * interactionLock.ts — Desactiva el menú contextual nativo del
 * navegador (click derecho).
 *
 * El resto de las "características" del mouse que se pidió
 * desactivar (arrastrar para seleccionar texto, doble click para
 * seleccionar palabra) se resuelven con CSS puro — ver la regla
 * `user-select: none` en css/styles.css, que ya excluye los campos
 * de entrada (input/textarea/[contenteditable]) para no romper la
 * posibilidad de seleccionar y copiar lo que el usuario escribe
 * ahí. El menú contextual, en cambio, CSS no puede evitarlo: solo
 * `event.preventDefault()` sobre el evento `contextmenu` lo bloquea.
 *
 * Los mismos campos de entrada quedan exceptuados aquí también,
 * por consistencia: en un input/textarea/contenteditable el click
 * derecho (cortar/copiar/pegar) sigue funcionando normalmente.
 */

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

function init(): void {
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
  });
}

init();

export default { init };
