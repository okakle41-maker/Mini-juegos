import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ErrorLogger', () => {
  let ErrorLogger: typeof import('../js/core/errorLogger').default;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    ErrorLogger = (await import('../js/core/errorLogger')).default;
    ErrorLogger.clear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('registra un Error normal, capturando message y stack', () => {
    const err = new Error('algo se rompió');
    ErrorLogger.log('miContexto', err);

    const [entry] = ErrorLogger.recent();
    expect(entry.context).toBe('miContexto');
    expect(entry.message).toBe('algo se rompió');
    expect(entry.stack).toBe(err.stack);
    expect(entry.meta).toEqual({});
  });

  it('convierte un error que no es instancia de Error usando String()', () => {
    ErrorLogger.log('ctx', 'un string cualquiera');
    let entry = ErrorLogger.recent()[0];
    expect(entry.message).toBe('un string cualquiera');
    expect(entry.stack).toBeUndefined();

    ErrorLogger.clear();
    ErrorLogger.log('ctx', 42);
    entry = ErrorLogger.recent()[0];
    expect(entry.message).toBe('42');

    ErrorLogger.clear();
    ErrorLogger.log('ctx', null);
    entry = ErrorLogger.recent()[0];
    expect(entry.message).toBe('null');

    ErrorLogger.clear();
    ErrorLogger.log('ctx', undefined);
    entry = ErrorLogger.recent()[0];
    expect(entry.message).toBe('undefined');
  });

  it('guarda un timestamp ISO válido', () => {
    ErrorLogger.log('ctx', new Error('x'));
    const entry = ErrorLogger.recent()[0];
    expect(() => new Date(entry.timestamp).toISOString()).not.toThrow();
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('usa {} como meta por defecto si no se pasa', () => {
    ErrorLogger.log('ctx', new Error('x'));
    expect(ErrorLogger.recent()[0].meta).toEqual({});
  });

  it('guarda el meta pasado explícitamente', () => {
    ErrorLogger.log('ctx', new Error('x'), { userId: 42, action: 'save' });
    expect(ErrorLogger.recent()[0].meta).toEqual({ userId: 42, action: 'save' });
  });

  it('acumula múltiples entradas en orden cronológico', () => {
    ErrorLogger.log('ctx1', new Error('primero'));
    ErrorLogger.log('ctx2', new Error('segundo'));
    ErrorLogger.log('ctx3', new Error('tercero'));

    const entries = ErrorLogger.recent();
    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.context)).toEqual(['ctx1', 'ctx2', 'ctx3']);
  });

  it('recent() devuelve una copia — mutar el array devuelto no afecta el estado interno', () => {
    ErrorLogger.log('ctx', new Error('x'));
    const entries = ErrorLogger.recent();
    entries.push({ timestamp: 'fake', context: 'fake', message: 'fake' });

    expect(ErrorLogger.recent()).toHaveLength(1);
  });

  it('actúa como buffer circular: descarta la entrada más vieja al superar maxErrors (50)', () => {
    for (let i = 0; i < 55; i++) {
      ErrorLogger.log(`ctx${i}`, new Error(`error ${i}`));
    }

    const entries = ErrorLogger.recent();
    expect(entries).toHaveLength(50);
    // las primeras 5 (ctx0..ctx4) deben haberse descartado
    expect(entries[0].context).toBe('ctx5');
    expect(entries[entries.length - 1].context).toBe('ctx54');
  });

  it('clear() vacía el historial', () => {
    ErrorLogger.log('ctx', new Error('x'));
    ErrorLogger.log('ctx', new Error('y'));
    ErrorLogger.clear();

    expect(ErrorLogger.recent()).toEqual([]);
  });

  it('siempre loguea a console.error con contexto, error y meta', () => {
    const err = new Error('boom');
    ErrorLogger.log('miContexto', err, { extra: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[miContexto]', err, { extra: true });
  });

  it('sin sink configurado, log() no lanza y solo usa console.error', () => {
    expect(() => ErrorLogger.log('ctx', new Error('x'))).not.toThrow();
  });

  it('setSink() registra un sink que recibe cada entry logueada', () => {
    const sink = vi.fn();
    ErrorLogger.setSink(sink);

    const err = new Error('para el sink');
    ErrorLogger.log('ctx', err, { a: 1 });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'ctx', message: 'para el sink', meta: { a: 1 } })
    );
  });

  it('si el sink lanza una excepción, se captura y se reporta vía console.error sin interrumpir el logging', () => {
    const throwingSink = vi.fn(() => {
      throw new Error('sink roto');
    });
    ErrorLogger.setSink(throwingSink);

    expect(() => ErrorLogger.log('ctx', new Error('original'))).not.toThrow();

    // el error original se logueó igual
    expect(ErrorLogger.recent()).toHaveLength(1);
    expect(ErrorLogger.recent()[0].message).toBe('original');

    // y se reportó el fallo del sink por consola
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorLogger] Error en sink:',
      expect.any(Error)
    );
  });

  it('reemplazar el sink con setSink() descarta el anterior (solo se llama el nuevo)', () => {
    const oldSink = vi.fn();
    const newSink = vi.fn();

    ErrorLogger.setSink(oldSink);
    ErrorLogger.setSink(newSink);
    ErrorLogger.log('ctx', new Error('x'));

    expect(oldSink).not.toHaveBeenCalled();
    expect(newSink).toHaveBeenCalledTimes(1);
  });

  it('expone la instancia también en window.ErrorLogger (compatibilidad legacy)', () => {
    expect(window.ErrorLogger).toBe(ErrorLogger);
  });
});
