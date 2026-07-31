/**
 * Player Statistics
 * Sistema de estadísticas detalladas del jugador
 */

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

  private loadGameStats(): Map<string, GameStats> {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        return new Map(data);
      } catch (e) {
        console.error('[PlayerStats] Failed to load game stats:', e);
      }
    }
    return new Map();
  }

  private loadOverallStats(): OverallStats {
    const saved = localStorage.getItem(this.overallKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[PlayerStats] Failed to load overall stats:', e);
      }
    }

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

  private saveGameStats(): void {
    localStorage.setItem(this.storageKey, JSON.stringify([...this.gameStats]));
  }

  private saveOverallStats(): void {
    localStorage.setItem(this.overallKey, JSON.stringify(this.overallStats));
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

  recordGameCompleted(gameId: string, score: number, duration: number): void {
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
    this.updateFavoriteGame(gameId);

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

  private updateFavoriteGame(gameId: string): void {
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
      throw new Error('Invalid stats data');
    }
  }
}

// Singleton instance
export const playerStats = new PlayerStats();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).playerStats = playerStats;
}

export default playerStats;
