/**
 * Progression System - RPG-like progression
 * Sistema de progresión con niveles, XP, habilidades y daily quests
 */

export interface PlayerLevel {
  level: number;
  xpRequired: number;
  title: string;
  rewards: {
    skillPoints: number;
    cosmetics?: string[];
  };
}

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'time' | 'score' | 'xp' | 'special';
  maxLevel: number;
  costPerLevel: number;
  effect: {
    type: 'bonus_xp' | 'bonus_score' | 'time_extension' | 'extra_lives' | 'hint_unlock';
    value: number;
  };
  prerequisiteId?: string;
}

export interface DailyQuest {
  id: string;
  name: string;
  description: string;
  type: 'play_games' | 'complete_games' | 'high_score' | 'play_specific' | 'streak';
  target: number;
  gameId?: string;
  reward: {
    xp: number;
    skillPoints?: number;
  };
  progress: number;
  completed: boolean;
  expiresAt: number;
}

export interface SeasonPass {
  id: string;
  name: string;
  startDate: number;
  endDate: number;
  levels: SeasonPassLevel[];
}

export interface SeasonPassLevel {
  level: number;
  freeReward: {
    type: 'xp' | 'cosmetic' | 'title';
    value: string | number;
  };
  premiumReward?: {
    type: 'cosmetic' | 'title' | 'theme';
    value: string;
  };
}

class ProgressionSystem {
  private currentLevel: number = 1;
  private currentXP: number = 0;
  private skillPoints: number = 0;
  private unlockedSkills: Map<string, number> = new Map();
  private dailyQuests: DailyQuest[] = [];
  private seasonPassProgress: number = 0;
  private premiumUnlocked: boolean = false;
  private streak: number = 0;
  private lastQuestReset: number = 0;
  
  private storageKeys = {
    level: 'prog-level',
    xp: 'prog-xp',
    skillPoints: 'prog-skill-points',
    skills: 'prog-skills',
    quests: 'prog-quests',
    seasonPass: 'prog-season-pass',
    premium: 'prog-premium',
    streak: 'prog-streak',
    lastReset: 'prog-last-reset'
  };

  private levels: PlayerLevel[] = this.defineLevels();
  private skillTree: SkillNode[] = this.defineSkillTree();
  private currentSeason: SeasonPass | null = null;

  constructor() {
    this.loadProgress();
    this.initializeDailyQuests();
    this.initializeSeasonPass();
  }

  private defineLevels(): PlayerLevel[] {
    const levels: PlayerLevel[] = [];
    const baseXP = 100;
    const xpMultiplier = 1.5;

    for (let i = 1; i <= 100; i++) {
      const xpRequired = Math.floor(baseXP * Math.pow(xpMultiplier, i - 1));
      let title = 'Recluta';
      let skillPointsReward = 1;

      if (i >= 5) title = 'Cadete';
      if (i >= 10) { title = 'Soldado'; skillPointsReward = 2; }
      if (i >= 20) { title = 'Sargento'; skillPointsReward = 3; }
      if (i >= 30) { title = 'Teniente'; skillPointsReward = 4; }
      if (i >= 40) { title = 'Capitán'; skillPointsReward = 5; }
      if (i >= 50) { title = 'Comandante'; skillPointsReward = 6; }
      if (i >= 60) { title = 'Mayor'; skillPointsReward = 7; }
      if (i >= 70) { title = 'Coronel'; skillPointsReward = 8; }
      if (i >= 80) { title = 'General'; skillPointsReward = 9; }
      if (i >= 90) { title = 'Mariscal'; skillPointsReward = 10; }
      if (i >= 100) { title = 'Gran Mariscal'; skillPointsReward = 15; }

      levels.push({
        level: i,
        xpRequired,
        title,
        rewards: {
          skillPoints: skillPointsReward
        }
      });
    }

    return levels;
  }

