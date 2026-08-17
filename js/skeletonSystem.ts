/**
 * Skeleton System
 * Sistema de skeleton loading para contenido asíncrono y optimización de percepción de carga
 */

type SkeletonType = 'card' | 'list' | 'text' | 'avatar' | 'button' | 'badge' | 'stat' | 'chart';

interface SkeletonConfig {
  type: SkeletonType;
  count?: number;
  className?: string;
  shimmer?: boolean;
  dark?: boolean;
}

interface HTMLElementWithOriginalContent extends HTMLElement {
  _originalContent?: string;
}

class SkeletonSystem {
  private activeSkeletons: Map<string, HTMLElement> = new Map();

  // Generar HTML de skeleton
  generateSkeleton(config: SkeletonConfig): string {
    const { type, count = 1, className = '', shimmer = true, dark = true } = config;
    const baseClass = `skeleton ${shimmer ? 'skeleton--shimmer' : ''} ${dark ? 'skeleton--dark' : ''} ${className}`;

    let skeletonHTML = '';

    for (let i = 0; i < count; i++) {
      skeletonHTML += this.getSkeletonByType(type, baseClass);
    }

    return skeletonHTML;
  }

  private getSkeletonByType(type: SkeletonType, baseClass: string): string {
    switch (type) {
      case 'card':
        return `
          <div class="${baseClass} skeleton-card">
            <div class="skeleton-card__image"></div>
            <div class="skeleton-card__content">
              <div class="skeleton-card__title"></div>
              <div class="skeleton-card__text"></div>
              <div class="skeleton-card__text skeleton-card__text--short"></div>
            </div>
          </div>
        `;

      case 'list':
        return `
          <div class="${baseClass} skeleton-list">
            <div class="skeleton-list__avatar"></div>
            <div class="skeleton-list__content">
              <div class="skeleton-list__title"></div>
              <div class="skeleton-list__text"></div>
            </div>
            <div class="skeleton-list__action"></div>
          </div>
        `;

      case 'text':
        return `
          <div class="${baseClass} skeleton-text">
            <div class="skeleton-text__line"></div>
            <div class="skeleton-text__line skeleton-text__line--short"></div>
          </div>
        `;

      case 'avatar':
        return `
          <div class="${baseClass} skeleton-avatar"></div>
        `;

      case 'button':
        return `
          <div class="${baseClass} skeleton-button"></div>
        `;

      case 'badge':
        return `
          <div class="${baseClass} skeleton-badge"></div>
        `;

      case 'stat':
        return `
          <div class="${baseClass} skeleton-stat">
            <div class="skeleton-stat__value"></div>
            <div class="skeleton-stat__label"></div>
          </div>
        `;

      case 'chart':
        return `
          <div class="${baseClass} skeleton-chart">
            <div class="skeleton-chart__bar skeleton-chart__bar--1"></div>
            <div class="skeleton-chart__bar skeleton-chart__bar--2"></div>
            <div class="skeleton-chart__bar skeleton-chart__bar--3"></div>
            <div class="skeleton-chart__bar skeleton-chart__bar--4"></div>
            <div class="skeleton-chart__bar skeleton-chart__bar--5"></div>
          </div>
        `;

      default:
        return `<div class="${baseClass}"></div>`;
    }
  }

  // Mostrar skeleton en un contenedor
  showSkeleton(containerId: string, config: SkeletonConfig): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skeletonId = `skeleton-${containerId}-${Date.now()}`;
    const skeletonHTML = this.generateSkeleton(config);

    const skeletonWrapper = document.createElement('div');
    skeletonWrapper.id = skeletonId;
    skeletonWrapper.className = 'skeleton-wrapper';
    skeletonWrapper.innerHTML = skeletonHTML;

    // Guardar contenido original
    (skeletonWrapper as HTMLElementWithOriginalContent)._originalContent = container.innerHTML;

    container.innerHTML = '';
    container.appendChild(skeletonWrapper);

