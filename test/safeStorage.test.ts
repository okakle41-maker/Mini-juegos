import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SafeStorage — localStorage disponible (caso normal)', () => {
  let safeStorage: typeof import('../js/core/safeStorage').default;

  beforeEach(async () => {
    vi.resetModules();
    // El mock global de test/setup.ts ya funciona sin lanzar, así que
    // detectAvailability() da true por defecto.
    safeStorage = (await import('../js/core/safeStorage')).default;
  });

  it('isAvailable() devuelve true cuando localStorage funciona', () => {
    expect(safeStorage.isAvailable()).toBe(true);
  });

  describe('getJSON / setJSON', () => {
    it('setJSON serializa el valor con JSON.stringify y devuelve true', () => {
      const result = safeStorage.setJSON('key1', { a: 1, b: 'x' });
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('key1', JSON.stringify({ a: 1, b: 'x' }));
    });

    it('getJSON parsea el valor guardado', () => {
      (localStorage.getItem as any).mockReturnValue('{"a":1,"b":"x"}');
      const result = safeStorage.getJSON('key1', null);
      expect(result).toEqual({ a: 1, b: 'x' });
    });

    it('getJSON devuelve el fallback si la clave no existe (getItem devuelve null)', () => {
      (localStorage.getItem as any).mockReturnValue(null);
      const fallback = { default: true };
      expect(safeStorage.getJSON('missing', fallback)).toBe(fallback);
    });

    it('getJSON devuelve el fallback si el JSON guardado está corrupto (no parseable)', () => {
      (localStorage.getItem as any).mockReturnValue('{esto no es json valido');
      const fallback = { default: true };
      expect(safeStorage.getJSON('corrupt', fallback)).toBe(fallback);
    });

    it('getJSON respeta options.validate: si pasa, devuelve el valor parseado', () => {
      (localStorage.getItem as any).mockReturnValue('{"score":100}');
      const validate = (v: unknown): v is { score: number } =>
        typeof v === 'object' && v !== null && typeof (v as any).score === 'number';

      const result = safeStorage.getJSON('key1', { score: 0 }, { validate });
      expect(result).toEqual({ score: 100 });
    });

    it('getJSON respeta options.validate: si falla, borra la clave y devuelve el fallback', () => {
      (localStorage.getItem as any).mockReturnValue('{"score":"no-es-numero"}');
      const validate = (v: unknown): v is { score: number } =>
        typeof v === 'object' && v !== null && typeof (v as any).score === 'number';

      const fallback = { score: -1 };
      const result = safeStorage.getJSON('key1', fallback, { validate });

      expect(result).toBe(fallback);
      expect(localStorage.removeItem).toHaveBeenCalledWith('key1');
    });

    it('setJSON devuelve false y no lanza si localStorage.setItem lanza (p. ej. cuota excedida)', () => {
      (localStorage.setItem as any).mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      let result: boolean | undefined;
      expect(() => {
        result = safeStorage.setJSON('key1', { a: 1 });
      }).not.toThrow();
      expect(result).toBe(false);
    });

    it('getJSON captura errores inesperados de getItem y devuelve el fallback', () => {
      (localStorage.getItem as any).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const fallback = { safe: true };
      expect(safeStorage.getJSON('key1', fallback)).toBe(fallback);
    });
  });

  describe('getString / setString', () => {
    it('setString guarda el string tal cual (sin JSON.stringify)', () => {
      safeStorage.setString('flag', 'hello world');
      expect(localStorage.setItem).toHaveBeenCalledWith('flag', 'hello world');
    });

    it('getString devuelve el valor crudo guardado', () => {
      (localStorage.getItem as any).mockReturnValue('hello world');
      expect(safeStorage.getString('flag', 'fallback')).toBe('hello world');
    });

    it('getString devuelve el fallback si la clave no existe', () => {
      (localStorage.getItem as any).mockReturnValue(null);
      expect(safeStorage.getString('missing', 'fallback')).toBe('fallback');
    });

    it('getString distingue string vacío guardado ("") de clave inexistente (null)', () => {
      (localStorage.getItem as any).mockReturnValue('');
      expect(safeStorage.getString('emptyKey', 'fallback')).toBe('');
    });

    it('setString devuelve false si localStorage lanza', () => {
      (localStorage.setItem as any).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      expect(safeStorage.setString('flag', 'x')).toBe(false);
    });

    it('getString captura errores y devuelve el fallback', () => {
      (localStorage.getItem as any).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      expect(safeStorage.getString('flag', 'fallback')).toBe('fallback');
    });
  });

  describe('getNumber / setNumber', () => {
    it('setNumber guarda el número como string', () => {
      safeStorage.setNumber('score', 42);
      expect(localStorage.setItem).toHaveBeenCalledWith('score', '42');
    });

    it('getNumber parsea el string guardado a número', () => {
      (localStorage.getItem as any).mockReturnValue('42');
      expect(safeStorage.getNumber('score', 0)).toBe(42);
    });

    it('getNumber devuelve el fallback si la clave no existe', () => {
      (localStorage.getItem as any).mockReturnValue(null);
      expect(safeStorage.getNumber('missing', 99)).toBe(99);
    });

    it('getNumber devuelve el fallback si el valor guardado no es un número válido', () => {
      (localStorage.getItem as any).mockReturnValue('no-es-numero');
      expect(safeStorage.getNumber('score', 99)).toBe(99);
    });

    it('getNumber devuelve el fallback para Infinity/-Infinity (Number.isFinite lo filtra)', () => {
      (localStorage.getItem as any).mockReturnValue('Infinity');
      expect(safeStorage.getNumber('score', 99)).toBe(99);

      (localStorage.getItem as any).mockReturnValue('-Infinity');
      expect(safeStorage.getNumber('score', 99)).toBe(99);
    });

    it('getNumber devuelve el fallback para NaN literal guardado como string', () => {
      (localStorage.getItem as any).mockReturnValue('NaN');
      expect(safeStorage.getNumber('score', 99)).toBe(99);
    });

    it('getNumber maneja números negativos y decimales', () => {
      (localStorage.getItem as any).mockReturnValue('-3.5');
      expect(safeStorage.getNumber('score', 0)).toBe(-3.5);
    });

    it('getNumber maneja el string "0" correctamente (no lo confunde con vacío/fallback)', () => {
      (localStorage.getItem as any).mockReturnValue('0');
      expect(safeStorage.getNumber('score', 99)).toBe(0);
    });
  });

  describe('remove', () => {
    it('llama a localStorage.removeItem con la key', () => {
      safeStorage.remove('key1');
      expect(localStorage.removeItem).toHaveBeenCalledWith('key1');
    });

    it('no lanza si localStorage.removeItem lanza', () => {
      (localStorage.removeItem as any).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      expect(() => safeStorage.remove('key1')).not.toThrow();
    });
  });
});

