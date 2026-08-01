/**
 * Estadísticas Avanzadas View Logic
 * Lógica para la vista de estadísticas avanzadas
 */

import { advancedStatsSystem } from '../advancedStats.js';
import { template } from './estadisticasAvanzadas.js';

let cachedElements: Record<string, HTMLElement | null> = {};

function getElement(id: string): HTMLElement | null {
  if (!cachedElements[id]) {
    cachedElements[id] = document.getElementById(id);
  }
  return cachedElements[id];
}

function clearCache(): void {
  cachedElements = {};
}

export function init(): void {
  const container = document.getElementById('estadisticas-avanzadas');
  if (!container) return;

  container.innerHTML = template();
  renderMetrics();
  renderCognitiveProfile();
  renderWeaknessAnalysis();
  renderStrengthAnalysis();
  renderHeatmap();
  renderPlaytimeCharts();
  renderPredictions();
  setupEventListeners();
}

function renderMetrics(): void {
  const metrics = advancedStatsSystem.getPerformanceMetrics();
  
  document.getElementById('metric-accuracy')!.textContent = `${Math.round(metrics.accuracy)}%`;
  document.getElementById('metric-speed')!.textContent = `${Math.round(metrics.speed)}%`;
  document.getElementById('metric-consistency')!.textContent = `${Math.round(metrics.consistency)}%`;
  document.getElementById('metric-improvement')!.textContent = `${Math.round(metrics.improvement)}%`;
  
  document.getElementById('metric-accuracy-bar')!.style.width = `${metrics.accuracy}%`;
  document.getElementById('metric-speed-bar')!.style.width = `${metrics.speed}%`;
  document.getElementById('metric-consistency-bar')!.style.width = `${metrics.consistency}%`;
  document.getElementById('metric-improvement-bar')!.style.width = `${metrics.improvement}%`;
}

