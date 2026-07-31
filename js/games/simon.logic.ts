/**
 * js/games/simon.logic.ts
 *
 * Lógica pesada de "Simon Dice" (init/stop), extraída de simon.ts para
 * lazy loading — ver `logic` en simon.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
 */

import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';
import { multiplayerSystem } from '../multiplayerSystem.js';
import { setupSplitView, findRivalElement, type SplitViewHandle } from '../utils/multiplayerSplitView.js';

interface SimonInstance {
  stop: () => void;
}

export function init(ui: GameUi) {
  const { simonBoard, colorCount: colorCountEl, baseLength: baseLengthEl,
          simonSpeed: simonSpeedEl, simonRounds: simonRoundsEl,
          info: simonInfo } = ui;
  const startSimon = ui.start as HTMLButtonElement | undefined;

  if (!startSimon) return;

  const simonColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];

  // Si hay una sala activa para este juego, la dificultad la fija quien
  // la creó (ver readRoomSettings en multiplayer.logic.ts) — se
  // deshabilitan los controles locales y se prellenan con esos valores
  // para que no haya ambigüedad de cuál dificultad se está jugando.
  const activeMatch = multiplayerSystem.getCurrentMatch();
  const roomSettings = activeMatch?.gameId === 'simon' ? activeMatch.settings : null;
  const isMultiplayer = !!roomSettings;

  if (isMultiplayer) {
    (colorCountEl as HTMLSelectElement).value = String(roomSettings!.colorCount ?? 4);
    (baseLengthEl as HTMLInputElement).value = String(roomSettings!.baseLength ?? 3);
    (simonSpeedEl as HTMLInputElement).value = String(roomSettings!.speed ?? 700);
    (simonRoundsEl as HTMLInputElement).value = String(roomSettings!.rounds ?? 5);
    [colorCountEl, baseLengthEl, simonSpeedEl, simonRoundsEl].forEach(el => {
      if (el) (el as HTMLInputElement | HTMLSelectElement).disabled = true;
    });
    const info = simonInfo as HTMLElement;
    if (info) info.textContent = 'Modo multiplayer: dificultad fijada por quien creó la sala.';
  }

  let simonState = {
    colorCount: 4,
    baseLength: 3,
    speed: 700,
    rounds: 5,
    currentRound: 0,
    sequence: [] as string[],
    userIndex: 0,
    playerTurn: false,
    score: 0,
    playing: false
  };

  // Split-screen "Vos"/"Rival" (ver js/utils/multiplayerSplitView.ts):
  // solo se activa si isMultiplayer (misma condición que ya deshabilita
  // los controles arriba). split.sendEvent/onRivalEvent son no-ops si no
  // hay match, así que el resto del código no necesita ramificar en
  // cada punto de emisión.
  const split: SplitViewHandle = setupSplitView('simon', ui, 'simon', simonBoard as HTMLElement);
  const rivalBoard = ui.simonRival as HTMLElement | undefined;

  if (rivalBoard) {
    split.onRivalEvent('simon:flash', ({ color }: { color: string }) => {
      const button = findRivalElement(rivalBoard, 'data-color', color);
      if (!button) return;
      button.classList.add('active');
      setTimeout(() => button.classList.remove('active'), simonState.speed / 2);
    });

    split.onRivalEvent('simon:press', ({ color }: { color: string }) => {
      const button = findRivalElement(rivalBoard, 'data-color', color);
      if (!button) return;
      button.classList.add('active');
      setTimeout(() => button.classList.remove('active'), 150);
    });

    split.onRivalEvent('simon:gameover', ({ score, rounds }: { score: number; rounds: number }) => {
      const label = ui.simonRivalLabel as HTMLElement | undefined;
      if (label) label.textContent = `Rival — ${score}/${rounds}`;
    });
  }

  function setupSimonBoard(count: number) {
    const board = simonBoard as HTMLElement;
    board.innerHTML = '';
    const colors = simonColors.slice(0, count);
    board.style.gridTemplateColumns = count <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', 'Botones de colores para Simon Dice');
    colors.forEach((color, index) => {
      const btn = document.createElement('button');
      btn.className = `simon-button ${color} disabled`;
      btn.dataset.color = color;
      btn.textContent = color;
      btn.setAttribute('aria-label', `Botón ${color}. Tecla ${index + 1} para activar`);
      btn.addEventListener('click', () => onSimonPress(color));
      board.appendChild(btn);
    });
    // El tablero rival debe reconstruirse cada vez que este se
    // reconstruye (distinta cantidad de colores entre partidas).
    split.remirror();
  }

  function getSimonButtons() {
    return Array.from((simonBoard as HTMLElement).children);
  }

  function flashSimonButton(color: string) {
    const button = simonBoard.querySelector(`[data-color="${color}"]`) as HTMLElement;
    if (!button) return;
    button.classList.add('active');
    setTimeout(() => button.classList.remove('active'), simonState.speed / 2);
    // El rival ve la misma secuencia de memorización en vivo — solo
    // tiene sentido si ambos jugadores juegan la misma secuencia
    // (matchmaking de sala fija settings idénticos, pero la secuencia
    // en sí la genera cada cliente por separado con Math.random —
    // ver nota en generateSimonSequence). Esto no sincroniza la
    // secuencia en sí, solo deja ver el "ritmo"/progreso del rival en
    // su propia partida independiente.
    split.sendEvent('simon:flash', { color });
  }

  function disableSimonButtons(disabled: boolean) {
    getSimonButtons().forEach(btn => {
      btn.classList.toggle('disabled', disabled);
      (btn as HTMLButtonElement).disabled = disabled;
    });
  }

  function playSimonSequence(index = 0) {
    if (index >= simonState.sequence.length) {
      simonState.playerTurn = true;
      disableSimonButtons(false);
      const info = simonInfo as HTMLElement;
      info.textContent = `Tu turno: reproduce la secuencia de ${simonState.sequence.length} colores.`;
      return;
    }

    const color = simonState.sequence[index];
    flashSimonButton(color);
    const toneMap = simonColors.reduce((acc, c, i) => { acc[c] = 'tone' + (i + 1); return acc; }, {} as Record<string, string>);
    if (audioManager) audioManager.play(toneMap[color] || 'beep');
    const info = simonInfo as HTMLElement;
    info.textContent = `Escucha la secuencia... (${index + 1}/${simonState.sequence.length})`;
    setTimeout(() => playSimonSequence(index + 1), simonState.speed);
  }

  function generateSimonSequence(length: number) {
    const colors = simonColors.slice(0, simonState.colorCount);
    const sequence: string[] = [];
    for (let i = 0; i < length; i++) {
      sequence.push(colors[Math.floor(Math.random() * colors.length)]);
    }
    return sequence;
  }

  function startSimonRound() {
    simonState.currentRound += 1;
    const length = simonState.baseLength + simonState.currentRound - 1;
    simonState.sequence = generateSimonSequence(length);
    simonState.userIndex = 0;
    simonState.playerTurn = false;
    const info = simonInfo as HTMLElement;
    info.textContent = `Ronda ${simonState.currentRound}/${simonState.rounds}: observa la secuencia.`;
    disableSimonButtons(true);
    (simonBoard as HTMLElement).classList.remove('hidden');
    setTimeout(() => playSimonSequence(0), 500);
  }

  function endSimonGame(message: string) {
    simonState.playing = false;
    simonState.playerTurn = false;
    disableSimonButtons(true);
    startSimon.disabled = false;
    const info = simonInfo as HTMLElement;
    info.textContent = message;
    if (window.Leaderboard) window.Leaderboard.save('simon', simonState.score, simonState.rounds);
    split.sendEvent('simon:gameover', { score: simonState.score, rounds: simonState.rounds });
    // Cierra la sala en Supabase (status: 'completed') y publica el
    // score propio al leaderboard en vivo — antes nada llamaba esto y
    // la sala quedaba 'playing' para siempre, reservando su room_code
    // indefinidamente (ver migration_005_coop_rooms.sql). No-op si no
    // hay match activo.
    if (split.isMultiplayer) {
      void multiplayerSystem.finishRoomMatch(simonState.score);
    }
  }

  function onSimonPress(color: string) {
    if (!simonState.playerTurn) return;
    const button = simonBoard.querySelector(`[data-color="${color}"]`) as HTMLElement;
    if (!button) return;
    button.classList.add('active');
    setTimeout(() => button.classList.remove('active'), 150);
    split.sendEvent('simon:press', { color });

    const expected = simonState.sequence[simonState.userIndex];
    if (color !== expected) {
      if (audioManager) audioManager.play('gameover');
      endSimonGame(`Fallaste en el intento ${simonState.userIndex + 1}. Secuencia correcta: ${simonState.sequence.join(', ')}.`);
      return;
    }

    const toneMap2 = simonColors.reduce((acc, c, i) => { acc[c] = 'tone' + (i + 1); return acc; }, {} as Record<string, string>);
    if (audioManager) audioManager.play(toneMap2[color] || 'click');
    simonState.userIndex += 1;
    if (simonState.userIndex >= simonState.sequence.length) {
      simonState.score += 1;
      if (simonState.currentRound >= simonState.rounds) {
        if (audioManager) audioManager.play('perfect');
        endSimonGame(`¡Felicidades! Juego completado. Puntuación: ${simonState.score}/${simonState.rounds}.`);
      } else {
        if (audioManager) audioManager.play('good');
        const info = simonInfo as HTMLElement;
        info.textContent = `Correcto. Preparando siguiente ronda...`;
        disableSimonButtons(true);
        setTimeout(startSimonRound, 900);
      }
    } else {
      const info = simonInfo as HTMLElement;
      info.textContent = `Bien. Siguiente color ${simonState.userIndex + 1}/${simonState.sequence.length}.`;
    }
  }

  startSimon.addEventListener('click', () => {
    simonState.colorCount = Math.max(2, Math.min(parseInt((colorCountEl as HTMLInputElement).value, 10) || 4, simonColors.length));
    simonState.baseLength = Math.max(1, parseInt((baseLengthEl as HTMLInputElement).value, 10) || 3);
    simonState.speed = Math.max(200, Math.min(parseInt((simonSpeedEl as HTMLInputElement).value, 10) || 700, 2000));
    simonState.rounds = Math.max(1, Math.min(parseInt((simonRoundsEl as HTMLInputElement).value, 10) || 5, 20));
    simonState.currentRound = 0;
    simonState.score = 0;
    simonState.sequence = [];
    simonState.userIndex = 0;
    simonState.playing = true;
    setupSimonBoard(simonState.colorCount);
    (simonBoard as HTMLElement).classList.add('hidden');
    startSimon.disabled = true;
    startSimonRound();
  });

  // Soporte de teclado para Simon
  const onKeyDown = (e: KeyboardEvent) => {
    if (!simonState.playing || !simonState.playerTurn) return;
    const keyMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5 };
    const index = keyMap[e.key];
    if (index !== undefined && index < simonState.colorCount) {
      e.preventDefault();
      onSimonPress(simonColors[index]);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Exponer stop real
  GameInstanceRegistry.set<SimonInstance>('simon', {
    stop: () => {
      simonState.playing = false;
      simonState.playerTurn = false;
      document.removeEventListener('keydown', onKeyDown);
      split.cleanup();
    },
  });
}

export function stop() {
  const instance = GameInstanceRegistry.get<SimonInstance>('simon');
  if (instance) instance.stop();
  GameInstanceRegistry.clear('simon');
}
