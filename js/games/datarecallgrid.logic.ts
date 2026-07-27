/**
 * js/games/datarecallgrid.logic.ts
 *
 * Lógica pesada extraída de datarecallgrid.ts para lazy loading — ver
 * `logic` en datarecallgrid.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';

interface DataObject {
  icon: string;
  name: string;
}

interface DataColor {
  name: string;
  hex: string;
}

interface GridItem extends DataObject {
  color: DataColor;
  position: number;
}

type QuestionType = 'color_of' | 'object_of' | 'position_of';

interface Question {
  question: string;
  answer: string;
}

interface GameSettings {
  objectCount: number;
  displayTime: number;
  questionCount: number;
}

interface GameState {
  data: GridItem[];
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  displayTime: number;
  active: boolean;
  currentAnswer: string;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;
let gameState: GameState | null = null;
/** setTimeout de handleAnswer() que agenda la siguiente pregunta.
 *  Antes no se trackeaba: si el usuario reiniciaba la partida
 *  (startGame) dentro de la ventana de 1.5s tras su última
 *  respuesta, este timeout de la partida VIEJA disparaba
 *  showQuestion() sobre el `gameState` NUEVO ya reasignado,
 *  adelantando/saltando la primera pregunta de la fase de
 *  memorización recién iniciada. */
let nextQuestionTimeout: ReturnType<typeof setTimeout> | null = null;

