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
import './accountView';
import './hudPanel';

