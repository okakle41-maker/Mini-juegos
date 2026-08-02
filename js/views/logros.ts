/**
 * Logros View Template
 * Vista para el sistema de logros y trofeos
 */
import type { ViewTemplate } from '../types/game';

export function template(): string {
  return `
    <div class="achievements-view">
      <div class="achievements-header">
        <button class="back-btn" data-back-to="home"></button>
        <h2 class="achievements-title">🏆 Logros y Trofeos</h2>
        <div class="achievements-summary">
          <div class="summary-card">
            <span class="summary-icon">🎖️</span>
            <span class="summary-value" id="achievements-unlocked">0</span>
            <span class="summary-label">Desbloqueados</span>
          </div>
          <div class="summary-card">
            <span class="summary-icon">📋</span>
            <span class="summary-value" id="achievements-total">0</span>
            <span class="summary-label">Total</span>
          </div>
          <div class="summary-card">
            <span class="summary-icon">⭐</span>
            <span class="summary-value" id="achievements-xp">0</span>
            <span class="summary-label">XP Total</span>
          </div>
        </div>
      </div>

      <div class="achievements-filters">
        <button class="filter-btn filter-btn--active" data-filter="all">Todos</button>
        <button class="filter-btn" data-filter="unlocked">Desbloqueados</button>
        <button class="filter-btn" data-filter="locked">Por Desbloquear</button>
        <button class="filter-btn" data-filter="games">Juegos</button>
        <button class="filter-btn" data-filter="streak">Rachas</button>
        <button class="filter-btn" data-filter="score">Puntuación</button>
        <button class="filter-btn" data-filter="special">Especiales</button>
      </div>

      <div class="achievements-rarity-filters">
        <button class="rarity-btn" data-rarity="legendary">👑 Legendario</button>
        <button class="rarity-btn" data-rarity="epic">💜 Épico</button>
        <button class="rarity-btn" data-rarity="rare">💙 Raro</button>
        <button class="rarity-btn" data-rarity="common">💚 Común</button>
      </div>

      <div class="achievements-decorative">
        <span class="decorative-icon">🌟</span>
        <span class="decorative-icon">✨</span>
        <span class="decorative-icon">🎊</span>
      </div>

      <div class="achievements-grid" id="achievements-grid">
        <!-- Los logros se generan dinámicamente -->
      </div>

      <div class="achievements-rewards-section">
        <h3 class="section-title">🎁 Recompensas Desbloqueadas</h3>
        
        <div class="rewards-subsection">
          <h4 class="subsection-title">Títulos</h4>
          <div class="titles-grid" id="titles-grid">
            <!-- Los títulos se generan dinámicamente -->
          </div>
        </div>

        <div class="rewards-subsection">
          <h4 class="subsection-title">Cosméticos</h4>
          <div class="cosmetics-grid" id="cosmetics-grid">
            <!-- Los cosméticos se generan dinámicamente -->
          </div>
        </div>
      </div>
    </div>
  `;
}

export default template satisfies ViewTemplate;
