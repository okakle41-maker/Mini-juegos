import { beforeEach, describe, expect, it, vi } from 'vitest';

// AdvancedStatsSystem se exporta como singleton y su constructor llama
// a loadData() (lee localStorage) e initializeHeatmap() (rellena 7×24
// entradas en 0). Cada test necesita un módulo fresco vía
// vi.resetModules() + re-import dinámico — mismo patrón que el resto
// de tests de sistemas singleton en este proyecto — para partir de un
// estado limpio y controlar localStorage antes de que el constructor
// corra.

async function freshStats(): Promise<typeof import('../js/advancedStats').default> {
  vi.resetModules();
  (localStorage.getItem as any).mockReturnValue(null);
  return (await import('../js/advancedStats')).default;
}

describe('AdvancedStats — recordGamePerformance (promedios incrementales)', () => {
  it('crea un análisis nuevo la primera vez que se juega un gameId', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 5000, 90);

    const analysis = stats.getGameAnalysis('termita');
    expect(analysis).toBeDefined();
    expect(analysis?.totalPlays).toBe(1);
    expect(analysis?.averageScore).toBe(100);
    expect(analysis?.bestScore).toBe(100);
    expect(analysis?.averageTime).toBe(5000);
    expect(analysis?.bestTime).toBe(5000);
    expect(analysis?.accuracy).toBe(90);
  });

  it('accuracy por defecto es 100 si no se pasa', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 50, 1000);

    expect(stats.getGameAnalysis('termita')?.accuracy).toBe(100);
  });

  it('promedia correctamente el score entre múltiples partidas', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000, 100);
    stats.recordGamePerformance('termita', 200, 1000, 100);

    const analysis = stats.getGameAnalysis('termita');
    expect(analysis?.totalPlays).toBe(2);
    expect(analysis?.averageScore).toBe(150); // (100+200)/2
  });

  it('bestScore toma el máximo entre todas las partidas, no la última', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 500, 1000);
    stats.recordGamePerformance('termita', 100, 1000); // baja, no debe pisar el mejor

    expect(stats.getGameAnalysis('termita')?.bestScore).toBe(500);
  });

  it('bestTime toma el mínimo (más rápido) entre todas las partidas', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 5000);
    stats.recordGamePerformance('termita', 100, 2000); // más rápido, debe pisar el mejor
    stats.recordGamePerformance('termita', 100, 8000); // más lento, no debe pisar

    expect(stats.getGameAnalysis('termita')?.bestTime).toBe(2000);
  });

  it('asigna la categoría cognitiva correcta según el gameId', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000); // termita está en MEMORIA

    expect(stats.getGameAnalysis('termita')?.category).toBe('MEMORIA');
  });

  it('asigna categoría GENERAL para un gameId que no está en ninguna categoría', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('juego_desconocido', 100, 1000);

    expect(stats.getGameAnalysis('juego_desconocido')?.category).toBe('GENERAL');
  });

  it('lastPlayed se actualiza en cada partida registrada', async () => {
    const stats = await freshStats();
    const before = Date.now();
    stats.recordGamePerformance('termita', 100, 1000);
    const after = Date.now();

    const lastPlayed = stats.getGameAnalysis('termita')?.lastPlayed ?? 0;
    expect(lastPlayed).toBeGreaterThanOrEqual(before);
    expect(lastPlayed).toBeLessThanOrEqual(after);
  });

  it('persiste los datos en localStorage tras cada registro', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'advanced-stats',
      expect.stringContaining('termita')
    );
  });
});

