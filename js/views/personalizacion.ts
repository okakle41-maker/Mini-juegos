/**
 * Personalización View Template
 * Vista para el sistema de personalización avanzada
 */
import type { ViewTemplate } from '../types/game';

export function template(): string {
  return `
    <div class="customization-view">
      <div class="customization-header">
        <button class="back-btn" data-back-to="home"></button>
        <h2 class="customization-title">🎨 Personalización</h2>
      </div>

      <!-- Avatares -->
      <div class="customization-section">
        <h3 class="section-title">👤 Avatares</h3>
        <div class="section-decorative">
          <span>🎨</span><span>✨</span><span>🎭</span>
        </div>
        <div class="avatars-grid" id="avatars-grid">
          <!-- Los avatares se generan dinámicamente -->
        </div>
      </div>

      <!-- Skins -->
      <div class="customization-section">
        <h3 class="section-title">🎭 Skins</h3>
        <div class="section-decorative">
          <span>🎪</span><span>🌈</span><span>💎</span>
        </div>
        <div class="skins-tabs">
          <button class="skin-tab skin-tab--active" data-tab="game">Juegos</button>
          <button class="skin-tab" data-tab="interface">Interfaz</button>
          <button class="skin-tab" data-tab="cursor">Cursor</button>
        </div>
        <div class="skins-grid" id="skins-grid">
          <!-- Los skins se generan dinámicamente -->
        </div>
      </div>

      <!-- Sound Packs -->
      <div class="customization-section">
        <h3 class="section-title">🔊 Packs de Sonido</h3>
        <div class="section-decorative">
          <span>🎵</span><span>🎶</span><span>🔔</span>
        </div>
        <div class="sound-packs-grid" id="sound-packs-grid">
          <!-- Los packs de sonido se generan dinámicamente -->
        </div>
      </div>

      <!-- Profile Frames -->
      <div class="customization-section">
        <h3 class="section-title">🖼️ Marcos de Perfil</h3>
        <div class="section-decorative">
          <span>🖼️</span><span>🏆</span><span>⭐</span>
        </div>
        <div class="frames-grid" id="frames-grid">
          <!-- Los marcos se generan dinámicamente -->
        </div>
      </div>

      <!-- Victory Animations -->
      <div class="customization-section">
        <h3 class="section-title">🎉 Animaciones de Victoria</h3>
        <div class="section-decorative">
          <span>🎊</span><span>🎇</span><span>✨</span>
        </div>
        <div class="animations-grid" id="animations-grid">
          <!-- Las animaciones se generan dinámicamente -->
        </div>
        <button class="preview-btn" id="preview-animation">👁️ Previsualizar</button>
      </div>

      <!-- Themes -->
      <div class="customization-section">
        <h3 class="section-title">🌈 Temas</h3>
        <div class="section-decorative">
          <span>🎨</span><span>🌈</span><span>💫</span>
        </div>
        <div class="themes-grid" id="themes-grid">
          <!-- Los temas se generan dinámicamente -->
        </div>
        <button class="create-theme-btn" id="create-theme-btn">✨ Crear Tema Custom</button>
      </div>

      <!-- Custom Theme Creator -->
      <div class="custom-theme-creator" id="custom-theme-creator" style="display: none;">
        <h3 class="section-title">🎨 Creador de Temas</h3>
        <div class="theme-creator-form">
          <div class="form-group">
            <label for="theme-name">Nombre del Tema</label>
            <input type="text" id="theme-name" placeholder="Mi Tema Personalizado">
          </div>
          <div class="form-group">
            <label for="theme-primary">Color Primario</label>
            <input type="color" id="theme-primary" value="#ff9a3c">
          </div>
          <div class="form-group">
            <label for="theme-secondary">Color Secundario</label>
            <input type="color" id="theme-secondary" value="#f97316">
          </div>
          <div class="form-group">
            <label for="theme-accent">Color de Acento</label>
            <input type="color" id="theme-accent" value="#ea580c">
          </div>
          <div class="form-group">
            <label for="theme-background">Color de Fondo</label>
            <input type="color" id="theme-background" value="#090400">
          </div>
          <div class="form-group">
            <label for="theme-text">Color de Texto</label>
            <input type="color" id="theme-text" value="#ffffff">
          </div>
          <div class="form-actions">
            <button class="btn-cancel" id="cancel-theme">Cancelar</button>
            <button class="btn-save" id="save-theme">Guardar Tema</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export default template satisfies ViewTemplate;
