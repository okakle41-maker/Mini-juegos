/**
 * fragmentad-labyrinth/server/index.js
 *
 * Servidor WebSocket del minijuego "Laberinto Fragmentado".
 *
 * Autoridad del juego:
 *   - Genera el laberinto (MazeGenerator) de forma centralizada.
 *   - Gestiona salas de EXACTAMENTE 4 jugadores identificadas por código.
 *   - Controla al personaje (movimiento validado contra la matriz).
 *   - Distribuye a cada jugador SOLO su cuadrante (visión parcial).
 *   - Maneja el temporizador y la condición de victoria.
 *
 * Roles de jugador (fijos):
 *   A → controla al personaje, ve cuadrante superior-izquierdo.
 *   B → guía por voz/chats, ve cuadrante superior-derecho.
 *   C → guía por voz/chats, ve cuadrante inferior-izquierdo.
 *   D → guía por voz/chats, ve cuadrante inferior-derecho.
 *
 * Protocolo de mensajes (JSON):
 *   Cliente → Servidor:
 *     { type: 'create_room', name }
 *     { type: 'join_room', code, name }
 *     { type: 'move', dir: 'up'|'down'|'left'|'right' }   (solo rol A)
 *     { type: 'chat', message }                             (chat libre)
 *     { type: 'ping' }
 *
 *   Servidor → Cliente:
 *     { type: 'room_created', code, role, roomId }
 *     { type: 'room_joined', code, role, roomId }
 *     { type: 'players', players: [{id, name, role}] }
 *     { type: 'game_state', view, player, timeLeft, moves, roles }
 *     { type: 'player_moved', player, view, timeLeft, moves }
 *     { type: 'chat', playerId, name, message }
 *     { type: 'game_won', winnerRole, moves, timeLeft }
 *     { type: 'game_over', reason }
 *     { type: 'move_denied', dir, reason }
 *     { type: 'error', message }
 *     { type: 'pong' }
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const MazeGenerator = require('./mazeGenerator.js');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const GAME_DURATION_SECONDS = 120; // 2 minutos
const MAX_ROOMS = 50;
const ROOM_TTL_MS = 30 * 60 * 1000; // 30 min sin actividad → cerrar

/** Roles fijos del juego (orden alfabético de cuadrantes). */
const ROLES = ['A', 'B', 'C', 'D'];

