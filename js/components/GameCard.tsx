/**
 * js/components/GameCard.tsx
 *
 * Fase 2 de la migración a Preact (ver docs/ARCHITECTURE.md): primer
 * componente real, reemplazando `buildCardHTML()` en lobbyRenderer.ts
 * — que armaba este mismo markup concatenando strings a mano.
 *
 * Deliberadamente NO cambia el resultado visual/estructural: misma
 * clase raíz `.game-card`, mismos hijos/clases (`.card-open-btn`,
 * `.card-favorite-btn`, `.card-hero`, etc.), mismos atributos ARIA
 * (`role="listitem"` en el article + accesibilidad ya arreglada de
 * nested-interactive). Esto es a propósito: todo el CSS existente en
 * styles.css sigue aplicando sin cambios, y los tests que buscan estas
 * clases por selector (lobbyRendererFavoriteKeydown.test.ts) siguen
 * pasando sin tocarlos.
 *
 * Lo que SÍ cambia respecto al string-template anterior:
 * - `isFavorite` deja de requerir regenerar el ícono/aria-pressed a
 *   mano: es una prop, y Preact actualiza solo lo que cambió.
 * - Los SVG de GameIcons/UiIcons (confiables, hardcodeados en el
 *   propio código fuente, no vienen de usuario) se inyectan vía
 *   `dangerouslySetInnerHTML` — el equivalente explícito de Preact al
 *   innerHTML de siempre, mismo nivel de confianza que ya existía.
 * - `game.description`/`game.name` (estos si son datos "de contenido",
 *   aunque igual de confiables por venir de GameConfig hardcodeado, no
 *   de usuario) se pasan como children de texto normal de JSX, que
 *   Preact escapa automáticamente — una capa extra de seguridad que el
 *   string-template anterior no tenía gratis.
 *
 * Los event listeners (click abrir, click favorito, hover/prefetch)
 * NO se migraron a props onClick/onMouseEnter todavía — lobbyRenderer
 * sigue registrándolos con addEventListener sobre el DOM que este
 * componente produce, igual que antes. Se dejan así a propósito en
 * esta fase para minimizar el diff: la lógica de esos listeners
 * (throttle de hover compartido entre cards, prefetch, etc.) vive a
 * nivel de LobbyRenderer, no por-card, así que moverla es un cambio
 * separado y no necesario para validar que el componente en sí
 * funciona.
 */
import type { GameConfig } from '../core/gameRegistry.js';
import { UiIcons } from '../core/gameIcons.js';
import { categorySlug } from '../utils/categorySlug.js';
import type { CSSPropertiesWithVars } from '../types/cssVars.js';

const MAX_DIFFICULTY_DOTS = 5;

export interface GameCardDisplay {
  name: string;
  tag: string;
  description: string;
  /** SVG del ícono del juego (string de confianza, ver nota de arriba). */
  icon: string;
}

export interface GameCardProps {
  game: GameConfig;
  display: GameCardDisplay;
  isFavorite: boolean;
  plays: number;
  ringPct: number;
  lastPlayed: string;
}

function DifficultyDots({ difficulty }: { difficulty: number }) {
  return (
    <div className="diff-dots">
      {Array.from({ length: MAX_DIFFICULTY_DOTS }, (_, i) => (
        <span
          key={i}
          className={`diff-dot ${i < difficulty ? 'diff-dot--filled' : 'diff-dot--empty'}`}
        />
      ))}
    </div>
  );
}

function ProgressRing({ pct, size = 34 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="card-progress-ring" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeDasharray={`${dash} ${circ - dash}`}
        />
      </svg>
      <span className="card-progress-label">{pct}%</span>
    </div>
  );
}

export function GameCard({ game, display, isFavorite, plays, ringPct, lastPlayed }: GameCardProps) {
  return (
    <article
      className={`game-card${isFavorite ? ' game-card--favorite' : ''}`}
      data-game-id={game.id}
      data-tag={display.tag}
      data-category={categorySlug(display.tag)}
      style={{ '--accent': game.accent } as CSSPropertiesWithVars}
      role="listitem"
    >
      <span className="card-accent-strip" />
      <span className="card-spotlight" aria-hidden="true" />
      <button
        className="card-favorite-btn"
        type="button"
        aria-pressed={isFavorite}
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      >
        {isFavorite ? '★' : '☆'}
      </button>
      <button className="card-open-btn" type="button" aria-label={`Abrir módulo ${display.name}`}>
        <div className="card-hero">
          <div className="card-hero-bg" />
          <span className="card-num">{game.num}</span>
          <div className="card-top-row">
            <span className="card-icon-lg" dangerouslySetInnerHTML={{ __html: display.icon }} />
            <div className="card-top-right">
              {plays > 0 && (
                <span
                  className="card-streak"
                  title={`${plays} partida${plays === 1 ? '' : 's'} jugada${plays === 1 ? '' : 's'}`}
                >
                  <span dangerouslySetInnerHTML={{ __html: UiIcons.flame }} />
                  {plays}
                </span>
              )}
              <ProgressRing pct={ringPct} />
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="card-meta">
            <span className="card-tag">{display.tag}</span>
            <span className="card-recent-badge">RECIENTE</span>
          </div>
          <h3 className="card-name">{display.name}</h3>
          <p className="card-desc">{display.description}</p>
          <span className="card-record-badge" hidden />
          <div className="card-bottom">
            <DifficultyDots difficulty={game.difficulty} />
            <span className="card-cta">JUGAR →</span>
          </div>
          <div className="card-footer-row">
            <span className="card-footer-time">
              <span dangerouslySetInnerHTML={{ __html: UiIcons.clock }} />
              {lastPlayed}
            </span>
            <span className="card-footer-score">—</span>
          </div>
        </div>
      </button>
      <span className="card-bottom-glow" />
    </article>
  );
}
