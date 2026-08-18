/**
 * js/utils/teamLockView.ts
 *
 * Helper de sincronización para Signal Triangulation — deliberadamente
 * MÁS LIVIANO que multiplayerSplitView.ts (setupSplitView), que está
 * pensado para juegos de 2 lados donde cada uno ve una copia de solo
 * lectura del tablero completo del rival (Simon/Arrow/Termita).
 *
 * Acá la mecánica es la opuesta: cada jugador ve SOLO su propio número
 * y nunca la celda elegida por los demás, ni siquiera de solo lectura —
 * mostrar el tablero de otro jugador rompería el propósito del juego
 * (que los 4 intersecten sus rombos hablando en voz alta, no leyendo la
 * pantalla ajena). Por eso este helper no tiene noción de "tablero
 * espejo" ni de "host" — los 4 slots son simétricos, ninguno arranca la
 * partida por los demás (la ronda se genera automáticamente al llenarse
 * el 4to slot, ver signalTriangulationSystem.joinMatch).
 *
 * Lo único que este helper sincroniza en vivo es el CONTEO agregado y
 * anónimo de cuántos jugadores ya confirmaron su LOCK para la ronda
 * activa ("3 de 4 ya lockearon"), y el resultado final de la ronda
 * (solved/failed) cuando el servidor la resuelve — nunca una celda
 * ajena.
 */

import { signalTriangulationSystem, type STSlot } from '../signalTriangulationSystem.js';
import type { GameUi } from '../types/game.js';

export interface TeamLockViewHandle {
  /** true si hay una partida de Signal Triangulation activa para este cliente. */
  isActive: boolean;
  /** Mi slot (1-4) dentro de la partida, o null si no soy jugador de ella. */
  mySlot: STSlot | null;
  /**
   * Pide al sistema el estado agregado actual del equipo para la ronda
   * dada y actualiza el contador en el DOM (`ui[teamStatusKey]`, si se
   * proveyó). Se debe llamar tanto al entrar a una ronda nueva como en
   * respuesta a cada evento `st:my_lock_changed`/polling.
   */
  refreshTeamStatus: (roundId: string) => Promise<void>;
  /**
   * Registra un handler para cuando la ronda actual cambia de estado
   * (activa → solved/failed) — se dispara por polling corto mientras la
   * ronda sigue activa (ver nota de Realtime más abajo), no por un
   * canal de Realtime crudo sobre signal_triangulation_rounds (esa
   * tabla contiene la fuente oculta y su Realtime crudo no se consume
   * directamente desde el cliente — ver comentario extenso en
   * migration_016_signal_triangulation.sql, sección 6).
   */
  onRoundResolved: (handler: (status: 'solved' | 'failed') => void) => void;
  /** Detiene el polling y limpia los listeners registrados. */
  cleanup: () => void;
}

const POLL_INTERVAL_MS = 1500;

/**
 * @param ui GameUi ya resuelto por resolveUi. Se esperan (opcionales)
 *   `ui.stTeamStatus` (contenedor de texto para "N de 4 lockearon") —
 *   si no está presente, el conteo simplemente no se pinta en el DOM
 *   pero el resto del helper sigue funcionando (el juego puede leer el
 *   conteo por su cuenta vía signalTriangulationSystem.getTeamLockStatus
 *   si prefiere un render distinto).
 */
export function setupTeamLockView(ui: GameUi): TeamLockViewHandle {
  const match = signalTriangulationSystem.getCurrentMatch();
  const isActive = !!match;
  const mySlot = signalTriangulationSystem.mySlot();

  const teamStatusEl = ui.stTeamStatus as HTMLElement | undefined;
  const resolvedHandlers: Array<(status: 'solved' | 'failed') => void> = [];
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastKnownRoundStatus: string | null = null;

  const refreshTeamStatus = async (roundId: string): Promise<void> => {
    const statuses = await signalTriangulationSystem.getTeamLockStatus(roundId);
    const lockedCount = statuses.filter((s) => s.hasLocked).length;
    const total = statuses.length || 4;
    if (teamStatusEl) {
      teamStatusEl.textContent = `${lockedCount} de ${total} ya confirmaron su posición`;
    }
  };

  const pollRoundStatus = async (): Promise<void> => {
    const round = await signalTriangulationSystem.refreshCurrentRound();
    if (!round) return;
    if (round.status !== 'active' && round.status !== lastKnownRoundStatus) {
      lastKnownRoundStatus = round.status;
      resolvedHandlers.forEach((fn) => fn(round.status as 'solved' | 'failed'));
    } else if (round.status === 'active') {
      lastKnownRoundStatus = round.status;
      void refreshTeamStatus(round.id);
    }

    // Una vez que la PARTIDA (no solo la ronda) terminó, no tiene sentido
    // seguir pidiendo estado cada 1.5s: signalTriangulationSystem.leaveCurrentMatch()
    // todavía no se llamó en este punto (eso ocurre recién en stop(), ver
    // signalTriangulation.logic.ts), así que sin este guard el polling
    // seguía corriendo en segundo plano —consultando refreshCurrentRound/
    // getTeamLockStatus sin que nadie lo necesite— durante todo el tiempo
    // que el jugador se queda mirando la pantalla de resultado final,
    // hasta que finalmente navega afuera de la vista.
    const currentMatch = signalTriangulationSystem.getCurrentMatch();
    if (currentMatch && (currentMatch.status === 'completed' || currentMatch.status === 'abandoned') && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  if (isActive) {
    // Polling corto en vez de Realtime crudo sobre signal_triangulation_
    // rounds/locks: ver el comentario de archivo — esas tablas contienen
    // datos que no deben viajar sin filtrar por el canal de Realtime.
    // Un intervalo de 1.5s es aceptable para esta mecánica (los
    // jugadores coordinan por voz, no por reflejos de milisegundos como
    // Simon/Arrow/Termita).
    pollTimer = setInterval(() => { void pollRoundStatus(); }, POLL_INTERVAL_MS);
    void pollRoundStatus();
  }

  return {
    isActive,
    mySlot,
    refreshTeamStatus,
    onRoundResolved: (handler) => {
      resolvedHandlers.push(handler);
    },
    cleanup: () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      resolvedHandlers.length = 0;
    }
  };
}
