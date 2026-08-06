/**
 * lobbySidebarUI.ts — Pequeñas mejoras de UI del lobby portadas del
 * mockup "Lobby_B": colapso del sidebar, buscador de módulos en vivo,
 * y contador de favoritos actualizado en tiempo real.
 *
 * Todo aquí es aditivo: no reemplaza ningún módulo existente, solo usa
 * los IDs/clases que GameRegistry, LobbyRenderer y Favorites ya generan.
 */

import Favorites from './favoritesManager.js';

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

function initLobbySearch(): void {
  const input = document.getElementById('lobbySearch') as HTMLInputElement | null;
  const grid = document.getElementById('gameList');
  if (!input || !grid) return;

  let searchTimeout: number | null = null;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    
    // Debounce para mejor rendimiento
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      performSearch(query, grid);
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
      // desde la última tecla escrita, el performSearch('') que
      // corre acá se ve pisado poco después por el performSearch(
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
      performSearch('', grid);
      input.blur();
    }
  });
}

function performSearch(query: string, grid: HTMLElement): void {
  const cards = grid.querySelectorAll<HTMLElement>('.game-card');
  let visibleCount = 0;

  cards.forEach((card) => {
    const name = card.querySelector('.card-name')?.textContent?.toLowerCase() || '';
    // '.card-category' nunca existe en las cards reales que genera
    // lobbyRenderer.ts — esa clase solo aparece en el CSS del estado
    // "--loading" (skeleton placeholder, ver styles.css), no en el
    // markup real de una card renderizada. La clase que sí lleva la
    // categoría/tag visible ("MEMORIA", "REFLEJOS", etc., ver
    // buildCardHTML en lobbyRenderer.ts) es '.card-tag'. Con el
    // selector equivocado, `category` siempre era '' y buscar por
    // categoría en el buscador del lobby nunca encontraba nada, aunque
    // el usuario ve esa etiqueta en pantalla y esperaría poder
    // filtrar/buscar por ella.
    const category = card.querySelector('.card-tag')?.textContent?.toLowerCase() || '';
    const description = card.querySelector('.card-desc')?.textContent?.toLowerCase() || '';
    
    const searchableText = `${name} ${category} ${description}`;
    const matchesSearch = !query || searchableText.includes(query);
    
    if (matchesSearch) {
      card.style.display = '';
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      
      // Animación de entrada para resultados
      requestAnimationFrame(() => {
        card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      });
      
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  // Mostrar mensaje si no hay resultados
  updateNoResultsMessage(grid, query, visibleCount, cards.length);
}

function updateNoResultsMessage(grid: HTMLElement, query: string, visibleCount: number, totalCount: number): void {
  let noResultsMsg = grid.querySelector('.no-results-message') as HTMLElement;
  
  if (query && visibleCount === 0) {
    if (!noResultsMsg) {
      noResultsMsg = document.createElement('div');
      noResultsMsg.className = 'no-results-message';

      const icon = document.createElement('div');
      icon.className = 'no-results-icon';
      icon.textContent = '🔍';

      const text = document.createElement('div');
      text.className = 'no-results-text';
      text.textContent = `No se encontraron resultados para "${query}"`;

      const hint = document.createElement('div');
      hint.className = 'no-results-hint';
      hint.textContent = 'Intenta con otro término de búsqueda';

      noResultsMsg.appendChild(icon);
      noResultsMsg.appendChild(text);
      noResultsMsg.appendChild(hint);
      grid.appendChild(noResultsMsg);
    }
    noResultsMsg.style.display = 'flex';
  } else if (noResultsMsg) {
    noResultsMsg.style.display = 'none';
  }
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
      Promise.resolve().then(updateFavCount);
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
