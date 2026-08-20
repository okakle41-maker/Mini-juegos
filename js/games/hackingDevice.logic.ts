/**
 * hackingDevice.logic.ts
 *
 * Lógica pesada extraída de hackingDevice.ts para lazy loading —
 * ver `logic` en hackingDevice.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
 *
 * Mecánica: el jugador controla un CURSOR de N celdas consecutivas
 * (N = cantidad de códigos en la secuencia objetivo, ej. 4 códigos de
 * 2 caracteres cada uno) que se mueve por la grilla con flechas/WASD.
 * Se confirma con Enter/Espacio: gana la ronda si, en ese instante,
 * las N celdas bajo el cursor son exactamente los N códigos del
 * objetivo, en ese orden.
 *
 * Modelo de "anillo lineal" (clave para que cursor y objetivo puedan
 * alinearse, y para el recorrido de movimiento pedido):
 * en vez de razonar en coordenadas (fila, columna) sueltas, toda la
 * grilla se aplana en un único anillo circular de tamaño size*size,
 * recorrido en este orden fijo:
 *   - arranca en la fila de ABAJO, dentro de esa fila va de DERECHA a
 *     IZQUIERDA;
 *   - al agotar una fila, continúa en la fila de arriba (también
 *     derecha → izquierda);
 *   - al llegar a la esquina superior-izquierda (última celda del
 *     anillo), vuelve a la esquina inferior-derecha (primera celda) y
 *     sigue — wrap total de todo el anillo, no por fila.
 * Tanto el CURSOR como las celdas OBJETIVO son un tramo de N índices
 * consecutivos dentro de este mismo anillo — por eso siempre es
 * posible alinearlos exactamente (antes, los objetivos podían quedar
 * dispersos por la grilla mientras el cursor era siempre contiguo, lo
 * que hacía la ronda imposible de ganar).
 *
 * Movimiento de fondo cada tick (moveStep): todo el contenido de la
 * grilla avanza UNA posición a lo largo del anillo (equivalente a que
 * cada celda "herede" el valor de la siguiente en el recorrido
 * descripto arriba — de ahí que, visualmente, el contenido fluya fila
 * por fila hacia la derecha al subir de fila). El modo elegido decide
 * qué pasa con las celdas que NO son objetivo:
 *   - 'flow'   (default): toda la grilla avanza junto por el anillo,
 *     como un único bloque.
 *   - 'random': el resto de celdas (todo menos las del objetivo) se
 *     reordena/baraja entre sí cada tick — las celdas objetivo siguen
 *     avanzando por el anillo igual que en 'flow', son las únicas que
 *     mantienen movimiento predecible.
 * Como el avance es por celda individual (no por fila completa), un
 * tramo de N celdas consecutivas (cursor u objetivo) puede terminar
 * repartido entre el final de una fila y el principio de la
 * siguiente — es esperado, ver renderBoard/cursorCells más abajo.
 */

import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';

interface HackingUi {
  start: HTMLButtonElement;
  hackingBoard: HTMLElement;
  hackingSize: HTMLInputElement;
  hackingLength: HTMLInputElement;
  hackingTime: HTMLInputElement;
  hackingRounds: HTMLInputElement;
  hackingMoveMode: HTMLSelectElement | null;
  hackingHighlightTarget: HTMLInputElement | null;
  hackingStreak: HTMLElement;
  hackingMax: HTMLElement;
  hackingTimer: HTMLElement;
  hackingTarget: HTMLElement;
  hackingControlsHint: HTMLElement | null;
  hackingInfo: HTMLElement;
}

type MoveMode = 'flow' | 'random';

