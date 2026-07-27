/**
 * toast.ts — Notificaciones flotantes no bloqueantes, para eventos que
 * el usuario debería poder notar pero que no ameritan interrumpir el
 * flujo del juego con un modal o un alert().
 *
 * Motivación concreta: `globalScores.ts` → `submitScore()` es
 * fire-and-forget a propósito (ver ese archivo) — si Supabase está
 * caído o el usuario perdió la conexión justo al terminar una partida,
 * el guardado LOCAL del récord (leaderboardManager.ts) ya se completó
 * de todas formas, así que no hay ninguna razón para bloquear ni
 * interrumpir al jugador. Pero antes de este archivo, ese fallo era
 * 100% silencioso — solo quedaba un `console.error` que ni el jugador
 * ni nadie iba a ver nunca. Con cuentas de usuario reales, eso deja de
 * ser aceptable: alguien que juega para subir al ranking global
 * necesita enterarse si su score no llegó, para poder reintentarlo
 * (jugar de nuevo, revisar su conexión) en vez de asumir erróneamente
 * que sí quedó guardado.
 *
 * No es un sistema de notificaciones genérico para cualquier cosa —
 * está pensado específicamente para "algo falló en segundo plano, esto
 * es FYI" (variant 'error'/'warning') y confirmaciones breves de éxito
 * (variant 'success'). Para errores que si bloquean el flujo (login
 * fallido, ya se maneja con el mensaje inline en accountView.ts) no se
 * usa esto — un toast que desaparece solo no es el lugar correcto para
 * un error que el usuario necesita resolver antes de continuar.
 */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  variant?: ToastVariant;
  /** ms antes de auto-descartarse. 0 = no se auto-descarta (requiere click). */
  duration?: number;
}

const CONTAINER_ID = 'toastContainer';
const DEFAULT_DURATION = 5000;

function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.setAttribute('role', 'status');
    // aria-live="polite": el lector de pantalla anuncia el toast sin
    // interrumpir lo que el usuario esté haciendo — a diferencia de
    // "assertive", que cortaría cualquier otra lectura en curso. Un
    // toast de "no se guardó tu score" no es tan urgente como para
    // justificar esa interrupción.
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

function iconFor(variant: ToastVariant): string {
  switch (variant) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    case 'info': return 'ℹ';
  }
}

export function showToast(message: string, options: ToastOptions = {}): void {
  const { variant = 'info', duration = DEFAULT_DURATION } = options;
  const container = getOrCreateContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${variant}`;
  toast.innerHTML = `
    <span class="toast-icon">${iconFor(variant)}</span>
    <span class="toast-message"></span>
    <button type="button" class="toast-close" aria-label="Cerrar notificación">×</button>
  `;
  // El mensaje se setea vía textContent, no en el innerHTML de arriba,
  // para no arriesgar interpretar como HTML algo que en el futuro
  // pudiera incluir texto no controlado (p.ej. un username en un
  // mensaje de error). Hoy todos los mensajes son strings fijos
  // definidos en el propio código, pero vale la pena no depender de eso.
  toast.querySelector('.toast-message')!.textContent = message;

  const remove = () => {
    toast.classList.add('toast--leaving');
    // Espera a que termine la transición CSS antes de sacarlo del DOM,
    // para que la animación de salida se vea completa en vez de cortarse.
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-close')!.addEventListener('click', remove);

  container.appendChild(toast);
  // Fuerza un reflow antes de agregar la clase de entrada, para que la
  // transición CSS realmente anime desde el estado inicial en vez de
  // saltar directo al estado final (problema clásico de agregar una
  // clase en el mismo frame en que se crea el elemento).
  void toast.offsetHeight;
  toast.classList.add('toast--visible');

  if (duration > 0) {
    setTimeout(remove, duration);
  }
}

export default { showToast };
