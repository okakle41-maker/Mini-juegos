/**
 * Personalización View Logic
 * Lógica para la vista de personalización avanzada
 */

import { customizationSystem } from '../customizationSystem.js';
import { template } from './personalizacion.js';
import { hydrateBackButtons } from '../utils/backButton.js';

let eventListeners: Array<() => void> = [];
// (Sistema de caché de elementos DOM eliminado: getElement() nunca
// se llamaba en este archivo, así que cachedElements tampoco tenía
// nada real que limpiar.)

export function init(): void {
  const container = document.getElementById('personalizacion');
  if (!container) return;

  container.innerHTML = template();
  hydrateBackButtons(container);
  renderAvatars();
  renderSkins();
  renderSoundPacks();
  renderFrames();
  renderAnimations();
  renderThemes();
  setupEventListeners();
  setupCustomizationListeners();
}

function renderAvatars(): void {
  const avatars = customizationSystem.getAvatars();
  const activeAvatar = customizationSystem.getCurrentCustomization().activeAvatar;
  const grid = document.getElementById('avatars-grid');

  if (grid) {
    grid.innerHTML = avatars.map(avatar => `
      <div class="avatar-card ${avatar.unlocked ? 'avatar-card--unlocked' : 'avatar-card--locked'} ${activeAvatar === avatar.id ? 'avatar-card--active' : ''}">
        <div class="avatar-icon">${avatar.icon}</div>
        <div class="avatar-info">
          <h4 class="avatar-name">${avatar.name}</h4>
          <span class="avatar-rarity avatar-rarity--${avatar.rarity}">${avatar.rarity}</span>
        </div>
        ${avatar.unlocked ? `
          <button class="avatar-select-btn" data-avatar-id="${avatar.id}">
            ${activeAvatar === avatar.id ? '✓ Activo' : 'Seleccionar'}
          </button>
        ` : `
          <span class="avatar-locked">🔒 ${avatar.unlockCondition}</span>
        `}
      </div>
    `).join('');
  }
}

function renderSkins(): void {
  const skins = customizationSystem.getSkins();
  const activeSkins = customizationSystem.getCurrentCustomization().activeSkins;
  const grid = document.getElementById('skins-grid');

  if (grid) {
    grid.innerHTML = skins.map(skin => `
      <div class="skin-card ${skin.unlocked ? 'skin-card--unlocked' : 'skin-card--locked'} ${activeSkins.includes(skin.id) ? 'skin-card--active' : ''}">
        <div class="skin-preview" style="${getSkinPreviewStyle(skin)}"></div>
        <div class="skin-info">
          <h4 class="skin-name">${skin.name}</h4>
          <p class="skin-description">${skin.description}</p>
        </div>
        ${skin.unlocked ? `
          <button class="skin-toggle-btn" data-skin-id="${skin.id}">
            ${activeSkins.includes(skin.id) ? '✓ Activado' : 'Activar'}
          </button>
        ` : `
          <span class="skin-locked">🔒 ${skin.unlockCondition}</span>
        `}
      </div>
    `).join('');
  }
}

function renderSoundPacks(): void {
  const soundPacks = customizationSystem.getSoundPacks();
  const activePack = customizationSystem.getCurrentCustomization().activeSoundPack;
  const grid = document.getElementById('sound-packs-grid');

  if (grid) {
    grid.innerHTML = soundPacks.map(pack => `
      <div class="sound-pack-card ${pack.unlocked ? 'sound-pack-card--unlocked' : 'sound-pack-card--locked'} ${activePack === pack.id ? 'sound-pack-card--active' : ''}">
        <div class="sound-pack-icon">🔊</div>
        <div class="sound-pack-info">
          <h4 class="sound-pack-name">${pack.name}</h4>
          <p class="sound-pack-description">${pack.description}</p>
        </div>
        ${pack.unlocked ? `
          <button class="sound-pack-select-btn" data-pack-id="${pack.id}">
            ${activePack === pack.id ? '✓ Activo' : 'Seleccionar'}
          </button>
        ` : `
          <span class="sound-pack-locked">🔒 ${pack.unlockCondition}</span>
        `}
      </div>
    `).join('');
  }
}

