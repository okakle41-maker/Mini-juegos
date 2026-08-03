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
import template from './matchWaiting.js';

const GAME_LABELS: Record<string, { icon: string; name: string }> = {
  simon: { icon: '🧠', name: 'Simon Dice' },
  arrow: { icon: '🏹', name: 'Desafío Flechas' },
  termita: { icon: '🐜', name: 'Termita' },
  signal_triangulation: { icon: '📡', name: 'Signal Triangulation' },
  ship_control: { icon: '🚀', name: 'Centro de Control' }
};

let activeAdapter: MatchWaitingAdapter | null = null;
let unsubscribe: (() => void) | null = null;
let leaveBtnHandler: (() => void) | null = null;

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function renderCount(current: number, required: number): void {
  const label = el('mwCountLabel');
  if (label) label.textContent = `${current} / ${required} jugadores`;
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

  const pending = getPending();
  if (!pending) {
    // Se llegó a esta vista sin pasar por setPending (navegación directa,
    // recarga de página, etc.) — no hay nada que esperar. Volver al
    // lobby es más seguro que quedar en una vista sin estado válido.
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

  leaveBtnHandler = () => {
    void adapter.leave();
    clearPending();
    window.showView?.(returnTo);
  };
  el('mwLeaveBtn')?.addEventListener('click', leaveBtnHandler);
}

function proceedToGame(gameId: string): void {
  clearPending();
  window.showView?.(gameId);
}

export function stop(): void {
  unsubscribe?.();
  unsubscribe = null;
  activeAdapter = null;

  const btn = el('mwLeaveBtn');
  if (btn && leaveBtnHandler) btn.removeEventListener('click', leaveBtnHandler);
  leaveBtnHandler = null;

  const container = document.getElementById('match-waiting');
  if (container) container.innerHTML = '';
}
