/**
 * Accessibility Utilities
 * Utilidades para mejorar la accesibilidad de la aplicación
 */

/**
 * Actualiza el atributo aria-live de un elemento
 */
export function announceToScreenReader(element: HTMLElement, message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const liveRegion = element || document.createElement('div');
  
  if (!element) {
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
  }
  
  liveRegion.textContent = message;
  
  // Limpiar después de un delay
  setTimeout(() => {
    if (!element) {
      document.body.removeChild(liveRegion);
    } else {
      liveRegion.textContent = '';
    }
  }, 1000);
}

/**
 * Agrega un landmark ARIA a un elemento
 */
export function setLandmark(element: HTMLElement, role: 'banner' | 'navigation' | 'main' | 'complementary' | 'contentinfo' | 'search' | 'form'): void {
  element.setAttribute('role', role);
}

/**
 * Agrega una etiqueta ARIA a un elemento
 */
export function setAriaLabel(element: HTMLElement, label: string): void {
  element.setAttribute('aria-label', label);
}

/**
 * Conecta un elemento con su etiqueta mediante aria-labelledby
 */
export function setAriaLabelledBy(element: HTMLElement, labelId: string): void {
  element.setAttribute('aria-labelledby', labelId);
}

/**
 * Conecta un elemento con su descripción mediante aria-describedby
 */
export function setAriaDescribedBy(element: HTMLElement, descriptionId: string): void {
  element.setAttribute('aria-describedby', descriptionId);
}

/**
 * Establece el estado expandido/colapsado de un elemento
 */
export function setAriaExpanded(element: HTMLElement, expanded: boolean): void {
  element.setAttribute('aria-expanded', String(expanded));
}

/**
 * Establece el estado presionado de un elemento
 */
export function setAriaPressed(element: HTMLElement, pressed: boolean): void {
  element.setAttribute('aria-pressed', String(pressed));
}

/**
 * Establece el estado seleccionado de un elemento
 */
export function setAriaSelected(element: HTMLElement, selected: boolean): void {
  element.setAttribute('aria-selected', String(selected));
}

/**
 * Establece el estado oculto de un elemento
 */
export function setAriaHidden(element: HTMLElement, hidden: boolean): void {
  element.setAttribute('aria-hidden', String(hidden));
}

/**
 * Establece el estado deshabilitado de un elemento
 */
export function setAriaDisabled(element: HTMLElement, disabled: boolean): void {
  element.setAttribute('aria-disabled', String(disabled));
}

/**
 * Establece el estado invalid de un elemento
 */
export function setAriaInvalid(element: HTMLElement, invalid: boolean, message?: string): void {
  element.setAttribute('aria-invalid', String(invalid));
  if (message && invalid) {
    const errorId = `${element.id}-error`;
    let errorElement = document.getElementById(errorId);
    
    if (!errorElement) {
      errorElement = document.createElement('span');
      errorElement.id = errorId;
      errorElement.setAttribute('role', 'alert');
      errorElement.className = 'error-message';
      element.parentNode?.insertBefore(errorElement, element.nextSibling);
    }
    
    errorElement.textContent = message;
    setAriaDescribedBy(element, errorId);
  }
}

/**
 * Establece el valor actual de un elemento (range, slider, etc.)
 */
export function setAriaValueNow(element: HTMLElement, value: number): void {
  element.setAttribute('aria-valuenow', String(value));
}

/**
 * Establece el valor mínimo de un elemento
 */
export function setAriaValueMin(element: HTMLElement, min: number): void {
  element.setAttribute('aria-valuemin', String(min));
}

/**
 * Establece el valor máximo de un elemento
 */
export function setAriaValueMax(element: HTMLElement, max: number): void {
  element.setAttribute('aria-valuemax', String(max));
}

/**
 * Establece el texto del valor de un elemento
 */
export function setAriaValueText(element: HTMLElement, text: string): void {
  element.setAttribute('aria-valuetext', text);
}

/**
 * Establece el nivel de encabezado
 */
export function setHeadingLevel(element: HTMLElement, level: 1 | 2 | 3 | 4 | 5 | 6): void {
  element.setAttribute('role', 'heading');
  element.setAttribute('aria-level', String(level));
}

/**
 * Crea un skip link para navegación por teclado
 */
export function createSkipLink(targetId: string, text: string = 'Saltar al contenido principal'): HTMLElement {
  const link = document.createElement('a');
  link.href = `#${targetId}`;
  link.textContent = text;
  link.className = 'skip-link';
  link.setAttribute('aria-label', text);
  
  return link;
}

/**
 * Maneja el foco en un elemento con scroll suave
 */
export function focusWithScroll(element: HTMLElement): void {
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

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
 * Restaura el foco a un elemento previo
 */
export function restoreFocus(previousElement: HTMLElement): void {
  previousElement?.focus();
}

/**
 * Verifica si el modo de reducción de movimiento está activado
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Verifica si el modo de alto contraste está activado
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Verifica si el modo oscuro está activado
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Agrega un listener para cambios en preferencias de accesibilidad
 */
export function watchAccessibilityPreferences(callback: () => void): () => void {
  const mediaQueries = [
    window.matchMedia('(prefers-reduced-motion: reduce)'),
    window.matchMedia('(prefers-contrast: high)'),
    window.matchMedia('(prefers-color-scheme: dark)')
  ];

  mediaQueries.forEach(mq => mq.addEventListener('change', callback));

  return () => {
    mediaQueries.forEach(mq => mq.removeEventListener('change', callback));
  };
}

/**
 * Establece el foco visible para mejor accesibilidad
 */
export function setFocusVisible(element: HTMLElement, visible: boolean = true): void {
  if (visible) {
    element.dataset.focusVisible = 'true';
  } else {
    delete element.dataset.focusVisible;
  }
}

/**
 * Maneja el foco visible con teclado vs mouse
 */
export function setupFocusVisibleHandlers(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      document.body.dataset.keyboardFocus = 'true';
    }
  };

  const handleMouseDown = () => {
    document.body.dataset.keyboardFocus = 'false';
  };

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousedown', handleMouseDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleMouseDown);
  };
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
