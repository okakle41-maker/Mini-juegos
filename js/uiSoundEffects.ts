/**
 * UI Sound Effects Manager
 * Maneja efectos de sonido para interacciones de la UI
 */

interface SoundConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
}

class UISoundEffects {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.3;

  constructor() {
    this.init();
  }

  private init(): void {
    // Inicializar AudioContext en primera interacción del usuario
    document.addEventListener('click', () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
    }, { once: true });
  }

  private ensureAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  private playSound(config: SoundConfig): void {
    if (!this.isEnabled) return;
    
    try {
      this.ensureAudioContext();
      if (!this.audioContext) return;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, this.audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(this.volume * config.volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + config.duration);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + config.duration);
    } catch (error) {
      console.error('[UISoundEffects] Error playing sound:', error);
    }
  }

  // Efectos de sonido predefinidos
  //
  // click/hover recalibrados de 'sine' puro a 'triangle': la onda sine a
  // estas frecuencias suena limpia/cristalina (buen calce con la paleta
  // cian anterior), pero sobre la UI naranja/cálida actual quedaba "fría"
  // por contraste con el resto de las transiciones (ver .stagger-in,
  // colores de estado). 'triangle' agrega armónicos impares suaves que dan
  // más cuerpo/calidez al timbre sin cambiar el rol funcional del sonido
  // (mismo patrón corto y sutil, solo timbre distinto). Frecuencias y
  // duración sin tocar para no alterar el "feel" ya afinado de la UI.
  click(): void {
    this.playSound({
      frequency: 800,
      duration: 0.1,
      type: 'triangle',
      volume: 0.5
    });
  }

  hover(): void {
    this.playSound({
      frequency: 400,
      duration: 0.05,
      type: 'triangle',
      volume: 0.3
    });
  }

  success(): void {
    this.playSound({
      frequency: 523.25,
      duration: 0.15,
      type: 'sine',
      volume: 0.6
    });
    
    setTimeout(() => {
      this.playSound({
        frequency: 659.25,
        duration: 0.15,
        type: 'sine',
        volume: 0.6
      });
    }, 100);
  }

  error(): void {
    this.playSound({
      frequency: 200,
      duration: 0.2,
      type: 'sawtooth',
      volume: 0.4
    });
  }

  notification(): void {
    this.playSound({
      frequency: 880,
      duration: 0.1,
      type: 'sine',
      volume: 0.5
    });
    
    setTimeout(() => {
      this.playSound({
        frequency: 1100,
        duration: 0.15,
        type: 'sine',
        volume: 0.5
      });
    }, 80);
  }

  filter(): void {
    this.playSound({
      frequency: 600,
      duration: 0.08,
      type: 'triangle',
      volume: 0.4
    });
  }

  type(): void {
    this.playSound({
      frequency: 1200,
      duration: 0.03,
      type: 'sine',
      volume: 0.2
    });
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }
}

// Singleton instance
export const uiSoundEffects = new UISoundEffects();

// Inicializar efectos de sonido en elementos interactivos
document.addEventListener('DOMContentLoaded', () => {
  // Clicks en botones
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      uiSoundEffects.click();
    }
  });

  // Hover en elementos interactivos
  // Usamos mouseover (con chequeo de relatedTarget) en vez de mouseenter porque
  // mouseenter no hace bubble y no podríamos delegarlo desde document.
  // El chequeo de relatedTarget evita que el sonido se repita al mover el mouse
  // entre elementos hijos dentro del mismo elemento "hover-able" (card, botón, etc.)
  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    const hoverable = target.closest('button, .game-card, .filter-btn') as HTMLElement | null;
    if (!hoverable) return;

    const related = e.relatedTarget as HTMLElement | null;
    // El "hoverable" del que venimos: si el mouse solo se movió entre hijos
    // internos de un mismo elemento hover-able (p.ej. de la imagen al título
    // dentro de la misma card), el hoverable de origen es el mismo que el
    // actual y no se debe volver a reproducir el sonido.
    const relatedHoverable = related?.closest('button, .game-card, .filter-btn') ?? null;
    if (relatedHoverable === hoverable) return;

    uiSoundEffects.hover();
  });

  // Input typing
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      uiSoundEffects.type();
    }
  });
});

export default uiSoundEffects;
