/**
 * js/views/matchWaiting.logic.ts
 *
 * Lógica de la vista genérica de espera "match-waiting" (ver
 * matchWaiting.ts para el template). Lee de utils/matchWaitingContext.ts
 * qué juego está esperando (seteado por quien crea/une la sub-partida en
 * views/multiplayer.logic.ts u views/onlineLobby.logic.ts justo antes de
 * navegar acá), instancia el adaptador correspondiente (ver
 * utils/matchWaitingAdapter.ts) y escucha sus cambios de conteo hasta
 * alcanzar `GameConfig.playersRequired` — recién ahí navega a la vista
 * real del juego.
 *
 * Vista de sistema (no juego jugable): registrada en GameRegistry como
 * `hidden: true` vía registerSystemViews.ts, con su HTML inyectado acá
 * mismo en init() — igual que logros/progresion/multiplayer/online-
 * lobby/etc. NO tiene entrada en core/viewTemplates.ts (ese registro es
 * solo para juegos reales con `<section data-lazy>`; una vista de
 * sistema con ambas cosas a la vez deja el contenedor vacío para
 * siempre tras la primera salida — ver el mismo bug ya corregido una
 * vez, documentado en test/gameRegistry.test.ts).
 */

import GameRegistry from '../core/gameRegistry.js';
import { getMatchWaitingAdapter, type MatchWaitingAdapter } from '../utils/matchWaitingAdapter.js';
import { getPending, clearPending } from '../utils/matchWaitingContext.js';
import { watchConnection, type ConnectionWatcherHandle } from '../utils/connectionWatcher.js';
import template from './matchWaiting.js';

const GAME_LABELS: Record<string, { icon: string; name: string }> = {
  simon: { icon: '🧠', name: 'Simon Dice' },
  arrow: { icon: '🏹', name: 'Desafío Flechas' },
  termita: { icon: '🐜', name: 'Termita' },
  signal_triangulation: { icon: '📡', name: 'Signal Triangulation' },
  ship_control: { icon: '🚀', name: 'Centro de Control' },
  fragmented_labyrinth: { icon: '🌀', name: 'Fragmented Labyrinth' }
};

let activeAdapter: MatchWaitingAdapter | null = null;
let unsubscribe: (() => void) | null = null;
let leaveBtnHandler: (() => void) | null = null;
/**
 * Timer de "llevás X esperando" (ver renderElapsed más abajo) y de aviso
 * de timeout — a diferencia del timeout de 10s de Letters Fall
 * (connectAndWait en lettersFall.logic.ts), que solo cubre la conexión
 * inicial a la sala, esto cubre la espera del SEGUNDO jugador, que antes
 * no tenía ningún límite ni feedback: el jugador que crea la partida se
 * quedaba mirando "1 / 2 jugadores" indefinidamente si nadie se unía, sin
 * saber si su conexión funcionaba o si simplemente no había venido nadie.
 * No auto-cancela la espera (el rival todavía podría aparecer) — solo
 * hace más visible la opción de cancelar y aclara que puede haber pasado
 * algo raro.
 */
let elapsedIntervalId: ReturnType<typeof setInterval> | null = null;
let waitStartedAt = 0;
let timeoutWarningShown = false;
let connectionWatcherHandle: ConnectionWatcherHandle | null = null;

const WAIT_WARNING_MS = 60_000; // 1 minuto sin el segundo jugador

/**
 * true si la salida de esta vista ya fue manejada explícitamente (botón
 * "Salir" -> adapter.leave(), o la espera se completó y se avanzó al
 * juego real vía proceedToGame) — en ambos casos stop() no debe volver
 * a llamar adapter.leave(). Sin este flag, stop() no tenía forma de
 * distinguir "el jugador está por entrar a jugar, la partida sigue
 * viva" de "el jugador navegó afuera sin usar el botón Salir (sidebar,
 * back del navegador, cualquier showView() directo)" — este segundo
 * caso dejaba la sub-partida huérfana en el servidor (status 'waiting'
 * para siempre) y lobbySystem/ST/SC.currentMatch apuntando a ella en el
 * cliente, así que la próxima vez que ese jugador entraba al mismo
 * juego en modo SOLO, isMultiplayer daba true por error (ver
 * simon.logic.ts/termita.logic.ts/arrowGame.logic.ts: todos leen
 * getCurrentMatch() al iniciar) y quedaba esperando un rival que nunca
 * iba a llegar.
 */
let exitHandled = false;

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function renderCount(current: number, required: number): void {
  const label = el('mwCountLabel');
  if (label) label.textContent = `${current} / ${required} jugadores`;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `Llevás ${seconds}s esperando`;
  return `Llevás ${minutes} min ${seconds.toString().padStart(2, '0')}s esperando`;
}

