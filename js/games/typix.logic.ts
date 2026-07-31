import audioManager from '../audioManager.js';
/**
 * js/games/typix.logic.ts
 *
 * Lógica pesada de "Typix" (init/stop + start legacy hook), extraída
 * de typix.ts para lazy loading — ver `logic` en typix.ts y el
 * comentario de GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: RestartableThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts). `start` (restart sin pasar por
 * init) se conserva exportado por fidelidad aunque, como en el original,
 * no tiene consumidor: GameConfig.start no lo invoca nadie en la app.
 */

let cleanup: (() => void) | null = null;
let restart: (() => void) | null = null;

export function init() {
  const board = document.getElementById('typixBoard');
  if (!board) return;

  const timerEl   = document.getElementById('typixTimer');
  const inputEl   = document.getElementById('typixInput') as HTMLInputElement | null;
  const messageEl = document.getElementById('typixMessage');
  const uniqueEl  = document.getElementById('typixUniqueDigits') as HTMLInputElement | null;
  const showDigitsEl = document.getElementById('typixShowDigits') as HTMLInputElement | null;
  const guessBtn  = document.getElementById('typixGuessBtn');

  if (!timerEl || !inputEl || !messageEl || !uniqueEl || !showDigitsEl || !guessBtn) return;

  let secretWord = '';
  let currentRow = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let timeLeft = 60;
  let gameOver = false;

  function generateRepeated(): string {
    let r = '';
    for (let i = 0; i < 5; i++) r += Math.floor(Math.random() * 10);
    return r;
  }

  function generateUnique(): string {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let r = '';
    while (r.length < 5) {
      const idx = Math.floor(Math.random() * digits.length);
      r += digits[idx];
      digits.splice(idx, 1);
    }
    return r;
  }

  function createBoard() {
    board!.innerHTML = '';
    for (let r = 0; r < 6; r++) {
      const row = document.createElement('div');
      row.className = 'typix-row';
      board!.appendChild(row);
    }
  }

  function startGame() {
    if (timer) clearInterval(timer);
    secretWord = uniqueEl!.checked ? generateUnique() : generateRepeated();
    currentRow = 0;
    timeLeft = 60;
    gameOver = false;
    timerEl!.textContent = String(timeLeft);
    inputEl!.value = '';
    inputEl!.disabled = false;
    messageEl!.textContent = '';
    guessBtn!.textContent = 'Intentar';
    createBoard();
    timer = setInterval(() => {
      timeLeft--;
      timerEl!.textContent = String(timeLeft);
      if (timeLeft <= 0) loseGame();
    }, 1000);
  }

  function renderGuess(guess: string): string {
    return showDigitsEl!.checked ? guess : guess.replace(/\d/g, '•');
  }

  function refreshGuessDisplay() {
    board!.querySelectorAll<HTMLElement>('.typix-row').forEach(row => {
      const guessEl = row.querySelector('.typix-guess');
      const guess = row.dataset.guess;
      if (guessEl && guess) guessEl.textContent = renderGuess(guess);
    });
  }

  function evaluateGuess(guess: string) {
    const row = board!.querySelectorAll('.typix-row')[currentRow];
    if (!row) return;

    const rowElement = row as HTMLElement;

    // Clasificación por dígito: correct (posición exacta), present
    // (existe en el código pero en otra posición) o absent. Se hace
    // en dos pasadas para no marcar como "present" un dígito que ya
    // fue consumido por un match "correct" en otra celda.
    const secretRemaining = secretWord.split('');
    const statuses: ('correct' | 'present' | 'absent')[] = new Array(5).fill('absent');

    for (let i = 0; i < 5; i++) {
      if (guess[i] === secretWord[i]) {
        statuses[i] = 'correct';
        secretRemaining[i] = '';
      }
    }
    for (let i = 0; i < 5; i++) {
      if (statuses[i] === 'correct') continue;
      const idx = secretRemaining.indexOf(guess[i]);
      if (idx !== -1) {
        statuses[i] = 'present';
        secretRemaining[idx] = '';
      }
    }

    const correct = statuses.filter(s => s === 'correct').length;
    const present = statuses.filter(s => s === 'present').length;
    const absent = 5 - correct - present;

    // Resumen agregado, sin indicar a qué posición corresponde cada
    // símbolo: '!' por cada dígito correcto y bien ubicado, '*' por
    // cada dígito presente en otra posición. No se generan celdas por
    // dígito para no filtrar qué posición acertaste, solo la cuenta.
    const summary = '!'.repeat(correct) + '*'.repeat(present);

    rowElement.dataset.guess = guess;
    rowElement.innerHTML = `<div class="typix-guess">${renderGuess(guess)}</div>` +
      `<div class="typix-summary">${summary || '—'}</div>`;
    rowElement.setAttribute(
      'aria-label',
      `Intento ${guess}: ${correct} dígito${correct === 1 ? '' : 's'} correcto${correct === 1 ? '' : 's'}, ` +
      `${present} presente${present === 1 ? '' : 's'} en otra posición, ${absent} ausente${absent === 1 ? '' : 's'}`
    );
    if (guess === secretWord) {
      if (timer) clearInterval(timer);
      gameOver = true;
      inputEl!.disabled = true;
      guessBtn!.textContent = 'Reiniciar';
      audioManager?.play('perfect');
      messageEl!.textContent = '¡Ganaste!';
      return;
    }
    audioManager?.play('click');
    currentRow++;
    if (currentRow >= 6) loseGame();
  }

  function loseGame() {
    if (timer) clearInterval(timer);
    gameOver = true;
    inputEl!.disabled = true;
    guessBtn!.textContent = 'Reiniciar';
    audioManager?.play('gameover');
    messageEl!.textContent = `❌ Perdiste. El código era ${secretWord}`;
  }

  function onGuess() {
    if (gameOver) {
      startGame();
      return;
    }
    const guess = inputEl!.value.trim();
    if (!/^\d{5}$/.test(guess)) return;
    evaluateGuess(guess);
    inputEl!.value = '';
  }

  guessBtn.addEventListener('click', onGuess);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !inputEl!.disabled) onGuess(); });
  showDigitsEl.addEventListener('change', refreshGuessDisplay);

  // start immediately on first load
  startGame();

  cleanup = function () {
    if (timer) { clearInterval(timer); timer = null; }
  };
  restart = startGame;
}

export function stop() {
  if (cleanup) cleanup();
}

export function start() {
  if (restart) restart();
}
