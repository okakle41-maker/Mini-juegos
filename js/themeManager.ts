/**
 * Theme Manager
 * Gestión de temas con persistencia
 */

import safeStorage from './core/safeStorage.js';

type Theme = 'dark' | 'auto';

class ThemeManager {
  private currentTheme: Theme;
  private systemTheme: 'dark';
  private storageKey = 'theme-preference';

  constructor() {
    this.systemTheme = this.detectSystemTheme();
    this.currentTheme = this.loadTheme();
    this.applyTheme();
    this.setupSystemThemeListener();
  }

  private detectSystemTheme(): 'dark' {
    return 'dark';
  }

  private loadTheme(): Theme {
    const saved = safeStorage.getString(this.storageKey, 'auto');
    if (saved === 'dark' || saved === 'auto') {
      return saved as Theme;
    }
    return 'auto'; // Default to auto
  }

  private saveTheme(theme: Theme): void {
    safeStorage.setString(this.storageKey, theme);
  }

  private getEffectiveTheme(): 'dark' {
    return 'dark';
  }

  private applyTheme(): void {
    const effectiveTheme = this.getEffectiveTheme();
    const html = document.documentElement;
    
    html.setAttribute('data-theme', effectiveTheme);
    html.classList.remove('dark');
    html.classList.add(effectiveTheme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#1a1a2e');
    }

    // Dispatch event for UI components
    window.dispatchEvent(new CustomEvent('theme:changed', { detail: effectiveTheme }));
  }

  private setupSystemThemeListener(): void {
    // No longer needed since we only support dark mode
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme;
    this.saveTheme(theme);
    this.applyTheme();
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  toggleTheme(): void {
    // No longer applicable since we only support dark mode
    this.setTheme('dark');
  }

  cycleTheme(): void {
    const themes: Theme[] = ['dark', 'auto'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }

  // Helper to check if dark mode is active
  isDarkMode(): boolean {
    return true;
  }

  // Helper to check if light mode is active
  isLightMode(): boolean {
    return false;
  }
}

// Singleton instance
export const themeManager = new ThemeManager();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.themeManager = themeManager;
}

export default themeManager;
