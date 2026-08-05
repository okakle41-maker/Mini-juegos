/**
 * Achievements System
 * Sistema de logros y recompensas para los usuarios
 */

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'games' | 'streak' | 'score' | 'time' | 'special' | 'sequential' | 'seasonal';
  requirement: {
    type: 'games_played' | 'games_completed' | 'high_score' | 'streak' | 'time_played' | 'special' | 'sequential' | 'seasonal' | 'game_specific';
    value: number;
    gameId?: string;
    condition?: string;
    seasonId?: string;
  };
  reward?: {
    type: 'badge' | 'title' | 'theme' | 'effect' | 'xp' | 'cosmetic';
    value: string | number;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  };
  unlocked: boolean;
  unlockedAt?: number;
  progress?: number;
  maxProgress?: number;
  prerequisiteId?: string;
  isHidden?: boolean;
}

class AchievementManager {
  private achievements: Map<string, Achievement>;
  private userProgress: Map<string, number>;
  private storageKey = 'achievements';
  private progressKey = 'achievement-progress';
  private xpKey = 'achievement-xp';
  private titlesKey = 'achievement-titles';
  private cosmeticsKey = 'achievement-cosmetics';
  private totalXP: number = 0;
  private unlockedTitles: Set<string> = new Set();
  private unlockedCosmetics: Set<string> = new Set();
  private activeTitle: string = '';

  constructor() {
    this.achievements = this.defineAchievements();
    this.userProgress = this.loadProgress();
    this.loadUnlockedAchievements();
    this.loadRewards();
  }

