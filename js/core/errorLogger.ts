/**
 * errorLogger.ts — Sistema centralizado de logging de errores
 * Versión TypeScript con tipos fuertes
 */

export interface ErrorEntry {
  timestamp: string;
  context: string;
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
}

export interface ErrorLoggerInterface {
  log: (context: string, error: unknown, meta?: Record<string, unknown>) => void;
  setSink: (sink: (entry: ErrorEntry) => void) => void;
  recent: () => ErrorEntry[];
  clear: () => void;
}

class ErrorLogger implements ErrorLoggerInterface {
  private errors: ErrorEntry[] = [];
  private maxErrors = 50;
  private sink: ((entry: ErrorEntry) => void) | null = null;

  /**
   * Registra un error
   */
  log(context: string, error: unknown, meta: Record<string, unknown> = {}): void {
    const entry: ErrorEntry = {
      timestamp: new Date().toISOString(),
      context,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      meta
    };

    // Guardar en memoria (circular buffer)
    this.errors.push(entry);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Enviar a sink externo (console, servidor, etc.)
    if (this.sink) {
      try {
        this.sink(entry);
      } catch (e) {
        console.error('[ErrorLogger] Error en sink:', e);
      }
    }

    // Log en consola para desarrollo
    console.error(`[${context}]`, error, meta);
  }

  /**
   * Configura un sink personalizado (ej: enviar a servidor)
   */
  setSink(sinkFn: (entry: ErrorEntry) => void): void {
    this.sink = sinkFn;
  }

  /**
   * Retorna los errores más recientes
   */
  recent(): ErrorEntry[] {
    return [...this.errors];
  }

  /**
   * Limpia el historial de errores
   */
  clear(): void {
    this.errors = [];
  }
}

// Instancia única
const ErrorLoggerInstance = new ErrorLogger();

export default ErrorLoggerInstance;

// Compatibilidad legacy
window.ErrorLogger = ErrorLoggerInstance;