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
import { multiplayerSystem } from '../multiplayerSystem.js';
import ErrorLogger from '../core/errorLogger.js';

/**
 * Sesión de sala activa para este juego, envuelta sobre
 * multiplayerSystem (ver createRoomMatch/joinRoomMatch/sendGameEvent/
 * onRoomUpdate en multiplayerSystem.ts). Se arma acá en vez de exponer
 * el singleton crudo a startGameCard/startTyperMode para que el resto
 * de este archivo no necesite conocer la forma exacta de sus eventos
 * custom (`multiplayer:game_event`, etc.) — mismo rol que cumplía
 * RoomSession en la versión anterior basada en roomManager.ts/Realtime
 * Broadcast, ahora sobre postgres_changes.
 */
interface RoomSession {
  code: string;
  role: CoopRole;
  send: (event: string, payload?: unknown) => Promise<void>;
  on: (event: string, handler: (payload: unknown) => void) => () => void;
  onPeersChange: (handler: (peers: { role: CoopRole }[]) => void) => () => void;
  peers: () => { role: CoopRole }[];
  leave: () => Promise<void>;
}

function wrapMatchAsRoom(role: CoopRole, matchId: string, roomCode: string, initialPeers: { role: CoopRole }[]): RoomSession {
  const gameEventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  const peersChangeHandlers = new Set<(peers: { role: CoopRole }[]) => void>();
  let currentPeers = initialPeers;
  let stopRoomUpdate: (() => void) | null = null;

  const onGameEvent = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as { type: string; payload: unknown };
    const handlers = gameEventHandlers.get(detail.type);
    handlers?.forEach((handler) => {
      try {
        handler(detail.payload);
      } catch (error) {
        ErrorLogger.log('lettersFall.roomSession.gameEvent', error, { type: detail.type });
      }
    });
  };
  window.addEventListener('multiplayer:game_event', onGameEvent);

  // Mientras se espera al segundo jugador, onRoomUpdate ya cubre el
  // cambio de `players`; se re-suscribe cada vez por si el match se
  // recrea (no debería pasar dentro de una misma sesión, pero evita
  // quedar escuchando un matchId obsoleto si algún día se permite
  // "reintentar" sin recargar la vista).
  stopRoomUpdate = multiplayerSystem.onRoomUpdate(matchId, (match) => {
    currentPeers = match.players.map((p) => ({ role: (p.role || 'viewer') as CoopRole }));
    peersChangeHandlers.forEach((handler) => {
      try {
        handler(currentPeers);
      } catch (error) {
        ErrorLogger.log('lettersFall.roomSession.peersChange', error);
      }
    });
  });

  return {
    code: roomCode,
    role,
    async send(event, payload) {
      await multiplayerSystem.sendGameEvent(event, payload);
    },
    on(event, handler) {
      if (!gameEventHandlers.has(event)) gameEventHandlers.set(event, new Set());
      gameEventHandlers.get(event)!.add(handler);
      return () => {
        gameEventHandlers.get(event)?.delete(handler);
      };
    },
    peers: () => currentPeers,
    onPeersChange(handler) {
      peersChangeHandlers.add(handler);
      return () => {
        peersChangeHandlers.delete(handler);
      };
    },
    async leave() {
      window.removeEventListener('multiplayer:game_event', onGameEvent);
      stopRoomUpdate?.();
      gameEventHandlers.clear();
      peersChangeHandlers.clear();
      await multiplayerSystem.leaveRoomMatch();
    }
  };
}

async function createRoom(gameId: string, role: CoopRole): Promise<RoomSession> {
  const match = await multiplayerSystem.createRoomMatch(gameId, role);
  return wrapMatchAsRoom(role, match.id, match.roomCode!, []);
}

async function joinRoom(gameId: string, code: string, role: CoopRole): Promise<RoomSession> {
  const match = await multiplayerSystem.joinRoomMatch(gameId, code, role);
  const peers = match.players.map((p) => ({ role: (p.role || 'viewer') as CoopRole }));
  return wrapMatchAsRoom(role, match.id, match.roomCode!, peers);
}


