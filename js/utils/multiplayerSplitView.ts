/**
 * js/utils/multiplayerSplitView.ts
 *
 * Mecanismo compartido para que un juego (con `logic.ts` de la forma
 * simon/arrowGame/termita) muestre, cuando hay una sub-partida activa
 * dentro de un lobby (ver js/lobbySystem.ts), un panel de "split screen"
 * con el propio tablero a un lado y una copia de solo lectura del tablero
 * del rival al otro — sincronizada en vivo transmitiendo eventos de juego
 * por `lobbySystem.sendGameEvent`.
 *
 * Nota histórica: Simon/Arrow/Termita jugaban antes 1v1 sueltos por
 * código de sala directo sobre MultiplayerSystem
 * (createRoomMatch/joinRoomMatch, live_matches). Eso se reemplazó por el
 * sistema de lobbies (hasta 8 jugadores, sub-partidas 1v1 dentro del
 * lobby, con spectating) — este helper ahora lee de `lobbySystem`, no de
 * `multiplayerSystem`. MultiplayerSystem sigue existiendo tal cual para
 * Letters Fall (coop asimétrico 1v1 sin lobby, otro caso de uso
 * distinto), pero ya no es la fuente para estos tres juegos.
 *
 * No aplica al modo coop asimétrico de Letters Fall (roles viewer/typer,
 * donde ambos jugadores YA ven cosas distintas por diseño) — está pensado
 * para juegos donde dos jugadores compiten en paralelo con el mismo
 * tablero (Simon, Arrow, Termita), donde antes cada uno solo veía el
 * suyo sin ninguna noción de cómo le iba al otro. También soporta un
 * tercer rol, espectador: alguien que no es player1Id ni player2Id de la
 * sub-partida ve ambos lados en modo 100% solo-lectura (ver
 * isSpectating más abajo).
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
 *      `{ isMultiplayer, isSpectating, sendEvent, onRivalEvent, remirror, cleanup }`
 *      — `sendEvent(type, payload)` es un no-op si no hay match activo o
 *      si se está especteando (un espectador no transmite nada, solo
 *      recibe), así que los puntos de emisión del juego pueden llamarlo
 *      siempre sin ramificar en cada sitio.
 *   4. Registrar los handlers de recepción con `onRivalEvent(type, fn)`
 *      para reconstruir cada acción visual sobre el tablero rival.
 *   5. Llamar a la función de limpieza devuelta al hacer `stop()`.
 */

import { lobbySystem } from '../lobbySystem.js';
import type { GameUi } from '../types/game.js';
import { watchConnection } from './connectionWatcher.js';

