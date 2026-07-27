/**
 * audioManager.ts — Gestor de audio y sonidos del juego
 * Versión TypeScript con soporte para AudioContext
 */

import { devLog } from './core/devLog.js';

export interface AudioManagerInterface {
  play: (soundKey: string) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  isMuted: () => boolean;
}

class AudioManager implements AudioManagerInterface {
  private audioContext: AudioContext | null = null;
  private volume = 0.7;
  private muted = false;
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) throw new Error('AudioContext no soportado en este navegador');
      this.audioContext = new AudioContextCtor();
      this.initialized = true;
      devLog('[AudioManager] Inicializado correctamente');
    } catch (error) {
      window.ErrorLogger?.log('AudioManager.init', error);
    }
  }

  /**
   * Reproduce un sonido por clave
   */
  play(soundKey: string): void {
    if (this.muted || !this.initialized) return;

    // Sonidos pre-cargados (puedes expandir esto)
    const simpleSounds: Record<string, number> = {
      click: 300,
      good: 600,
      perfect: 800,
      miss: 200,
      beep: 900,
      gameover: 150,
      open: 500,
      // simon.ts / sequence.ts: tone1..tone8 (escala ascendente)
      tone1: 262, tone2: 294, tone3: 330, tone4: 349,
      tone5: 392, tone6: 440, tone7: 494, tone8: 523,
      // keyspam.ts: key1..key3
      key1: 350, key2: 450, key3: 550,
      // varios juegos: step1..step3
      step1: 320, step2: 420, step3: 520
    };

    const freq = simpleSounds[soundKey] || 440;

    try {
      if (this.audioContext) {
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gain.gain.value = this.volume * 0.3;

        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);

        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
        }, 80);
      }
    } catch (e) {
      // Fallback silencioso
    }
  }

  setVolume(newVolume: number): void {
    this.volume = Math.max(0, Math.min(1, newVolume));
  }

  mute(): void {
    this.muted = true;
  }

  unmute(): void {
    this.muted = false;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

// Instancia única
const audioManager = new AudioManager();

export default audioManager;