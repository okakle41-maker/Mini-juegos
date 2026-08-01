/**
 * favoritesManager.ts — Sistema de favoritos para minijuegos
 * Versión TypeScript
 */

import safeStorage from './core/safeStorage.js';

export interface FavoritesInterface {
  toggle: (gameId: string) => boolean;
  isFavorite: (gameId: string) => boolean;
  getAll: () => string[];
  count: () => number;
  clear: () => void;
  refreshCard: (gameId: string) => void;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

class FavoritesManager implements FavoritesInterface {
  private storageKey = 'minijuegos_favorites';
  private favorites = new Set<string>();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const stored = safeStorage.getJSON<string[]>(this.storageKey, [], {
      validate: isStringArray,
    });
    this.favorites = new Set(stored);
  }

  private saveToStorage(): void {
    safeStorage.setJSON(this.storageKey, Array.from(this.favorites));
  }

  /**
   * Alterna favorito y retorna el nuevo estado
   */
  toggle(gameId: string): boolean {
    if (!gameId) return false;

    const isNowFavorite = !this.favorites.has(gameId);

    if (isNowFavorite) {
      this.favorites.add(gameId);
    } else {
      this.favorites.delete(gameId);
    }

    this.saveToStorage();
    this.refreshCard(gameId);

    return isNowFavorite;
  }

  /**
   * Verifica si un juego es favorito
   */
  isFavorite(gameId: string): boolean {
    return this.favorites.has(gameId);
  }

  /**
   * Retorna todos los favoritos
   */
  getAll(): string[] {
    return Array.from(this.favorites);
  }

  /**
   * Cantidad de favoritos
   */
  count(): number {
    return this.favorites.size;
  }

  /**
   * Limpia todos los favoritos
   */
  clear(): void {
    this.favorites.clear();
    this.saveToStorage();
  }

  /**
   * Actualiza la UI de la tarjeta (icono de estrella + clase de la card)
   * Selectores alineados a css/styles.css: .card-favorite-btn y .game-card--favorite
   */
  refreshCard(gameId: string): void {
    const cards = document.querySelectorAll<HTMLElement>(`[data-game-id="${gameId}"]`);
    const isFav = this.isFavorite(gameId);

    cards.forEach(card => {
      card.classList.toggle('game-card--favorite', isFav);

      const favBtn = card.querySelector<HTMLButtonElement>('.card-favorite-btn');
      if (favBtn) {
        favBtn.setAttribute('aria-pressed', isFav.toString());
        favBtn.setAttribute('aria-label', isFav ? 'Quitar de favoritos' : 'Añadir a favoritos');
        favBtn.textContent = isFav ? '★' : '☆';
      }
    });
  }
}

// Instancia única
const Favorites = new FavoritesManager();

export default Favorites;