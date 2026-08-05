import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/bombdefusalPasswordCluesConsistency.test.ts
 *
 * Bug: solvePassword(clues, serial) recibía las 4 palabras realmente
 * mostradas como botones (createPasswordModule elige 4 de las 8
 * PASSWORD_WORDS al azar) pero calculaba el índice de la solución
 * sobre las 8 palabras completas, ignorando `clues` por completo. Con
 * probabilidad ~50% la palabra correcta caía fuera de los 4 botones
 * visibles, dejando el módulo sin ninguna respuesta posible en
 * pantalla.
 *
 * Este test verifica, sobre muchas bombas generadas (para cubrir
 * distintos seriales y distintos subconjuntos aleatorios de clues),
 * que la solución que exige el módulo esté siempre entre las clues
 * mostradas.
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
      <label class="chip"><input type="checkbox" value="password" checked /></label>
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

describe('Bomb Defusal — el módulo password siempre tiene solución entre las clues mostradas', () => {
  beforeEach(() => {
    vi.resetModules();
    buildDom();
    (window as any).AudioContext = function AudioContextMock(this: any) {
      this.state = 'running';
      this.createOscillator = () => ({ connect: vi.fn(), frequency: { setValueAtTime: vi.fn() }, start: vi.fn(), stop: vi.fn(), type: '' });
      this.createGain = () => ({ connect: vi.fn(), gain: { value: 0, exponentialRampToValueAtTime: vi.fn() } });
      this.destination = {};
      this.resume = vi.fn();
    };
  });

  afterEach(() => {
    delete (window as any).AudioContext;
  });

  it('la palabra correcta está siempre entre los 4 botones de "Posibles" mostrados', async () => {
    for (let attempt = 0; attempt < 15; attempt++) {
      vi.resetModules();
      buildDom();
      const bombdefusal = await import('../js/games/bombdefusal.logic');
      bombdefusal.init(buildUi() as any);
      document.getElementById('start')!.dispatchEvent(new MouseEvent('click'));

      const cluesEl = document.querySelector('.bd-password-clues');
      expect(cluesEl).toBeTruthy();

      const shownWords = (cluesEl!.textContent || '')
        .replace('Posibles: ', '')
        .split(', ')
        .map(w => w.trim());
      expect(shownWords.length).toBe(4);

      // Clickear cada botón mostrado (palabra + OK) y ver si alguno
      // resuelve el módulo confirma, de forma end-to-end, que la
      // solución real está entre las clues visibles. Los botones de
      // palabra usan la clase `bd-code-key--wide` (ver renderPassword);
      // un solo click en la palabra solo la carga como input — hace
      // falta además clickear "OK" para que se evalúe contra la
      // solución real.
      let solved = false;
      for (const word of shownWords) {
        const wordBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.bd-code-key'))
          .find(b => b.textContent?.trim() === word);
        expect(wordBtn, `no se encontró botón para la clue "${word}"`).toBeTruthy();
        wordBtn!.dispatchEvent(new MouseEvent('click'));

        const okBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.bd-code-key'))
          .find(b => b.textContent?.trim() === 'OK');
        expect(okBtn, 'no se encontró el botón OK').toBeTruthy();
        okBtn!.dispatchEvent(new MouseEvent('click'));

        if (document.querySelector('.bd-module--solved')) {
          solved = true;
          break;
        }

        // Si no era la palabra correcta, el juego limpia mod.data.input
        // (y suma un strike), dejando el módulo listo para probar la
        // siguiente clue.
      }

      bombdefusal.stop();

      // La solución real del módulo debe estar SIEMPRE entre las 4
      // clues visibles: si ninguna de las 4 resuelve el módulo, el
      // bug original (índice calculado sobre las 8 palabras completas
      // en vez del subconjunto `clues`) sigue presente.
      expect(solved).toBe(true);
    }
  });
});