function renderFrames(): void {
  const frames = customizationSystem.getProfileFrames();
  const activeFrame = customizationSystem.getCurrentCustomization().activeProfileFrame;
  const grid = document.getElementById('frames-grid');

  if (grid) {
    grid.innerHTML = frames.map(frame => `
      <div class="frame-card ${frame.unlocked ? 'frame-card--unlocked' : 'frame-card--locked'} ${activeFrame === frame.id ? 'frame-card--active' : ''}">
        <div class="frame-preview ${frame.cssClass}"></div>
        <div class="frame-info">
          <h4 class="frame-name">${frame.name}</h4>
          <span class="frame-rarity frame-rarity--${frame.rarity}">${frame.rarity}</span>
        </div>
        ${frame.unlocked ? `
          <button class="frame-select-btn" data-frame-id="${frame.id}">
            ${activeFrame === frame.id ? '✓ Activo' : 'Seleccionar'}
          </button>
        ` : `
          <span class="frame-locked">🔒 ${frame.unlockCondition}</span>
        `}
      </div>
    `).join('');
  }
}

function renderAnimations(): void {
  const animations = customizationSystem.getVictoryAnimations();
  const activeAnimation = customizationSystem.getCurrentCustomization().activeVictoryAnimation;
  const grid = document.getElementById('animations-grid');

  if (grid) {
    grid.innerHTML = animations.map(animation => `
      <div class="animation-card ${animation.unlocked ? 'animation-card--unlocked' : 'animation-card--locked'} ${activeAnimation === animation.id ? 'animation-card--active' : ''}">
        <div class="animation-icon">🎉</div>
        <div class="animation-info">
          <h4 class="animation-name">${animation.name}</h4>
          <p class="animation-description">${animation.description}</p>
        </div>
        ${animation.unlocked ? `
          <button class="animation-select-btn" data-animation-id="${animation.id}">
            ${activeAnimation === animation.id ? '✓ Activo' : 'Seleccionar'}
          </button>
        ` : `
          <span class="animation-locked">🔒 ${animation.unlockCondition}</span>
        `}
      </div>
    `).join('');
  }
}

function renderThemes(): void {
  const themes = customizationSystem.getThemes();
  const activeTheme = customizationSystem.getCurrentCustomization().activeTheme;
  const grid = document.getElementById('themes-grid');

  if (grid) {
    grid.innerHTML = themes.map(theme => `
      <div class="theme-card ${theme.unlocked ? 'theme-card--unlocked' : 'theme-card--locked'} ${activeTheme === theme.id ? 'theme-card--active' : ''}">
        <div class="theme-preview" style="background: ${theme.colors.primary}"></div>
        <div class="theme-info">
          <h4 class="theme-name">${theme.name}</h4>
          <div class="theme-colors">
            <div class="theme-color" style="background: ${theme.colors.primary}"></div>
            <div class="theme-color" style="background: ${theme.colors.secondary}"></div>
            <div class="theme-color" style="background: ${theme.colors.accent}"></div>
          </div>
        </div>
        ${theme.unlocked ? `
          <button class="theme-select-btn" data-theme-id="${theme.id}">
            ${activeTheme === theme.id ? '✓ Activo' : 'Seleccionar'}
          </button>
        ` : `
          <span class="theme-locked">🔒 ${theme.unlockCondition}</span>
        `}
      </div>
    `).join('');
  }
}

function getSkinPreviewStyle(_skin: unknown): string {
  // Simplificado - en producción tendría estilos reales
  return `background: linear-gradient(45deg, var(--color-primary), var(--color-secondary));`;
}