function renderCognitiveProfile(): void {
  const profile = advancedStatsSystem.getCognitiveProfile();
  const summary = document.getElementById('cognitive-profile');
  
  if (summary) {
    summary.innerHTML = `
      <div class="profile-summary-card">
        <h4 class="profile-summary-title">Perfil Cognitivo</h4>
        <div class="profile-summary-content">
          <div class="profile-item">
            <span class="profile-label">Categoría Dominante:</span>
            <span class="profile-value">${profile.dominantCategory}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Balance:</span>
            <span class="profile-value ${profile.balanced ? 'profile-value--good' : 'profile-value--warning'}">
              ${profile.balanced ? 'Equilibrado' : 'Desbalanceado'}
            </span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Fortalezas:</span>
            <span class="profile-value">${profile.strengths.length}</span>
          </div>
          <div class="profile-item">
            <span class="profile-label">Áreas de Mejora:</span>
            <span class="profile-value">${profile.weaknesses.length}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Renderizar categorías
  const categoriesGrid = document.getElementById('categories-grid');
  if (categoriesGrid) {
    const categories = ['MEMORIA', 'REFLEJOS', 'LÓGICA', 'PERCEPCIÓN', 'TIPEO', 'ANÁLISIS', 'CIFRADO', 'ESTRATEGIA'];
    categoriesGrid.innerHTML = categories.map(cat => {
      const analysis = advancedStatsSystem.getCategoryAnalysis(cat);
      const score = analysis.totalPlays > 0 ? Math.round((analysis.averageScore * 0.4) + (analysis.averageAccuracy * 0.3) + (100 - (analysis.averageTime / 1000) * 30)) : 0;
      
      return `
        <div class="category-card">
          <h4 class="category-name">${cat}</h4>
          <div class="category-stats">
            <span class="category-stat">Partidas: ${analysis.totalPlays}</span>
            <span class="category-stat">Promedio: ${Math.round(analysis.averageScore)}</span>
          </div>
          <div class="category-bar">
            <div class="category-fill" style="width: ${score}%"></div>
          </div>
          <span class="category-score">${score}%</span>
        </div>
      `;
    }).join('');
  }
}

function renderWeaknessAnalysis(): void {
  const weaknesses = advancedStatsSystem.getWeaknessAnalysis();
  const list = document.getElementById('weakness-list');
  
  if (list) {
    list.innerHTML = weaknesses.slice(0, 3).map(weakness => `
      <div class="weakness-card">
        <div class="weakness-header">
          <h4 class="weakness-category">${weakness.category}</h4>
          <span class="weakness-score">${Math.round(weakness.score)}%</span>
        </div>
        <p class="weakness-description">${weakness.description}</p>
        <div class="weakness-recommendations">
          <h5 class="recommendations-title">Recomendaciones:</h5>
          <ul class="recommendations-list">
            ${weakness.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>
    `).join('');
  }
}

function renderStrengthAnalysis(): void {
  const strengths = advancedStatsSystem.getStrengthAnalysis();
  const list = document.getElementById('strength-list');
  
  if (list) {
    list.innerHTML = strengths.slice(0, 3).map(strength => `
      <div class="strength-card">
        <div class="strength-header">
          <h4 class="strength-category">${strength.category}</h4>
          <span class="strength-score">${Math.round(strength.score)}%</span>
        </div>
        <p class="strength-description">${strength.description}</p>
      </div>
    `).join('');
  }
}

function renderHeatmap(): void {
  const heatmapData = advancedStatsSystem.getHeatmapData();
  const heatmapContainer = document.getElementById('activity-heatmap');
  
  if (heatmapContainer) {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const maxActivity = Math.max(...heatmapData.map(d => d.value), 1);
    
    let html = '<div class="heatmap-grid">';
    
    // Header con días
    html += '<div class="heatmap-header"></div>';
    days.forEach(day => {
      html += `<div class="heatmap-day-label">${day}</div>`;
    });
    
    // Horas y datos
    for (let hour = 0; hour < 24; hour++) {
      html += `<div class="heatmap-hour-label">${hour}:00</div>`;
      for (let day = 0; day < 7; day++) {
        const data = heatmapData.find(d => d.hour === hour && d.day === day);
        const value = data ? data.value : 0;
        const intensity = value / maxActivity;
        
        html += `<div class="heatmap-cell heatmap-cell--${getHeatmapIntensity(intensity)}"></div>`;
      }
    }
    
    html += '</div>';
    heatmapContainer.innerHTML = html;
  }
}

function getHeatmapIntensity(intensity: number): string {
  if (intensity === 0) return 'empty';
  if (intensity < 0.25) return 'low';
  if (intensity < 0.5) return 'medium';
  if (intensity < 0.75) return 'high';
  return 'very-high';
}

function renderPlaytimeCharts(): void {
  const weeklyData = advancedStatsSystem.getWeeklyPlaytime();
  const monthlyData = advancedStatsSystem.getMonthlyPlaytime();
  
  const weeklyChart = document.getElementById('weekly-chart');
  if (weeklyChart) {
    const maxWeekly = Math.max(...weeklyData, 1);
    weeklyChart.innerHTML = weeklyData.map((value, index) => {
      const height = (value / maxWeekly) * 100;
      const days = ['Hace 6 días', 'Hace 5 días', 'Hace 4 días', 'Hace 3 días', 'Hace 2 días', 'Ayer', 'Hoy'];
      return `
        <div class="chart-bar-container">
          <div class="chart-bar" style="height: ${height}%"></div>
          <span class="chart-label">${days[index]}</span>
          <span class="chart-value">${Math.round(value / 60)}m</span>
        </div>
      `;
    }).join('');
  }
  
  const monthlyChart = document.getElementById('monthly-chart');
  if (monthlyChart) {
    const maxMonthly = Math.max(...monthlyData, 1);
    monthlyChart.innerHTML = monthlyData.map((value, index) => {
      const height = (value / maxMonthly) * 100;
      const months = ['Hace 5 meses', 'Hace 4 meses', 'Hace 3 meses', 'Hace 2 meses', 'El mes pasado', 'Este mes'];
      return `
        <div class="chart-bar-container">
          <div class="chart-bar" style="height: ${height}%"></div>
          <span class="chart-label">${months[index]}</span>
          <span class="chart-value">${Math.round(value / 3600)}h</span>
        </div>
      `;
    }).join('');
  }
}

function renderPredictions(): void {
  const predictions = advancedStatsSystem.getPredictionData();
  const card = document.getElementById('predictions-card');
  
  if (card) {
    card.innerHTML = `
      <div class="predictions-content">
        <div class="prediction-item">
          <span class="prediction-label">Nivel Predicho:</span>
          <span class="prediction-value">${predictions.predictedLevel}</span>
        </div>
        <div class="prediction-item">
          <span class="prediction-label">Tiempo al siguiente nivel:</span>
          <span class="prediction-value">${Math.round(predictions.timeToNextLevel / 60)} minutos</span>
        </div>
        <div class="prediction-item">
          <span class="prediction-label">Juegos sugeridos:</span>
          <div class="prediction-games">
            ${predictions.suggestedGames.map(game => `<span class="prediction-game">${game}</span>`).join('')}
          </div>
        </div>
        <div class="prediction-item">
          <span class="prediction-label">Áreas de enfoque:</span>
          <div class="prediction-focus">
            ${predictions.focusAreas.map(area => `<span class="prediction-focus-item">${area}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

function setupEventListeners(): void {
  document.getElementById('export-stats')?.addEventListener('click', () => {
    const stats = advancedStatsSystem.exportStats();
    const blob = new Blob([stats], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'estadisticas.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import-stats')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            advancedStatsSystem.importStats(e.target?.result as string);
            alert('Estadísticas importadas exitosamente');
            renderMetrics();
            renderCognitiveProfile();
          } catch (err) {
            alert('Error al importar estadísticas');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  });

  document.getElementById('reset-stats')?.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres resetear todas las estadísticas?')) {
      advancedStatsSystem.resetStats();
      renderMetrics();
      renderCognitiveProfile();
      renderWeaknessAnalysis();
      renderStrengthAnalysis();
      renderHeatmap();
      renderPlaytimeCharts();
      renderPredictions();
    }
  });
}

export function stop(): void {
  // Limpiar caché de elementos
  clearCache();
  
  // Limpiar contenido del contenedor
  const container = document.getElementById('estadisticas-avanzadas');
  if (container) {
    container.innerHTML = '';
  }
}
