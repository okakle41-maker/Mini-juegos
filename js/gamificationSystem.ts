/**
 * Gamification System
 * Sistema de gamificación avanzado: puntos globales, niveles con perks, misiones semanales, eventos temporales
 */

export interface UserLevel {
  level: number;
  xp: number;
  xpToNext: number;
  title: string;
  perks: string[];
}

export interface WeeklyMission {
  id: string;
  name: string;
  description: string;
  type: 'games' | 'score' | 'streak' | 'social' | 'special';
  target: number;
  progress: number;
  reward: {
    xp: number;
    points: number;
    cosmetics?: string[];
  };
  completed: boolean;
  expiresAt: number;
}

export interface TemporaryEvent {
  id: string;
  name: string;
  description: string;
  type: 'double_xp' | 'special_badge' | 'limited_cosmetic' | 'tournament';
  multiplier: number;
  reward: string;
  startsAt: number;
  endsAt: number;
  active: boolean;
}

export interface GamificationConfig {
  globalPoints: number;
  level: UserLevel;
  weeklyMissions: WeeklyMission[];
  activeEvents: TemporaryEvent[];
  completedEvents: string[];
}

class GamificationSystem {
  private config: GamificationConfig;
  private storageKey = 'gamification_config';
  private levelTitles: string[] = [
    'Novato', 'Aprendiz', 'Jugador', 'Entusiasta', 'Veterano',
    'Experto', 'Maestro', 'Leyenda', 'Campeón', 'Ídolo'
  ];

  constructor() {
    this.config = this.loadConfig();
    this.init();
  }