  private defineSkillTree(): SkillNode[] {
    return [
      // Time bonuses
      {
        id: 'time_bonus_1',
        name: 'Tiempo Extra I',
        description: '+5 segundos de tiempo en todos los juegos',
        icon: '⏱️',
        category: 'time',
        maxLevel: 3,
        costPerLevel: 1,
        effect: { type: 'time_extension', value: 5 }
      },
      {
        id: 'time_bonus_2',
        name: 'Tiempo Extra II',
        description: '+10 segundos de tiempo en todos los juegos',
        icon: '⏰',
        category: 'time',
        maxLevel: 3,
        costPerLevel: 2,
        effect: { type: 'time_extension', value: 10 },
        prerequisiteId: 'time_bonus_1'
      },
      // Score bonuses
      {
        id: 'score_bonus_1',
        name: 'Puntuación Extra I',
        description: '+10% de puntuación en todos los juegos',
        icon: '📈',
        category: 'score',
        maxLevel: 5,
        costPerLevel: 1,
        effect: { type: 'bonus_score', value: 10 }
      },
      {
        id: 'score_bonus_2',
        name: 'Puntuación Extra II',
        description: '+25% de puntuación en todos los juegos',
        icon: '📊',
        category: 'score',
        maxLevel: 3,
        costPerLevel: 3,
        effect: { type: 'bonus_score', value: 25 },
        prerequisiteId: 'score_bonus_1'
      },
      // XP bonuses
      {
        id: 'xp_bonus_1',
        name: 'Aprendizaje Rápido I',
        description: '+15% de XP ganada',
        icon: '🧠',
        category: 'xp',
        maxLevel: 5,
        costPerLevel: 2,
        effect: { type: 'bonus_xp', value: 15 }
      },
      {
        id: 'xp_bonus_2',
        name: 'Aprendizaje Rápido II',
        description: '+30% de XP ganada',
        icon: '💡',
        category: 'xp',
        maxLevel: 3,
        costPerLevel: 4,
        effect: { type: 'bonus_xp', value: 30 },
        prerequisiteId: 'xp_bonus_1'
      },
      // Special abilities
      {
        id: 'extra_lives',
        name: 'Vidas Extra',
        description: '+1 vida en juegos que soporten vidas',
        icon: '❤️',
        category: 'special',
        maxLevel: 3,
        costPerLevel: 3,
        effect: { type: 'extra_lives', value: 1 }
      },
      {
        id: 'hint_unlock',
        name: 'Sistema de Pistas',
        description: 'Desbloquea pistas en juegos compatibles',
        icon: '💡',
        category: 'special',
        maxLevel: 1,
        costPerLevel: 5,
        effect: { type: 'hint_unlock', value: 1 }
      }
    ];
  }

  private initializeSeasonPass(): void {
    // Create a season that lasts 30 days
    const now = Date.now();
    const seasonStart = now - (now % (30 * 24 * 60 * 60 * 1000)); // Start of current 30-day period
    const seasonEnd = seasonStart + (30 * 24 * 60 * 60 * 1000);

    this.currentSeason = {
      id: 'season_1',
      name: 'Temporada 1: Entrenamiento Básico',
      startDate: seasonStart,
      endDate: seasonEnd,
      levels: this.generateSeasonPassLevels()
    };
  }

  private generateSeasonPassLevels(): SeasonPassLevel[] {
    const levels: SeasonPassLevel[] = [];
    const cosmetics = ['badge_1', 'badge_2', 'frame_1', 'frame_2', 'avatar_1', 'avatar_2'];
    const titles = ['Entrenador', 'Mentor', 'Guía', 'Maestro'];

    for (let i = 1; i <= 50; i++) {
      const freeReward: SeasonPassLevel['freeReward'] = {
        type: 'xp',
        value: 100 * i
      };

      if (i % 5 === 0) {
        freeReward.type = 'cosmetic';
        freeReward.value = cosmetics[Math.floor((i / 5) - 1) % cosmetics.length];
      }

      if (i % 10 === 0) {
        freeReward.type = 'title';
        freeReward.value = titles[Math.floor((i / 10) - 1) % titles.length];
      }

      const premiumReward = i % 3 === 0 ? {
        type: 'cosmetic' as const,
        value: `premium_cosmetic_${i}`
      } : undefined;

      levels.push({
        level: i,
        freeReward,
        premiumReward
      });
    }

    return levels;
  }

