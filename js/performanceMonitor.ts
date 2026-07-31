/**
 * Performance Monitor - Core Web Vitals
 * Monitorea y reporta métricas de rendimiento críticas
 */

interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface PerformanceReport {
  metrics: Metric[];
  url: string;
  userAgent: string;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: Metric[] = [];
  private observer: PerformanceObserver | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      console.warn('[PerformanceMonitor] PerformanceObserver not supported');
      return;
    }

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processEntry(entry);
        }
      });

      // Monitorear Core Web Vitals
      this.observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observer.observe({ type: 'first-input-delay', buffered: true });
      this.observer.observe({ type: 'layout-shift', buffered: true });
      this.observer.observe({ type: 'paint', buffered: true });
      this.observer.observe({ type: 'navigation', buffered: true });
    } catch (error) {
      console.error('[PerformanceMonitor] Error initializing PerformanceObserver:', error);
    }
  }

  private processEntry(entry: PerformanceEntry): void {
    let metric: Metric | null = null;

    switch (entry.entryType) {
      case 'largest-contentful-paint':
        metric = this.processLCP(entry as any);
        break;
      case 'first-input-delay':
        metric = this.processFID(entry as any);
        break;
      case 'layout-shift':
        metric = this.processCLS(entry as any);
        break;
      case 'paint':
        metric = this.processPaint(entry as any);
        break;
      case 'navigation':
        metric = this.processNavigation(entry as any);
        break;
    }

    if (metric) {
      this.metrics.push(metric);
      this.logMetric(metric);
    }
  }

  private processLCP(entry: any): Metric {
    const value = entry.renderTime || entry.loadTime;
    const rating = this.getLCPRating(value);
    return {
      name: 'LCP',
      value: Math.round(value),
      rating,
      timestamp: Date.now()
    };
  }

  private processFID(entry: any): Metric {
    const value = entry.processingStart - entry.startTime;
    const rating = this.getFIDRating(value);
    return {
      name: 'FID',
      value: Math.round(value),
      rating,
      timestamp: Date.now()
    };
  }

  private processCLS(entry: any): Metric {
    if (!entry.hadRecentInput) {
      const value = entry.value;
      const rating = this.getCLSRating(value);
      return {
        name: 'CLS',
        value: Math.round(value * 1000) / 1000,
        rating,
        timestamp: Date.now()
      };
    }
    return null as any;
  }

  private processPaint(entry: any): Metric {
    const rating = 'good';
    return {
      name: entry.name.toUpperCase(),
      value: Math.round(entry.startTime),
      rating,
      timestamp: Date.now()
    };
  }

  private processNavigation(entry: any): Metric {
    const metrics = [
      { name: 'TTFB', value: entry.responseStart - entry.requestStart },
      { name: 'DOM Content Loaded', value: entry.domContentLoadedEventEnd },
      { name: 'Load Complete', value: entry.loadEventEnd }
    ];

    metrics.forEach(m => {
      this.metrics.push({
        name: m.name,
        value: Math.round(m.value),
        rating: 'good',
        timestamp: Date.now()
      });
    });

    return null as any;
  }

  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  private getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  private logMetric(metric: Metric): void {
    const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
    console.log(`[PerformanceMonitor] ${emoji} ${metric.name}: ${metric.value}ms (${metric.rating})`);
  }

  public getMetrics(): Metric[] {
    return [...this.metrics];
  }

  public getReport(): PerformanceReport {
    return {
      metrics: this.getMetrics(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };
  }

  public getCoreWebVitals(): { lcp: Metric | null; fid: Metric | null; cls: Metric | null } {
    return {
      lcp: this.metrics.find(m => m.name === 'LCP') || null,
      fid: this.metrics.find(m => m.name === 'FID') || null,
      cls: this.metrics.find(m => m.name === 'CLS') || null
    };
  }

  public exportReport(): string {
    const report = this.getReport();
    return JSON.stringify(report, null, 2);
  }

  public clear(): void {
    this.metrics = [];
  }

  public disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Exponer en window para debugging en consola
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
  (window as any).getWebVitals = () => performanceMonitor.getCoreWebVitals();
  (window as any).exportPerformanceReport = () => performanceMonitor.exportReport();
}

export default performanceMonitor;
