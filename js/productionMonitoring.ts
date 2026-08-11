/**
 * Production Monitoring Integration
 * Integración con Sentry o DataDog para monitoreo en producción
 */

import { devLog } from './core/devLog.js';

interface MonitoringConfig {
  provider: 'sentry' | 'datadog' | 'custom';
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  beforeSend?: (event: Record<string, unknown>) => Record<string, unknown>;
}

class ProductionMonitoring {
  private config: MonitoringConfig | null = null;
  private initialized: boolean = false;
  private customSink?: (event: Record<string, unknown>) => void;

  configure(config: MonitoringConfig): void {
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    if (!this.config || this.initialized) return;

    switch (this.config.provider) {
      case 'sentry':
        this.initializeSentry();
        break;
      case 'datadog':
        this.initializeDatadog();
        break;
      case 'custom':
        this.initializeCustom();
        break;
    }

    this.initialized = true;
  }

  private initializeSentry(): void {
    // Sentry would be loaded via CDN or npm
    // This is a placeholder for the actual Sentry initialization
    devLog('[ProductionMonitoring] Sentry would be initialized here');
    devLog('[ProductionMonitoring] DSN:', this.config?.dsn);
    devLog('[ProductionMonitoring] Environment:', this.config?.environment);
    devLog('[ProductionMonitoring] Release:', this.config?.release);

    // Actual Sentry initialization would look like:
    // Sentry.init({
    //   dsn: this.config.dsn,
    //   environment: this.config.environment,
    //   release: this.config.release,
    //   sampleRate: this.config.sampleRate,
    //   tracesSampleRate: this.config.tracesSampleRate,
    //   beforeSend: this.config.beforeSend
    // });
  }

  private initializeDatadog(): void {
    // Datadog RUM would be loaded via CDN
    devLog('[ProductionMonitoring] Datadog RUM would be initialized here');
    devLog('[ProductionMonitoring] Application ID:', this.config?.dsn);
    devLog('[ProductionMonitoring] Environment:', this.config?.environment);

    // Actual Datadog initialization would look like:
    // datadogRum.init({
    //   applicationId: this.config.dsn,
    //   clientToken: 'YOUR_CLIENT_TOKEN',
    //   site: 'datadoghq.com',
    //   service: 'minijuegos',
    //   env: this.config.environment,
    //   version: this.config.release,
    //   sessionSampleRate: this.config.sampleRate,
    //   sessionReplaySampleRate: this.config.tracesSampleRate
    // });
  }

  private initializeCustom(): void {
    devLog('[ProductionMonitoring] Custom monitoring sink configured');
    this.customSink = this.config?.beforeSend;
  }

  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.initialized) {
      console.error('[ProductionMonitoring] Not initialized, error:', error);
      return;
    }

    const event = {
      error,
      context,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    if (this.config?.provider === 'sentry') {
      // Sentry.captureException(error, { extra: context });
      devLog('[ProductionMonitoring] Sentry: Exception captured', event);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.addError(error, context);
      devLog('[ProductionMonitoring] Datadog: Error captured', event);
    } else if (this.customSink) {
      this.customSink(event);
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>): void {
    if (!this.initialized) {
      devLog(`[ProductionMonitoring] [${level}] ${message}`, context);
      return;
    }

    const event = {
      message,
      level,
      context,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    if (this.config?.provider === 'sentry') {
      // Sentry.captureMessage(message, { level, extra: context });
      devLog('[ProductionMonitoring] Sentry: Message captured', event);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.addAction(message, context);
      devLog('[ProductionMonitoring] Datadog: Action captured', event);
    } else if (this.customSink) {
      this.customSink(event);
    }
  }

  setUser(user: { id?: string; email?: string; username?: string }): void {
    if (!this.initialized) return;

    if (this.config?.provider === 'sentry') {
      // Sentry.setUser(user);
      devLog('[ProductionMonitoring] Sentry: User set', user);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.setUser(user);
      devLog('[ProductionMonitoring] Datadog: User set', user);
    }
  }

  setTag(key: string, value: string): void {
    if (!this.initialized) return;

    if (this.config?.provider === 'sentry') {
      // Sentry.setTag(key, value);
      devLog('[ProductionMonitoring] Sentry: Tag set', key, value);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.setGlobalContextProperty(key, value);
      devLog('[ProductionMonitoring] Datadog: Global context set', key, value);
    }
  }

  startTransaction(name: string, op?: string): { name: string; op?: string } | null {
    if (!this.initialized) return null;

    if (this.config?.provider === 'sentry') {
      // const transaction = Sentry.startTransaction({ name, op });
      devLog('[ProductionMonitoring] Sentry: Transaction started', name, op);
      // return transaction;
      return { name, op };
    } else if (this.config?.provider === 'datadog') {
      // const action = datadogRum.addAction(name, { op });
      devLog('[ProductionMonitoring] Datadog: Action started', name, op);
      // return action;
      return { name, op };
    }

    return null;
  }

  finishTransaction(transaction: { name: string; op?: string } | null): void {
    if (!this.initialized || !transaction) return;

    if (this.config?.provider === 'sentry') {
      // transaction.finish();
      devLog('[ProductionMonitoring] Sentry: Transaction finished', transaction);
    } else if (this.config?.provider === 'datadog') {
      devLog('[ProductionMonitoring] Datadog: Action finished', transaction);
    }
  }

  addBreadcrumb(category: string, message: string, data?: Record<string, any>): void {
    if (!this.initialized) return;

    const breadcrumb = {
      category,
      message,
      data,
      timestamp: Date.now()
    };

    if (this.config?.provider === 'sentry') {
      // Sentry.addBreadcrumb(breadcrumb);
      devLog('[ProductionMonitoring] Sentry: Breadcrumb added', breadcrumb);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.addAction(category, { message, ...data });
      devLog('[ProductionMonitoring] Datadog: Action added', breadcrumb);
    }
  }

  isEnabled(): boolean {
    return this.initialized;
  }

  flush(): void {
    if (!this.initialized) return;

    devLog('[ProductionMonitoring] Flushing pending events');
    // Sentry.flush();
    // Datadog RUM doesn't have explicit flush
  }
}

// Singleton instance
export const productionMonitoring = new ProductionMonitoring();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.productionMonitoring = productionMonitoring;
}

export default productionMonitoring;
