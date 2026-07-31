/**
 * Difficulty Presets System
 * Sistema de presets de dificultad para juegos
 */

type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'expert' | 'custom';

interface DifficultyPreset {
  id: DifficultyLevel;
  name: string;
  description: string;
  icon: string;
  settings: {
    timeMultiplier: number;
    scoreMultiplier: number;
    hintsEnabled: boolean;
    showPreview: boolean;
    maxErrors: number;
    speed: number;
    complexity: number;
  };
}

interface GameDifficultySettings {
  gameId: string;
  preset: DifficultyLevel;
  customSettings?: Partial<DifficultyPreset['settings']>;
}

class DifficultyPresetsManager {
  private presets: Map<DifficultyLevel, DifficultyPreset>;
  private gameSettings: Map<string, GameDifficultySettings>;
  private storageKey = 'difficulty-presets';

  constructor() {
    this.presets = this.definePresets();
    this.gameSettings = this.loadGameSettings();
  }

  private definePresets(): Map<DifficultyLevel, DifficultyPreset> {
    return new Map([
      ['easy', {
        id: 'easy',
        name: 'Fácil',
        description: 'Tiempo amplio, sin penalizaciones',
        icon: '🌱',
        settings: {
          timeMultiplier: 2.0,
          scoreMultiplier: 0.5,
          hintsEnabled: true,
          showPreview: true,
          maxErrors: Infinity,
          speed: 0.5,
          complexity: 1
        }
      }],
      ['normal', {
        id: 'normal',
        name: 'Normal',
        description: 'Experiencia balanceada',
        icon: '⚖️',
        settings: {
          timeMultiplier: 1.0,
          scoreMultiplier: 1.0,
          hintsEnabled: false,
          showPreview: false,
          maxErrors: 3,
          speed: 1.0,
          complexity: 2
        }
      }],
      ['hard', {
        id: 'hard',
        name: 'Difícil',
        description: 'Tiempo limitado, penalizaciones activas',
        icon: '🔥',
        settings: {
          timeMultiplier: 0.7,
          scoreMultiplier: 1.5,
          hintsEnabled: false,
          showPreview: false,
          maxErrors: 1,
          speed: 1.5,
          complexity: 3
        }
      }],
      ['expert', {
        id: 'expert',
        name: 'Experto',
        description: 'Máximo desafío, sin errores permitidos',
        icon: '💀',
        settings: {
          timeMultiplier: 0.5,
          scoreMultiplier: 2.0,
          hintsEnabled: false,
          showPreview: false,
          maxErrors: 0,
          speed: 2.0,
          complexity: 4
        }
      }]
    ]);
  }

  private loadGameSettings(): Map<string, GameDifficultySettings> {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        return new Map(data);
      } catch (e) {
        console.error('[DifficultyPresets] Failed to load settings:', e);
      }
    }
    return new Map();
  }

  private saveGameSettings(): void {
    localStorage.setItem(this.storageKey, JSON.stringify([...this.gameSettings]));
  }

  getPreset(level: DifficultyLevel): DifficultyPreset | undefined {
    return this.presets.get(level);
  }

  getAllPresets(): DifficultyPreset[] {
    return [...this.presets.values()];
  }

  setGamePreset(gameId: string, preset: DifficultyLevel): void {
    this.gameSettings.set(gameId, { gameId, preset });
    this.saveGameSettings();
  }

  getGamePreset(gameId: string): DifficultyLevel {
    const settings = this.gameSettings.get(gameId);
    return settings?.preset || 'normal';
  }

  setCustomSettings(gameId: string, customSettings: Partial<DifficultyPreset['settings']>): void {
    const current = this.gameSettings.get(gameId);
    this.gameSettings.set(gameId, {
      gameId,
      preset: 'custom',
      customSettings: { ...current?.customSettings, ...customSettings }
    });
    this.saveGameSettings();
  }

  getGameSettings(gameId: string): DifficultyPreset['settings'] {
    const settings = this.gameSettings.get(gameId);
    
    if (!settings) {
      return this.getPreset('normal')!.settings;
    }

    if (settings.preset === 'custom' && settings.customSettings) {
      const basePreset = this.getPreset('normal')!.settings;
      return { ...basePreset, ...settings.customSettings };
    }

    return this.getPreset(settings.preset)!.settings;
  }

  getAdjustedTime(baseTime: number, gameId: string): number {
    const settings = this.getGameSettings(gameId);
    return baseTime * settings.timeMultiplier;
  }

  getAdjustedScore(baseScore: number, gameId: string): number {
    const settings = this.getGameSettings(gameId);
    return Math.round(baseScore * settings.scoreMultiplier);
  }

  areHintsEnabled(gameId: string): boolean {
    const settings = this.getGameSettings(gameId);
    return settings.hintsEnabled;
  }

  shouldShowPreview(gameId: string): boolean {
    const settings = this.getGameSettings(gameId);
    return settings.showPreview;
  }

  getMaxErrors(gameId: string): number {
    const settings = this.getGameSettings(gameId);
    return settings.maxErrors;
  }

  getSpeed(gameId: string): number {
    const settings = this.getGameSettings(gameId);
    return settings.speed;
  }

  getComplexity(gameId: string): number {
    const settings = this.getGameSettings(gameId);
    return settings.complexity;
  }

  resetGameSettings(gameId: string): void {
    this.gameSettings.delete(gameId);
    this.saveGameSettings();
  }

  resetAllSettings(): void {
    this.gameSettings.clear();
    this.saveGameSettings();
  }

  // Helper to get difficulty description for UI
  getDifficultyDescription(level: DifficultyLevel): string {
    const preset = this.getPreset(level);
    return preset ? preset.description : '';
  }

  // Helper to get difficulty icon for UI
  getDifficultyIcon(level: DifficultyLevel): string {
    const preset = this.getPreset(level);
    return preset ? preset.icon : '⚖️';
  }

  // Helper to get next difficulty level
  getNextDifficulty(current: DifficultyLevel): DifficultyLevel {
    const levels: DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert'];
    const currentIndex = levels.indexOf(current);
    const nextIndex = (currentIndex + 1) % levels.length;
    return levels[nextIndex];
  }

  // Helper to get previous difficulty level
  getPreviousDifficulty(current: DifficultyLevel): DifficultyLevel {
    const levels: DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert'];
    const currentIndex = levels.indexOf(current);
    const prevIndex = (currentIndex - 1 + levels.length) % levels.length;
    return levels[prevIndex];
  }
}

// Singleton instance
export const difficultyPresets = new DifficultyPresetsManager();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).difficultyPresets = difficultyPresets;
}

export default difficultyPresets;
