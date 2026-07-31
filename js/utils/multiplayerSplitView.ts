/**
 * js/utils/multiplayerSplitView.ts
 *
 * Mecanismo compartido para que un juego (con `logic.ts` de la forma
 * simon/arrowGame/termita) muestre, cuando hay una sala activa
 * (`createRoomMatch`/`joinRoomMatch`, ver multiplayerSystem.ts), un panel
 * de "split screen" con el propio tablero a un lado y una copia de solo
 * lectura del tablero del rival al otro — sincronizada en vivo transmitiendo
 * eventos de juego por `multiplayerSystem.sendGameEvent`.
 *
 * No aplica al modo coop asimétrico de Letters Fall (roles viewer/typer,
 * donde ambos jugadores YA ven cosas distintas por diseño) — está pensado
 * para juegos donde ambos jugadores compiten en paralelo con el mismo
 * tablero (Simon, Arrow, Termita), donde antes cada uno solo veía el
 * suyo sin ninguna noción de cómo le iba al otro.
 *
 * Contrato que cada juego debe cumplir para integrarse:
 *   1. Agregar en su template (`js/views/<juego>.ts`) un contenedor
 *      `data-ui="<prefix>Split"` con `class="hidden"`, envolviendo el
 *      markup existente del tablero — ver simon.ts/arrow.ts/termita.ts
 *      para el patrón exacto.
 *   2. Dentro de ese split, un `data-ui="<prefix>Rival"` vacío: el
 *      "tablero espejo" donde este helper clona el markup del tablero
 *      propio para que el CSS existente (no scoped a un id, o scoped a
 *      la sección de la vista) se aplique gratis.
 *   3. Llamar a `setupSplitView(...)` en `init()`, que devuelve
 *      `{ isMultiplayer, sendEvent }` — `sendEvent(type, payload)` es un
 *      no-op si no hay match activo, así que los puntos de emisión del
 *      juego (flashear un botón, marcar una celda) pueden llamarlo
 *      siempre sin ramificar con `if (isMultiplayer)` en cada sitio.
 *   4. Registrar los handlers de recepción con `onRivalEvent(type, fn)`
 *      para reconstruir cada acción visual sobre el tablero rival.
 *   5. Llamar a la función de limpieza devuelta al hacer `stop()`.
 */

import { multiplayerSystem } from '../multiplayerSystem.js';
import type { GameUi } from '../types/game.js';

export interface SplitViewHandle {
  /** true si hay una sala activa para este juego (currentMatch.gameId coincide). */
  isMultiplayer: boolean;
  /**
   * Transmite un evento de juego al rival. No-op silencioso si no hay
   * match activo — los puntos de emisión del juego pueden llamarlo
   * incondicionalmente sin chequear isMultiplayer en cada uno.
   */
  sendEvent: (type: string, payload: unknown) => void;
  /**
   * Registra un handler para un tipo de evento recibido del rival.
   * Varios handlers para el mismo `type` se acumulan (todos se llaman).
   */
  onRivalEvent: (type: string, handler: (payload: any) => void) => void;
  /**
   * Reclona el markup del tablero propio dentro del contenedor rival.
   * Llamar cada vez que el juego reconstruye su tablero desde cero
   * (p.ej. setupSimonBoard/setupGrid al presionar "Empezar" con una
   * dificultad distinta a la anterior) — no solo una vez en init(),
   * porque el markup real (cantidad de botones/celdas) puede cambiar
   * entre partidas. No-op si no es multiplayer.
   */
  remirror: () => void;
  /** Quita el listener de `multiplayer:game_event` — llamar en stop(). */
  cleanup: () => void;
}

/**
 * Clona el tablero propio (ya armado por el juego con su innerHTML/hijos
 * reales) dentro del contenedor rival, para heredar el CSS existente sin
 * necesidad de que cada juego arme el markup del espejo a mano. Se llama
 * una sola vez, después de que el juego terminó de construir su propio
 * tablero (setupGrid/setupSimonBoard), con la salvedad de que el rival
 * necesita sus propios `id`s únicos si el markup clonado los trae (los
 * juegos actuales no usan `id` en las celdas/botones, solo `data-index`/
 * `data-color`, así que un clon directo no colisiona).
 */
function mirrorBoard(sourceBoard: HTMLElement, rivalContainer: HTMLElement): void {
  rivalContainer.innerHTML = sourceBoard.innerHTML;
  // El tablero espejo es de solo lectura: sin listeners de click/keydown
  // (el innerHTML clona el markup pero no los listeners de JS, así que
  // esto ya es cierto por construcción — se deja explícito el disabled
  // en botones para que tampoco reciba foco/interacción por teclado).
  rivalContainer.querySelectorAll('button').forEach((btn) => {
    (btn as HTMLButtonElement).disabled = true;
    btn.tabIndex = -1;
  });
  rivalContainer.querySelectorAll('[tabindex]').forEach((el) => {
    el.setAttribute('tabindex', '-1');
  });
}