describe('SafeStorage — localStorage NO disponible (modo privado / cuota / política)', () => {
  let safeStorage: typeof import('../js/core/safeStorage').default;

  beforeEach(async () => {
    vi.resetModules();
    // Forzamos que la sonda de disponibilidad falle: el constructor de
    // SafeStorage llama setItem('__safe_storage_probe__', '1') y si
    // lanza, this.available queda en false para toda la vida del singleton.
    (localStorage.setItem as any).mockImplementationOnce(() => {
      throw new Error('SecurityError: localStorage deshabilitado');
    });
    safeStorage = (await import('../js/core/safeStorage')).default;
  });

  it('isAvailable() devuelve false', () => {
    expect(safeStorage.isAvailable()).toBe(false);
  });

  it('getJSON devuelve el fallback sin siquiera intentar leer localStorage', () => {
    const fallback = { x: 1 };
    const result = safeStorage.getJSON('key1', fallback);
    expect(result).toBe(fallback);
  });

  it('setJSON devuelve false sin intentar escribir', () => {
    expect(safeStorage.setJSON('key1', { a: 1 })).toBe(false);
  });

  it('getString devuelve el fallback', () => {
    expect(safeStorage.getString('key1', 'fallback')).toBe('fallback');
  });

  it('setString devuelve false', () => {
    expect(safeStorage.setString('key1', 'x')).toBe(false);
  });

  it('getNumber devuelve el fallback', () => {
    expect(safeStorage.getNumber('key1', 42)).toBe(42);
  });

  it('setNumber devuelve false', () => {
    expect(safeStorage.setNumber('key1', 42)).toBe(false);
  });

  it('remove() es un no-op seguro', () => {
    expect(() => safeStorage.remove('key1')).not.toThrow();
  });

  it('registra el problema de disponibilidad en ErrorLogger al construirse', async () => {
    const { default: ErrorLogger } = await import('../js/core/errorLogger');
    const recent = ErrorLogger.recent();
    const entry = recent.find(e => e.context === 'SafeStorage.constructor');
    expect(entry).toBeDefined();
    expect(entry?.message).toContain('localStorage no está disponible');
  });
});

describe('SafeStorage — comportamiento de tipos entre setJSON y getJSON', () => {
  let safeStorage: typeof import('../js/core/safeStorage').default;

  beforeEach(async () => {
    vi.resetModules();
    safeStorage = (await import('../js/core/safeStorage')).default;
  });

  it('round-trip real: lo que setJSON guarda es lo que getJSON reconstruye', () => {
    const store = new Map<string, string>();
    (localStorage.setItem as any).mockImplementation((k: string, v: string) => store.set(k, v));
    (localStorage.getItem as any).mockImplementation((k: string) => store.get(k) ?? null);

    const value = { player: 'ana', scores: [10, 20, 30], won: true };
    safeStorage.setJSON('game-state', value);
    const restored = safeStorage.getJSON('game-state', null);

    expect(restored).toEqual(value);
  });

  it('round-trip real de setNumber/getNumber a través de la misma capa de string', () => {
    const store = new Map<string, string>();
    (localStorage.setItem as any).mockImplementation((k: string, v: string) => store.set(k, v));
    (localStorage.getItem as any).mockImplementation((k: string) => store.get(k) ?? null);

    safeStorage.setNumber('highscore', 12345);
    expect(safeStorage.getNumber('highscore', 0)).toBe(12345);
  });
});
