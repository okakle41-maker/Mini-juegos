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

