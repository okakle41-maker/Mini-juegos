/**
 * js/utils/describeMatchError.ts
 *
 * Traduce un error capturado (de crear/unirse a una partida —
 * lobbySystem/signalTriangulationSystem/shipControlSystem/
 * fragmentedLabyrinthSystem) a un mensaje accionable para el jugador,
 * distinguiendo entre las tres causas reales que hoy se mostraban todas
 * como el mismo genérico "No se pudo crear la partida.":
 *
 *   1. Sin conexión — navigator.onLine es false, o el error es uno de
 *      los mensajes de red crudos que arroja `fetch` cuando no hay
 *      conexión (`Failed to fetch`, `NetworkError when attempting to
 *      fetch resource`, `Load failed`, etc. — varían por navegador).
 *      El jugador puede resolverlo por su cuenta: revisar su wifi/datos.
 *   2. Error específico del servidor/estado — la gran mayoría de los
 *      `throw new Error(...)` que ya tiran lobbySystem y compañía
 *      (`Ese rol ya está ocupado`, `El lobby ya tiene 8 jugadores`,
 *      `Ya tenés una partida activa`, etc.): ya son mensajes accionables
 *      en español pensados para mostrarse tal cual — no hay que
 *      reinterpretarlos, solo pasarlos a través.
 *   3. Error inesperado sin forma reconocible — lo único que sigue
 *      cayendo al genérico, pero ahora aclarando que puede valer la
 *      pena reintentar, en vez de sonar como un callejón sin salida.
 *
 * No reemplaza los mensajes ya específicos de esos sistemas (caso 2) —
 * solo mejora lo que pasaba en los casos 1 y 3, que antes compartían el
 * mismo fallback plano sin distinción.
 */

/**
 * Fragmentos (en minúsculas) que identifican un error de red crudo del
 * navegador/fetch, no un error de aplicación con mensaje propio. Lista
 * best-effort: cubre los mensajes más comunes de Chrome, Firefox y
 * Safari para "no hay conexión" a nivel fetch — no pretende ser
 * exhaustiva para todo navegador/versión posible, así que se combina
 * con el chequeo de `navigator.onLine` (más confiable) en vez de
 * depender solo de esto.
 */
const NETWORK_ERROR_SNIPPETS = [
  'failed to fetch',
  'networkerror',
  'load failed',
  'network request failed',
  'the internet connection appears to be offline'
];

function looksLikeNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return NETWORK_ERROR_SNIPPETS.some((snippet) => lower.includes(snippet));
}

/**
 * @param error lo que llegó al `catch` — típicamente un `Error`, pero se
 *   acepta `unknown` porque JS permite lanzar cualquier cosa.
 * @param fallback mensaje a mostrar si el error no es reconocible de
 *   ninguna forma (ni de red, ni un `Error` con mensaje propio) — cada
 *   llamador sigue aportando el suyo, específico a qué acción falló
 *   (crear partida, unirse, etc.), igual que antes.
 */
export function describeMatchError(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message : '';

  if (!navigator.onLine || (rawMessage && looksLikeNetworkError(rawMessage))) {
    return 'Parece que no tenés conexión a internet. Revisá tu wifi/datos y probá de nuevo.';
  }

  if (error instanceof Error && rawMessage) {
    // Los sistemas de partida (lobbySystem, signalTriangulationSystem,
    // etc.) ya arrojan mensajes en español pensados para mostrarse tal
    // cual (ver comentario de archivo) — se pasan a través sin tocar.
    return rawMessage;
  }

  return `${fallback} Puede ser un problema temporal del servidor — probá de nuevo en unos segundos.`;
}
