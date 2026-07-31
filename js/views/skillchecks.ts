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
 * y nada más, así que todo este menú (la puerta de entrada a los
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
  { game: 'rapidlines', icon: '⚡', title: 'Rapid Lines', alt: '⚡ Rapid Lines' },
  { game: 'circle', icon: '🎯', title: 'Circle', alt: '🎯 Circle' },
  { game: 'maze', icon: '🧩', title: 'Maze', alt: '🧩 Maze' },
  { game: 'keyspam', icon: '⌨️', title: 'Key Spam', alt: '⌨️ Key Spam' },
  { game: 'sequence', icon: '🔢', title: 'Sequence', alt: '🔢 Sequence' },
  { game: 'rhythmclick', icon: '🎵', title: 'Rhythm Click', alt: '🎵 Rhythm Click' },
  { game: 'progresstiming', icon: '⏱️', title: 'Progress Timing', alt: '⏱️ Progress Timing' },
  { game: 'multipoint', icon: '🎯', title: 'Multi-Point', alt: '🎯 Multi-Point' },
  { game: 'bouncebar', icon: '🏀', title: 'Bounce Bar', alt: '🏀 Bounce Bar' },
  { game: 'holdrelease', icon: '🤚', title: 'Hold & Release', alt: '🤚 Hold & Release' },
  { game: 'targetpop', icon: '🎪', title: 'Target Pop', alt: '🎪 Target Pop' },
  { game: 'chordkeys', icon: '🎹', title: 'Chord Keys', alt: '🎹 Chord Keys' },
  { game: 'orbitcatch', icon: '🪐', title: 'Orbit Catch', alt: '🪐 Orbit Catch' },
  { game: 'lanedodge', icon: '🏎️', title: 'Lane Dodge', alt: '🏎️ Lane Dodge' },
  { game: 'pipealign', icon: '🔧', title: 'Pipe Align', alt: '🔧 Pipe Align' },
];

/** Un cubo del selector: ícono + título, activable por click, Enter o Space (ver skillchecksHub.logic.ts). */
function renderCube(c: SkillCube, index: number): string {
  const staggerDelay = index * 0.05; // 50ms delay per card
  return `
  <div class="skill-cube" data-game="${c.game}" role="button" tabindex="0" aria-label="Abrir ${c.title}" style="--stagger-delay: ${staggerDelay}s">
        <span class="cube-icon">${c.icon}</span>
    <span class="cube-title">${c.title}</span>
    <div class="bottom-glow"></div>
  </div>`;
}

const template = (): string => {
  return `
<div class="skillcheck-selector">
    <button class="back-btn" data-back-to="home"></button>

${SKILL_CUBES.map((cube, index) => renderCube(cube, index)).join('\n')}

</div>

`;
};

export default template satisfies ViewTemplate;
