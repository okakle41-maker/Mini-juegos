/**
 * js/games/pairs.logic.ts
 *
 * Lógica pesada del juego "Pairs" (init/stop), extraída de pairs.ts
 * para que el bundler le dé su propio chunk — ver `logic` en pairs.ts
 * y el comentario de GameConfig.logic en core/gameRegistry.ts.
 */

import type { GameUi } from '../types/game.js';
import GameHelpers from '../utils/gameHelpers.js';
import audioManager from '../audioManager.js';

let lock = false;
/** Cleanup manager del juego, creado en init() y usado también desde
 *  stop() (fuera del scope de init) — ver comentario donde se crea. */
let cleanup: ReturnType<typeof GameHelpers.createCleanupManager> | null = null;

interface Card {
  icon: string;
  id: number;
  color: string;
  flipped: boolean;
  matched: boolean;
}

export function init(ui: GameUi) {
  const {
    startPairs, pairsBoard,
    pairsMovesEl, pairsPairsEl, pairsTimeEl,
    pairsTimerBar,
    pairsMessage
  } = ui;
  // NOTA: los botones de dificultad usan `data-ui-all` (múltiples elementos),
  // un atributo que GameRegistry.resolveUi no resuelve (solo entiende
  // `data-ui`, que mapea un único elemento por clave). Se consultan aparte
  // para no depender de ese mecanismo no soportado.
  const pairsDiffBtns = document.querySelectorAll<HTMLElement>('[data-ui-all="pairsDiffBtns"]');

  if (!startPairs) return;

  // Centraliza el timer de cuenta regresiva y los setTimeout de la
  // animación de flip/match (antes: `timerInterval` suelto + 3
  // `setTimeout` sin trackear). `stop()` limpia todo de una vez —
  // antes, si el usuario salía del juego a mitad de una animación de
  // flip, esos setTimeout igual disparaban después y tocaban cards/el
  // de una vista que ya no estaba visible.
  cleanup = GameHelpers.createCleanupManager();
  // Igual que en rhythmclick.logic.ts: las funciones anidadas más
  // abajo (startGame, flip handlers, etc.) son closures sobre la
  // variable de módulo `cleanup` — TS no puede garantizar que siga
  // no-nula en el momento en que esas closures se ejecuten (en teoría
  // podría llamarse stop() entre medio y ponerla en null vía el
  // manejo externo, aunque en la práctica stop() la deja asignada,
  // solo limpia sus timers). Se fija una referencia local no-nula
  // para el resto de init(): es la misma instancia, y stop() sigue
  // usando `cleanup?.cleanup()` con su propio optional chaining para
  // el caso de llamarse antes de que init() corra.
  const cleanupManager = cleanup;

  const ICONS = [
    'skull','flame','bolt','star','moon','sun','cloud','snowflake',
    'diamond','crown','anchor','leaf','bug','rocket','compass','eye',
    'lock','key','shield','ghost','fish','heart','bell','camera'
  ];

  const ICON_COLORS = [
    '#f87171','#fb923c','#fbbf24','#34d399','#22d3ee','#818cf8',
    '#e879f9','#f472b6','#94a3b8','#4ade80','#2dd4bf','#60a5fa',
    '#c084fc','#f9a8d4','#fcd34d','#86efac','#67e8f9','#a5b4fc',
    '#fda4af','#f97316','#22d3ee','#a78bfa','#86efac','#f43f5e'
  ];

  let pairs = 12, totalTime = 90;
  let cards: Card[] = [];
  let flipped: Array<{ i: number; el: HTMLElement }> = [];
  let matched = 0, moves = 0;
  let timeLeft = 90;

  function setDifficulty(n: number, _time: number) {
    pairs = n;
    totalTime = 90;
    timeLeft = totalTime;
    pairsDiffBtns.forEach((b: HTMLElement) => {
      const isActive = parseInt(b.dataset.pairs || '0') === n;
      b.classList.toggle('pairs-diff--active', isActive);
      b.setAttribute('aria-pressed', String(isActive));
    });
    startGame();
  }

  // shuffle: ver GameHelpers.shuffle (js/utils/gameHelpers.ts) — la
  // versión local mutaba el array in-place; se migró a la versión no
  // mutante compartida. Ambos usos en este archivo pasan arrays
  // recién creados que no se reutilizan después, así que el cambio
  // de comportamiento (copia en vez de mutación) es transparente aquí.

  function startGame() {
    cleanupManager.cleanup();
    flipped = []; matched = 0; moves = 0; lock = false;
    timeLeft = totalTime;
    pairsMovesEl.textContent = '0';
    pairsPairsEl.textContent = '0';
    pairsTimeEl.textContent = String(timeLeft);
    pairsMessage.textContent = '';
    pairsMessage.className = 'pairs-message';
    pairsTimerBar.style.width = '100%';
    pairsTimerBar.style.background = '#22d3ee';

    const pool = GameHelpers.shuffle([...ICONS]).slice(0, pairs);
    const colorMap: Record<string, string> = {};
    pool.forEach((ic, i) => { colorMap[ic] = ICON_COLORS[i % ICON_COLORS.length]; });

    cards = GameHelpers.shuffle([...pool, ...pool].map((icon, i) => ({
      icon, id: i, color: colorMap[icon], flipped: false, matched: false
    })));

    renderBoard();
    cleanupManager.addInterval(tick, 1000);
  }

  function tick() {
    timeLeft--;
    pairsTimeEl.textContent = String(timeLeft);
    const pct = timeLeft / totalTime * 100;
    pairsTimerBar.style.width = pct + '%';
    pairsTimerBar.style.background =
      pct > 50 ? '#22d3ee' : pct > 25 ? '#f97316' : '#f43f5e';
    if (timeLeft <= 0) {
      cleanupManager.cleanup();
      endGame(false);
    }
  }

  function getColumns(): number {
    if (pairs === 12) return 6;
    if (pairs === 16) return 8;
    if (pairs === 20) return 8;
    return 6;
  }

  function renderBoard() {
    const board = pairsBoard as HTMLElement;
    board.innerHTML = '';
    const cols = getColumns();
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    cards.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'pairs-card';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', describeCard(c, i));
      if (c.flipped || c.matched) el.classList.add('pairs-card--flipped');
      if (c.matched) el.classList.add('pairs-card--matched');
      el.innerHTML = `
        <div class="pairs-card-inner">
          <div class="pairs-card-front"></div>
          <div class="pairs-card-back">
            <svg class="pairs-icon" width="55%" height="55%" viewBox="0 0 24 24"
                 fill="none" stroke="${c.color}" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round">
              ${getIconPath(c.icon)}
            </svg>
          </div>
        </div>`;
      el.addEventListener('click', () => flip(i, el));
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flip(i, el);
        }
      });
      board.appendChild(el);
    });
  }

  /** Describe el estado de una carta para lectores de pantalla. Las
   *  cartas no revelan su ícono hasta que están volteadas o
   *  emparejadas — igual que un jugador vidente no lo ve tampoco
   *  hasta hacer click, así que el label no filtra información que
   *  el juego no daría visualmente. */
  function describeCard(c: Card, i: number): string {
    if (c.matched) return `Carta ${i + 1}, emparejada, ${c.icon}`;
    if (c.flipped) return `Carta ${i + 1}, volteada, ${c.icon}`;
    return `Carta ${i + 1}, boca abajo`;
  }

  function flip(i: number, el: HTMLElement) {
    const c = cards[i];
    if (lock || c.flipped || c.matched) return;
    c.flipped = true;
    el.classList.add('pairs-card--flipped');
    el.setAttribute('aria-label', describeCard(c, i));
    if (audioManager) audioManager.play('click');
    flipped.push({ i, el });

    if (flipped.length === 2) {
      lock = true;
      moves++;
      pairsMovesEl.textContent = String(moves);
      const [a, b] = flipped;

      if (cards[a.i].icon === cards[b.i].icon) {
        if (audioManager) audioManager.play('good');
        cleanupManager.addTimeout(() => {
          cards[a.i].matched = cards[b.i].matched = true;
          a.el.classList.add('pairs-card--matched');
          b.el.classList.add('pairs-card--matched');
          a.el.setAttribute('aria-label', describeCard(cards[a.i], a.i));
          b.el.setAttribute('aria-label', describeCard(cards[b.i], b.i));
          matched++;
          pairsPairsEl.textContent = String(matched);
          flipped = []; lock = false;
          if (matched === pairs) endGame(true);
        }, 350);
      } else {
        if (audioManager) audioManager.play('miss');
        cleanupManager.addTimeout(() => {
          a.el.classList.add('pairs-card--shake');
          b.el.classList.add('pairs-card--shake');
          cleanupManager.addTimeout(() => {
            cards[a.i].flipped = false;
            cards[b.i].flipped = false;
            a.el.classList.remove('pairs-card--flipped', 'pairs-card--shake');
            b.el.classList.remove('pairs-card--flipped', 'pairs-card--shake');
            a.el.setAttribute('aria-label', describeCard(cards[a.i], a.i));
            b.el.setAttribute('aria-label', describeCard(cards[b.i], b.i));
            flipped = []; lock = false;
          }, 380);
        }, 620);
      }
    }
  }

  function endGame(won: boolean) {
    cleanupManager.cleanup();
    lock = true;
    const msgEl = pairsMessage as HTMLElement;
    if (won) {
      if (audioManager) audioManager.play('perfect');
      msgEl.textContent = '✓ ¡Todos los pares encontrados!';
      msgEl.classList.add('pairs-message--win');
    } else {
      if (audioManager) audioManager.play('gameover');
      msgEl.textContent = '✗ Tiempo agotado. Inténtalo de nuevo.';
      msgEl.classList.add('pairs-message--fail');
    }
  }

  function getIconPath(name: string): string {
    const paths: Record<string, string> = {
      skull:      '<circle cx="12" cy="8" r="5"/><path d="M8 14v1a4 4 0 0 0 8 0v-1"/><line x1="10" y1="14" x2="10" y2="17"/><line x1="14" y1="14" x2="14" y2="17"/>',
      flame:      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
      bolt:       '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      star:       '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      moon:       '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
      sun:        '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
      cloud:      '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
      snowflake:  '<line x1="12" y1="2" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="19.07" y2="4.93"/>',
      diamond:    '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>',
      crown:      '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
      anchor:     '<circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>',
      leaf:       '<path d="M2 22c1.25-.987 2.27-1.975 3.9-2.99C19 11 22 2 22 2S11 5 7.1 18.09c-1.015 1.63-2.001 2.668-3.1 3.91z"/>',
      bug:        '<circle cx="12" cy="10" r="4"/><path d="M8 10H2m18 0h-6M4 4l4 3m8-3l-4 3M4 20l4-4m8 4l-4-4M12 14v7"/>',
      rocket:     '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
      compass:    '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
      eye:        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
      lock:       '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      key:        '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zM0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
      shield:     '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      ghost:      '<path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
      fish:       '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6z"/>',
      heart:      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      bell:       '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      camera:     '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'
    };
    return paths[name] || '<circle cx="12" cy="12" r="8"/>';
  }

  pairsDiffBtns.forEach((btn: HTMLElement) => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.pairs || '0');
      const t = parseInt(btn.dataset.time || '0');
      setDifficulty(n, t);
    });
  });

  startPairs.addEventListener('click', startGame);
}

export function stop() {
  lock = true;
  cleanup?.cleanup();
}

