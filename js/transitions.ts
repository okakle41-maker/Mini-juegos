/**
 * transitions.ts — Sistema de transiciones suaves entre vistas
 * Versión TypeScript
 *
 * Las vistas de juego usan una entrada/salida más marcada (scale + blur
 * ligero + slide) que el lobby/shell, para que abrir un módulo se sienta
 * como "entrar a la sesión" y no como un cambio de pestaña.
 */

import ViewManager from './core/viewManager.js';
import GameRegistry from './core/gameRegistry.js';
import { categorySlug } from './utils/categorySlug.js';
import { devLog } from './core/devLog.js';

export interface TransitionConfig {
  exitMs?: number;
  enterMs?: number;
}

class ViewTransitions {
  private isTransitioning = false;
  private initialized = false;
  private readonly EXIT_MS = 200;
  private readonly ENTER_MS = 280;
  private readonly EXIT_GAME_MS = 240;
  private readonly ENTER_GAME_MS = 320;

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

  private prefersReducedMotion(): boolean {
    if (typeof document !== 'undefined' && document.body.classList.contains('reduced-motion')) {
      return true;
    }
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private isGameView(id: string): boolean {
    return !!GameRegistry.get(id);
  }

  private applyCategoryTint(view: HTMLElement, id: string): void {
    const game = GameRegistry.get(id);
    if (!game) {
      view.removeAttribute('data-category');
      return;
    }
    view.setAttribute('data-category', categorySlug(game.tag));
  }

  private transitionTo(id: string, originalShowView: (id: string) => void): void {
    if (this.isTransitioning || this.prefersReducedMotion()) {
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

    const enteringGame = this.isGameView(id);
    const leavingGame = currentView ? this.isGameView(currentView.id) : false;
    const exitMs = leavingGame ? this.EXIT_GAME_MS : this.EXIT_MS;
    const enterMs = enteringGame ? this.ENTER_GAME_MS : this.ENTER_MS;
    const exitClass = leavingGame ? 'view--exit-game' : 'view--exit';
    const enterClass = enteringGame ? 'view--enter-game' : 'view--enter';

    this.applyCategoryTint(nextView, id);

    const performEnter = () => {
      nextView.classList.add(enterClass);
      originalShowView(id);

      // Se necesita al menos un frame pintado con `enterClass` (opacity:0)
      // aplicado antes de quitarla, para que el navegador anime la
      // transición en vez de saltarla directamente al estado final. El
      // patrón estándar para eso es un doble requestAnimationFrame, pero
      // rAF depende del ciclo de refresco real de pantalla — en Firefox y
      // WebKit corriendo headless (típicamente Playwright en CI) ese ciclo
      // puede no dispararse de forma confiable si la pestaña no tiene "foco"
      // real, dejando la vista con opacity:0 pegada para siempre y
      // #gameList/#lobbySearch reportando "hidden" indefinidamente — el
      // fallo que rompía los e2e cross-browser. `settleEnter` es la única
      // vía para completar la entrada, y se dispara por lo que ocurra
      // primero entre el doble rAF (camino normal, con animación) o un
      // timeout corto (red de seguridad): un fallback por tiempo no es
      // más lento en el caso normal porque `clearTimeout` cancela la
      // alternativa apenas una de las dos vías gana.
      let settled = false;
      const settleEnter = () => {
        if (settled) return;
        settled = true;
        nextView.classList.remove(enterClass);
        setTimeout(() => {
          this.isTransitioning = false;
        }, enterMs);
      };

      const fallbackTimer = setTimeout(settleEnter, 50);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          clearTimeout(fallbackTimer);
          settleEnter();
        });
      });
    };

    if (currentView) {
      currentView.classList.add(exitClass);
      setTimeout(() => {
        currentView.classList.remove(exitClass);
        performEnter();
      }, exitMs);
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