function setupEventListeners(): void {
  // Avatares
  document.querySelectorAll('.avatar-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const avatarId = (btn as HTMLElement).dataset.avatarId;
      if (avatarId) {
        customizationSystem.setActiveAvatar(avatarId);
        renderAvatars();
      }
    });
  });

  // Skins tabs
  document.querySelectorAll('.skin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.skin-tab').forEach(t => t.classList.remove('skin-tab--active'));
      tab.classList.add('skin-tab--active');
      filterSkins((tab as HTMLElement).dataset.tab || 'game');
    });
  });

  // Skins
  document.querySelectorAll('.skin-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const skinId = (btn as HTMLElement).dataset.skinId;
      if (skinId) {
        customizationSystem.toggleSkin(skinId);
        renderSkins();
      }
    });
  });

  // Sound packs
  document.querySelectorAll('.sound-pack-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const packId = (btn as HTMLElement).dataset.packId;
      if (packId) {
        customizationSystem.setActiveSoundPack(packId);
        renderSoundPacks();
      }
    });
  });

  // Frames
  document.querySelectorAll('.frame-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const frameId = (btn as HTMLElement).dataset.frameId;
      if (frameId) {
        customizationSystem.setActiveProfileFrame(frameId);
        renderFrames();
      }
    });
  });

  // Animations
  document.querySelectorAll('.animation-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const animationId = (btn as HTMLElement).dataset.animationId;
      if (animationId) {
        customizationSystem.setActiveVictoryAnimation(animationId);
        renderAnimations();
      }
    });
  });

  // Preview animation
  document.getElementById('preview-animation')?.addEventListener('click', () => {
    customizationSystem.playVictoryAnimation();
  });

  // Themes
  document.querySelectorAll('.theme-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const themeId = (btn as HTMLElement).dataset.themeId;
      if (themeId) {
        customizationSystem.setActiveTheme(themeId);
        renderThemes();
      }
    });
  });

  // Custom theme creator
  document.getElementById('create-theme-btn')?.addEventListener('click', () => {
    document.getElementById('custom-theme-creator')!.style.display = 'block';
  });

  document.getElementById('cancel-theme')?.addEventListener('click', () => {
    document.getElementById('custom-theme-creator')!.style.display = 'none';
  });

  document.getElementById('save-theme')?.addEventListener('click', () => {
    const name = (document.getElementById('theme-name') as HTMLInputElement).value;
    const primary = (document.getElementById('theme-primary') as HTMLInputElement).value;
    const secondary = (document.getElementById('theme-secondary') as HTMLInputElement).value;
    const accent = (document.getElementById('theme-accent') as HTMLInputElement).value;
    const background = (document.getElementById('theme-background') as HTMLInputElement).value;
    const text = (document.getElementById('theme-text') as HTMLInputElement).value;

    if (name) {
      const themeId = customizationSystem.createCustomTheme({
        name,
        colors: { primary, secondary, accent, background, text },
        fonts: { primary: 'Inter', secondary: 'Quicksand' },
        rarity: 'common',
        unlockCondition: 'custom'
      });
      
      customizationSystem.setActiveTheme(themeId);
      renderThemes();
      document.getElementById('custom-theme-creator')!.style.display = 'none';
    }
  });
}

function filterSkins(type: string): void {
  // Nota: se consulta getSkinsByType(type) (la fuente de verdad real)
  // pero el resultado nunca se usa — el filtrado de abajo funciona en
  // cambio por texto sobre el DOM ya renderizado (cardType.includes(...)
  // en español), una heurística más frágil que reimplementa lo que esta
  // llamada ya calculó. Reescribir el filtrado para usar `_skins`
  // directamente cambiaría comportamiento observable y excede una
  // limpieza de lint — se deja documentado.
  const _skins = customizationSystem.getSkinsByType(type as 'game' | 'interface' | 'cursor');
  const grid = document.getElementById('skins-grid');
  
  if (grid) {
    const allCards = grid.querySelectorAll('.skin-card');
    allCards.forEach(card => {
      const cardType = card.querySelector('.skin-description')?.textContent || '';
      let shouldShow = true;
      
      if (type === 'game') {
        shouldShow = cardType.includes('juego');
      } else if (type === 'interface') {
        shouldShow = cardType.includes('interfaz');
      } else if (type === 'cursor') {
        shouldShow = cardType.includes('cursor');
      }
      
      (card as HTMLElement).style.display = shouldShow ? 'block' : 'none';
    });
  }
}

function setupCustomizationListeners(): void {
  const cosmeticUnlockedHandler = () => {
    renderAvatars();
    renderSkins();
    renderFrames();
    renderAnimations();
    renderThemes();
  };
  const avatarChangedHandler = () => {
    renderAvatars();
  };
  const themeChangedHandler = () => {
    renderThemes();
  };

  window.addEventListener('cosmetic:unlocked', cosmeticUnlockedHandler);
  window.addEventListener('customization:avatar_changed', avatarChangedHandler);
  window.addEventListener('customization:theme_changed', themeChangedHandler);

  eventListeners.push(() => {
    window.removeEventListener('cosmetic:unlocked', cosmeticUnlockedHandler);
    window.removeEventListener('customization:avatar_changed', avatarChangedHandler);
    window.removeEventListener('customization:theme_changed', themeChangedHandler);
  });
}

export function stop(): void {
  // Limpiar event listeners
  eventListeners.forEach(cleanup => cleanup());
  eventListeners = [];
  
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('personalizacion');
  if (container) {
    container.innerHTML = '';
  }
}
