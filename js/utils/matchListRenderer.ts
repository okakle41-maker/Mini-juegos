/**
 * js/utils/matchListRenderer.ts
 *
 * Boilerplate compartido por los 4 render*Matches() de
 * views/onlineLobby.logic.ts (ST, SC, Fragmented Labyrinth, lobby 1v1
 * de Simon/Arrow/Termita) — extraído después de comparar los 4 línea
 * por línea. NO todo lo que se veía repetido lo era en verdad: el
 * layout de cada `.lobby-match-item` difiere genuinamente entre juegos
 * (slots numéricos fijos en ST, roles con label largo + selector de
 * rol múltiple en SC, "primer rol libre" en FL, par jugador1/jugador2
 * simple en el lobby 1v1) — forzar eso a una plantilla común habría
 * necesitado tantos parámetros/callbacks de personalización que el
 * resultado habría sido más difícil de leer que las 4 funciones
 * separadas. Eso se queda en cada `render*Matches()`.
 *
 * Lo que SÍ es idéntico en estructura en los 4 y vive acá:
 *
 *   - `renderEmptyState()`: el early-return de "sin partidas todavía"
 *     cuando `matches.length === 0`.
 *   - `wireMatchActions()`: el `querySelectorAll('button[data-action]')`
 *     + `onClickAsyncVoid` + try/catch → `showConfigError` que sigue a
 *     cada `list.innerHTML = matches.map(...)`. Antes, cada una de las
 *     4 funciones repetía este bloque casi carácter por carácter,
 *     variando solo el mapeo acción→función y el id del elemento de
 *     error — un cambio al patrón (p. ej. loguear el error además de
 *     mostrarlo) requería tocar 4 lugares para no dejar 3 actualizados
 *     y 1 desviado, el mismo problema que ya motivó extraer
 *     show/clearConfigError en su momento (ver ese comentario en
 *     onlineLobby.logic.ts).
 */

import { onClickAsyncVoid } from './asyncEventHandler.js';
import { describeMatchError } from './describeMatchError.js';

/**
 * Si `matches.length === 0`, escribe el mensaje de "sin partidas
 * todavía" en `list` y devuelve `true` (el caller debe retornar sin
 * seguir armando la lista). Si hay partidas, no toca `list` y
 * devuelve `false`.
 */
export function renderEmptyState(list: HTMLElement, hasMatches: boolean, emptyMessageHtml: string): boolean {
  if (hasMatches) return false;
  list.innerHTML = emptyMessageHtml;
  return true;
}

export interface MatchActionHandlers {
  /** Elemento `.ol-modal-error` de esta sección, para mostrar el
   *  mensaje si alguna acción falla. */
  errorElId: string;
  /** showError ya conoce cómo pintar errorElId (ver showConfigError en
   *  onlineLobby.logic.ts) — se pasa así en vez de importar
   *  showConfigError acá para no crear una dependencia circular entre
   *  este util y el módulo de la vista. */
  showError: (elId: string, message: string) => void;
  /** Mapea `data-action` → handler async. Recibe el propio `<button>`
   *  clickeado (para leer `data-match-id`/`data-role`/etc. específicos
   *  de cada juego) y corre dentro del try/catch compartido. Acciones
   *  no listadas acá simplemente no hacen nada (mismo comportamiento
   *  que el `if/else if` explícito que reemplaza). */
  actions: Record<string, (btn: HTMLElement) => Promise<void>>;
}

/**
 * Delega los clicks de cada `button[data-action]` dentro de `list` al
 * handler correspondiente en `handlers.actions`, envuelto en el mismo
 * try/catch → describeMatchError → showError que ya tenían las 4
 * funciones. Se llama una vez por cada `list.innerHTML = ...`, igual
 * que antes — sigue re-creando los listeners en cada render porque
 * `innerHTML` ya destruyó los botones (y sus listeners) anteriores.
 */
export function wireMatchActions(list: HTMLElement, handlers: MatchActionHandlers): void {
  list.querySelectorAll<HTMLElement>('button[data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    const handler = action ? handlers.actions[action] : undefined;
    if (!handler) return;

    btn.addEventListener('click', onClickAsyncVoid(async () => {
      try {
        await handler(btn);
      } catch (e) {
        handlers.showError(handlers.errorElId, describeMatchError(e, 'No se pudo completar la acción.'));
      }
    }));
  });
}