interface HackingState {
  targetCodes: string[]; // secuencia completa, ej. ['NM','YK','BO','LW']
  /** Índice (en el anillo) de la primera celda del objetivo — el objetivo ocupa [targetStartIdx, targetStartIdx+N-1] mod size*size. */
  targetStartIdx: number;
  grid: string[][];
  size: number;
  length: number; // longitud de cada código (2 caracteres normalmente)
  time: number;
  rounds: number;
  currentRound: number;
  streak: number;
  maxStreak: number;
  timer: ReturnType<typeof setInterval> | null;
  timeLeft: number;
  playing: boolean;
  moveTimer: ReturnType<typeof setInterval> | null;
  moveInterval: number;
  moveMode: MoveMode;
  /** Índice (en el anillo) de la primera celda del cursor — el cursor ocupa [cursorIdx, cursorIdx+N-1] mod size*size. */
  cursorIdx: number;
  roundTransitionTimeout: ReturnType<typeof setTimeout> | null;
}

let activeState: HackingState | null = null; // referencia al state activo, usada por stop()
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

const CHAR_POOL_CLASS: Record<string, string> = {
  cyrillic: 'cyrillic',
  arabic: 'arabic',
  chinese: 'cjk'
};

export function init(rawUi: GameUi): void {
  const ui = rawUi as unknown as HackingUi;
  const { start: startHacking, hackingBoard, hackingSize, hackingLength,
          hackingTime, hackingRounds, hackingMoveMode, hackingHighlightTarget,
          hackingStreak, hackingMax, hackingTimer, hackingTarget,
          hackingControlsHint, hackingInfo } = ui;

  if (!startHacking) return; // sección no presente

  hackingBoard.after(startHacking);
  if (hackingControlsHint) hackingControlsHint.classList.remove('hidden');

  const pools: Record<string, string> = {
    letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '✉☢✦☮♆☎♞♫☚✧✪✦✶',
    greek: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩψσπφ',
    runes: 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ',
    braille: '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚',
    cyrillic: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
    arabic: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
    chinese: '中国人大小天地山水火木金土日月东西南北上下左右文字学生力心手目'
  };

  const state: HackingState = {
    targetCodes: [],
    targetStartIdx: 0,
    grid: [],
    size: 10,
    length: 2,
    time: 15,
    rounds: 5,
    currentRound: 0,
    streak: 0,
    maxStreak: 0,
    timer: null,
    timeLeft: 0,
    playing: false,
    moveTimer: null,
    moveInterval: 1100,
    moveMode: 'flow',
    cursorIdx: 0,
    roundTransitionTimeout: null
  };
  activeState = state;

  function getSelectedPools(): string {
    const opts = Array.from(
      document.getElementById('soup')!.querySelectorAll<HTMLElement>('.symbol-chip.active')
    ).map(el => el.dataset.value || '');
    let chars = '';
    opts.forEach(k => {
      if (pools[k]) chars += pools[k];
    });
    if (!chars) {
      chars = pools.letters + pools.numbers;
    }
    return chars;
  }

  /** Clase CSS de tipografía especial a aplicar según los pools activos (cirílico/árabe/chino tienen fuente definida en css/hacking.css; griego/runas/braille/símbolos no la necesitan). */
  function getActivePoolClass(): string {
    const active = Array.from(
      document.getElementById('soup')!.querySelectorAll<HTMLElement>('.symbol-chip.active')
    ).map(el => el.dataset.value || '');
    for (const key of active) {
      if (CHAR_POOL_CLASS[key]) return CHAR_POOL_CLASS[key];
    }
    return '';
  }

  document.getElementById('soup')!.querySelectorAll<HTMLElement>('.symbol-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', String(isActive));
    });
  });

  // Re-renderiza el tablero al toggle de "Mostrar objetivo" para que el
  // resaltado amarillo de las celdas objetivo aparezca/desaparezca en
  // vivo, sin esperar al próximo moveStep (que recién ocurre en el
  // siguiente tick del moveTimer).
  hackingHighlightTarget?.addEventListener('change', () => {
    if (state.playing) renderBoard();
  });

  function randomChar(chars: string): string {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  function randomCode(chars: string): string {
    let code = '';
    for (let i = 0; i < state.length; i++) code += randomChar(chars);
    return code;
  }

  function wrap(n: number, mod: number): number {
    return ((n % mod) + mod) % mod;
  }

  const ringSize = () => state.size * state.size;

  /**
   * Convierte (fila, columna) al índice dentro del anillo lineal — ver
   * comentario de cabecera para el orden exacto (empieza abajo,
   * derecha → izquierda por fila, sube de fila al agotarla).
   */
  function idxOf(r: number, c: number): number {
    return (state.size - 1 - r) * state.size + (state.size - 1 - c);
  }

  /** Inversa de idxOf: de índice de anillo a (fila, columna). */
  function posOf(idx: number): { r: number; c: number } {
    const wrapped = wrap(idx, ringSize());
    const r = state.size - 1 - Math.floor(wrapped / state.size);
    const c = state.size - 1 - (wrapped % state.size);
    return { r, c };
  }

  /**
   * Los N índices de anillo que ocupa un tramo que arranca en `startIdx`,
   * en el orden espacial en que se LEE en pantalla (izquierda a
   * derecha), no en el orden ascendente del anillo interno.
   *
   * idxOf/posOf (arriba) recorren cada fila de DERECHA a IZQUIERDA al
   * mapear (r,c) -> índice de anillo (ver comentario de cabecera del
   * archivo) — por diseño, para que "avanzar +1" en el anillo mueva el
   * contenido de la grilla hacia la derecha en pantalla en cada
   * moveStep(). Pero eso significa que un tramo [startIdx, startIdx+1,
   * ..., startIdx+N-1] recorrido en ESE orden (ascendente) cae, en
   * pantalla, de DERECHA a IZQUIERDA dentro de la fila.
   *
   * targetCodes se genera y se muestra en el HUD ("OBJETIVO: ...") en
   * orden natural de lectura izquierda-a-derecha (targetCodes[0] primero).
   * Antes, targetCells()/cursorCells() asignaban targetCodes[0] al primer
   * índice del tramo (ascendente) = la celda más a la DERECHA del grupo,
   * y targetCodes[N-1] a la celda más a la IZQUIERDA — quedando el
   * highlight en pantalla invertido respecto al texto del objetivo. Se
   * podía leer perfecto ubicando el cursor sobre las celdas ya
   * resaltadas (mismo cálculo interno de índices en ambos lados), pero
   * intentar alinear el cursor guiándose por el texto del objetivo
   * fallaba porque la lectura visual izquierda->derecha no correspondía
   * al orden [0..N-1] esperado por attemptConfirm().
   *
   * Fix: se invierte el orden de los índices devueltos (no el rango que
   * ocupan), así el índice 0 del array resultante siempre corresponde a
   * la celda más a la izquierda del tramo en pantalla — alineado con
   * targetCodes[0]/cursorCells()[0].
   */
  /**
   * Los N índices de anillo que ocupa un tramo, en orden de LECTURA EN
   * PANTALLA (izquierda a derecha), no en el orden ascendente del
   * anillo interno.
   *
   * idxOf/posOf (arriba) recorren cada fila de DERECHA a IZQUIERDA al
   * mapear (r,c) -> índice de anillo (ver comentario de cabecera del
   * archivo) — por diseño, para que "avanzar +1" en el anillo desplace
   * el contenido de la grilla hacia la derecha en pantalla en cada
   * moveStep(). Eso significa que, en pantalla, el índice de anillo
   * DECRECE al leer una fila de izquierda a derecha — por eso acá se
   * resta `i` (startIdx - i) en vez de sumarlo: así indices[0] siempre
   * cae en la celda más a la izquierda del tramo, e indices[N-1] en la
   * más a la derecha, sin importar si el tramo cruza el borde de fila.
   *
   * targetCodes se genera y se muestra en el HUD ("OBJETIVO: ...") en
   * orden natural de lectura izquierda-a-derecha (targetCodes[0]
   * primero). Con el signo original (+i, ascendente), targetCells()
   * asignaba targetCodes[0] a la celda más a la DERECHA del grupo
   * resaltado y targetCodes[N-1] a la más a la IZQUIERDA — el highlight
   * en pantalla quedaba invertido respecto al texto del objetivo. Se
   * podía ganar igual parándose sobre las celdas ya resaltadas (cursor y
   * objetivo comparten el mismo cálculo interno, así que siempre
   * coinciden entre sí), pero intentar alinear el cursor guiándose por
   * el texto del objetivo fallaba, porque la lectura visual
   * izquierda->derecha no correspondía al orden [0..N-1] que
   * attemptConfirm() espera.
   */
  function spanIndices(startIdx: number, width: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < width; i++) indices.push(wrap(startIdx - i, ringSize()));
    return indices;
  }

  /** Genera la secuencia objetivo y elige un tramo contiguo del anillo (mismo ancho que el cursor) para ubicarla — así siempre es posible alinear el cursor exactamente con el objetivo. */
  function generateTargets(): void {
    const chars = getSelectedPools();
    const count = 4; // cantidad fija de códigos en la secuencia, igual al ancho del cursor
    state.targetCodes = [];
    for (let i = 0; i < count; i++) {
      state.targetCodes.push(randomCode(chars));
    }
    state.targetStartIdx = Math.floor(Math.random() * ringSize());

    const strong = hackingTarget.querySelector('strong');
    if (strong) strong.textContent = state.targetCodes.join('  ');
    const showTarget = !hackingHighlightTarget || hackingHighlightTarget.checked;
    hackingTarget.classList.toggle('hidden', !showTarget);
  }

  /** Posiciones {r,c} actuales de las celdas objetivo, en el mismo orden que targetCodes. */
  function targetCells(): Array<{ r: number; c: number }> {
    return spanIndices(state.targetStartIdx, state.targetCodes.length || 4).map(posOf);
  }

  function createGrid(): void {
    state.grid = [];
    const chars = getSelectedPools();
    for (let r = 0; r < state.size; r++) {
      const row: string[] = [];
      for (let c = 0; c < state.size; c++) {
        row.push(randomCode(chars));
      }
      state.grid.push(row);
    }
    // Las celdas objetivo pisan lo que haya en su posición actual.
    const cells = targetCells();
    cells.forEach((p, i) => {
      state.grid[p.r][p.c] = state.targetCodes[i];
    });
  }

  /** Posiciones {r,c} actuales del cursor, en orden. */
  function cursorCells(): Array<{ r: number; c: number }> {
    const width = state.targetCodes.length || 4;
    return spanIndices(state.cursorIdx, width).map(posOf);
  }

  function renderBoard(): void {
    hackingBoard.innerHTML = '';
    hackingBoard.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
    const poolClass = getActivePoolClass();
    const cursor = cursorCells();
    const cursorSet = new Set(cursor.map(p => `${p.r},${p.c}`));
    const showTarget = !hackingHighlightTarget || hackingHighlightTarget.checked;
    const targetSet = new Set(targetCells().map(p => `${p.r},${p.c}`));

    state.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const div = document.createElement('div');
        div.className = 'symbol-cell';
        if (poolClass) div.classList.add(poolClass);

        div.innerHTML = Array.from(cell)
          .map(ch => `<span>${ch}</span>`)
          .join('');

        div.dataset.pos = `${r},${c}`;
        if (showTarget && targetSet.has(`${r},${c}`)) div.classList.add('highlight');
        if (cursorSet.has(`${r},${c}`)) div.classList.add('cursor');
        hackingBoard.appendChild(div);
      });
    });
    hackingBoard.classList.remove('hidden');
  }

  /** Modo 'flow': toda la grilla avanza una posición a lo largo del anillo — cada celda hereda el valor de la SIGUIENTE en el recorrido idxOf (ver cabecera). */
  function shiftGridAlongRing(): void {
    const size = state.size;
    const newGrid: string[][] = Array.from({ length: size }, () => new Array(size).fill(''));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const sourcePos = posOf(idxOf(r, c) + 1);
        newGrid[r][c] = state.grid[sourcePos.r][sourcePos.c];
      }
    }
    state.grid = newGrid;
  }

  /** Modo 'random': baraja el contenido de todas las celdas que NO son celda-objetivo (Fisher-Yates sobre sus valores, posiciones fijas). */
  function shuffleNonTargetCells(): void {
    const targetPositions = new Set(targetCells().map(p => `${p.r},${p.c}`));
    const positions: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (!targetPositions.has(`${r},${c}`)) positions.push({ r, c });
      }
    }
    const values = positions.map(p => state.grid[p.r][p.c]);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    positions.forEach((p, i) => {
      state.grid[p.r][p.c] = values[i];
    });
  }

  function moveStep(): void {
    state.targetStartIdx = wrap(state.targetStartIdx + 1, ringSize());
    if (state.moveMode === 'flow') {
      shiftGridAlongRing();
    } else {
      shuffleNonTargetCells();
    }
    // Las celdas objetivo siempre pisan su nueva posición con su código,
    // en ambos modos — así nunca quedan tapadas por el shift/shuffle de
    // fondo (el shift ya las arrastra correctamente, pero esto es un
    // refuerzo barato y evita depender de ese detalle de orden).
    const cells = targetCells();
    cells.forEach((p, i) => {
      state.grid[p.r][p.c] = state.targetCodes[i];
    });
    renderBoard();
  }

  /** Mueve el cursor a lo largo del anillo. Izquierda/derecha = 1 paso; arriba/abajo = un paso de tamaño `size` (una fila entera), para conservar control fino y grueso pese a que el cursor ahora es 1D. */
  function moveCursor(steps: number): void {
    if (!state.playing) return;
    state.cursorIdx = wrap(state.cursorIdx + steps, ringSize());
    renderBoard();
  }

  function attemptConfirm(): void {
    if (!state.playing) return;
    const cells = cursorCells();
    const read = cells.map(p => state.grid[p.r][p.c]);
    const isCorrect = read.length === state.targetCodes.length
      && read.every((val, i) => val === state.targetCodes[i]);

    if (isCorrect) {
      audioManager.play('good');
      state.streak += 1;
      state.maxStreak = Math.max(state.maxStreak, state.streak);
      hackingStreak.textContent = `STREAK: ${state.streak}`;
      hackingMax.textContent = `MAX STREAK: ${state.maxStreak}`;
      hackingInfo.textContent = `¡Correcto! Generando nuevo tablero...`;
      markCorrectFlash();
      resetTimer();
      state.roundTransitionTimeout = setTimeout(() => {
        state.roundTransitionTimeout = null;
        nextRound(true);
      }, 600);
    } else {
      audioManager.play('miss');
      hackingInfo.textContent = `Incorrecto. Seguí buscando.`;
      markWrongFlash();
    }
  }

  function markCorrectFlash(): void {
    cursorCells().forEach(p => {
      const el = hackingBoard.querySelector<HTMLElement>(`[data-pos="${p.r},${p.c}"]`);
      el?.classList.add('correct');
    });
  }

  function markWrongFlash(): void {
    cursorCells().forEach(p => {
      const el = hackingBoard.querySelector<HTMLElement>(`[data-pos="${p.r},${p.c}"]`);
      el?.classList.add('wrong');
    });
    setTimeout(() => {
      cursorCells().forEach(p => {
        const el = hackingBoard.querySelector<HTMLElement>(`[data-pos="${p.r},${p.c}"]`);
        el?.classList.remove('wrong');
      });
    }, 350);
  }

  function updateTimerDisplay(): void {
    hackingTimer.textContent = `TIEMPO: ${state.timeLeft.toFixed(1)}s`;
  }

  function tick(): void {
    state.timeLeft -= 0.1;
    if (state.timeLeft <= 0) {
      if (state.timer) clearInterval(state.timer);
      state.timer = null;
      if (state.roundTransitionTimeout) { clearTimeout(state.roundTransitionTimeout); state.roundTransitionTimeout = null; }
      hackingInfo.textContent = `Tiempo agotado. Ronda finalizada.`;
      state.streak = 0;
      hackingStreak.textContent = `STREAK: ${state.streak}`;
      state.playing = false;
      startHacking.disabled = false;
      audioManager.play('gameover');
      if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
      if (window.Leaderboard) window.Leaderboard.save('soup', state.maxStreak);
      return;
    }
    updateTimerDisplay();
  }

  function resetTimer(): void {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    state.timeLeft = state.time;
    updateTimerDisplay();
    state.timer = setInterval(tick, 100);
    if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
    state.moveTimer = setInterval(moveStep, state.moveInterval);
  }

  function nextRound(found: boolean): void {
    if (found) state.currentRound += 1;
    if (state.currentRound >= state.rounds) {
      hackingInfo.textContent = `¡Completaste ${state.rounds} rondas! Puntuación: ${state.streak}`;
      state.playing = false;
      startHacking.disabled = false;
      audioManager.play('perfect');
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
      if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
      if (state.roundTransitionTimeout) { clearTimeout(state.roundTransitionTimeout); state.roundTransitionTimeout = null; }
      if (window.Leaderboard) window.Leaderboard.save('soup', state.maxStreak);
      return;
    }

    generateTargets();
    createGrid();
    state.cursorIdx = 0;
    renderBoard();
    resetTimer();
    hackingInfo.textContent = `Ronda ${state.currentRound + 1}/${state.rounds}. Alineá el cursor con el objetivo y confirmá.`;
  }

  keydownHandler = (e: KeyboardEvent) => {
    if (!state.playing) return;
    const key = e.key.toLowerCase();
    // idxOf(r, c) = (size-1-r)*size + (size-1-c): tanto filas como
    // columnas están invertidas respecto al índice de anillo (mismo
    // motivo por el que columnas usa +1 para "izquierda" y -1 para
    // "derecha" más abajo, ver comentario de spanIndices). Por fila
    // pasa lo mismo: subir una fila (r-1) SUMA `size` al índice de
    // anillo, no lo resta. Con el signo original invertido, W/S
    // movían el cursor una fila hacia el lado contrario al indicado.
    if (key === 'arrowup' || key === 'w') { e.preventDefault(); moveCursor(state.size); }
    else if (key === 'arrowdown' || key === 's') { e.preventDefault(); moveCursor(-state.size); }
    else if (key === 'arrowleft' || key === 'a') { e.preventDefault(); moveCursor(1); }
    else if (key === 'arrowright' || key === 'd') { e.preventDefault(); moveCursor(-1); }
    else if (key === 'enter' || key === ' ') { e.preventDefault(); attemptConfirm(); }
  };
  document.addEventListener('keydown', keydownHandler);

  startHacking.addEventListener('click', () => {
    state.size = Math.max(6, Math.min(parseInt(hackingSize.value, 10) || 10, 20));
    state.length = Math.max(1, Math.min(parseInt(hackingLength.value, 10) || 2, 4));
    state.time = Math.max(1, Math.min(parseInt(hackingTime.value, 10) || 15, 60));
    state.rounds = Math.max(1, Math.min(parseInt(hackingRounds.value, 10) || 5, 50));
    state.moveMode = (hackingMoveMode?.value as MoveMode) || 'flow';
    state.currentRound = 0;
    state.streak = 0;
    state.maxStreak = 0;
    hackingStreak.textContent = `STREAK: ${state.streak}`;
    hackingMax.textContent = `MAX STREAK: ${state.maxStreak}`;
    state.playing = true;
    startHacking.disabled = true;
    nextRound(false);
  });
}

export function stop(): void {
  const state = activeState;
  if (state) {
    state.playing = false;
    if (state.timer)     { clearInterval(state.timer);     state.timer = null; }
    if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
    if (state.roundTransitionTimeout) { clearTimeout(state.roundTransitionTimeout); state.roundTransitionTimeout = null; }
  }
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
}
