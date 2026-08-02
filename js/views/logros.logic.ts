/**
 * Logros View Logic
 * Lógica para la vista de logros y trofeos
 */

import { achievementManager } from '../achievements.js';
import { template } from './logros.js';
import type { Achievement, AchievementEventDetail, Reward } from '../types/game';
import { hydrateBackButtons } from '../utils/backButton.js';

let eventListeners: Array<() => void> = [];
let cachedElements: Record<string, HTMLElement | null> = {};

function getElement(id: string): HTMLElement | null {
  if (!cachedElements[id]) {
    cachedElements[id] = document.getElementById(id);
  }
  return cachedElements[id];
}

function clearCache(): void {
  cachedElements = {};
}

export function init(): void {
  const container = document.getElementById('logros');
  if (!container) return;

  // Renderizar template
  container.innerHTML = template();
  hydrateBackButtons(container);

  // Inicializar datos
  renderAchievements();
  renderRewards();
  setupEventListeners();
  setupAchievementListeners();
}

function renderAchievements(): void {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;

  const achievements = achievementManager.getAchievements();
  const unlockedCount = achievementManager.getUnlockedAchievements().length;
  const totalCount = achievements.length;
  const totalXP = achievementManager.getTotalXP();

  // Actualizar resumen
  document.getElementById('achievements-unlocked')!.textContent = unlockedCount.toString();
  document.getElementById('achievements-total')!.textContent = totalCount.toString();
  document.getElementById('achievements-xp')!.textContent = totalXP.toString();

  // Renderizar logros
  grid.innerHTML = achievements.map(achievement => {
    const progress = achievementManager.getAchievementProgress(achievement.id);
    const rarityClass = achievement.reward?.rarity || 'common';
    
    return `
      <div class="achievement-card achievement-card--${rarityClass} ${achievement.unlocked ? 'achievement-card--unlocked' : 'achievement-card--locked'}">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
          <h4 class="achievement-name">${achievement.name}</h4>
          <p class="achievement-description">${achievement.description}</p>
          ${!achievement.unlocked ? `
            <div class="achievement-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
              <span class="progress-text">${Math.round(progress)}%</span>
            </div>
          ` : `
            <div class="achievement-unlocked-date">
              Desbloqueado: ${new Date(achievement.unlockedAt!).toLocaleDateString()}
            </div>
          `}
        </div>
        ${achievement.reward ? `
          <div class="achievement-reward">
            <span class="reward-icon">${getRewardIcon(achievement.reward.type)}</span>
            <span class="reward-value">${formatReward(achievement.reward)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderRewards(): void {
  // Renderizar títulos
  const titlesGrid = document.getElementById('titles-grid');
  if (titlesGrid) {
    const titles = achievementManager.getUnlockedTitles();
    const activeTitle = achievementManager.getActiveTitle();
    
    titlesGrid.innerHTML = titles.length > 0 ? titles.map(title => `
      <div class="title-card ${title === activeTitle ? 'title-card--active' : ''}">
        <span class="title-name">${title}</span>
        ${title === activeTitle ? '<span class="title-active-badge">ACTIVO</span>' : ''}
        <button class="title-equip-btn" data-title="${title}">Equipar</button>
      </div>
    `).join('') : '<p class="no-rewards">No tienes títulos desbloqueados</p>';
  }

  // Renderizar cosméticos
  const cosmeticsGrid = document.getElementById('cosmetics-grid');
  if (cosmeticsGrid) {
    const cosmetics = achievementManager.getUnlockedCosmetics();
    
    cosmeticsGrid.innerHTML = cosmetics.length > 0 ? cosmetics.map(cosmetic => `
      <div class="cosmetic-card">
        <span class="cosmetic-name">${cosmetic}</span>
        <span class="cosmetic-unlocked">✓ Desbloqueado</span>
      </div>
    `).join('') : '<p class="no-rewards">No tienes cosméticos desbloqueados</p>';
  }
}

function setupEventListeners(): void {
  // Filtros de categoría
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      filterAchievements((btn as HTMLElement).dataset.filter || 'all');
    });
  });

  // Filtros de rareza
  const rarityButtons = document.querySelectorAll('.rarity-btn');
  rarityButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('rarity-btn--active');
      filterByRarity((btn as HTMLElement).dataset.rarity || '');
    });
  });

  // Equipar títulos
  document.querySelectorAll('.title-equip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = (btn as HTMLElement).dataset.title;
      if (title) {
        achievementManager.setActiveTitle(title);
        renderRewards();
      }
    });
  });
}

function setupAchievementListeners(): void {
  const achievementHandler = (e: any) => {
    showAchievementNotification(e.detail);
    renderAchievements();
    renderRewards();
  };
  const xpHandler = () => {
    renderAchievements();
  };

  window.addEventListener('achievement:unlocked', achievementHandler);
  window.addEventListener('xp:gained', xpHandler);

  eventListeners.push(() => {
    window.removeEventListener('achievement:unlocked', achievementHandler);
    window.removeEventListener('xp:gained', xpHandler);
  });
}

function filterAchievements(filter: string): void {
  const cards = document.querySelectorAll('.achievement-card');
  cards.forEach(card => {
    const category = card.querySelector('.achievement-description')?.textContent || '';
    const isUnlocked = card.classList.contains('achievement-card--unlocked');
    
    let shouldShow = true;
    
    switch (filter) {
      case 'unlocked':
        shouldShow = isUnlocked;
        break;
      case 'locked':
        shouldShow = !isUnlocked;
        break;
      case 'games':
        shouldShow = category.includes('juego') || category.includes('partida');
        break;
      case 'streak':
        shouldShow = category.includes('racha') || category.includes('días');
        break;
      case 'score':
        shouldShow = category.includes('puntos') || category.includes('puntuación');
        break;
      case 'special':
        shouldShow = category.includes('perfecto') || category.includes('velocidad');
        break;
    }
    
    (card as HTMLElement).style.display = shouldShow ? 'block' : 'none';
  });
}

function filterByRarity(rarity: string): void {
  const cards = document.querySelectorAll('.achievement-card');
  cards.forEach(card => {
    const hasRarity = card.classList.contains(`achievement-card--${rarity}`);
    const isActive = document.querySelector(`.rarity-btn[data-rarity="${rarity}"]`)?.classList.contains('rarity-btn--active');
    
    if (isActive && !hasRarity) {
      (card as HTMLElement).style.display = 'none';
    } else if (!isActive) {
      (card as HTMLElement).style.display = 'block';
    }
  });
}

function showAchievementNotification(achievement: any): void {
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-notification-content">
      <span class="achievement-notification-icon">${achievement.icon}</span>
      <div class="achievement-notification-text">
        <h4>¡Logro Desbloqueado!</h4>
        <p>${achievement.name}</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('achievement-notification--show');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('achievement-notification--show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function getRewardIcon(type: string): string {
  const icons: Record<string, string> = {
    xp: '⭐',
    title: '🏷️',
    theme: '🎨',
    effect: '✨',
    badge: '🎖️',
    cosmetic: '🎁'
  };
  return icons[type] || '🎁';
}

function formatReward(reward: Reward): string {
  if (reward.type === 'xp') return `${reward.value} XP`;
  if (reward.type === 'title') return String(reward.value);
  if (reward.type === 'cosmetic') return String(reward.value);
  return String(reward.value);
}

export function stop(): void {
  // Limpiar event listeners
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  
  // Limpiar caché de elementos
  clearCache();
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('logros');
  if (container) {
    container.innerHTML = '';
  }
}
