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
  const guessBtn  = document.getElementById('typixGuessBtn');

  if (!timerEl || !inputEl || !messageEl || !uniqueEl || !guessBtn) return;

  let secretWord = '';
  let currentRow = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let timeLeft = 60;

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
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement('div');
        cell.className = 'typix-cell';
        row.appendChild(cell);
      }
      board!.appendChild(row);
    }
  }

  function startGame() {
    if (timer) clearInterval(timer);
    secretWord = uniqueEl!.checked ? generateUnique() : generateRepeated();
    currentRow = 0;
    timeLeft = 60;
    timerEl!.textContent = String(timeLeft);
    inputEl!.value = '';
    messageEl!.textContent = '';
    createBoard();
    timer = setInterval(() => {
      timeLeft--;
      timerEl!.textContent = String(timeLeft);
      if (timeLeft <= 0) loseGame();
    }, 1000);
  }

  function evaluateGuess(guess: string) {
    const row = board!.querySelectorAll('.typix-row')[currentRow];
    if (!row) return;
    let correct = 0, present = 0;
    for (let i = 0; i < 5; i++) {
      if (guess[i] === secretWord[i]) correct++;
      else if (secretWord.includes(guess[i])) present++;
    }
    const absent = 5 - correct - present;
    row.innerHTML = `
      <span class="typix-guess">${guess}</span>
      <span class="typix-result">[${'!'.repeat(correct)}${'*'.repeat(present)}]</span>`;
    row.setAttribute(
      'aria-label',
      `Intento ${guess}: ${correct} dígito${correct === 1 ? '' : 's'} correcto${correct === 1 ? '' : 's'}, ` +
      `${present} presente${present === 1 ? '' : 's'} en otra posición, ${absent} ausente${absent === 1 ? '' : 's'}`
    );
    if (guess === secretWord) {
      if (timer) clearInterval(timer);
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
    audioManager?.play('gameover');
    messageEl!.textContent = `❌ Perdiste. El código era ${secretWord}`;
  }

  function onGuess() {
    const guess = inputEl!.value.trim();
    if (!/^\d{5}$/.test(guess)) return;
    evaluateGuess(guess);
    inputEl!.value = '';
  }

  guessBtn.addEventListener('click', onGuess);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') onGuess(); });

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
