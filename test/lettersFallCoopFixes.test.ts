import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mockea multiplayerSystem entero: el objetivo es contar cuántas veces
// se llama sendGameEvent('viewer:state', ...) durante varios frames de
// update() con el mismo score/lives/best, no probar Supabase real.
const { sendGameEvent, joinRoomMatch, onRoomUpdate, leaveRoomMatch } = vi.hoisted(() => ({
  sendGameEvent: vi.fn(async (_type: string, _payload?: unknown) => {}),
  joinRoomMatch: vi.fn(async () => ({
    id: 'match1', gameId: 'letters', roomCode: 'AB3C',
    players: [
      { id: 'me', role: 'viewer' },
      { id: 'other', role: 'typer' } // ya presente -> connectAndWait lanza sin esperar onPeersChange
    ],
    status: 'playing', createdAt: Date.now(), scores: new Map(), settings: {}
  })),
  onRoomUpdate: vi.fn(() => () => {}),
  leaveRoomMatch: vi.fn(async () => {}),
}));

vi.mock('../js/multiplayerSystem', () => ({
  multiplayerSystem: {
    createRoomMatch: vi.fn(),
    joinRoomMatch,
    sendGameEvent,
    onRoomUpdate,
    leaveRoomMatch,
  },
}));

import { init } from '../js/games/lettersFall.logic.js';
import GameInstanceRegistry from '../js/core/gameInstanceRegistry.js';

function buildLettersUi() {
  document.body.innerHTML = `
    <div data-ui="lettersModePanel"></div>
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
  `;

  const ui: any = {};
  for (const selector of [
    'lettersModePanel', 'roleChooser', 'roomStatus', 'roomStatusText', 'roomCodeDisplay',
    'modeSolo', 'modeCreate', 'modeJoin', 'roleViewer', 'roleTyper', 'joinCodeRow',
    'joinCodeInput', 'roleConfirm', 'roleBack', 'roomCancel', 'start', 'lettersInput',
    'lettersArea', 'lettersMessage', 'lettersDifficulty', 'lettersDifficultySelect',
    'lettersScore', 'lettersBest', 'lettersLives', 'lettersCard', 'lettersControls',
    'lettersRoleBadge', 'roleChooserLabel'
  ]) {
    ui[selector] = document.querySelector(`[data-ui="${selector}"]`);
  }
  return ui;
}

describe('Letters Fall: no reenvía viewer:state si el estado no cambió', () => {
  beforeEach(() => {
    sendGameEvent.mockClear();
  });

  it('updateUI() llamado varias veces sin cambios solo envía una vez', async () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeJoin.click();
    ui.roleViewer.click();
    ui.joinCodeInput.value = 'AB3C';
    ui.joinCodeInput.dispatchEvent(new Event('input'));
    ui.roleConfirm.click();

    // connectAndWait -> createRoomMatch (mockeado) resuelve async;
    // esperamos un tick para que launchCoop/startGameCard corran.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const game = GameInstanceRegistry.get<any>('letters');
    expect(game).toBeTruthy();

    // El constructor de LettersFallGame ya llamó updateUI() una vez
    // (mandando el estado inicial) antes de este punto — se limpia acá
    // para medir solo lo que pasa con llamadas *posteriores* sin
    // cambios de estado real.
    sendGameEvent.mockClear();
    // Llama updateUI() varias veces sin que score/best/lives cambien
    // entre medio — simula varios frames de animación consecutivos.
    // Como el estado no cambió respecto al último envío (el del
    // constructor), NINGUNA de estas debe generar un insert nuevo.
    game.updateUI();
    game.updateUI();
    game.updateUI();

    const viewerStateCalls = sendGameEvent.mock.calls.filter((args: any[]) => args[0] === 'viewer:state');
    expect(viewerStateCalls.length).toBe(0);
  });

  it('sí envía viewer:state cuando el score realmente cambia', async () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeJoin.click();
    ui.roleViewer.click();
    ui.joinCodeInput.value = 'AB3C';
    ui.joinCodeInput.dispatchEvent(new Event('input'));
    ui.roleConfirm.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const game = GameInstanceRegistry.get<any>('letters');
    expect(game).toBeTruthy();

    sendGameEvent.mockClear();
    game.state.score = 999; // simula un cambio real de puntaje
    game.updateUI();

    const viewerStateCalls = sendGameEvent.mock.calls.filter((args: any[]) => args[0] === 'viewer:state');
    expect(viewerStateCalls.length).toBe(1);
    expect(viewerStateCalls[0][1]).toMatchObject({ score: 999 });
  });

  it('leave() cierra la sala vía multiplayerSystem.leaveRoomMatch', async () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeJoin.click();
    ui.roleViewer.click();
    ui.joinCodeInput.value = 'AB3C';
    ui.joinCodeInput.dispatchEvent(new Event('input'));
    ui.roleConfirm.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const game = GameInstanceRegistry.get<any>('letters');
    expect(game).toBeTruthy();
    expect(typeof game.leave).toBe('function');

    leaveRoomMatch.mockClear();
    game.leave();
    await new Promise((r) => setTimeout(r, 0));

    expect(leaveRoomMatch).toHaveBeenCalledTimes(1);
  });
});
