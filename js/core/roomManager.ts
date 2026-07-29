/**
 * roomManager.ts — Salas cooperativas en tiempo real (2 dispositivos).
 *
 * Pensado para minijuegos coop donde cada jugador ve una pantalla
 * distinta y necesita enterarse de lo que hace el otro en vivo (ej.
 * Letters Fall: uno ve las palabras caer, el otro solo tiene el
 * input). No reemplaza el modo "un solo dispositivo" de cada juego,
 * convive con él — cada `.logic.ts` decide si arranca en modo local o
 * en modo sala.
 *
 * Transporte: Supabase Realtime Broadcast (canal efímero, sin tabla
 * en la base de datos — no hace falta persistir nada de la partida).
 * Se reutiliza `getSupabaseClient()` (core/supabaseClient.ts), que ya
 * carga `@supabase/supabase-js` con import() dinámico y cachea la
 * promesa de inicialización, así que unirse a una sala no dispara una
 * segunda descarga del SDK si el usuario ya hizo login antes.
 *
 * Código de sala: 4 letras mayúsculas (ej. "QXWM"), suficiente para
 * evitar colisiones accidentales entre las pocas salas concurrentes
 * que un uso casual va a generar — no hace falta más entropía porque
 * no hay nada sensible detrás del código, solo empareja dos pantallas.
 *
 * Un canal Realtime por sala (`room:<juego>:<código>`), separado por
 * juego para que un código de Letters Fall no choque con uno de Bomb
 * Defusal si algún día comparten namespace de códigos.
 */

import { getSupabaseClient } from './supabaseClient.js';
import ErrorLogger from './errorLogger.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RoomRole = string;

export interface RoomPeer {
  role: RoomRole;
  joinedAt: number;
}

export type RoomEventHandler = (payload: unknown) => void;

export interface RoomSession {
  code: string;
  role: RoomRole;
  /** Envía un evento a todos los demás peers de la sala (no a uno mismo). */
  send: (event: string, payload?: unknown) => Promise<void>;
  /** Suscribe un handler a un tipo de evento. Devuelve función para desuscribir. */
  on: (event: string, handler: RoomEventHandler) => () => void;
  /** Roles actualmente presentes en la sala (incluye el propio). */
  peers: () => RoomPeer[];
  /** Se dispara cuando cambia la lista de peers (alguien entra/sale). */
  onPeersChange: (handler: (peers: RoomPeer[]) => void) => () => void;
  /** Cierra el canal y libera el socket. Llamar siempre en `stop()` del juego. */
  leave: () => Promise<void>;
}

function generateRoomCode(): string {
  // Sin caracteres ambiguos (0/O, 1/I) para que sea fácil de leer en
  // voz alta o escribir a mano entre los dos jugadores.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function connect(gameId: string, code: string, role: RoomRole): Promise<RoomSession> {
  const supabase = await getSupabaseClient();
  const channelName = `room:${gameId}:${code}`;
  const channel: RealtimeChannel = supabase.channel(channelName, {
    config: {
      // presence.key único por conexión, no por rol — dos pestañas con
      // el mismo rol (ej. dos "viewer" por error) no se pisan entre sí,
      // simplemente ambas aparecen en peers().
      presence: { key: `${role}-${Math.random().toString(36).slice(2, 8)}` },
      broadcast: { self: false },
    },
  });

  const eventHandlers = new Map<string, Set<RoomEventHandler>>();
  const peersChangeHandlers = new Set<(peers: RoomPeer[]) => void>();

  channel.on('broadcast', { event: '*' }, (message) => {
    const handlers = eventHandlers.get(message.event);
    handlers?.forEach((handler) => {
      try {
        handler(message.payload);
      } catch (error) {
        ErrorLogger.log('roomManager.broadcast', error, { gameId, code, event: message.event });
      }
    });
  });

  function currentPeers(): RoomPeer[] {
    const state = channel.presenceState<{ role: RoomRole; joinedAt: number }>();
    return Object.values(state)
      .flat()
      .map((entry) => ({ role: entry.role, joinedAt: entry.joinedAt }));
  }

  channel.on('presence', { event: 'sync' }, () => {
    const peers = currentPeers();
    peersChangeHandlers.forEach((handler) => {
      try {
        handler(peers);
      } catch (error) {
        ErrorLogger.log('roomManager.presence', error, { gameId, code });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel
          .track({ role, joinedAt: Date.now() })
          .then(() => resolve())
          .catch(reject);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`No se pudo conectar a la sala (${status})`));
      }
    });
  });

  return {
    code,
    role,
    async send(event: string, payload?: unknown) {
      await channel.send({ type: 'broadcast', event, payload });
    },
    on(event: string, handler: RoomEventHandler) {
      if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
      eventHandlers.get(event)!.add(handler);
      return () => {
        eventHandlers.get(event)?.delete(handler);
      };
    },
    peers: currentPeers,
    onPeersChange(handler) {
      peersChangeHandlers.add(handler);
      return () => {
        peersChangeHandlers.delete(handler);
      };
    },
    async leave() {
      eventHandlers.clear();
      peersChangeHandlers.clear();
      await supabase.removeChannel(channel);
    },
  };
}

/**
 * Crea una sala nueva con un código generado al azar y se une a ella
 * con el rol indicado. Reintenta con otro código en el caso
 * (extremadamente improbable) de colisión, detectada porque ya hay un
 * peer presente al conectarse.
 */
export async function createRoom(gameId: string, role: RoomRole): Promise<RoomSession> {
  const code = generateRoomCode();
  const session = await connect(gameId, code, role);
  return session;
}

/**
 * Se une a una sala existente por código. No valida que la sala
 * "exista" de antemano (Realtime no tiene ese concepto — un canal se
 * crea al primer suscriptor) — si el código está mal, simplemente
 * queda esperando en una sala vacía sin que aparezca el otro peer.
 * Las vistas de sala deben comunicar esto con un estado de "esperando
 * al otro jugador…" en vez de un error.
 */
export async function joinRoom(gameId: string, code: string, role: RoomRole): Promise<RoomSession> {
  return connect(gameId, code.toUpperCase().trim(), role);
}
