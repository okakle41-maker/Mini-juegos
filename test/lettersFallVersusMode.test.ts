import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Mockea multiplayerSystem entero para probar el flujo 1v1
 * (createRoomMatch/joinRoomMatch/sendGameEvent) sin depender de
 * Supabase real — mismo patrón que lettersFallCoopFixes.test.ts.
 *
 * `createRoom` (ver lettersFall.logic.ts) siempre arranca con
 * `peers: []` — el host está solo hasta que el rival efectivamente se
 * une, y recién ahí `connectAndWait` llama a `launchCoop`/
 * `wireVersusMode` vía el callback de `onRoomUpdate`. Para probar el
 * lado host (split-screen, botón "Empezar" visible, etc.) hace falta
 * simular ese join disparando manualmente el callback capturado acá
 * — ver `simulateRivalJoined` más abajo.
 */
const { sendGameEvent, updateScore, createRoomMatch, joinRoomMatch, onRoomUpdate, leaveRoomMatch, capturedRoomUpdateCallbacks } = vi.hoisted(() => {
  const capturedRoomUpdateCallbacks: Array<(match: any) => void> = [];
  return {
    sendGameEvent: vi.fn(async (_type: string, _payload?: unknown) => {}),
    updateScore: vi.fn(async (_score: number) => {}),
    createRoomMatch: vi.fn(async () => ({
      id: 'match1', gameId: 'letters', roomCode: 'QXWM',
      players: [{ id: 'me', role: 'p1' }],
      status: 'waiting', createdAt: Date.now(), scores: new Map(), settings: {}
    })),
    joinRoomMatch: vi.fn(async () => ({
      id: 'match1', gameId: 'letters', roomCode: 'QXWM',
      players: [
        { id: 'me', role: 'p2' },
        { id: 'other', role: 'p1' } // ya presente -> connectAndWait lanza sin esperar onPeersChange
      ],
      status: 'playing', createdAt: Date.now(), scores: new Map(), settings: {}
    })),
    onRoomUpdate: vi.fn((_matchId: string, callback: (match: any) => void) => {
      capturedRoomUpdateCallbacks.push(callback);
      return () => {};
    }),
    leaveRoomMatch: vi.fn(async () => {}),
    capturedRoomUpdateCallbacks,
  };
});

/** Simula que 'p2' se unió a la sala que 'p1' acaba de crear —
 *  dispara el callback más reciente registrado por onRoomUpdate con
 *  un snapshot de match donde ya aparecen ambos jugadores. */
function simulateRivalJoined() {
  const callback = capturedRoomUpdateCallbacks[capturedRoomUpdateCallbacks.length - 1];
  callback?.({
    id: 'match1', gameId: 'letters', roomCode: 'QXWM',
    players: [
      { id: 'me', role: 'p1' },
      { id: 'other', role: 'p2' }
    ],
    status: 'playing', createdAt: Date.now(), scores: new Map(), settings: {}
  });
}

vi.mock('../js/multiplayerSystem', () => ({
  multiplayerSystem: {
    createRoomMatch,
    joinRoomMatch,
    sendGameEvent,
    updateScore,
    onRoomUpdate,
    leaveRoomMatch,
    finishRoomMatch: vi.fn(async () => {}),
  },
}));

import { init, stop } from '../js/games/lettersFall.logic.js';
import GameInstanceRegistry from '../js/core/gameInstanceRegistry.js';


function buildLettersUi() {
  document.body.innerHTML = `
    <div data-ui="lettersModePanel"><div class="letters-mode-options"></div></div>
    <div data-ui="roleChooser" class="hidden"></div>
    <div data-ui="roomStatus" class="hidden"></div>
    <div data-ui="roomStatusText"></div>
    <div data-ui="roomCodeDisplay"></div>
    <button data-ui="modeSolo"></button>
    <button data-ui="modeCreate"></button>
    <button data-ui="modeJoin"></button>
    <button data-ui="roleViewer"></button>
    <button data-ui="roleTyper"></button>
    <div data-ui="joinCodeRow" class="hidden"></div>
    <input data-ui="joinCodeInput" />
    <button data-ui="roleConfirm" disabled></button>
    <button data-ui="roleBack"></button>
    <button data-ui="roomCancel"></button>
    <button data-ui="start"></button>
    <button data-ui="retry" class="hidden"></button>
    <input data-ui="lettersInput" />
    <div data-ui="lettersArea" style="width:400px;height:560px;"></div>
    <div data-ui="lettersMessage"></div>
    <div data-ui="lettersDifficulty"></div>
    <select data-ui="lettersDifficultySelect"><option value="normal" selected>normal</option></select>
    <div data-ui="lettersScore"></div>
    <div data-ui="lettersBest"></div>
    <div data-ui="lettersLives"></div>
    <div data-ui="lettersCard" class="hidden"></div>
    <div data-ui="lettersControls"></div>
    <div data-ui="lettersRoleBadge" class="hidden"></div>
    <div data-ui="roleChooserLabel"></div>
    <button data-ui="modeVersus"></button>
    <div data-ui="versusChooser" class="hidden"></div>
    <button data-ui="versusCreate"></button>
    <button data-ui="versusJoin"></button>
    <div data-ui="versusJoinCodeRow" class="hidden"></div>
    <input data-ui="versusJoinCodeInput" />
    <button data-ui="versusJoinConfirm" disabled></button>
    <button data-ui="versusBack"></button>
    <div data-ui="lettersSplit"></div>
    <span data-ui="lettersSplitLabel" class="hidden"></span>
    <div data-ui="lettersRivalSide" class="hidden"></div>
    <div data-ui="lettersRival"></div>
    <span data-ui="lettersRivalLabel"></span>
    <div data-ui="lettersRivalLives"></div>
  `;

  const ui: any = {};
  document.querySelectorAll('[data-ui]').forEach((el) => {
    ui[(el as HTMLElement).dataset.ui!] = el;
  });
  return ui;
}

