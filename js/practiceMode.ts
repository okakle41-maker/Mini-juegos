/**
 * Practice Mode
 * Sistema de modo de práctica para juegos sin afectar estadísticas
 */

type PracticeMode = 'normal' | 'practice' | 'tutorial';

interface PracticeSettings {
  mode: PracticeMode;
  showHints: boolean;
  unlimitedTime: boolean;
  slowMotion: boolean;
  skipTutorial: boolean;
}

class PracticeModeManager {
  private currentMode: PracticeMode = 'normal';
  private settings: PracticeSettings;
  private practiceStats: Map<string, any> = new Map();
  private storageKey = 'practice-settings';

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): PracticeSettings {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[PracticeMode] Failed to load settings:', e);
      }
    }

    return {
      mode: 'normal',
      showHints: false,
      unlimitedTime: false,
      slowMotion: false,
      skipTutorial: false
    };
  }

  private saveSettings(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
  }

  setMode(mode: PracticeMode): void {
    this.currentMode = mode;
    this.settings.mode = mode;
    this.saveSettings();

    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('practice:mode-changed', { detail: mode }));
  }

  getMode(): PracticeMode {
    return this.currentMode;
  }

  isPracticeMode(): boolean {
    return this.currentMode === 'practice';
  }

  isTutorialMode(): boolean {
    return this.currentMode === 'tutorial';
  }

  isNormalMode(): boolean {
    return this.currentMode === 'normal';
  }

  setHintsEnabled(enabled: boolean): void {
    this.settings.showHints = enabled;
    this.saveSettings();
  }

  areHintsEnabled(): boolean {
    return this.settings.showHints;
  }

  setUnlimitedTime(enabled: boolean): void {
    this.settings.unlimitedTime = enabled;
    this.saveSettings();
  }

  isUnlimitedTime(): boolean {
    return this.settings.unlimitedTime;
  }

  setSlowMotion(enabled: boolean): void {
    this.settings.slowMotion = enabled;
    this.saveSettings();
  }

  isSlowMotion(): boolean {
    return this.settings.slowMotion;
  }

  setSkipTutorial(enabled: boolean): void {
    this.settings.skipTutorial = enabled;
    this.saveSettings();
  }

  shouldSkipTutorial(): boolean {
    return this.settings.skipTutorial;
  }

  getSettings(): PracticeSettings {
    return { ...this.settings };
  }

  resetSettings(): void {
    this.settings = {
      mode: 'normal',
      showHints: false,
      unlimitedTime: false,
      slowMotion: false,
      skipTutorial: false
    };
    this.currentMode = 'normal';
    this.saveSettings();
  }

  // Practice-specific stats (don't affect main stats)
  recordPracticeAttempt(gameId: string, score: number, duration: number, hintsUsed: number): void {
    if (!this.practiceStats.has(gameId)) {
      this.practiceStats.set(gameId, {
        attempts: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
        totalHints: 0,
        totalTime: 0
      });
    }

    const stats = this.practiceStats.get(gameId);
    stats.attempts++;
    stats.totalScore += score;
    stats.totalTime += duration;
    stats.totalHints += hintsUsed;

    if (score > stats.bestScore) {
      stats.bestScore = score;
    }

    stats.averageScore = stats.totalScore / stats.attempts;
  }

  getPracticeStats(gameId: string): any {
    return this.practiceStats.get(gameId);
  }

  getAllPracticeStats(): Map<string, any> {
    return new Map(this.practiceStats);
  }

  clearPracticeStats(): void {
    this.practiceStats.clear();
  }

  // Get adjusted time based on mode
  getAdjustedTime(baseTime: number): number {
    if (this.settings.unlimitedTime) {
      return Infinity;
    }
    if (this.settings.slowMotion) {
      return baseTime * 2; // Double time in slow motion
    }
    return baseTime;
  }

  // Get adjusted difficulty based on mode
  getAdjustedDifficulty(baseDifficulty: number): number {
    if (this.currentMode === 'tutorial') {
      return Math.max(1, baseDifficulty - 2); // Easier in tutorial
    }
    if (this.currentMode === 'practice') {
      return Math.max(1, baseDifficulty - 1); // Slightly easier in practice
    }
    return baseDifficulty;
  }

  // Check if hints should be shown for a game
  shouldShowHint(gameId: string, context: any): boolean {
    if (!this.settings.showHints) return false;
    if (this.currentMode === 'normal') return false;
    
    // In practice/tutorial mode, show hints based on context
    // This can be customized per game
    return true;
  }

  // Get hint text for a game and context
  getHint(gameId: string, context: any): string {
    const hints: Record<string, any> = {
      simon: 'Observa el patrón de colores y repítelo en el mismo orden',
      termita: 'Encuentra los pares de cartas. Recuerda dónde están las que ya viste',
      typix: 'El código tiene 5 dígitos. Los símbolos indican: ! = correcto, * = presente en otra posición',
      arrowGame: 'Presiona la flecha en la dirección que aparece. ¡Rápido!',
      sequence: 'Memoriza la secuencia y repítela en orden',
      memorygrid: 'Encuentra el patrón correcto. Empieza con las esquinas',
      reactor: 'Mantén el reactor estable. No dejes que la barra se llene',
      pairs: 'Empareja las cartas del mismo color. ¡Concéntrate!',
      rhythmclick: 'Haz clic en el ritmo del pulso. Sigue el beat',
      ringpuzzle: 'Mueve los anillos para formar el patrón correcto'
    };

    return hints[gameId] || 'Concéntrate y practica para mejorar';
  }
}

// Singleton instance
export const practiceMode = new PracticeModeManager();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).practiceMode = practiceMode;
}

export default practiceMode;
