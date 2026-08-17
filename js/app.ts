/**
 * app.ts — Punto de entrada principal de la aplicación
 * Orquestador principal del lobby y bootstrap
 */

import GameRegistry from './core/gameRegistry.js';
import ViewManager from './core/viewManager.js';
import Transitions from './transitions.js';
import ErrorLogger from './core/errorLogger.js';
import GameHelpers from './utils/gameHelpers.js';
import LobbyRenderer from './lobbyRenderer.js';
import { devLog } from './core/devLog.js';
import { fixSocialMetaImages } from './core/socialMeta.js';

// Import system modules
import { errorBoundary } from './errorBoundary.js';
import { globalRateLimiter } from './security.js';
import { keyboardShortcuts } from './keyboardShortcuts.js';
import './accessibilityToggles.js';
import { notificationSystem } from './notificationSystem.js';
import { devTools } from './devTools.js';
import { performanceMonitor } from './performanceMonitor.js';

// Importar nuevos sistemas v3.0.0
import { achievementManager } from './achievements.js';
import { progressionSystem } from './progressionSystem.js';
import { customizationSystem } from './customizationSystem.js';
import { multiplayerSystem } from './multiplayerSystem.js';
import { socialSystem } from './socialSystem.js';
import { tournamentSystem } from './tournamentSystem.js';
// advancedStatsSystem (advancedStats.ts, ~600 líneas) NO se importa acá a
// propósito (Aug 2026): es el único de estos sistemas sin ningún
// dependiente fuera de su propia vista lazy (estadisticasAvanzadas.logic.ts,
// cargada vía import() dinámico desde registerSystemViews.ts) — a
// diferencia de achievementManager (usado por leaderboardManager.ts en
// cada partida) o socialSystem/tournamentSystem/multiplayerSystem (que se
// referencian entre sí), nada fuerza a advancedStats.ts a estar disponible
// desde el arranque. Importarlo acá solo para exponerlo en
// window.Minijuegos (ver el objeto de debug más abajo) sumaba ~600 líneas
// al chunk que carga siempre, por una API de debugging manual — se expone
// igual pero de forma perezosa (ver abajo), sin forzar la descarga.

// Importar sistemas adicionales de mejoras
import { accessibilitySystem } from './accessibilitySystem.js';

// Importar sistemas adicionales v3.0.0
import { pwaSystem } from './pwaSystem.js';

// Registrar vistas del sistema
import './registerSystemViews.js';

// Tipos globales ya están en global.d.ts

document.addEventListener('DOMContentLoaded', () => {
  // Banner de marca en consola, intencionalmente visible siempre (no solo
  // en dev) para cualquiera que abra devtools — no es una traza de debug.
  // eslint-disable-next-line no-console
  console.log('%c🚀 Minijuegos - Entrenador de Bots v3.0.0', 'color:#ff9a3c; font-size:16px; font-weight:bold');

  // og:image / twitter:image nacen relativas en el HTML (ver comentario
  // en index.html y en core/socialMeta.ts) — se resuelven a absolutas acá.
  fixSocialMetaImages();

  // Registrar Service Worker (PWA / soporte offline).
  // sw.ts existía y estaba completo, pero nada en el código lo registraba
  // — se compila a dist/sw.js vía un paso de build dedicado (ver
  // package.json: "build:sw"), separado del bundle de Vite porque un
  // service worker no puede vivir dentro de un chunk con nombre hasheado.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // import.meta.env.BASE_URL viene de `base` en vite.config.ts — en
      // GitHub Pages el sitio vive en un subpath (/Mini-juegos/), así que
      // '/sw.js' a secas apuntaba a la raíz del dominio (donde no existe)
      // en vez de a /Mini-juegos/sw.js.
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { type: 'module' }).catch(error => {
        console.warn('[App] No se pudo registrar el Service Worker:', error);
      });
    });
  }

  try {
    // Inicializar sistema de transiciones
    Transitions.init?.();

    // Inicializar sistemas adicionales de mejoras
    // Estos sistemas se auto-inicializan en sus constructores
    devLog('[App] Sistemas de mejoras inicializados:', {
      errorBoundary: '✓',
      security: '✓',
      keyboardShortcuts: '✓',
      accessibilityToggles: '✓',
      devTools: '✓',
      performanceMonitor: '✓',
      notifications: '✓',
      accessibility: '✓',
      pwa: '✓'
    });

    // Mostrar vista inicial
    ViewManager.showView('home');

    // Renderizar tarjetas de módulos y barra de filtros
    LobbyRenderer.render();

    devLog('[App] Inicialización completada correctamente');
    // Debug temporal: comprobar registro de juegos y visibilidad
    try {
      devLog('Juegos registrados:', GameRegistry.all().length);
      devLog('Juegos visibles:', GameRegistry.visible().map((g) => g.id));
    } catch (e) {
      console.warn('[App] Error al consultar GameRegistry para debug:', e);
    }

  } catch (error) {
    ErrorLogger.log('App Bootstrap', error, { phase: 'DOMContentLoaded' });
    console.error('Error crítico durante el bootstrap:', error);
  }
});

