/**
 * js/games/termita.logic.ts
 *
 * Lógica pesada del juego "Termita" (init/stop), extraída de termita.ts
 * para que el bundler le dé su propio chunk — ver `logic` en termita.ts
 * y el comentario de GameConfig.logic en core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';
import { lobbySystem } from '../lobbySystem.js';
import { setupSplitView, findRivalElement, type SplitViewHandle } from '../utils/multiplayerSplitView.js';

export function init(ui: GameUi) {
    const { grid: gridEl, gridSize: gridSizeEl, targets: targetsEl,
            showTime: showTimeEl, rounds: roundsEl, info: termitaInfo } = ui;
    const startTermita = ui.start as HTMLButtonElement | undefined;

    if (!startTermita) return;

    // Partida de lobby (ver lobbySystem.ts): la sub-partida ya queda en
    // 'playing' con settings fijados por quien la creó apenas se une el
    // segundo jugador — no hay pantalla previa de "esperando anfitrión"
    // (ver nota histórica en multiplayerSplitView.ts).
    const activeMatch = lobbySystem.getCurrentMatch();
    const isMultiplayer = activeMatch?.gameId === 'termita';

    const applySettingsToInputs = (s: Record<string, any>) => {
      (gridSizeEl as HTMLSelectElement).value = String(s.size ?? 5);
      (targetsEl as HTMLInputElement).value = String(s.targets ?? 4);
      (showTimeEl as HTMLInputElement).value = String(s.showTime ?? 800);
      (roundsEl as HTMLInputElement).value = String(s.rounds ?? 5);
    };

    let state = {
      size: 5,
      targets: 4,
      showTime: 800,
      rounds: 5,
      currentRound: 0,
      score: 0,
      targetsList: [] as number[],
      selections: new Set<number>(),
      acceptingInput: false
    };

    // Split-screen "Vos"/"Rival" (ver js/utils/multiplayerSplitView.ts).
    const split: SplitViewHandle = setupSplitView('termita', ui, 'termita', gridEl as HTMLElement);
    const rivalGrid = ui.termitaRival as HTMLElement | undefined;

    if (isMultiplayer) {
      applySettingsToInputs(activeMatch!.settings || {});
      [gridSizeEl, targetsEl, showTimeEl, roundsEl].forEach(el => {
        if (el) (el as HTMLInputElement | HTMLSelectElement).disabled = true;
      });
      const info = termitaInfo as HTMLElement;
      if (split.isSpectating) {
        startTermita.disabled = true;
        startTermita.classList.add('hidden');
        if (info) info.textContent = 'Especteando esta partida.';
      } else if (split.isHost) {
        if (info) info.textContent = 'Partida de lobby: presioná Empezar cuando quieras. Tu rival arranca junto con vos.';
      } else {
        // No-host: espera la señal de arranque del anfitrión (ver
        // split.onStart más abajo).
        startTermita.disabled = true;
        startTermita.classList.add('hidden');
        if (info) info.textContent = 'Esperando a que el anfitrión empiece la partida...';
      }
    }

    if (rivalGrid) {
      split.onRivalEvent('termita:light', ({ indices }: { indices: number[] }) => {
        indices.forEach((idx) => {
          const el = findRivalElement(rivalGrid, 'data-index', String(idx));
          el?.classList.add('lit');
        });
      });

      split.onRivalEvent('termita:clear', () => {
        rivalGrid.querySelectorAll('.cell').forEach((c) => c.classList.remove('lit'));
      });

      split.onRivalEvent('termita:select', ({ index }: { index: number }) => {
        const el = findRivalElement(rivalGrid, 'data-index', String(index));
        el?.classList.add('selected');
      });

      split.onRivalEvent('termita:result', ({ score, rounds }: { score: number; rounds: number }) => {
        const label = ui.termitaRivalLabel as HTMLElement | undefined;
        if (label) label.textContent = `Rival — ${score} pts`;
        // Limpia selecciones del round anterior en el tablero rival,
        // igual que hace evaluateRound() del lado propio.
        setTimeout(() => {
          rivalGrid.querySelectorAll('.cell').forEach((c) => c.classList.remove('selected', 'correct', 'wrong'));
        }, 1000);
      });
    }

    function setupGrid(size: number) {
      const grid = gridEl as HTMLElement;
      grid.innerHTML = '';
      grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', 'Cuadrícula de cubos para memorizar');
      const total = size * size;
      for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = String(i);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', `Celda ${i + 1}`);
        cell.addEventListener('click', () => onCellClick(i));
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCellClick(i);
          }
        });
        grid.appendChild(cell);
      }
      // El tablero rival debe reconstruirse cada vez que este se
      // reconstruye (distinto tamaño de grilla entre partidas).
      split.remirror();
    }

    function pickTargets(size: number, count: number) {
      const total = size * size;
      const picks = new Set<number>();
      while (picks.size < Math.min(count, total)) {
        picks.add(Math.floor(Math.random() * total));
      }
      return Array.from(picks);
    }

    function lightTargets(targets: number[]) {
      const grid = gridEl as HTMLElement;
      targets.forEach(idx => {
        const el = grid.children[idx] as HTMLElement;
        if (el) {
          el.classList.add('lit');
          el.setAttribute('aria-label', `Celda ${idx + 1}, iluminada`);
        }
      });
      split.sendEvent('termita:light', { indices: targets });
    }

    function clearLights() {
      const grid = gridEl as HTMLElement;
      Array.from(grid.children).forEach((c, i) => {
        (c as HTMLElement).classList.remove('lit');
        (c as HTMLElement).setAttribute('aria-label', `Celda ${i + 1}`);
      });
      split.sendEvent('termita:clear', {});
    }

    function onCellClick(index: number) {
      if (split.isSpectating) return;
      if (!state.acceptingInput) return;
      const grid = gridEl as HTMLElement;
      const el = grid.children[index] as HTMLElement;
      if (!el || el.classList.contains('selected')) return;
      el.classList.add('selected');
      el.setAttribute('aria-label', `Celda ${index + 1}, seleccionada`);
      if (audioManager) audioManager.play('click');
      state.selections.add(index);
      split.sendEvent('termita:select', { index });
      if (state.selections.size >= state.targets) {
        evaluateRound();
      }
    }

    function evaluateRound() {
      state.acceptingInput = false;
      const targetsSet = new Set(state.targetsList);
      let correct = 0;
      const grid = gridEl as HTMLElement;
      Array.from(grid.children).forEach((c, i) => {
        const idx = Number(i);
        const el = c as HTMLElement;
        if (targetsSet.has(idx) && state.selections.has(idx)) {
          el.classList.add('correct'); correct++;
          el.setAttribute('aria-label', `Celda ${idx + 1}, acierto`);
        } else if (state.selections.has(idx) && !targetsSet.has(idx)) {
          el.classList.add('wrong');
          el.setAttribute('aria-label', `Celda ${idx + 1}, seleccionada por error`);
        } else if (targetsSet.has(idx) && !state.selections.has(idx)) {
          el.classList.add('wrong');
          el.setAttribute('aria-label', `Celda ${idx + 1}, objetivo no seleccionado`);
        }
      });
      state.score += correct;
      const allCorrect = correct === state.targetsList.length && state.selections.size === state.targetsList.length;
      if (audioManager) audioManager.play(allCorrect ? 'good' : 'miss');
      const info = termitaInfo as HTMLElement;
      info.textContent = `Ronda ${state.currentRound}/${state.rounds} — Aciertos: ${correct} — Puntuación total: ${state.score}`;
      split.sendEvent('termita:result', { score: state.score, rounds: state.rounds });
      setTimeout(() => {
        Array.from(grid.children).forEach((c, i) => {
          (c as HTMLElement).classList.remove('selected', 'correct', 'wrong');
          (c as HTMLElement).setAttribute('aria-label', `Celda ${i + 1}`);
        });
        state.selections.clear();
        if (state.currentRound < state.rounds) {
          playRound();
        } else {
          info.textContent = `Juego terminado — Puntuación final: ${state.score}`;
          if (audioManager) audioManager.play('perfect');
          if (window.Leaderboard) window.Leaderboard.save('termita', state.score, state.rounds);
          // Reporta el resultado propio a la sub-partida del lobby — ver
          // lobbySystem.completeMatch: se marca 'completed' recién
          // cuando ambos jugadores reportaron el suyo. Se hace acá (fin
          // real del juego) y no en cada envío de termita:result (que
          // ocurre por ronda), para no cerrar la sub-partida a mitad de
          // partida. No aplica si se está especteando.
          if (split.isMultiplayer && !split.isSpectating) {
            void lobbySystem.completeMatch(state.score);
          }
        }
      }, 1000);
    }

    function playRound() {
      state.currentRound += 1;
      state.targetsList = pickTargets(state.size, state.targets);
      const grid = gridEl as HTMLElement;
      grid.classList.remove('hidden');
      lightTargets(state.targetsList);
      setTimeout(() => {
        clearLights();
        state.acceptingInput = true;
        const info = termitaInfo as HTMLElement;
        info.textContent = `Ronda ${state.currentRound}/${state.rounds} — Selecciona los ${state.targets} cubos.`;
      }, state.showTime);
    }

    function beginTermitaGame() {
      state.size = parseInt((gridSizeEl as HTMLInputElement).value, 10) || 5;
      state.targets = Math.max(1, Math.min(parseInt((targetsEl as HTMLInputElement).value, 10) || 4, state.size * state.size));
      state.showTime = Math.max(100, parseInt((showTimeEl as HTMLInputElement).value, 10) || 800);
      state.rounds = Math.max(1, parseInt((roundsEl as HTMLInputElement).value, 10) || 5);
      state.currentRound = 0;
      state.score = 0;
      state.selections.clear();
      state.targetsList = [];
      setupGrid(state.size);
      const info = termitaInfo as HTMLElement;
      info.textContent = '';
      playRound();
      // El no-host tiene el botón oculto/deshabilitado de entrada (ver
      // el bloque isMultiplayer más arriba) y nunca debe quedar
      // reactivado — este bloque solo aplica a modo solo-jugador o al
      // host en multiplayer.
      if (!split.isMultiplayer || split.isHost) {
        startTermita.disabled = true;
        const totalDuration = (state.showTime + 2000) * state.rounds;
        setTimeout(() => { startTermita.disabled = false; }, totalDuration);
      }
    }

    startTermita.addEventListener('click', () => {
      if (split.isSpectating) return;
      // En multiplayer, solo el host tiene este botón visible/habilitado
      // (ver el bloque isMultiplayer más arriba) — el rival arranca
      // reaccionando a onStart. Se mantiene el guard por si igual
      // llegara a dispararse.
      if (split.isMultiplayer && !split.isHost) return;
      beginTermitaGame();
      // Avisa al rival para que arranque su partida en el mismo
      // instante — cada lado sigue generando sus propios targets
      // localmente (ver comentario de broadcastStart en
      // multiplayerSplitView.ts).
      split.broadcastStart();
    });

    // No-host: arranca cuando el anfitrión efectivamente empieza.
    split.onStart(() => {
      if (split.isSpectating) return;
      beginTermitaGame();
    });

    // Soporte de teclado para navegación por la cuadrícula
    let focusedCellIndex = 0;
    const grid = gridEl as HTMLElement;
    grid.addEventListener('keydown', (e) => {
      if (split.isSpectating) return;
      if (!state.acceptingInput) return;
      
      const size = state.size;
      const total = size * size;
      const row = Math.floor(focusedCellIndex / size);
      const col = focusedCellIndex % size;

      let newIndex = focusedCellIndex;
      
      switch (e.key) {
        case 'ArrowUp':
          if (row > 0) newIndex = focusedCellIndex - size;
          break;
        case 'ArrowDown':
          if (row < size - 1) newIndex = focusedCellIndex + size;
          break;
        case 'ArrowLeft':
          if (col > 0) newIndex = focusedCellIndex - 1;
          break;
        case 'ArrowRight':
          if (col < size - 1) newIndex = focusedCellIndex + 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onCellClick(focusedCellIndex);
          return;
        default:
          return;
      }

      if (newIndex !== focusedCellIndex && newIndex >= 0 && newIndex < total) {
        e.preventDefault();
        focusedCellIndex = newIndex;
        (grid.children[focusedCellIndex] as HTMLElement)?.focus();
      }
    });

    grid.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('cell')) {
        focusedCellIndex = parseInt(target.dataset.index || '0', 10);
      }
    });

    termitaSplitCleanup = split.cleanup;
}

let termitaSplitCleanup: (() => void) | null = null;

export function stop() {
  // El juego no usa timers persistentes fuera de una ronda en curso
  if (termitaSplitCleanup) {
    termitaSplitCleanup();
    termitaSplitCleanup = null;
  }
  // Libera el estado del lobby si se sale de la vista sin haber
  // terminado (o especteando) — ver comentario equivalente en
  // arrowGame.logic.ts/stop(). No-op si no hay match activo.
  void lobbySystem.leaveCurrentMatch();
}
