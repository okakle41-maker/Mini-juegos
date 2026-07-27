/**
 * safeStorage.ts — Abstracción central y robusta de localStorage
 *
 * Antes de esto, 9+ archivos golpeaban `localStorage` directamente, cada
 * uno con su propio nivel de manejo de errores (algunos con try/catch,
 * otros sin ninguno — ver Skillcheck.ts, arrowGame.ts, rapidlines.ts).
 * Problemas concretos que esto soluciona:
 *
 *   - `localStorage` puede no existir o lanzar (modo privado de Safari,
 *     almacenamiento deshabilitado por política, cuota excedida) y varios
 *     call-sites no capturaban esa excepción en absoluto.
 *   - Un valor corrupto (JSON inválido, o JSON válido pero con la forma
 *     equivocada tras un cambio de versión del código) rompía `JSON.parse`
 *     y no había forma uniforme de recuperarse ni de descartar el dato malo.
 *   - Cada manager reinventaba su propio try/catch con mensajes de log
 *     distintos, dificultando encontrar todos los puntos de fallo.
 *
 * SafeStorage centraliza: detección de disponibilidad, manejo de errores
 * consistente, y helpers tipados para los tres casos reales del proyecto
 * (JSON, string crudo, número).
 */

import ErrorLogger from './errorLogger.js';

export interface SafeStorageValidateOptions<T> {
  /**
   * Valida la forma del valor parseado. Si devuelve `false`, el valor se
   * considera corrupto: se descarta (se borra la clave) y se devuelve el
   * fallback, en vez de propagar datos con forma inesperada al resto de la app.
   */
  validate?: (value: unknown) => value is T;
}

export interface SafeStorageInterface {
  isAvailable: () => boolean;
  getJSON: <T>(key: string, fallback: T, options?: SafeStorageValidateOptions<T>) => T;
  setJSON: <T>(key: string, value: T) => boolean;
  getString: (key: string, fallback: string) => string;
  setString: (key: string, value: string) => boolean;
  getNumber: (key: string, fallback: number) => number;
  setNumber: (key: string, value: number) => boolean;
  remove: (key: string) => void;
}

class SafeStorage implements SafeStorageInterface {
  private available: boolean;

  constructor() {
    this.available = SafeStorage.detectAvailability();
    if (!this.available) {
      ErrorLogger.log(
        'SafeStorage.constructor',
        new Error('localStorage no está disponible (modo privado, cuota o política del navegador)'),
        { impact: 'La app seguirá funcionando pero no se persistirán datos entre sesiones.' }
      );
    }
  }

  private static detectAvailability(): boolean {
    try {
      const testKey = '__safe_storage_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Lee y parsea un valor JSON. Devuelve `fallback` si la clave no existe,
   * si `localStorage` no está disponible, si el JSON es inválido, o si
   * `options.validate` rechaza la forma del valor (en cuyo caso además
   * borra la clave corrupta).
   */
  getJSON<T>(key: string, fallback: T, options?: SafeStorageValidateOptions<T>): T {
    if (!this.available) return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;

      const parsed = JSON.parse(raw) as unknown;

      if (options?.validate && !options.validate(parsed)) {
        ErrorLogger.log(
          'SafeStorage.getJSON',
          new Error(`Valor corrupto en "${key}" (forma inesperada). Se descarta.`),
          { key }
        );
        this.remove(key);
        return fallback;
      }

      return parsed as T;
    } catch (error) {
      ErrorLogger.log('SafeStorage.getJSON', error, { key, fallbackUsed: true });
      return fallback;
    }
  }

  setJSON<T>(key: string, value: T): boolean {
    if (!this.available) return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      ErrorLogger.log('SafeStorage.setJSON', error, { key });
      return false;
    }
  }

  /** Lectura de strings crudos (sin JSON.parse), p. ej. flags '0'/'1'. */
  getString(key: string, fallback: string): string {
    if (!this.available) return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (error) {
      ErrorLogger.log('SafeStorage.getString', error, { key, fallbackUsed: true });
      return fallback;
    }
  }

  setString(key: string, value: string): boolean {
    if (!this.available) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      ErrorLogger.log('SafeStorage.setString', error, { key });
      return false;
    }
  }

  /** Lectura numérica robusta: NaN/Infinity/valor faltante → fallback. */
  getNumber(key: string, fallback: number): number {
    const raw = this.getString(key, '');
    if (raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  setNumber(key: string, value: number): boolean {
    return this.setString(key, String(value));
  }

  remove(key: string): void {
    if (!this.available) return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      ErrorLogger.log('SafeStorage.remove', error, { key });
    }
  }
}

// Instancia única
const safeStorage = new SafeStorage();

export default safeStorage;