interface DifficultyConfig {
  minLength: number;
  maxLength: number;
  speed: number;
  spawnStart: number;
  spawnMin: number;
  spawnAccel: number;
  minVerticalSpacing: number;
}

/**
 * Modo coop: 'viewer' ve las palabras caer pero no tiene input activo;
 * 'typer' tiene el input pero el área de palabras queda vacía/oculta
 * (ver data-role en css/letters.css). 'solo' es el comportamiento
 * original de un solo dispositivo, sin sala ni Realtime de por medio.
 */
type CoopRole = 'solo' | 'viewer' | 'typer';

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
  lettersCard: HTMLElement;
  lettersControls: HTMLElement;
  lettersRoleBadge: HTMLElement;
  lettersModePanel: HTMLElement;
  modeSolo: HTMLElement;
  modeCreate: HTMLElement;
  modeJoin: HTMLElement;
  roleChooser: HTMLElement;
  roleChooserLabel: HTMLElement;
  roleViewer: HTMLButtonElement;
  roleTyper: HTMLButtonElement;
  joinCodeRow: HTMLElement;
  joinCodeInput: HTMLInputElement;
  roleConfirm: HTMLButtonElement;
  roleBack: HTMLElement;
  roomStatus: HTMLElement;
  roomStatusText: HTMLElement;
  roomCodeDisplay: HTMLElement;
  roomCancel: HTMLElement;
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
  private lastSentState: { score: number; best: number; lives: number } | null = null;

  /**
   * Modo coop. En 'solo' (default) el juego funciona exactamente
   * igual que antes de agregar salas — `room` queda null y nada de
   * la lógica de sincronización se activa. En modo coop, el viewer
   * es la única instancia que corre `update()`/`spawnWord()` (motor
   * único de físicas, para que las dos pantallas nunca vean palabras
   * distintas); ver protocolo de eventos en `connectRoom` más abajo.
   * El typer nunca instancia `LettersFallGame`, ver `initTyperMode`.
   */
  role: CoopRole = 'solo';
  room: RoomSession | null = null;

  constructor(ui: LettersFallUi, role: CoopRole = 'solo', room: RoomSession | null = null) {
    this.ui = ui;
    this.role = role;
    this.room = room;
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
    // wordSpeed/spawnInterval quedaban en su default de 0 (ver
    // constructor) y nunca se pisaban con la config de dificultad
    // elegida: las palabras se instanciaban con speed:0 en
    // spawnWord() y jamás se movían (word.y += word.speed * dt),
    // y con spawnInterval:0 el primer nextSpawnTime caía
    // inmediatamente en vez de respetar config.spawnStart. Se fijan
    // ambos acá, no en el constructor, porque dependen de
    // getDifficultyConfig() (que lee el <select> de dificultad, que
    // el jugador puede cambiar entre partidas sin recrear la
    // instancia de LettersFallGame).
    const config = this.getDifficultyConfig();
    this.state.wordSpeed = config.speed * 4;
    this.state.spawnInterval = config.spawnStart;
    // Fuerza el envío del estado inicial de la partida nueva en el
    // próximo updateUI(), en vez de depender de que difiera por
    // casualidad del último estado enviado en la partida anterior.
    this.lastSentState = null;
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
    this.notifyPeer('fail', word.text);
  }

  checkInputMatch() {
    if (!this.state.currentInput.trim()) return;
    const typed = this.state.currentInput.toUpperCase();
    const matchIndex = this.state.words.findIndex(word => word.text === typed);
    if (matchIndex >= 0) {
      const matchedText = this.state.words[matchIndex].text;
      this.removeWord(this.state.words[matchIndex]);
      this.state.currentInput = '';
      this.ui.lettersInput.value = '';
      audioManager?.play('good');
      this.showMessage('Correcto', 'success');
      this.notifyPeer('success', matchedText);
    } else if (this.role === 'viewer') {
      // En coop, el typer no ve las palabras: un intento fallido
      // también le da feedback ("no es esa"), no solo los aciertos.
      this.notifyPeer('miss-attempt', typed);
    }
  }

  /**
   * Le avisa al typer (si estamos en sala coop y somos el viewer) el
   * resultado de un intento, para que muestre feedback de
   * acierto/error en tiempo real aunque no vea las palabras — ver
   * `initTyperMode` para el lado que consume estos eventos.
   * No-op en modo 'solo' o si somos el typer (el typer no reenvía).
   */
  notifyPeer(type: 'success' | 'fail' | 'miss-attempt', text: string) {
    if (this.role !== 'viewer' || !this.room) return;
    this.room.send('viewer:result', { type, text }).catch((error) => {
      ErrorLogger.log('lettersFall.notifyPeer', error, { type, text });
    });
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
    if (this.role === 'viewer' && this.room) {
      this.room.send('viewer:gameover', { score: this.state.score }).catch((error) => {
        ErrorLogger.log('lettersFall.gameOver.notifyPeer', error);
      });
    }
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

    // updateUI() corre en cada frame del loop de requestAnimationFrame
    // (~60/s) porque también repinta el DOM local, que es barato. Pero
    // room.send() es un insert real a Supabase (ver sendGameEvent en
    // multiplayerSystem.ts) — sin este chequeo, cada frame disparaba un
    // insert aunque score/best/lives no hubiesen cambiado desde el
    // frame anterior (que es la inmensa mayoría de los frames, ya que
    // solo cambian en eventos puntuales: acierto, fallo, o récord
    // nuevo). Eso podía saturar la conexión o el rate limit de
    // Supabase en cualquier partida coop mínimamente larga.
    if (this.role === 'viewer' && this.room) {
      const current = { score: this.state.score, best: this.state.best, lives: this.state.lives };
      const changed = !this.lastSentState
        || current.score !== this.lastSentState.score
        || current.best !== this.lastSentState.best
        || current.lives !== this.lastSentState.lives;
      if (changed) {
        this.lastSentState = current;
        this.room.send('viewer:state', current).catch(() => {
          // Silencioso: un fallo puntual de red acá no debe interrumpir
          // el juego. lastSentState ya quedó actualizado arriba a
          // propósito (no se revierte en el catch): si se revirtiera,
          // una racha de fallos de red sostenidos volvería a reintentar
          // el envío en cada frame siguiente, reintroduciendo el mismo
          // spam que este fix busca evitar. El costo es que el typer
          // puede quedarse con un valor viejo hasta el próximo cambio
          // real de score/best/lives — aceptable frente a eso.
        });
      }
    }
  }

  /**
   * Cierra la sala coop al salir de la vista (stop() del módulo llama
   * esto vía StoppableInstance.leave — ver más abajo). Antes, esta
   * clase no implementaba `leave()` en absoluto: solo el wrapper
   * liviano del rol 'typer' (ver startTyperMode) lo tenía, así que si
   * el 'viewer' (quien SÍ instancia LettersFallGame) navegaba fuera de
   * la vista a mitad de partida coop, la sala quedaba 'playing' para
   * siempre en Supabase, reservando su room_code indefinidamente (ver
   * leaveRoomMatch/el índice único en migration_005_coop_rooms.sql).
   * No-op en modo 'solo' (this.room es null, no hay sala que cerrar).
   */
  leave() {
    this.room?.leave().catch(() => {});
  }
}

