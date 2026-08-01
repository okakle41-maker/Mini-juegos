export class MazeRenderer {

    static render(maze: number[][], player: MazePlayerInstance): void {

        const board = document.getElementById("mazeGrid");

        if (!board) return;

        board.innerHTML = "";

        const rows = maze.length;
        const cols = maze[0].length;

        board.style.gridTemplateColumns = `repeat(${cols}, 40px)`;
        board.style.gridTemplateRows = `repeat(${rows}, 40px)`;

        for (let y = 0; y < rows; y++) {

            for (let x = 0; x < cols; x++) {

                const cell = document.createElement("div");

                cell.classList.add("maze-cell");

                switch (maze[y][x]) {

                    case 1:
                        cell.classList.add("wall");
                        break;

                    case 0:
                        cell.classList.add("floor");
                        break;

                    case 2:
                        cell.classList.add("exit");
                        break;

                }

                board.appendChild(cell);

            }

        }

        MazeRenderer.updatePlayer(player);

    }

    static updatePlayer(player: MazePlayerInstance): void {

        const playerDiv = document.getElementById("mazePlayer") as HTMLElement | null;
        const grid = document.getElementById("mazeGrid");

        if (!playerDiv || !grid) return;

        const cols = player.maze[0].length;

        const index = player.y * cols + player.x;

        const cell = grid.children[index] as HTMLElement | undefined;

        if (!cell) return;

        playerDiv.style.left =
            (cell.offsetLeft + (cell.offsetWidth - playerDiv.offsetWidth) / 2) + "px";

        playerDiv.style.top =
            (cell.offsetTop + (cell.offsetHeight - playerDiv.offsetHeight) / 2) + "px";
    }

    static spawnParticles(player: MazePlayerInstance): void {

        const effects = document.getElementById("mazeEffects");
        const grid = document.getElementById("mazeGrid");

        if (!effects || !grid) return;

        const cols = player.maze[0].length;
        const index = player.y * cols + player.x;

        const cell = grid.children[index] as HTMLElement | undefined;

        if (!cell) return;

        const x = cell.offsetLeft + cell.offsetWidth / 2;
        const y = cell.offsetTop + cell.offsetHeight / 2;

        for (let i = 0; i < 5; i++) {

            const p = document.createElement("div");

            p.className = "maze-particle";

            p.style.left = x + "px";
            p.style.top = y + "px";

            p.style.setProperty(
                "--dx",
                (Math.random() * 40 - 20) + "px"
            );

            p.style.setProperty(
                "--dy",
                (Math.random() * 40 - 20) + "px"
            );

            effects.appendChild(p);

            p.addEventListener("animationend", () => {
                p.remove();
            });
        }

    }

    static updateFog(player: MazePlayerInstance | null): void {

        if (!player) return;

        const fog = document.getElementById("mazeFog") as HTMLElement | null;
        const grid = document.getElementById("mazeGrid");

        if (!fog || !grid) return;

        const cols = player.maze[0].length;
        const index = player.y * cols + player.x;

        const cell = grid.children[index] as HTMLElement | undefined;

        if (!cell) return;

        const x = cell.offsetLeft + cell.offsetWidth / 2;
        const y = cell.offsetTop + cell.offsetHeight / 2;

        fog.style.transition = "background .15s linear";

        fog.style.background = `
        radial-gradient(
            circle at ${x}px ${y}px,

            rgba(0,255,255,.25) 0px,
            rgba(0,255,255,.15) 15px,

            rgba(0,0,0,0) 40px,

            rgba(0,0,0,.45) 60px,

            rgba(0,0,0,.98) 85px,

            rgba(0,0,0,.96) 110px,

            rgba(0,0,0,.995) 150px
        )`;

    }

}

window.MazeRenderer = MazeRenderer;

export default MazeRenderer;
