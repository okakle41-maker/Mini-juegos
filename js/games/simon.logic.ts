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
import { lobbySystem } from '../lobbySystem.js';
import { setupSplitView, findRivalElement, type SplitViewHandle } from '../utils/multiplayerSplitView.js';

interface SimonInstance {
  stop: () => void;
}

export function init(ui: GameUi) {
  const { simonBoard, colorCount: colorCountEl, baseLength: baseLengthEl,
          simonSpeed: simonSpeedEl, simonRounds: simonRoundsEl,
          info: simonInfo } = ui;
  const startSimon = ui.start as HTMLButtonElement | undefined;
  const backToLobbyBtn = ui.backToLobby as HTMLButtonElement | undefined;

  if (!startSimon) return;

  const simonColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];

  // Split-screen "Vos"/"Rival" (ver js/utils/multiplayerSplitView.ts).
  // A diferencia del viejo flujo de sala 1v1 suelta (createRoomMatch/
  // joinRoomMatch sobre MultiplayerSystem), acá no hay pantalla previa
  // de "esperando a que el anfitrión arranque": la sub-partida del
  // lobby (lobbySystem.createMatch/joinMatchAsPlayer) ya queda en
  // 'playing' apenas se completa el segundo jugador, con settings
  // fijados por quien la creó — este código arranca directo con esos
  // valores en vez de mostrar el formulario de dificultad editable.
  const activeMatch = lobbySystem.getCurrentMatch();
  const isMultiplayer = activeMatch?.gameId === 'simon';
  const split: SplitViewHandle = setupSplitView('simon', ui, 'simon', simonBoard as HTMLElement);
  const rivalBoard = ui.simonRival as HTMLElement | undefined;
  let needsSpectatorBoard = false;

  if (isMultiplayer) {
    const s = activeMatch!.settings || {};
    (colorCountEl as HTMLSelectElement).value = String(s.colorCount ?? 4);
    (baseLengthEl as HTMLInputElement).value = String(s.baseLength ?? 3);
    (simonSpeedEl as HTMLInputElement).value = String(s.speed ?? 700);
    (simonRoundsEl as HTMLInputElement).value = String(s.rounds ?? 5);
    [colorCountEl, baseLengthEl, simonSpeedEl, simonRoundsEl].forEach(el => {
      if (el) (el as HTMLInputElement | HTMLSelectElement).disabled = true;
    });
    const info = simonInfo as HTMLElement;
    if (split.isSpectating) {
      info.textContent = 'Especteando esta partida.';
      startSimon.disabled = true;
      startSimon.classList.add('hidden');
      // A diferencia del host/rival (que construyen su tablero al
      // arrancar/recibir la señal de arranque), un espectador nunca
      // dispara beginSimonGame(): sin esto, su lado "Vos" del split
      // queda vacío y colapsado (0 celdas, sin min-size en CSS) para
      // siempre. needsSpectatorBoard se resuelve más abajo, una vez
      // definidos simonState/setupSimonBoard (no se puede llamar acá:
      // TDZ, ambos se declaran después en este mismo init()).
      needsSpectatorBoard = true;
    } else if (split.isHost) {
      info.textContent = 'Partida de lobby: presioná Empezar cuando quieras. Tu rival arranca junto con vos.';
    } else {
      // No-host: espera la señal de arranque del anfitrión (ver
      // split.onStart más abajo) en vez de tener su propio botón
      // activo — evita que cada lado arranque en un momento distinto.
      info.textContent = 'Esperando a que el anfitrión empiece la partida...';
      startSimon.disabled = true;
      startSimon.classList.add('hidden');
    }
  }

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

  /**
   * Un espectador ve el split (ambos tableros construidos vía
   * setupSimonBoard/remirror para que el CSS/estructura sea igual que
   * la de un jugador real), pero no juega ninguno de los dos lados: acá
   * se muestra "Vos" con el tablero del jugador 1 espejado también
   * (mismo mecanismo que el rival), en vez de dejarlo interactivo.
   * Sencillo por ahora: si isSpectating, el propio tablero también
   * queda deshabilitado apenas se construye (ver setupSimonBoard).
   */
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

  if (needsSpectatorBoard) {
    // Ver comentario en el bloque isMultiplayer más arriba: se posterga
    // hasta acá porque setupSimonBoard/simonState recién están
    // definidos en este punto de init(). Usa la config ya fijada de la
    // partida (colorCount tomado del <select>, ya seteado con
    // activeMatch.settings más arriba) — el tablero queda deshabilitado
    // por construcción (los botones nacen con la clase 'disabled' y
    // onSimonPress corta temprano por isSpectating).
    simonState.colorCount = Number((colorCountEl as HTMLSelectElement).value) || 4;
    setupSimonBoard(simonState.colorCount);
    (simonBoard as HTMLElement).classList.remove('hidden');
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
    // Reporta el resultado propio a la sub-partida del lobby — ver
    // lobbySystem.completeMatch: se marca 'completed' recién cuando
    // ambos jugadores reportaron el suyo.
    if (split.isMultiplayer && !split.isSpectating) {
      void lobbySystem.completeMatch(simonState.score);
    }
  }

  function onSimonPress(color: string) {
    if (split.isSpectating) return;
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

  function beginSimonGame() {
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
  }

  startSimon.addEventListener('click', () => {
    if (split.isSpectating) return;
    // En multiplayer, solo el host tiene este botón visible/habilitado
    // (ver el bloque isMultiplayer más arriba) — el rival arranca
    // reaccionando a onStart, no clickeando el suyo propio. Se
    // mantiene el guard por si igual llegara a dispararse.
    if (split.isMultiplayer && !split.isHost) return;
    beginSimonGame();
    // Avisa al rival para que arranque su partida en el mismo
    // instante — no transmite la secuencia en sí (ver comentario de
    // broadcastStart en multiplayerSplitView.ts): cada lado sigue
    // generando la suya localmente.
    split.broadcastStart();
  });

  // No-host: arranca cuando el anfitrión efectivamente empieza, en vez
  // de tener su propio botón activo.
  split.onStart(() => {
    if (split.isSpectating) return;
    beginSimonGame();
  });

  // El rival abandonó la partida a mitad de juego (ver
  // multiplayerSplitView.onOpponentLeft): se corta el propio juego acá
  // mismo (no auto-redirige) y se muestra el mensaje + botón para
  // volver al lobby, en vez de dejar que el jugador siga jugando solo
  // sin enterarse de que ya no hay nadie del otro lado.
  split.onOpponentLeft(() => {
    simonState.playing = false;
    simonState.playerTurn = false;
    disableSimonButtons(true);
    startSimon.disabled = true;
    startSimon.classList.add('hidden');
    const info = simonInfo as HTMLElement;
    info.textContent = 'Tu rival abandonó la partida.';
    if (backToLobbyBtn) backToLobbyBtn.classList.remove('hidden');
  });

  // Soporte de teclado para Simon
  const onKeyDown = (e: KeyboardEvent) => {
    if (split.isSpectating) return;
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
  // Libera el estado del lobby si se sale de la vista sin haber
  // terminado (o especteando) — ver comentario equivalente en
  // arrowGame.logic.ts/stop(). No-op si no hay match activo.
  void lobbySystem.leaveCurrentMatch();
  GameInstanceRegistry.clear('simon');
}
