/**
 * Preferences Manager
 * Maneja la persistencia de preferencias del usuario en localStorage
 */

interface UserPreferences {
  theme: 'dark' | 'neon' | 'ocean';
  reducedMotion: boolean;
  highContrast: boolean;
  musicVolume: number;
  soundEffects: boolean;
  sidebarCollapsed: boolean;
  lastPlayedGame?: string;
  favoriteGames: string[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  reducedMotion: false,
  highContrast: false,
  musicVolume: 0.7,
  soundEffects: true,
  sidebarCollapsed: false,
  favoriteGames: []
};

class PreferencesManager {
  private preferences: UserPreferences;
  private readonly STORAGE_KEY = 'minijuegos_preferences';
  private listeners: Set<(prefs: UserPreferences) => void> = new Set();

  constructor() {
    this.preferences = this.loadPreferences();
    this.applyPreferences();
  }

  private loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_PREFERENCES, ...parsed };
      }
    } catch (error) {
      console.error('[PreferencesManager] Error loading preferences:', error);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('[PreferencesManager] Error saving preferences:', error);
    }
  }

  private applyPreferences(): void {
    // Aplicar tema
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.value = this.preferences.theme;
      document.body.setAttribute('data-theme', this.preferences.theme);
    }

    // Aplicar reducción de movimiento
    const reducedMotionToggle = document.getElementById('reducedMotionToggle') as HTMLInputElement;
    if (reducedMotionToggle) {
      reducedMotionToggle.checked = this.preferences.reducedMotion;
      if (this.preferences.reducedMotion) {
        document.body.classList.add('reduced-motion');
      }
    }

    // Aplicar alto contraste
    const highContrastToggle = document.getElementById('highContrastToggle') as HTMLInputElement;
    if (highContrastToggle) {
      highContrastToggle.checked = this.preferences.highContrast;
      if (this.preferences.highContrast) {
        document.body.classList.add('high-contrast');
      }
    }

    // Aplicar volumen de música. `window.musicPlayer` no está declarado
    // en el tipo global (ver js/types/global.d.ts) porque ningún módulo
    // lo asigna actualmente — se comprueba su forma en runtime en vez
    // de tipar con `any`.
    const musicPlayer = (window as unknown as { musicPlayer?: unknown }).musicPlayer;
    if (
      musicPlayer &&
      typeof musicPlayer === 'object' &&
      'setVolume' in musicPlayer &&
      typeof (musicPlayer as { setVolume: unknown }).setVolume === 'function'
    ) {
      (musicPlayer as { setVolume: (volume: number) => void }).setVolume(this.preferences.musicVolume);
    }
  }

  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.preferences[key];
  }

  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.preferences[key] = value;
    this.savePreferences();
    this.notifyListeners();
  }

  update(updates: Partial<UserPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
    this.applyPreferences();
    this.notifyListeners();
  }

  reset(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.savePreferences();
    this.applyPreferences();
    this.notifyListeners();
  }

  subscribe(listener: (prefs: UserPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.preferences }));
  }

  // Métodos específicos para juegos favoritos
  addFavoriteGame(gameId: string): void {
    if (!this.preferences.favoriteGames.includes(gameId)) {
      this.preferences.favoriteGames.push(gameId);
      this.savePreferences();
      this.notifyListeners();
    }
  }

  removeFavoriteGame(gameId: string): void {
    this.preferences.favoriteGames = this.preferences.favoriteGames.filter(id => id !== gameId);
    this.savePreferences();
    this.notifyListeners();
  }

  isFavoriteGame(gameId: string): boolean {
    return this.preferences.favoriteGames.includes(gameId);
  }

  setLastPlayedGame(gameId: string): void {
    this.preferences.lastPlayedGame = gameId;
    this.savePreferences();
  }

  getLastPlayedGame(): string | undefined {
    return this.preferences.lastPlayedGame;
  }
}

// Singleton instance
export const preferencesManager = new PreferencesManager();

// Inicializar listeners para los toggles del header
document.addEventListener('DOMContentLoaded', () => {
  const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
  const reducedMotionToggle = document.getElementById('reducedMotionToggle') as HTMLInputElement;
  const highContrastToggle = document.getElementById('highContrastToggle') as HTMLInputElement;

  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      const theme = (e.target as HTMLSelectElement).value as 'dark' | 'neon' | 'ocean';
      preferencesManager.set('theme', theme);
      document.body.setAttribute('data-theme', theme);
    });
  }

  if (reducedMotionToggle) {
    reducedMotionToggle.addEventListener('change', (e) => {
      const reducedMotion = (e.target as HTMLInputElement).checked;
      preferencesManager.set('reducedMotion', reducedMotion);
      document.body.classList.toggle('reduced-motion', reducedMotion);
    });
  }

  if (highContrastToggle) {
    highContrastToggle.addEventListener('change', (e) => {
      const highContrast = (e.target as HTMLInputElement).checked;
      preferencesManager.set('highContrast', highContrast);
      document.body.classList.toggle('high-contrast', highContrast);
    });
  }
});

export default preferencesManager;