/** Direcciones de movimiento válidas y su delta (x, y). */
const DIRS = {
  up:    { dx: 0, dy: -1 },
  down:  { dx: 0, dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** Genera un código de sala corto sin caracteres ambiguos. */
function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/** Sanitiza un nombre de jugador (anti-XSS básico). */
function sanitizeName(raw) {
  // Las entidades se construyen por concatenación ('&' + 'amp;') para que
  // el auto-formato del editor no las convierta de vuelta a caracteres
  // literales (&, <, >, "), lo que anularía la protección XSS.
  const cleaned = String(raw ?? 'Jugador')
    .replace(/[<>]/g, '')
    .replace(/&/g, '&' + 'amp;')
    .replace(/"/g, '&' + 'quot;')
    .replace(/'/g, '&#39;')
    .trim()
    .slice(0, 24);
  return cleaned || 'Jugador';
}

/** MIME types para archivos estáticos. */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

class FragmentLabyrinthServer {
  constructor() {
    // Servidor HTTP: sirve los archivos estáticos de public/ y además
    // es la base del WebSocket (mismo puerto para ambos).
    this.httpServer = http.createServer((req, res) => this.serveStatic(req, res));

    this.wss = new WebSocket.Server({ server: this.httpServer });
    this.rooms = new Map(); // code -> room
    this.roomByPlayer = new Map(); // ws -> { roomCode, role }

    // Limpieza periódica de salas muertas / inactivas.
    setInterval(() => this.cleanupRooms(), 60 * 1000);

    this.wss.on('connection', (ws) => this.handleConnection(ws));

    this.httpServer.listen(PORT, () => {
      console.log(`[FragmentLab] Servidor escuchando en http://localhost:${PORT}`);
      console.log(`[FragmentLab] WebSocket en ws://localhost:${PORT}`);
    });
  }

  /**
   * Sirve archivos estáticos desde public/ (index.html, css, js).
   * Protege contra path traversal: se resuelve el path y se verifica
   * que quede dentro de PUBLIC_DIR.
   */
  serveStatic(req, res) {
    // Solo GET/HEAD.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }

    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const filePath = path.resolve(PUBLIC_DIR, relativePath);

    // Prevenir path traversal fuera de public/.
    if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Archivo no encontrado → 404.
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(data);
    });
  }

  // ── Utilidades de sala ────────────────────────────────────────────────

  createRoom(ws, name) {
    if (this.rooms.size >= MAX_ROOMS) {
      this.send(ws, { type: 'error', message: 'Demasiadas salas activas. Probá en unos minutos.' });
      return;
    }

    let code;
    for (let attempt = 0; attempt < 20; attempt++) {
      code = generateRoomCode();
      if (!this.rooms.has(code)) break;
    }
    if (this.rooms.has(code)) {
      this.send(ws, { type: 'error', message: 'No se pudo generar un código único. Probá de nuevo.' });
      return;
    }

    // Si este ws ya estaba en otra sala, lo sacamos primero.
    this.leaveCurrentRoom(ws, { silent: true });

    const room = {
      code,
      players: [], // { ws, id, name, role }
      maze: null,
      width: 0,
      height: 0,
      start: null,
      exit: null,
      playerPos: null,
      moves: 0,
      status: 'waiting', // waiting | playing | won | over
      timeLeft: GAME_DURATION_SECONDS,
      timer: null,
      lastActivity: Date.now(),
      chatHistory: [],
    };

    this.rooms.set(code, room);
    const player = this.addPlayerToRoom(room, ws, name);
    this.roomByPlayer.set(ws, { roomCode: code, role: player.role });

    this.send(ws, {
      type: 'room_created',
      code,
      role: player.role,
      roomId: room.id || code,
    });
    this.broadcastPlayers(room);
  }

  joinRoom(ws, codeRaw, name) {
    const code = String(codeRaw || '').toUpperCase().trim();
    const room = this.rooms.get(code);
    if (!room) {
      this.send(ws, { type: 'error', message: 'No existe una sala con ese código.' });
      return;
    }
    if (room.status === 'won' || room.status === 'over') {
      this.send(ws, { type: 'error', message: 'Esa sala ya terminó la partida.' });
      return;
    }
    if (room.players.length >= 4) {
      this.send(ws, { type: 'error', message: 'La sala ya tiene 4 jugadores.' });
      return;
    }

    this.leaveCurrentRoom(ws, { silent: true });

    const player = this.addPlayerToRoom(room, ws, name);
    this.roomByPlayer.set(ws, { roomCode: code, role: player.role });

    this.send(ws, {
      type: 'room_joined',
      code,
      role: player.role,
      roomId: room.id || code,
    });
    this.broadcastPlayers(room);

    // Si con este jugador se completan los 4, arranca la partida.
    if (room.players.length === 4) {
      this.startGame(room);
    }
  }

  addPlayerToRoom(room, ws, name) {
    // Cada rol se asigna una sola vez; el primer slot libre.
    const takenRoles = new Set(room.players.map((p) => p.role));
    const role = ROLES.find((r) => !takenRoles.has(r)) || ROLES[room.players.length % 4];

    const player = {
      ws,
      id: ws._fragmentId || (ws._fragmentId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      name: sanitizeName(name),
      role,
    };

    room.players.push(player);
    room.lastActivity = Date.now();
    return player;
  }

  leaveCurrentRoom(ws, { silent = false } = {}) {
    const ctx = this.roomByPlayer.get(ws);
    if (!ctx) return;
    const room = this.rooms.get(ctx.roomCode);
    this.roomByPlayer.delete(ws);

    if (!room) return;
    room.players = room.players.filter((p) => p.ws !== ws);

    if (room.players.length === 0) {
      this.closeRoom(room);
      return;
    }

    // Si la partida estaba en curso y alguien se va → la sala termina.
    if (room.status === 'playing' && !silent) {
      room.status = 'over';
      this.stopTimer(room);
      this.broadcast(room, { type: 'game_over', reason: 'Un jugador abandonó la sala.' });
      this.closeRoom(room);
      return;
    }

    this.broadcastPlayers(room);
  }

  closeRoom(room) {
    this.stopTimer(room);
    this.rooms.delete(room.code);
    // Limpiar referencias ws→sala de los jugadores restantes (si los hay).
    room.players.forEach((p) => this.roomByPlayer.delete(p.ws));
  }

  cleanupRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > ROOM_TTL_MS) {
        try {
          this.broadcast(room, { type: 'error', message: 'La sala se cerró por inactividad.' });
        } catch {}
        this.closeRoom(room);
      }
    }
  }

  // ── Inicio y flujo del juego ──────────────────────────────────────────

  startGame(room) {
    const generated = MazeGenerator.generate(21, 21);
    room.maze = generated.maze;
    room.width = generated.width;
    room.height = generated.height;
    room.start = generated.start;
    room.exit = generated.exit;
    room.playerPos = { x: generated.start.x, y: generated.start.y };
    room.moves = 0;
    room.status = 'playing';
    room.timeLeft = GAME_DURATION_SECONDS;
    room.lastActivity = Date.now();

    this.broadcast(room, { type: 'game_starting' });
    this.sendViews(room);
    this.startTimer(room);
  }

  startTimer(room) {
    this.stopTimer(room);
    room.timer = setInterval(() => {
      room.timeLeft--;
      room.lastActivity = Date.now();

      if (room.timeLeft <= 0) {
        room.timeLeft = 0;
        room.status = 'over';
        this.stopTimer(room);
        this.broadcast(room, { type: 'game_over', reason: 'Se acabó el tiempo.' });
        this.closeRoom(room);
        return;
      }

      // Cada 5 segundos reenviamos el tiempo restante para mantener el reloj sincronizado.
      if (room.timeLeft % 5 === 0) {
        this.broadcast(room, { type: 'timer', timeLeft: room.timeLeft });
      }
    }, 1000);
  }

  stopTimer(room) {
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
  }

  // ── Cuadrantes / visión parcial ───────────────────────────────────────

  /**
   * Recorta un cuadrante del laberinto para un rol dado:
   *   A: superior-izquierdo (cols 0..mid, rows 0..mid)
   *   B: superior-derecho   (cols mid..w-1, rows 0..mid)
   *   C: inferior-izquierdo (cols 0..mid, rows mid..h-1)
   *   D: inferior-derecho   (cols mid..w-1, rows mid..h-1)
   *
   * Los cuadrantes se solapan en la fila/columna central para que las
   * conexiones entre zonas sean descubribles (un pasillo que cruza la
   * frontera se ve desde ambos lados).
   */
  quadrantFor(role, maze, width, height) {
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);

    let x0, x1, y0, y1;
    switch (role) {
      case 'A':
        x0 = 0; x1 = midX; y0 = 0; y1 = midY;
        break;
      case 'B':
        x0 = midX; x1 = width - 1; y0 = 0; y1 = midY;
        break;
      case 'C':
        x0 = 0; x1 = midX; y0 = midY; y1 = height - 1;
        break;
      case 'D':
        x0 = midX; x1 = width - 1; y0 = midY; y1 = height - 1;
        break;
      default:
        x0 = 0; x1 = width - 1; y0 = 0; y1 = height - 1;
    }
    return { x0, x1, y0, y1 };
  }

  /**
   * Construye la vista de un rol: su cuadrante recortado + marcadores de
   * inicio (S) y salida (E) si están dentro de su cuadrante. El personaje
   * NO se incluye en el cuadrante (su posición se envía por separado y el
   * cliente la pinta como un marcador pulsante).
   */
  buildView(room, role) {
    const { x0, x1, y0, y1 } = this.quadrantFor(role, room.maze, room.width, room.height);
    const rows = y1 - y0 + 1;
    const cols = x1 - x0 + 1;
    const grid = [];

    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const gx = x0 + c;
        const gy = y0 + r;
        const cell = room.maze[gy][gx];
        if (cell === 2) row.push('E'); // salida
        else if (gy === room.start.y && gx === room.start.x) row.push('S'); // inicio
        else row.push(cell === 1 ? '#' : '.');
      }
      grid.push(row);
    }

    const exitInView =
      room.exit.x >= x0 && room.exit.x <= x1 && room.exit.y >= y0 && room.exit.y <= y1;
    const startInView =
      room.start.x >= x0 && room.start.x <= x1 && room.start.y >= y0 && room.start.y <= y1;

    return {
      role,
      grid,
      offsetX: x0,
      offsetY: y0,
      exitInView,
      startInView,
    };
  }

  buildAllViews(room) {
    const views = {};
    ROLES.forEach((role) => {
      views[role] = this.buildView(room, role);
    });
    return views;
  }

  /** Envía a cada jugador SOLO su propia vista + estado global compartido. */
  sendViews(room) {
    const views = this.buildAllViews(room);
    this.sendRoomState(room, views);
  }

  sendRoomState(room, views = this.buildAllViews(room)) {
    room.players.forEach((p) => {
      this.send(p.ws, {
        type: 'game_state',
        role: p.role,
        view: views[p.role],
        player: { ...room.playerPos },
        timeLeft: room.timeLeft,
        moves: room.moves,
        roles: room.players.map((pl) => ({ id: pl.id, name: pl.name, role: pl.role })),
      });
    });
  }

  // ── Movimiento (solo rol A) ───────────────────────────────────────────

  handleMove(ws, dir) {
    const ctx = this.roomByPlayer.get(ws);
    if (!ctx) return;
    const room = this.rooms.get(ctx.roomCode);
    if (!room) return;
    if (room.status !== 'playing') return;
    if (ctx.role !== 'A') {
      this.send(ws, { type: 'error', message: 'Solo el Jugador A controla al personaje.' });
      return;
    }

    const delta = DIRS[dir];
    if (!delta) return;

    const nx = room.playerPos.x + delta.dx;
    const ny = room.playerPos.y + delta.dy;

    // Validación de límites y muros — la autoridad es el servidor.
    if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) return;
    if (room.maze[ny][nx] === 1) {
      this.send(ws, { type: 'move_denied', dir, reason: 'wall' });
      return;
    }

    room.playerPos = { x: nx, y: ny };
    room.moves++;
    room.lastActivity = Date.now();

    // ¿Llegó a la salida?
    if (room.maze[ny][nx] === 2) {
      room.status = 'won';
      this.stopTimer(room);
      const result = {
        type: 'game_won',
        winnerRole: ctx.role,
        moves: room.moves,
        timeLeft: room.timeLeft,
      };
      this.broadcast(room, result);
      this.closeRoom(room);
      return;
    }

    // Transmitir la nueva posición + actualizar cuadrantes para que el
    // personaje se pinte correctamente en cada vista parcial.
    const views = this.buildAllViews(room);
    room.players.forEach((p) => {
      this.send(p.ws, {
        type: 'player_moved',
        player: { ...room.playerPos },
        moves: room.moves,
        timeLeft: room.timeLeft,
        view: views[p.role],
      });
    });
  }

  // ── Chat ──────────────────────────────────────────────────────────────

  handleChat(ws, messageRaw) {
    const ctx = this.roomByPlayer.get(ws);
    if (!ctx) return;
    const room = this.rooms.get(ctx.roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.ws === ws);
    if (!player) return;

    const message = String(messageRaw || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!message) return;

    room.chatHistory.push({ playerId: player.id, name: player.name, message });
    if (room.chatHistory.length > 100) room.chatHistory.shift();

    this.broadcast(room, {
      type: 'chat',
      playerId: player.id,
      name: player.name,
      role: player.role,
      message,
    });
  }

  // ── Broadcast helpers ─────────────────────────────────────────────────

  broadcast(room, payload) {
    room.players.forEach((p) => this.send(p.ws, payload));
  }

  broadcastPlayers(room) {
    this.broadcast(room, {
      type: 'players',
      players: room.players.map((p) => ({ id: p.id, name: p.name, role: p.role })),
      code: room.code,
    });
  }

  send(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        // Si el envío falla (socket cerrado a mitad), simplemente se ignora.
      }
    }
  }

  // ── Manejo de conexión ────────────────────────────────────────────────

  handleConnection(ws) {
    console.log('[FragmentLab] Cliente conectado.');

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        this.send(ws, { type: 'error', message: 'Mensaje inválido.' });
        return;
      }

      switch (msg.type) {
        case 'create_room':
          this.createRoom(ws, msg.name);
          break;
        case 'join_room':
          this.joinRoom(ws, msg.code, msg.name);
          break;
        case 'move':
          this.handleMove(ws, msg.dir);
          break;
        case 'chat':
          this.handleChat(ws, msg.message);
          break;
        case 'ping':
          this.send(ws, { type: 'pong' });
          break;
        default:
          this.send(ws, { type: 'error', message: `Tipo de mensaje desconocido: ${msg.type}` });
      }
    });

    ws.on('close', () => {
      console.log('[FragmentLab] Cliente desconectado.');
      this.leaveCurrentRoom(ws);
    });

    ws.on('error', (err) => {
      console.error('[FragmentLab] Error de socket:', err.message);
    });
  }
}

// Arranque directo (solo si este archivo es el entry point).
if (require.main === module) {
  new FragmentLabyrinthServer();
}

module.exports = FragmentLabyrinthServer;
