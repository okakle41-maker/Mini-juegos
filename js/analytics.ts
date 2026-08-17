/**
 * User Analytics with Consent Management
 * Sistema de analytics respetuoso de la privacidad con gestión de consentimiento
 */

import { devLog } from './core/devLog.js';
import safeStorage from './core/safeStorage.js';

interface ConsentSettings {
  analytics: boolean;
  performance: boolean;
  errors: boolean;
  preferences: boolean;
}

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  nonInteraction?: boolean;
  customDimensions?: Record<string, string>;
}

class AnalyticsManager {
  private consent: ConsentSettings;
  private consentVersion: string = '1.0';
  private initialized: boolean = false;
  private userId: string | null = null;
  private sessionId: string;

  constructor() {
    this.consent = this.loadConsent();
    this.sessionId = this.generateSessionId();
    this.initialize();
  }

  private generateSessionId(): string {
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    const suffix = random.toString(36).padStart(9, '0').slice(0, 9);
    return `${Date.now()}-${suffix}`;
  }

  private loadConsent(): ConsentSettings {
    const saved = safeStorage.getJSON<{ version: string; settings: ConsentSettings } | null>(
      'analytics-consent',
      null
    );
    if (saved && saved.version === this.consentVersion) {
      return saved.settings;
    }

    // Default consent (all false - opt-in)
    return {
      analytics: false,
      performance: false,
      errors: false,
      preferences: false
    };
  }

  private saveConsent(): void {
    // El consentimiento de privacidad es justo el dato donde un
    // localStorage.setItem() silenciosamente fallido es más grave que
    // en otros sistemas: el usuario cree que retiró/dio su
    // consentimiento y la UI lo refleja, pero si no persiste, la
    // próxima carga vuelve al estado anterior sin que nadie se entere.
    const ok = safeStorage.setJSON('analytics-consent', {
      version: this.consentVersion,
      settings: this.consent,
      timestamp: Date.now()
    });
    if (!ok) {
      devLog('[Analytics] No se pudo persistir el consentimiento (localStorage no disponible o cuota excedida)');
    }
  }

  private initialize(): void {
    if (this.consent.analytics) {
      this.initAnalytics();
    }

    if (this.consent.performance) {
      this.initPerformanceTracking();
    }

    if (this.consent.errors) {
      this.initErrorTracking();
    }

    this.initialized = true;
  }

  private initAnalytics(): void {
    // Initialize analytics provider (e.g., Google Analytics, Plausible, etc.)
    devLog('[Analytics] Analytics initialized');
    // Actual implementation would initialize the analytics SDK
  }

  private initPerformanceTracking(): void {
    // Initialize performance tracking
    devLog('[Analytics] Performance tracking initialized');
    // Hook into performance monitoring
  }

  private initErrorTracking(): void {
    // Initialize error tracking
    devLog('[Analytics] Error tracking initialized');
    // Hook into error tracker
  }

  setConsent(settings: Partial<ConsentSettings>): void {
    this.consent = { ...this.consent, ...settings };
    this.saveConsent();
    this.initialize();
    
    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('consent:changed', { detail: this.consent }));
  }

  getConsent(): ConsentSettings {
    return { ...this.consent };
  }

  hasConsent(type: keyof ConsentSettings): boolean {
    return this.consent[type];
  }

  resetConsent(): void {
    this.consent = {
      analytics: false,
      performance: false,
      errors: false,
      preferences: false
    };
    this.saveConsent();
    this.initialize();
  }

  setUserId(userId: string): void {
    if (!this.consent.analytics) return;
    
    this.userId = userId;
    devLog('[Analytics] User ID set:', userId);
    // Actual implementation would set user ID in analytics SDK
  }

  trackEvent(event: AnalyticsEvent): void {
    if (!this.consent.analytics) return;

    const eventData = {
      ...event,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    devLog('[Analytics] Event tracked:', eventData);
    // Actual implementation would send to analytics provider
  }

  trackPageView(page: string, title?: string): void {
    if (!this.consent.analytics) return;

    this.trackEvent({
      category: 'navigation',
      action: 'page_view',
      label: page,
      nonInteraction: true,
      customDimensions: {
        page_title: title || document.title
      }
    });
  }

  trackGameStart(gameId: string): void {
    if (!this.consent.analytics) return;

    this.trackEvent({
      category: 'game',
      action: 'start',
      label: gameId
    });
  }

  trackGameComplete(gameId: string, score: number, duration: number): void {
    if (!this.consent.analytics) return;

    this.trackEvent({
      category: 'game',
      action: 'complete',
      label: gameId,
      value: score,
      customDimensions: {
        duration: duration.toString()
      }
    });
  }

  trackGameAbort(gameId: string, duration: number): void {
    if (!this.consent.analytics) return;

    this.trackEvent({
      category: 'game',
      action: 'abort',
      label: gameId,
      customDimensions: {
        duration: duration.toString()
      }
    });
  }

  trackFeatureUse(feature: string): void {
    if (!this.consent.analytics) return;

    this.trackEvent({
      category: 'feature',
      action: 'use',
      label: feature
    });
  }

  trackError(error: Error, context?: Record<string, unknown>): void {
    if (!this.consent.errors) return;

    this.trackEvent({
      category: 'error',
      action: 'occurred',
      label: error.name,
      customDimensions: {
        message: error.message,
        stack: error.stack?.substring(0, 500) ?? '',
        ...context
      }
    });
  }

  trackPerformance(metric: string, value: number): void {
    if (!this.consent.performance) return;

    this.trackEvent({
      category: 'performance',
      action: 'metric',
      label: metric,
      value: Math.round(value)
    });
  }

  trackPreference(key: string, value: string): void {
    if (!this.consent.preferences) return;

    this.trackEvent({
      category: 'preference',
      action: 'change',
      label: key,
      customDimensions: {
        value
      }
    });
  }

  showConsentBanner(): void {
    // Check if consent has been given
    const hasGivenConsent = Object.values(this.consent).some(v => v === true);
    
    if (!hasGivenConsent) {
      this.dispatchConsentEvent('show-banner');
    }
  }

  private dispatchConsentEvent(type: string): void {
    window.dispatchEvent(new CustomEvent('consent:banner', { detail: { type } }));
  }

  exportData(): string {
    if (!this.consent.analytics) {
      throw new Error('Analytics consent not given');
    }

    return JSON.stringify({
      userId: this.userId,
      sessionId: this.sessionId,
      consent: this.consent,
      timestamp: Date.now()
    });
  }

  deleteData(): void {
    // Clear all locally stored analytics data
    safeStorage.remove('analytics-consent');
    safeStorage.remove('analytics-data');
    
    // Request deletion from analytics provider
    devLog('[Analytics] Data deletion requested');
    // Actual implementation would call analytics provider's deletion API
  }
}

// Singleton instance
export const analytics = new AnalyticsManager();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.analytics = analytics;
}

export default analytics;
