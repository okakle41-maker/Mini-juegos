/**
 * gameRegistry.ts — Registro central de minijuegos
 * Versión TypeScript con tipos fuertes
 */

import type { GameUi } from '../types/global';
import { devLog } from './devLog.js';

export interface GameConfig {
  id: string;
  name: string;
  tag: string;
  accent: string;
  icon: string;
  num: string;
  description: string;
  difficulty: number;
  css?: string;
  hidden?: boolean;
  /**
   * Lógica pesada del juego (init/stop) cargada bajo demanda vía import()
   * dinámico, en vez de venir ya resuelta en `init`/`stop`. Preferir esto
   * para juegos nuevos o migrados: separa el módulo que registra los
   * metadatos ligeros (nombre, tag, ícono — necesarios de entrada para
   * pintar el lobby) del módulo con la lógica pesada del juego en sí, que
   * así puede caer en su propio chunk y solo descargarse cuando el
   * usuario abre esa vista, en vez de con toda la app al arrancar.
   *
   * Si un GameConfig define `logic`, tiene prioridad sobre `init`/`stop`
   * directos (ver ensureInit); el resultado se resuelve una sola vez y
   * queda cacheado por `initialized` como cualquier otro juego, así que
   * un segundo `ensureInit(id)` no vuelve a importar el módulo.
   */
  logic?: () => Promise<{ init: (ui: GameUi) => void; stop: () => void }>;
  init: (ui: GameUi) => void;
  stop: () => void;
  leaderboard?: {
    format?: (value: number) => string;
  };
}

export interface GameRegistryInterface {
  register: (config: GameConfig) => void;
  all: () => GameConfig[];
  visible: () => GameConfig[];
  get: (id: string) => GameConfig | undefined;
  allStopFns: () => Array<{ id: string; stop: () => void }>;
  stopGame: (id: string) => void;
  resolveUi: (id: string) => GameUi;
  injectCSS: (href: string | null | undefined) => void;
  ensureInit: (id: string) => Promise<void>;
  prefetch: (id: string) => void;
  /** Solo para tests: limpia todo el estado interno (juegos registrados,
   *  inicializados, stopFns, promesas de logic en vuelo) para que un test
   *  no contamine al siguiente. Ver nota en la implementación. */
  reset: () => void;
}

class GameRegistry implements GameRegistryInterface {
  private games = new Map<string, GameConfig>();
  private initialized = new Set<string>();
  private stopFns = new Map<string, () => void>();
  /** Promesa en vuelo (o resuelta) de `logic()` por id, compartida entre
   *  `prefetch` y `ensureInit` — si el hover ya disparó el import(),
   *  el click que sigue reutiliza esa misma promesa en vez de volver a
   *  invocar `game.logic()`. */
  private logicPromises = new Map<string, ReturnType<NonNullable<GameConfig['logic']>>>();

  register(config: GameConfig): void {
    if (!config?.id) {
      window.ErrorLogger?.log('GameRegistry.register', new Error('Registro inválido: falta id'), { config });
      return;
    }

    this.games.set(config.id, config);

    // Conecta el formateador de leaderboard del juego (si lo define) con
    // LeaderboardManager. Sin esto, GameConfig.leaderboard.format quedaba
    // declarado en cada juego pero nunca se usaba: los badges de récord
    // siempre mostraban el número crudo en vez del formato personalizado.
    if (config.leaderboard?.format && window.Leaderboard?.setConfig) {
      window.Leaderboard.setConfig(config.id, { format: config.leaderboard.format });
    }

    devLog(`[GameRegistry] Registrado: ${config.name} (${config.id})`);
  }

  all(): GameConfig[] {
    return Array.from(this.games.values());
  }

  visible(): GameConfig[] {
    return this.all().filter(game => !game.hidden);
  }

  get(id: string): GameConfig | undefined {
    return this.games.get(id);
  }

  allStopFns(): Array<{ id: string; stop: () => void }> {
    return Array.from(this.stopFns.entries()).map(([id, stop]) => ({ id, stop }));
  }

  /**
   * Limpia por completo el estado interno del singleton.
   *
   * Pensado para usarse en `afterEach`/`beforeEach` de tests: sin esto,
   * dos archivos de test que registran un juego con el mismo id (p.ej.
   * 'test-game') chocaban en silencio porque el singleton persistía
   * entre test files dentro del mismo proceso de Vitest — el bug real
   * que motivó agregar este método (ver test/gameRegistry.test.ts y
   * test/gameRegistryIntegration.test.ts, que hasta ahora evitaban la
   * colisión solo por usar ids distintos por casualidad, no por
   * limpiar el estado).
   *
   * No se llama desde ningún flujo de producción — un GameRegistry que
   * se resetea a mitad de sesión real dejaría a la UI con vistas
   * apuntando a juegos ya no registrados.
   */
  reset(): void {
    this.games.clear();
    this.initialized.clear();
    this.stopFns.clear();
    this.logicPromises.clear();
  }

