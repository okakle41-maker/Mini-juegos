/**
 * js/components/GameGroupMenu.tsx
 *
 * Menú flotante que se abre al hacer click en una card "hub" del lobby
 * (hoy: la card "Clásicos", ver js/games/classicsHub.ts) en vez de
 * navegar directo a una vista propia. Lista los juegos agrupados bajo
 * esa card; elegir uno navega recién ahí con ViewManager.showView(id)
 * — el mismo destino al que iría el click si esa card individual
 * siguiera existiendo suelta en el lobby.
 *
 * Pensado para ser reutilizable: no sabe nada de "Clásicos" en
 * particular, solo recibe una lista de GameConfig ya resueltos y un
 * punto de anclaje (anchorRect, el getBoundingClientRect() de la card
 * clickeada) — así el mismo componente sirve el día que se agrupe
 * Skill Check de la misma forma (ver comentario en
 * js/games/classicsHub.ts).
 *
 * Cierre: click afuera del menú, tecla Escape, o al elegir un juego
 * (los tres casos llaman a la misma prop onClose). No hay botón "X"
 * explícito a propósito — con los tres mecanismos de arriba ya
 * cubiertos, un cuarto control redundante solo compite por atención
 * dentro de un menú que ya es chico (5 ítems).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameConfig } from '../core/gameRegistry.js';
import { UiIcons } from '../core/gameIcons.js';
import type { CSSPropertiesWithVars } from '../types/cssVars.js';

export interface GameGroupMenuProps {
  /** Título del menú (nombre de la card hub, p.ej. "Clásicos"). */
  title: string;
  /** Juegos a listar, ya resueltos desde GameRegistry en el orden en
   *  que deben aparecer. */
  games: GameConfig[];
  /** getBoundingClientRect() de la card que disparó el menú — el
   *  popover se ancla debajo de ese rect (o arriba si no entra). */
  anchorRect: DOMRect;
  /** Se llama al elegir un juego, con su id — quien renderiza este
   *  componente decide qué hacer (normalmente ViewManager.showView). */
  onSelect: (gameId: string) => void;
  /** Se llama para cerrar el menú sin elegir nada: click afuera,
   *  Escape, o después de onSelect. */
  onClose: () => void;
}

/** Margen respecto al viewport y a la card ancla, en px. Mismo valor
 *  para los cuatro lados por simplicidad — no hay ningún requisito de
 *  diseño que pida algo distinto por lado. */
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 8;
const MENU_WIDTH = 300;

/** Calcula la posición fixed del popover a partir del rect de la card
 *  ancla, clampeada al viewport. Se recalcula en cada apertura (no es
 *  reactivo a scroll/resize mientras está abierto): el menú se cierra
 *  solo con click afuera/Escape/selección, y un reposicionamiento en
 *  vivo agregaría complejidad — listener de scroll/resize, throttle —
 *  para un popover que en la práctica vive unos pocos segundos. */
