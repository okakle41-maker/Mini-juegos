/**
 * Game-Specific Performance Optimizations
 * Optimizaciones específicas para juegos con animaciones o cálculos pesados
 */

import { rafThrottle, memoize, getAnimationQuality } from './performance.js';

function prefersReducedMotion(): boolean {
  // jsdom (entorno de test) no implementa matchMedia por defecto, y
  // algunos navegadores/webviews viejos tampoco lo tienen — antes este
  // módulo nunca se ejecutaba en tests porque no tenía consumidores,
  // así que este caso no estaba cubierto. Sin matchMedia asumimos que
  // no hay preferencia de reduced-motion en vez de reventar.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Optimizador de animaciones para juegos con muchos elementos visuales
 */
export class AnimationOptimizer {
  private reducedMotion: boolean;
  private animationQuality: 'high' | 'medium' | 'low';
  private activeAnimations: Set<number> = new Set();
  private maxAnimations: number;

  constructor() {
    this.reducedMotion = prefersReducedMotion();
    this.animationQuality = getAnimationQuality();
    this.maxAnimations = this.getMaxAnimations();
  }

  private getMaxAnimations(): number {
    if (this.reducedMotion) return 0;
    switch (this.animationQuality) {
      case 'high': return 50;
      case 'medium': return 20;
      case 'low': return 5;
    }
  }

  shouldAnimate(): boolean {
    if (this.reducedMotion) return false;
    if (this.activeAnimations.size >= this.maxAnimations) return false;
    return true;
  }

  registerAnimation(id: number): void {
    this.activeAnimations.add(id);
  }

  unregisterAnimation(id: number): void {
    this.activeAnimations.delete(id);
  }

  getAnimationDuration(baseDuration: number): number {
    if (this.reducedMotion) return 0;
    switch (this.animationQuality) {
      case 'high': return baseDuration;
      case 'medium': return baseDuration * 0.7;
      case 'low': return baseDuration * 0.4;
    }
  }

  getAnimationFrameRate(): number {
    switch (this.animationQuality) {
      case 'high': return 60;
      case 'medium': return 30;
      case 'low': return 15;
    }
  }
}

/**
 * Optimizador de cálculos para juegos de lógica
 */
export class CalculationOptimizer {
  private cache: Map<string, any> = new Map();
  private maxCacheSize: number = 100;

  memoize<T>(key: string, calculation: () => T): T {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const result = calculation();
    this.cache.set(key, result);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Optimiza cálculos de grid para juegos de memoria
   */
  optimizeGridCalculation<T>(
    gridSize: number,
    calculation: (x: number, y: number) => T
  ): T[][] {
    const result: T[][] = [];
    
    for (let y = 0; y < gridSize; y++) {
      const row: T[] = [];
      for (let x = 0; x < gridSize; x++) {
        const key = `grid-${gridSize}-${x}-${y}`;
        row.push(this.memoize(key, () => calculation(x, y)));
      }
      result.push(row);
    }

    return result;
  }
}

/**
 * Optimizador de renderizado para juegos con muchos elementos DOM
 */
export class RenderOptimizer {
  private pendingUpdates: Set<HTMLElement> = new Set();
  private scheduled: boolean = false;

  scheduleUpdate(element: HTMLElement): void {
    this.pendingUpdates.add(element);

    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  private flush(): void {
    this.pendingUpdates.forEach(element => {
      // Trigger reflow/repaint
      element.offsetHeight;
    });

    this.pendingUpdates.clear();
    this.scheduled = false;
  }

  /**
   * Optimiza actualizaciones de múltiples elementos
   */
  batchUpdate(elements: HTMLElement[], updateFn: (el: HTMLElement) => void): void {
    elements.forEach(el => this.scheduleUpdate(el));
    
    requestAnimationFrame(() => {
      elements.forEach(updateFn);
      this.flush();
    });
  }
}

/**
 * Optimizador de eventos para juegos con muchos event listeners
 */
export class EventOptimizer {
  private eventDelegators: Map<string, (e: Event) => void> = new Map();

  /**
   * Usa event delegation en lugar de múltiples listeners
   */
  delegateEvents(
    container: HTMLElement,
    eventType: string,
    selector: string,
    handler: (e: Event, target: HTMLElement) => void
  ): void {
    const key = `${eventType}-${selector}`;

    if (this.eventDelegators.has(key)) {
      return; // Ya existe delegador
    }

    const delegator = (e: Event) => {
      const target = (e.target as HTMLElement).closest(selector) as HTMLElement;
      if (target && container.contains(target)) {
        handler(e, target);
      }
    };

    container.addEventListener(eventType, delegator);
    this.eventDelegators.set(key, delegator);
  }

  removeDelegation(container: HTMLElement, eventType: string, selector: string): void {
    const key = `${eventType}-${selector}`;
    const delegator = this.eventDelegators.get(key);

    if (delegator) {
      container.removeEventListener(eventType, delegator);
      this.eventDelegators.delete(key);
    }
  }

  clearAllDelegations(container: HTMLElement): void {
    this.eventDelegators.forEach((delegator, key) => {
      const [eventType] = key.split('-');
      container.removeEventListener(eventType, delegator);
    });

    this.eventDelegators.clear();
  }
}

/**
 * Optimizador de memoria para juegos con muchos objetos
 */
export class MemoryOptimizer {
  private objectPool: Map<string, any[]> = new Map();
  private maxPoolSize: number = 50;

  /**
   * Object pooling para reutilizar objetos en lugar de crear nuevos
   */
  getFromPool<T>(type: string, factory: () => T): T {
    if (!this.objectPool.has(type)) {
      this.objectPool.set(type, []);
    }

    const pool = this.objectPool.get(type)!;

    if (pool.length > 0) {
      return pool.pop()!;
    }

    return factory();
  }

  returnToPool<T>(type: string, object: T): void {
    if (!this.objectPool.has(type)) {
      this.objectPool.set(type, []);
    }

    const pool = this.objectPool.get(type)!;

    if (pool.length < this.maxPoolSize) {
      pool.push(object);
    }
  }

  clearPool(type: string): void {
    this.objectPool.delete(type);
  }

  clearAllPools(): void {
    this.objectPool.clear();
  }
}

/**
 * Optimizador de secuencias para juegos de ritmo
 */
export class SequenceOptimizer {
  private sequenceCache: Map<string, any[]> = new Map();

  /**
   * Cachea secuencias generadas para evitar recálculo
   */
  getCachedSequence(key: string, generator: () => any[]): any[] {
    if (this.sequenceCache.has(key)) {
      return this.sequenceCache.get(key)!;
    }

    const sequence = generator();
    this.sequenceCache.set(key, sequence);
    return sequence;
  }

  clearCache(): void {
    this.sequenceCache.clear();
  }

  /**
   * Genera secuencia optimizada con precomputación
   */
  generateOptimizedSequence(
    length: number,
    options: { min?: number; max?: number; unique?: boolean }
  ): number[] {
    const { min = 1, max = 100, unique = true } = options;
    const cacheKey = `seq-${length}-${min}-${max}-${unique}`;

    return this.getCachedSequence(cacheKey, () => {
      const sequence: number[] = [];
      const used = new Set<number>();

      while (sequence.length < length) {
        const value = Math.floor(Math.random() * (max - min + 1)) + min;

        if (unique && used.has(value)) {
          continue;
        }

        if (unique) {
          used.add(value);
        }

        sequence.push(value);
      }

      return sequence;
    });
  }
}

/**
 * Optimizador de timing para juegos con temporizadores
 */
export class TimingOptimizer {
  private timers: Map<number, { interval: number; lastRun: number }> = new Map();
  private nextId: number = 0;

  /**
   * Temporizador optimizado que respeta preferencias de reducción de movimiento
   */
  setOptimizedInterval(
    callback: () => void,
    delay: number,
    options?: { respectReducedMotion?: boolean }
  ): number {
    if (options?.respectReducedMotion && prefersReducedMotion()) {
      return this.setThrottledInterval(callback, delay * 2);
    }

    return this.setThrottledInterval(callback, delay);
  }

  private setThrottledInterval(callback: () => void, delay: number): number {
    const id = this.nextId++;
    const now = Date.now();

    this.timers.set(id, {
      interval: delay,
      lastRun: now
    });

    const run = () => {
      const timer = this.timers.get(id);
      if (!timer) return;

      const now = Date.now();
      if (now - timer.lastRun >= timer.interval) {
        callback();
        timer.lastRun = now;
      }

      requestAnimationFrame(run);
    };

    requestAnimationFrame(run);
    return id;
  }

  clearOptimizedInterval(id: number): void {
    this.timers.delete(id);
  }

  clearAllIntervals(): void {
    this.timers.clear();
  }
}

// Singleton instances
export const animationOptimizer = new AnimationOptimizer();
export const calculationOptimizer = new CalculationOptimizer();
export const renderOptimizer = new RenderOptimizer();
export const eventOptimizer = new EventOptimizer();
export const memoryOptimizer = new MemoryOptimizer();
export const sequenceOptimizer = new SequenceOptimizer();
export const timingOptimizer = new TimingOptimizer();