export interface SplitViewHandle {
  /** true si hay una sub-partida activa de este juego (jugando o especteando). */
  isMultiplayer: boolean;
  /**
   * true si quien mira la pantalla no es ninguno de los dos jugadores de
   * la sub-partida — está especteando. En ese caso el propio tablero
   * ("Vos") también debe tratarse como solo-lectura del lado de quien lo
   * usa: cada juego consulta este flag para decidir si sus propios
   * controles (click en botones/celdas) deben ignorarse.
   */
  isSpectating: boolean;
  /**
   * true si quien mira la pantalla es player1Id de la sub-partida —
   * quien la creó (ver lobbySystem.createMatch, siempre asigna
   * player1Id al creador). Solo tiene sentido cuando isMultiplayer es
   * true; en modo solo-jugador vale `false` pero no se usa (cada juego
   * solo debe ramificar sobre esto si isMultiplayer también es true).
   *
   * Se usa para restringir el botón "Empezar" al anfitrión: el rival no
   * arranca por su cuenta, solo reacciona a `onStart` cuando el
   * anfitrión efectivamente empieza (ver broadcastStart/onStart).
   */
  isHost: boolean;
  /**
   * Transmite un evento de juego al rival. No-op silencioso si no hay
   * match activo o si se está especteando — los puntos de emisión del
   * juego pueden llamarlo incondicionalmente sin chequear nada en cada
   * uno.
   */
  sendEvent: (type: string, payload: unknown) => void;
  /**
   * Registra un handler para un tipo de evento recibido del rival.
   * Varios handlers para el mismo `type` se acumulan (todos se llaman).
   */
  onRivalEvent: (type: string, handler: (payload: any) => void) => void;
  /**
   * Solo debe llamarlo el anfitrión (isHost === true), justo antes/al
   * arrancar su propia partida local. Avisa al rival, vía el mismo
   * canal de eventos de juego, que el anfitrión acaba de empezar — el
   * rival reacciona con `onStart` para arrancar la suya en el mismo
   * instante. No transmite ninguna semilla/secuencia: cada lado sigue
   * generando su propio desafío en el cliente (alcance acordado:
   * arranque sincronizado, contenido independiente — ver nota en
   * termita.logic.ts si en el futuro se decide sincronizar también el
   * contenido). No-op si no es multiplayer o si no es host.
   */
  broadcastStart: () => void;
  /**
   * Solo tiene efecto para el no-host (isHost === false): registra el
   * handler que arranca la partida local del rival apenas llega el
   * `broadcastStart()` del anfitrión. El propio juego sigue siendo
   * responsable de deshabilitar/ocultar el botón "Empezar" para el
   * no-host (evitando que dispare su arranque por su cuenta) — este
   * helper solo cablea la señal de red, no toca la UI del botón.
   */
  onStart: (handler: () => void) => void;
  /**
   * Registra un handler que se dispara una sola vez cuando el rival
   * abandona la partida a mitad de juego (status pasa a 'abandoned' vía
   * `lobby:matches_changed` — ver
   * lobbySystem.handleMatchUpdate/leaveCurrentMatch). No dispara nada si
   * la partida ya había terminado por otra vía (completed) ni si no es
   * multiplayer/se está especteando (un espectador no tiene "rival"
   * propio al cual reaccionar así; ver nota en setupSplitView). El
   * propio juego decide qué mostrar (mensaje + botón "volver al
   * lobby") — este helper solo detecta y avisa una vez.
   */
  onOpponentLeft: (handler: () => void) => void;
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
 * @param gameId id del juego (debe coincidir con `activeMatch.gameId` de
 *   `lobbySystem.getCurrentMatch()`).
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
 * que yo también arranque. Para un espectador que entra después de que
 * ambos jugadores ya armaron su tablero, este límite no aplica: recibe
 * el estado ya poblado en cuanto ambos lados vuelvan a emitir un evento
 * (p.ej. el próximo flash/light), aunque no ve el estado previo a que
 * él empezara a mirar — es una limitación aceptada del modelo actual
 * (sin snapshot del tablero al conectar, solo eventos incrementales
 * desde que se empieza a escuchar).
 */
export function setupSplitView(
  gameId: string,
  ui: GameUi,
  prefix: string,
  ownBoard?: HTMLElement
): SplitViewHandle {
  const activeMatch = lobbySystem.getCurrentMatch();
  const isMultiplayer = activeMatch?.gameId === gameId;
  const myId = lobbySystem.currentPlayerId();
  const isSpectating = isMultiplayer
    && activeMatch!.player1Id !== myId
    && activeMatch!.player2Id !== myId;
  // player1Id siempre es quien creó la sub-partida — ver
  // lobbySystem.createMatch(). Un espectador nunca es host (no juega
  // ningún lado), aunque la comparación de ids ya lo excluye por sí sola.
  const isHost = isMultiplayer && activeMatch!.player1Id === myId;

  const splitEl = ui[`${prefix}Split`] as HTMLElement | undefined;
  const rivalEl = ui[`${prefix}Rival`] as HTMLElement | undefined;
  // Lado "Vos": vive DENTRO de splitEl (mismo contenedor grid que el
  // rival, ver css/simon.css y css/termita.css) para que ambos queden
  // como columnas de un mismo `.{prefix}-split { display:grid;
  // grid-template-columns: 1fr 1fr }`. Antes `ownBoard` estaba fuera de
  // splitEl como un `.{prefix}-split-side` suelto — el grid de 2
  // columnas terminaba con un solo hijo real (el rival), dejando el
  // propio tablero apilado arriba a ancho completo y un hueco vacío al
  // lado del rival en vez de un split simétrico. Ambos son opcionales:
  // Arrow usa un panel resumen en vez de este patrón (ver `ownBoard`
  // en el comentario de función) y no tiene ninguno de los dos.
  const rivalLabelEl = ui[`${prefix}RivalLabel`] as HTMLElement | undefined;
  const ownLabelEl = ui[`${prefix}OwnLabel`] as HTMLElement | undefined;

  const remirror = () => {
    if (isMultiplayer && rivalEl && ownBoard) {
      mirrorBoard(ownBoard, rivalEl);
    }
  };

  if (splitEl) {
    // El grid en sí queda siempre visible (nunca `.hidden`, salvo el
    // estado inicial del template antes de este init()): el modo
    // solo-jugador se distingue con `.{prefix}-split--solo` (colapsa a
    // 1 columna vía CSS, ver css/simon.css y css/termita.css), no
    // ocultando el grid entero — así el propio tablero nunca salta de
    // "dentro del grid" a "fuera del grid" según el modo, evitando el
    // bug donde quedaba apilado arriba a ancho completo con un hueco
    // vacío al lado del rival (grid de 2 columnas con un solo hijo real).
    splitEl.classList.remove('hidden');
    splitEl.classList.toggle(`${prefix}-split--solo`, !isMultiplayer);
    const rivalSideEl = rivalLabelEl?.closest<HTMLElement>('.simon-split-side, .termita-split-side');
    rivalSideEl?.classList.toggle('hidden', !isMultiplayer);
    ownLabelEl?.classList.toggle('hidden', !isMultiplayer);
    // No se re-espeja acá todavía: al llamar setupSplitView() en init(),
    // el juego típicamente no construyó su tablero real hasta que se
    // presiona "Empezar" (setupSimonBoard/setupGrid). El propio juego
    // debe llamar a `remirror()` justo después de construir su tablero,
    // cada vez que lo reconstruye.
  }

  const handlers = new Map<string, Array<(payload: any) => void>>();

  const START_EVENT_TYPE = '__match_start__';
  const startHandlers: Array<() => void> = [];

  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail as { type: string; payload: unknown } | undefined;
    if (!detail) return;
    if (detail.type === START_EVENT_TYPE) {
      // Reservado para la señal de arranque del anfitrión — no pasa por
      // el mapa `handlers` de onRivalEvent (que es de uso libre para
      // cada juego) para que ningún juego pueda registrar por
      // accidente un evento con este mismo nombre y pisarlo.
      startHandlers.forEach((fn) => fn());
      return;
    }
    const fns = handlers.get(detail.type);
    if (!fns) return;
    fns.forEach((fn) => fn(detail.payload));
  };

