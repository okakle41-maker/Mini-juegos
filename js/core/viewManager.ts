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
import { skeletonSystem } from '../skeletonSystem.js';

/**
 * Nota de arquitectura (Fase 4 de la migración a Preact — ver
 * docs/ARCHITECTURE.md y el historial de esta conversación):
 *
 * ViewManager fue evaluado como candidato a reescritura declarativa
 * (Preact) porque en algún momento tuvo una condición de carrera real
 * de navegación: mostrar la vista A, y antes de que su import()
 * dinámico terminara de resolver, navegar a B, resultaba en que
 * initGame() para A igual se ejecutaba al terminar de cargar —
 * inicializando un juego que el usuario ya no estaba viendo. Ese es
 * exactamente el tipo de bug que la reconciliación de estado de un
 * framework declarativo evita estructuralmente en vez de por
 * disciplina manual.
 *
 * Al auditar el código para esta fase, se confirmó que ESE BUG YA
 * ESTÁ RESUELTO: ver el guard `if (this.currentViewId === id)
 * initGame()` en showView() más abajo, y la cobertura de regresión en
 * test/viewManagerRaceCondition.test.ts (dos casos: A→B rápido, y
 * A→B→A rápido). La solución manual — comparar currentViewId contra
 * el id capturado en el closure de la promesa al momento en que esta
 * resuelve — es correcta y ya está en producción.
 *
 * Decisión: NO se reescribe ViewManager a Preact en esta fase. El
 * costo (reescribir la navegación central de 35+ vistas, cada una con
 * su propio ciclo de carga lazy/hidratación/init de juego/limpieza vía
 * GameRegistry.stopGame, más la integración con BackgroundManager y
 * los back buttons) es alto, y el beneficio concreto que motivaba la
 * migración —eliminar esa carrera— ya no existe: el bug fue arreglado
 * por otra vía y tiene tests de regresión sólidos. Migrar código que
 * ya funciona bien solo para "usar el framework" no es el criterio de
 * esta migración incremental (ver la Fase 1 del plan: no todo
 * necesita Preact, solo donde hay estado compartido complejo que hoy
 * se sincroniza a mano con bugs reales de por medio). El shell del
 * lobby (Fases 2-3: GameCard, filtro+búsqueda combinados) sí calificó
 * porque ahí SÍ había un bug real y activo (búsqueda pisando el
 * filtro) resuelto por la migración misma, no solo un cambio de
 * tecnología por sí solo.
 */
export interface ViewManagerInterface {
  showView: (id: string) => void;
  backToMenu: (fallbackId?: string) => void;
  getCurrentView: () => string | null;
  hideAll: () => void;
}

class ViewManager implements ViewManagerInterface {
  private currentViewId: string | null = null;

  /** Cancela cualquier transición de salida en curso (listener +
   *  timeout de respaldo) para evitar que un showView() disparado a
   *  medio camino de otra transición (doble click rápido) ejecute un
   *  runShow() "fantasma" más tarde, pisando el estado que una
   *  navegación posterior ya dejó montado. Ver showView() más abajo. */
  private pendingTransition: { cleanup: () => void } | null = null;

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

    const previousView = this.currentViewId
      ? document.getElementById(this.currentViewId)
      : null;
    const previousViewId = this.currentViewId;

    // Si había una transición de salida pendiente de una navegación
    // anterior (doble click rápido: A→B→A antes de que B terminara de
    // montarse), cancelarla — su runShow() ya no debe ejecutar, la
    // navegación actual manda.
    if (this.pendingTransition) {
      this.pendingTransition.cleanup();
      this.pendingTransition = null;
    }

    // ¿Es una transición hacia/desde un minijuego (home <-> juego), o
    // entre dos pantallas del shell (home <-> estadísticas, etc.)? El
    // CSS tiene dos juegos de variantes (--exit/--enter vs
    // --exit-game/--enter-game, ver _lobby-toolbar-sidebar.css) porque
    // entrar a un juego pide más presencia (blur/scale mayor) que
    // moverse entre secciones del propio shell.
    const isGameTransition = id !== 'home' || (previousViewId ?? 'home') !== 'home';
    const exitClass = isGameTransition ? 'view--exit-game' : 'view--exit';
    const enterClass = isGameTransition ? 'view--enter-game' : 'view--enter';

    // currentViewId se actualiza de inmediato (síncrono), como antes de
    // agregar las transiciones: es la fuente de verdad de "a dónde
    // navegó el usuario", y otras llamadas a showView() que puedan
    // llegar durante la animación de salida (isGameTransition de la
    // *siguiente* navegación, stopGame, etc.) necesitan verlo
    // actualizado ya. Lo que se difiere hasta que termina la animación
    // de salida es solo el trabajo pesado: ocultar la vista anterior,
    // montar/inicializar la nueva.
    this.currentViewId = id;

