/**
 * js/views/skillchecks.ts
 *
 * Template de la vista "Skillchecks" (antes public/views/skillchecks.html).
 * Migrado de fragmento HTML estático a función TS que devuelve el markup,
 * para que viewManager la traiga vía import() dinámico en vez de fetch(),
 * manteniendo el mismo lazy-loading pero con code-splitting de Vite.
 *
 * Los 9 cubos seguían el mismo patrón visual (icono + título) casi
 * palabra por palabra: ahora se generan desde SKILL_CUBES. De paso se
 * agregó role="button"/tabindex/aria-label a cada uno — antes eran
 * <div data-game="..."> con un click listener en skillchecksHub.logic.ts
 * y nada más, así que todo este menú (la puerta de entrada a los 9
 * juegos de skillcheck) era invisible para navegación por teclado.
 */
import type { ViewTemplate } from '../types/game.js';

interface SkillCube {
  /** Debe coincidir con la key del mapa `map` en skillchecksHub.logic.ts. */
  game: string;
  icon: string;
  title: string;
  /** alt del ícono; varios quedaron en minúscula/inconsistente en el HTML original, se preservan tal cual para no generar diffs de assets. */
  alt: string;
}

const SKILL_CUBES: SkillCube[] = [
  { game: 'rapidlines', icon: 'rapid-lines.svg', title: 'Rapid Lines', alt: 'Rapid Lines' },
  { game: 'circle', icon: 'circle.svg', title: 'Circle', alt: 'circle' },
  { game: 'maze', icon: 'maze.svg', title: 'Maze', alt: 'Maze' },
  { game: 'keyspam', icon: 'key-spam.svg', title: 'Key Spam', alt: 'keys pam' },
  { game: 'sequence', icon: 'sequence.svg', title: 'Sequence', alt: 'sequence' },
  { game: 'rhythmclick', icon: 'rhythm-click.svg', title: 'Rhythm Click', alt: 'Rhythm Click' },
  { game: 'progresstiming', icon: 'progress-timing.svg', title: 'Progress timing', alt: 'Progress timing' },
  { game: 'multipoint', icon: 'progress-timing.svg', title: 'Multi-Point', alt: 'Multi-Point' },
  { game: 'bouncebar', icon: 'rapid-lines.svg', title: 'Bounce Bar', alt: 'Bounce Bar' },
];

/** Un cubo del selector: ícono + título, activable por click, Enter o Space (ver skillchecksHub.logic.ts). */
function renderCube(c: SkillCube): string {
  return `
  <div class="skill-cube" data-game="${c.game}" role="button" tabindex="0" aria-label="Abrir ${c.title}">
        <img
        class="cube-icon"
        src="assets/icons/${c.icon}"
        alt="${c.alt}">
    <span class="cube-title">${c.title}</span>
    <div class="bottom-glow"></div>
  </div>`;
}

const template = (): string => {
  return `
<div class="skillcheck-selector">
    <button class="back-btn" data-back-to="home"></button>

${SKILL_CUBES.map(renderCube).join('\n')}

</div>

`;
};

export default template satisfies ViewTemplate;
