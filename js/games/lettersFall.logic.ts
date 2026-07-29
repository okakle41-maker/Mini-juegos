/**
 * js/games/lettersFall.logic.ts
 *
 * Lógica pesada extraída de lettersFall.ts para lazy loading — ver
 * `logic` en lettersFall.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import safeStorage from '../core/safeStorage.js';
import GameHelpers from '../utils/gameHelpers.js';
import audioManager from '../audioManager.js';
interface DifficultyConfig {
  minLength: number;
  maxLength: number;
  speed: number;
  spawnStart: number;
  spawnMin: number;
  spawnAccel: number;
  minVerticalSpacing: number;
}

interface LettersFallUi {
  start: HTMLElement;
  lettersInput: HTMLInputElement;
  lettersArea: HTMLElement;
  lettersMessage: HTMLElement;
  lettersLevel?: HTMLElement | null;
  lettersDifficulty: HTMLElement;
  lettersDifficultySelect: HTMLSelectElement;
  lettersScore: HTMLElement;
  lettersBest: HTMLElement;
  lettersLives: HTMLElement;
  [key: string]: HTMLElement | null | undefined;
}

class Word {
  text: string;
  x: number;
  y: number;
  speed: number;
  element: HTMLElement | null;

  constructor(text: string, x: number, y: number, speed: number) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.element = null;
  }

  createElement(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'letters-word';
    span.textContent = this.text;
    span.style.left = `${this.x}px`;
    span.style.top = `${this.y}px`;
    this.element = span;
    return span;
  }

  updatePosition() {
    if (!this.element) return;
    this.element.style.top = `${this.y}px`;
  }
}

class LettersFallGame {
  ui: LettersFallUi;
  state: {
    words: Word[];
    score: number;
    best: number;
    lives: number;
    difficulty: string;
    active: boolean;
    lastTime: number;
    currentInput: string;
    nextSpawnTime: number;
    wordsCleared: number;
    spawnInterval: number;
    wordSpeed: number;
  };
  wordPool: string[];
  chuchuWordPool: string[];
  cleanup: ReturnType<typeof GameHelpers.createCleanupManager>;

  constructor(ui: LettersFallUi) {
    this.ui = ui;
    this.cleanup = GameHelpers.createCleanupManager();
    this.state = {
      words: [],
      score: 0,
      best: 0,
      lives: 3,
      difficulty: 'normal',
      active: false,
      lastTime: 0,
      currentInput: '',
      nextSpawnTime: 0,
      wordsCleared: 0,
      spawnInterval: 0,
      wordSpeed: 0
    };
    this.wordPool = [
      'AGUA', 'ROCA', 'LUNA', 'NUBE', 'MALTA', 'MONTAÑA', 'RAPIDO', 'SERPIENTE', 'ESPACIO', 'DRAGON',
      'CASCADA', 'MANANTIAL', 'RESISTIR', 'COMPUTADORA', 'ALGORITMO', 'FANTASMA', 'PLANETA', 'CRISTAL',
      'TORBELLINO', 'SINTAXIS', 'CONECTOR', 'CIRCUITO', 'TECLADO', 'VELOCIDAD'
    ];
    this.chuchuWordPool = [
      'DESCIFRADO', 'REVOLVER', 'ENCUBRIMIENTO', 'ESCALAMIENTO', 'BALA', 'ARMA', 'PERSECUCION',
      'PROYECTILES', 'INTERCEPTACION', 'DETECCION', 'COMUNICACIONES', 'PLANCHABRAGUIS', 'PLANCHABRAGAS',
      'ENCAPUCHADO', 'FALSIFICACION', 'SABOTAJE', 'CAMUFLAJE', 'LANZAGRANADAS', 'INFILTRACION',
      'EXTORSION', 'MUNICIONES', 'DESENCRIPTAR', 'EXTRACCION', 'VULNERABILIDAD'
    ];
    this.loadBest();
    this.updateUI();
  }

  loadBest() {
    this.state.best = safeStorage.getNumber('lettersFallBest', 0);
  }

  saveBest() {
    safeStorage.setNumber('lettersFallBest', this.state.best);
  }

  start() {
    this.reset();
    this.state.active = true;
    this.state.lastTime = performance.now();
    this.state.nextSpawnTime = performance.now() + this.state.spawnInterval;
    this.ui.lettersInput.focus();
    requestAnimationFrame(this.update.bind(this));
  }

  reset() {
    // Antes: reset() no ponía active=false, así que si stop() se
    // llamaba mientras el juego estaba en curso (sin haber perdido
    // por vidas), el bucle recursivo de requestAnimationFrame en
    // update() seguía corriendo para siempre en segundo plano — el
    // guard `if (!this.state.active) return;` nunca se activaba.
    this.state.active = false;
    this.cleanup.cleanup();
    this.state.words.forEach(word => word.element?.remove());
    this.state.words = [];
    this.state.score = 0;
    this.state.lives = this.getStartingLives();
    this.state.currentInput = '';
    this.ui.lettersInput.value = '';
    this.ui.lettersArea.classList.remove('letters-flash');
    const config = this.getDifficultyConfig();
    this.state.spawnInterval = config.spawnStart;
    this.state.wordSpeed = config.speed * 4;
    this.updateUI();
  }

  getStartingLives(): number {
    const difficulty = this.ui.lettersDifficultySelect.value;
    if (difficulty === 'easy') return 5;
    if (difficulty === 'hard') return 2;
    if (difficulty === 'chuchu') return 3;
    return 3;
  }

  getDifficultyConfig(): DifficultyConfig {
    const difficulty = this.ui.lettersDifficultySelect.value;
    if (difficulty === 'easy') {
      return {
        minLength: 3,
        maxLength: 5,
        speed: 18,
        spawnStart: 1400,
        spawnMin: 750,
        spawnAccel: 40,
        minVerticalSpacing: 140
      };
    }
    if (difficulty === 'hard') {
      return {
        minLength: 6,
        maxLength: 10,
        speed: 26,
        spawnStart: 950,
        spawnMin: 380,
        spawnAccel: 55,
        minVerticalSpacing: 120
      };
    }
    if (difficulty === 'chuchu') {
      // Palabras más largas (tema táctico/encubierto), moderadamente
      // espaciadas entre sí y con velocidad calibrada para que cada
      // una tarde ~5s en llegar desde y=20 hasta la zona de peligro
      // (90% del alto del área de 560px): distancia ≈ 484px,
      // wordSpeed = speed*4 (ver spawnWord/update), 484 / 5 / 4 ≈ 24.2.
      return {
        minLength: 4,
        maxLength: 14,
        speed: 24.2,
        spawnStart: 2600,
        spawnMin: 1800,
        spawnAccel: 20,
        minVerticalSpacing: 170
      };
    }
    return {
      minLength: 4,
      maxLength: 7,
      speed: 22,
      spawnStart: 1200,
      spawnMin: 600,
      spawnAccel: 48,
      minVerticalSpacing: 130
    };
  }

  spawnWord() {
    const config = this.getDifficultyConfig();
    const areaWidth = this.ui.lettersArea.clientWidth - 120;
    const text = this.getRandomWord(config.minLength, config.maxLength);
    const x = Math.max(16, Math.random() * areaWidth);
    const word = new Word(text, x, 20, this.state.wordSpeed);
    this.state.words.push(word);
    this.ui.lettersArea.appendChild(word.createElement());
    this.updateUI();
  }

  getRandomWord(minLength: number, maxLength: number): string {
    const difficulty = this.ui.lettersDifficultySelect.value;
    const pool = difficulty === 'chuchu' ? this.chuchuWordPool : this.wordPool;
    const candidates = pool.filter(word => word.length >= minLength && word.length <= maxLength);
    return candidates[Math.floor(Math.random() * candidates.length)] || 'PALABRA';
  }

  update(timestamp: number) {
    if (!this.state.active) return;
    const deltaTime = (timestamp - this.state.lastTime) / 1000;
    this.state.lastTime = timestamp;
    this.state.words.forEach(word => {
      word.y += word.speed * deltaTime;
      word.updatePosition();
    });

    const config = this.getDifficultyConfig();
    const now = performance.now();
    this.state.spawnInterval = Math.max(config.spawnMin, this.state.spawnInterval - config.spawnAccel * deltaTime);

    if (now >= this.state.nextSpawnTime) {
      const enoughSpace = this.state.words.every(word => word.y >= config.minVerticalSpacing);
      if (enoughSpace || this.state.words.length === 0) {
        this.spawnWord();
        this.state.nextSpawnTime = now + this.state.spawnInterval;
      } else {
        this.state.nextSpawnTime = now + 120;
      }
    }

    this.checkDangerZone();
    this.checkInputMatch();

    if (this.state.lives <= 0) {
      this.gameOver();
      return;
    }

    this.updateUI();
    requestAnimationFrame(this.update.bind(this));
  }

  checkDangerZone() {
    const dangerTop = this.ui.lettersArea.clientHeight * 0.9;
    const wordsToRemove: Word[] = [];

    this.state.words.forEach(word => {
      if (word.element && word.y + word.element.clientHeight >= dangerTop) {
        wordsToRemove.push(word);
      }
    });

    wordsToRemove.forEach(word => this.loseLife(word));
  }

  loseLife(word: Word) {
    word.element?.classList.add('letters-removed');
    this.cleanup.addTimeout(() => word.element?.remove(), 200);
    this.state.words = this.state.words.filter(item => item !== word);
    this.state.lives -= 1;
    this.ui.lettersArea.classList.add('letters-flash');
    this.cleanup.addTimeout(() => this.ui.lettersArea.classList.remove('letters-flash'), 240);
    audioManager?.play('miss');
    this.showMessage('Perdido', 'fail');
  }

  checkInputMatch() {
    if (!this.state.currentInput.trim()) return;
    const typed = this.state.currentInput.toUpperCase();
    const matchIndex = this.state.words.findIndex(word => word.text === typed);
    if (matchIndex >= 0) {
      this.removeWord(this.state.words[matchIndex]);
      this.state.currentInput = '';
      this.ui.lettersInput.value = '';
      audioManager?.play('good');
      this.showMessage('Correcto', 'success');
    }
  }

  removeWord(word: Word) {
    word.element?.classList.add('letters-removed');
    this.cleanup.addTimeout(() => word.element?.remove(), 200);
    this.state.words = this.state.words.filter(item => item !== word);
    this.state.score += this.getScoreForWord(word.text);
    this.state.score += 5;
    if (this.state.score > this.state.best) {
      this.state.best = this.state.score;
      this.saveBest();
    }
  }

  getScoreForWord(text: string): number {
    if (text.length <= 4) return 10;
    if (text.length <= 7) return 20;
    return 30;
  }

  gameOver() {
    this.state.active = false;
    audioManager?.play('gameover');
    this.ui.lettersMessage.textContent = 'GAME OVER';
    this.ui.lettersMessage.classList.add('fail');
    if (window.Leaderboard) window.Leaderboard.save('letters', this.state.score);
  }

  showMessage(text: string, type: string) {
    this.ui.lettersMessage.textContent = text;
    this.ui.lettersMessage.className = `letters-message ${type}`;
    this.cleanup.addTimeout(() => {
      this.ui.lettersMessage.textContent = '';
      this.ui.lettersMessage.className = 'letters-message';
    }, 900);
  }

  updateUI() {
    if (this.ui.lettersLevel) {
      this.ui.lettersLevel.textContent = '';
    }
    this.ui.lettersDifficulty.textContent = `Dificultad: ${this.ui.lettersDifficultySelect.value}`;
    this.ui.lettersScore.textContent = `Puntuación: ${this.state.score}`;
    this.ui.lettersBest.textContent = `Mejor: ${this.state.best}`;
    this.ui.lettersLives.innerHTML = Array.from({ length: this.state.lives }, () => '<span>❤️</span>').join('');
  }
}

export function init(rawUi: GameUi) {
  const ui = rawUi as unknown as LettersFallUi;
  if (!ui.start) return; // sección no presente

  const game = new LettersFallGame(ui);

  // Foco automático al entrar a la vista: el usuario puede empezar a
  // escribir sin tener que clickear el input primero.
  ui.lettersInput.focus();

  ui.start.addEventListener('click', () => game.start());

  ui.lettersInput.addEventListener('input', (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    game.state.currentInput = value;
  });

  ui.lettersInput.addEventListener('change', () => {
    ui.lettersInput.value = ui.lettersInput.value.toUpperCase();
    game.state.currentInput = ui.lettersInput.value;
  });

  ui.lettersInput.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      game.checkInputMatch();
      event.preventDefault();
    }
  });

  ui.lettersDifficultySelect.addEventListener('change', () => {
    ui.lettersInput.value = '';
    game.state.currentInput = '';
    game.state.lives = game.getStartingLives();
    game.updateUI();
  });

  GameInstanceRegistry.set('letters', game);
}

export function stop() {
  const game = GameInstanceRegistry.get<LettersFallGame>('letters');
  if (game) game.reset();
  GameInstanceRegistry.clear('letters');
}

