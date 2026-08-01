/**
 * gameHelpers.ts — Utilidades compartidas para todos los minijuegos
 * Versión TypeScript con tipos fuertes y mejor organización
 */

export interface ClampedOptions {
  min?: number;
  max?: number;
  fallback?: number;
}

export interface CleanupManager {
  addListener: (target: EventTarget | null, type: string, handler: EventListener, options?: AddEventListenerOptions) => void;
  addInterval: (fn: () => void, ms: number) => number;
  addTimeout: (fn: () => void, ms: number) => number;
  cleanup: () => void;
}

export class GameHelpersClass {
  /**
   * Restringe `v` al rango [min, max]. Consolidado desde 3 juegos que
   * lo redefinían de forma idéntica (mechlock, memorygrid, reactor).
   */
  clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * Lee un valor numérico de un <input> con clamping seguro
   */
  readClampedInt(el: HTMLInputElement | HTMLSelectElement | null, options: ClampedOptions = {}): number {
    if (!el) return options.fallback ?? 0;

    const raw = parseInt(el.value, 10);
    const min = options.min ?? -Infinity;
    const max = options.max ?? Infinity;
    const fallback = options.fallback ?? 0;

    return isNaN(raw) ? fallback : Math.max(min, Math.min(max, raw));
  }

  /**
   * Aplica efecto shake a un elemento
   */
  shakeElement(el: HTMLElement | null, duration: number = 350): void {
    if (!el) return;
    el.classList.remove('gh-shake');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('gh-shake');
    setTimeout(() => el.classList.remove('gh-shake'), duration);
  }

  /**
   * Actualiza una barra de progreso
   */
  updateProgressBar(
    barEl: HTMLElement | null,
    current: number,
    total: number,
    labelEl?: HTMLElement | null,
    labelFormat?: (current: number, total: number) => string
  ): number {
    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
    
    if (barEl) barEl.style.width = `${percent}%`;
    
    if (labelEl) {
      labelEl.textContent = labelFormat 
        ? labelFormat(current, total) 
        : `${current} / ${total}`;
    }

    return percent;
  }

  /**
   * Devuelve una copia de `arr` con sus elementos en orden aleatorio
   * (Fisher-Yates). No muta el array recibido — a diferencia de una
   * versión encontrada en pairs.logic.ts, que sí lo hacía; ver nota
   * de migración en ese archivo.
   */
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Crea un administrador de limpieza (timers + listeners)
   */
  createCleanupManager(): CleanupManager {
    let controller = new AbortController();
    const intervals = new Set<number>();
    const timeouts = new Set<number>();

    return {
      addListener(target: EventTarget | null, type: string, handler: EventListener, options: AddEventListenerOptions = {}) {
        if (!target) return;
        target.addEventListener(type, handler, { 
          ...options, 
          signal: controller.signal 
        });
      },

      addInterval(fn: () => void, ms: number): number {
        const id = window.setInterval(fn, ms);
        intervals.add(id);
        return id;
      },

      addTimeout(fn: () => void, ms: number): number {
        const id = window.setTimeout(() => {
          timeouts.delete(id);
          fn();
        }, ms);
        timeouts.add(id);
        return id;
      },

      cleanup() {
        controller.abort();
        controller = new AbortController();

        intervals.forEach(id => window.clearInterval(id));
        intervals.clear();

        timeouts.forEach(id => window.clearTimeout(id));
        timeouts.clear();
      }
    };
  }
}

// Instancia única exportada
const GameHelpers = new GameHelpersClass();

export default GameHelpers;

// Compatibilidad con código legacy (window.GameHelpers)
window.GameHelpers = GameHelpers;