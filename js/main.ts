/**
 * Entry point principal para Vite
 * Importa todos los módulos necesarios en el orden correcto
 */

// Core modules (deben cargarse primero)
import './core/errorLogger';
import './core/safeStorage';
import './core/supabaseClient';
import './core/gameRegistry';
import './core/gameInstanceRegistry';
import './core/viewManager';
import './errorBoundary';
import './security';
import './accessibility';
import './performance';
import './devTools';
import './gameOptimizations';
import './productionMonitoring';
import './i18n';
import './analytics';
import './themeManager';
import './achievements';
import './playerStats';
import './practiceMode';
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
import './statsManager';
import './authManager';
import './interactionLock';
import './keyboardShortcuts';
import './preferencesManager';
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
import './hudPanel';

