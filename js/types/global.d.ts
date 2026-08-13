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

    // Singletons expuestos en window para debugging/consola de devTools
    // (patrón `(window as any).x = x` al final de cada módulo — antes sin
    // tipar, ahora reutilizando el tipo real del singleton exportado en
    // cada archivo en vez de castear a `any` en cada sitio de acceso).
    accessibilitySystem: typeof import('../accessibilitySystem').default;
    practiceMode: typeof import('../practiceMode').default;
    advancedStatsSystem: typeof import('../advancedStats').default;
    socialSharing: typeof import('../socialSharing').default;
    badgeSystem: typeof import('../badgesSystem').default;
    progressionSystem: typeof import('../progressionSystem').default;
    playerStats: typeof import('../playerStats').default;
    analytics: typeof import('../analytics').default;
    themeManager: typeof import('../themeManager').default;
    i18n: typeof import('../i18n').default;
    t: (key: string, params?: Record<string, string | number>) => string;
    productionMonitoring: typeof import('../productionMonitoring').default;
    customizationSystem: typeof import('../customizationSystem').default;
    multiplayerSystem: typeof import('../multiplayerSystem').default;
    gamificationSystem: typeof import('../gamificationSystem').default;
    socialSystem: typeof import('../socialSystem').default;
    notificationSystem: typeof import('../notificationSystem').default;
    achievementManager: typeof import('../achievements').default;
    difficultyPresets: typeof import('../difficultyPresets').default;
    soundSystem: typeof import('../soundSystem').default;
    tournamentSystem: typeof import('../tournamentSystem').default;
    devTools: typeof import('../devTools').default;
    dev: (command: string) => string;
    performanceMonitor: typeof import('../performanceMonitor').default;
    getWebVitals: () => ReturnType<
      typeof import('../performanceMonitor').default['getCoreWebVitals']
    >;
    exportPerformanceReport: () => string;
    pwaSystem: typeof import('../pwaSystem').default;
    // Evento nativo `beforeinstallprompt`, capturado para disparar el
    // prompt de instalación más tarde. No tiene tipo DOM estándar porque
    // aún no está en todos los navegadores; se guarda como Event | null
    // (el cast a BeforeInstallPromptEvent-like se hace en pwaSystem.ts,
    // el único lugar que conoce su forma real: .prompt()/.userChoice).
    deferredPrompt: Event | null;
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
