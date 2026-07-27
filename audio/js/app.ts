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

// Tipos globales ya están en global.d.ts

document.addEventListener('DOMContentLoaded', () => {
  console.log('%c🚀 Minijuegos - Entrenador de Bots v2.5.0', 'color:#ff9a3c; font-size:16px; font-weight:bold');

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
  version: string;
}

(window as unknown as { Minijuegos: MinijuegosDebugApi }).Minijuegos = {
  GameRegistry,
  ViewManager,
  GameHelpers,
  ErrorLogger,
  version: '2.5.0'
};

export {};