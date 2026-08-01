export class MazePlayer implements MazePlayerInstance {

    maze: number[][];
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    dirX: number;
    dirY: number;
    moves: number;

    constructor(maze: number[][]) {

        this.maze = maze;

        const rows = maze.length;
        const cols = maze[0].length;

        let cx = Math.floor(cols / 2);
        let cy = Math.floor(rows / 2);

        // Si el centro es una pared, buscamos el suelo más cercano
        if (maze[cy][cx] !== 0) {

            let found = false;

            for (let r = 1; r < Math.max(rows, cols) && !found; r++) {

                for (let y = Math.max(1, cy - r); y <= Math.min(rows - 2, cy + r); y++) {

                    for (let x = Math.max(1, cx - r); x <= Math.min(cols - 2, cx + r); x++) {

                        if (maze[y][x] === 0) {

                            cx = x;
                            cy = y;
                            found = true;
                            break;

                        }

                    }

                    if (found) break;

                }

            }

        }

        this.x = cx;
        this.y = cy;

        this.prevX = cx;
        this.prevY = cy;

        this.dirX = 0;
        this.dirY = 0;

        this.moves = 0;

    }

    move(dx: number, dy: number): boolean {

        const nx = this.x + dx;
        const ny = this.y + dy;

        if (
            nx < 0 ||
            ny < 0 ||
            nx >= this.maze[0].length ||
            ny >= this.maze.length
        ) {
            return false;
        }

        if (this.maze[ny][nx] === 1) {
            return false;
        }

        this.prevX = this.x;
        this.prevY = this.y;

        this.x = nx;
        this.y = ny;

        this.dirX = dx;
        this.dirY = dy;

        this.moves++;

        return true;

    }

}

window.MazePlayer = MazePlayer;

export default MazePlayer;
