import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// CustomizationSystem se exporta como singleton (`export const
// customizationSystem = new CustomizationSystem()`) y su constructor
// llama a loadCustomization() (lee localStorage) y syncWithAchievements()
// (lee window.achievementManager si existe). Cada test necesita un
// módulo fresco vía vi.resetModules() + re-import dinámico — mismo
// patrón que test/safeStorage.test.ts y test/i18n.test.ts — para
// controlar el estado de localStorage antes de que el constructor corra.

async function freshCustomization(): Promise<typeof import('../js/customizationSystem').default> {
  vi.resetModules();
  return (await import('../js/customizationSystem')).default;
}

describe('CustomizationSystem — carga inicial', () => {
  it('sin nada guardado, usa los valores por defecto', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    const cs = await freshCustomization();

    const current = cs.getCurrentCustomization();
    expect(current).toEqual({
      activeAvatar: 'avatar_default',
      activeSkins: ['skin_interface_minimal'],
      activeSoundPack: 'sounds_default',
      activeProfileFrame: 'frame_default',
      activeVictoryAnimation: 'victory_confetti',
      activeTheme: 'theme_default',
      customThemes: [],
    });
  });

  it('con un valor guardado válido, lo usa en vez del default', async () => {
    (localStorage.getItem as any).mockReturnValue(
      JSON.stringify({
        activeAvatar: 'avatar_robot',
        activeSkins: [],
        activeSoundPack: 'sounds_default',
        activeProfileFrame: 'frame_default',
        activeVictoryAnimation: 'victory_confetti',
        activeTheme: 'theme_default',
        customThemes: [],
      })
    );
    const cs = await freshCustomization();

    expect(cs.getCurrentCustomization().activeAvatar).toBe('avatar_robot');
  });

  it('con un valor guardado corrupto (no pasa la validación de forma), cae al default', async () => {
    // safeStorage.getJSON valida 'activeAvatar' in value; un objeto sin
    // esa clave se descarta y cae al fallback.
    (localStorage.getItem as any).mockReturnValue(JSON.stringify({ foo: 'bar' }));
    const cs = await freshCustomization();

    expect(cs.getCurrentCustomization().activeAvatar).toBe('avatar_default');
  });

  it('los items por defecto (avatar, skin de interfaz, tema) empiezan desbloqueados', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    const cs = await freshCustomization();

    expect(cs.getAvatars().find((a) => a.id === 'avatar_default')?.unlocked).toBe(true);
    expect(cs.getSkins().find((s) => s.id === 'skin_interface_minimal')?.unlocked).toBe(true);
    expect(cs.getThemes().find((t) => t.id === 'theme_default')?.unlocked).toBe(true);
  });

  it('los items no-default empiezan bloqueados', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    const cs = await freshCustomization();

    expect(cs.getAvatars().find((a) => a.id === 'avatar_robot')?.unlocked).toBe(false);
    expect(cs.getSkins().find((s) => s.id === 'skin_termita_neon')?.unlocked).toBe(false);
  });
});

describe('CustomizationSystem — avatares', () => {
  let cs: Awaited<ReturnType<typeof freshCustomization>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    cs = await freshCustomization();
  });

  it('setActiveAvatar falla si el avatar no está desbloqueado', () => {
    const result = cs.setActiveAvatar('avatar_robot');
    expect(result).toBe(false);
    expect(cs.getCurrentCustomization().activeAvatar).toBe('avatar_default');
  });

  it('setActiveAvatar falla si el id no existe', () => {
    const result = cs.setActiveAvatar('avatar_inexistente');
    expect(result).toBe(false);
  });

  it('setActiveAvatar funciona si el avatar está desbloqueado (el default lo está)', () => {
    const result = cs.setActiveAvatar('avatar_default');
    expect(result).toBe(true);
    expect(cs.getCurrentCustomization().activeAvatar).toBe('avatar_default');
  });

  it('setActiveAvatar persiste el cambio en localStorage', () => {
    cs.setActiveAvatar('avatar_default');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'customization',
      expect.stringContaining('avatar_default')
    );
  });

  it('setActiveAvatar dispara "customization:avatar_changed" con el avatarId', () => {
    const handler = vi.fn();
    window.addEventListener('customization:avatar_changed', handler);

    cs.setActiveAvatar('avatar_default');

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ avatarId: 'avatar_default' });

    window.removeEventListener('customization:avatar_changed', handler);
  });

  it('getActiveAvatarIcon devuelve el ícono del avatar activo', () => {
    expect(cs.getActiveAvatarIcon()).toBe('👤'); // avatar_default
  });

  it('getUnlockedAvatars solo incluye avatares desbloqueados', () => {
    const unlocked = cs.getUnlockedAvatars();
    expect(unlocked.every((a) => a.unlocked)).toBe(true);
    expect(unlocked.map((a) => a.id)).toEqual(['avatar_default']);
  });
});

