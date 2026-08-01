/**
 * js/games/neuralfragment.logic.ts
 *
 * Lógica pesada extraída de neuralfragment.ts para lazy loading — ver
 * `logic` en neuralfragment.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';

interface RoundData {
  sequence: string[];
  gapIndices: number[];
  original: string[];
}

interface DifficultySettings {
  fragmentCount: number;
  gapCount: number;
  exposureTime: number;
}

interface GameState {
  score: number;
  round: number;
  maxRounds: number;
  currentRoundData: RoundData | null;
  active: boolean;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;
let gameState: GameState | null = null;
/** setInterval de la fase de EXPOSICIÓN/memorización (startRound).
 *  Antes era una variable local sin trackear: si stop() se llamaba
 *  durante esta fase, el interval seguía solo hasta agotarse y
 *  llamaba showReconstructionPhase() sobre una vista ya cerrada —
 *  la partida "seguía" en segundo plano sin que el usuario la viera. */
let exposureInterval: ReturnType<typeof setInterval> | null = null;
/** Los 3 setTimeout de transición entre fases (checkSolution →
 *  startRound/endGame, y timeout de ronda → endGame) no se
 *  cancelaban al salir del juego; se trackean acá para poder
 *  cancelarlos todos juntos desde stop(). */
let transitionTimeout: ReturnType<typeof setTimeout> | null = null;

