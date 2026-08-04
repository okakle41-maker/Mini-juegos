/**
 * js/games/fragmentedLabyrinth.logic.ts
 *
 * Lógica pesada de "Fragmented Labyrinth" — cargada lazy vía
 * GameConfig.logic (ver games/fragmentedLabyrinth.ts) solo cuando el
 * usuario abre la vista.
 *
 * Responsabilidades de este módulo:
 *   - Pintar el cuadrante PROPIO (nunca el laberinto completo) en SVG,
 *     a partir de fragmentedLabyrinthSystem.getLastView()/refreshMyView().
 *   - Manejar controles de movimiento (teclado, solo habilitado para
 *     rol A — B/C/D solo observan y coordinan por voz externa).
 *   - Reaccionar a fl:match_changed / fl:view_changed para transicionar
 *     entre pantalla de espera y pantalla de juego, y para redibujar el
 *     cuadrante en cada movimiento (propio o del resto del equipo).
 *
 * Lo que este módulo NUNCA hace: leer el laberinto completo ni la
 * posición del personaje fuera del propio cuadrante — toda esa
 * información vive exclusivamente server-side (ver
 * migration_018_fragmented_labyrinth.sql, get_my_labyrinth_view).
 */

import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import GameHelpers from '../utils/gameHelpers.js';
import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';
import {
  fragmentedLabyrinthSystem,
  ROLE_DESCRIPTIONS,
  type FLRole,
  type FLMatch,
  type FLView,
  type FLDirection
} from '../fragmentedLabyrinthSystem.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CELL_SIZE = 22;

const KEY_MAP: Record<string, FLDirection> = {
  arrowup: 'up', w: 'up',
  arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left',
  arrowright: 'right', d: 'right'
};

interface FLGameInstance {
  stop: () => void;
}