function renderElapsed(): void {
  const elapsedEl = el('mwElapsed');
  const elapsedMs = Date.now() - waitStartedAt;
  if (elapsedEl) elapsedEl.textContent = formatElapsed(elapsedMs);

  if (!timeoutWarningShown && elapsedMs >= WAIT_WARNING_MS) {
    timeoutWarningShown = true;
    el('mwTimeoutWarning')?.classList.remove('hidden');
    el('mwLeaveBtn')?.classList.add('mw-leave-urgent');
  }
}

function startElapsedTimer(): void {
  waitStartedAt = Date.now();
  timeoutWarningShown = false;
  el('mwTimeoutWarning')?.classList.add('hidden');
  renderElapsed();
  elapsedIntervalId = setInterval(renderElapsed, 1000);
}

function stopElapsedTimer(): void {
  if (elapsedIntervalId !== null) {
    clearInterval(elapsedIntervalId);
    elapsedIntervalId = null;
  }
}

function showError(message: string): void {
  const errorEl = el('mwError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

export function init(): void {
  const container = document.getElementById('match-waiting');
  if (!container) return;

  container.innerHTML = template();
  exitHandled = false;

  const pending = getPending();
  if (!pending || !pending.gameId) {
    // Se llegó a esta vista sin pasar por setPending (navegación directa,
    // recarga de página, etc.) — no hay nada que esperar. Volver al
    // lobby es más seguro que quedar en una vista sin estado válido.
    //
    // El chequeo de !pending.gameId (además de !pending) cubre un caso
    // real visto en producción: getPending() devuelve un objeto no-null
    // pero con gameId null/undefined en tiempo de ejecución pese al tipo
    // PendingGameId no-nullable — getMatchWaitingAdapter() (ver
    // utils/matchWaitingAdapter.ts) tira una excepción sin catch en ese
    // caso, y como eso pasa DENTRO de init(), GameRegistry.ensureInit()
    // (ver core/gameRegistry.ts) atrapa el error pero nunca llega a
    // this.initialized.add('match-waiting') — la vista queda rota para
    // siempre: cada intento posterior de entrar a CUALQUIER minijuego
    // que pase por acá vuelve a ejecutar este init() desde cero y vuelve
    // a tirar el mismo error. Clonamos pending.gameId a una constante
    // ahora para que TypeScript lo siga tratando como no-nullable en el
    // resto de esta función tras el guard.
    clearPending();
    showError('No hay ninguna partida en espera.');
    window.showView?.('online-lobby');
    return;
  }

  const { gameId, returnTo } = pending;
  const game = GameRegistry.get(gameId);
  const required = game?.playersRequired ?? 2;
  const labels = GAME_LABELS[gameId] ?? { icon: '🎮', name: gameId };

  const icon = el('mwIcon');
  const title = el('mwTitle');
  if (icon) icon.textContent = labels.icon;
  if (title) title.textContent = `Esperando jugadores — ${labels.name}`;

  const adapter = getMatchWaitingAdapter(gameId);
  activeAdapter = adapter;

  const currentCount = adapter.getCurrentCount();
  renderCount(currentCount, required);

  // Ya está completo al montarse (p. ej. el jugador que se UNE como
  // último cupo, a diferencia de quien CREA y queda esperando): no tiene
  // sentido mostrar el overlay, se navega directo.
  if (currentCount >= required) {
    proceedToGame(gameId);
    return;
  }

  unsubscribe = adapter.onCountChanged((count) => {
    renderCount(count, required);
    if (count >= required) {
      proceedToGame(gameId);
    }
  });

  startElapsedTimer();
  connectionWatcherHandle = watchConnection();

  leaveBtnHandler = () => {
    exitHandled = true;
    void adapter.leave();
    clearPending();
    window.showView?.(returnTo);
  };
  el('mwLeaveBtn')?.addEventListener('click', leaveBtnHandler);
}

function proceedToGame(gameId: string): void {
  exitHandled = true;
  stopElapsedTimer();
  connectionWatcherHandle?.cleanup();
  connectionWatcherHandle = null;
  clearPending();
  window.showView?.(gameId);
}

export function stop(): void {
  unsubscribe?.();
  unsubscribe = null;
  stopElapsedTimer();
  connectionWatcherHandle?.cleanup();
  connectionWatcherHandle = null;

  // Salida "silenciosa": el jugador navegó afuera de esta vista sin
  // pasar por el botón Salir ni por completar la espera (proceedToGame)
  // — sidebar, back del navegador, cualquier window.showView?.(...)
  // directo. Sin esto, la sub-partida quedaba huérfana — ver comentario
  // en la declaración de `exitHandled` más arriba.
  if (!exitHandled && activeAdapter) {
    void activeAdapter.leave();
  }
  exitHandled = false;
  activeAdapter = null;

  const btn = el('mwLeaveBtn');
  if (btn && leaveBtnHandler) btn.removeEventListener('click', leaveBtnHandler);
  leaveBtnHandler = null;

  const container = document.getElementById('match-waiting');
  if (container) container.innerHTML = '';
}
