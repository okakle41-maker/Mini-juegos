/**
 * Accessibility Utilities
 * Utilidades para mejorar la accesibilidad de la aplicación
 */

/**
 * Atrapa el foco dentro de un contenedor (modal, dropdown, etc.)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Verifica si el modo de reducción de movimiento está activado
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Crea un anuncio ARIA dinámico
 */
export class AriaAnnouncer {
  private element: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
    this.element.className = 'sr-only';
    this.element.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(this.element);
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.element.setAttribute('aria-live', priority);
    this.element.textContent = '';
    setTimeout(() => {
      this.element.textContent = message;
    }, 100);
  }

  destroy(): void {
    document.body.removeChild(this.element);
  }
}

// Singleton instance
export const ariaAnnouncer = new AriaAnnouncer();
