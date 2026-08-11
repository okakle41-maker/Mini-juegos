/**
 * Customization System - Advanced personalization
 * Sistema de personalización con avatares, skins, efectos de sonido y temas
 */

interface Avatar {
  id: string;
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: string;
  unlocked: boolean;
}

interface Skin {
  id: string;
  name: string;
  description: string;
  type: 'game' | 'interface' | 'cursor';
  gameId?: string;
  cssClass: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: string;
  unlocked: boolean;
}

interface SoundPack {
  id: string;
  name: string;
  description: string;
  sounds: {
    click: string;
    success: string;
    error: string;
    achievement: string;
    levelUp: string;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: string;
  unlocked: boolean;
}

interface ProfileFrame {
  id: string;
  name: string;
  cssClass: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: string;
  unlocked: boolean;
}

interface VictoryAnimation {
  id: string;
  name: string;
  description: string;
  animationType: 'confetti' | 'fireworks' | 'particles' | 'special';
  cssClass: string;
  rarity: 'rare' | 'epic' | 'legendary';
  unlockCondition: string;
  unlocked: boolean;
}

interface CustomTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    primary: string;
    secondary: string;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: string;
  unlocked: boolean;
  isCustom: boolean;
}

interface PlayerCustomization {
  activeAvatar: string;
  activeSkins: string[];
  activeSoundPack: string;
  activeProfileFrame: string;
  activeVictoryAnimation: string;
  activeTheme: string;
  customThemes: CustomTheme[];
}

class CustomizationSystem {
  private avatars: Map<string, Avatar>;
  private skins: Map<string, Skin>;
  private soundPacks: Map<string, SoundPack>;
  private profileFrames: Map<string, ProfileFrame>;
  private victoryAnimations: Map<string, VictoryAnimation>;
  private customThemes: Map<string, CustomTheme>;
  
  private playerCustomization: PlayerCustomization;
  private storageKey = 'customization';

  constructor() {
    this.avatars = this.defineAvatars();
    this.skins = this.defineSkins();
    this.soundPacks = this.defineSoundPacks();
    this.profileFrames = this.defineProfileFrames();
    this.victoryAnimations = this.defineVictoryAnimations();
    this.customThemes = this.defineCustomThemes();
    
    this.playerCustomization = this.loadCustomization();
    this.syncWithAchievements();
  }

  private defineAvatars(): Map<string, Avatar> {
    const avatars: Avatar[] = [
      {
        id: 'avatar_default',
        name: 'Avatar por Defecto',
        icon: '👤',
        rarity: 'common',
        unlockCondition: 'default',
        unlocked: true
      },
      {
        id: 'avatar_robot',
        name: 'Robot',
        icon: '🤖',
        rarity: 'common',
        unlockCondition: 'play_10_games',
        unlocked: false
      },
      {
        id: 'avatar_alien',
        name: 'Alien',
        icon: '👽',
        rarity: 'rare',
        unlockCondition: 'complete_50_games',
        unlocked: false
      },
      {
        id: 'avatar_ninja',
        name: 'Ninja',
        icon: '🥷',
        rarity: 'rare',
        unlockCondition: 'streak_7_days',
        unlocked: false
      },
      {
        id: 'avatar_wizard',
        name: 'Mago',
        icon: '🧙',
        rarity: 'epic',
        unlockCondition: 'reach_level_20',
        unlocked: false
      },
      {
        id: 'avatar_dragon',
        name: 'Dragón',
        icon: '🐉',
        rarity: 'legendary',
        unlockCondition: 'unlock_all_achievements',
        unlocked: false
      },
      {
        id: 'avatar_ghost',
        name: 'Fantasma',
        icon: '👻',
        rarity: 'rare',
        unlockCondition: 'score_1000_total',
        unlocked: false
      },
      {
        id: 'avatar_astronaut',
        name: 'Astronauta',
        icon: '👨‍🚀',
        rarity: 'epic',
        unlockCondition: 'play_100_games',
        unlocked: false
      }
    ];

    return new Map(avatars.map(a => [a.id, a]));
  }

