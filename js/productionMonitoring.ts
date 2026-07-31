/**
 * Production Monitoring Integration
 * Integración con Sentry o DataDog para monitoreo en producción
 */

interface MonitoringConfig {
  provider: 'sentry' | 'datadog' | 'custom';
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  beforeSend?: (event: any) => any;
}

class ProductionMonitoring {
  private config: MonitoringConfig | null = null;
  private initialized: boolean = false;
  private customSink?: (event: any) => void;

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
    console.log('[ProductionMonitoring] Sentry would be initialized here');
    console.log('[ProductionMonitoring] DSN:', this.config?.dsn);
    console.log('[ProductionMonitoring] Environment:', this.config?.environment);
    console.log('[ProductionMonitoring] Release:', this.config?.release);

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
    console.log('[ProductionMonitoring] Datadog RUM would be initialized here');
    console.log('[ProductionMonitoring] Application ID:', this.config?.dsn);
    console.log('[ProductionMonitoring] Environment:', this.config?.environment);

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
    console.log('[ProductionMonitoring] Custom monitoring sink configured');
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
      console.log('[ProductionMonitoring] Sentry: Exception captured', event);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.addError(error, context);
      console.log('[ProductionMonitoring] Datadog: Error captured', event);
    } else if (this.customSink) {
      this.customSink(event);
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>): void {
    if (!this.initialized) {
      console.log(`[ProductionMonitoring] [${level}] ${message}`, context);
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
      console.log('[ProductionMonitoring] Sentry: Message captured', event);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.addAction(message, context);
      console.log('[ProductionMonitoring] Datadog: Action captured', event);
    } else if (this.customSink) {
      this.customSink(event);
    }
  }

  setUser(user: { id?: string; email?: string; username?: string }): void {
    if (!this.initialized) return;

    if (this.config?.provider === 'sentry') {
      // Sentry.setUser(user);
      console.log('[ProductionMonitoring] Sentry: User set', user);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.setUser(user);
      console.log('[ProductionMonitoring] Datadog: User set', user);
    }
  }

  setTag(key: string, value: string): void {
    if (!this.initialized) return;

    if (this.config?.provider === 'sentry') {
      // Sentry.setTag(key, value);
      console.log('[ProductionMonitoring] Sentry: Tag set', key, value);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.setGlobalContextProperty(key, value);
      console.log('[ProductionMonitoring] Datadog: Global context set', key, value);
    }
  }

  startTransaction(name: string, op?: string): any {
    if (!this.initialized) return null;

    if (this.config?.provider === 'sentry') {
      // const transaction = Sentry.startTransaction({ name, op });
      console.log('[ProductionMonitoring] Sentry: Transaction started', name, op);
      // return transaction;
      return { name, op };
    } else if (this.config?.provider === 'datadog') {
      // const action = datadogRum.addAction(name, { op });
      console.log('[ProductionMonitoring] Datadog: Action started', name, op);
      // return action;
      return { name, op };
    }

    return null;
  }

  finishTransaction(transaction: any): void {
    if (!this.initialized || !transaction) return;

    if (this.config?.provider === 'sentry') {
      // transaction.finish();
      console.log('[ProductionMonitoring] Sentry: Transaction finished', transaction);
    } else if (this.config?.provider === 'datadog') {
      console.log('[ProductionMonitoring] Datadog: Action finished', transaction);
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
      console.log('[ProductionMonitoring] Sentry: Breadcrumb added', breadcrumb);
    } else if (this.config?.provider === 'datadog') {
      // datadogRum.addAction(category, { message, ...data });
      console.log('[ProductionMonitoring] Datadog: Action added', breadcrumb);
    }
  }

  isEnabled(): boolean {
    return this.initialized;
  }

  flush(): void {
    if (!this.initialized) return;

    console.log('[ProductionMonitoring] Flushing pending events');
    // Sentry.flush();
    // Datadog RUM doesn't have explicit flush
  }
}

// Singleton instance
export const productionMonitoring = new ProductionMonitoring();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).productionMonitoring = productionMonitoring;
}

export default productionMonitoring;
