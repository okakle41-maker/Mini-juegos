/**
 * gameIcons.ts — set de íconos vectoriales propios del lobby.
 *
 * Reemplaza los íconos genéricos de Lucide por un set temático a
 * medida para este catálogo: monolínea, viewBox 0 0 24 24, stroke =
 * currentColor (hereda el color de --accent vía CSS, igual que antes).
 *
 * Origen: 18 de estos 26 íconos vienen portados tal cual del proyecto
 * legacy (js/core/gameIcons.js + assets/icons/*.svg de ese árbol), que
 * ya los tenía dibujados a mano para mechlock, typix, termita,
 * skillchecks, simon, ring-puzzle, reactor, pairs, neuralfragment,
 * memorygrid, letters, holematch, soup, datarecallgrid, colorcount,
 * bombdefusal, arrow y virusOverload.
 *
 * Los 8 restantes (keyspam-game, rapidlines-game, rhythmclick,
 * sequence-game, progresstiming, bouncebar, circle-game, maze-game) no
 * tenían ícono en el set legacy — se redibujaron a mano en este mismo
 * estilo a partir de referencias visuales entregadas por separado
 * (assets/icons/*.svg de un export de Inkscape cuyos nombres de
 * archivo estaban desfasados de su contenido real, así que el mapeo
 * se hizo mirando cada dibujo, no por nombre de archivo).
 *
 * Uso: GameIcons.get('mechlock') → string SVG completo, o null si el
 * id no tiene ícono propio (el caller debe aplicar su propio fallback,
 * ver LUCIDE_ICON_FALLBACK-equivalente en lobbyRenderer.ts).
 */

function svg(inner: string): string {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' + inner + '</svg>'
  );
}

