/**
 * Integration tests for GameRegistry with real DOM
 * Tests the complete flow from registration to game initialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import GameRegistry from '../js/core/gameRegistry.js';

describe('GameRegistry Integration Tests', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="gameList"></div>
          <section id="termita" data-lazy="1">
            <div data-ui="grid" class="termita-grid"></div>
            <span data-ui="score">0</span>
            <button data-ui="start">Iniciar</button>
          </section>
          <section id="simon" data-lazy="1">
            <div data-ui="pads"></div>
            <span data-ui="score">0</span>
          </section>
        </body>
      </html>
    `);
    document = dom.window.document;
    (global as any).document = document;
  });

  afterEach(() => {
    // GameRegistry.reset() vacía games/initialized/stopFns/logicPromises
    // entre tests — antes de que este método existiera, cada test que
    // ejercitaba ensureInit() tenía que usar un id único
    // (test-game-lifecycle, test-game-cache) para no heredar el estado
    // "ya inicializado" que dejaba el test anterior sobre el mismo
    // singleton. Ya no hace falta ese cuidado: aun así se mantienen los
    // ids descriptivos porque ayudan a leer las aserciones, no porque
    // sigan siendo necesarios para aislar el estado.
    GameRegistry.reset();
  });

  it('should register games and make them visible', () => {
    const gameConfig = {
      id: 'test-game',
      name: 'Test Game',
      tag: 'TEST',
      accent: '#ff6600',
      icon: 'test.svg',
      num: '99',
      description: 'Test description',
      difficulty: 1,
      logic: () => Promise.resolve({
        init: () => () => {},
        stop: () => {}
      }),
      init: () => {},
      stop: () => {}
    };

    GameRegistry.register(gameConfig);
    const visibleGames = GameRegistry.visible();

    expect(visibleGames).toHaveLength(1);
    expect(visibleGames[0].id).toBe('test-game');
  });

  it('should resolve UI elements correctly from real DOM', () => {
    const gameConfig = {
      id: 'termita',
      name: 'Termita',
      tag: 'MEMORIA',
      accent: '#ff6600',
      icon: 'termita.svg',
      num: '1',
      description: 'Memoriza la cuadrícula',
      difficulty: 2,
      logic: () => Promise.resolve({
        init: (ui: any) => {
          expect(ui.grid).toBeTruthy();
          expect(ui.score).toBeTruthy();
          expect(ui.start).toBeTruthy();
        },
        stop: () => {}
      }),
      init: () => {},
      stop: () => {}
    };

    GameRegistry.register(gameConfig);
    const ui = GameRegistry.resolveUi('termita');

    expect(ui.grid).toBeInstanceOf(dom.window.HTMLElement);
    expect(ui.score).toBeInstanceOf(dom.window.HTMLElement);
    expect(ui.start).toBeInstanceOf(dom.window.HTMLElement);
  });

  it('should handle missing data-ui elements gracefully', () => {
    const gameConfig = {
      id: 'simon',
      name: 'Simon',
      tag: 'SECUENCIA',
      accent: '#ff6600',
      icon: 'simon.svg',
      num: '2',
      description: 'Repite la secuencia',
      difficulty: 3,
      logic: () => Promise.resolve({
        init: (ui: any) => {
          expect(ui.pads).toBeTruthy();
          expect(ui.score).toBeTruthy();
          expect(ui.nonExistent).toBeUndefined();
        },
        stop: () => {}
      }),
      init: () => {},
      stop: () => {}
    };

    GameRegistry.register(gameConfig);
    const ui = GameRegistry.resolveUi('simon');

    expect(ui.pads).toBeTruthy();
    expect(ui.score).toBeTruthy();
    expect(ui.nonExistent).toBeUndefined();
  });

  it('should initialize game logic and call stop correctly', async () => {
    let initCalled = false;
    let stopCalled = false;

    const gameConfig = {
      id: 'test-game-lifecycle',
      name: 'Test Game Lifecycle',
      tag: 'TEST',
      accent: '#ff6600',
      icon: 'test.svg',
      num: '99',
      description: 'Test description',
      difficulty: 1,
      logic: () => Promise.resolve({
        init: () => {
          initCalled = true;
        },
        stop: () => {
          stopCalled = true;
        }
      }),
      init: () => {},
      stop: () => {}
    };

    GameRegistry.register(gameConfig);
    await GameRegistry.ensureInit('test-game-lifecycle');
    GameRegistry.stopGame('test-game-lifecycle');

    expect(initCalled).toBe(true);
    expect(stopCalled).toBe(true);
  });

  it('should cache initialized game instances', async () => {
    let initCount = 0;

    const gameConfig = {
      id: 'test-game-cache',
      name: 'Test Game Cache',
      tag: 'TEST',
      accent: '#ff6600',
      icon: 'test.svg',
      num: '99',
      description: 'Test description',
      difficulty: 1,
      logic: () => Promise.resolve({
        init: () => {
          initCount++;
        },
        stop: () => {}
      }),
      init: () => {},
      stop: () => {}
    };

    GameRegistry.register(gameConfig);

    await GameRegistry.ensureInit('test-game-cache');
    await GameRegistry.ensureInit('test-game-cache');
    await GameRegistry.ensureInit('test-game-cache');

    expect(initCount).toBe(1); // Should only initialize once
  });

  it('should filter games by tag', () => {
    GameRegistry.register({
      id: 'game1',
      name: 'Game 1',
      tag: 'TEST_TAG',
      accent: '#ff6600',
      icon: 'game1.svg',
      num: '1',
      description: 'Test game',
      difficulty: 1,
      logic: () => Promise.resolve({ init: () => {}, stop: () => {} }),
      init: () => {},
      stop: () => {}
    });

    GameRegistry.register({
      id: 'game2',
      name: 'Game 2',
      tag: 'OTHER_TAG',
      accent: '#ff6600',
      icon: 'game2.svg',
      num: '2',
      description: 'Other game',
      difficulty: 2,
      logic: () => Promise.resolve({ init: () => {}, stop: () => {} }),
      init: () => {},
      stop: () => {}
    });

    GameRegistry.register({
      id: 'game3',
      name: 'Game 3',
      tag: 'TEST_TAG',
      accent: '#ff6600',
      icon: 'game3.svg',
      num: '3',
      description: 'Another test game',
      difficulty: 1,
      logic: () => Promise.resolve({ init: () => {}, stop: () => {} }),
      init: () => {},
      stop: () => {}
    });

    const testTagGames = GameRegistry.visible().filter(g => g.tag === 'TEST_TAG');
    expect(testTagGames).toHaveLength(2);
    expect(testTagGames.every(g => g.tag === 'TEST_TAG')).toBe(true);
  });
});