export function init(ui: GameUi) {
  const loginRequiredEl = ui.flLoginRequired as HTMLElement | undefined;
  const waitingPanelEl = ui.flWaitingPanel as HTMLElement | undefined;
  const waitingMessageEl = ui.flWaitingMessage as HTMLElement | undefined;
  const rolesListEl = ui.flRolesList as HTMLElement | undefined;
  const playPanelEl = ui.flPlayPanel as HTMLElement | undefined;
  const roleBadgeEl = ui.flRoleBadge as HTMLElement | undefined;
  const roleHintEl = ui.flRoleHint as HTMLElement | undefined;
  const svg = ui.flSvg as unknown as SVGSVGElement | undefined;
  const timerEl = ui.flTimer as HTMLElement | undefined;
  const movesEl = ui.flMoves as HTMLElement | undefined;
  const quadrantHintEl = ui.flQuadrantHint as HTMLElement | undefined;
  const controlsHintEl = ui.flControlsHint as HTMLElement | undefined;
  const resultEl = ui.flResult as HTMLElement | undefined;
  const backToLobbyBtn = ui.backToLobby as HTMLButtonElement | undefined;

  const cleanup = GameHelpers.createCleanupManager();

  if (!fragmentedLabyrinthSystem.isPlayerEligible()) {
    if (loginRequiredEl) loginRequiredEl.classList.remove('hidden');
    if (waitingPanelEl) waitingPanelEl.classList.add('hidden');
    if (playPanelEl) playPanelEl.classList.add('hidden');
    GameInstanceRegistry.set<FLGameInstance>('fragmented_labyrinth', { stop: () => {} });
    return;
  }

  const match = fragmentedLabyrinthSystem.getCurrentMatch();
  const myRole = fragmentedLabyrinthSystem.myRole();

  if (!match || !myRole) {
    // Igual criterio que signalTriangulation.logic.ts: la vista de
    // lobby (onlineLobby.logic.ts) es responsable de crear/unir antes
    // de entrar acá — esta vista asume que ya existe currentMatch.
    if (waitingPanelEl) {
      waitingPanelEl.classList.remove('hidden');
      if (waitingMessageEl) waitingMessageEl.textContent = 'No hay ninguna partida de Fragmented Labyrinth activa. Volvé al lobby para crear o unirte a una.';
    }
    GameInstanceRegistry.set<FLGameInstance>('fragmented_labyrinth', { stop: () => {} });
    return;
  }

  if (roleBadgeEl) roleBadgeEl.textContent = `Rol ${myRole}`;
  if (roleHintEl) roleHintEl.textContent = ROLE_DESCRIPTIONS[myRole];
  if (controlsHintEl) {
    controlsHintEl.textContent = myRole === 'A'
      ? 'Usá las flechas o WASD para mover al personaje.'
      : 'Solo el Jugador A puede mover al personaje. ¡Guialo por voz!';
  }

  let timerInterval: number | null = null;

  const renderWaitingRoles = () => {
    if (!rolesListEl) return;
    const players = match.players;
    rolesListEl.innerHTML = (['A', 'B', 'C', 'D'] as FLRole[])
      .map((role) => {
        const filled = !!players[role];
        return `<div class="fl-role-slot ${filled ? 'filled' : 'empty'}">Rol ${role} — ${ROLE_DESCRIPTIONS[role]}: ${filled ? 'listo' : 'esperando...'}</div>`;
      })
      .join('');
  };

  const showWaitingForPlayersUi = () => {
    if (playPanelEl) playPanelEl.classList.add('hidden');
    if (waitingPanelEl) waitingPanelEl.classList.remove('hidden');
    if (waitingMessageEl) waitingMessageEl.textContent = 'Esperando a que se completen los 4 jugadores...';
    renderWaitingRoles();
  };

  const renderView = (view: FLView) => {
    if (!svg) return;
    const rows = view.grid.length;
    const cols = view.grid[0]?.length ?? 0;
    const width = cols * CELL_SIZE;
    const height = rows * CELL_SIZE;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gx = view.offsetX + c;
        const gy = view.offsetY + r;
        const ch = view.grid[r][c];

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(c * CELL_SIZE));
        rect.setAttribute('y', String(r * CELL_SIZE));
        rect.setAttribute('width', String(CELL_SIZE));
        rect.setAttribute('height', String(CELL_SIZE));

        let cellClass = 'fl-cell-wall';
        if (ch === '.') cellClass = 'fl-cell-path';
        else if (ch === 'S') cellClass = 'fl-cell-start';
        else if (ch === 'E') cellClass = 'fl-cell-exit';

        const isPlayerHere = gx === view.playerX && gy === view.playerY;
        rect.setAttribute('class', isPlayerHere ? 'fl-cell-player' : cellClass);
        svg.appendChild(rect);

        if (ch === 'S' || ch === 'E') {
          const label = document.createElementNS(SVG_NS, 'text');
          label.setAttribute('x', String(c * CELL_SIZE + CELL_SIZE / 2));
          label.setAttribute('y', String(r * CELL_SIZE + CELL_SIZE / 2));
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'central');
          label.setAttribute('class', 'fl-cell-label');
          label.textContent = ch;
          svg.appendChild(label);
        }

        if (isPlayerHere) {
          const marker = document.createElementNS(SVG_NS, 'circle');
          marker.setAttribute('cx', String(c * CELL_SIZE + CELL_SIZE / 2));
          marker.setAttribute('cy', String(r * CELL_SIZE + CELL_SIZE / 2));
          marker.setAttribute('r', String(CELL_SIZE * 0.32));
          marker.setAttribute('class', 'fl-player-marker');
          svg.appendChild(marker);
        }
      }
    }

    if (movesEl) movesEl.textContent = `👣 ${view.moves} movimientos`;
    if (quadrantHintEl) {
      const parts: string[] = [];
      if (view.startInView) parts.push('📍 Inicio visible');
      if (view.exitInView) parts.push('🏁 ¡Salida visible!');
      quadrantHintEl.textContent = parts.join(' · ');
    }
  };

  const updateTimerDisplay = (seconds: number) => {
    if (!timerEl) return;
    timerEl.textContent = String(Math.max(0, seconds));
    timerEl.classList.toggle('danger', seconds <= 10);
  };

  const startLocalTimerTick = (initialSeconds: number) => {
    let remaining = initialSeconds;
    updateTimerDisplay(remaining);
    if (timerInterval !== null) clearInterval(timerInterval);
    timerInterval = window.setInterval(() => {
      remaining -= 1;
      updateTimerDisplay(remaining);
      if (remaining <= 0 && timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }, 1000);
  };

  let matchEndHandled = false;
  const showMatchEnded = (finalMatch: FLMatch, view: FLView | null) => {
    if (matchEndHandled) return;
    matchEndHandled = true;
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (resultEl) {
      if (finalMatch.status === 'won') {
        resultEl.textContent = `¡El equipo escapó del laberinto en ${view?.moves ?? finalMatch.moves} movimientos!`;
        resultEl.classList.remove('hidden', 'fail');
        resultEl.classList.add('success');
        audioManager?.play('perfect');
      } else {
        resultEl.textContent = 'La partida terminó sin encontrar la salida.';
        resultEl.classList.remove('hidden', 'success');
        resultEl.classList.add('fail');
        audioManager?.play('gameover');
      }
    }
    if (playPanelEl) playPanelEl.classList.add('hidden');
    if (backToLobbyBtn) backToLobbyBtn.classList.remove('hidden');
  };

  const startPlayingUi = () => {
    if (waitingPanelEl) waitingPanelEl.classList.add('hidden');
    if (playPanelEl) playPanelEl.classList.remove('hidden');
    void fragmentedLabyrinthSystem.refreshMyView().then((view) => {
      if (view) {
        renderView(view);
        startLocalTimerTick(view.timeLeft);
      }
    });
  };

  if (match.status === 'waiting') {
    showWaitingForPlayersUi();
  } else {
    startPlayingUi();
  }

  cleanup.addListener(window, 'fl:view_changed', (event: Event) => {
    const view = (event as CustomEvent<{ view: FLView | null }>).detail?.view;
    if (!view) return;
    renderView(view);
    if (view.status === 'won' || view.status === 'over') {
      const latestMatch = fragmentedLabyrinthSystem.getCurrentMatch();
      if (latestMatch) showMatchEnded(latestMatch, view);
    }
  });

  cleanup.addListener(window, 'fl:match_changed', (event: Event) => {
    const updated = (event as CustomEvent<{ match: FLMatch | null }>).detail?.match;
    if (!updated) return;
    if (updated.status === 'waiting') {
      renderWaitingRoles();
    } else if (updated.status === 'playing' && waitingPanelEl && !waitingPanelEl.classList.contains('hidden')) {
      startPlayingUi();
    } else if (updated.status === 'won' || updated.status === 'over') {
      showMatchEnded(updated, fragmentedLabyrinthSystem.getLastView());
    }
  });

  const attemptMove = (dir: FLDirection) => {
    if (myRole !== 'A') return;
    fragmentedLabyrinthSystem.move(dir).then((result) => {
      if (result.denied && result.reason === 'wall') {
        audioManager?.play('miss');
      } else if (!result.denied) {
        audioManager?.play('click');
      }
    }).catch(() => {
      // Movimiento rechazado por el servidor (partida ya terminada,
      // rol incorrecto, etc.) — no hay nada más que hacer del lado del
      // cliente; la próxima actualización de fl:match_changed reflejará
      // el estado real.
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (myRole !== 'A') return;
    const dir = KEY_MAP[event.key.toLowerCase()];
    if (!dir) return;
    event.preventDefault();
    attemptMove(dir);
  };
  document.addEventListener('keydown', onKeyDown);

  if (svg) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Tu cuadrante del laberinto');
  }

  GameInstanceRegistry.set<FLGameInstance>('fragmented_labyrinth', {
    stop: () => {
      cleanup.cleanup();
      document.removeEventListener('keydown', onKeyDown);
      if (timerInterval !== null) clearInterval(timerInterval);
    }
  });
}

export function stop() {
  const instance = GameInstanceRegistry.get<FLGameInstance>('fragmented_labyrinth');
  if (instance) instance.stop();
  void fragmentedLabyrinthSystem.leaveCurrentMatch();
  GameInstanceRegistry.clear('fragmented_labyrinth');
}
