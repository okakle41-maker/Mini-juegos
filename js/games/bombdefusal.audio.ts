/**
 * js/games/bombdefusal.audio.ts
 *
 * Feedback sonoro sintetizado con la Web Audio API (osciladores, sin
 * archivos de audio) para el minijuego de desactivación de bombas.
 * Extraído de bombdefusal.logic.ts como parte de dividir ese archivo.
 * El AudioContext y el volumen viven encapsulados acá — el resto del
 * juego solo llama a initAudio()/playSound()/setVolume().
 */

let audioContext: AudioContext | null = null;
const soundEnabled = true;
let soundVolume = 0.3;

export function initAudio() {
  if (!audioContext) {
    audioContext = new ((window.AudioContext || window.webkitAudioContext) as typeof AudioContext)();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch((err: unknown) => {
      console.error('[BombDefusal] Error al reanudar el audio:', err);
    });
  }
}

export function playSound(type: string) {
  if (!soundEnabled || !audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  gainNode.gain.value = soundVolume;
  
  switch(type) {
    case 'success':
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'error':
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
    case 'strike':
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      break;
    case 'win':
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.3);
      oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.45);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      break;
    case 'lose':
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime + 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      break;
    case 'click':
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
      break;
  }
}

export function setVolume(vol: number) {
  soundVolume = Math.max(0, Math.min(1, vol));
}
