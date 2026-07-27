/**
 * Tipos globales compartidos entre módulos TypeScript
 *
 * Cada símbolo expuesto en `window` (patrón "compatibilidad legacy" usado
 * en varios módulos, ver comentarios en gameRegistry.ts/viewManager.ts/etc.)
 * se tipa UNA SOLA VEZ acá, reutilizando la interfaz/clase real que exporta
 * su módulo — nunca copiando la firma a mano. `Window.X` y el `const X`
 * global usan el mismo alias de tipo, porque en runtime son la misma
 * instancia (`window.X = X` a nivel de módulo); declararlos por separado
 * con firmas escritas a mano dos veces es lo que permitía que divergieran
 * silenciosamente sin que TypeScript avisara (pasó con `audioManager`:
 * opcional en un lado, no-opcional en el otro, mismo símbolo).
 */

import type { LeaderboardManager } from '../leaderboardManager';
import type { AuthUser } from '../authManager';
import type { MazeGenerator } from '../games/Maze/mazeGenerator';
import type { MazeRenderer } from '../games/Maze/mazeRenderer';
import type { MazePlayer } from '../games/Maze/mazePlayer';
import type { ErrorLoggerInterface } from '../core/errorLogger';

/**
 * Mapa de elementos del DOM resueltos vía atributos `data-ui="clave"`.
 * Es el objeto `ui` que cada juego recibe en su función `init(ui)`.
 */
export type GameUi = Record<string, HTMLElement>;

// Alias con el tipo real de cada instancia expuesta globalmente — ver
// nota arriba sobre por qué Window.X y el `const X` global comparten
// siempre el mismo alias en vez de firmas duplicadas.
type LeaderboardGlobal = LeaderboardManager;
type MazeGeneratorGlobal = typeof MazeGenerator;
type MazePlayerGlobal = typeof MazePlayer;
type MazeRendererGlobal = typeof MazeRenderer;
type ErrorLoggerGlobal = ErrorLoggerInterface;

declare global {
  interface Window {
    // Safari/antiguos navegadores exponen el AudioContext bajo este prefijo
    webkitAudioContext?: typeof AudioContext;

    Leaderboard: LeaderboardGlobal;
    ErrorLogger: ErrorLoggerGlobal;

    // View management
    showView: (id: string) => void;
    backToMenu: (id?: string) => void;

    // Maze game
    MazeGenerator: MazeGeneratorGlobal;
    MazePlayer: MazePlayerGlobal;
    MazeRenderer: MazeRendererGlobal;

    // GameHelpers (utilidades compartidas para minijuegos)
    GameHelpers: import('../utils/gameHelpers').GameHelpersClass;
  }

  interface WindowEventMap {
    'leaderboard:updated': CustomEvent;
    'auth:changed': CustomEvent<{ user: AuthUser | null }>;
  }

  interface MazePlayerInstance {
    maze: number[][];
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    dirX: number;
    dirY: number;
    moves: number;
    move: (dx: number, dy: number) => boolean;
  }

  // Leaderboard/Maze* siguen siendo referenciados sin prefijo `window.`
  // en varios *.logic.ts — mismo tipo que su contraparte en Window de
  // arriba, nunca una copia separada. audioManager ya NO está acá: los
  // 18 consumidores (games/*.logic.ts + mazeGenerator.ts) migraron a
  // `import audioManager from '.../audioManager.js'` explícito.
  const Leaderboard: LeaderboardGlobal;
  const MazeGenerator: MazeGeneratorGlobal;
  const MazeRenderer: MazeRendererGlobal;
}

export {};
