/**
 * js/components/FilterBar.tsx
 *
 * Continuación de la migración a Preact de lobbyRenderer.tsx (ver
 * GameCard.tsx para la fase anterior): reemplaza renderFilterBar(), que
 * armaba los `<button class="filter-btn">` con document.createElement +
 * appendChild a mano.
 *
 * Deliberadamente NO cambia el resultado visual/estructural: mismo
 * contenedor `#filterBar` (`role="toolbar"`), mismas clases
 * (`.filter-btn`, `.filter-btn--active`), mismos `data-filter`/
 * `data-category`. El botón "TODOS" ya vivía hardcodeado en index.html
 * antes de esta migración (comentario "Los botones de filtro se generan
 * automáticamente..." en el HTML) — acá se unifica: TODOS pasa a ser un
 * tag más de la lista, generado igual que el resto, así el componente no
 * depende de markup externo preexistente dentro de su propio contenedor.
 *
 * El click SÍ se maneja como prop (`onSelect`), a diferencia de GameCard
 * (que todavía delega sus listeners a LobbyRenderer): acá no hay
 * throttle ni prefetch compartido entre botones que justifique mantener
 * addEventListener manual, así que no hay motivo para no usar el patrón
 * declarativo directamente.
 */
import { categorySlug } from '../utils/categorySlug.js';

const TODOS = 'TODOS';

export interface FilterBarProps {
  tags: string[];
  activeFilter: string;
  onSelect: (filter: string) => void;
}

export function FilterBar({ tags, activeFilter, onSelect }: FilterBarProps) {
  const allFilters = [TODOS, ...tags];

  return (
    <>
      {allFilters.map(filter => (
        <button
          key={filter}
          type="button"
          className={`filter-btn${filter === activeFilter ? ' filter-btn--active' : ''}`}
          data-filter={filter}
          data-category={categorySlug(filter)}
          onClick={() => onSelect(filter)}
        >
          {filter}
        </button>
      ))}
    </>
  );
}
