/**
 * js/components/ModuleOfDay.tsx
 *
 * Continuación de la migración a Preact de lobbyRenderer.tsx: reemplaza
 * renderModuleOfDay(), que armaba el bloque "Módulo del Día" con un
 * template string inyectado vía innerHTML.
 *
 * Deliberadamente NO cambia el resultado visual/estructural: misma
 * clase raíz `.module-of-day`, mismos hijos/clases (`.mod-brackets`,
 * `.mod-eyebrow`, `.mod-cta`, etc.), mismo atributo `data-category` y
 * la misma custom property `--accent` inline. El único listener
 * (`click` del CTA) se pasa como prop `onPlay`, siguiendo el mismo
 * criterio que FilterBar: no hay throttle/prefetch compartido entre
 * instancias que justifique delegar a addEventListener manual. El
 * `mouseenter` de prefetch se mantiene como prop `onHoverPrefetch` por
 * el mismo motivo — es un side effect propio de este botón, no algo
 * coordinado entre varias cards.
 *
 * `display.icon` sigue siendo un SVG de confianza (GameIcons, no dato
 * de usuario) inyectado vía dangerouslySetInnerHTML, igual que en
 * GameCard.tsx. `display.name`/`display.description`/`display.tag` se
 * pasan como children de texto normal, escapados automáticamente por
 * Preact — reemplazando el escapeHtml implícito que el string template
 * anterior NO tenía para estos campos (aunque en la práctica siempre
 * vinieron de GameConfig hardcodeado, nunca de input de usuario).
 */
import { UiIcons } from '../core/gameIcons.js';
import { categorySlug } from '../utils/categorySlug.js';
import type { CSSPropertiesWithVars } from '../types/cssVars.js';

const MAX_DIFFICULTY_DOTS = 5;

export interface ModuleOfDayDisplay {
  name: string;
  tag: string;
  description: string;
  /** SVG del ícono del juego (string de confianza, ver nota de arriba). */
  icon: string;
}

export interface ModuleOfDayProps {
  display: ModuleOfDayDisplay;
  accent: string;
  difficulty: number;
  /** true si se destaca por historial reciente ("Continuar
   *  entrenamiento"); false si es el fallback sin partidas jugadas
   *  ("Módulo del Día"). */
  hasRecentPlay: boolean;
  onPlay: () => void;
  onHoverPrefetch: () => void;
}

/** Diff-bar segmentada (10 tramos), igual que buildDiffBarHTML() en
 *  lobbyRenderer.tsx (no se reutiliza ese helper porque produce un
 *  string HTML; acá el equivalente declarativo es más simple que
 *  seguir pasando por dangerouslySetInnerHTML para algo tan chico). */
function DiffBarSegmented({ pct, segments = 10 }: { pct: number; segments?: number }) {
  const filled = Math.round((pct / 100) * segments);
  return (
    <div className="diffbar-seg">
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={i < filled ? 'filled' : ''} />
      ))}
    </div>
  );
}

export function ModuleOfDay({
  display,
  accent,
  difficulty,
  hasRecentPlay,
  onPlay,
  onHoverPrefetch,
}: ModuleOfDayProps) {
  const diffPct = (difficulty / MAX_DIFFICULTY_DOTS) * 100;
  const eyebrowLabel = hasRecentPlay ? 'Continuar entrenamiento' : 'Módulo del Día';

  return (
    <div
      className="module-of-day"
      data-category={categorySlug(display.tag)}
      style={{ '--accent': accent } as CSSPropertiesWithVars}
    >
      <span className="mod-brackets" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </span>
      <div className="mod-inner">
        <div className="mod-eyebrow">
          <span className="mod-eyebrow-dot" />
          <span className="mod-eyebrow-label">{eyebrowLabel}</span>
          <span className="mod-eyebrow-line" />
          <span className="mod-eyebrow-priority">
            <span
              className="mod-eyebrow-priority-icon"
              dangerouslySetInnerHTML={{ __html: UiIcons['alert-triangle'] }}
            />
            Prioridad Alta
          </span>
        </div>
        <div className="mod-body">
          <div className="mod-main">
            <div className="mod-head">
              <span
                className="mod-icon-box"
                dangerouslySetInnerHTML={{ __html: display.icon }}
              />
              <div>
                <h3 className="mod-name">{display.name}</h3>
                <span className="mod-tag">{display.tag}</span>
              </div>
            </div>
            <p className="mod-desc">{display.description}</p>
            <div className="mod-meta">
              <div>
                <span className="mod-meta-label">Dificultad</span>
                <div className="mod-diffbar">
                  <DiffBarSegmented pct={diffPct} />
                </div>
              </div>
            </div>
          </div>
          <div className="mod-side">
            <button
              type="button"
              className="mod-cta"
              id="modOfDayCta"
              onMouseEnter={onHoverPrefetch}
              onClick={onPlay}
            >
              <span
                className="mod-cta-icon"
                dangerouslySetInnerHTML={{ __html: UiIcons.play }}
              />
              Iniciar Módulo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