  private loadConfig(): GamificationConfig {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[Gamification] Failed to load config:', e);
      }
    }
    return {
      globalPoints: 0,
      level: {
        level: 1,
        xp: 0,
        xpToNext: 100,
        title: 'Novato',
        perks: []
      },
      weeklyMissions: this.generateWeeklyMissions(),
      activeEvents: [],
      completedEvents: []
    };
  }

  private saveConfig(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.config));
  }

  private init(): void {
    // Verificar y actualizar misiones semanales
    this.checkWeeklyMissions();
    
    // Verificar eventos temporales
    this.checkTemporaryEvents();
    
    // Escuchar eventos de juego
    this.setupEventListeners();
  }

  private generateWeeklyMissions(): WeeklyMission[] {
    const now = Date.now();
    const weekEnd = now + (7 * 24 * 60 * 60 * 1000);

    return [
      {
        id: 'mission_games_10',
        name: 'Jugador Dedicado',
        description: 'Juega 10 partidas esta semana',
        type: 'games',
        target: 10,
        progress: 0,
        reward: { xp: 200, points: 50 },
        completed: false,
        expiresAt: weekEnd
      },
      {
        id: 'mission_score_5000',
        name: 'Puntuador Élite',
        description: 'Alcanza 5000 puntos totales esta semana',
        type: 'score',
        target: 5000,
        progress: 0,
        reward: { xp: 300, points: 75 },
        completed: false,
        expiresAt: weekEnd
      },
      {
        id: 'mission_streak_3',
        name: 'Racha Semanal',
        description: 'Juega 3 días consecutivos',
        type: 'streak',
        target: 3,
        progress: 0,
        reward: { xp: 150, points: 40 },
        completed: false,
        expiresAt: weekEnd
      },
      {
        id: 'mission_social_5',
        name: 'Social Activo',
        description: 'Interactúa con 5 amigos esta semana',
        type: 'social',
        target: 5,
        progress: 0,
        reward: { xp: 100, points: 30 },
        completed: false,
        expiresAt: weekEnd
      }
    ];
  }

  private checkWeeklyMissions(): void {
    const now = Date.now();
    let needsRegeneration = false;

    // Verificar si las misiones expiraron
    this.config.weeklyMissions.forEach(mission => {
      if (mission.expiresAt < now) {
        needsRegeneration = true;
      }
    });

    if (needsRegeneration) {
      this.config.weeklyMissions = this.generateWeeklyMissions();
      this.saveConfig();
    }
  }

  private checkTemporaryEvents(): void {
    // Eventos predefinidos
    const predefinedEvents: TemporaryEvent[] = [
      {
        id: 'event_double_xp_weekend',
        name: 'Fin de Semana Doble XP',
        description: 'Gana el doble de XP este fin de semana',
        type: 'double_xp',
        multiplier: 2,
        reward: 'badge_weekend_warrior',
        startsAt: this.getNextWeekendStart(),
        endsAt: this.getNextWeekendEnd(),
        active: false
      },
      {
        id: 'event_halloween_special',
        name: 'Evento Especial Halloween',
        description: 'Participa en el evento de Halloween',
        type: 'special_badge',
        multiplier: 1,
        reward: 'cosmetic_halloween_2024',
        startsAt: new Date('2024-10-25').getTime(),
        endsAt: new Date('2024-11-01').getTime(),
        active: false
      }
    ];

    // Actualizar estado de eventos
    predefinedEvents.forEach(event => {
      const now = Date.now();
      event.active = now >= event.startsAt && now <= event.endsAt;
      
      // Agregar si no existe y está activo
      if (event.active && !this.config.activeEvents.find(e => e.id === event.id)) {
        this.config.activeEvents.push(event);
      }
      
      // Remover si expiró
      if (!event.active) {
        this.config.activeEvents = this.config.activeEvents.filter(e => e.id !== event.id);
      }
    });

    this.saveConfig();
  }

  private getNextWeekendStart(): number {
    const now = new Date();
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysUntilSaturday);
    saturday.setHours(0, 0, 0, 0);
    return saturday.getTime();
  }

  private getNextWeekendEnd(): number {
    const start = this.getNextWeekendStart();
    return start + (2 * 24 * 60 * 60 * 1000); // +2 días
  }

  private setupEventListeners(): void {
    // Escuchar eventos de juego para actualizar progreso
    window.addEventListener('game:completed', () => {
      this.addGlobalPoints(10);
      this.updateMissionProgress('games', 1);
    });

    window.addEventListener('score:updated', (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      this.addGlobalPoints(Math.floor(detail / 100));
      this.updateMissionProgress('score', detail);
    });

    window.addEventListener('streak:updated', (e: Event) => {
      this.updateMissionProgress('streak', (e as CustomEvent<number>).detail);
    });

    window.addEventListener('social:interaction', () => {
      this.updateMissionProgress('social', 1);
    });

    window.addEventListener('xp:gained', (e: Event) => {
      this.addXP((e as CustomEvent<number>).detail);
    });
  }

  // Puntos Globales
  addGlobalPoints(points: number): void {
    const multiplier = this.getActiveXPMultiplier();
    const finalPoints = Math.floor(points * multiplier);
    this.config.globalPoints += finalPoints;
    this.saveConfig();
    
    window.dispatchEvent(new CustomEvent('gamification:points_updated', {
      detail: { points: this.config.globalPoints, added: finalPoints }
    }));
  }

  getGlobalPoints(): number {
    return this.config.globalPoints;
  }

  // Sistema de Niveles
  addXP(xp: number): void {
    const multiplier = this.getActiveXPMultiplier();
    const finalXP = Math.floor(xp * multiplier);
    this.config.level.xp += finalXP;

    // Verificar si subió de nivel
    while (this.config.level.xp >= this.config.level.xpToNext) {
      this.config.level.xp -= this.config.level.xpToNext;
      this.config.level.level++;
      this.config.level.xpToNext = Math.floor(this.config.level.xpToNext * 1.5);
      this.config.level.title = this.levelTitles[Math.min(this.config.level.level - 1, this.levelTitles.length - 1)];
      this.unlockLevelPerks(this.config.level.level);

      window.dispatchEvent(new CustomEvent('gamification:level_up', {
        detail: { level: this.config.level.level, title: this.config.level.title }
      }));
    }

    this.saveConfig();
  }

  private unlockLevelPerks(level: number): void {
    const perks: Record<number, string[]> = {
      5: ['custom_avatar_frame'],
      10: ['special_badge_veteran'],
      15: ['exclusive_theme'],
      20: ['legendary_title']
    };

    if (perks[level]) {
      this.config.level.perks.push(...perks[level]);
    }
  }

  getLevel(): UserLevel {
    return { ...this.config.level };
  }

  getActiveXPMultiplier(): number {
    let multiplier = 1;
    
    this.config.activeEvents.forEach(event => {
      if (event.type === 'double_xp' && event.active) {
        multiplier *= event.multiplier;
      }
    });

    return multiplier;
  }

  // Misiones Semanales
  updateMissionProgress(type: WeeklyMission['type'], amount: number): void {
    this.config.weeklyMissions.forEach(mission => {
      if (mission.type === type && !mission.completed) {
        mission.progress = Math.min(mission.progress + amount, mission.target);
        
        if (mission.progress >= mission.target) {
          mission.completed = true;
          this.completeMission(mission);
        }
      }
    });

    this.saveConfig();
  }

  private completeMission(mission: WeeklyMission): void {
    this.addXP(mission.reward.xp);
    this.addGlobalPoints(mission.reward.points);
    
    if (mission.reward.cosmetics) {
      // Desbloquear cosméticos
      window.dispatchEvent(new CustomEvent('cosmetic:unlocked', {
        detail: mission.reward.cosmetics
      }));
    }

    window.dispatchEvent(new CustomEvent('gamification:mission_completed', {
      detail: mission
    }));
  }

  getWeeklyMissions(): WeeklyMission[] {
    return [...this.config.weeklyMissions];
  }

  getMissionProgress(missionId: string): number {
    const mission = this.config.weeklyMissions.find(m => m.id === missionId);
    return mission ? mission.progress : 0;
  }

  // Eventos Temporales
  getActiveEvents(): TemporaryEvent[] {
    return this.config.activeEvents.filter(e => e.active);
  }

  getEventReward(eventId: string): string | null {
    const event = this.config.activeEvents.find(e => e.id === eventId);
    return event ? event.reward : null;
  }

  completeEvent(eventId: string): boolean {
    if (this.config.completedEvents.includes(eventId)) return false;

    const event = this.config.activeEvents.find(e => e.id === eventId);
    if (!event || !event.active) return false;

    this.config.completedEvents.push(eventId);
    this.saveConfig();

    // Otorgar recompensa
    if (event.type === 'special_badge') {
      window.dispatchEvent(new CustomEvent('badge:unlocked', {
        detail: { id: event.reward, name: event.name }
      }));
    }

    window.dispatchEvent(new CustomEvent('gamification:event_completed', {
      detail: event
    }));

    return true;
  }

  // Stats
  getStats(): {
    totalPoints: number;
    currentLevel: number;
    totalXP: number;
    completedMissions: number;
    activeEvents: number;
    completedEvents: number;
  } {
    return {
      totalPoints: this.config.globalPoints,
      currentLevel: this.config.level.level,
      totalXP: this.config.level.xp,
      completedMissions: this.config.weeklyMissions.filter(m => m.completed).length,
      activeEvents: this.config.activeEvents.filter(e => e.active).length,
      completedEvents: this.config.completedEvents.length
    };
  }

  resetProgress(): void {
    this.config = {
      globalPoints: 0,
      level: {
        level: 1,
        xp: 0,
        xpToNext: 100,
        title: 'Novato',
        perks: []
      },
      weeklyMissions: this.generateWeeklyMissions(),
      activeEvents: [],
      completedEvents: []
    };
    this.saveConfig();
  }
}

// Singleton instance
export const gamificationSystem = new GamificationSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.gamificationSystem = gamificationSystem;
}

export default gamificationSystem;