// Exponer API principal para compatibilidad y debugging
interface MinijuegosDebugApi {
  GameRegistry: typeof GameRegistry;
  ViewManager: typeof ViewManager;
  GameHelpers: typeof GameHelpers;
  ErrorLogger: typeof ErrorLogger;
  errorBoundary: typeof errorBoundary;
  globalRateLimiter: typeof globalRateLimiter;
  keyboardShortcuts: typeof keyboardShortcuts;
  notificationSystem: typeof notificationSystem;
  devTools: typeof devTools;
  performanceMonitor: typeof performanceMonitor;
  achievementManager: typeof achievementManager;
  progressionSystem: typeof progressionSystem;
  customizationSystem: typeof customizationSystem;
  multiplayerSystem: typeof multiplayerSystem;
  socialSystem: typeof socialSystem;
  tournamentSystem: typeof tournamentSystem;
  accessibilitySystem: typeof accessibilitySystem;
  pwaSystem: typeof pwaSystem;
  version: string;
}

const minijuegosDebugApi = {
  GameRegistry,
  ViewManager,
  GameHelpers,
  ErrorLogger,
  errorBoundary,
  globalRateLimiter,
  keyboardShortcuts,
  notificationSystem,
  devTools,
  performanceMonitor,
  achievementManager,
  progressionSystem,
  customizationSystem,
  multiplayerSystem,
  socialSystem,
  tournamentSystem,
  accessibilitySystem,
  pwaSystem,
  version: '3.0.0'
};

// advancedStatsSystem se expone vía getter en vez de propiedad directa:
// solo dispara el import() dinámico (y por lo tanto la descarga de
// advancedStats.ts) la primera vez que alguien accede a
// `window.Minijuegos.advancedStatsSystem` desde la consola — no en cada
// carga de la app. Devuelve una promesa en vez del sistema en sí porque
// no hay forma de resolver un import() de forma síncrona; quien lo use
// para debugging hace `await Minijuegos.advancedStatsSystem` una vez.
type MinijuegosDebugApiWithLazyStats = MinijuegosDebugApi & {
  readonly advancedStatsSystem: Promise<typeof import('./advancedStats.js')['advancedStatsSystem']>;
};

const minijuegosApiWithLazyStats = minijuegosDebugApi as unknown as MinijuegosDebugApiWithLazyStats;
Object.defineProperty(minijuegosApiWithLazyStats, 'advancedStatsSystem', {
  enumerable: true,
  get(): Promise<typeof import('./advancedStats.js')['advancedStatsSystem']> {
    return import('./advancedStats.js').then((m) => m.advancedStatsSystem);
  }
});

(window as unknown as { Minijuegos: MinijuegosDebugApiWithLazyStats }).Minijuegos = minijuegosApiWithLazyStats;

export {};