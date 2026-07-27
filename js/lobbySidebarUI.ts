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

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    grid.querySelectorAll<HTMLElement>('.game-card').forEach((card) => {
      const name = card.querySelector('.card-name')?.textContent?.toLowerCase() || '';
      const matchesSearch = !query || name.includes(query);
      card.style.display = matchesSearch ? '' : 'none';
    });
  });
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
