/**
 * Sound System
 * Sistema de efectos de sonido con control de volumen y personalización
 */

type SoundCategory = 'ui' | 'achievement' | 'game' | 'notification' | 'ambient';
type SoundType = 'click' | 'hover' | 'success' | 'error' | 'achievement' | 'level_up' | 'notification' | 'game_start' | 'game_end';

interface SoundConfig {
  enabled: boolean;
  volume: {
    master: number;
    ui: number;
    achievement: number;
    game: number;
    notification: number;
    ambient: number;
  };
  theme: 'default' | 'retro' | 'modern' | 'minimal';
}

class SoundSystem {
  private config: SoundConfig;
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private storageKey = 'sound_config';
  private initialized = false;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): SoundConfig {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[Sound] Failed to load config:', e);
      }
    }
    return {
      enabled: true,
      volume: {
        master: 0.7,
        ui: 0.8,
        achievement: 0.9,
        game: 0.7,
        notification: 0.8,
        ambient: 0.5
      },
      theme: 'default'
    };
  }

  private saveConfig(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.config));
  }

  private async initAudioContext(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.error('[Sound] Failed to initialize AudioContext:', e);
    }
  }

  async loadSound(name: string, url: string): Promise<void> {
    if (!this.config.enabled) return;
    
    await this.initAudioContext();
    if (!this.audioContext) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds.set(name, audioBuffer);
    } catch (e) {
      console.error(`[Sound] Failed to load sound ${name}:`, e);
    }
  }

  playSound(type: SoundType, category: SoundCategory = 'ui'): void {
    if (!this.config.enabled) return;
    if (!this.audioContext) return;

    const volume = this.config.volume.master * this.config.volume[category];
    if (volume === 0) return;

    // Generar sonidos sintéticos para evitar dependencias de archivos
    this.playSyntheticSound(type, volume);
  }

  private playSyntheticSound(type: SoundType, volume: number): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;

    switch (type) {
      case 'click':
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gainNode.gain.setValueAtTime(volume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;

      case 'hover':
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        gainNode.gain.setValueAtTime(volume * 0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        oscillator.start(now);
        oscillator.stop(now + 0.05);
        break;

      case 'success':
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gainNode.gain.setValueAtTime(volume * 0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        oscillator.start(now);
        oscillator.stop(now + 0.4);
        break;

      case 'error':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        gainNode.gain.setValueAtTime(volume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;

      case 'achievement': {
        // Fanfare de logro
        const now2 = this.audioContext.currentTime;
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const osc3 = this.audioContext.createOscillator();
        const gain1 = this.audioContext.createGain();
        const gain2 = this.audioContext.createGain();
        const gain3 = this.audioContext.createGain();

        osc1.connect(gain1);
        osc2.connect(gain2);
        osc3.connect(gain3);
        gain1.connect(this.audioContext.destination);
        gain2.connect(this.audioContext.destination);
        gain3.connect(this.audioContext.destination);

        osc1.frequency.setValueAtTime(523.25, now2);
        osc2.frequency.setValueAtTime(659.25, now2 + 0.1);
        osc3.frequency.setValueAtTime(783.99, now2 + 0.2);

        gain1.gain.setValueAtTime(volume * 0.3, now2);
        gain2.gain.setValueAtTime(volume * 0.3, now2 + 0.1);
        gain3.gain.setValueAtTime(volume * 0.3, now2 + 0.2);

        gain1.gain.exponentialRampToValueAtTime(0.01, now2 + 0.3);
        gain2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.4);
        gain3.gain.exponentialRampToValueAtTime(0.01, now2 + 0.5);

        osc1.start(now2);
        osc2.start(now2 + 0.1);
        osc3.start(now2 + 0.2);

        osc1.stop(now2 + 0.3);
        osc2.stop(now2 + 0.4);
        osc3.stop(now2 + 0.5);
        break;
      }

      case 'level_up': {
        // Sonido de nivel up más dramático
        const now3 = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.frequency.setValueAtTime(440, now3);
        osc.frequency.exponentialRampToValueAtTime(880, now3 + 0.1);
        osc.frequency.exponentialRampToValueAtTime(1320, now3 + 0.2);
        osc.frequency.exponentialRampToValueAtTime(1760, now3 + 0.3);

        gain.gain.setValueAtTime(volume * 0.4, now3);
        gain.gain.exponentialRampToValueAtTime(0.01, now3 + 0.5);

        osc.start(now3);
        osc.stop(now3 + 0.5);
        break;
      }

      case 'notification':
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.setValueAtTime(800, now + 0.1);
        oscillator.frequency.setValueAtTime(600, now + 0.2);
        gainNode.gain.setValueAtTime(volume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;

      case 'game_start':
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gainNode.gain.setValueAtTime(volume * 0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;

      case 'game_end':
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.2);
        gainNode.gain.setValueAtTime(volume * 0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setMasterVolume(volume: number): void {
    this.config.volume.master = Math.max(0, Math.min(1, volume));
    this.saveConfig();
  }

  setCategoryVolume(category: SoundCategory, volume: number): void {
    this.config.volume[category] = Math.max(0, Math.min(1, volume));
    this.saveConfig();
  }

  getVolume(category?: SoundCategory): number {
    if (category) {
      return this.config.volume[category];
    }
    return this.config.volume.master;
  }

  setTheme(theme: SoundConfig['theme']): void {
    this.config.theme = theme;
    this.saveConfig();
  }

  getTheme(): SoundConfig['theme'] {
    return this.config.theme;
  }

  getConfig(): SoundConfig {
    return { ...this.config };
  }

  resetConfig(): void {
    this.config = {
      enabled: true,
      volume: {
        master: 0.7,
        ui: 0.8,
        achievement: 0.9,
        game: 0.7,
        notification: 0.8,
        ambient: 0.5
      },
      theme: 'default'
    };
    this.saveConfig();
  }

  async preloadSounds(): Promise<void> {
    // Preload sonidos comunes si se agregan archivos de audio
    // Por ahora usamos sonidos sintéticos
    await this.initAudioContext();
  }
}

// Singleton instance
export const soundSystem = new SoundSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.soundSystem = soundSystem;
}

export default soundSystem;
