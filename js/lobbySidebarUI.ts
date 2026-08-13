/**
 * lobbySidebarUI.ts — Pequeñas mejoras de UI del lobby portadas del
 * mockup "Lobby_B": colapso del sidebar, buscador de módulos en vivo,
 * y contador de favoritos actualizado en tiempo real.
 *
 * Todo aquí es aditivo: no reemplaza ningún módulo existente, solo usa
 * los IDs/clases que GameRegistry, LobbyRenderer y Favorites ya generan.
 */

import Favorites from './favoritesManager.js';
import LobbyRenderer from './lobbyRenderer.js';

const COLLAPSE_STORAGE_KEY = 'minijuegos_sidenav_collapsed';

function initSidebarCollapse(): void {
  const sideNav = document.getElementById('sideNav');
  const btn = document.getElementById('sideNavCollapseBtn');
  if (!sideNav || !btn) return;

  const collapsed = localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  sideNav.classList.toggle('side-nav--collapsed', collapsed);
  btn.setAttribute('aria-label', collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral');
  // aria-expanded va en el botón que controla el colapso (patrón estándar
  // para disclosure widgets), no en #sideNav: es el control, no la región
  // controlada, el que debe anunciar si lo que abre/cierra está expandido.
  btn.setAttribute('aria-expanded', String(!collapsed));

  btn.addEventListener('click', () => {
    const isCollapsed = sideNav.classList.toggle('side-nav--collapsed');
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(isCollapsed));
    btn.setAttribute('aria-label', isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral');
    btn.setAttribute('aria-expanded', String(!isCollapsed));
  });
}

/**
 * Capa fina de UI del input de búsqueda: debounce, atajo Ctrl/Cmd+K,
 * y Escape para limpiar. La lógica real de qué cards se muestran
 * (antes en performSearch/updateNoResultsMessage, acá mismo) se
 * centralizó en LobbyRenderer.setSearchQuery() — ver la nota grande
 * en lobbyRenderer.tsx sobre por qué: la búsqueda necesitaba conocer
 * el filtro de categoría activo para no pisarlo, y ese estado vive en
 * LobbyRenderer, no acá.
 */
function initLobbySearch(): void {
  const input = document.getElementById('lobbySearch') as HTMLInputElement | null;
  if (!input) return;

  let searchTimeout: number | null = null;

  input.addEventListener('input', () => {
    // Debounce para mejor rendimiento
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      LobbyRenderer.setSearchQuery(input.value);
    }, 150);
  });

  // Soporte para Ctrl/Cmd + K
  // Nota: js/keyboardShortcuts.ts también registra Ctrl/Cmd+K
  // (ahora funcional tras el fix de "mod"). Quedan dos listeners
  // redundantes pero ambos correctos; no se unifican aquí para no
  // ampliar el alcance de este cambio sin necesidad.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  // Limpiar búsqueda con Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Cancelar el debounce del listener de 'input' de arriba: sin
      // esto, si Escape se presiona dentro de la ventana de 150ms
      // desde la última tecla escrita, el setSearchQuery('') que
      // corre acá se ve pisado poco después por el setSearchQuery(
      // <query vieja>) que quedó pendiente — el query capturado en su
      // closure sigue siendo el texto de antes de vaciar el input,
      // así que las cards vuelven a ocultarse solas justo después de
      // que Escape las mostró. Bug real (no solo del test): pasaba
      // igual para cualquier persona que tipeara y presionara Escape
      // rápido, no solo en el entorno de e2e.
      if (searchTimeout) {
        clearTimeout(searchTimeout);
        searchTimeout = null;
      }
      input.value = '';
      LobbyRenderer.setSearchQuery('');
      input.blur();
    }
  });
}

function updateFavCount(): void {
  const el = document.getElementById('favCountStat');
  if (el) el.textContent = String(Favorites.count());
}

function initFavoritesCounter(): void {
  updateFavCount();

  // Se recalcula tras cada click en una estrella de favorito.
  //
  // Bug real anterior: este listener estaba delegado en #gameList
  // escuchando la fase de burbujeo (comportamiento por defecto de
  // addEventListener). Pero favBtn.addEventListener('click', ...) en
  // lobbyRenderer.ts llama e.stopPropagation() para evitar que el
  // click en la estrella también abra el juego (evento de la card
  // padre) — y stopPropagation() corta la propagación hacia TODOS los
  // ancestros, incluido #gameList. El click nunca llegaba a burbujear
  // hasta acá, así que el contador de favoritos del sidebar nunca se
  // actualizaba al tocar una estrella (solo mostraba el valor de la
  // carga inicial).
  //
  // Fix: escuchar en la FASE DE CAPTURA (tercer argumento `true`). La
  // captura baja de document hacia el target ANTES de que el target
  // dispare su propio listener y llame stopPropagation() — en esta
  // fase el evento ya "pasó" por #gameList antes de que exista la
  // oportunidad de cortarlo, así que no se ve afectado por ese
  // stopPropagation() posterior en fase de burbujeo.
  //
  // Ojo: la fase de captura en #gameList se ejecuta ANTES que el
  // listener del propio favBtn (que es donde ocurre
  // Favorites.toggle(gameId), en fase de burbujeo sobre el target).
  // Leer el conteo de forma síncrona acá vería el valor viejo, previo
  // al toggle. Se agenda updateFavCount() para el siguiente microtask
  // (Promise.resolve().then), momento en el que el toggle síncrono ya
  // se ejecutó pero antes de que el usuario pueda interactuar de
  // nuevo.
  document.getElementById('gameList')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.card-favorite-btn')) {
      void Promise.resolve().then(updateFavCount).catch((err: unknown) => {
        console.error('[LobbySidebar] Error al actualizar el contador de favoritos:', err);
      });
    }
  }, true);
}

function init(): void {
  initSidebarCollapse();
  initLobbySearch();
  initFavoritesCounter();
}

document.addEventListener('DOMContentLoaded', init);

export {};
