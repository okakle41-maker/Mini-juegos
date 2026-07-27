/**
 * statsManager.ts — Helper genérico de persistencia (fachada legacy)
 * Versión TypeScript (antes: <script> inline en index.html)
 *
 * Ahora delega en SafeStorage; se conserva esta clase solo por
 * compatibilidad con el nombre `StatsManager` usado en window.
 */

import safeStorage from './core/safeStorage.js';

export interface StatsManagerInterface {
  get: <T>(key: string, defaultValue: T) => T;
  set: <T>(key: string, value: T) => void;
}

class StatsManager implements StatsManagerInterface {
  get<T>(key: string, defaultValue: T): T {
    return safeStorage.getJSON(key, defaultValue);
  }

  set<T>(key: string, value: T): void {
    safeStorage.setJSON(key, value);
  }
}

// Instancia única
const statsManager = new StatsManager();

export default statsManager;