describe('CustomizationSystem — skins (toggle real, no solo set)', () => {
  let cs: Awaited<ReturnType<typeof freshCustomization>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    cs = await freshCustomization();
  });

  it('toggleSkin falla si el skin no existe', () => {
    expect(cs.toggleSkin('skin_inexistente')).toBe(false);
  });

  it('toggleSkin falla si el skin existe pero no está desbloqueado', () => {
    expect(cs.toggleSkin('skin_termita_neon')).toBe(false);
    expect(cs.getCurrentCustomization().activeSkins).not.toContain('skin_termita_neon');
  });

  it('toggleSkin sobre un skin activo lo desactiva (skin_interface_minimal viene activo por defecto)', () => {
    const result = cs.toggleSkin('skin_interface_minimal');
    expect(result).toBe(true);
    expect(cs.getCurrentCustomization().activeSkins).not.toContain('skin_interface_minimal');
  });

  it('toggleSkin sobre un skin activo lo desactiva, y aplicado de nuevo lo reactiva', () => {
    cs.toggleSkin('skin_interface_minimal'); // lo saca
    expect(cs.getCurrentCustomization().activeSkins).not.toContain('skin_interface_minimal');

    cs.toggleSkin('skin_interface_minimal'); // lo vuelve a poner
    expect(cs.getCurrentCustomization().activeSkins).toContain('skin_interface_minimal');
  });

  it('toggleSkin dispara "customization:skins_changed" con la lista actualizada', () => {
    const handler = vi.fn();
    window.addEventListener('customization:skins_changed', handler);

    cs.toggleSkin('skin_interface_minimal');

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail as { skins: string[] };
    expect(detail.skins).not.toContain('skin_interface_minimal');

    window.removeEventListener('customization:skins_changed', handler);
  });

  it('getSkinsByType filtra correctamente por tipo', () => {
    const gameSkins = cs.getSkinsByType('game');
    expect(gameSkins.length).toBeGreaterThan(0);
    expect(gameSkins.every((s) => s.type === 'game')).toBe(true);
  });
});

describe('CustomizationSystem — temas personalizados', () => {
  let cs: Awaited<ReturnType<typeof freshCustomization>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    cs = await freshCustomization();
  });

  const themeInput = {
    name: 'Mi Tema',
    colors: {
      primary: '#111111',
      secondary: '#222222',
      accent: '#333333',
      background: '#000000',
      text: '#ffffff',
    },
    fonts: { primary: 'Inter', secondary: 'Inter' },
    rarity: 'common' as const,
    unlockCondition: 'default',
  };

  it('createCustomTheme agrega el tema, desbloqueado y marcado como custom', () => {
    const id = cs.createCustomTheme(themeInput);

    const created = cs.getThemes().find((t) => t.id === id);
    expect(created).toBeDefined();
    expect(created?.unlocked).toBe(true);
    expect(created?.isCustom).toBe(true);
    expect(created?.name).toBe('Mi Tema');
  });

  it('createCustomTheme dispara "customization:theme_created"', () => {
    const handler = vi.fn();
    window.addEventListener('customization:theme_created', handler);

    cs.createCustomTheme(themeInput);

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('customization:theme_created', handler);
  });

  it('deleteCustomTheme elimina un tema creado por el usuario', () => {
    const id = cs.createCustomTheme(themeInput);
    const result = cs.deleteCustomTheme(id);

    expect(result).toBe(true);
    expect(cs.getThemes().find((t) => t.id === id)).toBeUndefined();
  });

  it('deleteCustomTheme falla sobre un tema que no es custom (ej. theme_default)', () => {
    const result = cs.deleteCustomTheme('theme_default');
    expect(result).toBe(false);
    expect(cs.getThemes().find((t) => t.id === 'theme_default')).toBeDefined();
  });

  it('deleteCustomTheme falla sobre un id inexistente', () => {
    expect(cs.deleteCustomTheme('no_existe')).toBe(false);
  });

  it('al borrar el tema custom que estaba activo, cae de vuelta a theme_default', () => {
    const id = cs.createCustomTheme(themeInput);
    cs.setActiveTheme(id);
    expect(cs.getCurrentCustomization().activeTheme).toBe(id);

    cs.deleteCustomTheme(id);

    expect(cs.getCurrentCustomization().activeTheme).toBe('theme_default');
  });

  it('setActiveTheme falla si el tema no está desbloqueado', () => {
    // theme_sunset (visto en el código fuente) requiere
    // 'complete_100_games' y no está desbloqueado por defecto.
    const result = cs.setActiveTheme('theme_sunset');
    expect(result).toBe(false);
  });
});

