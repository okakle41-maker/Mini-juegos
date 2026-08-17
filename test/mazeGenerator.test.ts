import { describe, it, expect } from 'vitest';
import MazeGenerator from '../js/games/Maze/mazeGenerator';
import MazePlayer from '../js/games/Maze/mazePlayer';

/**
 * BFS auxiliar para el test: confirma que existe un camino entre dos
 * celdas transitables (valor !== 1) del laberinto. Independiente del
 * BFS que usa el propio MazeGenerator para ubicar la salida — este
 * verifica la propiedad desde cero, no reimplementa la misma lógica
 * que estamos probando.
 */
function hasPath(maze: number[][], from: [number, number], to: [number, number]): boolean {
  const height = maze.length;
  const width = maze[0].length;
  const visited: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  const queue: [number, number][] = [from];
  visited[from[1]][from[0]] = true;

  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x === to[0] && y === to[1]) return true;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited[ny][nx]) continue;
      if (maze[ny][nx] === 1) continue;
      visited[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }
  return false;
}

function findCell(maze: number[][], value: number): [number, number] {
  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[y].length; x++) {
      if (maze[y][x] === value) return [x, y];
    }
  }
  throw new Error(`No se encontró ninguna celda con valor ${value}`);
}

describe('MazeGenerator.generate', () => {
  it('fuerza dimensiones impares (par + 1) para que el algoritmo de tallado funcione', () => {
    const maze = MazeGenerator.generate(10, 10);
    expect(maze.length % 2).toBe(1);
    expect(maze[0].length % 2).toBe(1);
    expect(maze.length).toBe(11);
    expect(maze[0].length).toBe(11);
  });

  it('respeta dimensiones ya impares', () => {
    const maze = MazeGenerator.generate(9, 9);
    expect(maze.length).toBe(9);
    expect(maze[0].length).toBe(9);
  });

  it('usa el default de 15x15 si no se pasan dimensiones', () => {
    const maze = MazeGenerator.generate();
    expect(maze.length).toBe(15);
    expect(maze[0].length).toBe(15);
  });

  it('genera exactamente una celda de salida (valor 2)', () => {
    const maze = MazeGenerator.generate(15, 15);
    const exitCells = maze.flat().filter(cell => cell === 2);
    expect(exitCells.length).toBe(1);
  });

  it('la celda de inicio (1,1) es siempre transitable (valor 0 o, si terminó siendo la salida, valor 2)', () => {
    // El comentario del propio generador dice "Inicio (queda como
    // suelo)" al fijar maze[1][1] = 0, pero eso ocurre ANTES del BFS
    // que busca la casilla más lejana del spawn central para ubicar la
    // salida (valor 2) — nada impide que (1,1) resulte ser esa casilla
    // más lejana y quede sobreescrita con 2. Sigue siendo transitable
    // (0 o 2 son ambos "no pared"), pero no es garantizado que sea
    // específicamente 0 como sugiere el comentario. Corrida muchas
    // veces porque depende del RNG del tallado.
    for (let i = 0; i < 20; i++) {
      const maze = MazeGenerator.generate(15, 15);
      expect(maze[1][1]).not.toBe(1);
    }
  });

  it('el laberinto es siempre soluble: hay camino entre el inicio y la salida', () => {
    // Corre varias veces porque el tallado usa Math.random() — un solo
    // laberinto podría pasar por casualidad si hubiera un bug sutil que
    // solo se manifiesta con ciertas secuencias de shuffle.
    for (let i = 0; i < 15; i++) {
      const maze = MazeGenerator.generate(15, 15);
      const exit = findCell(maze, 2);
      expect(hasPath(maze, [1, 1], exit)).toBe(true);
    }
  });

  it('el borde exterior es siempre pared', () => {
    const maze = MazeGenerator.generate(11, 11);
    const height = maze.length;
    const width = maze[0].length;
    for (let x = 0; x < width; x++) {
      expect(maze[0][x]).toBe(1);
      expect(maze[height - 1][x]).toBe(1);
    }
    for (let y = 0; y < height; y++) {
      expect(maze[y][0]).toBe(1);
      expect(maze[y][width - 1]).toBe(1);
    }
  });
});

describe('MazePlayer', () => {
  // Laberinto fijo y pequeño para tests determinísticos del jugador,
  // sin depender del RNG de MazeGenerator:
  //   1 1 1 1 1
  //   1 0 0 0 1
  //   1 0 1 0 1
  //   1 0 0 0 1
  //   1 1 1 1 1
  const fixedMaze = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ];

  it('arranca en el centro del laberinto si es transitable', () => {
    const maze = [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ];
    const player = new MazePlayer(maze);
    expect(player.x).toBe(1);
    expect(player.y).toBe(1);
  });

  it('si el centro es pared, busca la celda transitable más cercana', () => {
    // Centro (2,2) es pared en fixedMaze — debe reubicarse a una celda
    // vecina con valor 0, no quedarse parado sobre una pared.
    const player = new MazePlayer(fixedMaze);
    expect(fixedMaze[player.y][player.x]).toBe(0);
  });

  it('move() avanza a una celda transitable y actualiza posición/dirección', () => {
    const player = new MazePlayer(fixedMaze);
    player.x = 1;
    player.y = 1;

    const moved = player.move(1, 0);

    expect(moved).toBe(true);
    expect(player.x).toBe(2);
    expect(player.y).toBe(1);
    expect(player.dirX).toBe(1);
    expect(player.dirY).toBe(0);
    expect(player.moves).toBe(1);
  });

  it('move() rechaza avanzar contra una pared y no cambia posición/moves', () => {
    const player = new MazePlayer(fixedMaze);
    player.x = 1;
    player.y = 1;

    const moved = player.move(1, 1); // (2,2) es pared en fixedMaze

    expect(moved).toBe(false);
    expect(player.x).toBe(1);
    expect(player.y).toBe(1);
    expect(player.moves).toBe(0);
  });

  it('move() rechaza salirse de los límites del laberinto', () => {
    const player = new MazePlayer(fixedMaze);
    player.x = 0;
    player.y = 0;

    const moved = player.move(-1, 0);

    expect(moved).toBe(false);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  it('move() guarda la posición anterior en prevX/prevY', () => {
    const player = new MazePlayer(fixedMaze);
    player.x = 1;
    player.y = 1;

    player.move(1, 0);

    expect(player.prevX).toBe(1);
    expect(player.prevY).toBe(1);
  });
});