  private defineAchievements(): Map<string, Achievement> {
    const achievements: Achievement[] = [
      // Game completion achievements
      {
        id: 'first_game',
        name: 'Primeros Pasos',
        description: 'Jugar tu primer juego',
        icon: '🎮',
        category: 'games',
        requirement: { type: 'games_played', value: 1 },
        reward: { type: 'xp', value: 50, rarity: 'common' },
        unlocked: false
      },
      {
        id: 'ten_games',
        name: 'Jugador Dedicado',
        description: 'Jugar 10 juegos',
        icon: '🎯',
        category: 'games',
        requirement: { type: 'games_played', value: 10 },
        reward: { type: 'xp', value: 200, rarity: 'common' },
        unlocked: false
      },
      {
        id: 'fifty_games',
        name: 'Veterano',
        description: 'Jugar 50 juegos',
        icon: '🏆',
        category: 'games',
        requirement: { type: 'games_played', value: 50 },
        reward: { type: 'title', value: 'Veterano', rarity: 'rare' },
        unlocked: false
      },
      {
        id: 'hundred_games',
        name: 'Leyenda',
        description: 'Jugar 100 juegos',
        icon: '👑',
        category: 'games',
        requirement: { type: 'games_played', value: 100 },
        reward: { type: 'title', value: 'Leyenda', rarity: 'legendary' },
        unlocked: false
      },
      // Game completion achievements
      {
        id: 'first_complete',
        name: 'Primera Victoria',
        description: 'Completar tu primer juego',
        icon: '✨',
        category: 'games',
        requirement: { type: 'games_completed', value: 1 },
        reward: { type: 'xp', value: 100, rarity: 'common' },
        unlocked: false
      },
      {
        id: 'ten_complete',
        name: 'Ganador Consistente',
        description: 'Completar 10 juegos',
        icon: '🌟',
        category: 'games',
        requirement: { type: 'games_completed', value: 10 },
        reward: { type: 'title', value: 'Ganador', rarity: 'rare' },
        unlocked: false
      },
      // High score achievements
      {
        id: 'high_score_100',
        name: 'Centenar',
        description: 'Alcanzar 100 puntos en cualquier juego',
        icon: '💯',
        category: 'score',
        requirement: { type: 'high_score', value: 100 },
        reward: { type: 'xp', value: 150, rarity: 'common' },
        unlocked: false
      },
      {
        id: 'high_score_500',
        name: 'Quinientos',
        description: 'Alcanzar 500 puntos en cualquier juego',
        icon: '🎖️',
        category: 'score',
        requirement: { type: 'high_score', value: 500 },
        reward: { type: 'xp', value: 500, rarity: 'rare' },
        unlocked: false
      },
      {
        id: 'high_score_1000',
        name: 'Milenario',
        description: 'Alcanzar 1000 puntos en cualquier juego',
        icon: '🏅',
        category: 'score',
        requirement: { type: 'high_score', value: 1000 },
        reward: { type: 'title', value: 'Milenario', rarity: 'epic' },
        unlocked: false
      },
      // Streak achievements
      {
        id: 'streak_3',
        name: 'Racha de 3',
        description: 'Jugar 3 días consecutivos',
        icon: '🔥',
        category: 'streak',
        requirement: { type: 'streak', value: 3 },
        reward: { type: 'xp', value: 100, rarity: 'common' },
        unlocked: false
      },
      {
        id: 'streak_7',
        name: 'Racha Semanal',
        description: 'Jugar 7 días consecutivos',
        icon: '⚡',
        category: 'streak',
        requirement: { type: 'streak', value: 7 },
        reward: { type: 'cosmetic', value: 'streak_badge_7', rarity: 'rare' },
        unlocked: false
      },
      {
        id: 'streak_30',
        name: 'Racha Mensual',
        description: 'Jugar 30 días consecutivos',
        icon: '💪',
        category: 'streak',
        requirement: { type: 'streak', value: 30 },
        reward: { type: 'title', value: 'Inquebrantable', rarity: 'legendary' },
        unlocked: false
      },
      // Time played achievements
      {
        id: 'time_1h',
        name: 'Una Hora',
        description: 'Jugar por 1 hora total',
        icon: '⏰',
        category: 'time',
        requirement: { type: 'time_played', value: 3600 },
        reward: { type: 'xp', value: 75, rarity: 'common' },
        unlocked: false
      },
      {
        id: 'time_10h',
        name: 'Diez Horas',
        description: 'Jugar por 10 horas total',
        icon: '⏳',
        category: 'time',
        requirement: { type: 'time_played', value: 36000 },
        reward: { type: 'cosmetic', value: 'time_badge_10h', rarity: 'rare' },
        unlocked: false
      },
      // Special achievements
      {
        id: 'perfect_game',
        name: 'Juego Perfecto',
        description: 'Completar un juego sin errores',
        icon: '💎',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        reward: { type: 'xp', value: 300, rarity: 'epic' },
        unlocked: false
      },
      {
        id: 'speed_demon',
        name: 'Demonio de Velocidad',
        description: 'Completar un juego en menos de 10 segundos',
        icon: '🚀',
        category: 'special',
        requirement: { type: 'special', value: 1 },
        reward: { type: 'title', value: 'Velocista', rarity: 'epic' },
        unlocked: false
      },
      // Sequential achievements (chains)
      {
        id: 'chain_master_1',
        name: 'Maestro Cadena I',
        description: 'Primer paso de la cadena maestra',
        icon: '🔗',
        category: 'sequential',
        requirement: { type: 'sequential', value: 1 },
        reward: { type: 'xp', value: 100, rarity: 'common' },
        unlocked: false
      },
      {
        id: 'chain_master_2',
        name: 'Maestro Cadena II',
        description: 'Segundo paso de la cadena maestra',
        icon: '⛓️',
        category: 'sequential',
        requirement: { type: 'sequential', value: 2 },
        prerequisiteId: 'chain_master_1',
        reward: { type: 'xp', value: 200, rarity: 'rare' },
        unlocked: false
      },
      {
        id: 'chain_master_3',
        name: 'Maestro Cadena III',
        description: 'Tercer paso de la cadena maestra',
        icon: '🔒',
        category: 'sequential',
        requirement: { type: 'sequential', value: 3 },
        prerequisiteId: 'chain_master_2',
        reward: { type: 'title', value: 'Maestro', rarity: 'epic' },
        unlocked: false
      },
      // Game-specific achievements
      {
        id: 'termita_perfect',
        name: 'Memoria Perfecta',
        description: 'Completar Termita sin errores',
        icon: '🧠',
        category: 'games',
        requirement: { type: 'game_specific', value: 1, gameId: 'termita', condition: 'perfect' },
        reward: { type: 'xp', value: 250, rarity: 'rare' },
        unlocked: false
      },
      {
        id: 'simon_10_rounds',
        name: 'Simon Experto',
        description: 'Llegar a la ronda 10 en Simon Dice',
        icon: '🎵',
        category: 'games',
        requirement: { type: 'game_specific', value: 10, gameId: 'simon', condition: 'rounds' },
        reward: { type: 'xp', value: 300, rarity: 'rare' },
        unlocked: false
      },
      {
        id: 'arrow_speed',
        name: 'Reflejos de Rayo',
        description: 'Promedio de reacción < 500ms en Desafío Flechas',
        icon: '⚡',
        category: 'games',
        requirement: { type: 'game_specific', value: 500, gameId: 'arrow', condition: 'avg_reaction' },
        reward: { type: 'title', value: 'Relámpago', rarity: 'epic' },
        unlocked: false
      },
      // Seasonal achievements
      {
        id: 'season_1_participant',
        name: 'Participante Temporada 1',
        description: 'Jugar durante la primera temporada',
        icon: '🎪',
        category: 'seasonal',
        requirement: { type: 'seasonal', value: 1, seasonId: 'season_1' },
        reward: { type: 'cosmetic', value: 'season1_badge', rarity: 'rare' },
        unlocked: false
      }
    ];

    return new Map(achievements.map(a => [a.id, a]));
  }

