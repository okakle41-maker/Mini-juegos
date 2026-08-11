/**
 * devLog.ts — Trazas informativas de arranque/ciclo de vida, con gating
 * por modo (solo imprimen en dev).
 *
 * Distinto de ErrorLogger (errorLogger.ts): ErrorLogger existe para
 * *errores* reales — se buffean en memoria y tienen un `sink` configurable
 * para poder mandarlos a un backend algún día, porque son señal útil
 * incluso en producción (ayudan a diagnosticar problemas de usuarios
 * reales). Las trazas de acá ("[GameRegistry] Registrado: X",
 * "[ViewManager] Vista mostrada: X") no son señal de nada — son ruido de
 * debug que solo importa mientras se está desarrollando, y no tiene
 * sentido que un usuario final vea 26+ líneas de esto en su consola en
 * cada carga de la app.
 *
 * `import.meta.env.DEV` lo resuelve Vite en build time: en `vite build`
 * (producción) la condición se vuelve `if (false)` y el bundler elimina
 * el código muerto resultante — no es un chequeo en runtime que haya que
 * pagar en cada llamada, el log ni siquiera queda en el bundle final.
 */

export function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- wrapper autorizado de console.log para trazas de dev, ver comentario del archivo
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
}
