import { describe, expect, it, vi } from 'vitest';
import { withButtonBusy } from '../js/utils/buttonBusyGuard';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('withButtonBusy', () => {
  it('deshabilita el botón y setea aria-busy mientras la acción está en vuelo', async () => {
    const btn = document.createElement('button');
    const { promise, resolve } = deferred();
    const action = vi.fn(() => promise);

    const call = withButtonBusy(btn, action);

    // Todavía no resolvió: el botón debe estar en estado busy.
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');

    resolve();
    await call;
  });

  it('reactiva el botón y remueve aria-busy cuando la acción resuelve exitosamente', async () => {
    const btn = document.createElement('button');
    await withButtonBusy(btn, async () => {});

    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('aria-busy')).toBe(false);
  });

  it('reactiva el botón incluso si la acción rechaza (finally)', async () => {
    const btn = document.createElement('button');

    await expect(
      withButtonBusy(btn, async () => {
        throw new Error('falló la acción');
      })
    ).rejects.toThrow('falló la acción');

    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('aria-busy')).toBe(false);
  });

  it('propaga el error de la acción (no lo silencia)', async () => {
    const btn = document.createElement('button');
    const err = new Error('boom');

    await expect(
      withButtonBusy(btn, async () => {
        throw err;
      })
    ).rejects.toBe(err);
  });

  it('llama a la acción y espera su resolución si btn es null', async () => {
    const action = vi.fn(async () => {});
    await withButtonBusy(null, action);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('llama a la acción y espera su resolución si btn es undefined', async () => {
    const action = vi.fn(async () => {});
    await withButtonBusy(undefined, action);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('con btn null, sigue propagando errores de la acción', async () => {
    await expect(
      withButtonBusy(null, async () => {
        throw new Error('sin botón, pero igual falla');
      })
    ).rejects.toThrow('sin botón, pero igual falla');
  });

  it('es reentrante: si btn ya está disabled, corre la acción directo sin tocar aria-busy', async () => {
    const btn = document.createElement('button');
    btn.disabled = true; // simulando una llamada anterior todavía en vuelo

    const action = vi.fn(async () => {});
    await withButtonBusy(btn, action);

    expect(action).toHaveBeenCalledTimes(1);
    // no debe haber seteado aria-busy en este camino "reentrante"
    expect(btn.hasAttribute('aria-busy')).toBe(false);
    // y sigue disabled (no lo reactivó, porque no fue quien lo deshabilitó)
    expect(btn.disabled).toBe(true);
  });

  it('no modifica el texto/contenido del botón', async () => {
    const btn = document.createElement('button');
    btn.textContent = 'Crear partida';

    const { promise, resolve } = deferred();
    const call = withButtonBusy(btn, () => promise);

    expect(btn.textContent).toBe('Crear partida');
    resolve();
    await call;
    expect(btn.textContent).toBe('Crear partida');
  });

  it('espera efectivamente a que la acción resuelva antes de retornar (no es fire-and-forget)', async () => {
    const btn = document.createElement('button');
    let actionResolved = false;
    const { promise, resolve } = deferred();

    const call = withButtonBusy(btn, async () => {
      await promise;
      actionResolved = true;
    });

    expect(actionResolved).toBe(false);
    resolve();
    await call;
    expect(actionResolved).toBe(true);
  });

  it('llamadas secuenciales (no solapadas) sobre el mismo botón funcionan normalmente', async () => {
    const btn = document.createElement('button');

    await withButtonBusy(btn, async () => {});
    expect(btn.disabled).toBe(false);

    await withButtonBusy(btn, async () => {});
    expect(btn.disabled).toBe(false);
  });
});
