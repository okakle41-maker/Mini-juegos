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

  // Inyectar CSS de skeleton
  injectStyles(): void {
    if (document.getElementById('skeleton-styles')) return;

    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
      .skeleton {
        background: linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%);
        background-size: 200% 100%;
        border-radius: 8px;
        pointer-events: none;
      }

      .skeleton--shimmer {
        animation: shimmer 1.5s infinite;
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .skeleton--dark {
        background: linear-gradient(90deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%);
        background-size: 200% 100%;
      }

      .skeleton-wrapper {
        padding: 1rem;
      }

      .skeleton-card {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
        margin-bottom: 1rem;
      }

      .skeleton-card__image {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        flex-shrink: 0;
      }

      .skeleton-card__content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .skeleton-card__title {
        height: 20px;
        width: 60%;
        border-radius: 4px;
      }

      .skeleton-card__text {
        height: 16px;
        width: 100%;
        border-radius: 4px;
      }

      .skeleton-card__text--short {
        width: 40%;
      }

      .skeleton-list {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .skeleton-list__avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .skeleton-list__content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .skeleton-list__title {
        height: 16px;
        width: 50%;
        border-radius: 4px;
      }

      .skeleton-list__text {
        height: 14px;
        width: 70%;
        border-radius: 4px;
      }

      .skeleton-list__action {
        width: 80px;
        height: 32px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .skeleton-text {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
      }

      .skeleton-text__line {
        height: 16px;
        width: 100%;
        border-radius: 4px;
      }

      .skeleton-text__line--short {
        width: 60%;
      }

      .skeleton-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
      }

      .skeleton-button {
        height: 40px;
        width: 120px;
        border-radius: 8px;
      }

      .skeleton-badge {
        width: 60px;
        height: 24px;
        border-radius: 12px;
      }

      .skeleton-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
      }

      .skeleton-stat__value {
        height: 32px;
        width: 60px;
        border-radius: 4px;
      }

      .skeleton-stat__label {
        height: 14px;
        width: 40px;
        border-radius: 4px;
      }

      .skeleton-chart {
        display: flex;
        align-items: flex-end;
        gap: 0.5rem;
        height: 100px;
        padding: 1rem;
      }

      .skeleton-chart__bar {
        flex: 1;
        border-radius: 4px 4px 0 0;
        min-height: 20px;
      }

      .skeleton-chart__bar--1 { height: 40%; }
      .skeleton-chart__bar--2 { height: 70%; }
      .skeleton-chart__bar--3 { height: 50%; }
      .skeleton-chart__bar--4 { height: 90%; }
      .skeleton-chart__bar--5 { height: 30%; }

      .skeleton-summary {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        margin-bottom: 1rem;
      }

      .skeleton-summary__item {
        flex: 1;
        height: 60px;
        border-radius: 8px;
      }

      .skeleton-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
      }

      .skeleton-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin-top: 1rem;
      }

      .skeleton-level {
        padding: 1.5rem;
        margin-bottom: 1rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
      }

      .skeleton-level__info {
        height: 40px;
        width: 60%;
        margin-bottom: 1rem;
        border-radius: 4px;
      }

      .skeleton-level__bar {
        height: 20px;
        width: 100%;
        border-radius: 10px;
      }

      .skeleton-profile {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 2rem;
        margin-bottom: 2rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
      }

      .skeleton-profile__avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .skeleton-profile__info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .skeleton-profile__name {
        height: 24px;
        width: 40%;
        border-radius: 4px;
      }

      .skeleton-profile__title {
        height: 18px;
        width: 30%;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(style);
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
