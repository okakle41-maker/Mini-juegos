/**
 * backgroundManager.ts — Gestor de fondos, temas y efectos visuales
 * Versión TypeScript
 */

export interface BackgroundManagerInterface {
  setTheme: (theme: 'dark' | 'neon' | 'ocean' | 'orange' | 'light') => void;
  setBackground: (type: string) => void;
  toggleScanlines: () => void;
  applyRandomEffect: () => void;
  onViewChange: (viewId: string) => void;
}

class BackgroundManager implements BackgroundManagerInterface {
  private scanlinesEnabled = true;
  private body: HTMLElement;

  constructor() {
    this.body = document.body;
    this.init();
  }

  private init(): void {
    // Aplicar tema inicial
    this.setTheme('dark');

    // Detectar preferencia del sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      // this.setTheme('light'); // opcional
    }
  }

  setTheme(theme: 'dark' | 'neon' | 'ocean' | 'orange' | 'light'): void {
    this.body.setAttribute('data-theme', theme);

    // Notificar a otros módulos (p. ej. gameRegistry / lobby) de que el
    // tema cambió, así pueden reaplicar overrides de nombres/iconos.
    document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
  }

  setBackground(type: string): void {
    this.body.setAttribute('data-background', type);
  }

  toggleScanlines(): void {
    this.scanlinesEnabled = !this.scanlinesEnabled;
    if (this.scanlinesEnabled) {
      this.body.classList.add('scanlines');
    } else {
      this.body.classList.remove('scanlines');
    }
  }

  applyRandomEffect(): void {
    const effects = ['crt-flicker', 'vignette', 'scanline-pulse'];
    const random = effects[Math.floor(Math.random() * effects.length)];
    
    this.body.classList.add(random);
    setTimeout(() => {
      this.body.classList.remove(random);
    }, 800);
  }

  // Método útil para cuando cambia de vista
  onViewChange(viewId: string): void {
    // Puedes personalizar fondo por vista
    if (viewId === 'virusoverload') {
      this.setBackground('matrix');
    }
  }
}

// Instancia única
const BackgroundManagerInstance = new BackgroundManager();

export default BackgroundManagerInstance;