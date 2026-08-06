/**
 * Performance Optimization Utilities
 * Memoización, debounce, throttle, y otras optimizaciones de rendimiento
 */

/**
 * Memoiza una función pura para cachear resultados
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Memoiza una función asíncrona
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, Promise<ReturnType<T>>>();

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const promise = fn(...args);
    cache.set(key, promise);
    return promise;
  }) as T;
}

/**
 * Debounce - retrasa la ejecución de una función
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = window.setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Debounce asíncrono
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: number | null = null;
  let lastPromise: Promise<ReturnType<T>> | null = null;

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    return new Promise((resolve) => {
      timeoutId = window.setTimeout(async () => {
        lastPromise = fn(...args);
        resolve(await lastPromise);
        timeoutId = null;
      }, delay);
    });
  };
}

/**
 * Throttle - limita la frecuencia de ejecución de una función
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastResult: ReturnType<T>;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      lastResult = fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
}

/**
 * Throttle asíncrono
 */
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let inThrottle = false;
  let lastPromise: Promise<ReturnType<T>> | null = null;

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!inThrottle) {
      inThrottle = true;
      lastPromise = fn(...args);
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastPromise || fn(...args);
  };
}

/**
 * RequestAnimationFrame throttle para animaciones
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return (...args: Parameters<T>) => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;
    });
  };
}

/**
 * Lazy load de recursos pesados
 */
export function lazyLoad<T>(
  loader: () => Promise<T>,
  fallback?: T
): () => Promise<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;

  return () => {
    if (cached) {
      return Promise.resolve(cached);
    }
    
    if (loading) {
      return loading;
    }
    
    loading = loader()
      .then(result => {
        cached = result;
        loading = null;
        return result;
      })
      .catch(error => {
        loading = null;
        if (fallback !== undefined) {
          return fallback;
        }
        throw error;
      });
    
    return loading;
  };
}

/**
 * Virtual scrolling básico para listas largas
 */
export class VirtualScroller<T> {
  private items: T[];
  private itemHeight: number;
  private containerHeight: number;
  private scrollTop: number = 0;
  private visibleRange: { start: number; end: number } = { start: 0, end: 0 };

  constructor(items: T[], itemHeight: number, containerHeight: number) {
    this.items = items;
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
  }

  setScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop;
    this.updateVisibleRange();
  }

  private updateVisibleRange(): void {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(start + visibleCount + 2, this.items.length); // +2 para buffer

    this.visibleRange = { start: Math.max(0, start - 1), end };
  }

  getVisibleItems(): { items: T[]; offsetY: number } {
    const { start, end } = this.visibleRange;
    const visibleItems = this.items.slice(start, end);
    const offsetY = start * this.itemHeight;

    return { items: visibleItems, offsetY };
  }

  getTotalHeight(): number {
    return this.items.length * this.itemHeight;
  }

  updateItems(items: T[]): void {
    this.items = items;
    this.updateVisibleRange();
  }
}

/**
 * Cache LRU (Least Recently Used)
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  set(key: K, value: V): void {
    // Delete if exists to move to end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Batch DOM updates para minimizar reflows
 */
export class DOMBatcher {
  private updates: Array<() => void> = [];
  private scheduled: boolean = false;

  schedule(update: () => void): void {
    this.updates.push(update);
    
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  private flush(): void {
    const updates = this.updates;
    this.updates = [];
    this.scheduled = false;
    
    // Ejecutar todas las updates en un solo frame
    updates.forEach(update => update());
  }

  forceFlush(): void {
    this.flush();
  }
}

/**
 * Mide el tiempo de ejecución de una función
 */
export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
    
    return result;
  }) as T;
}

/**
 * Mide el tiempo de ejecución de una función asíncrona
 */
export async function measurePerformanceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  label: string,
  ...args: Parameters<T>
): Promise<ReturnType<T>> {
  const start = performance.now();
  const result = await fn(...args);
  const end = performance.now();
  
  console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
  
  return result;
}

/**
 * Detecta si el dispositivo es de baja potencia
 */
export function isLowEndDevice(): boolean {
  return (
    navigator.hardwareConcurrency <= 2 ||
    (navigator as any).deviceMemory <= 2 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

/**
 * Ajusta la calidad de animaciones según el dispositivo
 */
export function getAnimationQuality(): 'high' | 'medium' | 'low' {
  if (isLowEndDevice()) {
    return 'low';
  }
  
  if (prefersReducedMotion()) {
    return 'low';
  }
  
  return 'high';
}

/**
 * Verifica si el usuario prefiere reducción de movimiento
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Batch updates de estado para minimizar renders
 */
export class StateBatcher<T> {
  private state: T;
  private listeners: Set<(state: T) => void> = new Set();
  private pendingUpdates: Partial<T> = {};
  private scheduled: boolean = false;

  constructor(initialState: T) {
    this.state = initialState;
  }

  getState(): T {
    return { ...this.state };
  }

  setState(updates: Partial<T>): void {
    Object.assign(this.pendingUpdates, updates);
    
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  private flush(): void {
    if (Object.keys(this.pendingUpdates).length === 0) {
      this.scheduled = false;
      return;
    }
    
    this.state = { ...this.state, ...this.pendingUpdates };
    this.pendingUpdates = {};
    this.scheduled = false;
    
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  forceFlush(): void {
    this.flush();
  }
}

// Singleton instances
export const domBatcher = new DOMBatcher();