describe('CustomizationSystem — resetCustomization', () => {
  let cs: Awaited<ReturnType<typeof freshCustomization>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    cs = await freshCustomization();
  });

  it('vuelve todos los valores activos a sus defaults', () => {
    cs.toggleSkin('skin_interface_minimal'); // lo desactiva primero

    cs.resetCustomization();

    expect(cs.getCurrentCustomization()).toEqual({
      activeAvatar: 'avatar_default',
      activeSkins: ['skin_interface_minimal'],
      activeSoundPack: 'sounds_default',
      activeProfileFrame: 'frame_default',
      activeVictoryAnimation: 'victory_confetti',
      activeTheme: 'theme_default',
      customThemes: [],
    });
  });

  it('mantiene desbloqueados los items con unlockCondition "default"', () => {
    cs.resetCustomization();
    expect(cs.getAvatars().find((a) => a.id === 'avatar_default')?.unlocked).toBe(true);
  });

  it('resetCustomization no lanza y produce un estado consistente incluso sin achievementManager global', () => {
    // syncWithAchievements solo engancha el listener de
    // 'cosmetic:unlocked' si window.achievementManager existe; en el
    // entorno de test no existe, así que se documenta que
    // resetCustomization sigue siendo seguro de llamar en ese caso.
    expect(() => cs.resetCustomization()).not.toThrow();
    expect(cs.getAvatars().find((a) => a.id === 'avatar_robot')?.unlocked).toBe(false);
  });

  it('elimina los temas custom creados por el usuario del array de active, pero no del Map de temas', () => {
    // resetCustomization reinicia playerCustomization.customThemes a []
    // pero no borra las entradas del Map interno this.customThemes —
    // se documenta el comportamiento real tal como está escrito.
    const id = cs.createCustomTheme({
      name: 'Temporal',
      colors: { primary: '#000', secondary: '#000', accent: '#000', background: '#000', text: '#fff' },
      fonts: { primary: 'Inter', secondary: 'Inter' },
      rarity: 'common',
      unlockCondition: 'default',
    });

    cs.resetCustomization();

    expect(cs.getCurrentCustomization().customThemes).toEqual([]);
    // El tema sigue existiendo en el catálogo general (getThemes), aunque
    // ya no esté en la lista personal de temas creados.
    expect(cs.getThemes().find((t) => t.id === id)).toBeDefined();
  });
});

describe('CustomizationSystem — profile frames y sound packs', () => {
  let cs: Awaited<ReturnType<typeof freshCustomization>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    cs = await freshCustomization();
  });

  it('setActiveProfileFrame falla si el frame no está desbloqueado', () => {
    const locked = cs.getProfileFrames().find((f) => !f.unlocked);
    expect(locked).toBeDefined();
    expect(cs.setActiveProfileFrame(locked!.id)).toBe(false);
  });

  it('setActiveProfileFrame funciona con el frame por defecto', () => {
    expect(cs.setActiveProfileFrame('frame_default')).toBe(true);
  });

  it('setActiveSoundPack falla si el pack no está desbloqueado', () => {
    const locked = cs.getSoundPacks().find((s) => !s.unlocked);
    expect(locked).toBeDefined();
    expect(cs.setActiveSoundPack(locked!.id)).toBe(false);
  });

  it('setActiveSoundPack funciona con el pack por defecto', () => {
    expect(cs.setActiveSoundPack('sounds_default')).toBe(true);
    expect(cs.getCurrentCustomization().activeSoundPack).toBe('sounds_default');
  });

  it('getUnlockedProfileFrames y getUnlockedSoundPacks solo devuelven desbloqueados', () => {
    expect(cs.getUnlockedProfileFrames().every((f) => f.unlocked)).toBe(true);
    expect(cs.getUnlockedSoundPacks().every((s) => s.unlocked)).toBe(true);
  });
});

describe('CustomizationSystem — animaciones de victoria', () => {
  let cs: Awaited<ReturnType<typeof freshCustomization>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    cs = await freshCustomization();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setActiveVictoryAnimation falla si la animación no está desbloqueada', () => {
    // A diferencia de otros catálogos, ninguna VictoryAnimation tiene
    // unlockCondition 'default' en el código fuente (todas empiezan
    // bloqueadas) — se confirma ese comportamiento real.
    const anims = cs.getVictoryAnimations();
    expect(anims.every((a) => !a.unlocked)).toBe(true);
    expect(cs.setActiveVictoryAnimation(anims[0].id)).toBe(false);
  });

  it('playVictoryAnimation no lanza cuando no hay animación activa desbloqueada', () => {
    // activeVictoryAnimation apunta a 'victory_confetti' por defecto,
    // pero esa animación no está desbloqueada (ver test anterior) —
    // playVictoryAnimation debe no-opear sin lanzar.
    expect(() => cs.playVictoryAnimation()).not.toThrow();
  });
});
