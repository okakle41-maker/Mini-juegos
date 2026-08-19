/**
 * js/utils/gameGroupMenuController.ts
 *
 * Conecta las cards "hub" del lobby (hoy: "Clásicos", ver
 * js/games/classicsHub.ts) con el popover GameGroupMenu: intercepta el
 * click SOLO en esas cards puntuales (por id) para abrir el menú
 * flotante en vez de navegar, dejando el resto de las cards con su
 * comportamiento normal.
 *
 * Se monta/desmonta un único popover a la vez sobre un contenedor
 * fijo en <body> (mismo patrón que notificationSystem.tsx —
 * ensureMounted() perezoso, render(null, el) para desmontar en vez de
 * recrear el nodo en cada apertura/cierre).
 *
 * Uso:
 *   const handleCardClick = createGameGroupClickHandler({
 *     'classics-hub': CLASSICS_HUB_GAME_IDS,
 *   });
 *   LobbyRenderer.render({ onCardClick: handleCardClick });
 *
 * El mismo controlador cubre tanto el click normal en la card (via
 * onCardClick de LobbyRenderer) como el CTA de "Módulo del Día" (ver
 * openGroupMenuFromElement, usado por app.ts para envolver el onPlay
 * de ModuleOfDay cuando el destacado del día resulta ser una card
 * hub) — ambos casos terminan necesitando lo mismo: el elemento DOM
 * clickeado (para anclar el popover) y el id del grupo.
 */
import { render } from 'preact';
import GameRegistry, { type GameConfig } from '../core/gameRegistry.js';
import ViewManager from '../core/viewManager.js';
import { GameGroupMenu } from '../components/GameGroupMenu.js';

/** Mapa id de card hub -> ids de juegos agrupados, en el orden a
 *  mostrar. Un solo controlador soporta varios grupos a la vez (no
 *  solo "Clásicos") para cuando Skill Check migre a este mismo
 *  mecanismo — ver nota en classicsHub.ts. */
export type GameGroupMap = Record<string, readonly string[]>;

let containerEl: HTMLElement | null = null;

function ensureMounted(): HTMLElement {
  if (containerEl) return containerEl;
  containerEl = document.createElement('div');
  containerEl.className = 'game-group-menu-container';
  document.body.appendChild(containerEl);
  return containerEl;
}

function closeMenu(): void {
  if (!containerEl) return;
  render(null, containerEl);
}

/** Resuelve los GameConfig reales (vía GameRegistry.get) para una
 *  lista de ids, descartando en silencio cualquier id que no exista
 *  en el registro — evita que un id mal tipeado en el mapa de grupos
 *  tire abajo el menú entero; simplemente esa entrada no aparece. */
function resolveGroupGames(gameIds: readonly string[]): GameConfig[] {
  return gameIds
    .map((id) => GameRegistry.get(id))
    .filter((g): g is GameConfig => g !== undefined);
}

/** Abre el popover anclado a `anchorEl` con los juegos del grupo
 *  `groupGameIds`. Reemplaza cualquier popover ya abierto (un solo
 *  menú a la vez: abrir uno nuevo mientras otro está abierto no
 *  debería poder pasar en la práctica —clicks fuera ya lo cerrarían
 *  antes—, pero por robustez el render nuevo pisa limpiamente al
 *  anterior en el mismo contenedor). */
function openGroupMenu(title: string, groupGameIds: readonly string[], anchorEl: HTMLElement): void {
  const games = resolveGroupGames(groupGameIds);
  if (games.length === 0) return; // nada que mostrar, no abrir un menú vacío

  const el = ensureMounted();
  const anchorRect = anchorEl.getBoundingClientRect();

  render(
    <GameGroupMenu
      title={title}
      games={games}
      anchorRect={anchorRect}
      onSelect={(gameId) => ViewManager.showView(gameId)}
      onClose={closeMenu}
    />,
    el
  );
}

/**
 * Crea el `onCardClick` para pasarle a `LobbyRenderer.render()`. Para
 * cards cuyo id está en `groups`, abre el popover de ese grupo
 * anclado al elemento que originó el click, en vez de navegar. Para
 * el resto, replica el comportamiento por defecto de LobbyRenderer
 * (ViewManager.showView(game.id)) — importante no dejarlo "sin hacer
 * nada" para esos casos: onCardClick reemplaza por completo la
 * navegación default en LobbyRenderer (ver openCard/openFeatured en
 * lobbyRenderer.tsx), así que este handler tiene que cubrir también
 * el camino normal o el resto del lobby (incluyendo "Módulo del Día")
 * dejaría de navegar.
 */
export function createGameGroupClickHandler(groups: GameGroupMap) {
  return (game: GameConfig, anchorEl: HTMLElement): void => {
    const groupGameIds = groups[game.id];
    if (!groupGameIds) {
      ViewManager.showView(game.id);
      return;
    }
    openGroupMenu(game.name, groupGameIds, anchorEl);
  };
}