/**
 * @param gameId id del juego (debe coincidir con `activeMatch.gameId`,
 *   ver readRoomSettings en multiplayer.logic.ts).
 * @param ui GameUi ya resuelto por `resolveUi` — se espera
 *   `ui[`${prefix}Split`]` (opcional: algunos juegos, como Arrow, usan
 *   un panel de resumen en vez de un split de dos columnas y no tienen
 *   este contenedor).
 * @param prefix prefijo de las claves data-ui del split (p.ej. 'simon' →
 *   `simonSplit`/`simonRival`).
 * @param ownBoard el elemento del tablero propio ya construido, para
 *   clonarlo dentro del contenedor rival la primera vez — opcional:
 *   solo hace falta si el juego usa `remirror()` (tablero espejo
 *   completo, como Simon/Termita). Los juegos con panel resumen (Arrow)
 *   pueden omitirlo y actualizar su panel a mano vía `onRivalEvent`.
 *
 * Limitación conocida: el tablero rival (para los juegos que usan
 * `remirror`, no el panel resumen de Arrow) solo tiene contenido una vez
 * que EL PROPIO jugador construyó su tablero al menos una vez (presionar
 * "Empezar" llama a setupSimonBoard/setupGrid, que llama remirror()) —
 * no apenas el rival empieza su partida. Si el rival arranca primero y
 * yo todavía no presioné "Empezar", su lado del split queda vacío hasta
 * que yo también arranque. Solucionarlo de raíz (mostrar el tablero
 * rival apenas se sabe su tamaño/config, sin depender de que el propio
 * ya exista) requeriría que la sala transmitiera también la estructura
 * del tablero por separado del primer evento de juego — se deja así por
 * ahora porque ambos jugadores comparten el mismo `roomSettings`
 * (tamaño de grilla/cantidad de colores ya fijados por quien creó la
 * sala), así que en la práctica ambos arrancan casi al mismo tiempo tras
 * `onRoomUpdate` navegarlos al juego.
 */
export function setupSplitView(
  gameId: string,
  ui: GameUi,
  prefix: string,
  ownBoard?: HTMLElement
): SplitViewHandle {
  const activeMatch = multiplayerSystem.getCurrentMatch();
  const isMultiplayer = activeMatch?.gameId === gameId;

  const splitEl = ui[`${prefix}Split`] as HTMLElement | undefined;
  const rivalEl = ui[`${prefix}Rival`] as HTMLElement | undefined;

  const remirror = () => {
    if (isMultiplayer && rivalEl && ownBoard) {
      mirrorBoard(ownBoard, rivalEl);
    }
  };

  if (isMultiplayer && splitEl) {
    splitEl.classList.remove('hidden');
    // No se re-espeja acá todavía: al llamar setupSplitView() en init(),
    // el juego típicamente no construyó su tablero real hasta que se
    // presiona "Empezar" (setupSimonBoard/setupGrid). El propio juego
    // debe llamar a `remirror()` justo después de construir su tablero,
    // cada vez que lo reconstruye.
  } else if (splitEl) {
    splitEl.classList.add('hidden');
  }

  const handlers = new Map<string, Array<(payload: any) => void>>();

  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as { type: string; payload: unknown } | undefined;
    if (!detail) return;
    const fns = handlers.get(detail.type);
    if (!fns) return;
    fns.forEach((fn) => fn(detail.payload));
  };

  if (isMultiplayer) {
    window.addEventListener('multiplayer:game_event', listener);
  }

  return {
    isMultiplayer,
    sendEvent: (type, payload) => {
      if (!isMultiplayer) return;
      void multiplayerSystem.sendGameEvent(type, payload);
    },
    onRivalEvent: (type, handler) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
    },
    remirror,
    cleanup: () => {
      if (isMultiplayer) {
        window.removeEventListener('multiplayer:game_event', listener);
      }
      handlers.clear();
    }
  };
}

/**
 * Helper de bajo nivel para reconstruir sobre el tablero rival la misma
 * transición de clases CSS que se aplicó en el propio (p.ej. agregar
 * '.active' a un botón, o '.lit'/'.selected' a una celda), buscando el
 * elemento equivalente por un atributo `data-*` compartido entre ambos
 * tableros (mirrorBoard clona el markup, así que los `data-color`/
 * `data-index` coinciden 1:1 entre el propio y el rival).
 */
export function findRivalElement(
  rivalEl: HTMLElement,
  attr: string,
  value: string
): HTMLElement | null {
  return rivalEl.querySelector<HTMLElement>(`[${attr}="${value}"]`);
}