    const runShow = () => {
      // Detener el juego de la vista anterior (si tenía uno activo)
      if (previousViewId && previousViewId !== id) {
        GameRegistry.stopGame(previousViewId);
      }

      // Ocultar todas las vistas
      document.querySelectorAll('.view').forEach((view: Element) => {
        view.classList.add('hidden');
        view.classList.remove('view--exit', 'view--exit-game');
      });

      // Mostrar la vista solicitada, arrancando desde el estado
      // "recién entrando" (--enter/--enter-game) para que el navegador
      // tenga un frame con opacity:0 antes de que la quitemos: sin ese
      // frame previo no hay nada de qué animar (la transición de .view
      // no dispara si el elemento pasa de display:none a su estado
      // final en el mismo tick).
      targetView.classList.remove('hidden');
      targetView.classList.add(enterClass);

      // Doble rAF: el primero deja pintar el frame inicial
      // (opacity:0, trasladado), el segundo recién quita la clase de
      // entrada para que el navegador anime hacia el estado base de
      // .view en vez de saltar directo sin transición.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          targetView.classList.remove(enterClass);
        });
      });

      const initGame = () => {
        // Trigger para lazy initialization de juegos
        void GameRegistry.ensureInit(id).catch((err: unknown) => {
          console.error('[ViewManager] Error al inicializar el juego:', err);
        });
        document.dispatchEvent(new CustomEvent('view-shown', { detail: { id } }));
      };

      if (targetView.dataset.lazy) {
        // El HTML del juego aún no existe en el DOM: mostrar un
        // skeleton (silueta de carga con shimmer) mientras el
        // import() dinámico está en vuelo, para que la espera no se
        // sienta como una vista en blanco. Con el chunk ya cacheado
        // por el navegador (visitas repetidas a un juego dentro de la
        // misma sesión) esto dura un frame o dos y ni se percibe; el
        // valor real es la primera visita de la sesión o con red
        // lenta, donde el import() sí puede tardar. Se pisa con el
        // HTML real apenas loadLazyView() lo asigna más abajo.
        targetView.innerHTML = skeletonSystem.getGameViewSkeleton();

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
        void this.loadLazyView(targetView).then(() => {
          if (this.currentViewId === id) initGame();
        }).catch((err: unknown) => {
          console.error('[ViewManager] Error al cargar vista lazy:', err);
        });
      } else {
        initGame();
      }

      // Notificar cambio de vista para efectos de fondo por juego
      BackgroundManager.onViewChange(id);

      devLog(`[ViewManager] Vista mostrada: ${id}`);
    };

    // Si no hay vista previa (primera carga) o es la misma vista, no
    // hay nada que animar de salida: mostrar directo.
    if (!previousView || previousView === targetView) {
      runShow();
      return;
    }

    // Animar la salida de la vista anterior y, solo cuando termina esa
    // transición (evento 'transitionend', con un timeout de respaldo
    // por si el navegador no dispara el evento — pestaña en background,
    // reduced-motion con transition:none, etc.), recién entonces montar
    // la nueva vista. Un solo listener con { once: true }: transitionend
    // dispara una vez por propiedad animada (opacity/transform/filter),
    // así que sin el guard onEnd() ya ejecutado, runShow() correría 3
    // veces.
    let settled = false;
    const onEnd = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);
      previousView.removeEventListener('transitionend', onEnd);
      this.pendingTransition = null;
      runShow();
    };
    previousView.addEventListener('transitionend', onEnd, { once: true });
    // Duración base: la salida de vistas de juego (--exit-game) dura
    // 350ms en el CSS; el margen de 60ms cubre variación de frame
    // timing sin sentirse como una demora perceptible.
    const fallbackTimer = window.setTimeout(onEnd, 410);
    this.pendingTransition = {
      cleanup: () => {
        settled = true;
        clearTimeout(fallbackTimer);
        previousView.removeEventListener('transitionend', onEnd);
        previousView.classList.remove('view--exit', 'view--exit-game');
      },
    };
    previousView.classList.add(exitClass);
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
    if (this.pendingTransition) {
      this.pendingTransition.cleanup();
      this.pendingTransition = null;
    }
    document.querySelectorAll('.view').forEach((view: Element) => {
      view.classList.add('hidden');
      view.classList.remove('view--exit', 'view--exit-game', 'view--enter', 'view--enter-game');
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