/**
 * Player Statistics
 * Sistema de estadísticas detalladas del jugador
 */

import safeStorage from './core/safeStorage.js';

interface GameStats {
  gameId: string;
  gamesPlayed: number;
  gamesCompleted: number;
  highestScore: number;
  averageScore: number;
  totalTime: number;
  bestTime: number;
  lastPlayed: number;
}

interface OverallStats {
  totalGamesPlayed: number;
  totalGamesCompleted: number;
  totalPlayTime: number;
  favoriteGame: string;
  mostPlayedGame: string;
  currentStreak: number;
  longestStreak: number;
  achievementsUnlocked: number;
}

class PlayerStats {
  private gameStats: Map<string, GameStats>;
  private overallStats: OverallStats;
  private storageKey = 'player-stats';
  private overallKey = 'overall-stats';

  constructor() {
    this.gameStats = this.loadGameStats();
    this.overallStats = this.loadOverallStats();
  }

  private defaultOverallStats(): OverallStats {
    return {
      totalGamesPlayed: 0,
      totalGamesCompleted: 0,
      totalPlayTime: 0,
      favoriteGame: '',
      mostPlayedGame: '',
      currentStreak: 0,
      longestStreak: 0,
      achievementsUnlocked: 0
    };
  }

  private loadGameStats(): Map<string, GameStats> {
    const data = safeStorage.getJSON<Array<[string, GameStats]>>(
      this.storageKey,
      [],
      { validate: (value): value is Array<[string, GameStats]> => Array.isArray(value) }
    );
    return new Map(data);
  }

  private loadOverallStats(): OverallStats {
    return safeStorage.getJSON<OverallStats>(
      this.overallKey,
      this.defaultOverallStats(),
      {
        validate: (value): value is OverallStats =>
          typeof value === 'object' && value !== null && 'totalGamesPlayed' in value,
      }
    );
  }

  private saveGameStats(): void {
    safeStorage.setJSON(this.storageKey, [...this.gameStats]);
  }

  private saveOverallStats(): void {
    safeStorage.setJSON(this.overallKey, this.overallStats);
  }

  recordGamePlayed(gameId: string, duration: number): void {
    let stats = this.gameStats.get(gameId);
    
    if (!stats) {
      stats = {
        gameId,
        gamesPlayed: 0,
        gamesCompleted: 0,
        highestScore: 0,
        averageScore: 0,
        totalTime: 0,
        bestTime: Infinity,
        lastPlayed: 0
      };
      this.gameStats.set(gameId, stats);
    }

    stats.gamesPlayed++;
    stats.totalTime += duration;
    stats.lastPlayed = Date.now();

    if (duration < stats.bestTime) {
      stats.bestTime = duration;
    }

    // Update overall stats
    this.overallStats.totalGamesPlayed++;
    this.overallStats.totalPlayTime += duration;
    this.updateMostPlayedGame();

    this.saveGameStats();
    this.saveOverallStats();
  }

  // Nota: a diferencia de recordGamePlayed() (arriba), este método NO
  // actualiza stats.totalTime/bestTime con `duration` — podría ser
  // intencional (si siempre se llama junto con recordGamePlayed() para
  // el mismo evento, sumar acá duplicaría el tiempo) o un descuido.
  // Ninguno de los dos métodos tiene un consumidor real hoy en el
  // proyecto (no hay ningún call site en js/ ni test/), así que no hay
  // forma de confirmar cuál era la intención sin adivinar diseño de
  // producto — se deja documentado en vez de asumir.
  recordGameCompleted(gameId: string, score: number, _duration: number): void {
    let stats = this.gameStats.get(gameId);
    
    if (!stats) {
      stats = {
        gameId,
        gamesPlayed: 0,
        gamesCompleted: 0,
        highestScore: 0,
        averageScore: 0,
        totalTime: 0,
        bestTime: Infinity,
        lastPlayed: 0
      };
      this.gameStats.set(gameId, stats);
    }

    stats.gamesCompleted++;
    
    if (score > stats.highestScore) {
      stats.highestScore = score;
    }

    // Calculate average score
    stats.averageScore = ((stats.averageScore * (stats.gamesCompleted - 1)) + score) / stats.gamesCompleted;

    // Update overall stats
    this.overallStats.totalGamesCompleted++;
    this.updateFavoriteGame();

    this.saveGameStats();
    this.saveOverallStats();
  }

  private updateMostPlayedGame(): void {
    let maxPlays = 0;
    let mostPlayed = '';

    this.gameStats.forEach((stats, gameId) => {
      if (stats.gamesPlayed > maxPlays) {
        maxPlays = stats.gamesPlayed;
        mostPlayed = gameId;
      }
    });

    this.overallStats.mostPlayedGame = mostPlayed;
  }

