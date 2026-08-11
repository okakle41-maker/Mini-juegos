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
  click(): void {
    this.playSound({
      frequency: 800,
      duration: 0.1,
      type: 'sine',
      volume: 0.5
    });
  }

  hover(): void {
    this.playSound({
      frequency: 400,
      duration: 0.05,
      type: 'sine',
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
  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button') || 
        target.classList.contains('game-card') || 
        target.classList.contains('filter-btn')) {
      uiSoundEffects.hover();
    }
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