  private defineSkins(): Map<string, Skin> {
    const skins: Skin[] = [
      // Game skins
      {
        id: 'skin_termita_neon',
        name: 'Termita Neón',
        description: 'Skin neón para el juego Termita',
        type: 'game',
        gameId: 'termita',
        cssClass: 'skin-termita-neon',
        rarity: 'rare',
        unlockCondition: 'perfect_game_termita',
        unlocked: false
      },
      {
        id: 'skin_simon_retro',
        name: 'Simon Retro',
        description: 'Skin estilo retro para Simon Dice',
        type: 'game',
        gameId: 'simon',
        cssClass: 'skin-simon-retro',
        rarity: 'common',
        unlockCondition: 'play_simon_10_times',
        unlocked: false
      },
      {
        id: 'skin_arrow_cyber',
        name: 'Flechas Cyber',
        description: 'Skin cyberpunk para Desafío Flechas',
        type: 'game',
        gameId: 'arrow',
        cssClass: 'skin-arrow-cyber',
        rarity: 'epic',
        unlockCondition: 'high_score_arrow_500',
        unlocked: false
      },
      // Interface skins
      {
        id: 'skin_interface_minimal',
        name: 'Interfaz Minimal',
        description: 'Skin minimalista para la interfaz',
        type: 'interface',
        cssClass: 'skin-interface-minimal',
        rarity: 'common',
        unlockCondition: 'default',
        unlocked: true
      },
      {
        id: 'skin_interface_glass',
        name: 'Interfaz Glass',
        description: 'Skin efecto glass para la interfaz',
        type: 'interface',
        cssClass: 'skin-interface-glass',
        rarity: 'rare',
        unlockCondition: 'reach_level_10',
        unlocked: false
      },
      // Cursor skins
      {
        id: 'skin_cursor_rainbow',
        name: 'Cursor Arcoíris',
        description: 'Cursor con efecto arcoíris',
        type: 'cursor',
        cssClass: 'skin-cursor-rainbow',
        rarity: 'epic',
        unlockCondition: 'streak_30_days',
        unlocked: false
      },
      {
        id: 'skin_cursor_fire',
        name: 'Cursor Fuego',
        description: 'Cursor con efecto de fuego',
        type: 'cursor',
        cssClass: 'skin-cursor-fire',
        rarity: 'legendary',
        unlockCondition: 'complete_all_games',
        unlocked: false
      }
    ];

    return new Map(skins.map(s => [s.id, s]));
  }

  private defineSoundPacks(): Map<string, SoundPack> {
    const soundPacks: SoundPack[] = [
      {
        id: 'sounds_default',
        name: 'Sonidos por Defecto',
        description: 'Pack de sonidos original',
        sounds: {
          click: 'audio/sfx/click.mp3',
          success: 'audio/sfx/success.mp3',
          error: 'audio/sfx/error.mp3',
          achievement: 'audio/sfx/achievement.mp3',
          levelUp: 'audio/sfx/levelup.mp3'
        },
        rarity: 'common',
        unlockCondition: 'default',
        unlocked: true
      },
      {
        id: 'sounds_retro',
        name: 'Pack Retro',
        description: 'Sonidos estilo 8-bit',
        sounds: {
          click: 'audio/sfx/retro/click.mp3',
          success: 'audio/sfx/retro/success.mp3',
          error: 'audio/sfx/retro/error.mp3',
          achievement: 'audio/sfx/retro/achievement.mp3',
          levelUp: 'audio/sfx/retro/levelup.mp3'
        },
        rarity: 'rare',
        unlockCondition: 'play_50_games',
        unlocked: false
      },
      {
        id: 'sounds_orchestral',
        name: 'Pack Orquestal',
        description: 'Sonidos orquestales épicos',
        sounds: {
          click: 'audio/sfx/orchestral/click.mp3',
          success: 'audio/sfx/orchestral/success.mp3',
          error: 'audio/sfx/orchestral/error.mp3',
          achievement: 'audio/sfx/orchestral/achievement.mp3',
          levelUp: 'audio/sfx/orchestral/levelup.mp3'
        },
        rarity: 'epic',
        unlockCondition: 'reach_level_30',
        unlocked: false
      },
      {
        id: 'sounds_nature',
        name: 'Pack Naturaleza',
        description: 'Sonidos de naturaleza relajantes',
        sounds: {
          click: 'audio/sfx/nature/click.mp3',
          success: 'audio/sfx/nature/success.mp3',
          error: 'audio/sfx/nature/error.mp3',
          achievement: 'audio/sfx/nature/achievement.mp3',
          levelUp: 'audio/sfx/nature/levelup.mp3'
        },
        rarity: 'rare',
        unlockCondition: 'streak_14_days',
        unlocked: false
      }
    ];

    return new Map(soundPacks.map(s => [s.id, s]));
  }

