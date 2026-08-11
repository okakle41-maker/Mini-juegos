/**
 * Error Boundary & Global Error Handler
 * Sistema de manejo de errores global para la aplicación
 */

import { escapeHtml } from './security.js';
import { devLog } from './core/devLog.js';

class ErrorBoundary {
  private errorContainer: HTMLElement | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Error handler global
    window.addEventListener('error', this.handleGlobalError.bind(this));
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));

    // Crear contenedor de errores
    this.createErrorContainer();

    devLog('[ErrorBoundary] Inicializado');
  }

  private createErrorContainer(): void {
    this.errorContainer = document.createElement('div');
    this.errorContainer.id = 'error-boundary-container';
    this.errorContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(5, 8, 16, 0.95);
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(this.errorContainer);
  }

  private handleGlobalError(event: ErrorEvent): void {
    console.error('[ErrorBoundary] Error global capturado:', event.error);
    
    // No mostrar errores de extensiones del navegador
    if (event.filename && event.filename.includes('extension')) {
      return;
    }

    this.showError({
      message: event.message || 'Error desconocido',
      stack: event.error?.stack,
      source: event.filename,
      line: event.lineno,
      column: event.colno
    });
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    console.error('[ErrorBoundary] Promise rejection no manejada:', event.reason);
    
    this.showError({
      message: event.reason?.message || 'Error en operación asíncrona',
      stack: event.reason?.stack,
      source: 'Promise'
    });
  }

  private showError(error: {
    message: string;
    stack?: string;
    source?: string;
    line?: number;
    column?: number;
  }): void {
    if (!this.errorContainer) return;

    const errorId = Date.now();
    const errorHTML = `
      <div class="error-boundary-modal" style="
        background: rgba(20, 25, 40, 0.98);
        border: 1px solid rgba(220, 38, 38, 0.5);
        border-left: 4px solid #dc2626;
        border-radius: 12px;
        padding: 32px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        animation: errorSlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      ">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
          <div style="
            width: 48px;
            height: 48px;
            background: rgba(220, 38, 38, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">⚠️</div>
          <div>
            <h2 style="color: #fca5a5; font-size: 18px; font-weight: 600; margin: 0;">Error de Aplicación</h2>
            <p style="color: rgba(255, 235, 221, 0.7); font-size: 13px; margin: 4px 0 0;">Ha ocurrido un error inesperado</p>
          </div>
        </div>
        
        <div style="
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          font-family: ui-monospace, monospace;
          font-size: 12px;
          color: #fca5a5;
          max-height: 150px;
          overflow-y: auto;
        ">
          <div style="font-weight: 600; margin-bottom: 8px;">${escapeHtml(error.message)}</div>
          ${error.source ? `<div style="color: rgba(255, 235, 221, 0.6); margin-bottom: 4px;">📍 ${escapeHtml(error.source)}${error.line ? `:${error.line}` : ''}</div>` : ''}
          ${error.stack ? `<div style="color: rgba(255, 235, 221, 0.5); white-space: pre-wrap; margin-top: 8px;">${escapeHtml(error.stack)}</div>` : ''}
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button onclick="window.location.reload()" style="
            background: rgba(220, 38, 38, 0.2);
            border: 1px solid rgba(220, 38, 38, 0.5);
            color: #fca5a5;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s ease;
          " onmouseover="this.style.background='rgba(220, 38, 38, 0.3)'" onmouseout="this.style.background='rgba(220, 38, 38, 0.2)'">
            Recargar Página
          </button>
          <button onclick="document.getElementById('error-boundary-${errorId}').remove()" style="
            background: rgba(249, 115, 22, 0.2);
            border: 1px solid rgba(249, 115, 22, 0.5);
            color: #ffeedd;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s ease;
          " onmouseover="this.style.background='rgba(249, 115, 22, 0.3)'" onmouseout="this.style.background='rgba(249, 115, 22, 0.2)'">
            Cerrar
          </button>
        </div>
      </div>
      
      <style>
        @keyframes errorSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      </style>
    `;

    this.errorContainer.innerHTML = errorHTML;
    this.errorContainer.style.display = 'flex';
  }

  hideError(): void {
    if (this.errorContainer) {
      this.errorContainer.style.display = 'none';
      this.errorContainer.innerHTML = '';
    }
  }

  // Método para envolver funciones con manejo de errores
  //
  // Nota sobre `any` en el retorno del constraint: acotarlo a `unknown`
  // rompe la inferencia de `ReturnType<T>` (limitación conocida de
  // TypeScript con constraints genéricos de funciones, ver performance.ts
  // para el mismo patrón documentado). Los args sí están en `unknown[]`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver nota arriba
  wrap<T extends (...args: unknown[]) => any>(fn: T, context?: string): T {
    return ((...args: unknown[]) => {
      try {
        return fn(...args);
      } catch (error) {
        console.error(`[ErrorBoundary] Error en ${context || 'función anónima'}:`, error);
        this.showError({
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          source: context
        });
        throw error;
      }
    }) as T;
  }

  // Método para envolver funciones asíncronas con manejo de errores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver nota en wrap()
  wrapAsync<T extends (...args: unknown[]) => Promise<any>>(fn: T, context?: string): T {
    return (async (...args: unknown[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        console.error(`[ErrorBoundary] Error async en ${context || 'función anónima'}:`, error);
        this.showError({
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          source: context
        });
        throw error;
      }
    }) as T;
  }
}

// Singleton instance
export const errorBoundary = new ErrorBoundary();

// Función helper para usar en componentes
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver nota en wrap()
export function withErrorHandling<T extends (...args: unknown[]) => any>(
  fn: T,
  context?: string
): T {
  return errorBoundary.wrap(fn, context);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver nota en wrap()
export function withAsyncErrorHandling<T extends (...args: unknown[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return errorBoundary.wrapAsync(fn, context);
}

export default errorBoundary;
