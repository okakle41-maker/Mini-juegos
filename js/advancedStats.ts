/**
 * Advanced Statistics System
 * Sistema de estadísticas avanzadas con análisis, gráficos y predicciones
 */

import safeStorage from './core/safeStorage.js';

interface CognitiveCategory {
  name: string;
  games: string[];
  description: string;
  color: string;
}

interface PerformanceMetrics {
  accuracy: number;
  speed: number;
  consistency: number;
  improvement: number;
}

interface GameAnalysis {
  gameId: string;
  totalPlays: number;
  averageScore: number;
  bestScore: number;
  averageTime: number;
  bestTime: number;
  accuracy: number;
  improvementRate: number;
  trend: 'improving' | 'stable' | 'declining';
  lastPlayed: number;
  category: string;
}

interface HeatmapData {
  hour: number;
  day: number;
  value: number;
}

interface WeaknessAnalysis {
  category: string;
  score: number;
  description: string;
  recommendations: string[];
}

interface StrengthAnalysis {
  category: string;
  score: number;
  description: string;
}

interface PredictionData {
  predictedLevel: number;
  timeToNextLevel: number;
  suggestedGames: string[];
  focusAreas: string[];
}

interface ComparisonData {
  globalAverage: GameAnalysis[];
  playerPercentile: number;
  rank: number;
  totalPlayers: number;
}

class AdvancedStatsSystem {
  private cognitiveCategories: CognitiveCategory[];
  private gameAnalyses: Map<string, GameAnalysis>;
  private heatmapData: HeatmapData[];
  private weeklyData: Map<number, number>;
  private monthlyData: Map<number, number>;
  private storageKey = 'advanced-stats';

  constructor() {
    this.cognitiveCategories = this.defineCognitiveCategories();
    this.gameAnalyses = new Map();
    this.heatmapData = [];
    this.weeklyData = new Map();
    this.monthlyData = new Map();
    
    this.loadData();
    this.initializeHeatmap();
  }

  private defineCognitiveCategories(): CognitiveCategory[] {
    return [
      {
        name: 'MEMORIA',
        games: ['termita', 'simon', 'sequence', 'memorygrid', 'neuralfragment', 'datarecallgrid'],
        description: 'Capacidad de retener y recordar información',
        color: '#8b5cf6'
      },
      {
        name: 'REFLEJOS',
        games: ['arrow', 'skillchecks', 'rapidlines', 'rhythmclick', 'progresstiming'],
        description: 'Tiempo de reacción y coordinación',
        color: '#f59e0b'
      },
      {
        name: 'LÓGICA',
        games: ['ringpuzzle', 'mechlock', 'pairs', 'typix', 'snippet-race'],
        description: 'Resolución de problemas y razonamiento',
        color: '#10b981'
      },
      {
        name: 'PERCEPCIÓN',
        games: ['holematch', 'colorcount', 'circle', 'multipoint', 'bouncebar'],
        description: 'Atención visual y discriminación',
        color: '#3b82f6'
      },
      {
        name: 'TIPEO',
        games: ['letters', 'typix', 'snippet-race'],
        description: 'Velocidad y precisión de escritura',
        color: '#ec4899'
      },
      {
        name: 'ANÁLISIS',
        games: ['bombdefusal', 'reactor', 'virusOverload'],
        description: 'Análisis bajo presión y toma de decisiones',
        color: '#ef4444'
      },
      {
        name: 'CIFRADO',
        games: ['hackingDevice'],
        description: 'Resolución de patrones y descifrado',
        color: '#6366f1'
      },
      {
        name: 'ESTRATEGIA',
        games: ['reactor', 'virusOverload'],
        description: 'Planificación y gestión de recursos',
        color: '#14b8a6'
      }
    ];
  }

