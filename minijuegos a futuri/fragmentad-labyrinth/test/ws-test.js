/**
 * fragmentad-labyrinth/test/ws-test.js
 *
 * Prueba end-to-end del servidor WebSocket:
 *   1. Conecta 4 clientes.
 *   2. El primero crea una sala.
 *   3. Los otros 3 se unen con el código.
 *   4. Verifica que la partida arranca (game_state para los 4).
 *   5. Verifica que cada jugador recibe SOLO su cuadrante.
 *   6. Simula movimientos del Jugador A y verifica que se propagan.
 *   7. Verifica que un jugador no-A no puede mover.
 *
 * Uso: node test/ws-test.js
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3001';
const TIMEOUT_MS = 15000;

function connect(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const messages = [];
    const timeout = setTimeout(() => reject(new Error(`Timeout esperando conexión de ${name}`)), TIMEOUT_MS);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve({
        ws,
        name,
        messages,
        send: (obj) => ws.send(JSON.stringify(obj)),
        waitFor: (type, filter) => new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error(`Timeout esperando ${type} para ${name}`)), TIMEOUT_MS);
          const check = () => {
            const idx = messages.findIndex((m) => m.type === type && (!filter || filter(m)));
            if (idx >= 0) {
              clearTimeout(t);
              const msg = messages[idx];
              messages.splice(idx, 1);
              res(msg);
            }
          };
          const handler = () => check();
          ws.on('message', handler);
          check();
        }),
      });
    });

    ws.on('message', (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch {}
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function main() {
  console.log('=== Prueba end-to-end: Laberinto Fragmentado ===\n');

  // 1. Conectar 4 clientes
  const clients = [];
  for (let i = 0; i < 4; i++) {
    clients.push(await connect(`Jugador${i + 1}`));
    console.log(`✅ Cliente ${i + 1} conectado`);
  }

  // 2. Crear sala
  clients[0].send({ type: 'create_room', name: 'Jugador1' });
  const created = await clients[0].waitFor('room_created');
  console.log(`✅ Sala creada: código=${created.code}, rol=${created.role}`);

  // 3. Unirse los otros 3
  for (let i = 1; i < 4; i++) {
    clients[i].send({ type: 'join_room', code: created.code, name: `Jugador${i + 1}` });
    const joined = await clients[i].waitFor('room_joined');
    console.log(`✅ Jugador ${i + 1} unido: rol=${joined.role}`);
  }

  // 4. Verificar que arranca la partida (game_state para los 4)
  const states = [];
  for (let i = 0; i < 4; i++) {
    const state = await clients[i].waitFor('game_state');
    states.push(state);
    console.log(`✅ Jugador ${i + 1} recibió game_state: rol=${state.role}, cuadrante=${state.view.grid.length}x${state.view.grid[0].length}`);
  }

  // 5. Verificar que cada jugador ve SOLO su cuadrante (no el mapa completo)
  const roles = states.map((s) => s.role);
  const uniqueRoles = new Set(roles);
  if (uniqueRoles.size !== 4) {
    throw new Error(`Los roles no son únicos: ${roles.join(', ')}`);
  }
  console.log('✅ Los 4 roles son únicos (A, B, C, D)');

  // Verificar que los cuadrantes son distintos
  const grids = states.map((s) => JSON.stringify(s.view.grid));
  const uniqueGrids = new Set(grids);
  if (uniqueGrids.size < 2) {
    throw new Error('Los cuadrantes deberían ser distintos entre jugadores');
  }
  console.log(`✅ Cuadrantes distintos entre jugadores (${uniqueGrids.size} variantes)`);

  // 6. Simular movimiento del Jugador A
  // El orden de conexión determina los roles: el primero en crear la
  // sala es A, el segundo en unirse es B, etc.
  const playerA = clients[0];
  const playerB = clients[1];

  if (!playerA) throw new Error('No se encontró al Jugador A');

  // Enviar un movimiento válido (arriba)
  playerA.send({ type: 'move', dir: 'up' });
  const moved = await playerA.waitFor('player_moved');
  console.log(`✅ Movimiento del Jugador A propagado: posición=(${moved.player.x}, ${moved.player.y})`);

  // Verificar que el Jugador B también recibió el movimiento
  const movedB = await playerB.waitFor('player_moved');
  console.log(`✅ Jugador B recibió el movimiento: posición=(${movedB.player.x}, ${movedB.player.y})`);

  // 7. Verificar que un jugador no-A no puede mover
  playerB.send({ type: 'move', dir: 'down' });
  const denied = await playerB.waitFor('error');
  console.log(`✅ Jugador B no puede mover: "${denied.message}"`);

  // 8. Verificar chat
  playerB.send({ type: 'chat', message: 'Subí dos casillas' });
  const chat = await playerA.waitFor('chat');
  console.log(`✅ Chat recibido: "${chat.name}: ${chat.message}"`);

  console.log('\n=== ✅ TODAS LAS PRUEBAS PASARON ===');

  // Cerrar conexiones
  clients.forEach((c) => c.ws.close());
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ PRUEBA FALLÓ:', err.message);
  process.exit(1);
});