  private loadProgress(): void {
    this.currentLevel = parseInt(localStorage.getItem(this.storageKeys.level) || '1', 10);
    this.currentXP = parseInt(localStorage.getItem(this.storageKeys.xp) || '0', 10);
    this.skillPoints = parseInt(localStorage.getItem(this.storageKeys.skillPoints) || '0', 10);
    this.seasonPassProgress = parseInt(localStorage.getItem(this.storageKeys.seasonPass) || '0', 10);
    this.premiumUnlocked = localStorage.getItem(this.storageKeys.premium) === 'true';
    this.streak = parseInt(localStorage.getItem(this.storageKeys.streak) || '0', 10);
    this.lastQuestReset = parseInt(localStorage.getItem(this.storageKeys.lastReset) || '0', 10);

    const savedSkills = localStorage.getItem(this.storageKeys.skills);
    if (savedSkills) {
      try {
        this.unlockedSkills = new Map(JSON.parse(savedSkills));
      } catch (e) {
        console.error('[Progression] Failed to load skills:', e);
      }
    }

    const savedQuests = localStorage.getItem(this.storageKeys.quests);
    if (savedQuests) {
      try {
        this.dailyQuests = JSON.parse(savedQuests);
      } catch (e) {
        console.error('[Progression] Failed to load quests:', e);
      }
    }
  }

  private saveProgress(): void {
    localStorage.setItem(this.storageKeys.level, this.currentLevel.toString());
    localStorage.setItem(this.storageKeys.xp, this.currentXP.toString());
    localStorage.setItem(this.storageKeys.skillPoints, this.skillPoints.toString());
    localStorage.setItem(this.storageKeys.seasonPass, this.seasonPassProgress.toString());
    localStorage.setItem(this.storageKeys.premium, this.premiumUnlocked ? 'true' : 'false');
    localStorage.setItem(this.storageKeys.streak, this.streak.toString());
    localStorage.setItem(this.storageKeys.lastReset, this.lastQuestReset.toString());
    localStorage.setItem(this.storageKeys.skills, JSON.stringify([...this.unlockedSkills]));
    localStorage.setItem(this.storageKeys.quests, JSON.stringify(this.dailyQuests));
  }

  private initializeDailyQuests(): void {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Check if we need to reset quests (new day)
    if (now - this.lastQuestReset > oneDay) {
      this.generateDailyQuests();
      this.lastQuestReset = now;
      this.streakCountedToday = false;
      this.saveProgress();
    }
  }

  private generateDailyQuests(): void {
    const questTemplates = [
      {
        id: 'daily_play_3',
        name: 'Sesión de Entrenamiento',
        description: 'Juga 3 partidas',
        type: 'play_games' as const,
        target: 3,
        reward: { xp: 150, skillPoints: 1 }
      },
      {
        id: 'daily_complete_2',
        name: 'Completador',
        description: 'Completa 2 partidas',
        type: 'complete_games' as const,
        target: 2,
        reward: { xp: 200, skillPoints: 1 }
      },
      {
        id: 'daily_score_500',
        name: 'Puntuador',
        description: 'Alcanza 500 puntos en cualquier juego',
        type: 'high_score' as const,
        target: 500,
        reward: { xp: 250, skillPoints: 2 }
      },
      {
        id: 'daily_streak',
        name: 'Consistencia',
        description: 'Mantén tu racha de días',
        type: 'streak' as const,
        target: 1,
        reward: { xp: 100 }
      }
    ];

    this.dailyQuests = questTemplates.map(template => ({
      ...template,
      progress: 0,
      completed: false,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    }));

    // Add a random game-specific quest
    const gameIds = ['termita', 'simon', 'arrow', 'letters', 'holematch'];
    const randomGame = gameIds[Math.floor(Math.random() * gameIds.length)];
    
    this.dailyQuests.push({
      id: `daily_${randomGame}`,
      name: `Especialista: ${randomGame}`,
      description: `Juga 1 partida de ${randomGame}`,
      type: 'play_specific' as const,
      target: 1,
      gameId: randomGame,
      reward: { xp: 175, skillPoints: 1 },
      progress: 0,
      completed: false,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    });
  }

  // XP and Leveling
  addXP(amount: number, source: string = 'game'): void {
    // Apply XP bonus from skills
    const xpBonus = this.getXPBonusMultiplier();
    const finalAmount = Math.floor(amount * xpBonus);
    
    this.currentXP += finalAmount;
    this.checkLevelUp();
    this.saveProgress();

    window.dispatchEvent(new CustomEvent('progression:xp_gained', {
      detail: { amount: finalAmount, source, bonus: xpBonus }
    }));
  }

  private checkLevelUp(): void {
    const currentLevelData = this.levels[this.currentLevel - 1];
    
    while (this.currentXP >= currentLevelData.xpRequired && this.currentLevel < 100) {
      this.currentXP -= currentLevelData.xpRequired;
      this.currentLevel++;
      
      const newLevelData = this.levels[this.currentLevel - 1];
      this.skillPoints += newLevelData.rewards.skillPoints;
      
      window.dispatchEvent(new CustomEvent('progression:level_up', {
        detail: {
          level: this.currentLevel,
          title: newLevelData.title,
          skillPointsGained: newLevelData.rewards.skillPoints
        }
      }));
    }
  }

