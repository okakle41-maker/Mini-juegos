import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, throttle, rafThrottle } from '../js/utils/debounceThrottle';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no ejecuta la función inmediatamente', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced();
    expect(fn).not.toHaveBeenCalled();
  });

  it('ejecuta la función una vez transcurrido el wait', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reinicia el temporizador con cada llamada, ejecutando solo una vez tras la última', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(200);
    debounced(); // reinicia el timer
    vi.advanceTimersByTime(200);
    debounced(); // reinicia de nuevo
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled(); // nunca pasaron 300ms sin una nueva llamada

    vi.advanceTimersByTime(100); // completa los 300ms desde la última llamada
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('pasa los argumentos de la última llamada a la función ejecutada', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('primero');
    debounced('segundo');
    debounced('tercero');

    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('tercero');
  });

  it('permite ejecuciones sucesivas si se espera el wait completo entre llamadas', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith('a');

    debounced('b');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith('b');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cada instancia debounced mantiene su propio timeout, independiente de otras', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const debounced1 = debounce(fn1, 100);
    const debounced2 = debounce(fn2, 300);

    debounced1();
    debounced2();

    vi.advanceTimersByTime(100);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ejecuta la función inmediatamente en la primera llamada', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignora llamadas subsiguientes dentro de la ventana de límite', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('permite una nueva ejecución una vez que pasa el límite', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(299);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1); // todavía dentro de la ventana

    vi.advanceTimersByTime(1);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('pasa los argumentos de la llamada que efectivamente ejecuta', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled('primero');
    throttled('ignorado-durante-throttle');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('primero');
  });

  it('las llamadas ignoradas durante la ventana no quedan "en cola" (a diferencia de debounce)', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled('a');
    throttled('b'); // ignorada, se pierde por completo
    vi.advanceTimersByTime(300);

    // Solo una ejecución total: la ventana simplemente se libera, no
    // dispara una ejecución diferida con el último valor ignorado.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('cada instancia throttled mantiene su propio estado de "inThrottle"', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const throttled1 = throttle(fn1, 300);
    const throttled2 = throttle(fn2, 300);

    throttled1();
    throttled1();
    throttled2();
    throttled2();

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

describe('rafThrottle', () => {
  let rafCallbacks: FrameRequestCallback[];
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let cafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafCallbacks = [];
    let nextId = 1;
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return nextId++;
    });
    cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  function flushRaf(time = 0) {
    const callbacks = rafCallbacks.splice(0, rafCallbacks.length);
    callbacks.forEach((cb) => cb(time));
  }

  it('no ejecuta la función sincrónicamente al llamar', () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);
    throttled();
    expect(fn).not.toHaveBeenCalled();
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('ejecuta la función cuando se dispara el frame', () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);
    throttled();
    flushRaf();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesce múltiples llamadas dentro del mismo frame en una sola ejecución con los últimos argumentos', () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);

    throttled('a');
    throttled('b');
    throttled('c');

    // solo se pidió un frame, no tres
    expect(rafSpy).toHaveBeenCalledTimes(1);

    flushRaf();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('permite una nueva ejecución en el siguiente frame tras resolverse el anterior', () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);

    throttled('a');
    flushRaf();
    expect(fn).toHaveBeenCalledTimes(1);

    throttled('b');
    expect(rafSpy).toHaveBeenCalledTimes(2);
    flushRaf();

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('cada instancia throttled mantiene su propio rafId/lastArgs', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const throttled1 = rafThrottle(fn1);
    const throttled2 = rafThrottle(fn2);

    throttled1('x');
    throttled2('y');

    expect(rafSpy).toHaveBeenCalledTimes(2);

    flushRaf();

    expect(fn1).toHaveBeenCalledWith('x');
    expect(fn2).toHaveBeenCalledWith('y');
  });
});
