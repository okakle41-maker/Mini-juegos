/**
 * Accessibility System
 * Sistema de accesibilidad mejorado con soporte para navegación por teclado,
 * screen readers, alto contraste, ajuste de texto y daltonismo
 */

interface HTMLElementWithFocusTrap extends HTMLElement {
  _trapHandler?: (e: KeyboardEvent) => void;
}

type ContrastMode = 'normal' | 'high' | 'increased';
type TextSize = 'small' | 'normal' | 'large' | 'extra-large';
type ColorBlindnessMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

interface AccessibilityConfig {
  keyboardNavigation: boolean;
  screenReaderOptimized: boolean;
  contrastMode: ContrastMode;
  textSize: TextSize;
  colorBlindnessMode: ColorBlindnessMode;
  reducedMotion: boolean;
  focusIndicators: boolean;
  skipLinks: boolean;
}

class AccessibilitySystem {
  private config: AccessibilityConfig;
  private storageKey = 'accessibility_config';
  private focusTrapElements: HTMLElement[] = [];
  private currentFocusIndex = 0;

  constructor() {
    this.config = this.loadConfig();
    this.init();
  }

  private loadConfig(): AccessibilityConfig {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[Accessibility] Failed to load config:', e);
      }
    }
    return {
      keyboardNavigation: true,
      screenReaderOptimized: true,
      contrastMode: 'normal',
      textSize: 'normal',
      colorBlindnessMode: 'none',
      reducedMotion: false,
      focusIndicators: true,
      skipLinks: true
    };
  }

  private saveConfig(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    this.applyConfig();
  }

  private init(): void {
    this.applyConfig();
    this.setupKeyboardNavigation();
    this.setupSkipLinks();
    this.setupFocusManagement();
    this.setupAriaLiveRegions();
  }

  private applyConfig(): void {
    const root = document.documentElement;

    // Contrast mode
    root.setAttribute('data-contrast', this.config.contrastMode);

    // Text size
    root.setAttribute('data-text-size', this.config.textSize);

    // Color blindness mode
    root.setAttribute('data-color-blindness', this.config.colorBlindnessMode);

    // Reduced motion
    root.setAttribute('data-reduced-motion', this.config.reducedMotion.toString());

    // Focus indicators
    root.setAttribute('data-focus-indicators', this.config.focusIndicators.toString());

    // Screen reader optimization
    root.setAttribute('data-screen-reader', this.config.screenReaderOptimized.toString());
  }

  private setupKeyboardNavigation(): void {
    if (!this.config.keyboardNavigation) return;

    // Agregar tabindex a elementos interactivos
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
    interactiveElements.forEach(el => {
      if (!(el as HTMLElement).hasAttribute('tabindex')) {
        (el as HTMLElement).setAttribute('tabindex', '0');
      }
    });

    // Manejar navegación con teclas especiales
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardNavigation(e);
    });
  }

  private handleKeyboardNavigation(e: KeyboardEvent): void {
    // Skip links con Alt + Shift + N
    if (e.altKey && e.shiftKey && e.key === 'n') {
      const skipLink = document.querySelector('.skip-link') as HTMLElement;
      if (skipLink) {
        skipLink.focus();
        e.preventDefault();
      }
    }

    // Navegación por headings con Alt + Shift + H
    if (e.altKey && e.shiftKey && e.key === 'h') {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const currentHeading = document.activeElement;
      const currentIndex = Array.from(headings).indexOf(currentHeading as HTMLElement);
      const nextIndex = (currentIndex + 1) % headings.length;
      (headings[nextIndex] as HTMLElement).focus();
      e.preventDefault();
    }
  }

  private setupSkipLinks(): void {
    if (!this.config.skipLinks) return;

    // Crear skip links si no existen
    if (!document.querySelector('.skip-links-container')) {
      const skipLinksContainer = document.createElement('div');
      skipLinksContainer.className = 'skip-links-container';
      skipLinksContainer.innerHTML = `
        <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
        <a href="#sidebar" class="skip-link">Saltar a navegación</a>
        <a href="#footer" class="skip-link">Saltar al pie de página</a>
      `;
      skipLinksContainer.style.cssText = `
        position: fixed;
        top: -100px;
        left: 0;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 5px;
      `;
      document.body.insertBefore(skipLinksContainer, document.body.firstChild);

      // Estilos para skip links
      const style = document.createElement('style');
      style.textContent = `
        .skip-link {
          position: absolute;
          top: -100px;
          left: 0;
          background: var(--accent-orange);
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          font-weight: 600;
          z-index: 10001;
          transition: top 0.3s;
        }
        .skip-link:focus {
          top: 0;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private setupFocusManagement(): void {
    if (!this.config.focusIndicators) return;

    // Mejorar indicadores de focus visibles
    const style = document.createElement('style');
    style.textContent = `
      [data-focus-indicators="true"] *:focus {
        outline: 3px solid var(--accent-orange) !important;
        outline-offset: 2px !important;
      }
      [data-focus-indicators="true"] button:focus,
      [data-focus-indicators="true"] a:focus,
      [data-focus-indicators="true"] input:focus,
      [data-focus-indicators="true"] select:focus,
      [data-focus-indicators="true"] textarea:focus {
        outline: 3px solid var(--accent-orange) !important;
        box-shadow: 0 0 0 4px rgba(255, 107, 0, 0.3) !important;
      }
    `;
    document.head.appendChild(style);
  }

  private setupAriaLiveRegions(): void {
    if (!this.config.screenReaderOptimized) return;

    // Crear regiones aria-live si no existen
    if (!document.getElementById('aria-live-polite')) {
      const politeRegion = document.createElement('div');
      politeRegion.id = 'aria-live-polite';
      politeRegion.setAttribute('aria-live', 'polite');
      politeRegion.setAttribute('aria-atomic', 'true');
      politeRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
      document.body.appendChild(politeRegion);
    }

    if (!document.getElementById('aria-live-assertive')) {
      const assertiveRegion = document.createElement('div');
      assertiveRegion.id = 'aria-live-assertive';
      assertiveRegion.setAttribute('aria-live', 'assertive');
      assertiveRegion.setAttribute('aria-atomic', 'true');
      assertiveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
      document.body.appendChild(assertiveRegion);
    }
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.config.screenReaderOptimized) return;

    const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
    const region = document.getElementById(regionId);
    if (region) {
      region.textContent = '';
      setTimeout(() => {
        region.textContent = message;
      }, 100);
    }
  }

  trapFocus(element: HTMLElement): void {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    this.focusTrapElements = Array.from(focusableElements) as HTMLElement[];
    this.currentFocusIndex = 0;

    if (this.focusTrapElements.length > 0) {
      this.focusTrapElements[0].focus();
    }

    const trapHandler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          this.currentFocusIndex = (this.currentFocusIndex - 1 + this.focusTrapElements.length) % this.focusTrapElements.length;
        } else {
          this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusTrapElements.length;
        }
        this.focusTrapElements[this.currentFocusIndex].focus();
      }
    };

    element.addEventListener('keydown', trapHandler);
    (element as HTMLElementWithFocusTrap)._trapHandler = trapHandler;
  }

  releaseFocus(element: HTMLElement): void {
    const trapHandler = (element as HTMLElementWithFocusTrap)._trapHandler;
    if (trapHandler) {
      element.removeEventListener('keydown', trapHandler);
      delete (element as HTMLElementWithFocusTrap)._trapHandler;
    }
    this.focusTrapElements = [];
  }

  // Config methods
  setKeyboardNavigation(enabled: boolean): void {
    this.config.keyboardNavigation = enabled;
    this.saveConfig();
  }

  setScreenReaderOptimized(enabled: boolean): void {
    this.config.screenReaderOptimized = enabled;
    this.saveConfig();
  }

  setContrastMode(mode: ContrastMode): void {
    this.config.contrastMode = mode;
    this.saveConfig();
  }

  setTextSize(size: TextSize): void {
    this.config.textSize = size;
    this.saveConfig();
  }

  setColorBlindnessMode(mode: ColorBlindnessMode): void {
    this.config.colorBlindnessMode = mode;
    this.saveConfig();
  }

  setReducedMotion(enabled: boolean): void {
    this.config.reducedMotion = enabled;
    this.saveConfig();
  }

  setFocusIndicators(enabled: boolean): void {
    this.config.focusIndicators = enabled;
    this.saveConfig();
  }

  setSkipLinks(enabled: boolean): void {
    this.config.skipLinks = enabled;
    this.saveConfig();
  }

  // Getters
  getConfig(): AccessibilityConfig {
    return { ...this.config };
  }

  // Presets
  applyHighContrastPreset(): void {
    this.config.contrastMode = 'high';
    this.config.textSize = 'large';
    this.config.focusIndicators = true;
    this.saveConfig();
  }

  applyLowVisionPreset(): void {
    this.config.contrastMode = 'increased';
    this.config.textSize = 'extra-large';
    this.config.focusIndicators = true;
    this.saveConfig();
  }

  applyMotorImpairmentPreset(): void {
    this.config.keyboardNavigation = true;
    this.config.focusIndicators = true;
    this.config.reducedMotion = true;
    this.saveConfig();
  }

  resetConfig(): void {
    this.config = {
      keyboardNavigation: true,
      screenReaderOptimized: true,
      contrastMode: 'normal',
      textSize: 'normal',
      colorBlindnessMode: 'none',
      reducedMotion: false,
      focusIndicators: true,
      skipLinks: true
    };
    this.saveConfig();
  }
}

// Singleton instance
export const accessibilitySystem = new AccessibilitySystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.accessibilitySystem = accessibilitySystem;
}

export default accessibilitySystem;
