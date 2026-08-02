/**
 * js/utils/shipControlMorseAudio.ts
 *
 * Síntesis de audio Morse para el rol Comunicaciones de Centro de
 * Control — reproduce el patrón '.'/'-' que llega ya calculado desde
 * el servidor (SCEvent.morsePattern, ver shipControlSystem.ts y
 * migration_017_ship_control.sql sección 5/3.4: encode_ship_morse
 * corre server-side sobre hidden_solution.morse_code, el cliente nunca
 * ve el código en sí hasta que el jugador lo decodifica de oído).
 *
 * Deliberadamente un módulo propio y NO una extensión de
 * audioManager.ts/soundSystem.ts: ambos están pensados para bips
 * puntuales de duración fija (ver audioManager.play — 80ms fijos por
 * sonido), mientras que Morse necesita una SECUENCIA temporal con 3
 * duraciones relativas distintas (punto/raya/pausas) encadenadas con
 * setTimeout — forzar eso dentro de la API de "un sonido por clave" de
 * los sistemas existentes sería más confuso que un módulo chico
 * dedicado. Sí reusa el mismo patrón de AudioContext crudo
 * (window.AudioContext || window.webkitAudioContext) que audioManager.ts
 * para consistencia de estilo.
 *
 * Timing estándar Morse (unidad = punto):
 *   punto = 1 unidad de tono, raya = 3 unidades de tono,
 *   pausa entre símbolos del mismo carácter = 1 unidad de silencio,
 *   pausa entre caracteres = 3 unidades de silencio (el patrón que
 *   llega del servidor ya trae ' / ' como separador de carácter, ver
 *   encode_ship_morse).
 */

const UNIT_MS = 100; // duración de 1 punto — velocidad legible bajo presión de voz, no realista de operador experto
const TONE_FREQ = 700; // frecuencia clásica de entrenamiento Morse (700-800Hz)

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (audioContext) return audioContext;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
    return audioContext;
  } catch {
    return null;
  }
}

export interface MorsePlaybackHandle {
  /** Duración total estimada de la reproducción, en ms. */
  totalMs: number;
  /** Cancela los tonos programados que todavía no sonaron. */
  cancel: () => void;
}

/**
 * Reproduce un patrón Morse en formato "…-- / .- / -.--" (símbolos
 * '.'/'-' por carácter, caracteres separados por " / " — mismo formato
 * que devuelve encode_ship_morse). Caracteres desconocidos o
 * inesperados en el string se ignoran (defensivo: nunca debería pasar
 * si el patrón viene del servidor, pero no vale la pena reventar la UI
 * de un jugador bajo presión de tiempo por un carácter raro).
 */
export function playMorsePattern(pattern: string, volume = 0.35): MorsePlaybackHandle {
  const ctx = getContext();
  if (!ctx) return { totalMs: 0, cancel: () => {} };

  // Reanudar si el navegador lo suspendió por política de autoplay —
  // el click del botón "reproducir" que dispara esto ya cuenta como
  // gesto del usuario, así que resume() debería resolver siempre.
  if (ctx.state === 'suspended') void ctx.resume();

  const characters = pattern.split(' / ');
  let cursorMs = 0;
  const startedAt = ctx.currentTime;
  const scheduledOscillators: OscillatorNode[] = [];

  for (let c = 0; c < characters.length; c++) {
    const symbols = characters[c];
    for (let s = 0; s < symbols.length; s++) {
      const symbol = symbols[s];
      const durationMs = symbol === '-' ? UNIT_MS * 3 : symbol === '.' ? UNIT_MS : 0;
      if (durationMs > 0) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = TONE_FREQ;
        gain.gain.value = volume;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        const startAt = startedAt + cursorMs / 1000;
        oscillator.start(startAt);
        oscillator.stop(startAt + durationMs / 1000);
        scheduledOscillators.push(oscillator);
      }
      cursorMs += durationMs;
      // Silencio entre símbolos del mismo carácter (1 unidad) — no
      // agregar después del último símbolo del carácter, eso lo cubre
      // el silencio entre caracteres de abajo.
      if (s < symbols.length - 1) cursorMs += UNIT_MS;
    }
    // Silencio entre caracteres (3 unidades) — no agregar tras el
    // último carácter del patrón completo.
    if (c < characters.length - 1) cursorMs += UNIT_MS * 3;
  }

  return {
    totalMs: cursorMs,
    cancel: () => {
      scheduledOscillators.forEach((osc) => {
        try { osc.stop(); } catch { /* ya terminó o nunca arrancó */ }
      });
    }
  };
}
