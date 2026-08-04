/**
 * fragmentad-labyrinth/server/mazeGenerator.js
 *
 * Generador de laberintos — copia fiel del algoritmo usado en el
 * minijuego original "Maze" (js/games/Maze/mazeGenerator.ts):
 *   1. Recursive backtracker (carve) para abrir pasillos.
 *   2. BFS desde el punto de inicio para encontrar la casilla más
 *      lejana, que se convierte en la salida (2).
 *
 * Convención de celdas (idéntica a la original):
 *   0 = pasillo / suelo
 *   1 = muro
 *   2 = salida
 *
 * Se genera en el SERVIDOR (autoridad del juego) y se distribuye a los
 * clientes. Los clientes NUNCA generan su propio laberinto — así se
 * garantiza que los 4 jugadores juegan sobre el mismo mapa.
 */

class MazeGenerator {
  /**
   * Genera un laberinto de width×height (se fuerzan impares).
   * @param {number} width
   * @param {number} height
   * @returns {number[][]}
   */
  static generate(width = 21, height = 21) {
    // Asegurar dimensiones impares
    if (width % 2 === 0) width++;
    if (height % 2 === 0) height++;

    // Todo paredes
    const maze = [];
    for (let y = 0; y < height; y++) {
      maze[y] = [];
      for (let x = 0; x < width; x++) {
        maze[y][x] = 1;
      }
    }

    const directions = [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0],
    ];

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function carve(x, y) {
      maze[y][x] = 0;
      shuffle([...directions]).forEach((dir) => {
        const nx = x + dir[0];
        const ny = y + dir[1];
        if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) return;
        if (maze[ny][nx] === 0) return;
        maze[y + dir[1] / 2][x + dir[0] / 2] = 0;
        carve(nx, ny);
      });
    }

    carve(1, 1);

    // Inicio (queda como suelo)
    maze[1][1] = 0;

    // Buscar una casilla cercana al centro para el spawn
    let startX = Math.floor(width / 2);
    let startY = Math.floor(height / 2);

    if (maze[startY][startX] !== 0) {
      let found = false;
      for (let r = 1; r < Math.max(width, height) && !found; r++) {
        for (let y = Math.max(1, startY - r); y <= Math.min(height - 2, startY + r); y++) {
          for (let x = Math.max(1, startX - r); x <= Math.min(width - 2, startX + r); x++) {
            if (maze[y][x] === 0) {
              startX = x;
              startY = y;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    // BFS para hallar la casilla más lejana (la salida)
    const visited = Array.from({ length: height }, () => Array(width).fill(false));
    const queue = [{ x: startX, y: startY, dist: 0 }];
    visited[startY][startX] = true;

    let farthest = { x: startX, y: startY, dist: 0 };
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      if (current.dist > farthest.dist) farthest = current;

      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (visited[ny][nx]) continue;
        if (maze[ny][nx] !== 0) continue;
        visited[ny][nx] = true;
        queue.push({ x: nx, y: ny, dist: current.dist + 1 });
      }
    }

    // Colocar la salida en la casilla más lejana
    maze[farthest.y][farthest.x] = 2;

    return {
      maze,
      width,
      height,
      start: { x: startX, y: startY },
      exit: { x: farthest.x, y: farthest.y },
    };
  }
}

module.exports = MazeGenerator;