/**
 * js/utils/matchWaitingContext.ts
 *
 * `showView(id)` (ver core/viewManager.ts) no acepta parámetros — solo
 * un string con el id de la sección a mostrar. Este módulo es el canal
 * aparte para decirle a la vista genérica de espera `match-waiting`
 * (ver views/matchWaiting.logic.ts) qué juego debe esperar antes de
 * navegar. Mismo patrón que core/gameRegistry.ts (estado mutable en un
 * singleton de módulo, sin tocar `window`), aplicado a un solo campo.
 *
 * Uso: quien crea/une una sub-partida llama `setPending(gameId)` justo
 * antes de `window.showView?.('match-waiting')`. La vista de espera lee
 * `getPending()` en su `init()` para saber qué adaptador instanciar (ver
 * matchWaitingAdapter.ts) y a qué vista real navegar una vez completo el
 * mínimo de jugadores.
 */

export type PendingGameId = 'simon' | 'arrow' | 'termita' | 'signal_triangulation' | 'ship_control';

interface PendingWait {
  gameId: PendingGameId;
  /**
   * Vista a la que volver si el usuario cancela la espera antes de
   * completarse el mínimo de jugadores — 'multiplayer' para quien creó/
   * unió desde el Lobby Grupal, 'online-lobby' para quien lo hizo desde
   * Lobby Online (ver call sites en views/multiplayer.logic.ts y
   * views/onlineLobby.logic.ts respectivamente).
   */
  returnTo: string;
}

let pending: PendingWait | null = null;

export function setPending(gameId: PendingGameId, returnTo: string): void {
  pending = { gameId, returnTo };
}

export function getPending(): PendingWait | null {
  return pending;
}

/**
 * Se llama al desmontar la vista de espera (tanto si se completó el
 * mínimo de jugadores y se navegó al juego real, como si el usuario la
 * abandonó antes) para no dejar un id viejo pisando la próxima espera.
 */
export function clearPending(): void {
  pending = null;
}
