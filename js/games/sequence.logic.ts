import audioManager from '../audioManager.js';
/**
 * js/games/sequence.logic.ts
 *
 * Lógica pesada de "Sequence" (init/stop), extraída de sequence.ts para
 * lazy loading — ver `logic` en sequence.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: StoppableThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts).
 */

let cleanup: (() => void) | null = null;

export function init() {
  const start = document.getElementById('startSequence');
  if (!start) return;

  const nodes      = document.querySelectorAll<HTMLElement>('.sequence-node');
  const levelEl    = document.getElementById('sequenceLevel');
  const progressEl = document.getElementById('sequenceProgress');
  const resultEl   = document.getElementById('sequenceResult');
  const timeEl     = document.getElementById('sequenceTime');

  if (!levelEl || !progressEl || !resultEl || !timeEl) return;

  let level = 1;
  let sequence: number[] = [];
  let playerIndex = 0;
  let showing = false, running = false;
  let time = 8;
  let timer: ReturnType<typeof setInterval> | null = null;
  /** setInterval de playSequence() (muestra la secuencia parpadeando
   *  nodo por nodo). Antes era una variable LOCAL a esa función, sin
   *  trackear en `cleanup` — si stop() se llamaba mientras la
   *  secuencia se estaba mostrando (showing=true), el interval
   *  seguía solo hasta terminar de mostrarla y entonces llamaba
   *  startTimer() (arrancando el countdown) sobre una vista ya
   *  cerrada. Encadenado con playSequenceTimeout/nextLevelTimeout
   *  de abajo: los 3 juntos formaban una cadena que podía dejar el
   *  juego "jugándose solo" indefinidamente en segundo plano. */
  let playInterval: ReturnType<typeof setInterval> | null = null;
  /** setTimeout de startLevel() → playSequence() (500ms). Mismo
   *  riesgo que playInterval: sin trackear, arrancaba la secuencia
   *  (y por lo tanto playInterval) sobre una vista cerrada. */
  let playSequenceTimeout: ReturnType<typeof setTimeout> | null = null;
  /** setTimeout tras completar un nivel → startLevel() (800ms).
   *  Encadena hacia playSequenceTimeout si no se cancela. */
  let nextLevelTimeout: ReturnType<typeof setTimeout> | null = null;

  function generateSequence() {
    sequence = [];
    const length = level + 2;
    for (let i = 0; i < length; i++) {
      sequence.push(Math.floor(Math.random() * nodes.length));
    }
  }

  function getSequenceSpeed() {
    return Math.max(280, 650 - (level - 1) * 50);
  }

  function playSequence() {
    showing = true; running = false;
    let i = 0;
    playInterval = setInterval(() => {
      nodes.forEach(n => n.classList.remove('active'));
      if (i >= sequence.length) {
        if (playInterval) { clearInterval(playInterval); playInterval = null; }
        showing = false; running = true;
        startTimer();
        return;
      }
      const node = nodes[sequence[i]];
      node.classList.add('active');
      audioManager?.play('tone' + (sequence[i] + 1));
      const flashTime = getSequenceSpeed() * 0.55;
      setTimeout(() => node.classList.remove('active'), flashTime);
      i++;
    }, getSequenceSpeed());
  }

  function startLevel() {
    if (timer) { clearInterval(timer); timer = null; }
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
    if (playSequenceTimeout) { clearTimeout(playSequenceTimeout); playSequenceTimeout = null; }
    if (nextLevelTimeout) { clearTimeout(nextLevelTimeout); nextLevelTimeout = null; }
    playerIndex = 0;
    resultEl!.textContent = '';
    levelEl!.textContent = String(level);
    generateSequence();
    progressEl!.textContent = `0 / ${sequence.length}`;
    playSequenceTimeout = setTimeout(() => { playSequenceTimeout = null; playSequence(); }, 500);
  }

  function startTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    time = 8;
    timeEl!.textContent = String(time);
    timeEl!.classList.remove('danger');
    timer = setInterval(() => {
      time--;
      timeEl!.textContent = String(time);
      timeEl!.classList.toggle('danger', time <= 3);
      if (time === 3) audioManager?.play('step2');
      if (time <= 0) {
        if (timer) { clearInterval(timer); timer = null; }
        running = false;
        audioManager?.play('gameover');
        resultEl!.textContent = '⛔ ACCESS DENIED';
        (start as HTMLElement).style.display = 'inline-block';
      }
    }, 1000);
  }

  nodes.forEach((node, index) => {
    node.addEventListener('click', () => {
      if (showing || !running) return;
      node.classList.add('correct');
      setTimeout(() => node.classList.remove('correct'), 180);
      audioManager?.play('click');
      if (index !== sequence[playerIndex]) {
        running = false;
        node.classList.add('wrong');
        audioManager?.play('gameover');
        resultEl!.textContent = '⛔ ACCESS DENIED';
        (start as HTMLElement).style.display = 'inline-block';
        return;
      }
      playerIndex++;
      progressEl!.textContent = `${playerIndex} / ${sequence.length}`;
      if (playerIndex >= sequence.length) {
        running = false;
        if (timer) { clearInterval(timer); timer = null; }
        audioManager?.play('perfect');
        resultEl!.textContent = '✔ Nivel completado';
        level++;
        nextLevelTimeout = setTimeout(() => { nextLevelTimeout = null; startLevel(); }, 800);
      }
    });
  });

  start.addEventListener('click', () => {
    (start as HTMLElement).style.display = 'none';
    level = 1;
    startLevel();
  });

  cleanup = function () {
    running = false; showing = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
    if (playSequenceTimeout) { clearTimeout(playSequenceTimeout); playSequenceTimeout = null; }
    if (nextLevelTimeout) { clearTimeout(nextLevelTimeout); nextLevelTimeout = null; }
    resultEl!.textContent = '';
    (start as HTMLElement).style.display = 'inline-block';
  };
}

export function stop() {
  if (cleanup) cleanup();
}