/**
 * Instancia guardada en GameInstanceRegistry: en modo 'solo'/'viewer'
 * es un `LettersFallGame` real; en modo 'typer' es este wrapper
 * liviano, ya que el typer no corre físicas ni spawnea palabras —
 * solo necesita `leave()` para cerrar la sala al salir de la vista.
 */
interface StoppableInstance {
  reset?: () => void;
  leave?: () => void;
}

function wireDifficultyAndInput(ui: LettersFallUi, game: LettersFallGame) {
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
}

function showRoleBadge(ui: LettersFallUi, role: CoopRole, code: string) {
  ui.lettersRoleBadge.textContent = role === 'viewer' ? `👀 Viewer · Sala ${code}` : `⌨️ Typer · Sala ${code}`;
  ui.lettersRoleBadge.classList.remove('hidden');
}

/**
 * Arranca el juego en modo 'solo' (comportamiento original, sin sala)
 * o 'viewer' (con sala coop activa) — ambos usan la misma clase
 * `LettersFallGame`, la diferencia es si `room` es null o no.
 */
function startGameCard(ui: LettersFallUi, role: CoopRole, room: RoomSession | null) {
  ui.lettersModePanel.classList.add('hidden');
  ui.lettersCard.classList.remove('hidden');
  ui.lettersCard.dataset.role = role;

  const game = new LettersFallGame(ui, role, room);
  ui.lettersInput.focus();
  wireDifficultyAndInput(ui, game);

  if (room) {
    showRoleBadge(ui, role, room.code);
    // En coop, el arranque lo dispara el viewer (es quien tiene el
    // botón "Iniciar" visible con sentido — el typer no ve el
    // tablero); le avisamos al typer para que también entre en
    // "modo jugando" y su feedback de resultados tenga sentido.
    ui.start.addEventListener('click', () => {
      room.send('viewer:start', {}).catch(() => {});
    });
  }

  GameInstanceRegistry.set('letters', game);
}

