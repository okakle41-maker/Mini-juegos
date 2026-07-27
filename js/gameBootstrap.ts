/**
 * gameBootstrap.ts — Bootstrap y carga inicial de todos los juegos
 * Versión TypeScript
 */

import GameRegistry from './core/gameRegistry.js';
import GameHelpers from './utils/gameHelpers.js';
import ErrorLogger from './core/errorLogger.js';
import { devLog } from './core/devLog.js';

// NOTA: los imports de juegos individuales viven únicamente en main.ts,
// que es el entry point real referenciado en index.html. main.ts importa
// todos los juegos ANTES de importar este archivo, así que para cuando
// GameBootstrap.init() corre, todos ya están registrados.
// Duplicar los imports aquí era redundante (ES modules cachea el módulo,
// así que no había doble-registro real) y frágil: si algún día se elimina
// este archivo, un juego importado solo aquí dejaría de registrarse
// silenciosamente. Por eso ahora game imports viven solo en main.ts.

export class GameBootstrap {
  private initialized = false;

  /**
   * Inicializa todos los sistemas y registra los juegos
   */
  init(): void {
    if (this.initialized) return;

    try {
      devLog('%c[GameBootstrap] Iniciando carga de sistemas...', 'color:#ff9a3c');

      // Registrar helpers globales
      window.GameHelpers = GameHelpers;

      // Cargar todos los juegos registrados (cada juego se registra a sí mismo)
      this.loadAllGames();

      this.initialized = true;
      devLog('[GameBootstrap] Todos los sistemas cargados correctamente');

    } catch (error) {
      ErrorLogger.log('GameBootstrap', error, { phase: 'init' });
    }
  }

  private loadAllGames(): void {
    // Los archivos individuales de juegos ya se encargan de registrarse
    // al importarlos. Esto permite carga lazy en el futuro.
    devLog(`[GameBootstrap] ${GameRegistry.all().length} juegos registrados`);
  }

  /**
   * Reinicia todos los juegos (útil para debug)
   */
  resetAllGames(): void {
    GameRegistry.allStopFns().forEach(({ stop }) => {
      try {
        stop();
      } catch (e) {
        // Ignorar errores en stop
      }
    });
  }
}

// Instancia única
const GameBootstrapInstance = new GameBootstrap();

export default GameBootstrapInstance;

// Inicialización automática
document.addEventListener('DOMContentLoaded', () => {
  GameBootstrapInstance.init();
});