  if (isMultiplayer) {
    window.addEventListener('multiplayer:game_event', listener);
  }

  // Detección de abandono del rival a mitad de partida — ver
  // onOpponentLeft más arriba. Escucha lobby:matches_changed (despachado
  // por lobbySystem.handleMatchUpdate en cada UPDATE realtime de
  // lobby_matches) en vez de sc:match_changed/st:match_changed propios
  // de cada juego, porque este helper es compartido entre Simon/Arrow/
  // Termita y todos comparten el mismo canal de lobby 1v1. matchId se
  // captura acá (no se lee this.currentMatch.id de nuevo más tarde)
  // porque, tras el abandono, otros flujos (leaveCurrentMatch propio)
  // podrían limpiar currentMatch antes de que este listener corra.
  const opponentLeftHandlers: Array<() => void> = [];
  let opponentLeftFired = false;
  const matchId = activeMatch?.id;
  const matchesChangedListener = () => {
    if (opponentLeftFired || !isMultiplayer || isSpectating || !matchId) return;
    const current = lobbySystem.getCurrentMatch();
    if (!current || current.id !== matchId) return;
    if (current.status === 'abandoned') {
      opponentLeftFired = true;
      opponentLeftHandlers.forEach((fn) => fn());
    }
  };
  if (isMultiplayer && !isSpectating) {
    window.addEventListener('lobby:matches_changed', matchesChangedListener);
  }

  // Aviso proactivo de pérdida de conexión (ver utils/connectionWatcher.ts)
  // — solo mientras hay una sub-partida activa; en modo solo-jugador o
  // especteando no aplica (especteando no depende de la propia red para
  // que el rival te vea, y en solo no hay nadie del otro lado a quien
  // preocuparle un corte).
  const connectionWatcher = isMultiplayer && !isSpectating ? watchConnection() : null;

  return {
    isMultiplayer,
    isSpectating,
    isHost,
    sendEvent: (type, payload) => {
      if (!isMultiplayer || isSpectating) return;
      void lobbySystem.sendGameEvent(type, payload);
    },
    onRivalEvent: (type, handler) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
    },
    broadcastStart: () => {
      if (!isMultiplayer || !isHost) return;
      void lobbySystem.sendGameEvent(START_EVENT_TYPE, {});
    },
    onStart: (handler) => {
      startHandlers.push(handler);
    },
    onOpponentLeft: (handler) => {
      opponentLeftHandlers.push(handler);
    },
    remirror,
    cleanup: () => {
      if (isMultiplayer) {
        window.removeEventListener('multiplayer:game_event', listener);
      }
      if (isMultiplayer && !isSpectating) {
        window.removeEventListener('lobby:matches_changed', matchesChangedListener);
      }
      connectionWatcher?.cleanup();
      handlers.clear();
      startHandlers.length = 0;
      opponentLeftHandlers.length = 0;
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