    this.activeSkeletons.set(containerId, skeletonWrapper);
  }

  // Ocultar skeleton y restaurar contenido
  hideSkeleton(containerId: string, content?: string): void {
    const skeletonWrapper = this.activeSkeletons.get(containerId);
    if (!skeletonWrapper) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Animación de fade out
    skeletonWrapper.style.opacity = '0';
    skeletonWrapper.style.transition = 'opacity 0.3s ease';

    setTimeout(() => {
      if (content) {
        container.innerHTML = content;
      } else {
        // Restaurar contenido original si no se proporciona nuevo contenido
        container.innerHTML = (skeletonWrapper as HTMLElementWithOriginalContent)._originalContent || '';
      }

      this.activeSkeletons.delete(containerId);
    }, 300);
  }

  // Mostrar skeleton con promesa (para async operations)
  async withSkeleton<T>(
    containerId: string,
    config: SkeletonConfig,
    asyncOperation: () => Promise<T>
  ): Promise<T> {
    this.showSkeleton(containerId, config);

    try {
      const result = await asyncOperation();
      return result;
    } finally {
      this.hideSkeleton(containerId);
    }
  }

  // Skeletons predefinidos para vistas específicas
  getAchievementsSkeleton(): string {
    return `
      <div class="skeleton-wrapper">
        <div class="skeleton skeleton--dark skeleton--shimmer skeleton-summary">
          <div class="skeleton-summary__item"></div>
          <div class="skeleton-summary__item"></div>
          <div class="skeleton-summary__item"></div>
        </div>
        <div class="skeleton-grid">
          ${this.generateSkeleton({ type: 'card', count: 6 })}
        </div>
      </div>
    `;
  }

  getProgressionSkeleton(): string {
    return `
      <div class="skeleton-wrapper">
        <div class="skeleton skeleton--dark skeleton--shimmer skeleton-level">
          <div class="skeleton-level__info"></div>
          <div class="skeleton-level__bar"></div>
        </div>
        <div class="skeleton-grid">
          ${this.generateSkeleton({ type: 'card', count: 4 })}
        </div>
      </div>
    `;
  }

  getLeaderboardSkeleton(): string {
    return `
      <div class="skeleton-wrapper">
        <div class="skeleton skeleton--dark skeleton--shimmer">
          ${this.generateSkeleton({ type: 'list', count: 10 })}
        </div>
      </div>
    `;
  }

  getProfileSkeleton(): string {
    return `
      <div class="skeleton-wrapper">
        <div class="skeleton skeleton--dark skeleton--shimmer skeleton-profile">
          <div class="skeleton-profile__avatar"></div>
          <div class="skeleton-profile__info">
            <div class="skeleton-profile__name"></div>
            <div class="skeleton-profile__title"></div>
          </div>
        </div>
        <div class="skeleton-stats">
          ${this.generateSkeleton({ type: 'stat', count: 4 })}
        </div>
      </div>
    `;
  }

  /** Skeleton de pantalla completa para una vista de juego que
   *  todavía no terminó de cargar (ver ViewManager.loadLazyView). No
   *  se arma con generateSkeleton()/getSkeletonByType() porque esos
   *  están pensados para bloques de contenido dentro de una vista ya
   *  montada (listas, cards, stats) — acá no sabemos de antemano qué
   *  juego es, así que en vez de forzar alguno de esos tipos a
   *  parecerse a "una pantalla de juego" se define un layout propio
   *  (ver .skeleton-game-view en css/skeleton.css): encabezado con
   *  ícono + título, y un área de contenido genérica debajo. */
  getGameViewSkeleton(): string {
    return `
      <div class="skeleton-wrapper skeleton-game-view">
        <div class="skeleton-game-view__header">
          <div class="skeleton skeleton--shimmer skeleton-game-view__icon"></div>
          <div class="skeleton skeleton--shimmer skeleton-game-view__title"></div>
        </div>
        <div class="skeleton skeleton--shimmer skeleton-game-view__body"></div>
      </div>
    `;
  }

  // Los estilos de skeleton viven en css/skeleton.css (cargado desde
  // index.html como el resto de la hoja de estilos del proyecto) — ya
  // no se inyectan desde acá. Este método queda como no-op para no
  // romper cualquier llamada existente a skeletonSystem.injectStyles().
  injectStyles(): void {
    // Intencionalmente vacío — ver css/skeleton.css.
  }

  // Limpiar todos los skeletons activos
  clearAllSkeletons(): void {
    this.activeSkeletons.forEach((skeleton, containerId) => {
      this.hideSkeleton(containerId);
    });
  }
}

// Singleton instance
export const skeletonSystem = new SkeletonSystem();

// Inyectar estilos al iniciar
if (typeof window !== 'undefined') {
  skeletonSystem.injectStyles();
  window.skeletonSystem = skeletonSystem;
}

export default skeletonSystem;
