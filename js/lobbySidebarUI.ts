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
    const category = card.querySelector('.card-category')?.textContent?.toLowerCase() || '';
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
      noResultsMsg.innerHTML = `
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">No se encontraron resultados para "${query}"</div>
        <div class="no-results-hint">Intenta con otro término de búsqueda</div>
      `;
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

  // Se recalcula tras cada click en una estrella de favorito. Delegado en
  // #gameList (ancestro): al burbujear, el propio toggle de Favorites ya
  // corrió en el listener del botón, así que aquí el conteo ya es el nuevo.
  document.getElementById('gameList')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.card-favorite-btn')) {
      updateFavCount();
    }
  });
}

function init(): void {
  initSidebarCollapse();
  initLobbySearch();
  initFavoritesCounter();
}

document.addEventListener('DOMContentLoaded', init);

export {};
