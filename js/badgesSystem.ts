/**
 * Badges System
 * Sistema de badges/insignias con colección y showcase
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'achievement' | 'social' | 'skill' | 'event' | 'special';
  unlocked: boolean;
  unlockedAt?: number;
  expiresAt?: number; // Para badges temporales
  progress?: number;
  progressMax?: number;
  requirements?: string[];
}

export interface BadgeCollection {
  badges: Badge[];
  showcase: string[]; // IDs de badges en showcase
  totalBadges: number;
  unlockedBadges: number;
}

class BadgeSystem {
  private collection: BadgeCollection;
  private storageKey = 'minijuegos_badges';
  private badges: Badge[] = [];

  constructor() {
    this.collection = this.loadCollection();
    this.initializeBadges();
  }

  private initializeBadges(): void {
    this.badges = [
      // Achievement Badges
      {
        id: 'first_win',
        name: 'Primera Victoria',
        description: 'Gana tu primera partida',
        icon: '🥇',
        rarity: 'common',
        category: 'achievement',
        unlocked: false
      },
      {
        id: 'streak_7',
        name: 'Racha Semanal',
        description: 'Juega 7 días consecutivos',
        icon: '🔥',
        rarity: 'rare',
        category: 'achievement',
        unlocked: false,
        progress: 0,
        progressMax: 7
      },
      {
        id: 'streak_30',
        name: 'Racha Legendaria',
        description: 'Juega 30 días consecutivos',
        icon: '⚡',
        rarity: 'legendary',
        category: 'achievement',
        unlocked: false,
        progress: 0,
        progressMax: 30
      },
      {
        id: 'score_1000',
        name: 'Marcador de Élite',
        description: 'Alcanza 1000 puntos en cualquier juego',
        icon: '💯',
        rarity: 'rare',
        category: 'achievement',
        unlocked: false
      },
      {
        id: 'all_games',
        name: 'Explorador',
        description: 'Juega todos los minijuegos',
        icon: '🗺️',
        rarity: 'epic',
        category: 'achievement',
        unlocked: false,
        progress: 0,
        progressMax: 26
      },

      // Social Badges
      {
        id: 'first_friend',
        name: 'Amigo Nuevo',
        description: 'Añade tu primer amigo',
        icon: '🤝',
        rarity: 'common',
        category: 'social',
        unlocked: false
      },
      {
        id: 'friend_10',
        name: 'Social Butterfly',
        description: 'Tiene 10 amigos',
        icon: '🦋',
        rarity: 'rare',
        category: 'social',
        unlocked: false,
        progress: 0,
        progressMax: 10
      },
      {
        id: 'kudos_100',
        name: 'Popular',
        description: 'Recibe 100 kudos',
        icon: '❤️',
        rarity: 'epic',
        category: 'social',
        unlocked: false,
        progress: 0,
        progressMax: 100
      },

      // Skill Badges
      {
        id: 'speed_demon',
        name: 'Demonio de Velocidad',
        description: 'Completa un juego en menos de 10 segundos',
        icon: '⚡',
        rarity: 'epic',
        category: 'skill',
        unlocked: false
      },
      {
        id: 'perfectionist',
        name: 'Perfeccionista',
        description: 'Logra 100% de precisión en cualquier juego',
        icon: '🎯',
        rarity: 'legendary',
        category: 'skill',
        unlocked: false
      },
      {
        id: 'multitasker',
        name: 'Multitarea',
        description: 'Juega 5 juegos diferentes en una sesión',
        icon: '🎮',
        rarity: 'rare',
        category: 'skill',
        unlocked: false,
        progress: 0,
        progressMax: 5
      },

      // Event Badges (temporales)
      {
        id: 'halloween_2024',
        name: 'Noche de Brujas 2024',
        description: 'Participa en el evento de Halloween',
        icon: '🎃',
        rarity: 'epic',
        category: 'event',
        unlocked: false,
        expiresAt: new Date('2024-11-01').getTime()
      },
      {
        id: 'christmas_2024',
        name: 'Navidad 2024',
        description: 'Participa en el evento de Navidad',
        icon: '🎄',
        rarity: 'epic',
        category: 'event',
        unlocked: false,
        expiresAt: new Date('2025-01-01').getTime()
      },

      // Special Badges
      {
        id: 'early_adopter',
        name: 'Pionero',
        description: 'Usuario temprano del sistema v3.0',
        icon: '🚀',
        rarity: 'legendary',
        category: 'special',
        unlocked: false
      },
      {
        id: 'beta_tester',
        name: 'Beta Tester',
        description: 'Participó en la fase beta',
        icon: '🧪',
        rarity: 'legendary',
        category: 'special',
        unlocked: false
      }
    ];

    // Sincronizar con localStorage
    this.syncBadges();
  }

  private syncBadges(): void {
    this.badges.forEach(badge => {
      const saved = this.collection.badges.find(b => b.id === badge.id);
      if (saved) {
        badge.unlocked = saved.unlocked;
        badge.unlockedAt = saved.unlockedAt;
        badge.progress = saved.progress;
      }
    });
  }

  private loadCollection(): BadgeCollection {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading badge collection:', e);
      }
    }
    return {
      badges: [],
      showcase: [],
      totalBadges: 0,
      unlockedBadges: 0
    };
  }

  private saveCollection(): void {
    this.collection.badges = this.badges;
    this.collection.totalBadges = this.badges.length;
    this.collection.unlockedBadges = this.badges.filter(b => b.unlocked).length;
    localStorage.setItem(this.storageKey, JSON.stringify(this.collection));
  }

  unlockBadge(badgeId: string): boolean {
    const badge = this.badges.find(b => b.id === badgeId);
    if (!badge || badge.unlocked) return false;

    // Verificar si badge temporal expiró
    if (badge.expiresAt && Date.now() > badge.expiresAt) {
      return false;
    }

    badge.unlocked = true;
    badge.unlockedAt = Date.now();
    this.saveCollection();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('badge:unlocked', { detail: badge }));

    return true;
  }

  updateBadgeProgress(badgeId: string, progress: number): void {
    const badge = this.badges.find(b => b.id === badgeId);
    if (!badge) return;

    badge.progress = progress;
    
    // Auto-unlock si se completa el progreso
    if (badge.progressMax && progress >= badge.progressMax) {
      this.unlockBadge(badgeId);
    }
    
    this.saveCollection();
  }

  getBadge(badgeId: string): Badge | undefined {
    return this.badges.find(b => b.id === badgeId);
  }

  getAllBadges(): Badge[] {
    return this.badges;
  }

  getUnlockedBadges(): Badge[] {
    return this.badges.filter(b => b.unlocked);
  }

  getBadgesByCategory(category: Badge['category']): Badge[] {
    return this.badges.filter(b => b.category === category);
  }

  getBadgesByRarity(rarity: Badge['rarity']): Badge[] {
    return this.badges.filter(b => b.rarity === rarity);
  }

  addToShowcase(badgeId: string): boolean {
    if (this.collection.showcase.length >= 5) return false;
    if (this.collection.showcase.includes(badgeId)) return false;

    const badge = this.getBadge(badgeId);
    if (!badge || !badge.unlocked) return false;

    this.collection.showcase.push(badgeId);
    this.saveCollection();
    return true;
  }

  removeFromShowcase(badgeId: string): void {
    const index = this.collection.showcase.indexOf(badgeId);
    if (index > -1) {
      this.collection.showcase.splice(index, 1);
      this.saveCollection();
    }
  }

  getShowcase(): Badge[] {
    return this.collection.showcase
      .map(id => this.getBadge(id))
      .filter((b): b is Badge => b !== undefined);
  }

  getCollectionStats(): {
    total: number;
    unlocked: number;
    percentage: number;
    byRarity: Record<Badge['rarity'], number>;
    byCategory: Record<Badge['category'], number>;
  } {
    const unlocked = this.getUnlockedBadges();
    const percentage = (unlocked.length / this.badges.length) * 100;

    const byRarity: Record<Badge['rarity'], number> = {
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0
    };

    const byCategory: Record<Badge['category'], number> = {
      achievement: 0,
      social: 0,
      skill: 0,
      event: 0,
      special: 0
    };

    unlocked.forEach(badge => {
      byRarity[badge.rarity]++;
      byCategory[badge.category]++;
    });

    return {
      total: this.badges.length,
      unlocked: unlocked.length,
      percentage,
      byRarity,
      byCategory
    };
  }

  checkExpiredBadges(): void {
    const now = Date.now();
    let expired = false;

    this.badges.forEach(badge => {
      if (badge.expiresAt && badge.expiresAt < now && badge.unlocked) {
        badge.unlocked = false;
        badge.unlockedAt = undefined;
        expired = true;
      }
    });

    if (expired) {
      this.saveCollection();
      window.dispatchEvent(new CustomEvent('badge:expired'));
    }
  }
}

// Singleton instance
export const badgeSystem = new BadgeSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.badgeSystem = badgeSystem;
}

export default badgeSystem;
