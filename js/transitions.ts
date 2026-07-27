/**
 * transitions.ts — Sistema de transiciones suaves entre vistas
 * Versión TypeScript
 */

import ViewManager from './core/viewManager.js';
import { devLog } from './core/devLog.js';

export interface TransitionConfig {
  exitMs?: number;
  enterMs?: number;
}

class ViewTransitions {
  private isTransitioning = false;
  private initialized = false;
  private readonly EXIT_MS = 180;
  private readonly ENTER_MS = 220;

  /**
   * Envuelve ViewManager.showView para añadir transiciones CSS.
   * IMPORTANTE: se parchea el método de la instancia real de ViewManager
   * (no window.showView), porque lobbyRenderer.ts, app.ts, etc. llaman
   * a ViewManager.showView(...) directamente. Parchear solo window.showView
   * dejaba las transiciones muertas, ya que ningún caller real lo invocaba.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const originalShowView = ViewManager.showView.bind(ViewManager);

    ViewManager.showView = (id: string) => {
      this.transitionTo(id, originalShowView);
    };

    devLog('[Transitions] Sistema de transiciones inicializado');
  }

  private transitionTo(id: string, originalShowView: (id: string) => void): void {
    if (this.isTransitioning) {
      originalShowView(id);
      return;
    }

    const nextView = document.getElementById(id);
    const currentView = Array.from(document.querySelectorAll('.view'))
      .find(v => !v.classList.contains('hidden')) as HTMLElement | null;

    if (!nextView || currentView === nextView) {
      originalShowView(id);
      return;
    }

    this.isTransitioning = true;

    const performEnter = () => {
      nextView.classList.add('view--enter');
      originalShowView(id);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          nextView.classList.remove('view--enter');
          setTimeout(() => {
            this.isTransitioning = false;
          }, this.ENTER_MS);
        });
      });
    };

    if (currentView) {
      currentView.classList.add('view--exit');
      setTimeout(() => {
        currentView.classList.remove('view--exit');
        performEnter();
      }, this.EXIT_MS);
    } else {
      performEnter();
    }
  }
}

// Instancia única
const Transitions = new ViewTransitions();

export default Transitions;

// NOTA: la inicialización la dispara app.ts explícitamente dentro de su
// listener de DOMContentLoaded (Transitions.init()), para garantizar que
// corre después de que ViewManager esté completamente cargado y antes de
// que se pinten las tarjetas. No se auto-inicializa aquí para evitar
// parchear ViewManager.showView dos veces.