const ICONS: Record<string, string> = {
  // --- portados del set legacy (js/core/gameIcons.js) ---------------------

  // LÓGICA — engranajes entrelazados (cerradura mecánica)
  'mechlock': svg(
    '<circle cx="9" cy="9" r="2.4"/>' +
    '<path d="M9 4.6v1.6M9 11.8v1.6M4.6 9h1.6M11.8 9h1.6' +
    'M6.1 6.1l1.1 1.1M10.8 10.8l1.1 1.1M11.9 6.1l-1.1 1.1M7.2 10.8l-1.1 1.1"/>' +
    '<circle cx="16" cy="16" r="1.8"/>' +
    '<path d="M16 12.6v1.1M16 18.3v1.1M12.6 16h1.1M18.3 16h1.1' +
    'M13.8 13.8l.8.8M17.4 17.4l.8.8M18.2 13.8l-.8.8M14.6 17.4l-.8.8"/>'
  ),

  // TIPEO — teclado
  'typix': svg(
    '<rect x="2.5" y="6" width="19" height="12" rx="2"/>' +
    '<path d="M6 10h.5M9.5 10h.5M13 10h.5M16.5 10h.5M8 14h8"/>'
  ),

  // MEMORIA — cuadrícula con celda marcada (termita)
  'termita': svg(
    '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>' +
    '<path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>' +
    '<rect x="9.8" y="9.8" width="4.4" height="4.4" rx="0.6" fill="currentColor" stroke="none"/>'
  ),

  // REFLEJOS — diana / objetivo
  'skillchecks': svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5"/>'
  ),

  // SECUENCIA — disco de 4 cuadrantes (Simon)
  'simon': svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 3.5v17M3.5 12h17"/>'
  ),

  // LÓGICA — anillos concéntricos
  'ring-puzzle': svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<circle cx="12" cy="12" r="5"/>' +
    '<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>'
  ),

  // ESTRATEGIA — átomo (reactor)
  'reactor': svg(
    '<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>' +
    '<ellipse cx="12" cy="12" rx="9.5" ry="3.6"/>' +
    '<ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(60 12 12)"/>' +
    '<ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(120 12 12)"/>'
  ),

  // ESTRATEGIA — par de cartas
  'pairs': svg(
    '<rect x="3.5" y="5.5" width="10" height="13.5" rx="1.6"/>' +
    '<rect x="10.5" y="2.5" width="10" height="13.5" rx="1.6"/>'
  ),

  // MEMORIA — red neuronal
  'neuralfragment': svg(
    '<circle cx="5" cy="6.5" r="2"/>' +
    '<circle cx="5" cy="17.5" r="2"/>' +
    '<circle cx="12.5" cy="12" r="2.2"/>' +
    '<circle cx="19" cy="12" r="2"/>' +
    '<path d="M6.7 7.6l4 3M6.7 16.4l4-3M14.7 12H17"/>'
  ),

  // MEMORIA — cuadrícula 3x3
  'memorygrid': svg(
    '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>' +
    '<path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>'
  ),

  // TIPEO — letra cayendo
  'letters': svg(
    '<path d="M5 18.5 9.5 5.5 14 18.5M6.6 14h5.8"/>' +
    '<path d="M18.5 7.5v8M16 13l2.5 2.5L21 13"/>'
  ),

  // PERCEPCIÓN — encajar forma en hueco
  'holematch': svg(
    '<rect x="3" y="3" width="9.5" height="9.5" rx="1.4" stroke-dasharray="2.6 2.2"/>' +
    '<rect x="11.5" y="11.5" width="9.5" height="9.5" rx="1.4"/>'
  ),

  // CIFRADO — candado
  'soup': svg(
    '<rect x="4" y="10" width="16" height="10.5" rx="2"/>' +
    '<path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3"/>' +
    '<path d="M12 14v3"/>'
  ),

  // MEMORIA — base de datos
  'datarecallgrid': svg(
    '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/>' +
    '<path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13"/>' +
    '<path d="M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8"/>'
  ),

  // ANÁLISIS — diagrama de color (Venn)
  'colorcount': svg(
    '<circle cx="9" cy="9.5" r="5"/>' +
    '<circle cx="15" cy="9.5" r="5"/>' +
    '<circle cx="12" cy="15" r="5"/>'
  ),

  // ANÁLISIS — bomba con mecha vertical
  'bombdefusal': svg(
    '<circle cx="11" cy="15.5" r="5.5"/>' +
    '<path d="M11 10V8M11 8h2.4"/>' +
    '<path d="M13.4 8c0-1.8 1-2.6 2.4-2.6s1.8.9 1.8 1.8"/>' +
    '<path d="M17.6 4.3l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" fill="currentColor" stroke="none"/>'
  ),

  // REFLEJOS — flecha
  'arrow': svg(
    '<path d="M12 20.5V4.5"/>' +
    '<path d="M5.5 11 12 4.5 18.5 11"/>'
  ),

  // VIRUS OVERLOAD — biohazard con glitch y exclamación
  'virusOverload': svg(
    '<polyline points="5.5,6 2.5,12 5.5,18" stroke-width="1.8"/>' +
    '<polyline points="18.5,6 21.5,12 18.5,18" stroke-width="1.8"/>' +
    '<line x1="8" y1="6.5" x2="16" y2="17.5" stroke-width="2"/>' +
    '<line x1="16" y1="6.5" x2="8" y2="17.5" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>'
  ),

  // --- redibujados a mano, mismo estilo, para juegos sin ícono legacy -----

  // TIPEO RÁPIDO — cuatro teclas grandes tipo "mash"
  'keyspam-game': svg(
    '<rect x="3" y="4.5" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="4.5" width="7" height="7" rx="1"/>' +
    '<rect x="3" y="12.5" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="12.5" width="7" height="7" rx="1"/>' +
    '<path d="M6.5 8h0M6.5 16h0M17.5 8h0M17.5 16h0" stroke-width="2.4"/>'
  ),

  // REFLEJOS — rombo con líneas de velocidad y partículas
  'rapidlines-game': svg(
    '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/>' +
    '<path d="M7.5 13.5l4-4M9 15l4-4M10.5 16.5l4-4"/>' +
    '<circle cx="18.5" cy="7" r=".6" fill="currentColor" stroke="none"/>' +
    '<circle cx="20.2" cy="9.2" r=".5" fill="currentColor" stroke="none"/>' +
    '<circle cx="16.7" cy="5.5" r=".4" fill="currentColor" stroke="none"/>'
  ),

  // RITMO — onda de audio con nota
  'rhythmclick': svg(
    '<path d="M4 12h2.5l1.5-5 2 10 2-8 1.5 3H17.5"/>' +
    '<circle cx="18.7" cy="12" r="1.8"/>'
  ),

  // SECUENCIA — puntos en fila, patrón parcial
  'sequence-game': svg(
    '<circle cx="3.8" cy="12" r="2" fill="currentColor" stroke="none"/>' +
    '<circle cx="9.2" cy="12" r="2" fill="currentColor" stroke="none"/>' +
    '<circle cx="14.6" cy="12" r="2"/>' +
    '<circle cx="20" cy="12" r="2" stroke-dasharray="1.5 1.5"/>'
  ),

  // TIMING — reloj con manecilla en ángulo
  'progresstiming': svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 12 16 8"/>' +
    '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'
  ),

  // SKILL CHECK — mismo ícono que rapidlines-game (así lo asocia el
  // propio catálogo en views/skillchecks.ts: 'bouncebar' → rapid-lines.svg)
  'bouncebar': svg(
    '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/>' +
    '<path d="M7.5 13.5l4-4M9 15l4-4M10.5 16.5l4-4"/>' +
    '<circle cx="18.5" cy="7" r=".6" fill="currentColor" stroke="none"/>' +
    '<circle cx="20.2" cy="9.2" r=".5" fill="currentColor" stroke="none"/>' +
    '<circle cx="16.7" cy="5.5" r=".4" fill="currentColor" stroke="none"/>'
  ),

  // SKILL CHECK — mismo ícono que progresstiming (así lo asocia el
  // propio catálogo en views/skillchecks.ts: 'multipoint' → progress-timing.svg)
  'multipoint': svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 12 16 8"/>' +
    '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'
  ),

  // PRECISIÓN — círculo con mira de cuadrantes
  'circle-game': svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>' +
    '<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>'
  ),

  // LABERINTO — recorrido con inicio y fin
  'maze-game': svg(
    '<rect x="3.5" y="3.5" width="17" height="17" rx="1.6"/>' +
    '<path d="M7 3.5v6h4v-3h4v7h-4M11 17.5v-3.5h6v-4"/>' +
    '<circle cx="7" cy="17" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/>'
  ),
};

