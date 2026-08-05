import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/virusOverloadStopGameKeyupLeak.test.ts
 *
 * Bug: `stopGame()` (invocada por el `stop()` exportado, el hook de
 * salida de vista real) solo hacía
 * `document.removeEventListener('keydown', handleKeyPress)`, a
 * diferencia de `endGame()` (el camino de "game over" normal), que
 * remueve TANTO 'keydown' como 'keyup'. Si el jugador salía de la
 * vista a mitad de partida (en vez de llegar a un game over real), el
 * listener de 'keyup' quedaba pegado a `document` para siempre — cada
 * tecla que el usuario soltara en cualquier otra parte de la app
 * seguía disparando `handleKeyUp`, que lee `gameState` (una partida ya
 * "detenida" pero cuyo objeto sigue vivo en el closure del módulo).
 *
 * Test: se cuentan las llamadas a `document.removeEventListener` con
 * type 'keyup' durante `stop()` — antes del fix, cero; con el fix,
 * exactamente una (apareada con el 'keydown' que sí se removía).
 */

function buildDom() {
  document.body.innerHTML = `
    <button id="start"></button>
    <div id="setupPhase"></div>
    <div id="gamePhase"></div>
    <div id="endPhase"></div>
    <div id="phaseEl"></div>
    <div id="gameArea"></div>
    <div id="virusContainer"></div>
    <div id="eventBanner"></div>
    <div id="eventText"></div>
    <div id="resultEl"></div>
    <div id="resultScore"></div>
    <div id="resultTime"></div>
    <div id="resultVirus"></div>
  `;
}

function buildUi() {
  return {
    start: document.getElementById('start')!,
    setupPhase: document.getElementById('setupPhase')!,
    gamePhase: document.getElementById('gamePhase')!,
    endPhase: document.getElementById('endPhase')!,
    phaseEl: document.getElementById('phaseEl')!,
    gameArea: document.getElementById('gameArea')!,
    virusContainer: document.getElementById('virusContainer')!,
    eventBanner: document.getElementById('eventBanner')!,
    eventText: document.getElementById('eventText')!,
    resultEl: document.getElementById('resultEl')!,
    resultScore: document.getElementById('resultScore')!,
    resultTime: document.getElementById('resultTime')!,
    resultVirus: document.getElementById('resultVirus')!,
  };
}

describe('Virus Overload — stop() no debe dejar el listener de keyup pegado a document', () => {
  beforeEach(() => {
    vi.resetModules();
    buildDom();
    (window as any).AudioContext = function AudioContextMock(this: any) {
      this.state = 'running';
      this.createOscillator = () => ({
        connect: vi.fn(),
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
        type: '',
      });
      this.createGain = () => ({
        connect: vi.fn(),
        gain: { value: 0, exponentialRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
      });
      this.destination = {};
      this.resume = vi.fn();
    };
  });

  afterEach(() => {
    delete (window as any).AudioContext;
    vi.restoreAllMocks();
  });

  it('stop() remueve tanto keydown como keyup, igual que endGame()', async () => {
    const virusOverload = await import('../js/games/virusOverload.logic');
    virusOverload.init(buildUi() as any);
    document.getElementById('start')!.dispatchEvent(new MouseEvent('click'));

    const removeSpy = vi.spyOn(document, 'removeEventListener');

    virusOverload.stop();

    const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
    expect(removedTypes).toContain('keydown');
    expect(
      removedTypes,
      'stop() no removió el listener de "keyup" — queda pegado a document indefinidamente tras salir de la vista a mitad de partida'
    ).toContain('keyup');
  });
});
