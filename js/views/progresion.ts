/**
 * Progresión View Template
 * Vista para el sistema de progresión y RPG
 */

export function template(): string {
  return `
    <div class="progression-view">
      <div class="progression-header">
        <h2 class="progression-title">⚡ Sistema de Progresión</h2>
      </div>

      <!-- Nivel y XP -->
      <div class="level-section">
        <div class="level-card">
          <div class="level-icon">⚡</div>
          <div class="level-info">
            <span class="level-number" id="current-level">1</span>
            <span class="level-title" id="level-title">Recluta</span>
          </div>
          <div class="xp-bar-container">
            <div class="xp-bar" id="xp-bar">
              <div class="xp-fill" id="xp-fill"></div>
            </div>
            <span class="xp-text" id="xp-text">0 / 100 XP</span>
          </div>
          <div class="skill-points-display">
            <span class="skill-points-icon">🌟</span>
            <span class="skill-points-value" id="skill-points">0</span>
            <span class="skill-points-label">Puntos de Habilidad</span>
          </div>
        </div>
      </div>

      <!-- Daily Quests -->
      <div class="daily-quests-section">
        <h3 class="section-title">📋 Misiones Diarias</h3>
        <div class="quests-grid" id="daily-quests">
          <!-- Las misiones se generan dinámicamente -->
        </div>
        <div class="streak-display">
          <span class="streak-icon">🔥</span>
          <span class="streak-value" id="streak-count">0</span>
          <span class="streak-label">días consecutivos</span>
        </div>
      </div>

      <!-- Skill Tree -->
      <div class="skill-tree-section">
        <h3 class="section-title">🌳 Árbol de Habilidades</h3>
        <div class="skill-tree-grid" id="skill-tree">
          <!-- Las habilidades se generan dinámicamente -->
        </div>
      </div>

      <!-- Season Pass -->
      <div class="season-pass-section">
        <h3 class="section-title">🎪 Season Pass</h3>
        <div class="season-pass-info">
          <div class="season-level">
            <span class="season-level-label">Nivel Temporada:</span>
            <span class="season-level-value" id="season-level">1</span>
          </div>
          <div class="season-progress">
            <div class="season-progress-bar" id="season-progress-bar">
              <div class="season-progress-fill" id="season-progress-fill"></div>
            </div>
          </div>
          <button class="premium-btn" id="premium-btn">👑 Desbloquear Premium</button>
        </div>
        <div class="season-rewards" id="season-rewards">
          <!-- Las recompensas se generan dinámicamente -->
        </div>
      </div>
    </div>
  `;
}