/**
 * Modo typer: no instancia `LettersFallGame` (no hay palabras que
 * mostrar ni físicas que correr en esta pantalla). Solo envía cada
 * cambio del input al viewer vía `typer:input`, y pinta el feedback
 * que el viewer le manda de vuelta (`viewer:result`/`viewer:state`/
 * `viewer:gameover`) sobre el mismo markup de `lettersMessage`/
 * `lettersScore`/etc. — así reutiliza el CSS existente sin duplicar
 * vista.
 */
function startTyperMode(ui: LettersFallUi, room: RoomSession) {
  ui.lettersModePanel.classList.add('hidden');
  ui.lettersCard.classList.remove('hidden');
  ui.lettersCard.dataset.role = 'typer';
  ui.lettersControls.classList.add('hidden'); // el typer no elige dificultad ni ve "Iniciar"
  showRoleBadge(ui, 'typer', room.code);
  ui.lettersInput.focus();

  const showMessage = (text: string, type: string) => {
    ui.lettersMessage.textContent = text;
    ui.lettersMessage.className = `letters-message ${type}`;
    setTimeout(() => {
      ui.lettersMessage.textContent = '';
      ui.lettersMessage.className = 'letters-message';
    }, 900);
  };

  const sendInput = () => {
    const value = ui.lettersInput.value.trim().toUpperCase();
    if (!value) return;
    room.send('typer:input', { value }).catch((error) => {
      ErrorLogger.log('lettersFall.typer.sendInput', error);
    });
  };

  ui.lettersInput.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      sendInput();
      event.preventDefault();
    }
  });

  const unsubscribers = [
    room.on('viewer:result', (payload) => {
      const { type } = payload as { type: 'success' | 'fail' | 'miss-attempt'; text: string };
      if (type === 'success') {
        audioManager?.play('good');
        showMessage('Correcto', 'success');
        ui.lettersInput.value = '';
      } else if (type === 'fail') {
        audioManager?.play('miss');
        showMessage('Se te escapó una', 'fail');
      } else {
        showMessage('No es esa', 'fail');
      }
    }),
    room.on('viewer:state', (payload) => {
      const { score, best, lives } = payload as { score: number; best: number; lives: number };
      ui.lettersScore.textContent = `Puntuación: ${score}`;
      ui.lettersBest.textContent = `Mejor: ${best}`;
      ui.lettersLives.innerHTML = Array.from({ length: lives }, () => '<span>❤️</span>').join('');
    }),
    room.on('viewer:gameover', (payload) => {
      const { score } = payload as { score: number };
      ui.lettersMessage.textContent = 'GAME OVER';
      ui.lettersMessage.classList.add('fail');
      ui.lettersInput.disabled = true;
      void score;
    }),
  ];

  GameInstanceRegistry.set('letters', {
    leave: () => {
      unsubscribers.forEach((off) => off());
      room.leave().catch(() => {});
    },
  } satisfies StoppableInstance);
}