  private updateFavoriteGame(): void {
    // Nota: recalcula el favorito completo desde gameStats en cada
    // llamada (misma estrategia que updateMostPlayedGame() arriba) —
    // el gameId de la partida recién completada no cambia el
    // resultado, así que no hace falta recibirlo como parámetro.
    // Simple heuristic: favorite game is the one with highest completion rate
    let bestCompletionRate = 0;
    let favorite = '';

    this.gameStats.forEach((stats, id) => {
      if (stats.gamesPlayed > 0) {
        const completionRate = stats.gamesCompleted / stats.gamesPlayed;
        if (completionRate > bestCompletionRate) {
          bestCompletionRate = completionRate;
          favorite = id;
        }
      }
    });

    this.overallStats.favoriteGame = favorite;
  }

  getGameStats(gameId: string): GameStats | undefined {
    return this.gameStats.get(gameId);
  }

  getAllGameStats(): GameStats[] {
    return [...this.gameStats.values()];
  }

  getOverallStats(): OverallStats {
    return { ...this.overallStats };
  }

  getTopGames(limit: number = 5, sortBy: 'score' | 'played' | 'completed' = 'score'): GameStats[] {
    const stats = [...this.gameStats.values()];

    switch (sortBy) {
      case 'score':
        return stats.sort((a, b) => b.highestScore - a.highestScore).slice(0, limit);
      case 'played':
        return stats.sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, limit);
      case 'completed':
        return stats.sort((a, b) => b.gamesCompleted - a.gamesCompleted).slice(0, limit);
    }
  }

  getRecentGames(limit: number = 10): GameStats[] {
    return [...this.gameStats.values()]
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, limit);
  }

  getPlaytimeStats(): {
    total: number;
    averagePerGame: number;
    averagePerDay: number;
    byGame: Map<string, number>;
  } {
    const total = this.overallStats.totalPlayTime;
    const totalGames = this.overallStats.totalGamesPlayed;
    const averagePerGame = totalGames > 0 ? total / totalGames : 0;
    
    // Calculate average per day (last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let recentPlaytime = 0;
    let recentGames = 0;

    this.gameStats.forEach(stats => {
      if (stats.lastPlayed > sevenDaysAgo) {
        recentPlaytime += stats.totalTime;
        recentGames += stats.gamesPlayed;
      }
    });

    const averagePerDay = recentGames > 0 ? recentPlaytime / 7 : 0;

    const byGame = new Map<string, number>();
    this.gameStats.forEach((stats, gameId) => {
      byGame.set(gameId, stats.totalTime);
    });

    return {
      total,
      averagePerGame,
      averagePerDay,
      byGame
    };
  }

  getCompletionRate(): {
    overall: number;
    byGame: Map<string, number>;
  } {
    const totalPlayed = this.overallStats.totalGamesPlayed;
    const totalCompleted = this.overallStats.totalGamesCompleted;
    const overall = totalPlayed > 0 ? (totalCompleted / totalPlayed) * 100 : 0;

    const byGame = new Map<string, number>();
    this.gameStats.forEach((stats, gameId) => {
      const rate = stats.gamesPlayed > 0 ? (stats.gamesCompleted / stats.gamesPlayed) * 100 : 0;
      byGame.set(gameId, rate);
    });

    return {
      overall,
      byGame
    };
  }

  updateStreak(currentStreak: number): void {
    this.overallStats.currentStreak = currentStreak;
    if (currentStreak > this.overallStats.longestStreak) {
      this.overallStats.longestStreak = currentStreak;
    }
    this.saveOverallStats();
  }

  updateAchievementsCount(count: number): void {
    this.overallStats.achievementsUnlocked = count;
    this.saveOverallStats();
  }

  resetStats(): void {
    this.gameStats.clear();
    this.overallStats = {
      totalGamesPlayed: 0,
      totalGamesCompleted: 0,
      totalPlayTime: 0,
      favoriteGame: '',
      mostPlayedGame: '',
      currentStreak: 0,
      longestStreak: 0,
      achievementsUnlocked: 0
    };
    this.saveGameStats();
    this.saveOverallStats();
  }

  exportStats(): string {
    return JSON.stringify({
      gameStats: [...this.gameStats],
      overallStats: this.overallStats,
      exportedAt: Date.now()
    });
  }

  importStats(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.gameStats && parsed.overallStats) {
        this.gameStats = new Map(parsed.gameStats);
        this.overallStats = parsed.overallStats;
        this.saveGameStats();
        this.saveOverallStats();
      }
    } catch (e) {
      console.error('[PlayerStats] Failed to import stats:', e);
      // Ver el comentario equivalente en advancedStats.ts: se adjunta
      // la causa como propiedad en vez de usar `Error(msg, { cause })`
      // (ES2022) porque el `lib`/target del proyecto es ES2020.
      const wrapped = new Error('Invalid stats data');
      (wrapped as Error & { cause?: unknown }).cause = e;
      throw wrapped;
    }
  }
}

// Singleton instance
export const playerStats = new PlayerStats();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.playerStats = playerStats;
}

export default playerStats;
