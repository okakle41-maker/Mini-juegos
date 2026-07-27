/**
 * gameInstanceRegistry.ts — Registro central y tipado de instancias de juego
 *
 * Reemplaza el patrón frágil `window._xxxGame = instance` que usaban varios
 * juegos (holematch, colorcount, arrowGame, lettersFall, memorygrid, simon,
 * pairs) para compartir la instancia activa entre sus funciones `init()` y
 * `stop()`. Ese patrón:
 *   - ensuciaba `window` con propiedades ad-hoc no tipadas (`as any` en cada uso)
 *   - no tenía convención común (unas veces guardaba la instancia completa,
 *     otras solo una función `stop`)
 *   - podía colisionar entre juegos o sobrevivir a un `stop()` mal limpiado
 *
 * Con este registro cada juego usa `GameInstanceRegistry.set/get/clear('id', ...)`
 * con genéricos, sin tocar `window`, y con un único punto de verdad para
 * inspeccionar qué juegos tienen una instancia activa (útil para debugging
 * y para futuras features como "pausar todos").
 */

export interface GameInstanceRegistryInterface {
  set: <T>(id: string, instance: T) => void;
  get: <T>(id: string) => T | undefined;
  has: (id: string) => boolean;
  clear: (id: string) => void;
  activeIds: () => string[];
}

class GameInstanceRegistry implements GameInstanceRegistryInterface {
  private instances = new Map<string, unknown>();

  /**
   * Guarda (o reemplaza) la instancia activa de un juego.
   */
  set<T>(id: string, instance: T): void {
    this.instances.set(id, instance);
  }

  /**
   * Recupera la instancia activa de un juego, tipada por el llamador.
   * Devuelve `undefined` si el juego no tiene instancia activa.
   */
  get<T>(id: string): T | undefined {
    return this.instances.get(id) as T | undefined;
  }

  has(id: string): boolean {
    return this.instances.has(id);
  }

  /**
   * Elimina la instancia activa de un juego. Debe llamarse desde el
   * `stop()` de cada juego para evitar referencias colgantes.
   */
  clear(id: string): void {
    this.instances.delete(id);
  }

  /**
   * IDs de todos los juegos con una instancia activa registrada.
   * Útil para debugging (`GameInstanceRegistry.activeIds()` en consola).
   */
  activeIds(): string[] {
    return Array.from(this.instances.keys());
  }
}

// Instancia única
const GameInstanceRegistryInstance = new GameInstanceRegistry();

export default GameInstanceRegistryInstance;

// Expuesto solo para debugging manual en consola del navegador;
// ningún módulo del proyecto debe leer esto desde `window`, siempre
// deben importar el default export.
(window as unknown as { GameInstanceRegistry: GameInstanceRegistryInterface }).GameInstanceRegistry =
  GameInstanceRegistryInstance;
