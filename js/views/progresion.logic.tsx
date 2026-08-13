/**
 * Progresión View Logic (Preact)
 * Lógica para la vista de progresión y RPG
 *
 * Migrado desde progresion.logic.ts (manipulación imperativa del DOM
 * + template() en progresion.ts) a un componente Preact. Mantiene el
 * mismo contrato init()/stop() que espera GameRegistry (ver
 * registerSystemViews.ts) y las mismas clases CSS/estructura de
 * markup que consumía css/progression.css.
 *
 * Nota: a diferencia de logros/personalización, el template original
 * de esta vista no incluía un `.back-btn` — se preserva ese mismo
 * comportamiento acá (sin agregar uno que no existía).
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  progressionSystem,
  type DailyQuest,
  type SkillNode,
  type SeasonPass,
} from '../progressionSystem.js';

// Lecturas defensivas: si progressionSystem no expone el método
// esperado (p. ej. un mock de test desactualizado), se degrada a un
// valor neutro en vez de tirar abajo el render completo del
// componente — mismo criterio aplicado en logros.logic.tsx y
// personalizacion.logic.tsx.
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const REWARD_ICONS: Record<string, string> = {
  xp: '⭐',
  cosmetic: '🎁',
  title: '🏷️',
  theme: '🎨',
};

function getRewardIcon(type: string): string {
  return REWARD_ICONS[type] || '🎁';
}

function LevelSection({ currentLevel, levelTitle, currentXP, xpToNext, skillPoints }: {
  currentLevel: number;
  levelTitle: string;
  currentXP: number;
  xpToNext: number;
  skillPoints: number;
}) {
  const xpPercentage = xpToNext > 0 ? (currentXP / xpToNext) * 100 : 0;

  return (
    <div className="level-section">
      <div className="level-card">
        <div className="level-icon">⚡</div>
        <div className="level-info">
          <span className="level-number" id="current-level">{currentLevel}</span>
          <span className="level-title" id="level-title">{levelTitle}</span>
        </div>
        <div className="xp-bar-container">
          <div className="xp-bar" id="xp-bar">
            <div className="xp-fill" id="xp-fill" style={{ width: `${xpPercentage}%` }} />
          </div>
          <span className="xp-text" id="xp-text">{currentXP} / {xpToNext} XP</span>
        </div>
        <div className="skill-points-display">
          <span className="skill-points-icon">🌟</span>
          <span className="skill-points-value" id="skill-points">{skillPoints}</span>
          <span className="skill-points-label">Puntos de Habilidad</span>
        </div>
      </div>
    </div>
  );
}

function DailyQuestsSection({ quests, streak }: { quests: DailyQuest[]; streak: number }) {
  return (
    <div className="daily-quests-section">
      <h3 className="section-title">📋 Misiones Diarias</h3>
      <div className="quests-grid" id="daily-quests">
        {quests.map((quest) => (
          <div key={quest.id} className={`quest-card ${quest.completed ? 'quest-card--completed' : ''}`}>
            <div className="quest-info">
              <h4 className="quest-name">{quest.name}</h4>
              <p className="quest-description">{quest.description}</p>
              <div className="quest-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(quest.progress / quest.target) * 100}%` }} />
                </div>
                <span className="progress-text">{quest.progress} / {quest.target}</span>
              </div>
            </div>
            <div className="quest-reward">
              <span className="reward-icon">⭐</span>
              <span className="reward-value">+{quest.reward.xp} XP</span>
              {quest.reward.skillPoints ? <span className="reward-skill">+{quest.reward.skillPoints} SP</span> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="streak-display">
        <span className="streak-icon">🔥</span>
        <span className="streak-value" id="streak-count">{streak}</span>
        <span className="streak-label">días consecutivos</span>
      </div>
    </div>
  );
}

function SkillTreeSection({ skillTree, unlockedSkills, onUnlock }: {
  skillTree: SkillNode[];
  unlockedSkills: Map<string, number>;
  onUnlock: (skillId: string) => void;
}) {
  return (
    <div className="skill-tree-section">
      <h3 className="section-title">🌳 Árbol de Habilidades</h3>
      <div className="skill-tree-grid" id="skill-tree">
        {skillTree.map((skill) => {
          const currentLevel = unlockedSkills.get(skill.id) || 0;
          const canUnlock = progressionSystem.canUnlockSkill(skill.id);
          const isMaxed = currentLevel >= skill.maxLevel;

          return (
            <div key={skill.id} className={`skill-card ${currentLevel > 0 ? 'skill-card--unlocked' : ''} ${isMaxed ? 'skill-card--maxed' : ''}`}>
              <div className="skill-icon">{skill.icon}</div>
              <div className="skill-info">
                <h4 className="skill-name">{skill.name}</h4>
                <p className="skill-description">{skill.description}</p>
                <div className="skill-level">
                  <span className="skill-level-current">{currentLevel}</span>
                  <span className="skill-level-separator">/</span>
                  <span className="skill-level-max">{skill.maxLevel}</span>
                </div>
                <div className="skill-cost">
                  <span className="cost-icon">⭐</span>
                  <span className="cost-value">{skill.costPerLevel} SP</span>
                </div>
              </div>
              <button
                className="skill-unlock-btn"
                data-skill-id={skill.id}
                disabled={!canUnlock || isMaxed}
                onClick={() => onUnlock(skill.id)}
              >
                {isMaxed ? 'MAX' : 'Desbloquear'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeasonPassSection({ seasonLevel, seasonPass, isPremium, onUnlockPremium }: {
  seasonLevel: number;
  seasonPass: SeasonPass | null;
  isPremium: boolean;
  onUnlockPremium: () => void;
}) {
  return (
    <div className="season-pass-section">
      <h3 className="section-title">🎪 Season Pass</h3>
      <div className="season-pass-info">
        <div className="season-level">
          <span className="season-level-label">Nivel Temporada:</span>
          <span className="season-level-value" id="season-level">{seasonLevel}</span>
        </div>
        <div className="season-progress">
          <div className="season-progress-bar" id="season-progress-bar">
            <div className="season-progress-fill" id="season-progress-fill" />
          </div>
        </div>
        <button className="premium-btn" id="premium-btn" disabled={isPremium} onClick={onUnlockPremium}>
          {isPremium ? '👑 Premium Activo' : '👑 Desbloquear Premium'}
        </button>
      </div>
      <div className="season-rewards" id="season-rewards">
        {seasonPass && seasonPass.levels.slice(0, 10).map((level) => (
          <div key={level.level} className={`season-reward-card ${seasonLevel >= level.level ? 'season-reward-card--unlocked' : ''}`}>
            <div className="reward-level">{level.level}</div>
            <div className="reward-free">
              <span className="reward-icon">{getRewardIcon(level.freeReward.type)}</span>
            </div>
            {level.premiumReward && (
              <div className={`reward-premium ${!isPremium ? 'reward-premium--locked' : ''}`}>
                <span className="reward-icon">{getRewardIcon(level.premiumReward.type)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgresionView() {
  const [currentLevel, setCurrentLevel] = useState(() => safe(() => progressionSystem.getCurrentLevel(), 1));
  const [levelTitle, setLevelTitle] = useState(() => safe(() => progressionSystem.getCurrentLevelData().title, ''));
  const [currentXP, setCurrentXP] = useState(() => safe(() => progressionSystem.getCurrentXP(), 0));
  const [xpToNext, setXpToNext] = useState(() => safe(() => progressionSystem.getXPToNextLevel(), 100));
  const [skillPoints, setSkillPoints] = useState(() => safe(() => progressionSystem.getSkillPoints(), 0));
  const [streak, setStreak] = useState(() => safe(() => progressionSystem.getStreak(), 0));
  const [quests, setQuests] = useState<DailyQuest[]>(() => safe(() => progressionSystem.getDailyQuests(), []));
  const [skillTree, setSkillTree] = useState<SkillNode[]>(() => safe(() => progressionSystem.getSkillTree(), []));
  const [unlockedSkills, setUnlockedSkills] = useState<Map<string, number>>(() => safe(() => progressionSystem.getUnlockedSkills(), new Map()));
  const [seasonLevel, setSeasonLevel] = useState(() => safe(() => progressionSystem.getSeasonPassLevel(), 1));
  const [seasonPass, setSeasonPass] = useState<SeasonPass | null>(() => safe(() => progressionSystem.getSeasonPass(), null));
  const [isPremium, setIsPremium] = useState(() => safe(() => progressionSystem.isPremiumUnlocked(), false));

  const refreshProgression = () => {
    setCurrentLevel(safe(() => progressionSystem.getCurrentLevel(), 1));
    setLevelTitle(safe(() => progressionSystem.getCurrentLevelData().title, ''));
    setCurrentXP(safe(() => progressionSystem.getCurrentXP(), 0));
    setXpToNext(safe(() => progressionSystem.getXPToNextLevel(), 100));
    setSkillPoints(safe(() => progressionSystem.getSkillPoints(), 0));
    setStreak(safe(() => progressionSystem.getStreak(), 0));
  };

  const refreshDailyQuests = () => setQuests(safe(() => progressionSystem.getDailyQuests(), []));

  const refreshSkillTree = () => {
    setSkillTree(safe(() => progressionSystem.getSkillTree(), []));
    setUnlockedSkills(safe(() => progressionSystem.getUnlockedSkills(), new Map()));
  };

  const refreshSeasonPass = () => {
    setSeasonLevel(safe(() => progressionSystem.getSeasonPassLevel(), 1));
    setSeasonPass(safe(() => progressionSystem.getSeasonPass(), null));
    setIsPremium(safe(() => progressionSystem.isPremiumUnlocked(), false));
  };

  useEffect(() => {
    const xpHandler = () => refreshProgression();
    const levelUpHandler = () => {
      refreshProgression();
      showLevelUpNotification();
    };
    const skillUnlockHandler = () => {
      refreshSkillTree();
      refreshProgression();
    };
    const questCompletedHandler = () => {
      refreshDailyQuests();
      refreshProgression();
    };

    window.addEventListener('progression:xp_gained', xpHandler);
    window.addEventListener('progression:level_up', levelUpHandler);
    window.addEventListener('progression:skill_unlocked', skillUnlockHandler);
    window.addEventListener('progression:quest_completed', questCompletedHandler);
    return () => {
      window.removeEventListener('progression:xp_gained', xpHandler);
      window.removeEventListener('progression:level_up', levelUpHandler);
      window.removeEventListener('progression:skill_unlocked', skillUnlockHandler);
      window.removeEventListener('progression:quest_completed', questCompletedHandler);
    };
  }, []);

  const handleUnlockSkill = (skillId: string) => {
    const success = progressionSystem.unlockSkill(skillId);
    if (success) {
      refreshSkillTree();
      refreshProgression();
    }
  };

  const handleUnlockPremium = () => {
    if (!progressionSystem.isPremiumUnlocked()) {
      progressionSystem.unlockPremium();
      refreshSeasonPass();
    }
  };

  return (
    <div className="progression-view">
      <div className="progression-header">
        <h2 className="progression-title">⚡ Sistema de Progresión</h2>
      </div>

      <LevelSection
        currentLevel={currentLevel}
        levelTitle={levelTitle}
        currentXP={currentXP}
        xpToNext={xpToNext}
        skillPoints={skillPoints}
      />

      <DailyQuestsSection quests={quests} streak={streak} />

      <SkillTreeSection skillTree={skillTree} unlockedSkills={unlockedSkills} onUnlock={handleUnlockSkill} />

      <SeasonPassSection
        seasonLevel={seasonLevel}
        seasonPass={seasonPass}
        isPremium={isPremium}
        onUnlockPremium={handleUnlockPremium}
      />
    </div>
  );
}

function showLevelUpNotification(): void {
  // Se mantiene fuera de Preact (igual que el original): notificación
  // efímera insertada directo en document.body, no parte del árbol de
  // la vista #progresion que este componente controla.
  const level = safe(() => progressionSystem.getCurrentLevel(), 1);
  const levelTitle = safe(() => progressionSystem.getCurrentLevelData().title, '');

  const notification = document.createElement('div');
  notification.className = 'level-up-notification';
  notification.innerHTML = `
    <div class="level-up-content">
      <span class="level-up-icon">⬆️</span>
      <div class="level-up-text">
        <h4>¡Nivel Subido!</h4>
        <p>Nivel ${level}: ${levelTitle}</p>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('level-up-notification--show'), 100);
  setTimeout(() => {
    notification.classList.remove('level-up-notification--show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

export function init(): void {
  const container = document.getElementById('progresion');
  if (!container) return;

  render(<ProgresionView />, container);
}

export function stop(): void {
  const container = document.getElementById('progresion');
  if (container) {
    render(null, container);
  }
}
