/**
 * js/games/signalTriangulation.logic.ts
 *
 * Lógica pesada de "Signal Triangulation" — cargada lazy vía
 * GameConfig.logic (ver games/signalTriangulation.ts) solo cuando el
 * usuario abre la vista.
 *
 * Responsabilidades de este módulo:
 *   - Pintar el tablero 10x10 y manejar clicks para elegir/lockear celda.
 *   - Aplicar la rotación visual por esquina (puramente estética — ver
 *     comentario de ROTATIONS más abajo, nunca toca las coordenadas
 *     globales que se envían al servidor).
 *   - Reaccionar a los cambios de partida/ronda vía
 *     signalTriangulationSystem + utils/teamLockView.
 *
 * Lo que este módulo NUNCA hace: calcular ni conocer la fuente oculta,
 * ni leer la celda elegida por otro jugador. Toda esa información vive
 * exclusivamente server-side (ver migration_016_signal_triangulation.sql).
 */

import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import GameHelpers from '../utils/gameHelpers.js';
import type { GameUi } from '../types/game.js';
import {
  signalTriangulationSystem,
  ANTENNAS,
  type STSlot,
  type STMatch
} from '../signalTriangulationSystem.js';
import { setupTeamLockView, type TeamLockViewHandle } from '../utils/teamLockView.js';

const BOARD_SIZE = 10;

/**
 * Rotación visual por slot: cada jugador ve su propia antena dibujada
 * "abajo a la izquierda" de su pantalla, sea cual sea su esquina real,
 * para que la orientación se sienta consistente entre los 4 jugadores
 * aunque estén mirando 4 esquinas distintas del mismo tablero global.
 *
 * IMPORTANTE: esto es exclusivamente una transformación de DIBUJO
 * (SVG/grid) aplicada en el cliente. Las coordenadas globales
 * (guess_x/guess_y que se escriben a la base, source_x/source_y que
 * nunca llegan al cliente) viven siempre en el sistema 0..9 × 0..9 sin
 * excepción — ver diseño, sección 6. La función `toGlobal` de abajo es
 * la única frontera entre "coordenada visual clickeada" y "coordenada
 * global enviada al servidor", y es invertible por construcción (cada
 * rotación es su propia inversa o tiene una inversa trivial dentro de
 * las 4 rotaciones de 90°).
 */
const ROTATIONS: Record<STSlot, { rotateDeg: 0 | 90 | 180 | 270 }> = {
  1: { rotateDeg: 0 },   // antena (0,0): ya está "abajo a la izquierda" sin rotar
  2: { rotateDeg: 270 }, // antena (9,0)
  3: { rotateDeg: 180 }, // antena (9,9)
  4: { rotateDeg: 90 }   // antena (0,9)
};

/**
 * Convierte una coordenada elegida en la grilla YA ROTADA visualmente
 * (lo que el jugador ve y clickea, con su antena siempre abajo a la
 * izquierda) a la coordenada global 0..9×0..9 real, deshaciendo la
 * rotación de ROTATIONS. displayCol/displayRow son índices de columna/
 * fila del grid tal como se dibuja en pantalla (0..9, origen visual
 * arriba-izquierda de ese grid ya rotado).
 */
function toGlobal(slot: STSlot, displayCol: number, displayRow: number): { x: number; y: number } {
  const n = BOARD_SIZE - 1;
  switch (ROTATIONS[slot].rotateDeg) {
    case 0:
      return { x: displayCol, y: n - displayRow };
    case 90:
      return { x: displayRow, y: displayCol };
    case 180:
      return { x: n - displayCol, y: displayRow };
    case 270:
      return { x: n - displayRow, y: n - displayCol };
    default:
      return { x: displayCol, y: n - displayRow };
  }
}

/** Inversa de toGlobal — usada para resaltar la celda ya elegida al redibujar. */
function toDisplay(slot: STSlot, x: number, y: number): { col: number; row: number } {
  const n = BOARD_SIZE - 1;
  switch (ROTATIONS[slot].rotateDeg) {
    case 0:
      return { col: x, row: n - y };
    case 90:
      return { col: y, row: x };
    case 180:
      return { col: n - x, row: y };
    case 270:
      return { col: n - y, row: n - x };
    default:
      return { col: x, row: n - y };
  }
}

function cornerLabel(slot: STSlot): string {
  const a = ANTENNAS[slot];
  return `(${a.x},${a.y})`;
}

interface STGameInstance {
  stop: () => void;
}

