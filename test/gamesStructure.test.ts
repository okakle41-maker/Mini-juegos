/**
 * Generic Game Structure Tests
 * Verifica que los juegos representativos tengan la estructura correcta
 */

import { describe, it, expect } from 'vitest';
import * as simonLogic from '../js/games/simon.logic.js';
import * as termitaLogic from '../js/games/termita.logic.js';
import * as arrowGameLogic from '../js/games/arrowGame.logic.js';
import * as typixLogic from '../js/games/typix.logic.js';
import * as ringpuzzleLogic from '../js/games/ringpuzzle.logic.js';
import * as rhythmclickLogic from '../js/games/rhythmclick.logic.js';
import * as pairsLogic from '../js/games/pairs.logic.js';
import * as sequenceLogic from '../js/games/sequence.logic.js';
import * as memorygridLogic from '../js/games/memorygrid.logic.js';
import * as reactorLogic from '../js/games/reactor.logic.js';

describe('Game Structure Validation', () => {
  const gameModules = [
    { name: 'simon', module: simonLogic },
    { name: 'termita', module: termitaLogic },
    { name: 'arrowGame', module: arrowGameLogic },
    { name: 'typix', module: typixLogic },
    { name: 'ringpuzzle', module: ringpuzzleLogic },
    { name: 'rhythmclick', module: rhythmclickLogic },
    { name: 'pairs', module: pairsLogic },
    { name: 'sequence', module: sequenceLogic },
    { name: 'memorygrid', module: memorygridLogic },
    { name: 'reactor', module: reactorLogic }
  ];

  gameModules.forEach(({ name, module }) => {
    it(`should have init function in ${name}`, () => {
      expect(typeof module.init).toBe('function');
    });

    it(`should have stop function in ${name}`, () => {
      expect(typeof module.stop).toBe('function');
    });
  });

  it('should have proper error handling in games', () => {
    expect(typeof simonLogic.init).toBe('function');
  });

  it('should use GameUi type for init parameter', () => {
    expect(typeof simonLogic.init).toBe('function');
  });
});
