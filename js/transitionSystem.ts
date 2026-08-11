/**
 * Transition System
 * Sistema de transiciones mejorado para vistas del sidebar
 */

type TransitionType = 'fade' | 'slide' | 'scale' | 'flip' | 'none';
type TransitionDirection = 'left' | 'right' | 'up' | 'down';

interface TransitionConfig {
  type: TransitionType;
  direction?: TransitionDirection;
  duration: number;
  easing: string;
}

class TransitionSystem {
  private currentView: string | null = null;
  private transitionContainer: HTMLElement | null = null;
  private isTransitioning = false;
  private defaultConfig: TransitionConfig = {
    type: 'fade',
    direction: 'right',
    duration: 300,
    easing: 'ease-in-out'
  };

  constructor() {
    this.init();
  }

  private init(): void {
    this.transitionContainer = document.createElement('div');
    this.transitionContainer.className = 'transition-container';
    this.transitionContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    `;
    document.body.appendChild(this.transitionContainer);
  }

  async transition(
    fromView: HTMLElement,
    toView: HTMLElement,
    config?: Partial<TransitionConfig>
  ): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const transitionConfig = { ...this.defaultConfig, ...config };
    
    // Apply transition styles
    fromView.style.transition = `all ${transitionConfig.duration}ms ${transitionConfig.easing}`;
    toView.style.transition = `all ${transitionConfig.duration}ms ${transitionConfig.easing}`;

    // Set initial states
    this.setInitialState(fromView, toView, transitionConfig);

    // Force reflow
    void fromView.offsetWidth;

    // Apply final states
    this.setFinalState(fromView, toView, transitionConfig);

    // Wait for transition to complete
    await this.waitFor(transitionConfig.duration);

    // Cleanup
    this.cleanup(fromView, toView);
    this.isTransitioning = false;
  }

  private setInitialState(
    fromView: HTMLElement,
    toView: HTMLElement,
    config: TransitionConfig
  ): void {
    switch (config.type) {
      case 'fade':
        fromView.style.opacity = '1';
        toView.style.opacity = '0';
        break;
      case 'slide':
        this.setSlideInitialState(fromView, toView, config.direction || 'right');
        break;
      case 'scale':
        fromView.style.transform = 'scale(1)';
        toView.style.transform = 'scale(0.9)';
        fromView.style.opacity = '1';
        toView.style.opacity = '0';
        break;
      case 'flip':
        fromView.style.transform = 'rotateY(0deg)';
        toView.style.transform = 'rotateY(90deg)';
        fromView.style.opacity = '1';
        toView.style.opacity = '0';
        break;
      case 'none':
        fromView.style.opacity = '1';
        toView.style.opacity = '1';
        break;
    }
  }

  private setSlideInitialState(
    fromView: HTMLElement,
    toView: HTMLElement,
    direction: TransitionDirection
  ): void {
    switch (direction) {
      case 'left':
        fromView.style.transform = 'translateX(0)';
        toView.style.transform = 'translateX(100%)';
        break;
      case 'right':
        fromView.style.transform = 'translateX(0)';
        toView.style.transform = 'translateX(-100%)';
        break;
      case 'up':
        fromView.style.transform = 'translateY(0)';
        toView.style.transform = 'translateY(100%)';
        break;
      case 'down':
        fromView.style.transform = 'translateY(0)';
        toView.style.transform = 'translateY(-100%)';
        break;
    }
    fromView.style.opacity = '1';
    toView.style.opacity = '1';
  }

  private setFinalState(
    fromView: HTMLElement,
    toView: HTMLElement,
    config: TransitionConfig
  ): void {
    switch (config.type) {
      case 'fade':
        fromView.style.opacity = '0';
        toView.style.opacity = '1';
        break;
      case 'slide':
        this.setSlideFinalState(fromView, toView, config.direction || 'right');
        break;
      case 'scale':
        fromView.style.transform = 'scale(1.1)';
        fromView.style.opacity = '0';
        toView.style.transform = 'scale(1)';
        toView.style.opacity = '1';
        break;
      case 'flip':
        fromView.style.transform = 'rotateY(-90deg)';
        fromView.style.opacity = '0';
        toView.style.transform = 'rotateY(0deg)';
        toView.style.opacity = '1';
        break;
      case 'none':
        fromView.style.opacity = '1';
        toView.style.opacity = '1';
        break;
    }
  }

  private setSlideFinalState(
    fromView: HTMLElement,
    toView: HTMLElement,
    direction: TransitionDirection
  ): void {
    switch (direction) {
      case 'left':
        fromView.style.transform = 'translateX(-100%)';
        toView.style.transform = 'translateX(0)';
        break;
      case 'right':
        fromView.style.transform = 'translateX(100%)';
        toView.style.transform = 'translateX(0)';
        break;
      case 'up':
        fromView.style.transform = 'translateY(-100%)';
        toView.style.transform = 'translateY(0)';
        break;
      case 'down':
        fromView.style.transform = 'translateY(100%)';
        toView.style.transform = 'translateY(0)';
        break;
    }
  }

  private cleanup(fromView: HTMLElement, toView: HTMLElement): void {
    fromView.style.transition = '';
    toView.style.transition = '';
    fromView.style.transform = '';
    toView.style.transform = '';
    fromView.style.opacity = '';
    toView.style.opacity = '';
  }

  private waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setDefaultConfig(config: Partial<TransitionConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  getCurrentView(): string | null {
    return this.currentView;
  }

  setCurrentView(viewId: string): void {
    this.currentView = viewId;
  }

  destroy(): void {
    if (this.transitionContainer) {
      document.body.removeChild(this.transitionContainer);
      this.transitionContainer = null;
    }
  }
}

// Singleton instance
export const transitionSystem = new TransitionSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.transitionSystem = transitionSystem;
}

export default transitionSystem;