describe('AdvancedStats — trend e improvementRate', () => {
  it('con menos de 5 partidas, trend siempre es "stable"', async () => {
    const stats = await freshStats();
    for (let i = 0; i < 4; i++) {
      stats.recordGamePerformance('termita', 100 + i * 50, 1000);
    }
    expect(stats.getGameAnalysis('termita')?.trend).toBe('stable');
  });

  it('con menos de 2 partidas, improvementRate es siempre 0', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000);
    expect(stats.getGameAnalysis('termita')?.improvementRate).toBe(0);
  });

  it('con todas las partidas en score 0 (bestScore 0), improvementRate es 0, no NaN', async () => {
    // Antes de la corrección, (averageScore / bestScore) * 100 - 50 con
    // bestScore === 0 daba NaN (0/0). Ahora calculateImprovementRate
    // devuelve 0 explícitamente en ese caso degenerado, misma
    // convención que ya usa calculateConsistency() para mean === 0.
    const stats = await freshStats();
    stats.recordGamePerformance('juego_dificil', 0, 1000);
    stats.recordGamePerformance('juego_dificil', 0, 1000);

    expect(stats.getGameAnalysis('juego_dificil')?.improvementRate).toBe(0);
  });
});

describe('AdvancedStats — getCategoryAnalysis', () => {
  it('devuelve ceros y games vacío para una categoría sin partidas jugadas', async () => {
    const stats = await freshStats();
    const analysis = stats.getCategoryAnalysis('MEMORIA');

    expect(analysis).toEqual({ totalPlays: 0, averageScore: 0, averageAccuracy: 0, averageTime: 0, games: [] });
  });

  it('devuelve ceros para un nombre de categoría que no existe', async () => {
    const stats = await freshStats();
    const analysis = stats.getCategoryAnalysis('CATEGORIA_INEXISTENTE');

    expect(analysis.totalPlays).toBe(0);
    expect(analysis.games).toEqual([]);
  });

  it('agrega correctamente varios juegos de la misma categoría', async () => {
    const stats = await freshStats();
    // termita y simon están ambos en MEMORIA
    stats.recordGamePerformance('termita', 100, 1000, 80);
    stats.recordGamePerformance('simon', 200, 3000, 100);

    const analysis = stats.getCategoryAnalysis('MEMORIA');
    expect(analysis.totalPlays).toBe(2);
    expect(analysis.averageScore).toBe(150); // (100+200)/2, promedio de promedios por juego
    expect(analysis.averageAccuracy).toBe(90); // (80+100)/2
    expect(analysis.games).toHaveLength(2);
  });

  it('no mezcla partidas de juegos de otra categoría', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000); // MEMORIA
    stats.recordGamePerformance('arrow', 999, 1000); // REFLEJOS

    const memoria = stats.getCategoryAnalysis('MEMORIA');
    expect(memoria.games.map((g) => g.gameId)).toEqual(['termita']);
  });
});

describe('AdvancedStats — getWeaknessAnalysis / getStrengthAnalysis', () => {
  it('una categoría sin partidas aparece en debilidades con score 0', async () => {
    const stats = await freshStats();
    const weaknesses = stats.getWeaknessAnalysis();

    const memoria = weaknesses.find((w) => w.category === 'MEMORIA');
    expect(memoria).toBeDefined();
    expect(memoria?.score).toBe(0);
    expect(memoria?.description).toBe('No has jugado juegos de esta categoría');
  });

  it('getWeaknessAnalysis devuelve una entrada por cada categoría cognitiva definida', async () => {
    const stats = await freshStats();
    const weaknesses = stats.getWeaknessAnalysis();
    // 8 categorías definidas en defineCognitiveCategories (MEMORIA,
    // REFLEJOS, LÓGICA, PERCEPCIÓN, TIPEO, ANÁLISIS, CIFRADO, ESTRATEGIA)
    expect(weaknesses).toHaveLength(8);
  });

  it('getWeaknessAnalysis está ordenado de menor a mayor score', async () => {
    const stats = await freshStats();
    const weaknesses = stats.getWeaknessAnalysis();
    for (let i = 1; i < weaknesses.length; i++) {
      expect(weaknesses[i].score).toBeGreaterThanOrEqual(weaknesses[i - 1].score);
    }
  });

  it('getStrengthAnalysis omite categorías sin ninguna partida jugada', async () => {
    const stats = await freshStats();
    const strengths = stats.getStrengthAnalysis();
    // Sin ninguna partida registrada, ninguna categoría tiene totalPlays > 0
    expect(strengths).toEqual([]);
  });

  it('getStrengthAnalysis incluye una categoría con buen desempeño tras jugarla', async () => {
    const stats = await freshStats();
    // Score alto, tiempo bajo (en ms, /1000*30 debe quedar chico) y accuracy alta
    stats.recordGamePerformance('termita', 100, 100, 100);

    const strengths = stats.getStrengthAnalysis();
    const memoria = strengths.find((s) => s.category === 'MEMORIA');
    expect(memoria).toBeDefined();
  });

  it('getStrengthAnalysis está ordenado de mayor a menor score', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 100, 100); // MEMORIA
    stats.recordGamePerformance('arrow', 100, 100, 100); // REFLEJOS

    const strengths = stats.getStrengthAnalysis();
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i].score).toBeLessThanOrEqual(strengths[i - 1].score);
    }
  });
});