  private loadProgress(): Map<string, number> {
    const saved = localStorage.getItem(this.progressKey);
    if (saved) {
      try {
        return new Map(JSON.parse(saved));
      } catch (e) {
        console.error('[Achievements] Failed to load progress:', e);
      }
    }

    // Initialize default progress
    const progress = new Map([
      ['games_played', 0],
      ['games_completed', 0],
      ['highest_score', 0],
      ['current_streak', 0],
      ['last_played_date', 0],
      ['total_time_played', 0]
    ]);

    this.saveProgress(progress);
    return progress;
  }

  private saveProgress(progress: Map<string, number>): void {
    localStorage.setItem(this.progressKey, JSON.stringify([...progress]));
  }

  private loadRewards(): void {
    // Load XP
    const savedXP = localStorage.getItem(this.xpKey);
    if (savedXP) {
      try {
        this.totalXP = parseInt(savedXP, 10) || 0;
      } catch (e) {
        console.error('[Achievements] Failed to load XP:', e);
      }
    }

    // Load titles
    const savedTitles = localStorage.getItem(this.titlesKey);
    if (savedTitles) {
      try {
        this.unlockedTitles = new Set(JSON.parse(savedTitles));
      } catch (e) {
        console.error('[Achievements] Failed to load titles:', e);
      }
    }

    // Load cosmetics
    const savedCosmetics = localStorage.getItem(this.cosmeticsKey);
    if (savedCosmetics) {
      try {
        this.unlockedCosmetics = new Set(JSON.parse(savedCosmetics));
      } catch (e) {
        console.error('[Achievements] Failed to load cosmetics:', e);
      }
    }

    // Load active title
    const savedActiveTitle = localStorage.getItem('active-title');
    if (savedActiveTitle) {
      this.activeTitle = savedActiveTitle;
    }
  }

  private saveRewards(): void {
    localStorage.setItem(this.xpKey, this.totalXP.toString());
    localStorage.setItem(this.titlesKey, JSON.stringify([...this.unlockedTitles]));
    localStorage.setItem(this.cosmeticsKey, JSON.stringify([...this.unlockedCosmetics]));
    localStorage.setItem('active-title', this.activeTitle);
  }

