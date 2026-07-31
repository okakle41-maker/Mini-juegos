/**
 * js/games/skillchecksHub.logic.ts
 *
 * Lógica del hub "Skill Check" (init/stop), extraída de Skillcheck.ts
 * para lazy loading — ver `logic` en Skillcheck.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
 */

import ViewManager from '../core/viewManager.js';

export function init() {
  const map: Record<string, string> = {
    rapidlines:     'rapidlines-game',
    circle:         'circle-game',
    maze:           'maze-game',
    keyspam:        'keyspam-game',
    sequence:       'sequence-game',
    rhythmclick:    'rhythmclick',
    progresstiming: 'progresstiming',
    multipoint:     'multipoint',
    bouncebar:      'bouncebar',
    holdrelease:    'holdrelease',
    targetpop:      'targetpop',
    chordkeys:      'chordkeys',
    orbitcatch:     'orbitcatch',
    lanedodge:      'lanedodge',
    pipealign:      'pipealign',
  };

  document.querySelectorAll<HTMLElement>('.skill-cube').forEach(cube => {
    const activate = () => {
      const key = cube.dataset.game;
      if (key && map[key]) ViewManager.showView(map[key]);
    };
    cube.addEventListener('click', activate);
    cube.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
  });
}

export function stop() {} // hub has no running state to clean up
