/**
 * Progresión View Logic
 * Lógica para la vista de progresión y RPG
 */

import { progressionSystem } from '../progressionSystem.js';
import { template } from './progresion.js';

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
  const container = document.getElementById('progresion');
  if (!container) return;

  container.innerHTML = template();
  renderProgression();
  renderDailyQuests();
  renderSkillTree();
  renderSeasonPass();
  setupEventListeners();
  setupProgressionListeners();
}

function renderProgression(): void {
  const currentLevel = progressionSystem.getCurrentLevel();
  const levelData = progressionSystem.getCurrentLevelData();
  const currentXP = progressionSystem.getCurrentXP();
  const xpToNext = progressionSystem.getXPToNextLevel();
  const skillPoints = progressionSystem.getSkillPoints();

  document.getElementById('current-level')!.textContent = currentLevel.toString();
  document.getElementById('level-title')!.textContent = levelData.title;
  document.getElementById('skill-points')!.textContent = skillPoints.toString();
  
  const xpPercentage = (currentXP / xpToNext) * 100;
  document.getElementById('xp-fill')!.style.width = `${xpPercentage}%`;
  document.getElementById('xp-text')!.textContent = `${currentXP} / ${xpToNext} XP`;

  const streak = progressionSystem.getStreak();
  document.getElementById('streak-count')!.textContent = streak.toString();
}

function renderDailyQuests(): void {
  const quests = progressionSystem.getDailyQuests();
  const questsGrid = document.getElementById('daily-quests');
  
  if (questsGrid) {
    questsGrid.innerHTML = quests.map(quest => `
      <div class="quest-card ${quest.completed ? 'quest-card--completed' : ''}">
        <div class="quest-info">
          <h4 class="quest-name">${quest.name}</h4>
          <p class="quest-description">${quest.description}</p>
          <div class="quest-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${(quest.progress / quest.target) * 100}%"></div>
            </div>
            <span class="progress-text">${quest.progress} / ${quest.target}</span>
          </div>
        </div>
        <div class="quest-reward">
          <span class="reward-icon">⭐</span>
          <span class="reward-value">+${quest.reward.xp} XP</span>
          ${quest.reward.skillPoints ? `<span class="reward-skill">+${quest.reward.skillPoints} SP</span>` : ''}
        </div>
      </div>
    `).join('');
  }
}

function renderSkillTree(): void {
  const skillTree = progressionSystem.getSkillTree();
  const unlockedSkills = progressionSystem.getUnlockedSkills();
  const skillPoints = progressionSystem.getSkillPoints();
  const skillTreeGrid = document.getElementById('skill-tree');

  if (skillTreeGrid) {
    skillTreeGrid.innerHTML = skillTree.map(skill => {
      const currentLevel = unlockedSkills.get(skill.id) || 0;
      const canUnlock = progressionSystem.canUnlockSkill(skill.id);
      const isMaxed = currentLevel >= skill.maxLevel;
      
      return `
        <div class="skill-card ${currentLevel > 0 ? 'skill-card--unlocked' : ''} ${isMaxed ? 'skill-card--maxed' : ''}">
          <div class="skill-icon">${skill.icon}</div>
          <div class="skill-info">
            <h4 class="skill-name">${skill.name}</h4>
            <p class="skill-description">${skill.description}</p>
            <div class="skill-level">
              <span class="skill-level-current">${currentLevel}</span>
              <span class="skill-level-separator">/</span>
              <span class="skill-level-max">${skill.maxLevel}</span>
            </div>
            <div class="skill-cost">
              <span class="cost-icon">⭐</span>
              <span class="cost-value">${skill.costPerLevel} SP</span>
            </div>
          </div>
          <button class="skill-unlock-btn" 
                  data-skill-id="${skill.id}"
                  ${!canUnlock || isMaxed ? 'disabled="disabled"' : ''}>
            ${isMaxed ? 'MAX' : 'Desbloquear'}
          </button>
        </div>
      `;
    }).join('');
  }
}