  private loadUnlockedAchievements(): void {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const unlockedIds: string[] = JSON.parse(saved);
        unlockedIds.forEach(id => {
          const achievement = this.achievements.get(id);
          if (achievement) {
            achievement.unlocked = true;
          }
        });
      } catch (e) {
        console.error('[Achievements] Failed to load unlocked achievements:', e);
      }
    }
  }

  private saveUnlockedAchievements(): void {
    const unlockedIds = [...this.achievements.values()]
      .filter(a => a.unlocked)
      .map(a => a.id);
    localStorage.setItem(this.storageKey, JSON.stringify(unlockedIds));
  }

  trackGamePlayed(gameId: string): void {
    const gamesPlayed = (this.userProgress.get('games_played') || 0) + 1;
    this.userProgress.set('games_played', gamesPlayed);
    this.checkAchievement('games_played', gamesPlayed);
    this.updateStreak();
    this.saveProgress(this.userProgress);
    
    // Track game-specific progress
    this.trackGameSpecificProgress(gameId, 'played');
  }

  trackGameCompleted(gameId: string, score: number, duration: number, perfect: boolean = false): void {
    const gamesCompleted = (this.userProgress.get('games_completed') || 0) + 1;
    this.userProgress.set('games_completed', gamesCompleted);
    this.checkAchievement('games_completed', gamesCompleted);

    const highestScore = this.userProgress.get('highest_score') || 0;
    if (score > highestScore) {
      this.userProgress.set('highest_score', score);
      this.checkAchievement('high_score', score);
    }

    const totalTime = (this.userProgress.get('total_time_played') || 0) + duration;
    this.userProgress.set('total_time_played', totalTime);
    this.checkAchievement('time_played', totalTime);

    this.saveProgress(this.userProgress);

    // Track game-specific achievements
    this.trackGameSpecificProgress(gameId, 'completed', { score, duration, perfect });

    // Track special achievements
    if (perfect) {
      this.trackSpecialAchievement('perfect_game');
    }
    if (duration < 10) {
      this.trackSpecialAchievement('speed_demon');
    }
  }

  trackSpecialAchievement(achievementId: string): void {
    const achievement = this.achievements.get(achievementId);
    if (achievement && !achievement.unlocked) {
      this.unlockAchievement(achievementId);
    }
  }

  private trackGameSpecificProgress(gameId: string, action: string, data?: any): void {
    const progressKey = `game_progress_${gameId}`;
    const currentProgress = this.userProgress.get(progressKey) || 0;
    const newProgress = currentProgress + 1;
    this.userProgress.set(progressKey, newProgress);

    // Check for game-specific achievements
    this.achievements.forEach(achievement => {
      if (achievement.unlocked) return;
      if (achievement.requirement.type !== 'game_specific') return;
      if (achievement.requirement.gameId !== gameId) return;

      const req = achievement.requirement;
      let shouldUnlock = false;

      switch (req.condition) {
        case 'perfect':
          shouldUnlock = data?.perfect === true;
          break;
        case 'rounds':
          shouldUnlock = newProgress >= req.value;
          break;
        case 'avg_reaction':
          shouldUnlock = data?.avgReaction && data.avgReaction < req.value;
          break;
        default:
          shouldUnlock = newProgress >= req.value;
      }

      if (shouldUnlock) {
        this.unlockAchievement(achievement.id);
      }
    });

    this.saveProgress(this.userProgress);
  }

  private updateStreak(): void {
    const today = new Date().setHours(0, 0, 0, 0);
    const lastPlayed = this.userProgress.get('last_played_date') || 0;
    const currentStreak = this.userProgress.get('current_streak') || 0;

    const oneDay = 24 * 60 * 60 * 1000;
    const daysSinceLastPlay = Math.floor((today - lastPlayed) / oneDay);

    if (daysSinceLastPlay === 1) {
      // Played yesterday, increment streak
      const newStreak = currentStreak + 1;
      this.userProgress.set('current_streak', newStreak);
      this.userProgress.set('last_played_date', today);
      this.checkAchievement('streak', newStreak);
    } else if (daysSinceLastPlay > 1) {
      // Streak broken
      this.userProgress.set('current_streak', 1);
      this.userProgress.set('last_played_date', today);
    } else if (daysSinceLastPlay === 0) {
      // Already played today, don't update
      return;
    } else {
      // First time playing
      this.userProgress.set('current_streak', 1);
      this.userProgress.set('last_played_date', today);
    }

    this.saveProgress(this.userProgress);
  }

  private checkAchievement(type: string, value: number): void {
    this.achievements.forEach(achievement => {
      if (achievement.unlocked) return;

      const req = achievement.requirement;
      let shouldUnlock = false;

      switch (req.type) {
        case 'games_played':
          shouldUnlock = type === 'games_played' && value >= req.value;
          break;
        case 'games_completed':
          shouldUnlock = type === 'games_completed' && value >= req.value;
          break;
        case 'high_score':
          shouldUnlock = type === 'high_score' && value >= req.value;
          break;
        case 'streak':
          shouldUnlock = type === 'streak' && value >= req.value;
          break;
        case 'time_played':
          shouldUnlock = type === 'time_played' && value >= req.value;
          break;
      }

      if (shouldUnlock) {
        this.unlockAchievement(achievement.id);
      }
    });
  }

  private unlockAchievement(id: string): void {
    const achievement = this.achievements.get(id);
    if (!achievement || achievement.unlocked) return;

    // Check prerequisite
    if (achievement.prerequisiteId) {
      const prerequisite = this.achievements.get(achievement.prerequisiteId);
      if (!prerequisite || !prerequisite.unlocked) {
        return; // Prerequisite not met
      }
    }

    achievement.unlocked = true;
    achievement.unlockedAt = Date.now();
    this.saveUnlockedAchievements();

    // Grant rewards
    this.grantReward(achievement);

    // Dispatch event for UI notification
    window.dispatchEvent(new CustomEvent('achievement:unlocked', { detail: achievement }));
  }

  private grantReward(achievement: Achievement): void {
    if (!achievement.reward) return;

    const { type, value, rarity } = achievement.reward;

    switch (type) {
      case 'xp':
        if (typeof value === 'number') {
          this.totalXP += value;
          this.saveRewards();
          window.dispatchEvent(new CustomEvent('xp:gained', { detail: { amount: value, source: achievement.id } }));
        }
        break;
      case 'title':
        if (typeof value === 'string') {
          this.unlockedTitles.add(value);
          this.saveRewards();
          window.dispatchEvent(new CustomEvent('title:unlocked', { detail: { title: value, rarity } }));
        }
        break;
      case 'cosmetic':
        if (typeof value === 'string') {
          this.unlockedCosmetics.add(value);
          this.saveRewards();
          window.dispatchEvent(new CustomEvent('cosmetic:unlocked', { detail: { cosmetic: value, rarity } }));
        }
        break;
      case 'badge':
      case 'theme':
      case 'effect':
        // These are handled similarly to cosmetics
        if (typeof value === 'string') {
          this.unlockedCosmetics.add(value);
          this.saveRewards();
          window.dispatchEvent(new CustomEvent('cosmetic:unlocked', { detail: { cosmetic: value, rarity } }));
        }
        break;
    }
  }

  getAchievements(): Achievement[] {
    return [...this.achievements.values()];
  }

  getUnlockedAchievements(): Achievement[] {
    return [...this.achievements.values()].filter(a => a.unlocked);
  }

  getLockedAchievements(): Achievement[] {
    return [...this.achievements.values()].filter(a => !a.unlocked);
  }

  getAchievementById(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  getProgress(): Map<string, number> {
    return new Map(this.userProgress);
  }

  resetProgress(): void {
    this.userProgress = new Map([
      ['games_played', 0],
      ['games_completed', 0],
      ['highest_score', 0],
      ['current_streak', 0],
      ['last_played_date', 0],
      ['total_time_played', 0]
    ]);
    this.saveProgress(this.userProgress);

    // Reset achievements
    this.achievements.forEach(a => {
      a.unlocked = false;
      a.unlockedAt = undefined;
    });
    this.saveUnlockedAchievements();

    // Reset rewards
    this.totalXP = 0;
    this.unlockedTitles.clear();
    this.unlockedCosmetics.clear();
    this.activeTitle = '';
    this.saveRewards();
  }

  getAchievementProgress(achievementId: string): number {
    const achievement = this.achievements.get(achievementId);
    if (!achievement) return 0;

    const req = achievement.requirement;
    let currentValue = 0;

    switch (req.type) {
      case 'games_played':
        currentValue = this.userProgress.get('games_played') || 0;
        break;
      case 'games_completed':
        currentValue = this.userProgress.get('games_completed') || 0;
        break;
      case 'high_score':
        currentValue = this.userProgress.get('highest_score') || 0;
        break;
      case 'streak':
        currentValue = this.userProgress.get('current_streak') || 0;
        break;
      case 'time_played':
        currentValue = this.userProgress.get('total_time_played') || 0;
        break;
      case 'sequential':
        // Antes leía la clave fija 'sequential_progress', que
        // trackSequentialProgress() nunca escribe: esa función guarda
        // bajo `sequential_${chainId}` (una clave por cadena, ya que
        // puede haber varias cadenas de logros en paralelo). El
        // mismatch hacía que la barra de progreso de logros
        // secuenciales (chain_master_1/2/3) se quedara siempre en 0%
        // hasta que el logro se desbloqueaba de golpe. Derivamos el
        // chainId del propio id del logro quitando el sufijo numérico
        // final (p.ej. 'chain_master_2' -> 'chain_master'), que es el
        // patrón usado por los ids de esta cadena.
        currentValue = this.userProgress.get(
          `sequential_${achievement.id.replace(/_\d+$/, '')}`
        ) || 0;
        break;
      case 'game_specific':
        if (req.gameId) {
          // Antes esto siempre leía `game_progress_${gameId}` (el
          // conteo de partidas jugadas de ese juego), sin mirar
          // `req.condition`. Para condiciones no acumulativas basadas
          // en cantidad de partidas eso es correcto (p.ej. 'rounds'
          // vía newProgress >= value en trackGameSpecificProgress),
          // pero para condiciones como 'avg_reaction' (arrow_speed: el
          // requisito es que el promedio sea MENOR a value, no mayor,
          // y no depende de cuántas partidas se jugaron) o 'perfect'
          // (booleano, no acumulativo) el resultado no tenía relación
          // alguna con el requisito real y podía mostrar barras de
          // progreso sin sentido. Estas condiciones no tienen un
          // "progreso parcial" bien definido con los datos que
          // guardamos hoy, así que se muestran como 0% hasta
          // desbloquearse (barra vacía) en vez de un número inventado.
          if (req.condition === 'avg_reaction' || req.condition === 'perfect') {
            currentValue = achievement.unlocked ? req.value : 0;
          } else {
            currentValue = this.userProgress.get(`game_progress_${req.gameId}`) || 0;
          }
        }
        break;
      default:
        currentValue = 0;
    }

    return Math.min((currentValue / req.value) * 100, 100);
  }

  // XP System
  getTotalXP(): number {
    return this.totalXP;
  }

  addXP(amount: number, source: string = 'manual'): void {
    this.totalXP += amount;
    this.saveRewards();
    window.dispatchEvent(new CustomEvent('xp:gained', { detail: { amount, source } }));
  }

  // Titles System
  getUnlockedTitles(): string[] {
    return [...this.unlockedTitles];
  }

  getActiveTitle(): string {
    return this.activeTitle;
  }

  setActiveTitle(title: string): void {
    if (this.unlockedTitles.has(title) || title === '') {
      this.activeTitle = title;
      this.saveRewards();
      window.dispatchEvent(new CustomEvent('title:changed', { detail: { title } }));
    }
  }

  // Cosmetics System
  getUnlockedCosmetics(): string[] {
    return [...this.unlockedCosmetics];
  }

  hasCosmetic(cosmeticId: string): boolean {
    return this.unlockedCosmetics.has(cosmeticId);
  }

  // Sequential achievements
  trackSequentialProgress(chainId: string, step: number): void {
    const progressKey = `sequential_${chainId}`;
    const currentProgress = this.userProgress.get(progressKey) || 0;
    
    if (step > currentProgress) {
      this.userProgress.set(progressKey, step);
      this.saveProgress(this.userProgress);
      
      // Check for sequential achievements
      this.achievements.forEach(achievement => {
        if (achievement.unlocked) return;
        if (achievement.requirement.type !== 'sequential') return;
        if (achievement.requirement.value <= step) {
          this.unlockAchievement(achievement.id);
        }
      });
    }
  }

  // Seasonal achievements
  trackSeasonalProgress(seasonId: string, progress: number): void {
    const progressKey = `seasonal_${seasonId}`;
    this.userProgress.set(progressKey, progress);
    this.saveProgress(this.userProgress);
    
    this.achievements.forEach(achievement => {
      if (achievement.unlocked) return;
      if (achievement.requirement.type !== 'seasonal') return;
      if (achievement.requirement.seasonId === seasonId && progress >= achievement.requirement.value) {
        this.unlockAchievement(achievement.id);
      }
    });
  }

  // Get achievements by category
  getAchievementsByCategory(category: Achievement['category']): Achievement[] {
    return [...this.achievements.values()].filter(a => a.category === category);
  }

  // Get achievements by rarity
  getAchievementsByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Achievement[] {
    return [...this.achievements.values()].filter(a => a.reward?.rarity === rarity);
  }

  // Get available achievements (prerequisites met)
  getAvailableAchievements(): Achievement[] {
    return [...this.achievements.values()].filter(a => {
      if (a.unlocked) return false;
      if (a.isHidden) return false;
      if (a.prerequisiteId) {
        const prerequisite = this.achievements.get(a.prerequisiteId);
        return prerequisite?.unlocked === true;
      }
      return true;
    });
  }
}

// Singleton instance
export const achievementManager = new AchievementManager();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).achievementManager = achievementManager;
}

export default achievementManager;