  private getXPBonusMultiplier(): number {
    let bonus = 1.0;
    
    this.unlockedSkills.forEach((level, skillId) => {
      const skill = this.skillTree.find(s => s.id === skillId);
      if (skill && skill.effect.type === 'bonus_xp') {
        bonus += (skill.effect.value / 100) * level;
      }
    });
    
    return bonus;
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getCurrentLevelData(): PlayerLevel {
    return this.levels[this.currentLevel - 1];
  }

  getCurrentXP(): number {
    return this.currentXP;
  }

  getXPToNextLevel(): number {
    return this.levels[this.currentLevel - 1].xpRequired;
  }

  getSkillPoints(): number {
    return this.skillPoints;
  }

  // Skill Tree
  getSkillTree(): SkillNode[] {
    return this.skillTree;
  }

  getUnlockedSkills(): Map<string, number> {
    return new Map(this.unlockedSkills);
  }

  canUnlockSkill(skillId: string): boolean {
    const skill = this.skillTree.find(s => s.id === skillId);
    if (!skill) return false;

    const currentLevel = this.unlockedSkills.get(skillId) || 0;
    if (currentLevel >= skill.maxLevel) return false;

    if (skill.prerequisiteId) {
      const prerequisiteLevel = this.unlockedSkills.get(skill.prerequisiteId) || 0;
      const prerequisiteSkill = this.skillTree.find(s => s.id === skill.prerequisiteId);
      if (!prerequisiteSkill || prerequisiteLevel < prerequisiteSkill.maxLevel) {
        return false;
      }
    }

    return this.skillPoints >= skill.costPerLevel;
  }

  unlockSkill(skillId: string): boolean {
    if (!this.canUnlockSkill(skillId)) return false;

    const skill = this.skillTree.find(s => s.id === skillId);
    if (!skill) return false;

    const currentLevel = this.unlockedSkills.get(skillId) || 0;
    this.unlockedSkills.set(skillId, currentLevel + 1);
    this.skillPoints -= skill.costPerLevel;
    this.saveProgress();

    window.dispatchEvent(new CustomEvent('progression:skill_unlocked', {
      detail: { skillId, level: currentLevel + 1 }
    }));

    return true;
  }

  getSkillEffect(skillId: string): number {
    const level = this.unlockedSkills.get(skillId) || 0;
    const skill = this.skillTree.find(s => s.id === skillId);
    if (!skill) return 0;

    return skill.effect.value * level;
  }

  // Daily Quests
  getDailyQuests(): DailyQuest[] {
    return this.dailyQuests;
  }

  updateQuestProgress(type: DailyQuest['type'], value: number, gameId?: string): void {
    this.dailyQuests.forEach(quest => {
      if (quest.completed) return;
      if (quest.type !== type) return;
      if (quest.gameId && quest.gameId !== gameId) return;

      quest.progress = Math.min(quest.progress + value, quest.target);

      if (quest.progress >= quest.target) {
        this.completeQuest(quest.id);
      }
    });

    this.saveProgress();
  }

  private completeQuest(questId: string): void {
    const quest = this.dailyQuests.find(q => q.id === questId);
    if (!quest || quest.completed) return;

    quest.completed = true;
    
    if (quest.reward.xp) {
      this.addXP(quest.reward.xp, 'quest');
    }
    
    if (quest.reward.skillPoints) {
      this.skillPoints += quest.reward.skillPoints;
    }

    this.updateStreak();
    this.saveProgress();

    window.dispatchEvent(new CustomEvent('progression:quest_completed', {
      detail: { questId, rewards: quest.reward }
    }));
  }

  // Recuerda si ya se sumó el streak del día actual, para no
  // incrementarlo más de una vez por día — ver el bug descripto abajo.
  private streakCountedToday: boolean = false;

  private updateStreak(): void {
    const today = new Date().setHours(0, 0, 0, 0);
    const lastReset = this.lastQuestReset;
    const oneDay = 24 * 60 * 60 * 1000;

    const daysSinceLastReset = Math.floor((today - lastReset) / oneDay);

    // Bug anterior: completeQuest() llama a updateStreak() cada vez
    // que se completa UNA quest, y en un día normal el jugador puede
    // completar varias (hasta 5 quests diarias). Con
    // `daysSinceLastReset <= 1` cada una de esas quests incrementaba
    // el streak por separado — 3 quests completadas el mismo día
    // sumaban +3 al streak en vez de +1 por día. El guard
    // `streakCountedToday` asegura que, dentro del mismo período de
    // quests (mismo `lastQuestReset`), el streak solo se incremente
    // una vez sin importar cuántas quests se completen.
    if (daysSinceLastReset === 0) {
      if (!this.streakCountedToday) {
        this.streak++;
        this.streakCountedToday = true;
      }
      return;
    }

    if (daysSinceLastReset === 1) {
      this.streak++;
    } else {
      this.streak = 1;
    }
    this.streakCountedToday = true;
  }

  getStreak(): number {
    return this.streak;
  }

  // Season Pass
  getSeasonPass(): SeasonPass | null {
    return this.currentSeason;
  }

  addSeasonPassXP(amount: number): void {
    this.seasonPassProgress += amount;
    this.checkSeasonPassLevelUp();
    this.saveProgress();
  }

  private checkSeasonPassLevelUp(): void {
    if (!this.currentSeason) return;

    const currentLevel = Math.floor(this.seasonPassProgress / 1000) + 1;
    const maxLevel = this.currentSeason.levels.length;

    if (currentLevel > this.seasonPassProgress / 1000) {
      window.dispatchEvent(new CustomEvent('progression:season_level_up', {
        detail: { level: Math.min(currentLevel, maxLevel) }
      }));
    }
  }

  getSeasonPassLevel(): number {
    return Math.floor(this.seasonPassProgress / 1000) + 1;
  }

  claimSeasonPassReward(level: number, premium: boolean = false): boolean {
    if (!this.currentSeason) return false;
    if (premium && !this.premiumUnlocked) return false;

    const levelData = this.currentSeason.levels[level - 1];
    if (!levelData) return false;

    const reward = premium ? levelData.premiumReward : levelData.freeReward;
    if (!reward) return false;

    // Grant reward based on type
    switch (reward.type) {
      case 'xp':
        this.addXP(typeof reward.value === 'number' ? reward.value : 0, 'season_pass');
        break;
      case 'cosmetic':
      case 'title':
      case 'theme':
        // These would be handled by the cosmetics/title system
        window.dispatchEvent(new CustomEvent('progression:reward_claimed', {
          detail: { type: reward.type, value: reward.value, premium }
        }));
        break;
    }

    return true;
  }

  unlockPremium(): void {
    this.premiumUnlocked = true;
    this.saveProgress();
    window.dispatchEvent(new CustomEvent('progression:premium_unlocked'));
  }

  isPremiumUnlocked(): boolean {
    return this.premiumUnlocked;
  }

  // Utility methods
  getTimeBonus(): number {
    let totalBonus = 0;
    this.unlockedSkills.forEach((level, skillId) => {
      const skill = this.skillTree.find(s => s.id === skillId);
      if (skill && skill.effect.type === 'time_extension') {
        totalBonus += skill.effect.value * level;
      }
    });
    return totalBonus;
  }

  getScoreBonus(): number {
    let totalBonus = 1.0;
    this.unlockedSkills.forEach((level, skillId) => {
      const skill = this.skillTree.find(s => s.id === skillId);
      if (skill && skill.effect.type === 'bonus_score') {
        totalBonus += (skill.effect.value / 100) * level;
      }
    });
    return totalBonus;
  }

  hasExtraLives(): number {
    let totalLives = 0;
    this.unlockedSkills.forEach((level, skillId) => {
      const skill = this.skillTree.find(s => s.id === skillId);
      if (skill && skill.effect.type === 'extra_lives') {
        totalLives += skill.effect.value * level;
      }
    });
    return totalLives;
  }

  hasHintsUnlocked(): boolean {
    return this.unlockedSkills.has('hint_unlock');
  }

  resetProgress(): void {
    this.currentLevel = 1;
    this.currentXP = 0;
    this.skillPoints = 0;
    this.unlockedSkills.clear();
    this.seasonPassProgress = 0;
    this.premiumUnlocked = false;
    this.streak = 0;
    this.dailyQuests = [];
    this.generateDailyQuests();
    this.saveProgress();
  }
}

// Singleton instance
export const progressionSystem = new ProgressionSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.progressionSystem = progressionSystem;
}

export default progressionSystem;
