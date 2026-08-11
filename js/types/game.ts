/**
 * js/types/game.ts
 *
 * Tipos compartidos entre módulos de juego.
 *
 * GameConfig sigue definido (fuente de verdad) en ../core/gameRegistry.ts,
 * junto a la clase que lo implementa; se re-exporta aquí para que el resto
 * de la app —y en particular cada archivo en js/games/— pueda importar
 * todos sus tipos comunes desde un único lugar.
 */

export type { GameConfig } from '../core/gameRegistry';
export type { GameUi } from './global';

/**
 * Contrato de un template de vista (cada archivo en js/views/*.ts).
 * Función pura y sin dependencias del DOM: recibe nada, devuelve el
 * markup HTML estático de la vista como string. viewManager.ts inyecta
 * ese string vía innerHTML tras el import() dinámico — ver
 * js/core/viewTemplates.ts para el registro de loaders y ViewTemplateLoader,
 * el tipo del propio loader (distinto de este: aquél es la función que
 * importa el módulo, este es la función que el módulo exporta).
 */
export type ViewTemplate = () => string;

/**
 * Tipos comunes para CustomEvent handlers
 */
export interface CustomEventDetail {
  [key: string]: unknown;
}

export interface AchievementEventDetail extends CustomEventDetail {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface MatchEventDetail extends CustomEventDetail {
  match: {
    id: string;
    players: Array<{ name: string; avatar: string }>;
  };
}

export interface ScoreEventDetail extends CustomEventDetail {
  playerId: string;
  score: number;
}

/**
 * Tipos para datos de eventos y torneos
 */
export interface EventChallenge {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
}

export interface TournamentEvent {
  id: string;
  name: string;
  description: string;
  challenges: EventChallenge[];
  rewards: {
    completion: {
      xp: number;
      cosmetics: string[];
    };
  };
}

/**
 * Tipos para logros y recompensas
 */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

export interface Reward {
  type: 'xp' | 'title' | 'cosmetic' | 'badge' | 'theme' | 'effect';
  value: string | number;
}

