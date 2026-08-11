/**
 * js/utils/asyncEventHandler.ts
 *
 * `EventTarget.addEventListener` espera un handler que devuelve `void`,
 * pero es muy común querer pasarle una función `async` (o algo que
 * llame a `withButtonBusy`, que también devuelve una promesa) como
 * `() => algoAsync()`. Eso compila sin error en TS con `strict: false`,
 * pero dos cosas quedan sueltas:
 *
 *   1. Si `algoAsync()` rechaza y nadie hizo `.catch()` en ningún punto
 *      de la cadena, el rechazo queda "flotando" — no rompe nada visible
 *      en el momento, pero termina como un unhandledrejection silencioso
 *      en consola, sin ningún mensaje de error útil para el usuario ni
 *      registro real del fallo.
 *   2. La intención ("no me importa esperar esta promesa, el handler ya
 *      maneja sus propios errores/estados internamente") no queda
 *      explícita en el código — cualquiera que lea `() => doStuff()`
 *      no puede saber, sin ir a leer `doStuff`, si eso es un descuido
 *      o algo deliberado.
 *
 * Este helper hace explícita la intención: envuelve el handler async,
 * y si llega a rechazar de una forma que no fue atrapada más adentro,
 * lo deja como error de consola en vez de un rechazo silencioso — así
 * un bug real (ej. una excepción que escapa del try/finally de
 * withButtonBusy) sigue siendo visible en desarrollo/QA aunque no
 * rompa la UI.
 */
export function onClickAsync(
  handler: (event: Event) => Promise<void>
): (event: Event) => void {
  return (event: Event): void => {
    void handler(event).catch((err: unknown) => {
      console.error('[asyncEventHandler] Unhandled error en click handler:', err);
    });
  };
}

/**
 * Igual que `onClickAsync`, pero para el caso, igual de común en este
 * proyecto, en que el handler no usa el `Event` recibido (ej.
 * `withButtonBusy(btn, () => runCreateMatchAction(...))`, donde el
 * evento no hace falta porque `btn` ya viene capturado del closure).
 */
export function onClickAsyncVoid(
  handler: () => Promise<void>
): (event: Event) => void {
  return (): void => {
    void handler().catch((err: unknown) => {
      console.error('[asyncEventHandler] Unhandled error en click handler:', err);
    });
  };
}