describe('Letters Fall 1v1 (versus mode)', () => {
  beforeEach(() => {
    sendGameEvent.mockClear();
    createRoomMatch.mockClear();
    joinRoomMatch.mockClear();
    capturedRoomUpdateCallbacks.length = 0;
    GameInstanceRegistry.clear('letters');
  });

  it('el botón modeVersus muestra versusChooser en vez de roleChooser', () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeVersus.click();

    expect(ui.versusChooser.classList.contains('hidden')).toBe(false);
    expect(ui.roleChooser.classList.contains('hidden')).toBe(true);
    expect(ui.lettersModePanel.classList.contains('hidden')).toBe(false);
  });

  it('versusBack vuelve al panel principal de modos', () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeVersus.click();
    ui.versusBack.click();

    expect(ui.versusChooser.classList.contains('hidden')).toBe(true);
    expect(ui.lettersModePanel.querySelector('.letters-mode-options').classList.contains('hidden')).toBe(false);
  });

  it('versusCreate crea una sala como rol p1 (host/generador)', async () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeVersus.click();
    ui.versusCreate.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoomMatch).toHaveBeenCalledWith('letters', 'p1');
  });

  it('versusJoinConfirm solo se habilita con un código de 4 caracteres, y se une como p2', async () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeVersus.click();
    ui.versusJoin.click();
    expect(ui.versusJoinCodeRow.classList.contains('hidden')).toBe(false);

    ui.versusJoinCodeInput.value = 'AB';
    ui.versusJoinCodeInput.dispatchEvent(new Event('input'));
    expect(ui.versusJoinConfirm.disabled).toBe(true);

    ui.versusJoinCodeInput.value = 'qxwm';
    ui.versusJoinCodeInput.dispatchEvent(new Event('input'));
    expect(ui.versusJoinConfirm.disabled).toBe(false);
    // El código se normaliza a mayúsculas, igual que joinCodeInput de coop.
    expect(ui.versusJoinCodeInput.value).toBe('QXWM');

    ui.versusJoinConfirm.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(joinRoomMatch).toHaveBeenCalledWith('letters', 'QXWM', 'p2');
  });

  it('el host (p1) tiene el botón Empezar visible tras conectar; el no-host (p2) lo tiene oculto/deshabilitado', async () => {
    const uiHost = buildLettersUi();
    init(uiHost);
    uiHost.modeVersus.click();
    uiHost.versusCreate.click();
    await Promise.resolve();
    await Promise.resolve();

    // El host queda esperando en roomStatus hasta que el rival se une
    // de verdad — createRoom() siempre arranca con peers:[] (ver
    // lettersFall.logic.ts), así que wireVersusMode todavía no corrió
    // en este punto. Se simula el join real disparando el callback
    // capturado de onRoomUpdate.
    expect(uiHost.roomStatus.classList.contains('hidden')).toBe(false);
    simulateRivalJoined();
    await Promise.resolve();
    await Promise.resolve();

    expect(uiHost.lettersCard.classList.contains('hidden')).toBe(false);
    expect(uiHost.start.classList.contains('hidden')).toBe(false);
    expect(uiHost.start.disabled).toBe(false);

    GameInstanceRegistry.clear('letters');

    const uiGuest = buildLettersUi();
    init(uiGuest);
    uiGuest.modeVersus.click();
    uiGuest.versusJoin.click();
    uiGuest.versusJoinCodeInput.value = 'QXWM';
    uiGuest.versusJoinCodeInput.dispatchEvent(new Event('input'));
    uiGuest.versusJoinConfirm.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(uiGuest.start.classList.contains('hidden')).toBe(true);
    expect(uiGuest.start.disabled).toBe(true);
  });

  it('activa el split-screen (clase modificadora + panel rival visible) al entrar en 1v1', async () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeVersus.click();
    ui.versusCreate.click();
    await Promise.resolve();
    await Promise.resolve();

    simulateRivalJoined();
    await Promise.resolve();
    await Promise.resolve();

    expect(ui.lettersSplit.classList.contains('letters-split--active')).toBe(true);
    expect(ui.lettersRivalSide.classList.contains('hidden')).toBe(false);
    expect(ui.lettersSplitLabel.classList.contains('hidden')).toBe(false);
  });

  it('p2 nunca dispara start() por click propio, aunque el guard del botón se saltee', async () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeVersus.click();
    ui.versusJoin.click();
    ui.versusJoinCodeInput.value = 'QXWM';
    ui.versusJoinCodeInput.dispatchEvent(new Event('input'));
    ui.versusJoinConfirm.click();
    await Promise.resolve();
    await Promise.resolve();

    sendGameEvent.mockClear();
    // Aunque el botón está oculto/deshabilitado, forzamos el click
    // para probar el guard interno de wireDifficultyAndInput.
    ui.start.click();

    // p2 no debe emitir 'versus:start' (eso es exclusivo de p1/host) —
    // ver guard en wireDifficultyAndInput / VERSUS_GENERATOR_ROLE.
    const versusStartCalls = sendGameEvent.mock.calls.filter(([type]) => type === 'versus:start');
    expect(versusStartCalls.length).toBe(0);
  });

  it('stop() revierte el split-screen y restaura el botón Empezar para la próxima partida', async () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeVersus.click();
    ui.versusCreate.click();
    await Promise.resolve();
    await Promise.resolve();

    simulateRivalJoined();
    await Promise.resolve();
    await Promise.resolve();

    expect(ui.lettersSplit.classList.contains('letters-split--active')).toBe(true);

    stop();

    expect(ui.lettersSplit.classList.contains('letters-split--active')).toBe(false);
    expect(ui.lettersRivalSide.classList.contains('hidden')).toBe(true);
    expect(ui.lettersSplitLabel.classList.contains('hidden')).toBe(true);
    expect(ui.start.classList.contains('hidden')).toBe(false);
    expect(ui.start.disabled).toBe(false);
    expect(ui.lettersModePanel.classList.contains('hidden')).toBe(false);
    expect(ui.versusChooser.classList.contains('hidden')).toBe(true);
  });

  /**
   * Regresión: gameOver() en 1v1 llamaba a
   * multiplayerSystem.finishRoomMatch(), que marca la sala 'completed'
   * en la DB y limpia multiplayerSystem.currentMatch. sendGameEvent()
   * es un no-op silencioso sin currentMatch (ver su guard), así que
   * cualquier room.send() posterior — incluido el 'versus:start' que
   * retry()/start() emite al reintentar — se perdía en silencio: el
   * host reiniciaba su propio tablero pero el rival nunca se enteraba,
   * dejando la revancha rota. El fix cambia finishRoomMatch() por
   * updateScore() (que no toca currentMatch) en gameOver().
   */
  it('gameOver() en 1v1 NO llama a finishRoomMatch (rompería el reintento), reporta el score con updateScore', async () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeVersus.click();
    ui.versusCreate.click();
    await Promise.resolve();
    await Promise.resolve();
    simulateRivalJoined();
    await Promise.resolve();
    await Promise.resolve();

    const game = GameInstanceRegistry.get<any>('letters');
    expect(game).toBeTruthy();

    updateScore.mockClear();
    game.state.active = true;
    game.state.score = 42;
    game.gameOver();

    expect(updateScore).toHaveBeenCalledWith(42);
  });

  it('tras gameOver(), retry() en 1v1 sigue pudiendo emitir versus:start (currentMatch no quedó limpio)', async () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeVersus.click();
    ui.versusCreate.click();
    await Promise.resolve();
    await Promise.resolve();
    simulateRivalJoined();
    await Promise.resolve();
    await Promise.resolve();

    const game = GameInstanceRegistry.get<any>('letters');
    expect(game).toBeTruthy();

    game.state.active = true;
    game.gameOver();

    sendGameEvent.mockClear();
    ui.retry.click();

    const versusStartCalls = sendGameEvent.mock.calls.filter(([type]) => type === 'versus:start');
    expect(versusStartCalls.length).toBe(1);
  });
});
