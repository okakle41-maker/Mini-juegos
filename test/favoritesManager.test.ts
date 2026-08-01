/**
 * Tests para favoritesManager.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Favorites Manager', () => {
  let Favorites: typeof import('../js/favoritesManager').default;

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    // Reimportamos el módulo real en cada test para partir de un estado limpio,
    // ya que FavoritesManager mantiene su Set en memoria como singleton.
    vi.resetModules();
    const mod = await import('../js/favoritesManager');
    Favorites = mod.default;
  });

  describe('toggle', () => {
    it('añade un juego a favoritos si no lo está', () => {
      expect(Favorites.isFavorite('game1')).toBe(false);
      const result = Favorites.toggle('game1');
      expect(result).toBe(true);
      expect(Favorites.isFavorite('game1')).toBe(true);
    });

    it('quita un juego de favoritos si ya lo está', () => {
      Favorites.toggle('game1');
      const result = Favorites.toggle('game1');
      expect(result).toBe(false);
      expect(Favorites.isFavorite('game1')).toBe(false);
    });

    it('ignora un gameId vacío', () => {
      const result = Favorites.toggle('');
      expect(result).toBe(false);
      expect(Favorites.count()).toBe(0);
    });
  });

  describe('isFavorite', () => {
    it('refleja el estado real tras un toggle', () => {
      expect(Favorites.isFavorite('game1')).toBe(false);
      Favorites.toggle('game1');
      expect(Favorites.isFavorite('game1')).toBe(true);
    });
  });

  describe('getAll / count', () => {
    it('retorna todos los juegos marcados como favoritos', () => {
      Favorites.toggle('game1');
      Favorites.toggle('game2');
      Favorites.toggle('game3');

      expect(Favorites.getAll().sort()).toEqual(['game1', 'game2', 'game3']);
      expect(Favorites.count()).toBe(3);
    });
  });

  describe('refreshCard', () => {
    it('actualiza clase, aria y texto del botón de favorito en el DOM', () => {
      document.body.innerHTML = `
        <article data-game-id="game1">
          <button class="card-favorite-btn"></button>
        </article>
      `;

      Favorites.toggle('game1');
      Favorites.refreshCard('game1');

      const card = document.querySelector('[data-game-id="game1"]');
      const btn = document.querySelector('.card-favorite-btn');

      expect(card?.classList.contains('game-card--favorite')).toBe(true);
      expect(btn?.getAttribute('aria-pressed')).toBe('true');
      expect(btn?.textContent).toBe('★');
    });
  });
});
