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
 *
 * Modo 1v1 ('p1'/'p2'): ambos jugadores ven caer el mismo pool de
 * palabras (generado y transmitido por 'p1', ver GENERATOR_ROLE más
 * abajo) en pantalla dividida (Vos | Rival, mismo patrón que
 * Simon/Arrow/Termita — ver multiplayerSplitView.ts), pero cada uno
 * corre su propio motor de físicas/vidas de forma independiente: si
 * una palabra se le escapa a un jugador, solo él pierde una vida (ver
 * checkDangerZone/loseLife) — no hay "dueño" por palabra, cualquiera
 * de los dos puede escribir cualquiera de las palabras que ve caer en
 * su propio lado.
 */
type CoopRole = 'solo' | 'viewer' | 'typer' | 'p1' | 'p2';

/** Roles que participan del modo 1v1 (por oposición a 'solo'/'viewer'/'typer'). */
function isVersusRole(role: CoopRole): role is 'p1' | 'p2' {
  return role === 'p1' || role === 'p2';
}

/** En el modo 1v1, 'p1' (quien crea la sala) es quien genera y
 *  transmite cada palabra nueva — 'p2' nunca llama a spawnWord() por
 *  su cuenta, solo agrega al tablero lo que recibe. Ver
 *  comentario largo en CoopRole más arriba. */
const VERSUS_GENERATOR_ROLE: CoopRole = 'p1';

interface LettersFallUi {
  start: HTMLButtonElement;
  retry: HTMLButtonElement;
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
  // ── Modo 1v1 (ver CoopRole) ──
  modeVersus: HTMLElement;
  versusChooser: HTMLElement;
  versusCreate: HTMLElement;
  versusJoin: HTMLElement;
  versusJoinCodeRow: HTMLElement;
  versusJoinCodeInput: HTMLInputElement;
  versusJoinConfirm: HTMLButtonElement;
  versusBack: HTMLElement;
  lettersSplit?: HTMLElement;
  lettersSplitLabel?: HTMLElement;
  lettersRivalSide?: HTMLElement;
  lettersRival?: HTMLElement;
  lettersRivalLabel?: HTMLElement;
  lettersRivalLives?: HTMLElement;
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
   * Modo coop/versus. En 'solo' (default) el juego funciona
   * exactamente igual que antes de agregar salas — `room` queda null
   * y nada de la lógica de sincronización se activa. En coop, el
   * viewer es la única instancia que corre `update()`/`spawnWord()`
   * (motor único de físicas, para que las dos pantallas nunca vean
   * palabras distintas); ver protocolo de eventos en `connectRoom`
   * más abajo. El typer nunca instancia `LettersFallGame`, ver
   * `initTyperMode`.
   *
   * En 1v1 ('p1'/'p2'), a diferencia del coop, AMBOS instancian
   * `LettersFallGame` y corren su propio `update()` — pero solo 'p1'
   * (VERSUS_GENERATOR_ROLE) llama a `spawnWord()` por su cuenta; 'p2'
   * solo agrega al tablero las palabras que recibe vía
   * `versus:word` (ver `spawnWord`/`receiveVersusWord` más abajo),
   * así ambos ven el mismo pool de palabras aunque cada uno controle
   * sus propias vidas de forma independiente.
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

