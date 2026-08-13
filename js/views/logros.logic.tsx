/**
 * Logros View Logic (Preact)
 * Lógica para la vista de logros y trofeos
 *
 * Migrado desde logros.logic.ts (manipulación imperativa del DOM +
 * template() en logros.ts) a un componente Preact. Mantiene el mismo
 * contrato init()/stop() que espera GameRegistry (ver
 * registerSystemViews.ts) y las mismas clases CSS/estructura de
 * markup que consumía css/achievements.css, para no requerir cambios
 * de estilos.
 */
import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { achievementManager, type Achievement } from '../achievements.js';
import type { AchievementEventDetail, Reward } from '../types/game';
import { hydrateBackButtons } from '../utils/backButton.js';

type CategoryFilter = 'all' | 'unlocked' | 'locked' | 'games' | 'streak' | 'score' | 'special';
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

const CATEGORY_FILTERS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'unlocked', label: 'Desbloqueados' },
  { id: 'locked', label: 'Por Desbloquear' },
  { id: 'games', label: 'Juegos' },
  { id: 'streak', label: 'Rachas' },
  { id: 'score', label: 'Puntuación' },
  { id: 'special', label: 'Especiales' },
];

const RARITY_FILTERS: Array<{ id: Rarity; label: string }> = [
  { id: 'legendary', label: '👑 Legendario' },
  { id: 'epic', label: '💜 Épico' },
  { id: 'rare', label: '💙 Raro' },
  { id: 'common', label: '💚 Común' },
];

const REWARD_ICONS: Record<string, string> = {
  xp: '⭐',
  title: '🏷️',
  theme: '🎨',
  effect: '✨',
  badge: '🎖️',
  cosmetic: '🎁',
};

function getRewardIcon(type: string): string {
  return REWARD_ICONS[type] || '🎁';
}

function formatReward(reward: Reward): string {
  if (reward.type === 'xp') return `${reward.value} XP`;
  return String(reward.value);
}

// El filtro por categoría original inferí­a la categoría leyendo texto
// libre de `.achievement-description` (p.ej. "juego"/"racha"/"días").
// Achievement.category ya existe como campo estructurado en
// achievements.ts — usarlo directamente es más robusto que el
// text-matching que reemplaza.
function matchesCategoryFilter(achievement: Achievement, filter: CategoryFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'unlocked':
      return achievement.unlocked;
    case 'locked':
      return !achievement.unlocked;
    case 'games':
      return achievement.category === 'games';
    case 'streak':
      return achievement.category === 'streak';
    case 'score':
      return achievement.category === 'score';
    case 'special':
      return achievement.category === 'special' || achievement.category === 'sequential' || achievement.category === 'seasonal';
    default:
      return true;
  }
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const progress = achievementManager.getAchievementProgress(achievement.id);
  const rarityClass = achievement.reward?.rarity || 'common';

  return (
    <div
      className={`achievement-card achievement-card--${rarityClass} ${
        achievement.unlocked ? 'achievement-card--unlocked' : 'achievement-card--locked'
      }`}
    >
      <div className="achievement-icon">{achievement.icon}</div>
      <div className="achievement-info">
        <h4 className="achievement-name">{achievement.name}</h4>
        <p className="achievement-description">{achievement.description}</p>
        {!achievement.unlocked ? (
          <div className="achievement-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{Math.round(progress)}%</span>
          </div>
        ) : (
          <div className="achievement-unlocked-date">
            Desbloqueado: {new Date(achievement.unlockedAt!).toLocaleDateString()}
          </div>
        )}
      </div>
      {achievement.reward && (
        <div className="achievement-reward">
          <span className="reward-icon">{getRewardIcon(achievement.reward.type)}</span>
          <span className="reward-value">{formatReward(achievement.reward)}</span>
        </div>
      )}
    </div>
  );
}

// Lecturas defensivas: si achievementManager no expone el método
// esperado (p. ej. un mock de test desactualizado, o una futura
// versión parcial del manager), se degrada a un valor vacío en vez de
// tirar abajo el render completo del componente — igual que el
// comportamiento original, donde el template() estático (con su
// back-btn) ya estaba en el DOM antes de que renderAchievements()/
// renderRewards() pudieran fallar.
function safeAchievements(): Achievement[] {
  try {
    return achievementManager.getAchievements();
  } catch {
    return [];
  }
}
function safeTotalXP(): number {
  try {
    return achievementManager.getTotalXP();
  } catch {
    return 0;
  }
}
function safeTitles(): string[] {
  try {
    return achievementManager.getUnlockedTitles();
  } catch {
    return [];
  }
}
function safeActiveTitle(): string {
  try {
    return achievementManager.getActiveTitle();
  } catch {
    return '';
  }
}
function safeCosmetics(): string[] {
  try {
    return achievementManager.getUnlockedCosmetics();
  } catch {
    return [];
  }
}