function renderSeasonPass(): void {
  const seasonLevel = progressionSystem.getSeasonPassLevel();
  const seasonPass = progressionSystem.getSeasonPass();
  const isPremium = progressionSystem.isPremiumUnlocked();
  
  document.getElementById('season-level')!.textContent = seasonLevel.toString();
  
  const premiumBtn = document.getElementById('premium-btn');
  if (premiumBtn) {
    premiumBtn.textContent = isPremium ? '👑 Premium Activo' : '👑 Desbloquear Premium';
    (premiumBtn as HTMLButtonElement).disabled = isPremium;
  }

  const rewardsGrid = document.getElementById('season-rewards');
  if (rewardsGrid && seasonPass) {
    rewardsGrid.innerHTML = seasonPass.levels.slice(0, 10).map(level => `
      <div class="season-reward-card ${seasonLevel >= level.level ? 'season-reward-card--unlocked' : ''}">
        <div class="reward-level">${level.level}</div>
        <div class="reward-free">
          <span class="reward-icon">${getRewardIcon(level.freeReward.type)}</span>
        </div>
        ${level.premiumReward ? `
          <div class="reward-premium ${!isPremium ? 'reward-premium--locked' : ''}">
            <span class="reward-icon">${getRewardIcon(level.premiumReward.type)}</span>
          </div>
        ` : ''}
      </div>
    `).join('');
  }
}

function setupEventListeners(): void {
  // Desbloquear habilidades
  document.querySelectorAll('.skill-unlock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const skillId = (btn as HTMLElement).dataset.skillId;
      if (skillId) {
        const success = progressionSystem.unlockSkill(skillId);
        if (success) {
          renderSkillTree();
          renderProgression();
        }
      }
    });
  });

  // Desbloquear premium
  document.getElementById('premium-btn')?.addEventListener('click', () => {
    if (!progressionSystem.isPremiumUnlocked()) {
      progressionSystem.unlockPremium();
      renderSeasonPass();
    }
  });
}

function setupProgressionListeners(): void {
  const xpHandler = () => {
    renderProgression();
  };
  const levelUpHandler = () => {
    renderProgression();
    showLevelUpNotification();
  };
  const skillUnlockHandler = () => {
    renderSkillTree();
    renderProgression();
  };
  const questCompletedHandler = () => {
    renderDailyQuests();
    renderProgression();
  };

  window.addEventListener('progression:xp_gained', xpHandler);
  window.addEventListener('progression:level_up', levelUpHandler);
  window.addEventListener('progression:skill_unlocked', skillUnlockHandler);
  window.addEventListener('progression:quest_completed', questCompletedHandler);

  eventListeners.push(() => {
    window.removeEventListener('progression:xp_gained', xpHandler);
    window.removeEventListener('progression:level_up', levelUpHandler);
    window.removeEventListener('progression:skill_unlocked', skillUnlockHandler);
    window.removeEventListener('progression:quest_completed', questCompletedHandler);
  });
}

function showLevelUpNotification(): void {
  const level = progressionSystem.getCurrentLevel();
  const levelData = progressionSystem.getCurrentLevelData();
  
  const notification = document.createElement('div');
  notification.className = 'level-up-notification';
  notification.innerHTML = `
    <div class="level-up-content">
      <span class="level-up-icon">⬆️</span>
      <div class="level-up-text">
        <h4>¡Nivel Subido!</h4>
        <p>Nivel ${level}: ${levelData.title}</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('level-up-notification--show'), 100);
  setTimeout(() => {
    notification.classList.remove('level-up-notification--show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function getRewardIcon(type: string): string {
  const icons: Record<string, string> = {
    xp: '⭐',
    cosmetic: '🎁',
    title: '🏷️',
    theme: '🎨'
  };
  return icons[type] || '🎁';
}

export function stop(): void {
  // Limpiar event listeners
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  
  // Limpiar caché de elementos
  clearCache();
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('progresion');
  if (container) {
    container.innerHTML = '';
  }
}
