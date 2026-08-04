/**
 * fragmentad-labyrinth/public/js/client.js
 *
 * Cliente del minijuego "Laberinto Fragmentado".
 *
 * Responsabilidades:
 *   - Conectarse al servidor WebSocket.
 *   - Gestionar las pantallas (lobby → espera → juego → resultado).
 *   - Renderizar SOLO el cuadrante propio (visión parcial).
 *   - Enviar movimientos (solo rol A) y mensajes de chat.
 *   - Efectos de sonido con WebAudio API (sin archivos externos).
 */

(function () {
  'use strict';

  // ── Configuración ─────────────────────────────────────────────────────
  // Si la página se sirve desde el servidor, se usa el mismo host.
  // Si se abre como archivo local (file://), se conecta a localhost:3001.
  const WS_URL = (window.location.host)
    ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host
    : 'ws://localhost:3001';

  // ── Estado global ─────────────────────────────────────────────────────
  let socket = null;
  let myRole = null;
  let myName = '';
  let currentView = null;      // { grid, offsetX, offsetY, exitInView, startInView }
  let currentPlayer = { x: 0, y: 0 };
  let roomCode = '';
  let gameActive = false;
  let isConnected = false;

  // ── Audio (WebAudio API) ──────────────────────────────────────────────
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  /** Toca un tono simple: freq (Hz), duration (s), type osc, gain. */
  function playTone(freq, duration = 0.12, type = 'square', gainValue = 0.04) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  const sounds = {
    connect: () => playTone(880, 0.1, 'sine', 0.06),
    join: () => { playTone(660, 0.08); setTimeout(() => playTone(880, 0.1), 90); },
    start: () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 110); setTimeout(() => playTone(784, 0.14), 220); },
    move: () => playTone(440, 0.05, 'square', 0.03),
    wall: () => playTone(180, 0.08, 'sawtooth', 0.05),
    chat: () => playTone(660, 0.06, 'sine', 0.03),
    win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'triangle', 0.06), i * 130)); },
    lose: () => { [400, 300, 200].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'sawtooth', 0.05), i * 160)); },
  };

  // ── Helpers DOM ───────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const target = $(id);
    if (target) target.classList.add('active');
  }

  function showError(msg) {
    const el = $('lobby-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  function clearError() {
    const el = $('lobby-error');
    if (el) el.classList.add('hidden');
  }

  function showStatus(msg) {
    const el = $('lobby-status');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  function clearStatus() {
    const el = $('lobby-status');
    if (el) el.classList.add('hidden');
  }

  // ── Comunicación ──────────────────────────────────────────────────────
  function connect() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      isConnected = true;
      sounds.connect();
      clearStatus();
      showStatus('Conectado al servidor. Creá una sala o unite por código.');
    };

    socket.onclose = () => {
      isConnected = false;
      gameActive = false;
      showScreen('lobby-screen');
      showError('Se perdió la conexión con el servidor.');
    };

    socket.onerror = () => {
      showError('No se pudo conectar al servidor. ¿Está corriendo el server?');
    };

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handleMessage(msg);
    };
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  // ── Manejo de mensajes del servidor ───────────────────────────────────
  function handleMessage(msg) {
    switch (msg.type) {
      case 'room_created':
        roomCode = msg.code;
        myRole = msg.role;
        enterWaitingRoom(msg.code);
        break;

      case 'room_joined':
        roomCode = msg.code;
        myRole = msg.role;
        enterWaitingRoom(msg.code);
        break;

      case 'players':
        updateWaitingRoles(msg.players);
        break;

      case 'game_starting':
        sounds.start();
        break;

      case 'game_state':
        gameActive = true;
        myRole = msg.role;
        currentView = msg.view;
        currentPlayer = msg.player;
        updateTimer(msg.timeLeft);
        updateMoves(msg.moves);
        renderMaze();
        renderTeam(msg.roles);
        setupRoleUI();
        showScreen('game-screen');
        break;

      case 'player_moved':
        currentPlayer = msg.player;
        currentView = msg.view;
        updateMoves(msg.moves);
        if (msg.timeLeft !== undefined) updateTimer(msg.timeLeft);
        renderMaze();
        sounds.move();
        break;

      case 'move_denied':
        if (msg.reason === 'wall') sounds.wall();
        break;

      case 'timer':
        updateTimer(msg.timeLeft);
        break;

      case 'chat':
        appendChat(msg.name, msg.message, msg.role);
        sounds.chat();
        break;

      case 'game_won':
        gameActive = false;
        sounds.win();
        showResult(true, msg.winnerRole, msg.moves, msg.timeLeft);
        break;

      case 'game_over':
        gameActive = false;
        sounds.lose();
        showResult(false, null, 0, 0, msg.reason);
        break;

      case 'error':
        showError(msg.message);
        break;

      case 'pong':
        break;
    }
  }

  // ── Pantalla de espera ────────────────────────────────────────────────
  function enterWaitingRoom(code) {
    clearError();
    clearStatus();
    $('waiting-code').textContent = code;
    updateWaitingRoles([]);
    showScreen('waiting-screen');
    sounds.join();
  }

  const ROLE_DESCRIPTIONS = {
    A: 'Controla al personaje + cuadrante sup-izq',
    B: 'Cuadrante sup-der — guía por chat/voz',
    C: 'Cuadrante inf-izq — guía por chat/voz',
    D: 'Cuadrante inf-der — guía por chat/voz',
  };

  function updateWaitingRoles(players) {
    const container = $('waiting-roles');
    if (!container) return;

    const taken = new Set((players || []).map((p) => p.role));
    const html = ['A', 'B', 'C', 'D']
      .map((letter) => {
        const filled = taken.has(letter);
        const player = (players || []).find((p) => p.role === letter);
        const name = player ? player.name : 'Esperando...';
        return `
          <div class="role-slot ${filled ? 'filled' : 'empty'}">
            <span class="role-letter">Jugador ${letter}</span>
            <span class="role-desc">${filled ? '✅ ' + escapeHtml(name) : ROLE_DESCRIPTIONS[letter]}</span>
          </div>`;
      })
      .join('');
    container.innerHTML = html;

    $('waiting-status').textContent =
      players && players.length >= 4 ? '¡Todos listos! Arrancando...' : `Esperando jugadores... (${players ? players.length : 0}/4)`;
  }

  // ── Render del laberinto (cuadrante) ──────────────────────────────────
  function renderMaze() {
    const container = $('maze-container');
    if (!container || !currentView) return;

    const { grid, offsetX, offsetY, exitInView, startInView } = currentView;
    const rows = grid.length;
    const cols = grid[0] ? grid[0].length : 0;

    container.style.gridTemplateColumns = `repeat(${cols}, 28px)`;

    let html = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gx = offsetX + c;
        const gy = offsetY + r;
        let cellClass = 'wall';
        let content = '';

        if (grid[r][c] === '.') cellClass = 'path';
        else if (grid[r][c] === 'S') {
          cellClass = 'start';
          content = 'S';
        } else if (grid[r][c] === 'E') {
          cellClass = 'exit';
          content = 'E';
        }

        // El personaje se pinta encima de la celda (si está en este cuadrante).
        const isPlayerHere = gameActive && currentPlayer.x === gx && currentPlayer.y === gy;
        if (isPlayerHere) {
          cellClass = 'player';
          content = '●';
        }

        html += `<div class="maze-cell ${cellClass}">${content}</div>`;
      }
    }
    container.innerHTML = html;

    // Pista de qué hay en el cuadrante.
    const hintEl = $('quadrant-hint');
    if (hintEl) {
      const parts = [];
      if (startInView) parts.push('📍 Inicio visible');
      if (exitInView) parts.push('🏁 ¡Salida visible!');
      hintEl.textContent = parts.join(' · ');
    }
  }

  // ── Equipo ────────────────────────────────────────────────────────────
  function renderTeam(roles) {
    const container = $('team-list');
    if (!container) return;

    container.innerHTML = (roles || [])
      .map((p) => {
        const isMe = p.role === myRole;
        return `
          <div class="team-member ${isMe ? 'me' : ''}">
            <span class="tm-role">${escapeHtml(p.role)}</span>
            <span class="tm-name">${escapeHtml(p.name)}${isMe ? ' (vos)' : ''}</span>
          </div>`;
      })
      .join('');
  }

  // ── Timer / Movimientos ───────────────────────────────────────────────
  function updateTimer(seconds) {
    const el = $('timer');
    if (!el) return;
    el.textContent = String(seconds);
    el.classList.toggle('danger', seconds <= 10);
  }

  function updateMoves(moves) {
    const el = $('moves');
    if (el) el.textContent = `👣 ${moves} movimientos`;
  }

  // ── UI por rol ────────────────────────────────────────────────────────
  function setupRoleUI() {
    // Rol A controla; los demás solo ven el panel de controles deshabilitado.
    const badge = $('role-badge');
    if (badge) badge.textContent = `Rol ${myRole}`;

    const controlsPanel = $('controls-panel');
    if (controlsPanel) {
      const isController = myRole === 'A';
      const hint = controlsPanel.querySelector('.controls-hint');
      if (hint) {
        hint.textContent = isController
          ? 'Usá las flechas o WASD para mover al personaje.'
          : 'Solo el Jugador A puede mover al personaje. ¡Guialo por chat!';
      }
      controlsPanel.querySelectorAll('.dpad-btn').forEach((btn) => {
        btn.disabled = !isController;
      });
    }

    $('player-name-display').textContent = myName;
  }

  // ── Chat ──────────────────────────────────────────────────────────────
  function appendChat(name, message, role) {
    const container = $('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
      <span class="cm-name">${escapeHtml(name)}</span>
      ${role ? `<span class="cm-role">[${escapeHtml(role)}]</span>` : ''}: ${escapeHtml(message)}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function appendSystem(message) {
    const container = $('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-msg system';
    div.textContent = message;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ── Resultado ─────────────────────────────────────────────────────────
  function showResult(won, winnerRole, moves, timeLeft, reason) {
    const overlay = $('result-overlay');
    if (!overlay) return;

    $('result-icon').textContent = won ? '🏆' : '💀';
    $('result-title').textContent = won ? '¡Victoria!' : 'Derrota';
    $('result-details').textContent = won
      ? `¡El equipo escapó del laberinto! Jugador ${winnerRole} alcanzó la salida en ${moves} movimientos con ${timeLeft}s restantes.`
      : (reason || 'Se acabó el tiempo sin encontrar la salida.');

    overlay.classList.remove('hidden');
  }

  // ── Escapar HTML ──────────────────────────────────────────────────────
  // Las entidades se construyen por concatenación ('&' + 'amp;') para que
  // el auto-formato del editor no las convierta de vuelta a caracteres
  // literales (& < > "), lo que anularía la protección XSS.
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&' + 'amp;')
      .replace(/</g, '&' + 'lt;')
      .replace(/>/g, '&' + 'gt;')
      .replace(/"/g, '&' + 'quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Movimiento (solo rol A) ───────────────────────────────────────────
  function sendMove(dir) {
    if (!gameActive || myRole !== 'A') return;
    send({ type: 'move', dir });
  }

  // ── Inicialización de eventos ─────────────────────────────────────────
  function init() {
    const nameInput = $('player-name');
    myName = localStorage.getItem('fraglab_name') || '';
    if (nameInput) nameInput.value = myName;

    // Conectar al cargar.
    connect();

    // Crear sala
    $('btn-create').addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim() : '';
      myName = name || 'Jugador';
      localStorage.setItem('fraglab_name', myName);
      clearError();
      send({ type: 'create_room', name: myName });
    });

    // Unirse a sala
    $('btn-join').addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim() : '';
      myName = name || 'Jugador';
      localStorage.setItem('fraglab_name', myName);
      const code = $('room-code').value.trim().toUpperCase();
      clearError();
      if (!code) {
        showError('Ingresá el código de la sala.');
        return;
      }
      send({ type: 'join_room', code, name: myName });
    });

    // Enter en inputs
    $('room-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btn-join').click();
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btn-create').click();
    });

    // Salir de la sala en espera (reconectar = volver al lobby local)
    $('btn-leave').addEventListener('click', () => {
      if (socket) socket.close();
      showScreen('lobby-screen');
    });

    // Controles: teclado
    document.addEventListener('keydown', (e) => {
      if (!gameActive) return;
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup':    e.preventDefault(); sendMove('up'); break;
        case 's': case 'arrowdown':  e.preventDefault(); sendMove('down'); break;
        case 'a': case 'arrowleft':  e.preventDefault(); sendMove('left'); break;
        case 'd': case 'arrowright': e.preventDefault(); sendMove('right'); break;
      }
    });

    // Controles: botones dpad
    document.querySelectorAll('.dpad-btn').forEach((btn) => {
      btn.addEventListener('click', () => sendMove(btn.dataset.dir));
    });

    // Directivas rápidas
    document.querySelectorAll('.qc-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!gameActive) return;
        const msg = btn.dataset.msg;
        if (msg) {
          send({ type: 'chat', message: msg });
          appendChat(`${myName}`, msg, myRole);
        }
      });
    });

    // Chat
    $('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('chat-input');
      const message = input.value.trim();
      if (!message || !gameActive) return;
      send({ type: 'chat', message });
      input.value = '';
    });

    // Volver al lobby tras resultado
    $('btn-restart').addEventListener('click', () => {
      $('result-overlay').classList.add('hidden');
      if (socket) socket.close();
      showScreen('lobby-screen');
    });
  }

  // Arranque.
  document.addEventListener('DOMContentLoaded', init);
})();