function computePosition(anchorRect: DOMRect): { top: number; left: number; openUpward: boolean } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Preferir abrir hacia abajo, pegado al borde inferior de la card;
  // si no entra en el espacio restante de la ventana, abrir hacia
  // arriba en su lugar. La altura real del menú (variable según
  // cuántos juegos tenga) no se conoce hasta que se pinta, así que se
  // usa una estimación conservadora (5 ítems ~44px + header ~40px)
  // para decidir el lado — de sobrar espacio la diferencia es
  // imperceptible, y de faltar por poco el propio scroll interno del
  // menú (ver max-height en CSS) lo resuelve igual.
  const ESTIMATED_MENU_HEIGHT = 260;
  const spaceBelow = viewportHeight - anchorRect.bottom;
  const openUpward = spaceBelow < ESTIMATED_MENU_HEIGHT + ANCHOR_GAP && anchorRect.top > ESTIMATED_MENU_HEIGHT + ANCHOR_GAP;

  const top = openUpward
    ? Math.max(VIEWPORT_MARGIN, anchorRect.top - ANCHOR_GAP)
    // Clamp faltante originalmente: sin este Math.min, una card cerca
    // del final de una página larga (probable en el lobby real, con
    // ~16 cards + "Módulo del Día" + barra de filtros) podía dejar el
    // popover completo renderizado por debajo del viewport visible —
    // el navegador SÍ lo scrollea al hacer scrollIntoView antes del
    // click, pero position:fixed no se mueve con ese scroll, así que
    // el ítem seguía "fuera del viewport" para Playwright
    // (`element is outside of the viewport`, timeout en el click).
    // ESTIMATED_MENU_HEIGHT es la misma estimación usada arriba para
    // decidir el lado; no se conoce la altura real hasta pintar, pero
    // clampear con la estimación es siempre mejor que no clampear.
    : Math.min(anchorRect.bottom + ANCHOR_GAP, viewportHeight - ESTIMATED_MENU_HEIGHT - VIEWPORT_MARGIN);

  // Centrado horizontal respecto a la card, clampeado para no salirse
  // del viewport por ninguno de los dos lados.
  const idealLeft = anchorRect.left + anchorRect.width / 2 - MENU_WIDTH / 2;
  const left = Math.min(
    Math.max(idealLeft, VIEWPORT_MARGIN),
    viewportWidth - MENU_WIDTH - VIEWPORT_MARGIN
  );

  return { top, left, openUpward };
}

export function GameGroupMenu({ title, games, anchorRect, onSelect, onClose }: GameGroupMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [{ top, left, openUpward }] = useState(() => computePosition(anchorRect));

  useEffect(() => {
    // Captura en vez de burbujeo: el click que ABRIÓ este menú (sobre
    // el card-open-btn de la card hub) todavía está en vuelo cuando
    // este efecto corre. Si escucháramos en fase de burbujeo con un
    // listener agregado sincrónicamente acá, ese mismo click original
    // terminaría de burbujear hasta document DESPUÉS de haber montado
    // el listener, y se auto-cerraría en el instante en que se abre.
    // La fase de captura baja de document hacia el target ANTES de
    // que el listener original (card-open-btn) llegue a dispararse —
    // en el momento en que ESTE listener corre, el click que abrió el
    // menú ya pasó por completo (el componente se montó recién en el
    // handler de click original, que ya terminó su fase de burbujeo
    // antes de que el próximo click del usuario pueda ocurrir).
    // Igual, por claridad: se registra en un microtask (setTimeout 0)
    // para separar por completo este listener del evento de click que
    // disparó el render, en vez de depender de sutilezas de timing de
    // fases entre el handler de apertura y el montaje del efecto.
    const timer = window.setTimeout(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('click', handleClickOutside, true);
      cleanupClickOutside = () => document.removeEventListener('click', handleClickOutside, true);
    }, 0);

    let cleanupClickOutside: (() => void) | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    // Foco inicial en el primer ítem del menú — sin esto, un usuario
    // de teclado que abre el menú con Enter/Espacio queda con el foco
    // todavía en la card de atrás, sin ninguna pista de que un menú
    // nuevo apareció encima ni forma de navegarlo sin usar el mouse.
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();

    return () => {
      window.clearTimeout(timer);
      cleanupClickOutside?.();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`game-group-menu${openUpward ? ' game-group-menu--upward' : ''}`}
      style={{ top: `${top}px`, left: `${left}px`, width: `${MENU_WIDTH}px` }}
      role="menu"
      aria-label={`Juegos de ${title}`}
    >
      <div className="game-group-menu-header">{title}</div>
      <ul className="game-group-menu-list">
        {games.map((game) => (
          <li key={game.id}>
            <button
              type="button"
              role="menuitem"
              className="game-group-menu-item"
              style={{ '--item-accent': game.accent } as CSSPropertiesWithVars}
              onClick={() => {
                onSelect(game.id);
                onClose();
              }}
            >
              <span
                className="game-group-menu-item-icon"
                dangerouslySetInnerHTML={{ __html: UiIcons.play }}
                aria-hidden="true"
              />
              <span className="game-group-menu-item-label">{game.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