  private defineProfileFrames(): Map<string, ProfileFrame> {
    const frames: ProfileFrame[] = [
      {
        id: 'frame_default',
        name: 'Marco por Defecto',
        cssClass: 'frame-default',
        rarity: 'common',
        unlockCondition: 'default',
        unlocked: true
      },
      {
        id: 'frame_gold',
        name: 'Marco Dorado',
        cssClass: 'frame-gold',
        rarity: 'rare',
        unlockCondition: 'reach_level_15',
        unlocked: false
      },
      {
        id: 'frame_silver',
        name: 'Marco Plateado',
        cssClass: 'frame-silver',
        rarity: 'common',
        unlockCondition: 'complete_25_games',
        unlocked: false
      },
      {
        id: 'frame_diamond',
        name: 'Marco Diamante',
        cssClass: 'frame-diamond',
        rarity: 'epic',
        unlockCondition: 'high_score_5000_total',
        unlocked: false
      },
      {
        id: 'frame_rainbow',
        name: 'Marco Arcoíris',
        cssClass: 'frame-rainbow',
        rarity: 'legendary',
        unlockCondition: 'unlock_all_titles',
        unlocked: false
      },
      {
        id: 'frame_neon',
        name: 'Marco Neón',
        cssClass: 'frame-neon',
        rarity: 'rare',
        unlockCondition: 'streak_21_days',
        unlocked: false
      }
    ];

    return new Map(frames.map(f => [f.id, f]));
  }

  private defineVictoryAnimations(): Map<string, VictoryAnimation> {
    const animations: VictoryAnimation[] = [
      {
        id: 'victory_confetti',
        name: 'Confeti Clásico',
        description: 'Animación de confeti tradicional',
        animationType: 'confetti',
        cssClass: 'victory-confetti',
        rarity: 'rare',
        unlockCondition: 'complete_first_game',
        unlocked: false
      },
      {
        id: 'victory_fireworks',
        name: 'Fuegos Artificiales',
        description: 'Espectacular show de fuegos artificiales',
        animationType: 'fireworks',
        cssClass: 'victory-fireworks',
        rarity: 'epic',
        unlockCondition: 'reach_level_25',
        unlocked: false
      },
      {
        id: 'victory_particles',
        name: 'Partículas Mágicas',
        description: 'Partículas mágicas flotantes',
        animationType: 'particles',
        cssClass: 'victory-particles',
        rarity: 'rare',
        unlockCondition: 'perfect_game',
        unlocked: false
      },
      {
        id: 'victory_special',
        name: 'Victoria Épica',
        description: 'Animación especial exclusiva',
        animationType: 'special',
        cssClass: 'victory-special',
        rarity: 'legendary',
        unlockCondition: 'complete_all_perfect_games',
        unlocked: false
      }
    ];

    return new Map(animations.map(a => [a.id, a]));
  }