  /**
   * Detiene un juego específico (si tiene stop registrado)
   */
  stopGame(id: string): void {
    const stop = this.stopFns.get(id);
    if (!stop) return;
    try {
      stop();
      devLog(`[GameRegistry] Detenido: ${id}`);
    } catch (error) {
      window.ErrorLogger?.log('GameRegistry.stopGame', error, { id });
    } finally {
      // `stop()` vacía el DOM de la vista (container.innerHTML = '').
      // Si no invalidamos `initialized`, la próxima vez que se entre a
      // esta vista `ensureInit` ve `initialized.has(id) === true` y
      // sale sin volver a llamar `init()`, dejando el contenedor vacío
      // para siempre. Al borrar también la entrada de `stopFns`, la
      // próxima vez que corra `ensureInit` va a reinicializar desde
      // cero y volver a registrar el `stop` correspondiente.
      this.initialized.delete(id);
      this.stopFns.delete(id);
    }
  }

  /**
   * Resuelve elementos UI usando data-ui attributes
   */
  resolveUi(gameId: string): GameUi {
    const section = document.getElementById(gameId);
    if (!section) return {};

    const ui: GameUi = {};
    section.querySelectorAll<HTMLElement>('[data-ui]').forEach((el) => {
      const key = el.dataset.ui;
      if (key) ui[key] = el;
    });

    // Agrupa elementos data-ui-all="key" en un NodeList bajo esa key,
    // en lugar de sobrescribirse entre sí como pasaría con data-ui.
    const allGroups = new Map<string, HTMLElement[]>();
    section.querySelectorAll<HTMLElement>('[data-ui-all]').forEach((el) => {
      const key = el.dataset.uiAll;
      if (!key) return;
      if (!allGroups.has(key)) allGroups.set(key, []);
      allGroups.get(key)!.push(el);
    });
    allGroups.forEach((els, key) => {
      ui[key] = els as unknown as HTMLElement;
    });

    return ui;
  }

  /**
   * Inyecta CSS del juego de forma lazy
   */
  injectCSS(href: string | null | undefined): void {
    if (!href) return;
    if (document.querySelector(`link[href="${href}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  /**
   * Inicialización lazy del juego.
   *
   * Async porque, para juegos migrados a `GameConfig.logic`, primero debe
   * resolver el import() dinámico de su lógica pesada antes de poder
   * llamar a `init`. El único llamador (viewManager.ts) ya invoca esto de
   * forma "fire and forget" sin encadenar nada sobre su resultado, así
   * que pasar de `void` a `Promise<void>` no le exige ningún cambio.
   */
  async ensureInit(id: string): Promise<void> {
    const game = this.get(id);
    if (!game || this.initialized.has(id)) return;

    try {
      let init = game.init;
      let stop = game.stop;

      if (game.logic) {
        // Reutiliza la promesa si `prefetch(id)` ya la disparó en un
        // hover previo — evita invocar `game.logic()` dos veces para
        // el mismo id. `initialized.add(id)` más abajo evita que una
        // segunda visita a la vista vuelva a entrar aquí.
        let logicPromise = this.logicPromises.get(id);
        if (!logicPromise) {
          logicPromise = game.logic();
          this.logicPromises.set(id, logicPromise);
        }
        const resolved = await logicPromise;
        init = resolved.init;
        stop = resolved.stop;
      }

      const ui = this.resolveUi(id);
      this.injectCSS(game.css);

      init(ui);
      this.initialized.add(id);

      if (typeof stop === 'function') {
        this.stopFns.set(id, stop);
      }

      devLog(`[GameRegistry] Inicializado: ${game.name}`);
    } catch (error) {
      window.ErrorLogger?.log('GameRegistry.ensureInit', error, { id });
    }
  }

  /**
   * Dispara el import() dinámico de `GameConfig.logic` por adelantado,
   * sin llamar a `init` ni tocar el DOM — pensado para precargar el
   * chunk de un juego en `mouseenter`/`focus` sobre su card en el
   * lobby, así el click real que sigue no tiene que esperar la
   * descarga de red.
   *
   * Es fire-and-forget y deliberadamente silencioso ante errores: un
   * prefetch fallido (red lenta, chunk 404, etc.) no debe interrumpir
   * al usuario ni loguear ruido — si de verdad hay un problema con el
   * módulo, `ensureInit` lo va a intentar de nuevo al hacer click y
   * reportarlo ahí, que es el flujo que sí importa.
   *
   * No-op para juegos sin `logic` (ya vienen con init/stop directos,
   * nada que precargar) y para juegos ya iniciados o ya prefetcheados.
   */
  prefetch(id: string): void {
    if (this.initialized.has(id) || this.logicPromises.has(id)) return;

    const game = this.get(id);
    if (!game?.logic) return;

    const logicPromise = game.logic();
    this.logicPromises.set(id, logicPromise);
    logicPromise.catch(() => {
      // Silencioso a propósito — ver comentario del método. Permitimos
      // reintentar en un próximo hover (o en el ensureInit del click)
      // si el prefetch falló, ya que la causa (red, chunk) puede ser
      // transitoria.
      this.logicPromises.delete(id);
    });
  }
}

// Instancia única
const GameRegistryInstance = new GameRegistry();

export default GameRegistryInstance;