describe('AdvancedStats — getPerformanceMetrics', () => {
  it('sin ninguna partida jugada, todas las métricas son 0', async () => {
    const stats = await freshStats();
    expect(stats.getPerformanceMetrics()).toEqual({ accuracy: 0, speed: 0, consistency: 0, improvement: 0 });
  });

  it('todas las métricas quedan clampeadas entre 0 y 100', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000, 100);

    const metrics = stats.getPerformanceMetrics();
    for (const value of Object.values(metrics)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('accuracy en getPerformanceMetrics refleja el promedio de accuracy de todos los juegos', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000, 80);
    stats.recordGamePerformance('arrow', 100, 1000, 100);

    expect(stats.getPerformanceMetrics().accuracy).toBe(90); // (80+100)/2
  });

  it('con score siempre 0 en todas las partidas, improvement es 0, ya no NaN', async () => {
    // Antes de la corrección, el NaN de calculateImprovementRate() se
    // propagaba hasta acá sin clampear (Math.max(0, Math.min(100, NaN))
    // === NaN en JS), y getPerformanceMetrics() SÍ es consumido
    // directamente por la vista de estadísticas
    // (js/views/estadisticasAvanzadas.logic.ts). Se verifica que el fix
    // en calculateImprovementRate() resuelve también este caso.
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 0, 1000);
    stats.recordGamePerformance('termita', 0, 1000);

    expect(stats.getPerformanceMetrics().improvement).toBe(0);
  });
});

describe('AdvancedStats — getCognitiveProfile', () => {
  it('sin partidas jugadas, balanced es false y dominantCategory es "Ninguna"', async () => {
    const stats = await freshStats();
    const profile = stats.getCognitiveProfile();

    expect(profile.strengths).toEqual([]);
    expect(profile.balanced).toBe(false);
    expect(profile.dominantCategory).toBe('Ninguna');
  });

  it('una categoría nunca jugada aparece en weaknesses (score 0 <= 40)', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 100, 100); // solo juega MEMORIA

    const profile = stats.getCognitiveProfile();
    expect(profile.weaknesses).toContain('REFLEJOS'); // nunca jugada
  });
});