/**
 * En el viewer, cada tecla escrita por el typer llega vía
 * `typer:input` — se refleja en `game.state.currentInput` y se valida
 * con el mismo `checkInputMatch()` que usa el modo solo, así toda la
 * lógica de puntaje/vidas queda en un único lugar.
 */
function listenForTyperInput(room: RoomSession, game: LettersFallGame) {
  room.on('typer:input', (payload) => {
    const { value } = payload as { value: string };
    game.state.currentInput = value;
    game.checkInputMatch();
  });
}

/** Texto de estado mostrado mientras se espera al otro jugador. */
function setRoomStatus(ui: LettersFallUi, text: string, code?: string) {
  ui.roomStatus.classList.remove('hidden');
  ui.roomStatusText.textContent = text;
  if (code) {
    ui.roomCodeDisplay.textContent = code;
    ui.roomCodeDisplay.classList.remove('hidden');
  } else {
    ui.roomCodeDisplay.classList.add('hidden');
  }
}

function hidePanelStep(...steps: HTMLElement[]) {
  steps.forEach((el) => el.classList.add('hidden'));
}

/**
 * Conecta (o crea) la sala y espera a que el otro rol aparezca antes
 * de arrancar el tablero — `onPeersChange` se dispara con el snapshot
 * completo de presencia cada vez que alguien entra o sale, así que
 * basta con revisar si el rol contrario ya está en la lista.
 */
async function connectAndWait(
  ui: LettersFallUi,
  mode: 'create' | 'join',
  role: CoopRole,
  code: string
): Promise<void> {
  const otherRole: CoopRole = role === 'viewer' ? 'typer' : 'viewer';

  setRoomStatus(ui, mode === 'create' ? 'Creando sala…' : 'Conectando…');

  let room: RoomSession;
  try {
    const connectPromise = mode === 'create' ? createRoom('letters', role) : joinRoom('letters', code, role);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tiempo de espera agotado conectando a la sala')), 10000);
    });
    room = await Promise.race([connectPromise, timeoutPromise]);
  } catch (error) {
    ErrorLogger.log('lettersFall.connectAndWait', error, { mode, role, code });
    setRoomStatus(
      ui,
      'No se pudo conectar a la sala. Puede ser tu conexión, o que el proyecto no tenga Realtime habilitado. Probá de nuevo o volvé atrás.'
    );
    return;
  }

  const alreadyThere = room.peers().some((peer) => peer.role === otherRole);
  if (alreadyThere) {
    launchCoop(ui, role, room);
    return;
  }

  setRoomStatus(
    ui,
    `Esperando a que se una el ${otherRole === 'viewer' ? 'viewer' : 'typer'}…`,
    room.code
  );

  const off = room.onPeersChange((peers) => {
    if (peers.some((peer) => peer.role === otherRole)) {
      off();
      launchCoop(ui, role, room);
    }
  });

  ui.roomCancel.addEventListener(
    'click',
    () => {
      off();
      room.leave().catch(() => {});
      hidePanelStep(ui.roomStatus);
      ui.lettersModePanel.classList.remove('hidden');
    },
    { once: true }
  );
}

function launchCoop(ui: LettersFallUi, role: CoopRole, room: RoomSession) {
  hidePanelStep(ui.roomStatus, ui.roleChooser, ui.lettersModePanel);
  if (role === 'viewer') {
    startGameCard(ui, 'viewer', room);
    const game = GameInstanceRegistry.get<LettersFallGame>('letters');
    if (game) listenForTyperInput(room, game);
  } else {
    startTyperMode(ui, room);
  }
}

