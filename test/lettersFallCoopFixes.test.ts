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
  `;

  const ui: any = {};
  for (const selector of [
    'lettersModePanel', 'roleChooser', 'roomStatus', 'roomStatusText', 'roomCodeDisplay',
    'modeSolo', 'modeCreate', 'modeJoin', 'roleViewer', 'roleTyper', 'joinCodeRow',
    'joinCodeInput', 'roleConfirm', 'roleBack', 'roomCancel', 'start', 'retry', 'lettersInput',
    'lettersArea', 'lettersMessage', 'lettersDifficulty', 'lettersDifficultySelect',
    'lettersScore', 'lettersBest', 'lettersLives', 'lettersCard', 'lettersControls',
    'lettersRoleBadge', 'roleChooserLabel',
    'modeVersus', 'versusChooser', 'versusCreate', 'versusJoin', 'versusJoinCodeRow',
    'versusJoinCodeInput', 'versusJoinConfirm', 'versusBack'
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

describe('Letters Fall: reset() inicializa wordSpeed/spawnInterval desde la dificultad', () => {
  /**
   * Regresión: reset() dejaba wordSpeed y spawnInterval en su default
   * de 0 (ver constructor de LettersFallGame) sin pisarlos con
   * getDifficultyConfig(). spawnWord() instanciaba cada Word con
   * speed:0, así que `word.y += word.speed * deltaTime` en update()
   * nunca las movía — las palabras se quedaban congeladas en y=20 para
   * siempre, y por lo tanto tampoco llegaban nunca a la zona de
   * peligro que dispara loseLife() (el juego nunca perdía vidas por
   * ese motivo). No se puede llamar a start() en este test (dispara
   * requestAnimationFrame real), así que se verifica directamente el
   * resultado de reset(), que es donde vive el fix.
   */
  it('wordSpeed queda en base a config.speed*4, no en 0', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    const game = GameInstanceRegistry.get<any>('letters');
    expect(game).toBeTruthy();

    game.reset();

    expect(game.state.wordSpeed).toBeGreaterThan(0);
  });

  it('spawnInterval arranca en config.spawnStart, no en 0', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    const game = GameInstanceRegistry.get<any>('letters');
    expect(game).toBeTruthy();

    game.reset();

    const config = game.getDifficultyConfig();
    expect(game.state.spawnInterval).toBe(config.spawnStart);
  });

  it('una palabra creada por spawnWord() efectivamente se mueve con el tiempo', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    const game = GameInstanceRegistry.get<any>('letters');
    game.reset();
    game.spawnWord();

    const word = game.state.words[0];
    const initialY = word.y;
    word.y += word.speed * 1; // simula 1s de deltaTime, como haría update()

    expect(word.y).toBeGreaterThan(initialY);
  });
});

describe('Letters Fall: Enter limpia el input aunque el intento falle', () => {
  it('en modo solo, un Enter con la palabra incorrecta igual vacía el input', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    ui.lettersInput.value = 'PALABRA_QUE_NO_EXISTE';
    ui.lettersInput.dispatchEvent(new Event('input'));
    ui.lettersInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(ui.lettersInput.value).toBe('');
  });
});

describe('Letters Fall: stop() restaura el panel de selección de modo', () => {
  it('vuelve a mostrar lettersModePanel y oculta lettersCard tras salir de una partida solo', async () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    // startGameCard oculta el panel de modos y muestra el tablero.
    expect(ui.lettersModePanel.classList.contains('hidden')).toBe(true);
    expect(ui.lettersCard.classList.contains('hidden')).toBe(false);

    stop();

    expect(ui.lettersModePanel.classList.contains('hidden')).toBe(false);
    expect(ui.lettersCard.classList.contains('hidden')).toBe(true);
  });

  it('vuelve a mostrar lettersModePanel tras salir de una sala coop en espera', async () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeCreate.click();
    ui.roleViewer.click();

    expect(ui.lettersModePanel.classList.contains('hidden')).toBe(false);
    expect(ui.roleChooser.classList.contains('hidden')).toBe(false);

    stop();

    expect(ui.lettersModePanel.classList.contains('hidden')).toBe(false);
    expect(ui.roleChooser.classList.contains('hidden')).toBe(true);
    expect(ui.lettersModePanel.querySelector('.letters-mode-options')?.classList.contains('hidden')).toBe(false);
  });
});

describe('Letters Fall: checkInputMatch() solo se dispara con Enter, no en cada frame', () => {
  /**
   * Regresión: update() llamaba a checkInputMatch() en cada frame de
   * requestAnimationFrame (~60/s), no solo al presionar Enter. Si el
   * texto parcial tipeado coincidía por casualidad con alguna palabra
   * en pantalla, se "confirmaba" solo sin que el jugador apretara
   * Enter — típicamente al escribir rápido, la palabra se borraba a
   * mitad de tecleo. Este test simula esa carrera directamente sobre
   * update(), sin requestAnimationFrame real.
   */
  it('un input parcial que coincide con una palabra en pantalla NO se borra sin Enter', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    const game = GameInstanceRegistry.get<any>('letters');
    game.reset();
    game.spawnWord();
    const word = game.state.words[0];
    word.text = 'AGUA'; // palabra conocida en pantalla

    // El jugador tipeó exactamente "AGUA" como paso intermedio de otra
    // palabra más larga, sin presionar Enter todavía.
    ui.lettersInput.value = 'AGUA';
    ui.lettersInput.dispatchEvent(new Event('input'));
    expect(game.state.currentInput).toBe('AGUA');

    // Simula un frame de update() (sin rAF real) tal como antes lo
    // llamaba el loop en cada frame.
    game.state.lastTime = performance.now();
    game.update(performance.now() + 16);

    // La palabra NO debería haberse removido, ni el input limpiado,
    // porque no hubo Enter.
    expect(game.state.words).toContain(word);
    expect(ui.lettersInput.value).toBe('AGUA');
  });

  it('con Enter sí se confirma la palabra coincidente', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    const game = GameInstanceRegistry.get<any>('letters');
    game.reset();
    game.spawnWord();
    const word = game.state.words[0];
    word.text = 'AGUA';

    ui.lettersInput.value = 'AGUA';
    ui.lettersInput.dispatchEvent(new Event('input'));
    ui.lettersInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(game.state.words).not.toContain(word);
    expect(ui.lettersInput.value).toBe('');
  });
});

describe('Letters Fall: reintentar en la misma sala tras game over', () => {
  it('gameOver() muestra el botón "Jugar de nuevo" en modo solo', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    const game = GameInstanceRegistry.get<any>('letters');
    game.reset();
    game.state.active = true;
    game.state.lives = 1;
    game.gameOver();

    expect(ui.retry.classList.contains('hidden')).toBe(false);
  });

  it('retry() reinicia la partida y vuelve a ocultar el botón', () => {
    const ui = buildLettersUi();
    init(ui);
    ui.modeSolo.click();

    const game = GameInstanceRegistry.get<any>('letters');
    game.reset();
    game.state.score = 500;
    game.state.active = true;
    game.gameOver();
    expect(ui.retry.classList.contains('hidden')).toBe(false);

    ui.retry.click();

    expect(game.state.score).toBe(0);
    expect(game.state.active).toBe(true);
    expect(ui.retry.classList.contains('hidden')).toBe(true);
  });

  it('en coop, retry() del viewer emite viewer:retry para rehabilitar al typer', async () => {
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
    game.state.active = true;
    game.gameOver();
    game.retry();

    const retryCalls = sendGameEvent.mock.calls.filter((args: any[]) => args[0] === 'viewer:retry');
    expect(retryCalls.length).toBe(1);
  });
});