describe('AdvancedStats — getTopPerformingGames / getMostPlayedGames / getRecentActivity', () => {
  let stats: Awaited<ReturnType<typeof freshStats>>;

  beforeEach(async () => {
    stats = await freshStats();
    stats.recordGamePerformance('termita', 500, 1000); // mejor score
    stats.recordGamePerformance('termita', 500, 1000); // 2 plays
    stats.recordGamePerformance('arrow', 100, 1000); // 1 play
    stats.recordGamePerformance('simon', 300, 1000);
    stats.recordGamePerformance('simon', 300, 1000);
    stats.recordGamePerformance('simon', 300, 1000); // 3 plays, el más jugado
  });

  it('getTopPerformingGames ordena por averageScore descendente', () => {
    const top = stats.getTopPerformingGames();
    expect(top[0].gameId).toBe('termita'); // averageScore 500
  });

  it('getTopPerformingGames respeta el límite pasado', () => {
    const top = stats.getTopPerformingGames(2);
    expect(top).toHaveLength(2);
  });

  it('getMostPlayedGames ordena por totalPlays descendente', () => {
    const mostPlayed = stats.getMostPlayedGames();
    expect(mostPlayed[0].gameId).toBe('simon'); // 3 plays
  });

  it('getRecentActivity respeta el límite por defecto (10) sin romper con pocos juegos', () => {
    const recent = stats.getRecentActivity();
    expect(recent.length).toBeLessThanOrEqual(10);
    expect(recent.length).toBe(3); // solo 3 gameIds distintos registrados
  });
});

describe('AdvancedStats — export / import', () => {
  it('exportStats produce un JSON parseable con las claves esperadas', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000);

    const exported = JSON.parse(stats.exportStats());
    expect(exported).toHaveProperty('gameAnalyses');
    expect(exported).toHaveProperty('heatmapData');
    expect(exported).toHaveProperty('performanceMetrics');
    expect(exported).toHaveProperty('exportedAt');
  });

  it('importStats restaura gameAnalyses desde el JSON exportado', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 777, 1000);
    const exported = stats.exportStats();

    const fresh = await freshStats();
    expect(fresh.getGameAnalysis('termita')).toBeUndefined();

    fresh.importStats(exported);
    expect(fresh.getGameAnalysis('termita')?.averageScore).toBe(777);
  });

  it('importStats lanza un error con datos JSON inválidos', async () => {
    const stats = await freshStats();
    expect(() => stats.importStats('esto no es json')).toThrow('Invalid stats data');
  });

  it('importStats con JSON válido pero sin las claves esperadas no lanza y no cambia el estado', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000);

    expect(() => stats.importStats('{}')).not.toThrow();
    // Sin 'gameAnalyses' en el JSON importado, el estado previo se conserva
    expect(stats.getGameAnalysis('termita')).toBeDefined();
  });
});

describe('AdvancedStats — resetStats', () => {
  it('limpia todos los análisis y datos guardados', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000);
    expect(stats.getAllGameAnalyses()).toHaveLength(1);

    stats.resetStats();

    expect(stats.getAllGameAnalyses()).toHaveLength(0);
  });

  it('reinicializa el heatmap con 7×24 entradas en 0 tras resetear', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000); // esto incrementa una celda del heatmap

    stats.resetStats();

    const heatmap = stats.getHeatmapData();
    expect(heatmap).toHaveLength(7 * 24);
    expect(heatmap.every((h) => h.value === 0)).toBe(true);
  });

  it('persiste el estado reseteado en localStorage', async () => {
    const stats = await freshStats();
    stats.recordGamePerformance('termita', 100, 1000);
    (localStorage.setItem as any).mockClear();

    stats.resetStats();

    expect(localStorage.setItem).toHaveBeenCalledWith('advanced-stats', expect.any(String));
  });
});

describe('AdvancedStats — heatmap', () => {
  it('el heatmap inicial tiene exactamente 7×24 = 168 entradas', async () => {
    const stats = await freshStats();
    expect(stats.getHeatmapData()).toHaveLength(168);
  });

  it('todas las entradas del heatmap inicial están en 0', async () => {
    const stats = await freshStats();
    expect(stats.getHeatmapData().every((h) => h.value === 0)).toBe(true);
  });

  it('registrar una partida incrementa la celda correspondiente a la hora/día actual', async () => {
    const stats = await freshStats();
    const now = new Date();
    stats.recordGamePerformance('termita', 100, 1000);

    const cell = stats.getHeatmapData().find((h) => h.day === now.getDay() && h.hour === now.getHours());
    expect(cell?.value).toBe(1);
  });
});
