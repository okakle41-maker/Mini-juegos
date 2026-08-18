/**
 * js/utils/matchWaitingAdapter.ts
 *
 * Adaptador fino por juego para que la vista genérica de espera
 * `match-waiting` (ver views/matchWaiting.logic.ts) no necesite conocer
 * lobbySystem/signalTriangulationSystem/shipControlSystem con lógica
 * distinta hardcodeada por juego. Construye uno por juego, pero la
 * vista en sí es una sola.
 *
 * Nota sobre `lobbySystem` (Simon/Arrow/Termita): a diferencia de
 * signalTriangulationSystem/shipControlSystem, no dispara un evento
 * dedicado por-match (`st:match_changed`/`sc:match_changed`) — solo
 * `lobby:matches_changed`, genérico para toda la lista de sub-partidas
 * del lobby (se dispara con cualquier cambio de cualquier jugador, no
 * solo el propio). El adaptador filtra por id de partida antes de
 * invocar el callback para no re-evaluar en cada re-render ajeno a esta
 * espera.
 */

import { lobbySystem, type LobbyGameId } from '../lobbySystem.js';
import { signalTriangulationSystem } from '../signalTriangulationSystem.js';
import { shipControlSystem } from '../shipControlSystem.js';
import { fragmentedLabyrinthSystem } from '../fragmentedLabyrinthSystem.js';
import type { PendingGameId } from './matchWaitingContext.js';

export interface MatchWaitingAdapter {
  /** Cantidad actual de jugadores humanos en la sub-partida. */
  getCurrentCount(): number;
  /**
   * Suscribe `cb` a cambios en el conteo de jugadores de ESTA
   * sub-partida (ya filtrado — no dispara para cambios ajenos). Devuelve
   * una función de desuscripción.
   */
  onCountChanged(cb: (count: number) => void): () => void;
  /** Abandona la sub-partida en espera (usuario cierra el overlay). */
  leave(): Promise<void>;
}

function countLobbyPlayers(): number {
  const match = lobbySystem.getCurrentMatch();
  if (!match) return 0;
  return (match.player1Id ? 1 : 0) + (match.player2Id ? 1 : 0);
}

function countStPlayers(): number {
  const match = signalTriangulationSystem.getCurrentMatch();
  if (!match) return 0;
  return Object.values(match.players).filter(Boolean).length;
}

function countScPlayers(): number {
  const match = shipControlSystem.getCurrentMatch();
  if (!match) return 0;
  return Object.values(match.players).filter(Boolean).length;
}

function countFlPlayers(): number {
  const match = fragmentedLabyrinthSystem.getCurrentMatch();
  if (!match) return 0;
  return Object.values(match.players).filter(Boolean).length;
}

function lobbyAdapter(): MatchWaitingAdapter {
  return {
    getCurrentCount: countLobbyPlayers,
    onCountChanged(cb) {
      const matchId = lobbySystem.getCurrentMatch()?.id ?? null;
      const handler = () => {
        // `lobby:matches_changed` es genérico a toda la lista — solo nos
        // interesa si la partida que estamos esperando sigue siendo la
        // misma. Antes, `if (current && current.id !== matchId) return;`
        // no filtraba nada cuando `current` era null (partida ya
        // completada/abandonada y removida de lobbySystem.matches por
        // handleMatchUpdate): CUALQUIER cambio de CUALQUIER otra
        // sub-partida ajena del lobby terminaba llamando
        // cb(countLobbyPlayers()) igual, que a su vez volvía a leer
        // getCurrentMatch() (null) y devolvía 0 — pisando el contador
        // "X / 2 jugadores" en pantalla con un falso "0 / 2" mientras la
        // vista seguía esperando. El guard ahora también descarta el
        // evento si la partida propia ya no está en memoria.
        const current = lobbySystem.getCurrentMatch();
        if (!current || current.id !== matchId) return;
        cb(countLobbyPlayers());
      };
      window.addEventListener('lobby:matches_changed', handler);
      return () => window.removeEventListener('lobby:matches_changed', handler);
    },
    leave: () => lobbySystem.leaveCurrentMatch()
  };
}

function stAdapter(): MatchWaitingAdapter {
  return {
    getCurrentCount: countStPlayers,
    onCountChanged(cb) {
      const handler = () => cb(countStPlayers());
      window.addEventListener('st:match_changed', handler);
      return () => window.removeEventListener('st:match_changed', handler);
    },
    leave: () => signalTriangulationSystem.leaveCurrentMatch()
  };
}

function scAdapter(): MatchWaitingAdapter {
  return {
    getCurrentCount: countScPlayers,
    onCountChanged(cb) {
      const handler = () => cb(countScPlayers());
      window.addEventListener('sc:match_changed', handler);
      return () => window.removeEventListener('sc:match_changed', handler);
    },
    leave: () => shipControlSystem.leaveCurrentMatch()
  };
}

function flAdapter(): MatchWaitingAdapter {
  return {
    getCurrentCount: countFlPlayers,
    onCountChanged(cb) {
      const handler = () => cb(countFlPlayers());
      window.addEventListener('fl:match_changed', handler);
      return () => window.removeEventListener('fl:match_changed', handler);
    },
    leave: () => fragmentedLabyrinthSystem.leaveCurrentMatch()
  };
}

const LOBBY_GAME_IDS: ReadonlySet<string> = new Set<LobbyGameId>(['simon', 'arrow', 'termita']);

export function getMatchWaitingAdapter(gameId: PendingGameId): MatchWaitingAdapter {
  if (LOBBY_GAME_IDS.has(gameId)) return lobbyAdapter();
  if (gameId === 'signal_triangulation') return stAdapter();
  if (gameId === 'ship_control') return scAdapter();
  if (gameId === 'fragmented_labyrinth') return flAdapter();
  throw new Error(`[matchWaitingAdapter] Juego sin adaptador de espera: ${gameId}`);
}
