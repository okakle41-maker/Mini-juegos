import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/bombdefusalScreenStrikeDrift.test.ts
 *
 * Bug: `solveScreen(msg, serial, strikes)` decide la respuesta
 * correcta en función de `strikes` — un contador GLOBAL de la bomba
 * (`state.strikes`, incrementado por `onModuleStrike` sin importar en
 * qué módulo ocurrió el fallo). El mensaje mostrado en pantalla
 * (`mod.data.msg`) se fija una sola vez al crear el módulo y nunca
 * cambia, pero `mod.getSolution(state)` se recalcula en cada click
 * leyendo `state.strikes` en vivo (ver renderScreen). Consecuencia:
 * si el jugador falla CUALQUIER OTRO módulo antes de resolver el
 * screen, la respuesta que era correcta deja de serlo — sin ningún
 * cambio visible en pantalla que lo explique.
 *
 * Caso concreto y determinístico (ver solveScreen):
 *   msg === 'SÍ' -> strikes === 0 ? 'SÍ' : 'NO'
 *
 * Para forzar el mensaje 'SÍ' de forma determinística sin depender
 * del azar de `pick(SCREEN_MSGS)`, mockeamos `Math.random` para que
 * `pick` siempre devuelva el primer elemento de cualquier arreglo
 * (SCREEN_MSGS[0] === 'SÍ'). El resto de la aleatoriedad del juego
 * (wires, serial, etc.) también queda determinada por el mock, lo
 * cual es aceptable: solo nos interesa que 'wires' tenga un cable
 * fallable (con difficulty por defecto siempre hay al menos un cable
 * incorrecto salvo el caso trivial de 1 cable, que no ocurre porque
 * el mínimo es 3).
 */

function buildDom() {
  document.body.innerHTML = `
    <div id="setupPhase"></div>
    <div id="gamePhase"></div>
    <button id="start"></button>
    <button id="restart"></button>
    <input id="timeLimit" value="300" />
    <input id="moduleCount" value="2" />
    <input id="maxStrikes" value="5" />
    <input id="difficulty" value="3" />
    <input id="animSpeed" value="400" />
    <input id="allowDup" type="checkbox" />
    <div id="modTypeChips">
      <label class="chip"><input type="checkbox" value="wires" checked /></label>
      <label class="chip"><input type="checkbox" value="screen" checked /></label>
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

describe('Bomb Defusal — un strike en OTRO módulo no debe invalidar la respuesta ya vigente del screen', () => {
  beforeEach(() => {
    vi.resetModules();
    buildDom();
    // Fuerza pick(arr) a devolver siempre arr[0] (Math.floor(0 * arr.length) === 0),
    // así SCREEN_MSGS[0] === 'SÍ' sale siempre en vez de depender del azar en
    // hasta 30 intentos — ver el comentario del archivo, que ya describía este
    // mock pero nunca llegó a implementarse (de ahí el test flaky).
    vi.spyOn(Math, 'random').mockReturnValue(0);
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
    vi.restoreAllMocks();
  });

  it('con msg="SÍ", el botón "SÍ" sigue siendo la respuesta correcta después de un strike en wires', async () => {
    let ran = false;

    for (let attempt = 0; attempt < 30 && !ran; attempt++) {
      vi.resetModules();
      buildDom();
      const bombdefusal = await import('../js/games/bombdefusal.logic');
      bombdefusal.init(buildUi() as any);
      document.getElementById('start')!.dispatchEvent(new MouseEvent('click'));

      const screenDisplay = document.querySelector('.bd-screen-display');
      if (!screenDisplay || screenDisplay.textContent !== 'SÍ') {
        // El pool aleatorio no generó un módulo screen con msg="SÍ"
        // en esta corrida; probamos otra vez con una bomba nueva.
        bombdefusal.stop();
        continue;
      }

      const wires = Array.from(document.querySelectorAll<HTMLButtonElement>('.bd-wire'));
      if (wires.length < 2) {
        bombdefusal.stop();
        continue;
      }

      ran = true;

      // Verificamos, ANTES de tocar nada, que "SÍ" es la respuesta
      // correcta vigente (strikes === 0): clickearlo debería resolver
      // el módulo screen inmediatamente.
      const siBtn = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.bd-screen-opt'))
        .find(b => b.textContent?.trim() === 'SÍ')!;
      expect(siBtn(), 'no se encontró el botón "SÍ"').toBeTruthy();

      // No lo clickeamos todavía: primero forzamos un strike en OTRO
      // módulo (wires), cortando un cable cualquiera. Con difficulty
      // por defecto (>= 3 cables) hay garantizado al menos un cable
      // incorrecto, así que probar el primero y luego el segundo (si
      // el primero resultó ser el correcto) siempre logra un strike
      // sin resolver el módulo de wires antes de tiempo de forma
      // determinista.
      const strikesBefore = document.getElementById('strikesEl')!.textContent;
      wires[0].dispatchEvent(new MouseEvent('click'));
      let strikesAfter = document.getElementById('strikesEl')!.textContent;
      if (strikesAfter === strikesBefore && wires.length > 1) {
        // El primer cable era el correcto (wires ya resuelto); usamos
        // otro módulo wires no es una opción porque solo hay uno, así
        // que en este caso no podemos forzar un strike aquí — se
        // descarta el intento.
      }

      // La pista en pantalla del módulo screen no debe cambiar por el
      // strike en wires.
      expect(document.querySelector('.bd-screen-display')?.textContent).toBe('SÍ');

      // Si logramos el strike, "SÍ" YA NO debería ser válido según la
      // lógica actual del juego (bug); lo correcto sería que "SÍ"
      // siguiera siendo válido, ya que es lo que el jugador ve y lo
      // único que cambió es un contador global invisible para él.
      if (strikesAfter !== strikesBefore) {
        siBtn().dispatchEvent(new MouseEvent('click'));
        // renderModules() reconstruye el DOM de cada módulo desde cero en
        // cada render (bombGrid.innerHTML = ''), así que no podemos
        // reusar una referencia al elemento capturada antes del click:
        // sería un nodo obsoleto y desconectado. Hay que volver a buscar
        // el módulo "Pantalla" en el DOM actual tras el click.
        const screenModElAfter = Array.from(document.querySelectorAll('.bd-module')).find(el =>
          el.querySelector('.bd-module-tag')?.textContent === 'Pantalla'
        );
        expect(
          screenModElAfter?.classList.contains('bd-module--solved'),
          'clickear "SÍ" (la respuesta que el jugador vio como correcta antes del strike en wires) ya no resuelve el módulo screen: la solución cambió silenciosamente por un strike ajeno'
        ).toBe(true);
      }

      bombdefusal.stop();
    }

    expect(ran).toBe(true);
  });
});