const GameIcons = {
  get(id: string): string | null {
    return ICONS[id] ?? null;
  },
  has(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(ICONS, id);
  },
};

/**
 * Íconos de UI genéricos (no ligados a un juego del catálogo): racha,
 * hora relativa, prioridad y reproducir. Reemplazan a los equivalentes
 * de Lucide (flame/clock/alert-triangle/play) que se usaban antes,
 * dibujados a mano en el mismo estilo monolínea para no depender de
 * ninguna librería externa.
 */
export const UiIcons = {
  flame: svg(
    '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3 1.8-4.7 2.6-7.3.4 1.6 1.4 2.6 2.4 2.6-.3-3 1-5.2 3-6.8-.5 2.3.4 3.6 1.8 5 1.6 1.6 2.7 3.3 2.7 5.5 0 3.9-2.5 7-6 7Z"/>' +
    '<path d="M12 21c-1.8 0-3-1.3-3-3 0-1.6 1-2.5 1.5-3.7.2.8.7 1.3 1.2 1.3-.1-1.5.6-2.5 1.6-3.2-.2 1.1.3 1.8 1 2.3.8.7 1.2 1.6 1.2 2.6 0 2-1.3 3.7-3.5 3.7Z"/>'
  ),
  clock: svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 7v5l3.5 2"/>'
  ),
  'alert-triangle': svg(
    '<path d="M12 3.5 21 19.5H3Z"/>' +
    '<path d="M12 9.5v4.5"/>' +
    '<circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>'
  ),
  play: svg(
    '<path d="M7 4.5v15l13-7.5Z" fill="currentColor" stroke="none"/>'
  ),
};

export default GameIcons;