function LogrosView() {
  const [achievements, setAchievements] = useState<Achievement[]>(safeAchievements);
  const [totalXP, setTotalXP] = useState<number>(safeTotalXP);
  const [titles, setTitles] = useState<string[]>(safeTitles);
  const [activeTitle, setActiveTitle] = useState<string>(safeActiveTitle);
  const [cosmetics, setCosmetics] = useState<string[]>(safeCosmetics);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [activeRarities, setActiveRarities] = useState<Set<Rarity>>(() => new Set());

  const refreshAchievements = () => {
    setAchievements(safeAchievements());
    setTotalXP(safeTotalXP());
  };

  const refreshRewards = () => {
    setTitles(safeTitles());
    setActiveTitle(safeActiveTitle());
    setCosmetics(safeCosmetics());
  };

  useEffect(() => {
    const achievementHandler = (e: Event) => {
      const detail = (e as CustomEvent<AchievementEventDetail>).detail;
      showAchievementNotification(detail);
      refreshAchievements();
      refreshRewards();
    };
    const xpHandler = () => refreshAchievements();

    window.addEventListener('achievement:unlocked', achievementHandler);
    window.addEventListener('xp:gained', xpHandler);
    return () => {
      window.removeEventListener('achievement:unlocked', achievementHandler);
      window.removeEventListener('xp:gained', xpHandler);
    };
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  const visibleAchievements = useMemo(() => {
    return achievements.filter((achievement) => {
      if (!matchesCategoryFilter(achievement, categoryFilter)) return false;
      if (activeRarities.size === 0) return true;
      const rarity = (achievement.reward?.rarity || 'common') as Rarity;
      return activeRarities.has(rarity);
    });
  }, [achievements, categoryFilter, activeRarities]);

  const toggleRarity = (rarity: Rarity) => {
    setActiveRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });
  };

  const equipTitle = (title: string) => {
    achievementManager.setActiveTitle(title);
    refreshRewards();
  };

  return (
    <div className="achievements-view">
      <div className="achievements-header">
        <button className="back-btn" data-back-to="home"></button>
        <h2 className="achievements-title">🏆 Logros y Trofeos</h2>
        <div className="achievements-summary">
          <div className="summary-card">
            <span className="summary-icon">🎖️</span>
            <span className="summary-value">{unlockedCount}</span>
            <span className="summary-label">Desbloqueados</span>
          </div>
          <div className="summary-card">
            <span className="summary-icon">📋</span>
            <span className="summary-value">{totalCount}</span>
            <span className="summary-label">Total</span>
          </div>
          <div className="summary-card">
            <span className="summary-icon">⭐</span>
            <span className="summary-value">{totalXP}</span>
            <span className="summary-label">XP Total</span>
          </div>
        </div>
      </div>

      <div className="achievements-filters">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-btn ${categoryFilter === f.id ? 'filter-btn--active' : ''}`}
            data-filter={f.id}
            onClick={() => setCategoryFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="achievements-rarity-filters">
        {RARITY_FILTERS.map((r) => (
          <button
            key={r.id}
            className={`rarity-btn ${activeRarities.has(r.id) ? 'rarity-btn--active' : ''}`}
            data-rarity={r.id}
            onClick={() => toggleRarity(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="achievements-decorative">
        <span className="decorative-icon">🌟</span>
        <span className="decorative-icon">✨</span>
        <span className="decorative-icon">🎊</span>
      </div>

      <div className="achievements-grid" id="achievements-grid">
        {visibleAchievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>

      <div className="achievements-rewards-section">
        <h3 className="section-title">🎁 Recompensas Desbloqueadas</h3>

        <div className="rewards-subsection">
          <h4 className="subsection-title">Títulos</h4>
          <div className="titles-grid" id="titles-grid">
            {titles.length > 0 ? (
              titles.map((title) => (
                <div key={title} className={`title-card ${title === activeTitle ? 'title-card--active' : ''}`}>
                  <span className="title-name">{title}</span>
                  {title === activeTitle && <span className="title-active-badge">ACTIVO</span>}
                  <button className="title-equip-btn" data-title={title} onClick={() => equipTitle(title)}>
                    Equipar
                  </button>
                </div>
              ))
            ) : (
              <p className="no-rewards">No tienes títulos desbloqueados</p>
            )}
          </div>
        </div>

        <div className="rewards-subsection">
          <h4 className="subsection-title">Cosméticos</h4>
          <div className="cosmetics-grid" id="cosmetics-grid">
            {cosmetics.length > 0 ? (
              cosmetics.map((cosmetic) => (
                <div key={cosmetic} className="cosmetic-card">
                  <span className="cosmetic-name">{cosmetic}</span>
                  <span className="cosmetic-unlocked">✓ Desbloqueado</span>
                </div>
              ))
            ) : (
              <p className="no-rewards">No tienes cosméticos desbloqueados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function showAchievementNotification(achievement: AchievementEventDetail): void {
  // Se mantiene fuera de Preact (igual que el original): es una
  // notificación efímera insertada directo en document.body, no parte
  // del árbol de la vista #logros que este componente controla.
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-notification-content">
      <span class="achievement-notification-icon">${achievement.icon}</span>
      <div class="achievement-notification-text">
        <h4>¡Logro Desbloqueado!</h4>
        <p>${achievement.name}</p>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('achievement-notification--show');
  }, 100);

  setTimeout(() => {
    notification.classList.remove('achievement-notification--show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

export function init(): void {
  const container = document.getElementById('logros');
  if (!container) return;

  render(<LogrosView />, container);
  hydrateBackButtons(container);
}

export function stop(): void {
  const container = document.getElementById('logros');
  if (container) {
    render(null, container);
  }
}
