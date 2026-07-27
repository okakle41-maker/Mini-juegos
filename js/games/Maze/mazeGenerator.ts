import audioManager from '../../audioManager.js';
export class MazeGenerator {

    static generate(width = 15, height = 15): number[][] {

        // Corregido: antes este sonido se disparaba al cargar el módulo
        // (arranque de la app), no al generar un laberinto. Ahora suena
        // cada vez que efectivamente se genera un laberinto nuevo.
        audioManager.play("open");

        // Asegurar dimensiones impares
        if (width % 2 === 0) width++;
        if (height % 2 === 0) height++;

        const maze: number[][] = [];

        // Todo paredes
        for (let y = 0; y < height; y++) {

            maze[y] = [];

            for (let x = 0; x < width; x++) {
                maze[y][x] = 1;
            }

        }

        const directions: [number, number][] = [
            [0, -2],
            [2, 0],
            [0, 2],
            [-2, 0]
        ];

        function shuffle<T>(array: T[]): T[] {

            for (let i = array.length - 1; i > 0; i--) {

                const j = Math.floor(Math.random() * (i + 1));

                [array[i], array[j]] =
                [array[j], array[i]];
            }

            return array;
        }

        function carve(x: number, y: number): void {

            maze[y][x] = 0;

            shuffle([...directions]).forEach(dir => {

                const nx = x + dir[0];
                const ny = y + dir[1];

                if (
                    nx <= 0 ||
                    ny <= 0 ||
                    nx >= width - 1 ||
                    ny >= height - 1
                ) return;

                if (maze[ny][nx] === 0)
                    return;

                maze[
                    y + dir[1] / 2
                ][
                    x + dir[0] / 2
                ] = 0;

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

        // BFS
        interface QueueItem {
            x: number;
            y: number;
            dist: number;
        }

        const visited: boolean[][] = Array.from(
            { length: height },
            () => Array(width).fill(false)
        );

        const queue: QueueItem[] = [{
            x: startX,
            y: startY,
            dist: 0
        }];

        visited[startY][startX] = true;

        let farthest: QueueItem = {
            x: startX,
            y: startY,
            dist: 0
        };

        const dirs: [number, number][] = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ];

        while (queue.length) {

            const current = queue.shift();
            if (!current) break;

            if (current.dist > farthest.dist) {

                farthest = current;

            }

            for (const [dx, dy] of dirs) {

                const nx = current.x + dx;
                const ny = current.y + dy;

                if (
                    nx < 0 ||
                    ny < 0 ||
                    nx >= width ||
                    ny >= height
                ) continue;

                if (visited[ny][nx]) continue;

                if (maze[ny][nx] !== 0) continue;

                visited[ny][nx] = true;

                queue.push({
                    x: nx,
                    y: ny,
                    dist: current.dist + 1
                });

            }

        }

        // Colocar la salida en la casilla más lejana
        maze[farthest.y][farthest.x] = 2;

        return maze;

    }

}

window.MazeGenerator = MazeGenerator;

export default MazeGenerator;