export function init(ui: GameUi) {
  const loginRequiredEl = ui.stLoginRequired as HTMLElement | undefined;
  const waitingPanelEl = ui.stWaitingPanel as HTMLElement | undefined;
  const waitingMessageEl = ui.stWaitingMessage as HTMLElement | undefined;
  const slotsListEl = ui.stSlotsList as HTMLElement | undefined;
  const playPanelEl = ui.stPlayPanel as HTMLElement | undefined;
  const antennaCornerEl = ui.stAntennaCorner as HTMLElement | undefined;
  const distanceEl = ui.stDistance as HTMLElement | undefined;
  const boardEl = ui.stBoard as HTMLElement | undefined;
  const guessLabelEl = ui.stGuessLabel as HTMLElement | undefined;
  const lockBtn = ui.stLockBtn as HTMLButtonElement | undefined;
  const roundResultEl = ui.stRoundResult as HTMLElement | undefined;
  const matchResultEl = ui.stMatchResult as HTMLElement | undefined;
  const roundLabelEl = ui.stRoundLabel as HTMLElement | undefined;

  const cleanup = GameHelpers.createCleanupManager();

  if (!signalTriangulationSystem.isPlayerEligible()) {
    if (loginRequiredEl) loginRequiredEl.classList.remove('hidden');
    if (waitingPanelEl) waitingPanelEl.classList.add('hidden');
    if (playPanelEl) playPanelEl.classList.add('hidden');
    GameInstanceRegistry.set<STGameInstance>('signal_triangulation', { stop: () => {} });
    return;
  }

  const match = signalTriangulationSystem.getCurrentMatch();
  const mySlot = signalTriangulationSystem.mySlot();

  if (!match || !mySlot) {
    // Sin partida activa para este cliente: la vista de lobby
    // (onlineLobby.logic.ts) es responsable de ofrecer crear/unirse a
    // una partida de Signal Triangulation antes de entrar acá — esta
    // vista asume que ya existe currentMatch. Se muestra un mensaje de
    // espera genérico en vez de romper si por algún motivo se navegó
    // directo sin pasar por el lobby.
    if (waitingPanelEl) {
      waitingPanelEl.classList.remove('hidden');
      if (waitingMessageEl) waitingMessageEl.textContent = 'No hay ninguna partida de Signal Triangulation activa. Volvé al lobby para crear o unirte a una.';
    }
    GameInstanceRegistry.set<STGameInstance>('signal_triangulation', { stop: () => {} });
    return;
  }

  if (antennaCornerEl) antennaCornerEl.textContent = cornerLabel(mySlot);

  let team: TeamLockViewHandle | null = null;
  let currentRoundId: string | null = null;
  let selectedGuess: { x: number; y: number } | null = null;
  let locked = false;

  const renderWaitingSlots = () => {
    if (!slotsListEl) return;
    const players = match.players;
    slotsListEl.innerHTML = ([1, 2, 3, 4] as STSlot[])
      .map((slot) => {
        const filled = !!players[slot];
        return `<div class="st-slot ${filled ? 'filled' : 'empty'}">Jugador ${slot} — antena ${cornerLabel(slot)}: ${filled ? 'listo' : 'esperando...'}</div>`;
      })
      .join('');
  };

  const renderBoard = () => {
    if (!boardEl) return;
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--st-rotate', `${ROTATIONS[mySlot].rotateDeg}deg`);
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'st-cell';
        cell.dataset.col = String(col);
        cell.dataset.row = String(row);
        cell.setAttribute('aria-label', `Celda fila ${row + 1}, columna ${col + 1}`);
        boardEl.appendChild(cell);
      }
    }
  };

  const highlightSelectedCell = () => {
    if (!boardEl || !selectedGuess) return;
    const { col, row } = toDisplay(mySlot, selectedGuess.x, selectedGuess.y);
    boardEl.querySelectorAll('.st-cell').forEach((el) => el.classList.remove('selected'));
    const target = boardEl.querySelector<HTMLElement>(`[data-col="${col}"][data-row="${row}"]`);
    target?.classList.add('selected');
  };

  const setLockedUiState = () => {
    if (lockBtn) lockBtn.disabled = true;
    boardEl?.classList.add('st-board--locked');
    if (guessLabelEl) guessLabelEl.textContent = 'Confirmado — esperando al resto del equipo...';
  };

  const loadRoundState = async () => {
    const round = await signalTriangulationSystem.refreshCurrentRound();
    if (!round) return;
    currentRoundId = round.id;
    if (roundLabelEl) roundLabelEl.textContent = `Ronda ${round.roundNumber} / 2${round.attemptNumber > 1 ? ` (intento ${round.attemptNumber})` : ''}`;

    const myLock = await signalTriangulationSystem.getMyLock(round.id);
    if (myLock) {
      if (distanceEl) distanceEl.textContent = String(myLock.distance);
      if (myLock.guessX !== null && myLock.guessY !== null) {
        selectedGuess = { x: myLock.guessX, y: myLock.guessY };
        highlightSelectedCell();
      }
      locked = !!myLock.lockedAt;
      if (locked) setLockedUiState();
    }

    void team?.refreshTeamStatus(round.id);
  };

  const startPlayingUi = () => {
    if (waitingPanelEl) waitingPanelEl.classList.add('hidden');
    if (playPanelEl) playPanelEl.classList.remove('hidden');
    renderBoard();
    void loadRoundState();
  };

  const showWaitingForPlayersUi = () => {
    // Bug corregido en esta revisión: antes se ocultaba
    // waitingPanelEl incondicionalmente en cuanto currentMatch
    // existía, sin chequear match.status — así que crear una partida
    // (quedando solo en el slot 1) mostraba directo el tablero de
    // juego vacío, sin distancia ni ronda (generate_signal_triangulation_round
    // recién corre cuando se llenan los 4 slots, ver migración sección
    // 4), y la lista de jugadores conectados (stSlotsList) nunca se veía
    // porque vive DENTRO de stWaitingPanel, que ya estaba oculto.
    if (playPanelEl) playPanelEl.classList.add('hidden');
    if (waitingPanelEl) waitingPanelEl.classList.remove('hidden');
    if (waitingMessageEl) waitingMessageEl.textContent = 'Esperando a que se completen los 4 jugadores...';
    renderWaitingSlots();
  };

  if (match.status === 'waiting') {
    showWaitingForPlayersUi();
  } else {
    startPlayingUi();
  }

  team = setupTeamLockView(ui);
  team.onRoundResolved((status) => {
    if (roundResultEl) {
      roundResultEl.textContent = status === 'solved'
        ? '¡Coincidieron! Ronda superada.'
        : 'No coincidieron — reintentando con una señal nueva.';
      roundResultEl.classList.remove('hidden');
    }
    // Sea cual sea el resultado, hay un intento/ronda nuevo del lado
    // del servidor (salvo que la partida haya terminado) — se recarga
    // el estado para mostrar la distancia y tablero del intento nuevo.
    locked = false;
    selectedGuess = null;
    renderBoard();
    void loadRoundState();

    const latestMatch = signalTriangulationSystem.getCurrentMatch();
    if (latestMatch && (latestMatch.status === 'completed' || latestMatch.status === 'abandoned')) {
      if (matchResultEl) {
        matchResultEl.textContent = latestMatch.status === 'completed'
          ? `Partida terminada — ${latestMatch.roundsWon} de 2 rondas superadas.`
          : 'Partida abandonada.';
        matchResultEl.classList.remove('hidden');
      }
      if (playPanelEl) playPanelEl.classList.add('hidden');
    }
  });

  void loadRoundState();

  cleanup.addListener(boardEl ?? null, 'click', (event: Event) => {
    if (locked) return;
    const target = (event.target as HTMLElement).closest('.st-cell') as HTMLElement | null;
    if (!target || !currentRoundId) return;
    const col = Number(target.dataset.col);
    const row = Number(target.dataset.row);
    const { x, y } = toGlobal(mySlot, col, row);
    selectedGuess = { x, y };
    highlightSelectedCell();
    if (guessLabelEl) guessLabelEl.textContent = `Celda elegida — fila ${row + 1}, columna ${col + 1}`;
    if (lockBtn) lockBtn.disabled = false;
    void signalTriangulationSystem.updateGuess(currentRoundId, x, y);
  });

  cleanup.addListener(lockBtn ?? null, 'click', () => {
    if (locked || !currentRoundId || !selectedGuess) return;
    locked = true;
    setLockedUiState();
    signalTriangulationSystem.lockGuess(currentRoundId).catch((e) => {
      // Revertir el estado local si el servidor rechazó el lock (p.ej.
      // otro tab del mismo usuario ya lo había confirmado) — evita dejar
      // el botón deshabilitado para siempre ante un error real.
      locked = false;
      if (lockBtn) lockBtn.disabled = false;
      boardEl?.classList.remove('st-board--locked');
      if (guessLabelEl) guessLabelEl.textContent = `No se pudo confirmar: ${e.message ?? e}`;
    });
  });

  cleanup.addListener(window, 'st:match_changed', (event: Event) => {
    // Antes solo llamaba renderWaitingSlots() sin importar el status —
    // eso mantenía la lista de "esperando jugadores" actualizada, pero
    // nunca transicionaba a la vista de juego cuando el 4to jugador se
    // unía y generate_signal_triangulation_round ya había corrido del
    // lado del servidor (ver bug documentado en showWaitingForPlayersUi
    // más arriba) — quien ya estaba adentro se quedaba mirando la
    // lista de espera indefinidamente.
    const updated = (event as CustomEvent<{ match: STMatch | null }>).detail?.match;
    if (!updated) return;
    if (updated.status === 'waiting') {
      renderWaitingSlots();
    } else if (updated.status === 'playing' && waitingPanelEl && !waitingPanelEl.classList.contains('hidden')) {
      startPlayingUi();
    }
  });

  GameInstanceRegistry.set<STGameInstance>('signal_triangulation', {
    stop: () => {
      cleanup.cleanup();
      team?.cleanup();
    }
  });
}

export function stop() {
  const instance = GameInstanceRegistry.get<STGameInstance>('signal_triangulation');
  if (instance) instance.stop();
  void signalTriangulationSystem.leaveCurrentMatch();
  GameInstanceRegistry.clear('signal_triangulation');
}