  private loadData(): void {
    const data = safeStorage.getJSON<{
      gameAnalyses?: Array<[string, GameAnalysis]>;
      heatmapData?: Array<{ day: number; hour: number; value: number }>;
      weeklyData?: Array<[number, number]>;
      monthlyData?: Array<[number, number]>;
    }>(this.storageKey, {});

    this.gameAnalyses = new Map(data.gameAnalyses || []);
    this.heatmapData = data.heatmapData || [];
    this.weeklyData = new Map(data.weeklyData || []);
    this.monthlyData = new Map(data.monthlyData || []);
  }

  private saveData(): void {
    safeStorage.setJSON(this.storageKey, {
      gameAnalyses: [...this.gameAnalyses],
      heatmapData: this.heatmapData,
      weeklyData: [...this.weeklyData],
      monthlyData: [...this.monthlyData]
    });
  }

  private initializeHeatmap(): void {
    // Initialize heatmap with zeros for all hours and days
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const existing = this.heatmapData.find(d => d.day === day && d.hour === hour);
        if (!existing) {
          this.heatmapData.push({ day, hour, value: 0 });
        }
      }
    }
  }

  // Record game performance
  recordGamePerformance(gameId: string, score: number, duration: number, accuracy: number = 100): void {
    const now = Date.now();
    let analysis = this.gameAnalyses.get(gameId);

    if (!analysis) {
      const category = this.getGameCategory(gameId);
      analysis = {
        gameId,
        totalPlays: 0,
        averageScore: 0,
        bestScore: 0,
        averageTime: 0,
        bestTime: Infinity,
        accuracy: 0,
        improvementRate: 0,
        trend: 'stable',
        lastPlayed: now,
        category
      };
      this.gameAnalyses.set(gameId, analysis);
    }

    // Update metrics
    analysis.totalPlays++;
    analysis.averageScore = ((analysis.averageScore * (analysis.totalPlays - 1)) + score) / analysis.totalPlays;
    analysis.bestScore = Math.max(analysis.bestScore, score);
    analysis.averageTime = ((analysis.averageTime * (analysis.totalPlays - 1)) + duration) / analysis.totalPlays;
    analysis.bestTime = Math.min(analysis.bestTime, duration);
    analysis.accuracy = ((analysis.accuracy * (analysis.totalPlays - 1)) + accuracy) / analysis.totalPlays;
    analysis.lastPlayed = now;

    // Calculate trend
    analysis.trend = this.calculateTrend(gameId);
    analysis.improvementRate = this.calculateImprovementRate(gameId);

    // Update heatmap
    this.updateHeatmap();
    
    // Update time-based data
    this.updateTimeBasedData(duration);

    this.saveData();
  }

  private getGameCategory(gameId: string): string {
    for (const category of this.cognitiveCategories) {
      if (category.games.includes(gameId)) {
        return category.name;
      }
    }
    return 'GENERAL';
  }

  private calculateTrend(gameId: string): 'improving' | 'stable' | 'declining' {
    const analysis = this.gameAnalyses.get(gameId);
    if (!analysis || analysis.totalPlays < 5) return 'stable';

    // Simple trend calculation based on recent vs overall average.
    // `analysis.totalPlays` ya filtra el caso < 5 arriba; esto no
    // calcula tendencia real (necesitaría historial de scores por
    // partida, que no se guarda hoy) — usa improvementRate como proxy.
    return analysis.improvementRate > 5 ? 'improving' : analysis.improvementRate < -5 ? 'declining' : 'stable';
  }

  private calculateImprovementRate(gameId: string): number {
    const analysis = this.gameAnalyses.get(gameId);
    if (!analysis || analysis.totalPlays < 2) return 0;

    // Si bestScore es 0 (todas las partidas dieron score 0), no hay una
    // "mejora" significativa que medir — se devuelve 0 en vez de NaN
    // (0/0), siguiendo la misma convención que calculateConsistency()
    // para su propio caso degenerado (mean === 0).
    if (analysis.bestScore === 0) return 0;

    // Calculate improvement based on score progression
    // This is a simplified version - real implementation would track historical scores
    return (analysis.averageScore / analysis.bestScore) * 100 - 50;
  }

  private updateHeatmap(): void {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    const entry = this.heatmapData.find(d => d.day === day && d.hour === hour);
    if (entry) {
      entry.value++;
    }
  }

  private updateTimeBasedData(duration: number): void {
    const now = Date.now();
    const weekKey = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
    const monthKey = Math.floor(now / (30 * 24 * 60 * 60 * 1000));

    this.weeklyData.set(weekKey, (this.weeklyData.get(weekKey) || 0) + duration);
    this.monthlyData.set(monthKey, (this.monthlyData.get(monthKey) || 0) + duration);
  }

  // Analysis methods
  getGameAnalysis(gameId: string): GameAnalysis | undefined {
    return this.gameAnalyses.get(gameId);
  }

  getAllGameAnalyses(): GameAnalysis[] {
    return [...this.gameAnalyses.values()];
  }

  getCategoryAnalysis(categoryName: string): {
    totalPlays: number;
    averageScore: number;
    averageAccuracy: number;
    averageTime: number;
    games: GameAnalysis[];
  } {
    const category = this.cognitiveCategories.find(c => c.name === categoryName);
    if (!category) {
      return { totalPlays: 0, averageScore: 0, averageAccuracy: 0, averageTime: 0, games: [] };
    }

    const games = category.games
      .map(gameId => this.gameAnalyses.get(gameId))
      .filter((g): g is GameAnalysis => g !== undefined);

    if (games.length === 0) {
      return { totalPlays: 0, averageScore: 0, averageAccuracy: 0, averageTime: 0, games: [] };
    }

    const totalPlays = games.reduce((sum, g) => sum + g.totalPlays, 0);
    const averageScore = games.reduce((sum, g) => sum + g.averageScore, 0) / games.length;
    const averageAccuracy = games.reduce((sum, g) => sum + g.accuracy, 0) / games.length;
    const averageTime = games.reduce((sum, g) => sum + g.averageTime, 0) / games.length;

    return { totalPlays, averageScore, averageAccuracy, averageTime, games };
  }

  getWeaknessAnalysis(): WeaknessAnalysis[] {
    const analyses: WeaknessAnalysis[] = [];

    for (const category of this.cognitiveCategories) {
      const analysis = this.getCategoryAnalysis(category.name);
      
      if (analysis.totalPlays === 0) {
        analyses.push({
          category: category.name,
          score: 0,
          description: 'No has jugado juegos de esta categoría',
          recommendations: [`Prueba ${category.games[0]} para empezar`]
        });
        continue;
      }

      const score = (analysis.averageScore * 0.4) + (analysis.averageAccuracy * 0.3) + (100 - (analysis.averageTime / 1000) * 30);

      let description: string;
      let recommendations: string[];

      if (score < 30) {
        description = 'Área de mejora significativa';
        recommendations = [
          'Practica regularmente juegos de esta categoría',
          'Empieza con niveles más fáciles',
          'Revisa las instrucciones antes de jugar'
        ];
      } else if (score < 60) {
        description = 'Espacio para mejorar';
        recommendations = [
          'Aumenta la frecuencia de práctica',
          'Intenta superar tus récords personales',
          'Varía los juegos de la categoría'
        ];
      } else {
        description = 'Buen rendimiento';
        recommendations = [
          'Mantén la práctica regular',
          'Desafíate con dificultades mayores',
          'Enseña a otros tus técnicas'
        ];
      }

      analyses.push({
        category: category.name,
        score,
        description,
        recommendations
      });
    }

    return analyses.sort((a, b) => a.score - b.score);
  }

  getStrengthAnalysis(): StrengthAnalysis[] {
    const analyses: StrengthAnalysis[] = [];

    for (const category of this.cognitiveCategories) {
      const analysis = this.getCategoryAnalysis(category.name);
      
      if (analysis.totalPlays === 0) continue;

      const score = (analysis.averageScore * 0.4) + (analysis.averageAccuracy * 0.3) + (100 - (analysis.averageTime / 1000) * 30);
      
      if (score >= 60) {
        analyses.push({
          category: category.name,
          score,
          description: 'Fortaleza destacada'
        });
      }
    }

    return analyses.sort((a, b) => b.score - a.score);
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const allAnalyses = [...this.gameAnalyses.values()];
    if (allAnalyses.length === 0) {
      return { accuracy: 0, speed: 0, consistency: 0, improvement: 0 };
    }

    const accuracy = allAnalyses.reduce((sum, a) => sum + a.accuracy, 0) / allAnalyses.length;
    const speed = 100 - (allAnalyses.reduce((sum, a) => sum + a.averageTime, 0) / allAnalyses.length / 1000 * 50);
    const consistency = this.calculateConsistency(allAnalyses);
    const improvement = allAnalyses.reduce((sum, a) => sum + a.improvementRate, 0) / allAnalyses.length;

    return {
      accuracy: Math.max(0, Math.min(100, accuracy)),
      speed: Math.max(0, Math.min(100, speed)),
      consistency: Math.max(0, Math.min(100, consistency)),
      improvement: Math.max(0, Math.min(100, improvement))
    };
  }

  private calculateConsistency(analyses: GameAnalysis[]): number {
    if (analyses.length === 0) return 0;

    const variance = analyses.reduce((sum, a) => {
      const mean = analyses.reduce((s, an) => s + an.averageScore, 0) / analyses.length;
      return sum + Math.pow(a.averageScore - mean, 2);
    }, 0) / analyses.length;

    const stdDev = Math.sqrt(variance);
    const mean = analyses.reduce((sum, a) => sum + a.averageScore, 0) / analyses.length;

    if (mean === 0) return 0;
    return Math.max(0, Math.min(100, 100 - (stdDev / mean) * 100));
  }

  getHeatmapData(): HeatmapData[] {
    return this.heatmapData;
  }

  getWeeklyPlaytime(): number[] {
    const data: number[] = [];
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    for (let i = 6; i >= 0; i--) {
      const weekKey = Math.floor((now - (i * weekMs)) / weekMs);
      data.push(this.weeklyData.get(weekKey) || 0);
    }

    return data;
  }

  getMonthlyPlaytime(): number[] {
    const data: number[] = [];
    const now = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1000;

    for (let i = 5; i >= 0; i--) {
      const monthKey = Math.floor((now - (i * monthMs)) / monthMs);
      data.push(this.monthlyData.get(monthKey) || 0);
    }

    return data;
  }

  getPredictionData(): PredictionData {
    const metrics = this.getPerformanceMetrics();
    const weakness = this.getWeaknessAnalysis();
    // Nota: getStrengthAnalysis() existe y se calculaba acá, pero
    // PredictionData no tiene ningún campo para "fortalezas" (solo
    // focusAreas, que son debilidades) — se quita la variable sin usar
    // en vez de agregar un campo nuevo al tipo público como efecto
    // colateral de una limpieza de lint.

    // Predict next level based on current performance
    const predictedLevel = Math.floor(metrics.accuracy * 0.3 + metrics.speed * 0.3 + metrics.consistency * 0.2 + metrics.improvement * 0.2) / 10;
    
    // Suggest games based on weaknesses
    const suggestedGames = weakness.slice(0, 3).map(w => {
      const category = this.cognitiveCategories.find(c => c.name === w.category);
      return category?.games[0] || '';
    }).filter(g => g !== '');

    // Focus areas are the weakest categories
    const focusAreas = weakness.slice(0, 2).map(w => w.category);

    // Estimate time to next level (simplified)
    const timeToNextLevel = Math.max(1, (100 - (metrics.accuracy + metrics.speed + metrics.consistency + metrics.improvement) / 4) * 3600);

    return {
      predictedLevel: Math.max(1, Math.min(100, predictedLevel)),
      timeToNextLevel,
      suggestedGames,
      focusAreas
    };
  }

  getComparisonData(): ComparisonData {
    // This would normally fetch from a backend
    // For now, return simulated data
    const playerAnalyses = [...this.gameAnalyses.values()];
    const globalAverage = playerAnalyses.map(a => ({
      ...a,
      averageScore: a.averageScore * 0.8, // Simulated global average
      averageTime: a.averageTime * 1.2
    }));

    const playerScore = playerAnalyses.reduce((sum, a) => sum + a.averageScore, 0) / (playerAnalyses.length || 1);
    const globalScore = globalAverage.reduce((sum, a) => sum + a.averageScore, 0) / (globalAverage.length || 1);
    
    const percentile = Math.min(100, Math.max(0, (playerScore / globalScore) * 50));
    const totalPlayers = 1000; // Simulated
    const rank = Math.floor((100 - percentile) / 100 * totalPlayers);

    return {
      globalAverage,
      playerPercentile: percentile,
      rank,
      totalPlayers
    };
  }

  getTopPerformingGames(limit: number = 5): GameAnalysis[] {
    return [...this.gameAnalyses.values()]
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, limit);
  }

  getMostPlayedGames(limit: number = 5): GameAnalysis[] {
    return [...this.gameAnalyses.values()]
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, limit);
  }

  getRecentActivity(limit: number = 10): GameAnalysis[] {
    return [...this.gameAnalyses.values()]
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, limit);
  }

  getCognitiveProfile(): {
    strengths: string[];
    weaknesses: string[];
    balanced: boolean;
    dominantCategory: string;
  } {
    const weakness = this.getWeaknessAnalysis();
    const strength = this.getStrengthAnalysis();

    const strengths = strength.filter(s => s.score >= 70).map(s => s.category);
    const weaknesses = weakness.filter(w => w.score <= 40).map(w => w.category);

    const dominantCategory = strength.length > 0 ? strength[0].category : 'Ninguna';
    const balanced = strengths.length >= 3 && weaknesses.length <= 2;

    return { strengths, weaknesses, balanced, dominantCategory };
  }

  exportStats(): string {
    return JSON.stringify({
      gameAnalyses: [...this.gameAnalyses],
      heatmapData: this.heatmapData,
      weeklyData: [...this.weeklyData],
      monthlyData: [...this.monthlyData],
      cognitiveProfile: this.getCognitiveProfile(),
      performanceMetrics: this.getPerformanceMetrics(),
      exportedAt: Date.now()
    }, null, 2);
  }

  importStats(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.gameAnalyses) {
        this.gameAnalyses = new Map(parsed.gameAnalyses);
      }
      if (parsed.heatmapData) {
        this.heatmapData = parsed.heatmapData;
      }
      if (parsed.weeklyData) {
        this.weeklyData = new Map(parsed.weeklyData);
      }
      if (parsed.monthlyData) {
        this.monthlyData = new Map(parsed.monthlyData);
      }
      this.saveData();
    } catch (e) {
      console.error('[AdvancedStats] Failed to import stats:', e);
      // `Error(message, { cause })` es ES2022; el `lib` del proyecto es
      // ES2020, así que se adjunta la causa como propiedad después de
      // construir el error en vez de cambiar el target del proyecto
      // solo por esto.
      const wrapped = new Error('Invalid stats data');
      (wrapped as Error & { cause?: unknown }).cause = e;
      throw wrapped;
    }
  }

  resetStats(): void {
    this.gameAnalyses.clear();
    this.heatmapData = [];
    this.weeklyData.clear();
    this.monthlyData.clear();
    this.initializeHeatmap();
    this.saveData();
  }
}

// Singleton instance
export const advancedStatsSystem = new AdvancedStatsSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.advancedStatsSystem = advancedStatsSystem;
}

export default advancedStatsSystem;