export function init(ui: GameUi) {
  const {
    start,
    fragmentDisplay,
    optionsGrid,
    scoreEl,
    roundEl,
    timerEl,
    messageEl,
    difficultySelect
  } = ui;

  if (!start) return;

  const startBtn = start as HTMLButtonElement;
  const difficultySel = difficultySelect as HTMLSelectElement;

  // Generador de fragmentos estilo código
  const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function generateFragment(): string {
    const char1 = CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];
    const char2 = CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];
    return char1 + char2;
  }

  function generateSequence(count: number): string[] {
    return Array.from({ length: count }, () => generateFragment());
  }

  function createMissingSequence(sequence: string[], gapCount: number): RoundData {
    const withGaps = [...sequence];
    const gapIndices: number[] = [];

    // Seleccionar posiciones aleatorias para huecos
    while (gapIndices.length < gapCount) {
      const idx = Math.floor(Math.random() * withGaps.length);
      if (!gapIndices.includes(idx)) {
        gapIndices.push(idx);
        withGaps[idx] = '??';
      }
    }

    return { sequence: withGaps, gapIndices, original: sequence };
  }

  function renderFragmentDisplay(data: { sequence: string[]; gapIndices?: number[] }) {
    fragmentDisplay.innerHTML = data.sequence
      .map((frag) => {
        if (frag === '??') {
          return `<span class="fragment-gap">??</span>`;
        }
        return `<span class="fragment-item">${frag}</span>`;
      })
      .join('<span class="fragment-separator">-</span>');
  }

  function renderOptions(correctSequence: string[], gapIndices: number[]) {
    optionsGrid.innerHTML = '';

    // Generar opciones para cada hueco
    gapIndices.forEach((gapIdx, i) => {
      const correctValue = correctSequence[gapIdx];
      const distractors: string[] = [];

      // Generar 3 distractores
      while (distractors.length < 3) {
        const d = generateFragment();
        if (d !== correctValue && !distractors.includes(d)) {
          distractors.push(d);
        }
      }

      // Mezclar correcta con distractores
      const allOptions = [correctValue, ...distractors].sort(() => Math.random() - 0.5);

      const optionGroup = document.createElement('div');
      optionGroup.className = 'option-group';
      optionGroup.innerHTML = `<span class="option-label">Hueco ${i + 1}:</span>`;

      allOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.dataset.gapIndex = String(gapIdx);
        btn.dataset.value = opt;
        // El texto visible es solo el fragmento (ej. "A7"), sin contexto
        // de a qué hueco pertenece ni si ya fue elegido — aria-label
        // agrega lo primero, aria-pressed lo segundo (se actualiza en
        // handleOptionSelect junto con la clase 'selected').
        btn.setAttribute('aria-label', `Hueco ${i + 1}: opción ${opt}`);
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => handleOptionSelect(gapIdx, opt));
        optionGroup.appendChild(btn);
      });

      optionsGrid.appendChild(optionGroup);
    });
  }

  let selectedOptions: Record<number, string> = {};

  function handleOptionSelect(gapIdx: number, value: string) {
    if (!gameState) return;
    selectedOptions[gapIdx] = value;

    // Actualizar visualmente
    const buttons = optionsGrid.querySelectorAll<HTMLElement>(`[data-gap-index="${gapIdx}"]`);
    buttons.forEach(btn => {
      const isSelected = btn.dataset.value === value;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });

    // Verificar si todos los huecos están completados
    const currentData = gameState.currentRoundData;
    if (currentData && Object.keys(selectedOptions).length === currentData.gapIndices.length) {
      checkSolution();
    }
  }

  function checkSolution() {
    if (!gameState) return;
    const currentData = gameState.currentRoundData;
    if (!currentData) return;
    let allCorrect = true;

    currentData.gapIndices.forEach(gapIdx => {
      if (selectedOptions[gapIdx] !== currentData.original[gapIdx]) {
        allCorrect = false;
      }
    });

    if (allCorrect) {
      gameState.score++;
      gameState.round++;
      audioManager.play('good');
      messageEl.textContent = '✓ Fragmento restaurado correctamente';
      messageEl.className = 'message success';
      transitionTimeout = setTimeout(() => { transitionTimeout = null; startRound(); }, 1500);
    } else {
      audioManager.play('miss');
      messageEl.textContent = '✗ Datos corruptos detectados';
      messageEl.className = 'message error';
      transitionTimeout = setTimeout(() => { transitionTimeout = null; endGame(); }, 1500);
    }

    updateUI();
  }

  function getDifficultySettings(): DifficultySettings {
    const difficulty = difficultySel.value;
    switch (difficulty) {
      case 'easy':
        return { fragmentCount: 3, gapCount: 1, exposureTime: 3000 };
      case 'normal':
        return { fragmentCount: 5, gapCount: 2, exposureTime: 2500 };
      case 'hard':
        return { fragmentCount: 7, gapCount: 3, exposureTime: 2000 };
      default:
        return { fragmentCount: 5, gapCount: 2, exposureTime: 2500 };
    }
  }

  function startRound() {
    if (!gameState) return;
    if (gameState.round > gameState.maxRounds) {
      endGame(true);
      return;
    }

    selectedOptions = {};
    const settings = getDifficultySettings();

    // Generar secuencia
    const sequence = generateSequence(settings.fragmentCount);
    const roundData = createMissingSequence(sequence, settings.gapCount);
    gameState.currentRoundData = roundData;

    // Fase de exposición
    renderFragmentDisplay({ sequence, gapIndices: [] });
    messageEl.textContent = 'Memoriza los fragmentos...';
    messageEl.className = 'message info';
    optionsGrid.innerHTML = '';

    let exposureTime = settings.exposureTime;
    timerEl.textContent = `${exposureTime / 1000}s`;

    const countdown = setInterval(() => {
      exposureTime -= 100;
      timerEl.textContent = `${(exposureTime / 1000).toFixed(1)}s`;
      if (exposureTime <= 0) {
        clearInterval(countdown);
        exposureInterval = null;
        showReconstructionPhase(roundData);
      }
    }, 100);
    exposureInterval = countdown;
  }

  function showReconstructionPhase(roundData: RoundData) {
    // Fase de reconstrucción
    renderFragmentDisplay(roundData);
    messageEl.textContent = 'Reconstruye los fragmentos perdidos';
    messageEl.className = 'message info';

    // Generar opciones
    renderOptions(roundData.original, roundData.gapIndices);

    // Timer para la ronda
    let roundTime = 15;
    timerEl.textContent = `${roundTime}s`;

    timerInterval = setInterval(() => {
      roundTime--;
      timerEl.textContent = `${roundTime}s`;
      if (roundTime <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        messageEl.textContent = '⏱ Tiempo agotado';
        messageEl.className = 'message error';
        transitionTimeout = setTimeout(() => { transitionTimeout = null; endGame(); }, 1500);
      }
    }, 1000);
  }

  function startGame() {
    if (exposureInterval) { clearInterval(exposureInterval); exposureInterval = null; }
    if (transitionTimeout) { clearTimeout(transitionTimeout); transitionTimeout = null; }
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    gameState = {
      score: 0,
      round: 1,
      maxRounds: 5,
      currentRoundData: null,
      active: true
    };

    startBtn.disabled = true;
    updateUI();
    startRound();
  }

  function endGame(won = false) {
    if (!gameState) return;
    gameState.active = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (exposureInterval) { clearInterval(exposureInterval); exposureInterval = null; }
    if (transitionTimeout) { clearTimeout(transitionTimeout); transitionTimeout = null; }

    startBtn.disabled = false;

    if (won) {
      audioManager.play('perfect');
      messageEl.textContent = `🎯 Hack completado: ${gameState.score}/${gameState.maxRounds}`;
      messageEl.className = 'message success';
    } else {
      audioManager.play('gameover');
      messageEl.textContent = `❌ Conexión perdida: ${gameState.score}/${gameState.maxRounds}`;
      messageEl.className = 'message error';
    }

    if (window.Leaderboard) {
      window.Leaderboard.save('neuralfragment', gameState.score);
    }
  }

  function updateUI() {
    if (!gameState) return;
    if (scoreEl) scoreEl.textContent = `Puntuación: ${gameState.score}`;
    if (roundEl) roundEl.textContent = `Ronda: ${gameState.round}/${gameState.maxRounds}`;
  }

  startBtn.addEventListener('click', startGame);
}

export function stop() {
  if (gameState) {
    gameState.active = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  if (exposureInterval) { clearInterval(exposureInterval); exposureInterval = null; }
  if (transitionTimeout) { clearTimeout(transitionTimeout); transitionTimeout = null; }
}