export function init(rawUi: GameUi) {
  const ui = rawUi as unknown as LettersFallUi;
  if (!ui.start) return; // sección no presente

  let pendingMode: 'create' | 'join' = 'create';

  // `roleChooser` y `roomStatus` viven anidados DENTRO de
  // `lettersModePanel` (ver js/views/letters.ts), no como hermanos al
  // mismo nivel. `lettersModePanel` en sí nunca debe llevar `hidden`
  // mientras se está navegando entre sus pasos internos: ocultarlo
  // esconde también a sus hijos aunque estos no tengan la clase
  // `hidden` puesta, dejando la pantalla en blanco pese a que
  // `roleChooser`/`roomStatus` estén "visibles" en el DOM.
  const innerSteps = [ui.roleChooser, ui.roomStatus] as const;
  const modeOptions = ui.lettersModePanel.querySelector<HTMLElement>('.letters-mode-options');

  const showStep = (step: HTMLElement) => {
    ui.lettersModePanel.classList.remove('hidden');
    const showingModeOptions = step === ui.lettersModePanel;
    modeOptions?.classList.toggle('hidden', !showingModeOptions);
    innerSteps.forEach((el) => {
      el.classList.toggle('hidden', el !== step);
    });
  };

  ui.modeSolo.addEventListener('click', () => startGameCard(ui, 'solo', null));

  ui.modeCreate.addEventListener('click', () => {
    pendingMode = 'create';
    selectedRole = null;
    ui.joinCodeRow.classList.add('hidden');
    ui.roleViewer.setAttribute('aria-pressed', 'false');
    ui.roleTyper.setAttribute('aria-pressed', 'false');
    ui.roleConfirm.disabled = true;
    ui.roleChooserLabel.textContent = 'Elegí tu rol (vas a compartir el código después):';
    showStep(ui.roleChooser);
  });

  ui.modeJoin.addEventListener('click', () => {
    pendingMode = 'join';
    selectedRole = null;
    ui.joinCodeRow.classList.remove('hidden');
    ui.roleViewer.setAttribute('aria-pressed', 'false');
    ui.roleTyper.setAttribute('aria-pressed', 'false');
    ui.roleConfirm.disabled = true;
    ui.roleChooserLabel.textContent = 'Ingresá el código y elegí tu rol:';
    showStep(ui.roleChooser);
  });

  ui.roleBack.addEventListener('click', () => showStep(ui.lettersModePanel));

  let selectedRole: CoopRole | null = null;
  const selectRole = (role: CoopRole) => {
    selectedRole = role;
    ui.roleViewer.setAttribute('aria-pressed', String(role === 'viewer'));
    ui.roleTyper.setAttribute('aria-pressed', String(role === 'typer'));
    const codeOk = selectedRole !== null && (pendingMode === 'create' || ui.joinCodeInput.value.trim().length === 4);
    ui.roleConfirm.disabled = !codeOk;
  };
  ui.roleViewer.addEventListener('click', () => selectRole('viewer'));
  ui.roleTyper.addEventListener('click', () => selectRole('typer'));

  ui.joinCodeInput.addEventListener('input', () => {
    ui.joinCodeInput.value = ui.joinCodeInput.value.toUpperCase().slice(0, 4);
    const codeOk = pendingMode === 'create' || ui.joinCodeInput.value.trim().length === 4;
    ui.roleConfirm.disabled = !selectedRole || !codeOk;
  });

  ui.roleConfirm.addEventListener('click', () => {
    if (!selectedRole) return;
    showStep(ui.roomStatus);
    connectAndWait(ui, pendingMode, selectedRole, ui.joinCodeInput.value);
  });
}

export function stop() {
  const instance = GameInstanceRegistry.get<StoppableInstance>('letters');
  if (instance?.reset) instance.reset();
  if (instance?.leave) instance.leave();
  GameInstanceRegistry.clear('letters');
}
