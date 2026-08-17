import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onClickAsync, onClickAsyncVoid } from '../js/utils/asyncEventHandler';

describe('onClickAsync', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('devuelve una función síncrona (void), no una promesa', () => {
    const handler = vi.fn(async () => {});
    const wrapped = onClickAsync(handler);
    const event = new Event('click');

    const result = wrapped(event);

    expect(result).toBeUndefined();
  });

  it('invoca el handler original con el evento recibido', () => {
    const handler = vi.fn(async () => {});
    const wrapped = onClickAsync(handler);
    const event = new Event('click');

    wrapped(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('si el handler resuelve exitosamente, no loguea nada en consola', async () => {
    const handler = vi.fn(async () => {});
    const wrapped = onClickAsync(handler);

    wrapped(new Event('click'));
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });
    // esperamos un tick extra para dar chance a cualquier catch pendiente
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('si el handler rechaza, captura el error y lo loguea en consola en vez de dejarlo sin manejar', async () => {
    const err = new Error('falló el click');
    const handler = vi.fn(async () => {
      throw err;
    });
    const wrapped = onClickAsync(handler);

    // No debe lanzar de forma síncrona ni producir un rechazo no manejado.
    expect(() => wrapped(new Event('click'))).not.toThrow();

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[asyncEventHandler] Unhandled error en click handler:',
        err
      );
    });
  });

  it('cada invocación del wrapper crea un manejo de error independiente (un fallo no afecta llamadas futuras)', async () => {
    let callCount = 0;
    const handler = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('primer click falla');
    });
    const wrapped = onClickAsync(handler);

    wrapped(new Event('click'));
    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledTimes(1));

    wrapped(new Event('click'));
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
    await Promise.resolve();

    // el segundo click no volvió a fallar, así que no hay un segundo log
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('onClickAsyncVoid', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('devuelve una función síncrona (void)', () => {
    const handler = vi.fn(async () => {});
    const wrapped = onClickAsyncVoid(handler);

    const result = wrapped(new Event('click'));

    expect(result).toBeUndefined();
  });

  it('invoca el handler sin pasarle el evento (handler no toma argumentos)', () => {
    const handler = vi.fn(async () => {});
    const wrapped = onClickAsyncVoid(handler);

    wrapped(new Event('click'));

    expect(handler).toHaveBeenCalledWith();
  });

  it('si el handler resuelve, no loguea nada', async () => {
    const handler = vi.fn(async () => {});
    const wrapped = onClickAsyncVoid(handler);

    wrapped(new Event('click'));
    await vi.waitFor(() => expect(handler).toHaveBeenCalled());
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('si el handler rechaza, lo captura y loguea el error sin lanzar', async () => {
    const err = new Error('boom sin evento');
    const handler = vi.fn(async () => {
      throw err;
    });
    const wrapped = onClickAsyncVoid(handler);

    expect(() => wrapped(new Event('click'))).not.toThrow();

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[asyncEventHandler] Unhandled error en click handler:',
        err
      );
    });
  });

  it('es útil para envolver acciones que ya capturan su btn por closure (caso documentado: withButtonBusy)', async () => {
    const btn = document.createElement('button');
    const runAction = vi.fn(async () => {
      btn.disabled = true;
    });
    const wrapped = onClickAsyncVoid(() => runAction());

    wrapped(new Event('click'));

    await vi.waitFor(() => {
      expect(btn.disabled).toBe(true);
    });
  });
});