  private defineCustomThemes(): Map<string, CustomTheme> {
    const themes: CustomTheme[] = [
      {
        id: 'theme_default',
        name: 'Tema por Defecto',
        colors: {
          primary: '#ff9a3c',
          secondary: '#f97316',
          accent: '#ea580c',
          background: '#090400',
          text: '#ffffff'
        },
        fonts: {
          primary: 'Inter',
          secondary: 'Baloo 2'
        },
        rarity: 'common',
        unlockCondition: 'default',
        unlocked: true,
        isCustom: false
      },
      {
        id: 'theme_midnight',
        name: 'Medianoche',
        colors: {
          primary: '#8b5cf6',
          secondary: '#7c3aed',
          accent: '#6d28d9',
          background: '#0f0a1e',
          text: '#e2e8f0'
        },
        fonts: {
          primary: 'Inter',
          secondary: 'Quicksand'
        },
        rarity: 'rare',
        unlockCondition: 'reach_level_5',
        unlocked: false,
        isCustom: false
      },
      {
        id: 'theme_forest',
        name: 'Bosque',
        colors: {
          primary: '#22c55e',
          secondary: '#16a34a',
          accent: '#15803d',
          background: '#0a1f0a',
          text: '#f0fdf4'
        },
        fonts: {
          primary: 'Inter',
          secondary: 'Quicksand'
        },
        rarity: 'rare',
        unlockCondition: 'streak_7_days',
        unlocked: false,
        isCustom: false
      },
      {
        id: 'theme_ocean',
        name: 'Océano Profundo',
        colors: {
          primary: '#0ea5e9',
          secondary: '#0284c7',
          accent: '#0369a1',
          background: '#0c1929',
          text: '#f0f9ff'
        },
        fonts: {
          primary: 'Inter',
          secondary: 'Quicksand'
        },
        rarity: 'epic',
        unlockCondition: 'reach_level_40',
        unlocked: false,
        isCustom: false
      },
      {
        id: 'theme_sunset',
        name: 'Atardecer',
        colors: {
          primary: '#f59e0b',
          secondary: '#d97706',
          accent: '#b45309',
          background: '#1a0f05',
          text: '#fffbeb'
        },
        fonts: {
          primary: 'Inter',
          secondary: 'Baloo 2'
        },
        rarity: 'epic',
        unlockCondition: 'complete_100_games',
        unlocked: false,
        isCustom: false
      }
    ];

    return new Map(themes.map(t => [t.id, t]));
  }

