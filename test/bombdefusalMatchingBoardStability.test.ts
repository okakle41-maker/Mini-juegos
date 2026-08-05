import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/bombdefusalMatchingBoardStability.test.ts
 *
 * Bug crítico encontrado en el módulo "matching" (memoria de símbolos)
 * de Bomb Defusal:
 *
 * renderMatching() armaba el tablero de 8 símbolos (4 pares) llamando
 * `mod.getSolution(state).pairs`, y como getSolution() invoca
 * solveMatching() (que hace su propio GameHelpers.shuffle() interno
 * en cada llamada), el tablero completo — símbolos Y posiciones —
 * se regeneraba desde cero en cada re-render. renderModules() se
 * llama después de cada click del jugador, así que el tablero
 * cambiaba literalmente después de cada click: era matemáticamente
 * imposible encontrar un segundo símbolo igual al primero, porque el
 * primero ya no estaba donde el jugador lo vio.
 *
 * Fix: el tablero barajado se genera una sola vez en
 * createMatchingModule() y se persiste en mod.data.board;
 * renderMatching() lo lee de ahí en vez de recalcularlo.
 *
 * Este test monta el juego completo (DOM real, sin mocks del propio
 * módulo) forzando que el único módulo generado sea "matching", hace
 * dos clicks (que disparan dos renders) y verifica que los símbolos
 * visibles en cada posición no cambien entre uno y otro.
 */

function buildDom() {
  document.body.innerHTML = `
    <div id="setupPhase"></div>
    <div id="gamePhase"></div>
    <button id="start"></button>
    <button id="restart"></button>
    <input id="timeLimit" value="300" />
    <input id="moduleCount" value="1" />
    <input id="maxStrikes" value="3" />
    <input id="difficulty" value="3" />
    <input id="animSpeed" value="400" />
    <input id="allowDup" type="checkbox" />
    <div id="modTypeChips">
      <label class="chip"><input type="checkbox" value="matching" checked /></label>
    </div>
    <div id="roleOperator"></div>
    <div id="roleExpert"></div>
    <div id="operatorPanel"></div>
    <div id="expertPanel"></div>
    <div id="bombGrid"></div>
    <div id="manualContent"></div>
    <div id="manualNav"></div>
    <div id="timerEl"></div>
    <div id="timerBar"></div>
    <div id="strikesEl"></div>
    <div id="modulesEl"></div>
    <div id="serialEl"></div>
    <div id="indicatorEl"><div class="bd-indicator-dot"></div></div>
    <div id="info"></div>
    <div id="result"></div>
  `;
}

function buildUi() {
  return {
    setupPhase: document.getElementById('setupPhase')!,
    gamePhase: document.getElementById('gamePhase')!,
    start: document.getElementById('start')!,
    restart: document.getElementById('restart')!,
    timeLimit: document.getElementById('timeLimit') as HTMLInputElement,
    moduleCount: document.getElementById('moduleCount') as HTMLInputElement,
    maxStrikes: document.getElementById('maxStrikes') as HTMLInputElement,
    difficulty: document.getElementById('difficulty') as HTMLInputElement,
    animSpeed: document.getElementById('animSpeed') as HTMLInputElement,
    allowDup: document.getElementById('allowDup') as HTMLInputElement,
    modTypeChips: Array.from(document.querySelectorAll<HTMLElement>('#modTypeChips .chip')),
    roleOperator: document.getElementById('roleOperator')!,
    roleExpert: document.getElementById('roleExpert')!,
    operatorPanel: document.getElementById('operatorPanel')!,
    expertPanel: document.getElementById('expertPanel')!,
    bombGrid: document.getElementById('bombGrid')!,
    manualContent: document.getElementById('manualContent')!,
    manualNav: document.getElementById('manualNav')!,
    timerEl: document.getElementById('timerEl')!,
    timerBar: document.getElementById('timerBar')!,
    strikesEl: document.getElementById('strikesEl')!,
    modulesEl: document.getElementById('modulesEl')!,
    serialEl: document.getElementById('serialEl')!,
    indicatorEl: document.getElementById('indicatorEl')!,
    info: document.getElementById('info')!,
    result: document.getElementById('result')!,
  };
}

describe('Bomb Defusal — el tablero del módulo matching no cambia entre renders', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    buildDom();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('los símbolos visibles en cada posición se mantienen estables tras varios renders', async () => {
    // AudioContext no existe en jsdom; el juego lo usa solo para sonido.
    (window as any).AudioContext = function AudioContextMock(this: any) {
      this.state = 'running';
      this.createOscillator = () => ({ connect: vi.fn(), frequency: { setValueAtTime: vi.fn() }, start: vi.fn(), stop: vi.fn(), type: '' });
      this.createGain = () => ({ connect: vi.fn(), gain: { value: 0, exponentialRampToValueAtTime: vi.fn() } });
      this.destination = {};
      this.resume = vi.fn();
    };

    const bombdefusal = await import('../js/games/bombdefusal.logic');
    bombdefusal.init(buildUi() as any);

    document.getElementById('start')!.dispatchEvent(new MouseEvent('click'));

    const cards = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.bd-matching-card'));
    expect(cards().length).toBe(8);

    // Seleccionamos las cards en índices 0 y 1: si no coinciden, el
    // juego las deja "seleccionadas y reveladas" (mod.data.selected)
    // hasta el próximo click, sin resolver el módulo. Leemos qué
    // símbolo queda expuesto en cada una de esas dos posiciones.
    cards()[0].dispatchEvent(new MouseEvent('click'));
    cards()[1].dispatchEvent(new MouseEvent('click'));

    const revealedFirstPass = cards().slice(0, 2).map(c => c.textContent || '');
    expect(revealedFirstPass.every(sym => sym !== '?' && sym !== '')).toBe(true);

    // Si por azar índices 0 y 1 coincidían, el módulo ya los marcó
    // "matched" y quedan visibles para siempre; si no coincidían, el
    // próximo click cualquiera los vuelve a tapar (renderModules() ya
    // corrió una vez con el click de arriba, que es exactamente el
    // escenario donde el bug regeneraba el tablero completo). En
    // cualquier caso, forzamos un render adicional clickeando otra
    // card sin completar el módulo y verificamos que las posiciones 0
    // y 1 sigan mostrando el mismo símbolo que antes (matched) o vuelvan
    // a mostrar '?' consistentemente si no matchearon — nunca un
    // símbolo DISTINTO al leído en el primer pase, que es lo que el
    // bug original producía.
    cards()[2].dispatchEvent(new MouseEvent('click'));
    cards()[2].dispatchEvent(new MouseEvent('click'));

    // Volvemos a seleccionar 0 y 1 (si no quedaron "matched", estarán
    // tapadas de nuevo; las re-clickeamos para revelarlas otra vez).
    const stillMatched = cards()[0].classList.contains('bd-matching-card--matched');
    if (!stillMatched) {
      cards()[0].dispatchEvent(new MouseEvent('click'));
      cards()[1].dispatchEvent(new MouseEvent('click'));
    }
    const revealedSecondPass = cards().slice(0, 2).map(c => c.textContent || '');

    expect(revealedSecondPass).toEqual(revealedFirstPass);
  });
});