    // Modo 1v1, lado no-generador ('p2'): agrega al tablero cada
    // palabra que recibe de 'p1' en vez de generar las suyas propias
    // (ver comentario largo sobre `role` más arriba). El generador
    // ('p1') nunca se suscribe a este evento — es él quien lo emite,
    // ver spawnWord().
    if (isVersusRole(this.role) && this.role !== VERSUS_GENERATOR_ROLE && this.room) {
      this.room.on('versus:word', (payload) => {
        const { text, x } = payload as { text: string; x: number };
        this.spawnReceivedWord(text, x);
      });
      // 'p2' no tiene su propio botón "Empezar" activo en 1v1 (ver
      // wireVersusStartButton) — arranca reaccionando a la señal que
      // 'p1' emite en su propio start() (ver más abajo), así ambos
      // arrancan en el mismo instante.
      this.room.on('versus:start', () => {
        this.start();
      });
    }
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
    // En 1v1, solo 'p1' llama a start() desde el click de "Empezar"
    // (el guard vive en wireDifficultyAndInput, y el botón además
    // queda oculto/deshabilitado para 'p2' en wireVersusMode) — 'p2'
    // llega acá reaccionando al 'versus:start' que 'p1' emite. Se
    // restringe explícitamente el envío al generador para no depender
    // de esos otros dos guards.
    if (this.role === VERSUS_GENERATOR_ROLE && this.room) {
      this.room.send('versus:start', {}).catch((error) => {
        ErrorLogger.log('lettersFall.start.broadcastVersusStart', error);
      });
    }
  }

  /**
   * Reinicia la partida en la MISMA sala tras un game over — a
   * diferencia de `start()`, oculta el botón "Jugar de nuevo" que
   * `gameOver()` reveló y, en coop, le avisa al typer para que
   * rehabilite su input (que `viewer:gameover` había deshabilitado)
   * en vez de quedar bloqueado para siempre. En 1v1 cada lado
   * reintenta con su propio click de "Jugar de nuevo" — no hace falta
   * coordinar el arranque como con `versus:start`, ya que a
   * diferencia del primer inicio (que si no se coordina hace que las
   * palabras del generador empiecen a caer antes de que 'p2' esté
   * mirando), acá ambos tableros ya están montados y listos.
   */
  retry() {
    this.start();
    if (this.role === 'viewer' && this.room) {
      this.room.send('viewer:retry', {}).catch((error) => {
        ErrorLogger.log('lettersFall.retry.notifyPeer', error);
      });
    }
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
    // Oculta "Jugar de nuevo" acá (no solo en retry()) para cubrir
    // también el primer start() de la partida, por si gameOver()
    // llegó a mostrarlo en algún estado previo que reset() no haya
    // limpiado por otro camino.
    this.ui.retry.classList.add('hidden');
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
    // En 1v1, el generador ('p1') transmite cada palabra nueva para
    // que 'p2' vea exactamente el mismo pool (ver comentario largo
    // sobre `role` en el constructor) — no aplica a coop ('viewer'/
    // 'typer' ya comparten un único motor de físicas, no hace falta
    // este mecanismo ahí) ni a 'solo'.
    if (this.role === VERSUS_GENERATOR_ROLE && this.room) {
      this.room.send('versus:word', { text, x }).catch((error) => {
        ErrorLogger.log('lettersFall.spawnWord.broadcast', error, { text });
      });
    }
  }

  /**
   * Lado no-generador del modo 1v1 ('p2'): agrega al tablero una
   * palabra recibida de 'p1' en vez de generarla localmente — mismo
   * texto/posición x que ve el generador, con la velocidad ya
   * calculada localmente (wordSpeed depende de la dificultad, que es
   * la misma para ambos porque la fija quien crea la sub-partida,
   * igual que Simon/Arrow/Termita — ver applyVersusSettings). Cada
   * cliente sigue corriendo su propio update()/checkDangerZone sobre
   * su copia local de la palabra, así que las vidas quedan
   * independientes aunque el contenido sea idéntico.
   */
  spawnReceivedWord(text: string, x: number) {
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
      // En 1v1, solo el generador ('p1') decide cuándo aparece cada
      // palabra nueva — el lado no-generador ('p2') solo reacciona a
      // `versus:word` (ver spawnReceivedWord/constructor), nunca
      // dispara su propio spawnWord() por temporizador local, o
      // vería el doble de palabras que su rival.
      const canAutoSpawn = !isVersusRole(this.role) || this.role === VERSUS_GENERATOR_ROLE;
      if (canAutoSpawn && (enoughSpace || this.state.words.length === 0)) {
        this.spawnWord();
        this.state.nextSpawnTime = now + this.state.spawnInterval;
      } else {
        this.state.nextSpawnTime = now + 120;
      }
    }

    // checkInputMatch() se llama SOLO al presionar Enter (ver
    // wireDifficultyAndInput/listenForTyperInput) — antes se llamaba
    // acá en cada frame de update() (~60/s), así que cualquier valor
    // parcial tipeado que por casualidad coincidiera con el texto
    // completo de una palabra en pantalla se "confirmaba" solo, sin
    // que el jugador hubiera apretado Enter. Escribiendo rápido eso
    // pasaba seguido: el input se vaciaba a mitad de la palabra
    // siguiente en cuanto el texto parcial calzaba con alguna palabra
    // cayendo. Sacar la llamada de acá es el fix.
    this.checkDangerZone();

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
    // Antes no había forma de volver a jugar en la misma sala: el
    // botón "Iniciar" no se volvía a mostrar tras game over (queda
    // oculto/deshabilitado desde que arrancó la partida, ver
    // startGameCard/wireVersusMode) y el typer quedaba con el input
    // deshabilitado para siempre (ver viewer:gameover en
    // startTyperMode). Mostrar "Jugar de nuevo" acá, en todos los
    // roles con tablero propio ('solo'/'viewer'/'p1'/'p2'), es el
    // punto de entrada para reintentar sin salir de la sala.
    if (this.role !== 'typer') {
      this.ui.retry.classList.remove('hidden');
      this.ui.retry.disabled = false;
    }
    if (this.role === 'viewer' && this.room) {
      this.room.send('viewer:gameover', { score: this.state.score }).catch((error) => {
        ErrorLogger.log('lettersFall.gameOver.notifyPeer', error);
      });
    }
    if (isVersusRole(this.role) && this.room) {
      // Avisa al rival de que este lado terminó (su propio juego sigue
      // corriendo de forma independiente — vidas separadas, ver
      // comentario largo sobre `role` en el constructor). El panel
      // rival del split-screen usa esto para mostrar "Rival: GAME
      // OVER" en vez de solo dejar de recibir versus:state.
      this.room.send('versus:gameover', { score: this.state.score }).catch((error) => {
        ErrorLogger.log('lettersFall.gameOver.notifyVersusPeer', error);
      });
      // Reporta el score final vía updateScore() (no finishRoomMatch):
      // finishRoomMatch() marca la sala 'completed' en la DB y limpia
      // multiplayerSystem.currentMatch — eso rompía por completo el
      // botón "Jugar de nuevo" en 1v1, porque room.send() (usado por
      // start()/spawnWord() del reintento) depende de currentMatch y
      // se volvía un no-op silencioso una vez limpio, dejando al rival
      // sin recibir ninguna palabra ni estado de la revancha. Con
      // updateScore(), el score queda guardado en `scores` (por si el
      // jugador termina abandonando sin reintentar — ver leave() más
      // abajo, que si cierra la sala) pero la sala sigue 'playing' y
      // disponible para un retry() inmediato en el mismo room.
      void multiplayerSystem.updateScore(this.state.score).catch((error: unknown) => {
        ErrorLogger.log('lettersFall.gameOver.updateScore', error);
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
    // Supabase en cualquier partida coop/1v1 mínimamente larga.
    //
    // En coop, solo 'viewer' envía (el typer no tiene su propio
    // tablero/score que reportar). En 1v1, AMBOS envían: cada jugador
    // tiene sus propias vidas/score independientes y el split-screen
    // del rival necesita verlos (ver wireVersusRivalPanel).
    const shouldSendState = (this.role === 'viewer' || isVersusRole(this.role)) && this.room;
    if (shouldSendState) {
      const current = { score: this.state.score, best: this.state.best, lives: this.state.lives };
      const changed = !this.lastSentState
        || current.score !== this.lastSentState.score
        || current.best !== this.lastSentState.best
        || current.lives !== this.lastSentState.lives;
      if (changed) {
        this.lastSentState = current;
        const eventType = isVersusRole(this.role) ? 'versus:state' : 'viewer:state';
        this.room!.send(eventType, current).catch(() => {
          // Silencioso: un fallo puntual de red acá no debe interrumpir
          // el juego. lastSentState ya quedó actualizado arriba a
          // propósito (no se revierte en el catch): si se revirtiera,
          // una racha de fallos de red sostenidos volvería a reintentar
          // el envío en cada frame siguiente, reintroduciendo el mismo
          // spam que este fix busca evitar. El costo es que el rival
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
  ui.start.addEventListener('click', () => {
    // En 1v1, 'p2' nunca debe arrancar por click propio — solo
    // reacciona a 'versus:start' del generador (ver
    // LettersFallGame.start()/constructor). El botón ya queda oculto/
    // deshabilitado para 'p2' en wireVersusMode, pero este guard evita
    // un doble arranque si igual llegara a dispararse (p.ej. Enter
    // sobre un botón deshabilitado en algunos navegadores/AT).
    if (isVersusRole(game.role) && game.role !== VERSUS_GENERATOR_ROLE) return;
    game.start();
  });

  ui.retry.addEventListener('click', () => game.retry());

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
      // checkInputMatch() solo limpia ui.lettersInput.value cuando hay
      // match (ver la rama `if (matchIndex >= 0)` más arriba en este
      // archivo) — un intento fallido dejaba el texto tipeado en el
      // input, obligando a borrarlo a mano antes de poder escribir la
      // próxima palabra. Enter siempre limpia el campo, haya
      // acertado o no, para que se pueda seguir escribiendo de
      // corrido.
      game.checkInputMatch();
      ui.lettersInput.value = '';
      game.state.currentInput = '';
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
  if (role === 'p1' || role === 'p2') {
    ui.lettersRoleBadge.textContent = `🆚 1v1 · Sala ${code}`;
  } else {
    ui.lettersRoleBadge.textContent = role === 'viewer' ? `👀 Viewer · Sala ${code}` : `⌨️ Typer · Sala ${code}`;
  }
  ui.lettersRoleBadge.classList.remove('hidden');
}

/**
 * Arranca el juego en modo 'solo' (comportamiento original, sin sala),
 * 'viewer' (con sala coop activa), o 'p1'/'p2' (sala 1v1) — todos usan
 * la misma clase `LettersFallGame`, la diferencia es si `room` es null
 * o no y qué `role` se le pasa.
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

  if (isVersusRole(role)) {
    wireVersusMode(ui, role, room!, game);
  }

  GameInstanceRegistry.set('letters', game);
}

/**
 * Cablea las diferencias del modo 1v1 sobre el tablero normal: solo
 * 'p1' (VERSUS_GENERATOR_ROLE) tiene el botón "Empezar" visible — 'p2'
 * arranca reaccionando a 'versus:start' (ver LettersFallGame.start()),
 * no clickeando el suyo — y ambos pintan un panel resumen con el
 * score/vidas del rival (recibidos vía 'versus:state'/
 * 'versus:gameover', ver updateUI()/gameOver() en LettersFallGame).
 */
function wireVersusMode(ui: LettersFallUi, role: 'p1' | 'p2', room: RoomSession, game: LettersFallGame) {
  const isHost = role === VERSUS_GENERATOR_ROLE;
  const rivalLabel = ui.lettersRivalLabel;
  const rivalLives = ui.lettersRivalLives;
  // `lettersSplit` está siempre presente (Solo/Coop lo usan como
  // wrapper de una sola columna alrededor de `lettersArea`, ver
  // js/views/letters.ts) — en 1v1 se le agrega la clase modificadora
  // que activa el grid de dos columnas y se revela el lado del rival,
  // que en el resto de los modos queda oculto (ver css/letters.css).
  ui.lettersSplit?.classList.add('letters-split--active');
  ui.lettersSplitLabel?.classList.remove('hidden');
  ui.lettersRivalSide?.classList.remove('hidden');

  if (!isHost) {
    ui.start.disabled = true;
    ui.start.classList.add('hidden');
    ui.lettersMessage.textContent = 'Esperando a que el anfitrión empiece la partida...';
  } else {
    ui.lettersMessage.textContent = '1v1: presioná Empezar cuando quieras. Tu rival arranca junto con vos.';
  }

  room.on('versus:state', (payload) => {
    const { score, lives } = payload as { score: number; best: number; lives: number };
    if (rivalLabel) rivalLabel.textContent = `Rival — ${score} pts`;
    if (rivalLives) rivalLives.innerHTML = Array.from({ length: Math.max(0, lives) }, () => '<span>❤️</span>').join('');
  });

  room.on('versus:gameover', (payload) => {
    const { score } = payload as { score: number };
    if (rivalLabel) rivalLabel.textContent = `Rival — GAME OVER (${score} pts)`;
  });

  void game; // reservado por si a futuro hace falta leer estado propio acá
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
      // Antes solo se limpiaba al recibir viewer:result de tipo
      // 'success' (ver abajo) — un intento fallido, o la demora
      // normal del viaje de ida y vuelta a Supabase, dejaba el texto
      // tipeado en el input. Se limpia acá mismo, en el momento de
      // enviar, igual que en el modo solo/viewer.
      sendInput();
      ui.lettersInput.value = '';
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
    // Antes no existía ningún evento de reintento, así que
    // ui.lettersInput.disabled quedaba en true para siempre tras el
    // primer game over de la sala — el typer no podía volver a
    // escribir ni aunque el viewer arrancara una partida nueva. Este
    // handler responde al `viewer:retry` que LettersFallGame.retry()
    // emite (ver más arriba) y deja al typer listo para la revancha.
    room.on('viewer:retry', () => {
      ui.lettersInput.disabled = false;
      ui.lettersInput.value = '';
      ui.lettersMessage.textContent = '';
      ui.lettersMessage.className = 'letters-message';
      ui.lettersInput.focus();
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
    // checkInputMatch() se llama ACÁ, en cuanto llega el evento, y ya
    // no depende del próximo frame de requestAnimationFrame del
    // viewer (antes update() la llamaba una vez por frame, ~60/s —
    // ver el comentario en update()). Elimina hasta ~16ms de espera
    // extra encima del round-trip real a Supabase, que es la parte
    // del delay que no se puede evitar del todo (dos clientes reales
    // sincronizados por DB, no un solo dispositivo).
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

/** Texto legible del rol contrario para el mensaje de "Esperando a que se una...". */
function describeRole(role: CoopRole): string {
  if (role === 'viewer') return 'el viewer';
  if (role === 'typer') return 'el typer';
  return 'tu rival'; // p1/p2: 1v1 es simétrico, no hay nombre de rol distinto que mostrar
}

/** Rol contrario dentro de la misma sala — necesario para saber a
 *  quién esperar en connectAndWait (el viewer espera al typer y
 *  viceversa; p1 espera a p2 y viceversa). No tiene sentido para
 *  'solo', que nunca pasa por acá. */
function getOtherRole(role: CoopRole): CoopRole {
  if (role === 'viewer') return 'typer';
  if (role === 'typer') return 'viewer';
  if (role === 'p1') return 'p2';
  return 'p1';
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
  const otherRole: CoopRole = getOtherRole(role);

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
    // 'Ese rol ya está ocupado...' es el mensaje explícito de
    // joinRoomMatch (multiplayerSystem.ts) cuando el otro jugador de la
    // sala ya tomó el mismo rol — vale la pena mostrárselo tal cual en
    // vez del genérico de conexión, porque acá sí hay algo concreto que
    // el jugador puede hacer (volver y elegir el otro rol).
    const message = error instanceof Error && error.message.includes('Ese rol ya está ocupado')
      ? error.message
      : 'No se pudo conectar a la sala. Puede ser tu conexión, o que el proyecto no tenga Realtime habilitado. Probá de nuevo o volvé atrás.';
    setRoomStatus(ui, message);
    return;
  }

  const alreadyThere = room.peers().some((peer) => peer.role === otherRole);
  if (alreadyThere) {
    launchCoop(ui, role, room);
    return;
  }

  setRoomStatus(
    ui,
    `Esperando a que se una ${describeRole(otherRole)}…`,
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

/**
 * Arranca la partida en la sala una vez que ambos roles están
 * presentes — coop (viewer/typer) o 1v1 (p1/p2, ambos usan
 * startGameCard con su propio tablero completo, a diferencia del
 * typer que no tiene tablero — ver wireVersusMode para las
 * diferencias de UI/arranque sincronizado del 1v1).
 */
function launchCoop(ui: LettersFallUi, role: CoopRole, room: RoomSession) {
  hidePanelStep(ui.roomStatus, ui.roleChooser, ui.lettersModePanel);
  if (role === 'viewer') {
    startGameCard(ui, 'viewer', room);
    const game = GameInstanceRegistry.get<LettersFallGame>('letters');
    if (game) listenForTyperInput(room, game);
  } else if (role === 'p1' || role === 'p2') {
    startGameCard(ui, role, room);
  } else {
    startTyperMode(ui, room);
  }
}

/**
 * Referencia a la `ui` de la última vez que se llamó `init()`, para
 * que `stop()` (que no recibe parámetros — ver GameConfig.stop en
 * core/gameRegistry.ts) pueda volver a mostrar el panel de selección
 * de modo al salir de la vista. El DOM de `#letters` persiste entre
 * visitas (no se vacía al salir, ver comentario en
 * GameRegistry.stopGame), así que sin esto, reentrar a Letters Fall
 * después de haber jugado una partida mostraba el tablero de juego
 * congelado en vez de volver a "Solo / Crear sala / Unirse a sala".
 */
let lastUi: LettersFallUi | null = null;

export function init(rawUi: GameUi) {
  const ui = rawUi as unknown as LettersFallUi;
  if (!ui.start) return; // sección no presente
  lastUi = ui;

  let pendingMode: 'create' | 'join' = 'create';

  // `roleChooser` y `roomStatus` viven anidados DENTRO de
  // `lettersModePanel` (ver js/views/letters.ts), no como hermanos al
  // mismo nivel. `lettersModePanel` en sí nunca debe llevar `hidden`
  // mientras se está navegando entre sus pasos internos: ocultarlo
  // esconde también a sus hijos aunque estos no tengan la clase
  // `hidden` puesta, dejando la pantalla en blanco pese a que
  // `roleChooser`/`roomStatus` estén "visibles" en el DOM.
  const innerSteps = [ui.roleChooser, ui.versusChooser, ui.roomStatus] as const;
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

  // ── Modo 1v1: a diferencia de coop (roleChooser), es simétrico —
  // no hay rol que elegir entre 'p1'/'p2'. `versusChooser` solo pide
  // crear una sala nueva o unirse con un código; el rol ('p1' host /
  // 'p2' quien se une) queda implícito según qué botón se usó, igual
  // que el patrón crear/unirse de coop pero sin el paso de rol.
  ui.modeVersus.addEventListener('click', () => {
    ui.versusJoinCodeRow.classList.add('hidden');
    ui.versusJoinCodeInput.value = '';
    ui.versusJoinConfirm.disabled = true;
    showStep(ui.versusChooser);
  });

  ui.versusBack.addEventListener('click', () => showStep(ui.lettersModePanel));

  ui.versusCreate.addEventListener('click', () => {
    showStep(ui.roomStatus);
    connectAndWait(ui, 'create', 'p1', '');
  });

  ui.versusJoin.addEventListener('click', () => {
    ui.versusJoinCodeRow.classList.remove('hidden');
    ui.versusJoinCodeInput.focus();
  });

  ui.versusJoinCodeInput.addEventListener('input', () => {
    ui.versusJoinCodeInput.value = ui.versusJoinCodeInput.value.toUpperCase().slice(0, 4);
    ui.versusJoinConfirm.disabled = ui.versusJoinCodeInput.value.trim().length !== 4;
  });

  ui.versusJoinConfirm.addEventListener('click', () => {
    if (ui.versusJoinCodeInput.value.trim().length !== 4) return;
    showStep(ui.roomStatus);
    connectAndWait(ui, 'join', 'p2', ui.versusJoinCodeInput.value);
  });

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

  // Restaura la pantalla de selección de modo (Solo / Crear sala /
  // Unirse a sala) para la próxima vez que se entre a la vista — ver
  // el comentario en la declaración de `lastUi` más arriba.
  const ui = lastUi;
  if (ui) {
    ui.lettersCard.classList.add('hidden');
    delete ui.lettersCard.dataset.role;
    ui.lettersRoleBadge.classList.add('hidden');
    ui.lettersInput.disabled = false;

    ui.lettersModePanel.classList.remove('hidden');
    ui.lettersModePanel.querySelector<HTMLElement>('.letters-mode-options')?.classList.remove('hidden');
    ui.roleChooser.classList.add('hidden');
    ui.versusChooser?.classList.add('hidden');
    ui.roomStatus.classList.add('hidden');

    // Revierte el split-screen del 1v1 (ver wireVersusMode) para que
    // la próxima partida (Solo/Coop) no arranque con el grid de dos
    // columnas ni el panel del rival visible — ver comentario sobre
    // `lettersSplit` siempre presente en js/views/letters.ts.
    ui.lettersSplit?.classList.remove('letters-split--active');
    ui.lettersSplitLabel?.classList.add('hidden');
    ui.lettersRivalSide?.classList.add('hidden');
    if (ui.start) (ui.start as HTMLButtonElement).disabled = false;
    ui.start?.classList.remove('hidden');
    ui.retry?.classList.add('hidden');
    if (ui.retry) (ui.retry as HTMLButtonElement).disabled = false;
  }
}