  private loadCustomization(): PlayerCustomization {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[Customization] Failed to load customization:', e);
      }
    }

    return {
      activeAvatar: 'avatar_default',
      activeSkins: ['skin_interface_minimal'],
      activeSoundPack: 'sounds_default',
      activeProfileFrame: 'frame_default',
      activeVictoryAnimation: 'victory_confetti',
      activeTheme: 'theme_default',
      customThemes: []
    };
  }

  private saveCustomization(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.playerCustomization));
  }

  private syncWithAchievements(): void {
    // Sync with achievement system if available
    if (typeof window !== 'undefined' && (window as any).achievementManager) {
      const achievementManager = (window as any).achievementManager;
      const cosmetics = achievementManager.getUnlockedCosmetics();
      
      cosmetics.forEach((cosmeticId: string) => {
        this.unlockItem(cosmeticId);
      });

      // Listen for new cosmetic unlocks
      window.addEventListener('cosmetic:unlocked', (e: any) => {
        this.unlockItem(e.detail.cosmetic);
      });
    }
  }

  private unlockItem(itemId: string): void {
    // Check all categories
    if (this.avatars.has(itemId)) {
      this.avatars.get(itemId)!.unlocked = true;
    }
    if (this.skins.has(itemId)) {
      this.skins.get(itemId)!.unlocked = true;
    }
    if (this.soundPacks.has(itemId)) {
      this.soundPacks.get(itemId)!.unlocked = true;
    }
    if (this.profileFrames.has(itemId)) {
      this.profileFrames.get(itemId)!.unlocked = true;
    }
    if (this.victoryAnimations.has(itemId)) {
      this.victoryAnimations.get(itemId)!.unlocked = true;
    }
    if (this.customThemes.has(itemId)) {
      this.customThemes.get(itemId)!.unlocked = true;
    }
  }

  // Avatar methods
  getAvatars(): Avatar[] {
    return [...this.avatars.values()];
  }

  getUnlockedAvatars(): Avatar[] {
    return [...this.avatars.values()].filter(a => a.unlocked);
  }

  setActiveAvatar(avatarId: string): boolean {
    const avatar = this.avatars.get(avatarId);
    if (!avatar || !avatar.unlocked) return false;

    this.playerCustomization.activeAvatar = avatarId;
    this.saveCustomization();
    this.applyAvatar(avatarId);
    
    window.dispatchEvent(new CustomEvent('customization:avatar_changed', { detail: { avatarId } }));
    return true;
  }

  private applyAvatar(avatarId: string): void {
    const avatar = this.avatars.get(avatarId);
    if (!avatar) return;

    // Update UI elements
    const avatarElements = document.querySelectorAll('.header-user-avatar');
    avatarElements.forEach(el => {
      el.textContent = avatar.icon;
    });
  }

  // Skin methods
  getSkins(): Skin[] {
    return [...this.skins.values()];
  }

  getSkinsByType(type: Skin['type']): Skin[] {
    return [...this.skins.values()].filter(s => s.type === type);
  }

  getUnlockedSkins(): Skin[] {
    return [...this.skins.values()].filter(s => s.unlocked);
  }

  toggleSkin(skinId: string): boolean {
    const skin = this.skins.get(skinId);
    if (!skin || !skin.unlocked) return false;

    const index = this.playerCustomization.activeSkins.indexOf(skinId);
    if (index > -1) {
      this.playerCustomization.activeSkins.splice(index, 1);
    } else {
      this.playerCustomization.activeSkins.push(skinId);
    }

    this.saveCustomization();
    this.applySkins();
    
    window.dispatchEvent(new CustomEvent('customization:skins_changed', { 
      detail: { skins: this.playerCustomization.activeSkins } 
    }));
    return true;
  }

  private applySkins(): void {
    // Remove all skin classes
    document.body.className = document.body.className.split(' ')
      .filter(c => !c.startsWith('skin-')).join(' ');

    // Apply active skins
    this.playerCustomization.activeSkins.forEach(skinId => {
      const skin = this.skins.get(skinId);
      if (skin) {
        document.body.classList.add(skin.cssClass);
      }
    });
  }

  // Sound pack methods
  getSoundPacks(): SoundPack[] {
    return [...this.soundPacks.values()];
  }

  getUnlockedSoundPacks(): SoundPack[] {
    return [...this.soundPacks.values()].filter(s => s.unlocked);
  }

  setActiveSoundPack(soundPackId: string): boolean {
    const soundPack = this.soundPacks.get(soundPackId);
    if (!soundPack || !soundPack.unlocked) return false;

    this.playerCustomization.activeSoundPack = soundPackId;
    this.saveCustomization();
    this.applySoundPack(soundPackId);
    
    window.dispatchEvent(new CustomEvent('customization:sound_pack_changed', { detail: { soundPackId } }));
    return true;
  }

  private applySoundPack(soundPackId: string): void {
    const soundPack = this.soundPacks.get(soundPackId);
    if (!soundPack) return;

    // This would integrate with the audio manager
    if (typeof window !== 'undefined' && (window as any).audioManager) {
      const audioManager = (window as any).audioManager;
      audioManager.setSoundPack(soundPack.sounds);
    }
  }

  // Profile frame methods
  getProfileFrames(): ProfileFrame[] {
    return [...this.profileFrames.values()];
  }

  getUnlockedProfileFrames(): ProfileFrame[] {
    return [...this.profileFrames.values()].filter(f => f.unlocked);
  }

  setActiveProfileFrame(frameId: string): boolean {
    const frame = this.profileFrames.get(frameId);
    if (!frame || !frame.unlocked) return false;

    this.playerCustomization.activeProfileFrame = frameId;
    this.saveCustomization();
    this.applyProfileFrame(frameId);
    
    window.dispatchEvent(new CustomEvent('customization:frame_changed', { detail: { frameId } }));
    return true;
  }

  private applyProfileFrame(frameId: string): void {
    const frame = this.profileFrames.get(frameId);
    if (!frame) return;

    // Remove all frame classes
    const avatarElements = document.querySelectorAll('.header-user-avatar');
    avatarElements.forEach(el => {
      el.className = el.className.split(' ')
        .filter(c => !c.startsWith('frame-')).join(' ');
      el.classList.add(frame.cssClass);
    });
  }

  // Victory animation methods
  getVictoryAnimations(): VictoryAnimation[] {
    return [...this.victoryAnimations.values()];
  }

  getUnlockedVictoryAnimations(): VictoryAnimation[] {
    return [...this.victoryAnimations.values()].filter(a => a.unlocked);
  }

  setActiveVictoryAnimation(animationId: string): boolean {
    const animation = this.victoryAnimations.get(animationId);
    if (!animation || !animation.unlocked) return false;

    this.playerCustomization.activeVictoryAnimation = animationId;
    this.saveCustomization();
    
    window.dispatchEvent(new CustomEvent('customization:victory_animation_changed', { detail: { animationId } }));
    return true;
  }

  playVictoryAnimation(): void {
    const animation = this.victoryAnimations.get(this.playerCustomization.activeVictoryAnimation);
    if (!animation) return;

    // Apply animation class
    document.body.classList.add(animation.cssClass);

    // Remove after animation completes
    setTimeout(() => {
      document.body.classList.remove(animation.cssClass);
    }, 3000);
  }

  // Theme methods
  getThemes(): CustomTheme[] {
    return [...this.customThemes.values()];
  }

  getUnlockedThemes(): CustomTheme[] {
    return [...this.customThemes.values()].filter(t => t.unlocked);
  }

  setActiveTheme(themeId: string): boolean {
    const theme = this.customThemes.get(themeId);
    if (!theme || !theme.unlocked) return false;

    this.playerCustomization.activeTheme = themeId;
    this.saveCustomization();
    this.applyTheme(theme);
    
    window.dispatchEvent(new CustomEvent('customization:theme_changed', { detail: { themeId } }));
    return true;
  }

  private applyTheme(theme: CustomTheme): void {
    // Apply CSS variables
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-background', theme.colors.background);
    root.style.setProperty('--color-text', theme.colors.text);
    root.style.setProperty('--font-primary', theme.fonts.primary);
    root.style.setProperty('--font-secondary', theme.fonts.secondary);
  }

  // Custom theme creation
  createCustomTheme(theme: Omit<CustomTheme, 'id' | 'unlocked' | 'isCustom'>): string {
    const id = `custom_${Date.now()}`;
    const newTheme: CustomTheme = {
      ...theme,
      id,
      unlocked: true,
      isCustom: true
    };

    this.customThemes.set(id, newTheme);
    this.playerCustomization.customThemes.push(newTheme);
    this.saveCustomization();
    
    window.dispatchEvent(new CustomEvent('customization:theme_created', { detail: { theme: newTheme } }));
    return id;
  }

  deleteCustomTheme(themeId: string): boolean {
    const theme = this.customThemes.get(themeId);
    if (!theme || !theme.isCustom) return false;

    this.customThemes.delete(themeId);
    this.playerCustomization.customThemes = this.playerCustomization.customThemes.filter(t => t.id !== themeId);
    
    if (this.playerCustomization.activeTheme === themeId) {
      this.setActiveTheme('theme_default');
    }

    this.saveCustomization();
    
    window.dispatchEvent(new CustomEvent('customization:theme_deleted', { detail: { themeId } }));
    return true;
  }

  // Get current customization
  getCurrentCustomization(): PlayerCustomization {
    return { ...this.playerCustomization };
  }

  // Reset customization
  resetCustomization(): void {
    this.playerCustomization = {
      activeAvatar: 'avatar_default',
      activeSkins: ['skin_interface_minimal'],
      activeSoundPack: 'sounds_default',
      activeProfileFrame: 'frame_default',
      activeVictoryAnimation: 'victory_confetti',
      activeTheme: 'theme_default',
      customThemes: []
    };

    // Reset unlocked items (except defaults)
    this.avatars.forEach(a => {
      if (a.unlockCondition !== 'default') a.unlocked = false;
    });
    this.skins.forEach(s => {
      if (s.unlockCondition !== 'default') s.unlocked = false;
    });
    this.soundPacks.forEach(s => {
      if (s.unlockCondition !== 'default') s.unlocked = false;
    });
    this.profileFrames.forEach(f => {
      if (f.unlockCondition !== 'default') f.unlocked = false;
    });
    this.victoryAnimations.forEach(v => {
      v.unlocked = false;
    });
    this.customThemes.forEach(t => {
      if (t.unlockCondition !== 'default') t.unlocked = false;
    });

    this.saveCustomization();
    this.applyAllCustomizations();
  }

  private applyAllCustomizations(): void {
    this.applyAvatar(this.playerCustomization.activeAvatar);
    this.applySkins();
    this.applySoundPack(this.playerCustomization.activeSoundPack);
    this.applyProfileFrame(this.playerCustomization.activeProfileFrame);
    
    const theme = this.customThemes.get(this.playerCustomization.activeTheme);
    if (theme) {
      this.applyTheme(theme);
    }
  }

  // Initialize customization on load
  initialize(): void {
    this.applyAllCustomizations();
  }
}

// Singleton instance
export const customizationSystem = new CustomizationSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.customizationSystem = customizationSystem;
}

export default customizationSystem;
