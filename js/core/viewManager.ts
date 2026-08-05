/**
 * viewManager.ts — Gestor de vistas y navegación entre secciones
 * Versión TypeScript con tipos fuertes
 *
 * Las vistas de juegos individuales NO viven en index.html: cada
 * `<section data-lazy="1">` empieza vacía y su contenido se
 * trae vía import() dinámico la primera vez que el usuario la visita (ver
 * loadLazyView). Esto evita cargar ~2300 líneas de HTML de minijuegos
 * que el usuario típicamente nunca abre en una sesión dada.
 *
 * Migrado de fetch() sobre public/views/*.html a import() sobre
 * js/views/*.ts (ver js/core/viewTemplates.ts para el registro):
 * mismo lazy-loading en la práctica, pero resuelto por el bundler
 * (Vite genera un chunk por template) en vez de una petición de red a
 * un archivo estático servido tal cual. El atributo `data-lazy` en el
 * HTML se conserva solo como bandera de "esta vista todavía no se
 * hidrató" — su valor (el viejo path a .html) ya no se usa para nada.
 */

import { hydrateBackButtons } from '../utils/backButton.js';
import { viewTemplates } from './viewTemplates.js';
import { devLog } from './devLog.js';
import BackgroundManager from '../backgroundManager.js';
import GameRegistry from './gameRegistry.js';

export interface ViewManagerInterface {
  showView: (id: string) => void;
  backToMenu: (fallbackId?: string) => void;
  getCurrentView: () => string | null;
  hideAll: () => void;
}

class ViewManager implements ViewManagerInterface {
  private currentViewId: string | null = null;

  /**
   * Si la vista tiene `data-lazy`, trae su template vía import() dinámico
   * y lo inyecta. Idempotente: no vuelve a pedir el import si ya se cargó
   * o está en curso.
   */
  /** Promesas de carga en curso por id de vista — permite que una
   *  segunda navegación al mismo id mientras la primera carga todavía
   *  está en vuelo (p.ej. A→B→A rápido) espere esa misma promesa en
   *  vez de resolver de inmediato con el HTML todavía sin hidratar
   *  (ver el guard `if (this.loadingViews.has(id)) return;` de antes,
   *  que dejaba a un segundo showView(id) creyendo que la carga ya
   *  había terminado). */
  private loadingPromises = new Map<string, Promise<void>>();

  private async loadLazyView(targetView: HTMLElement): Promise<void> {
    const src = targetView.dataset.lazy;
    if (!src) return;

    const id = targetView.id;
    const inFlight = this.loadingPromises.get(id);
    if (inFlight) return inFlight;

    const promise = (async () => {
      try {
        const loadTemplate = viewTemplates[id];
        if (!loadTemplate) throw new Error(`No hay template registrado para la vista "${id}"`);

        const mod = await loadTemplate();
        targetView.innerHTML = mod.default();
        delete targetView.dataset.lazy;
        hydrateBackButtons(targetView);
      } catch (error) {
        window.ErrorLogger?.log('ViewManager.loadLazyView', error, { viewId: id, src });
        targetView.innerHTML = `
          <div class="back-btn" onclick="window.backToMenu()">← Volver</div>
          <p style="padding:2rem;text-align:center;opacity:.7;">
            No se pudo cargar este minijuego. Revisa tu conexión e inténtalo de nuevo.
          </p>`;
      } finally {
        this.loadingPromises.delete(id);
      }
    })();

    this.loadingPromises.set(id, promise);
    return promise;
  }

  /**
   * Muestra una vista específica (sección)
   */
  showView(id: string): void {
    const targetView = document.getElementById(id);
    if (!targetView) {
      window.ErrorLogger?.log('ViewManager.showView', new Error(`Vista no encontrada: ${id}`), { id });
      return;
    }

    // Detener el juego de la vista anterior (si tenía uno activo)
    if (this.currentViewId && this.currentViewId !== id) {
      GameRegistry.stopGame(this.currentViewId);
    }

    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach((view: Element) => {
      view.classList.add('hidden');
    });

    // Mostrar la vista solicitada
    targetView.classList.remove('hidden');
    this.currentViewId = id;

    const initGame = () => {
      // Trigger para lazy initialization de juegos
      GameRegistry.ensureInit(id);
      document.dispatchEvent(new CustomEvent('view-shown', { detail: { id } }));
    };

    if (targetView.dataset.lazy) {
      // El HTML del juego aún no existe en el DOM: pedirlo primero y
      // solo entonces resolver `ui` e inicializar (resolveUi necesita
      // los elementos `data-ui` ya presentes).
      //
      // Antes, esta promesa encadenaba `.then(initGame)` sin ninguna
      // verificación posterior: si el usuario navegaba a otra vista B
      // mientras el import() de A todavía estaba en curso (dos clicks
      // rápidos en el lobby), currentViewId ya valía 'B' para cuando A
      // terminaba de cargar, pero initGame() para 'A' se ejecutaba
      // igual — inicializando (rAF loops, listeners, timers) un juego
      // que el usuario ya no estaba viendo y que nadie iba a detener
      // con stopGame (que solo se dispara al ENTRAR a la siguiente
      // vista, no al abandonar la actual a mitad de una carga
      // pendiente). El guard de abajo descarta esa inicialización
      // fantasma si, para cuando la carga termina, esta vista ya dejó
      // de ser la actual.
      this.loadLazyView(targetView).then(() => {
        if (this.currentViewId === id) initGame();
      });
    } else {
      initGame();
    }

    // Notificar cambio de vista para efectos de fondo por juego
    BackgroundManager.onViewChange(id);

    devLog(`[ViewManager] Vista mostrada: ${id}`);
  }

  /**
   * Vuelve al menú principal o a una vista fallback
   */
  backToMenu(fallbackId: string = 'home'): void {
    this.showView(fallbackId);
  }

  /**
   * Retorna el ID de la vista actual
   */
  getCurrentView(): string | null {
    return this.currentViewId;
  }

  /**
   * Oculta todas las vistas
   */
  hideAll(): void {
    document.querySelectorAll('.view').forEach((view: Element) => {
      view.classList.add('hidden');
    });
    this.currentViewId = null;
  }
}

// Instancia única
const ViewManagerInstance = new ViewManager();

export default ViewManagerInstance;

// Compatibilidad legacy
window.showView = (id: string) => ViewManagerInstance.showView(id);
window.backToMenu = (id?: string) => ViewManagerInstance.backToMenu(id);