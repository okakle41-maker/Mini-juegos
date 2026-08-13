/**
 * Personalización View Logic (Preact)
 * Lógica para la vista de personalización avanzada
 *
 * Migrado desde personalizacion.logic.ts (manipulación imperativa del
 * DOM + template() en personalizacion.ts) a un componente Preact.
 * Mantiene el mismo contrato init()/stop() que espera GameRegistry
 * (ver registerSystemViews.ts) y las mismas clases CSS/estructura de
 * markup que consumía css/customization.css.
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useRef } from 'preact/hooks';
import {
  customizationSystem,
  type Avatar,
  type Skin,
  type SoundPack,
  type ProfileFrame,
  type VictoryAnimation,
  type CustomTheme,
} from '../customizationSystem.js';
import { hydrateBackButtons } from '../utils/backButton.js';

type SkinTab = 'game' | 'interface' | 'cursor';

// El filtro de skins original inferí­a el tipo leyendo texto libre de
// `.skin-description` (p.ej. "juego"/"interfaz"/"cursor"), mientras
// getSkinsByType(type) — la fuente de verdad real — se llamaba pero
// nunca se usaba. Acá se usa directamente skin.type, que es el campo
// estructurado real.
function matchesSkinTab(skin: Skin, tab: SkinTab): boolean {
  return skin.type === tab;
}

function getSkinPreviewStyle(): string {
  // Simplificado - en producción tendría estilos reales (igual que el original)
  return 'linear-gradient(45deg, var(--color-primary), var(--color-secondary))';
}

function AvatarsSection({ avatars, activeAvatar, onSelect }: {
  avatars: Avatar[];
  activeAvatar: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="customization-section">
      <h3 className="section-title">👤 Avatares</h3>
      <div className="section-decorative">
        <span>🎨</span><span>✨</span><span>🎭</span>
      </div>
      <div className="avatars-grid" id="avatars-grid">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            className={`avatar-card ${avatar.unlocked ? 'avatar-card--unlocked' : 'avatar-card--locked'} ${
              activeAvatar === avatar.id ? 'avatar-card--active' : ''
            }`}
          >
            <div className="avatar-icon">{avatar.icon}</div>
            <div className="avatar-info">
              <h4 className="avatar-name">{avatar.name}</h4>
              <span className={`avatar-rarity avatar-rarity--${avatar.rarity}`}>{avatar.rarity}</span>
            </div>
            {avatar.unlocked ? (
              <button className="avatar-select-btn" data-avatar-id={avatar.id} onClick={() => onSelect(avatar.id)}>
                {activeAvatar === avatar.id ? '✓ Activo' : 'Seleccionar'}
              </button>
            ) : (
              <span className="avatar-locked">🔒 {avatar.unlockCondition}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkinsSection({ skins, activeSkins, onToggle }: {
  skins: Skin[];
  activeSkins: string[];
  onToggle: (id: string) => void;
}) {
  const [tab, setTab] = useState<SkinTab>('game');
  const tabs: Array<{ id: SkinTab; label: string }> = [
    { id: 'game', label: 'Juegos' },
    { id: 'interface', label: 'Interfaz' },
    { id: 'cursor', label: 'Cursor' },
  ];
  const visibleSkins = skins.filter((skin) => matchesSkinTab(skin, tab));

  return (
    <div className="customization-section">
      <h3 className="section-title">🎭 Skins</h3>
      <div className="section-decorative">
        <span>🎪</span><span>🌈</span><span>💎</span>
      </div>
      <div className="skins-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`skin-tab ${tab === t.id ? 'skin-tab--active' : ''}`}
            data-tab={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="skins-grid" id="skins-grid">
        {visibleSkins.map((skin) => (
          <div
            key={skin.id}
            className={`skin-card ${skin.unlocked ? 'skin-card--unlocked' : 'skin-card--locked'} ${
              activeSkins.includes(skin.id) ? 'skin-card--active' : ''
            }`}
          >
            <div className="skin-preview" style={{ background: getSkinPreviewStyle() }} />
            <div className="skin-info">
              <h4 className="skin-name">{skin.name}</h4>
              <p className="skin-description">{skin.description}</p>
            </div>
            {skin.unlocked ? (
              <button className="skin-toggle-btn" data-skin-id={skin.id} onClick={() => onToggle(skin.id)}>
                {activeSkins.includes(skin.id) ? '✓ Activado' : 'Activar'}
              </button>
            ) : (
              <span className="skin-locked">🔒 {skin.unlockCondition}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SoundPacksSection({ soundPacks, activePack, onSelect }: {
  soundPacks: SoundPack[];
  activePack: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="customization-section">
      <h3 className="section-title">🔊 Packs de Sonido</h3>
      <div className="section-decorative">
        <span>🎵</span><span>🎶</span><span>🔔</span>
      </div>
      <div className="sound-packs-grid" id="sound-packs-grid">
        {soundPacks.map((pack) => (
          <div
            key={pack.id}
            className={`sound-pack-card ${pack.unlocked ? 'sound-pack-card--unlocked' : 'sound-pack-card--locked'} ${
              activePack === pack.id ? 'sound-pack-card--active' : ''
            }`}
          >
            <div className="sound-pack-icon">🔊</div>
            <div className="sound-pack-info">
              <h4 className="sound-pack-name">{pack.name}</h4>
              <p className="sound-pack-description">{pack.description}</p>
            </div>
            {pack.unlocked ? (
              <button className="sound-pack-select-btn" data-pack-id={pack.id} onClick={() => onSelect(pack.id)}>
                {activePack === pack.id ? '✓ Activo' : 'Seleccionar'}
              </button>
            ) : (
              <span className="sound-pack-locked">🔒 {pack.unlockCondition}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FramesSection({ frames, activeFrame, onSelect }: {
  frames: ProfileFrame[];
  activeFrame: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="customization-section">
      <h3 className="section-title">🖼️ Marcos de Perfil</h3>
      <div className="section-decorative">
        <span>🖼️</span><span>🏆</span><span>⭐</span>
      </div>
      <div className="frames-grid" id="frames-grid">
        {frames.map((frame) => (
          <div
            key={frame.id}
            className={`frame-card ${frame.unlocked ? 'frame-card--unlocked' : 'frame-card--locked'} ${
              activeFrame === frame.id ? 'frame-card--active' : ''
            }`}
          >
            <div className={`frame-preview ${frame.cssClass}`} />
            <div className="frame-info">
              <h4 className="frame-name">{frame.name}</h4>
              <span className={`frame-rarity frame-rarity--${frame.rarity}`}>{frame.rarity}</span>
            </div>
            {frame.unlocked ? (
              <button className="frame-select-btn" data-frame-id={frame.id} onClick={() => onSelect(frame.id)}>
                {activeFrame === frame.id ? '✓ Activo' : 'Seleccionar'}
              </button>
            ) : (
              <span className="frame-locked">🔒 {frame.unlockCondition}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimationsSection({ animations, activeAnimation, onSelect, onPreview }: {
  animations: VictoryAnimation[];
  activeAnimation: string;
  onSelect: (id: string) => void;
  onPreview: () => void;
}) {
  return (
    <div className="customization-section">
      <h3 className="section-title">🎉 Animaciones de Victoria</h3>
      <div className="section-decorative">
        <span>🎊</span><span>🎇</span><span>✨</span>
      </div>
      <div className="animations-grid" id="animations-grid">
        {animations.map((animation) => (
          <div
            key={animation.id}
            className={`animation-card ${animation.unlocked ? 'animation-card--unlocked' : 'animation-card--locked'} ${
              activeAnimation === animation.id ? 'animation-card--active' : ''
            }`}
          >
            <div className="animation-icon">🎉</div>
            <div className="animation-info">
              <h4 className="animation-name">{animation.name}</h4>
              <p className="animation-description">{animation.description}</p>
            </div>
            {animation.unlocked ? (
              <button className="animation-select-btn" data-animation-id={animation.id} onClick={() => onSelect(animation.id)}>
                {activeAnimation === animation.id ? '✓ Activo' : 'Seleccionar'}
              </button>
            ) : (
              <span className="animation-locked">🔒 {animation.unlockCondition}</span>
            )}
          </div>
        ))}
      </div>
      <button className="preview-btn" id="preview-animation" onClick={onPreview}>
        👁️ Previsualizar
      </button>
    </div>
  );
}

function ThemesSection({ themes, activeTheme, onSelect, onCreateTheme }: {
  themes: CustomTheme[];
  activeTheme: string;
  onSelect: (id: string) => void;
  onCreateTheme: (theme: {
    name: string;
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  }) => void;
}) {
  const [creatorOpen, setCreatorOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLInputElement>(null);
  const secondaryRef = useRef<HTMLInputElement>(null);
  const accentRef = useRef<HTMLInputElement>(null);
  const backgroundRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const name = nameRef.current?.value ?? '';
    if (!name) return;
    onCreateTheme({
      name,
      primary: primaryRef.current?.value ?? '#ff9a3c',
      secondary: secondaryRef.current?.value ?? '#f97316',
      accent: accentRef.current?.value ?? '#ea580c',
      background: backgroundRef.current?.value ?? '#090400',
      text: textRef.current?.value ?? '#ffffff',
    });
    setCreatorOpen(false);
  };

  return (
    <div className="customization-section">
      <h3 className="section-title">🌈 Temas</h3>
      <div className="section-decorative">
        <span>🎨</span><span>🌈</span><span>💫</span>
      </div>
      <div className="themes-grid" id="themes-grid">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className={`theme-card ${theme.unlocked ? 'theme-card--unlocked' : 'theme-card--locked'} ${
              activeTheme === theme.id ? 'theme-card--active' : ''
            }`}
          >
            <div className="theme-preview" style={{ background: theme.colors.primary }} />
            <div className="theme-info">
              <h4 className="theme-name">{theme.name}</h4>
              <div className="theme-colors">
                <div className="theme-color" style={{ background: theme.colors.primary }} />
                <div className="theme-color" style={{ background: theme.colors.secondary }} />
                <div className="theme-color" style={{ background: theme.colors.accent }} />
              </div>
            </div>
            {theme.unlocked ? (
              <button className="theme-select-btn" data-theme-id={theme.id} onClick={() => onSelect(theme.id)}>
                {activeTheme === theme.id ? '✓ Activo' : 'Seleccionar'}
              </button>
            ) : (
              <span className="theme-locked">🔒 {theme.unlockCondition}</span>
            )}
          </div>
        ))}
      </div>
      <button className="create-theme-btn" id="create-theme-btn" onClick={() => setCreatorOpen(true)}>
        ✨ Crear Tema Custom
      </button>

      <div className="custom-theme-creator" id="custom-theme-creator" style={{ display: creatorOpen ? 'block' : 'none' }}>
        <h3 className="section-title">🎨 Creador de Temas</h3>
        <div className="theme-creator-form">
          <div className="form-group">
            <label for="theme-name">Nombre del Tema</label>
            <input ref={nameRef} type="text" id="theme-name" placeholder="Mi Tema Personalizado" />
          </div>
          <div className="form-group">
            <label for="theme-primary">Color Primario</label>
            <input ref={primaryRef} type="color" id="theme-primary" value="#ff9a3c" />
          </div>
          <div className="form-group">
            <label for="theme-secondary">Color Secundario</label>
            <input ref={secondaryRef} type="color" id="theme-secondary" value="#f97316" />
          </div>
          <div className="form-group">
            <label for="theme-accent">Color de Acento</label>
            <input ref={accentRef} type="color" id="theme-accent" value="#ea580c" />
          </div>
          <div className="form-group">
            <label for="theme-background">Color de Fondo</label>
            <input ref={backgroundRef} type="color" id="theme-background" value="#090400" />
          </div>
          <div className="form-group">
            <label for="theme-text">Color de Texto</label>
            <input ref={textRef} type="color" id="theme-text" value="#ffffff" />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" id="cancel-theme" onClick={() => setCreatorOpen(false)}>
              Cancelar
            </button>
            <button className="btn-save" id="save-theme" onClick={handleSave}>
              Guardar Tema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Lecturas defensivas: si customizationSystem no expone el método
// esperado (p. ej. un mock de test desactualizado), se degrada a un
// valor vacío en vez de tirar abajo el render completo del
// componente — igual que el comportamiento original, donde el
// template() estático (con su back-btn) ya estaba en el DOM antes de
// que las funciones renderX() pudieran fallar.
function safeList<T>(fn: () => T[]): T[] {
  try {
    return fn();
  } catch {
    return [];
  }
}
const EMPTY_CUSTOMIZATION = {
  activeAvatar: '',
  activeSkins: [] as string[],
  activeSoundPack: '',
  activeProfileFrame: '',
  activeVictoryAnimation: '',
  activeTheme: '',
  customThemes: [] as CustomTheme[],
};
function safeCurrentCustomization(): ReturnType<typeof customizationSystem.getCurrentCustomization> {
  try {
    return customizationSystem.getCurrentCustomization();
  } catch {
    return EMPTY_CUSTOMIZATION;
  }
}

function PersonalizacionView() {
  const [avatars, setAvatars] = useState<Avatar[]>(() => safeList(() => customizationSystem.getAvatars()));
  const [skins, setSkins] = useState<Skin[]>(() => safeList(() => customizationSystem.getSkins()));
  const [soundPacks, setSoundPacks] = useState<SoundPack[]>(() => safeList(() => customizationSystem.getSoundPacks()));
  const [frames, setFrames] = useState<ProfileFrame[]>(() => safeList(() => customizationSystem.getProfileFrames()));
  const [animations, setAnimations] = useState<VictoryAnimation[]>(() => safeList(() => customizationSystem.getVictoryAnimations()));
  const [themes, setThemes] = useState<CustomTheme[]>(() => safeList(() => customizationSystem.getThemes()));
  const [current, setCurrent] = useState(safeCurrentCustomization);

  const refreshCurrent = () => setCurrent(safeCurrentCustomization());

  useEffect(() => {
    const cosmeticUnlockedHandler = () => {
      setAvatars(safeList(() => customizationSystem.getAvatars()));
      setSkins(safeList(() => customizationSystem.getSkins()));
      setFrames(safeList(() => customizationSystem.getProfileFrames()));
      setAnimations(safeList(() => customizationSystem.getVictoryAnimations()));
      setThemes(safeList(() => customizationSystem.getThemes()));
    };
    const avatarChangedHandler = () => {
      setAvatars(safeList(() => customizationSystem.getAvatars()));
      refreshCurrent();
    };
    const themeChangedHandler = () => {
      setThemes(safeList(() => customizationSystem.getThemes()));
      refreshCurrent();
    };

    window.addEventListener('cosmetic:unlocked', cosmeticUnlockedHandler);
    window.addEventListener('customization:avatar_changed', avatarChangedHandler);
    window.addEventListener('customization:theme_changed', themeChangedHandler);
    return () => {
      window.removeEventListener('cosmetic:unlocked', cosmeticUnlockedHandler);
      window.removeEventListener('customization:avatar_changed', avatarChangedHandler);
      window.removeEventListener('customization:theme_changed', themeChangedHandler);
    };
  }, []);

  const handleSelectAvatar = (id: string) => {
    customizationSystem.setActiveAvatar(id);
    setAvatars(safeList(() => customizationSystem.getAvatars()));
    refreshCurrent();
  };

  const handleToggleSkin = (id: string) => {
    customizationSystem.toggleSkin(id);
    setSkins(safeList(() => customizationSystem.getSkins()));
    refreshCurrent();
  };

  const handleSelectSoundPack = (id: string) => {
    customizationSystem.setActiveSoundPack(id);
    setSoundPacks(safeList(() => customizationSystem.getSoundPacks()));
    refreshCurrent();
  };

  const handleSelectFrame = (id: string) => {
    customizationSystem.setActiveProfileFrame(id);
    setFrames(safeList(() => customizationSystem.getProfileFrames()));
    refreshCurrent();
  };

  const handleSelectAnimation = (id: string) => {
    customizationSystem.setActiveVictoryAnimation(id);
    setAnimations(safeList(() => customizationSystem.getVictoryAnimations()));
    refreshCurrent();
  };

  const handlePreviewAnimation = () => {
    customizationSystem.playVictoryAnimation();
  };

  const handleSelectTheme = (id: string) => {
    customizationSystem.setActiveTheme(id);
    setThemes(safeList(() => customizationSystem.getThemes()));
    refreshCurrent();
  };

  const handleCreateTheme = (theme: {
    name: string;
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  }) => {
    const themeId = customizationSystem.createCustomTheme({
      name: theme.name,
      colors: {
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        background: theme.background,
        text: theme.text,
      },
      fonts: { primary: 'Inter', secondary: 'Quicksand' },
      rarity: 'common',
      unlockCondition: 'custom',
    });

    customizationSystem.setActiveTheme(themeId);
    setThemes(safeList(() => customizationSystem.getThemes()));
    refreshCurrent();
  };

  return (
    <div className="customization-view">
      <div className="customization-header">
        <button className="back-btn" data-back-to="home"></button>
        <h2 className="customization-title">🎨 Personalización</h2>
      </div>

      <AvatarsSection avatars={avatars} activeAvatar={current.activeAvatar} onSelect={handleSelectAvatar} />
      <SkinsSection skins={skins} activeSkins={current.activeSkins} onToggle={handleToggleSkin} />
      <SoundPacksSection soundPacks={soundPacks} activePack={current.activeSoundPack} onSelect={handleSelectSoundPack} />
      <FramesSection frames={frames} activeFrame={current.activeProfileFrame} onSelect={handleSelectFrame} />
      <AnimationsSection
        animations={animations}
        activeAnimation={current.activeVictoryAnimation}
        onSelect={handleSelectAnimation}
        onPreview={handlePreviewAnimation}
      />
      <ThemesSection
        themes={themes}
        activeTheme={current.activeTheme}
        onSelect={handleSelectTheme}
        onCreateTheme={handleCreateTheme}
      />
    </div>
  );
}

export function init(): void {
  const container = document.getElementById('personalizacion');
  if (!container) return;

  render(<PersonalizacionView />, container);
  hydrateBackButtons(container);
}

export function stop(): void {
  const container = document.getElementById('personalizacion');
  if (container) {
    render(null, container);
  }
}