export function init(ui: GameUi) {
  const {
    start,
    gridDisplay,
    questionDisplay,
    answerInput,
    submitBtn,
    scoreEl,
    questionCountEl,
    timerEl,
    messageEl,
    objectCountSelect,
    displayTimeSelect,
    questionCountSelect
  } = ui;

  if (!start) return;

  const startBtn = start as HTMLButtonElement;
  const submitButton = submitBtn as HTMLButtonElement;
  const answerInputEl = answerInput as HTMLInputElement;
  const objectCountSel = objectCountSelect as HTMLSelectElement;
  const displayTimeSel = displayTimeSelect as HTMLSelectElement;
  const questionCountSel = questionCountSelect as HTMLSelectElement;

  // Objetos disponibles con iconos
  const OBJECTS: DataObject[] = [
    { icon: '🏠', name: 'House' },
    { icon: '🏭', name: 'Factory' },
    { icon: '🏪', name: 'Shop' },
    { icon: '🏦', name: 'Bank' },
    { icon: '⛽', name: 'Gas Station' },
    { icon: '🏥', name: 'Hospital' },
    { icon: '🏫', name: 'School' },
    { icon: '🏰', name: 'Castle' },
    { icon: '🌆', name: 'City' },
    { icon: '🌉', name: 'Bridge' },
    { icon: '🗼', name: 'Tower' },
    { icon: '🏟️', name: 'Stadium' }
  ];

  // Colores disponibles
  const COLORS: DataColor[] = [
    { name: 'red', hex: '#ff4444' },
    { name: 'blue', hex: '#4444ff' },
    { name: 'green', hex: '#44ff44' },
    { name: 'yellow', hex: '#ffff44' },
    { name: 'purple', hex: '#aa44ff' },
    { name: 'orange', hex: '#ff8844' },
    { name: 'pink', hex: '#ff44aa' },
    { name: 'cyan', hex: '#44ffff' }
  ];

  function generateData(count: number): GridItem[] {
    const shuffledObjects = [...OBJECTS].sort(() => Math.random() - 0.5).slice(0, count);
    const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5).slice(0, count);

    return shuffledObjects.map((obj, idx) => ({
      ...obj,
      color: shuffledColors[idx],
      position: idx + 1
    }));
  }

  function renderGrid(data: GridItem[], visible = true) {
    gridDisplay.innerHTML = '';

    data.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'grid-item';

      if (visible) {
        itemEl.innerHTML = `
          <span class="item-icon">${item.icon}</span>
          <span class="item-name">${item.name}</span>
          <span class="item-arrow">→</span>
          <span class="item-color" style="color: ${item.color.hex}">${item.color.name}</span>
        `;
      } else {
        itemEl.innerHTML = `
          <span class="item-icon">${item.icon}</span>
          <span class="item-name">???</span>
          <span class="item-arrow">→</span>
          <span class="item-color">???</span>
        `;
        itemEl.classList.add('hidden');
      }

      gridDisplay.appendChild(itemEl);
    });
  }

  function generateQuestion(data: GridItem[]): Question {
    const questionTypes: QuestionType[] = ['color_of', 'object_of', 'position_of'];
    const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const item = data[Math.floor(Math.random() * data.length)];

    let question: string;
    let answer: string;

    switch (type) {
      case 'color_of':
        question = `What color was the ${item.name}?`;
        answer = item.color.name;
        break;
      case 'object_of':
        question = `Which object was ${item.color.name}?`;
        answer = item.name;
        break;
      case 'position_of':
        question = `What was in position ${item.position}?`;
        answer = item.name;
        break;
    }

    return { question, answer };
  }

  function getSettings(): GameSettings {
    return {
      objectCount: parseInt(objectCountSel.value, 10),
      displayTime: parseInt(displayTimeSel.value, 10) * 1000,
      questionCount: parseInt(questionCountSel.value, 10)
    };
  }

  function startGame() {
    if (nextQuestionTimeout) { clearTimeout(nextQuestionTimeout); nextQuestionTimeout = null; }
    const settings = getSettings();

    gameState = {
      data: generateData(settings.objectCount),
      currentQuestion: 0,
      totalQuestions: settings.questionCount,
      score: 0,
      displayTime: settings.displayTime,
      active: true,
      currentAnswer: ''
    };

    startBtn.disabled = true;
    updateUI();

    // Fase 1: Escaneo visual
    renderGrid(gameState.data, true);
    messageEl.textContent = '👁️ MEMORIZE THE DATA...';
    messageEl.className = 'message info';
    questionDisplay.textContent = '';
    answerInputEl.value = '';
    answerInputEl.disabled = true;
    submitButton.disabled = true;

    let timeLeft = gameState.displayTime;
    timerEl.textContent = `${(timeLeft / 1000).toFixed(1)}s`;

    timerInterval = setInterval(() => {
      timeLeft -= 100;
      timerEl.textContent = `${(timeLeft / 1000).toFixed(1)}s`;

      if (timeLeft <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        startInterrogation();
      }
    }, 100);
  }

  function startInterrogation() {
    if (!gameState) return;

    // Fase 2: Ocultación
    renderGrid(gameState.data, false);
    messageEl.textContent = '🌫️ DATA HIDDEN - ANSWER THE QUESTIONS';
    messageEl.className = 'message warning';

    answerInputEl.disabled = false;
    submitButton.disabled = false;
    answerInputEl.focus();

    showQuestion();
  }

  function showQuestion() {
    if (!gameState) return;

    if (gameState.currentQuestion >= gameState.totalQuestions) {
      endGame(true);
      return;
    }

    const { question, answer } = generateQuestion(gameState.data);
    gameState.currentAnswer = answer;

    questionDisplay.textContent = question;
    answerInputEl.value = '';

    // Timer para responder (10 segundos por pregunta)
    let timeLeft = 10;
    timerEl.textContent = `${timeLeft}s`;

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      timeLeft--;
      timerEl.textContent = `${timeLeft}s`;

      if (timeLeft <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        handleAnswer(null);
      }
    }, 1000);
  }

  function handleAnswer(userAnswer: string | null) {
    if (!gameState) return;
    if (timerInterval) clearInterval(timerInterval);

    const isCorrect = userAnswer !== null && userAnswer === gameState.currentAnswer;

    if (isCorrect) {
      gameState.score++;
      messageEl.textContent = '✓ CORRECT';
      messageEl.className = 'message success';
      audioManager.play('good');
    } else {
      messageEl.textContent = `✗ WRONG! Answer: ${gameState.currentAnswer}`;
      messageEl.className = 'message error';
      audioManager.play('miss');
    }

    gameState.currentQuestion++;
    updateUI();

    nextQuestionTimeout = setTimeout(() => {
      nextQuestionTimeout = null;
      if (gameState && gameState.active) {
        showQuestion();
      }
    }, 1500);
  }

  function submitAnswer() {
    if (!gameState) return;
    const userAnswer = answerInputEl.value.trim().toLowerCase();
    const correctAnswer = gameState.currentAnswer.toLowerCase();
    handleAnswer(userAnswer === correctAnswer ? gameState.currentAnswer : null);
  }

  function endGame(completed = false) {
    if (!gameState) return;
    gameState.active = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (nextQuestionTimeout) { clearTimeout(nextQuestionTimeout); nextQuestionTimeout = null; }

    startBtn.disabled = false;
    answerInputEl.disabled = true;
    submitButton.disabled = true;

    if (completed) {
      audioManager.play('perfect');
      messageEl.textContent = `🎯 HACK COMPLETE: ${gameState.score}/${gameState.totalQuestions}`;
      messageEl.className = 'message success';
    } else {
      audioManager.play('gameover');
      messageEl.textContent = `❌ CONNECTION LOST: ${gameState.score}/${gameState.totalQuestions}`;
      messageEl.className = 'message error';
    }

    if (window.Leaderboard) {
      window.Leaderboard.save('datarecallgrid', gameState.score);
    }
  }

  function updateUI() {
    if (!gameState) return;
    if (scoreEl) scoreEl.textContent = `Score: ${gameState.score}`;
    if (questionCountEl) questionCountEl.textContent = `Question: ${gameState.currentQuestion}/${gameState.totalQuestions}`;
  }

  startBtn.addEventListener('click', startGame);
  submitButton.addEventListener('click', submitAnswer);
  answerInputEl.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !submitButton.disabled) {
      submitAnswer();
    }
  });
}

export function stop() {
  if (gameState) {
    gameState.active = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  if (nextQuestionTimeout) { clearTimeout(nextQuestionTimeout); nextQuestionTimeout = null; }
}

