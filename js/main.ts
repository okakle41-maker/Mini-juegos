/**
 * Entry point principal para Vite
 * Importa todos los módulos necesarios en el orden correcto
 */

// Modo bajo consumo: se activa por (a) preferencia guardada del
// usuario (toggle en Configuración, ver js/perfMode.ts) o (b) query
// string ?perf=1 para pruebas puntuales sin tocar la preferencia
// guardada. Debe correr ANTES de cualquier import — en particular
// antes de customCursor, que chequea esta clase en su init() para
// decidir si arranca su RAF loop o no. Ver css/styles.css al final
// del archivo (bloque `body.perf-mode`) para el resto de lo que
// desactiva.
//
// Leemos localStorage directamente acá (no vía safeStorage, que
// todavía no se importó) porque este bloque tiene que correr antes
// que cualquier import — es la misma razón por la que el chequeo de
// ?perf=1 ya vivía suelto acá arriba. js/perfMode.ts, más abajo en
// los imports, es la fuente de verdad para escribir/sincronizar esta
// preferencia; acá solo la leemos una vez para no pintar sin el modo
// aplicado y que el usuario vea un parpadeo de vuelta a alto consumo.
try {
  if (
    new URLSearchParams(location.search).get('perf') === '1' ||
    window.localStorage.getItem('st_perf_mode') === '1'
  ) {
    document.body.classList.add('perf-mode');
  }
} catch {
  // localStorage bloqueado (modo privado estricto, iframe, etc.): sin
  // preferencia persistida que leer, seguimos sin perf-mode por
  // defecto — no debe impedir que el resto de la app arranque.
}

// Core modules (deben cargarse primero)
import './core/errorLogger';
import './core/safeStorage';
import './core/gameRegistry';
import './core/gameInstanceRegistry';
import './core/viewManager';
import './errorBoundary';
import './security';
import './accessibility';
import './performance';
import './devTools';
import './gameOptimizations';
import './achievements';
import './notificationSystem';
import './difficultyPresets';
import './difficultySettings';
import './socialSharing';

// Managers (migrados a TypeScript)
import './leaderboardManager';
import './favoritesManager';
import './audioManager';
import './backgroundManager';
import './configPanel';
import './configReset';
import './customCursor';
import './perfMode';
import './statsManager';
import './authManager';
import './accountView';
import './interactionLock';
import './keyboardShortcuts';
import './accessibilityToggles';
import './uiSoundEffects';
import './confettiEffect';
import './performanceMonitor';

// Games (todos migrados a GameRegistry.register(), centralizados en el barrel)
import './games/index';

// Bootstrap y app (después de todos los juegos)
import './gameBootstrap';
import './lobbyRenderer';
import './app';
import './transitions';
import './sidebarViews';

// Widgets de UI que dependen del DOM del shell (sidebar y reproductor de música)
import './sideNavBoot';
import './musicPlayerDrag';
import './musicPlayer';
import './lobbySidebarUI';
import './headerUptime';
import './configTogglesPanel';

