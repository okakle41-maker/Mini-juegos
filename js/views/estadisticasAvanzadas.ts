/**
 * Estadísticas Avanzadas View Template
 * Vista para el sistema de estadísticas avanzadas
 */
import type { ViewTemplate } from '../types/game';

export function template(): string {
  return `
    <div class="advanced-stats-view">
      <div class="stats-header">
        <button class="back-btn" data-back-to="home"></button>
        <h2 class="stats-title">📊 Estadísticas Avanzadas</h2>
      </div>

      <!-- Performance Metrics -->
      <div class="metrics-section">
        <h3 class="section-title">🎯 Métricas de Rendimiento</h3>
        <div class="section-decorative">
          <span>📊</span><span>📈</span><span>🎯</span>
        </div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">🎯</div>
            <div class="metric-info">
              <span class="metric-value" id="metric-accuracy">0%</span>
              <span class="metric-label">Precisión</span>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" id="metric-accuracy-bar"></div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">⚡</div>
            <div class="metric-info">
              <span class="metric-value" id="metric-speed">0%</span>
              <span class="metric-label">Velocidad</span>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" id="metric-speed-bar"></div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📈</div>
            <div class="metric-info">
              <span class="metric-value" id="metric-consistency">0%</span>
              <span class="metric-label">Consistencia</span>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" id="metric-consistency-bar"></div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📊</div>
            <div class="metric-info">
              <span class="metric-value" id="metric-improvement">0%</span>
              <span class="metric-label">Mejora</span>
            </div>
            <div class="metric-bar">
              <div class="metric-fill" id="metric-improvement-bar"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cognitive Profile -->
      <div class="cognitive-profile-section">
        <h3 class="section-title">🧠 Perfil Cognitivo</h3>
        <div class="section-decorative">
          <span>🧠</span><span>💡</span><span>🔮</span>
        </div>
        <div class="profile-summary" id="cognitive-profile">
          <!-- El perfil cognitivo se genera dinámicamente -->
        </div>
        <div class="categories-grid" id="categories-grid">
          <!-- Las categorías cognitivas se generan dinámicamente -->
        </div>
      </div>

      <!-- Weakness Analysis -->
      <div class="weakness-section">
        <h3 class="section-title">📉 Áreas de Mejora</h3>
        <div class="section-decorative">
          <span>📉</span><span>🎯</span><span>💪</span>
        </div>
        <div class="weakness-list" id="weakness-list">
          <!-- Las debilidades se generan dinámicamente -->
        </div>
      </div>

      <!-- Strength Analysis -->
      <div class="strength-section">
        <h3 class="section-title">📈 Fortalezas</h3>
        <div class="section-decorative">
          <span>📈</span><span>⭐</span><span>🏆</span>
        </div>
        <div class="strength-list" id="strength-list">
          <!-- Las fortalezas se generan dinámicamente -->
        </div>
      </div>

      <!-- Activity Heatmap -->
      <div class="heatmap-section">
        <h3 class="section-title">📅 Mapa de Actividad</h3>
        <div class="section-decorative">
          <span>📅</span><span>🔥</span><span>⏰</span>
        </div>
        <div class="heatmap-container" id="activity-heatmap">
          <!-- El heatmap se genera dinámicamente -->
        </div>
        <div class="heatmap-legend">
          <span class="legend-item">Menos</span>
          <div class="legend-gradient"></div>
          <span class="legend-item">Más</span>
        </div>
      </div>

      <!-- Playtime Charts -->
      <div class="playtime-section">
        <h3 class="section-title">⏱️ Tiempo de Juego</h3>
        <div class="section-decorative">
          <span>⏱️</span><span>⏰</span><span>📊</span>
        </div>
        <div class="playtime-charts">
          <div class="chart-container">
            <h4 class="chart-title">Última Semana</h4>
            <div class="chart" id="weekly-chart">
              <!-- El gráfico semanal se genera dinámicamente -->
            </div>
          </div>
          <div class="chart-container">
            <h4 class="chart-title">Últimos Meses</h4>
            <div class="chart" id="monthly-chart">
              <!-- El gráfico mensual se genera dinámicamente -->
            </div>
          </div>
        </div>
      </div>

      <!-- Predictions -->
      <div class="predictions-section">
        <h3 class="section-title">🔮 Predicciones</h3>
        <div class="section-decorative">
          <span>🔮</span><span>🎯</span><span>🚀</span>
        </div>
        <div class="predictions-card" id="predictions-card">
          <!-- Las predicciones se generan dinámicamente -->
        </div>
      </div>

      <!-- Export/Import -->
      <div class="data-section">
        <h3 class="section-title">💾 Datos</h3>
        <div class="data-actions">
          <button class="data-btn" id="export-stats">📤 Exportar Estadísticas</button>
          <button class="data-btn" id="import-stats">📥 Importar Estadísticas</button>
          <button class="data-btn danger" id="reset-stats">🗑️ Resetear Datos</button>
        </div>
      </div>
    </div>
  `;
}

export default template satisfies ViewTemplate;
