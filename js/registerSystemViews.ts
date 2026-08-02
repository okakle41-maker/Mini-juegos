/**
 * registerSystemViews.ts
 * Registro de las nuevas vistas del sistema v3.0.0
 */

import GameRegistry from './core/gameRegistry.js';

/**
 * Registra las vistas del sistema (no juegos) en GameRegistry
 * Estas vistas usan el mismo sistema de lazy-loading que los juegos
 */
export function registerSystemViews(): void {
  // Vista de Logros
  GameRegistry.register({
    id: 'logros',
    name: 'Logros y Trofeos',
    tag: 'LOGROS',
    accent: '#ffd700',
    icon: '🏆',
    num: 'SYS-01',
    description: 'Sistema de logros y trofeos con recompensas XP, títulos y cosméticos',
    difficulty: 0,
    css: 'css/achievements.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/logros.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });

  // Vista de Progresión
  GameRegistry.register({
    id: 'progresion',
    name: 'Sistema de Progresión',
    tag: 'PROGRESIÓN',
    accent: '#ff6b6b',
    icon: '⚡',
    num: 'SYS-02',
    description: 'Sistema RPG con niveles, árbol de habilidades, misiones diarias y season pass',
    difficulty: 0,
    css: 'css/progression.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/progresion.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });

  // Vista de Personalización
  GameRegistry.register({
    id: 'personalizacion',
    name: 'Personalización',
    tag: 'PERSONALIZACIÓN',
    accent: '#a855f7',
    icon: '🎨',
    num: 'SYS-03',
    description: 'Sistema de personalización avanzada con avatares, skins, temas y más',
    difficulty: 0,
    css: 'css/customization.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/personalizacion.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });

  // Vista de Estadísticas Avanzadas
  GameRegistry.register({
    id: 'estadisticas-avanzadas',
    name: 'Estadísticas Avanzadas',
    tag: 'ESTADÍSTICAS+',
    accent: '#3b82f6',
    icon: '📊',
    num: 'SYS-04',
    description: 'Análisis cognitivo avanzado con métricas de rendimiento y predicciones',
    difficulty: 0,
    css: 'css/advancedStats.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/estadisticasAvanzadas.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });

  // Vista de Multiplayer
  GameRegistry.register({
    id: 'multiplayer',
    name: 'Multiplayer',
    tag: 'MULTIPLAYER',
    accent: '#22c55e',
    icon: '🎮',
    num: 'SYS-05',
    description: 'Sistema de multiplayer en tiempo real con matchmaking y leaderboards',
    difficulty: 0,
    css: 'css/multiplayer.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/multiplayer.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });

  // Vista de Lobby Online (grilla filtrada a solo juegos multiplayer,
  // destino tras crear/unirse a un lobby grupal — ver showLobbyActive
  // en views/multiplayer.logic.ts)
  GameRegistry.register({
    id: 'online-lobby',
    name: 'Lobby Online',
    tag: 'MULTIPLAYER',
    accent: '#22c55e',
    icon: '🌐',
    num: 'SYS-08',
    description: 'Selección de módulos con soporte multiplayer',
    difficulty: 0,
    css: 'css/onlineLobbyConfig.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/onlineLobby.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });

  // Vista Social
  GameRegistry.register({
    id: 'social',
    name: 'Social',
    tag: 'SOCIAL',
    accent: '#ec4899',
    icon: '👥',
    num: 'SYS-06',
    description: 'Sistema social completo con amigos, clanes, chat y muro de perfil',
    difficulty: 0,
    css: 'css/social.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/social.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });

  // Vista de Torneos
  GameRegistry.register({
    id: 'torneos',
    name: 'Torneos y Eventos',
    tag: 'TORNEOS',
    accent: '#f97316',
    icon: '🏆',
    num: 'SYS-07',
    description: 'Sistema de torneos semanales y eventos temáticos con recompensas',
    difficulty: 0,
    css: 'css/tournaments.css',
    hidden: true,
    logic: async () => {
      const { init, stop } = await import('./views/torneos.logic.js');
      return { init, stop };
    },
    init: () => {},
    stop: () => {}
  });
}

// Auto-registrar al importar
registerSystemViews();
