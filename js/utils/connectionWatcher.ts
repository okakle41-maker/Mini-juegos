/**
 * js/utils/connectionWatcher.ts
 *
 * Aviso proactivo de pérdida de conexión durante una partida multiplayer
 * activa. Antes, si el jugador perdía la red a mitad de partida (Simon/
 * Arrow/Termita vía lobbySystem, Signal Triangulation/Centro de Control/
 * Fragmented Labyrinth, Letters Fall), no había ningún indicador hasta
 * que la próxima acción fallaba con un error genérico — el jugador no
 * tenía forma de saber si el silencio del rival era "no jugó todavía" o
 * "se cortó la conexión". Este helper no intenta reconectar nada (cada
 * sistema ya maneja sus propios canales realtime) — solo detecta la
 * señal y avisa, para que el jugador entienda qué está pasando antes de
 * que algo falle.
 *
 * Dos señales, cada una con su propio valor y limitación:
 *
 *  - `online`/`offline` (navigator.onLine): confiable para saber que el
 *    dispositivo perdió/recuperó la conexión de red a nivel SO/browser.
 *    No detecta problemas más finos (ej. WiFi conectado pero sin
 *    salida a internet, o el servidor de Supabase específicamente caído)
 *    — para eso ya existe el error real de la próxima acción fallida.
 *
 *  - `visibilitychange`: no es pérdida de conexión en sí, pero cubre un
 *    caso real y distinto — el jugador cambia de pestaña/app a mitad de
 *    partida (revisa el celular, otra ventana) y su navegador puede
 *    limitar/pausar timers y reconexiones en segundo plano. Al volver a
 *    la pestaña, si mientras tanto se perdió la conexión (visible recién
 *    al volver `navigator.onLine === false`, o el usuario simplemente
 *    tardó mucho), se lo avisa entonces en vez de dejar que se entere
 *    por un error a mitad de acción.
 *
 * Uso: cada juego llama a `watchConnection()` en su init() (solo cuando
 * `isMultiplayer` es true — no tiene sentido en modo solo) y a la función
 * de limpieza devuelta en su stop(). No reemplaza a
 * multiplayerSystem.isConnectedToServer() (que sigue siendo la fuente de
 * verdad para Letters Fall) — es un aviso complementario, agnóstico del
 * sistema de red específico de cada juego.
 */

import notificationSystem from '../notificationSystem.js';

export interface ConnectionWatcherHandle {
  /** Quita los listeners de `online`/`offline`/`visibilitychange`. */
  cleanup: () => void;
}

/**
 * @param onOffline callback opcional además del toast de aviso — por si
 *   el juego que llama necesita, por ejemplo, pausar un timer local
 *   mientras está desconectado. No es obligatorio: la mayoría de los
 *   juegos no necesitan hacer nada especial, el toast solo es
 *   informativo.
 */
export function watchConnection(onOffline?: () => void): ConnectionWatcherHandle {
  let wasOffline = false;

  const handleOffline = () => {
    wasOffline = true;
    notificationSystem.warning(
      'Se perdió la conexión',
      'Reconectando… tus acciones pueden no llegarle a tu rival hasta que vuelva la señal.',
      6000
    );
    onOffline?.();
  };

  const handleOnline = () => {
    // Solo confirma la reconexión si efectivamente habíamos avisado que
    // se había cortado — evita un toast de "reconectado" espurio en el
    // primer 'online' que algunos navegadores disparan al cargar la
    // página, cuando nunca hubo un corte real que avisar.
    if (!wasOffline) return;
    wasOffline = false;
    notificationSystem.success('Conexión recuperada', 'Ya podés seguir jugando con normalidad.', 3000);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    // Al volver a la pestaña: si el navegador ya sabe que no hay red,
    // avisar de inmediato en vez de esperar a que 'offline' hubiera
    // disparado mientras la pestaña estaba oculta (algunos navegadores
    // limitan eventos en background, así que no es garantía haberlo
    // recibido a tiempo).
    if (!navigator.onLine && !wasOffline) {
      handleOffline();
    }
  };

  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Chequeo inicial: si ya se entra a la partida sin conexión (poco
  // común, pero posible si se perdió la red mientras se navegaba hacia
  // acá), avisar de una vez en vez de esperar a un evento futuro.
  if (!navigator.onLine) {
    handleOffline();
  }

  return {
    cleanup: () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
}
