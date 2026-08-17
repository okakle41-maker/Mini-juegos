import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameHelpers from '../js/utils/gameHelpers';

describe('GameHelpers.clamp', () => {
  it('devuelve v sin cambios si está dentro del rango', () => {
    expect(GameHelpers.clamp(5, 0, 10)).toBe(5);
  });

  it('devuelve min si v está por debajo', () => {
    expect(GameHelpers.clamp(-5, 0, 10)).toBe(0);
  });

  it('devuelve max si v está por encima', () => {
    expect(GameHelpers.clamp(15, 0, 10)).toBe(10);
  });

  it('funciona en los bordes exactos', () => {
    expect(GameHelpers.clamp(0, 0, 10)).toBe(0);
    expect(GameHelpers.clamp(10, 0, 10)).toBe(10);
  });

  it('funciona con rangos negativos', () => {
    expect(GameHelpers.clamp(-50, -10, -5)).toBe(-10);
    expect(GameHelpers.clamp(-1, -10, -5)).toBe(-5);
  });
});

describe('GameHelpers.readClampedInt', () => {
  it('devuelve fallback (0 por defecto) si el elemento es null', () => {
    expect(GameHelpers.readClampedInt(null)).toBe(0);
  });

  it('devuelve el fallback custom si el elemento es null', () => {
    expect(GameHelpers.readClampedInt(null, { fallback: 99 })).toBe(99);
  });

  it('parsea y devuelve el valor del input si es un número válido dentro de rango', () => {
    const input = document.createElement('input');
    input.value = '5';
    expect(GameHelpers.readClampedInt(input, { min: 0, max: 10 })).toBe(5);
  });

  it('clampea hacia arriba si el valor excede max', () => {
    const input = document.createElement('input');
    input.value = '999';
    expect(GameHelpers.readClampedInt(input, { min: 0, max: 10 })).toBe(10);
  });

  it('clampea hacia abajo si el valor es menor a min', () => {
    const input = document.createElement('input');
    input.value = '-999';
    expect(GameHelpers.readClampedInt(input, { min: 0, max: 10 })).toBe(0);
  });

  it('usa el fallback si el valor no es un número parseable', () => {
    const input = document.createElement('input');
    input.value = 'no-es-un-numero';
    expect(GameHelpers.readClampedInt(input, { fallback: 7 })).toBe(7);
  });

  it('parseInt trunca decimales y strings con sufijo no numérico', () => {
    const input = document.createElement('input');
    input.value = '5.9px';
    expect(GameHelpers.readClampedInt(input, { min: 0, max: 10 })).toBe(5);
  });

  it('sin min/max explícitos, usa -Infinity/Infinity (no clampea)', () => {
    const input = document.createElement('input');
    input.value = '1000000';
    expect(GameHelpers.readClampedInt(input)).toBe(1000000);
  });

  it('funciona igual con un <select>', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = '3';
    option.selected = true;
    select.appendChild(option);
    expect(GameHelpers.readClampedInt(select, { min: 0, max: 10 })).toBe(3);
  });
});

describe('GameHelpers.shakeElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no hace nada si el elemento es null', () => {
    expect(() => GameHelpers.shakeElement(null)).not.toThrow();
  });

  it('agrega la clase gh-shake al elemento', () => {
    const el = document.createElement('div');
    GameHelpers.shakeElement(el);
    expect(el.classList.contains('gh-shake')).toBe(true);
  });

  it('remueve la clase gh-shake previa antes de re-agregarla (para reiniciar la animación CSS)', () => {
    const el = document.createElement('div');
    el.classList.add('gh-shake');
    const removeSpy = vi.spyOn(el.classList, 'remove');
    const addSpy = vi.spyOn(el.classList, 'add');

    GameHelpers.shakeElement(el);

    // remove se llama antes que add para forzar el reflow/reinicio
    const removeOrder = removeSpy.mock.invocationCallOrder[0];
    const addOrder = addSpy.mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(addOrder);
  });

  it('remueve la clase gh-shake luego de la duración por defecto (350ms)', () => {
    const el = document.createElement('div');
    GameHelpers.shakeElement(el);
    expect(el.classList.contains('gh-shake')).toBe(true);

    vi.advanceTimersByTime(349);
    expect(el.classList.contains('gh-shake')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(el.classList.contains('gh-shake')).toBe(false);
  });

  it('respeta una duración custom', () => {
    const el = document.createElement('div');
    GameHelpers.shakeElement(el, 1000);

    vi.advanceTimersByTime(999);
    expect(el.classList.contains('gh-shake')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(el.classList.contains('gh-shake')).toBe(false);
  });
});

describe('GameHelpers.updateProgressBar', () => {
  it('calcula el porcentaje redondeado correctamente', () => {
    const percent = GameHelpers.updateProgressBar(null, 1, 3);
    expect(percent).toBe(33); // 33.33... redondea a 33
  });

  it('devuelve 0 si total es 0 (evita división por cero)', () => {
    expect(GameHelpers.updateProgressBar(null, 5, 0)).toBe(0);
  });

  it('devuelve 0 si total es negativo', () => {
    expect(GameHelpers.updateProgressBar(null, 5, -10)).toBe(0);
  });

  it('clampea el porcentaje a 100 si current > total', () => {
    expect(GameHelpers.updateProgressBar(null, 999, 10)).toBe(100);
  });

  it('clampea el porcentaje a 0 si current es negativo', () => {
    expect(GameHelpers.updateProgressBar(null, -5, 10)).toBe(0);
  });

  it('actualiza el width del elemento de la barra si se provee', () => {
    const bar = document.createElement('div');
    GameHelpers.updateProgressBar(bar, 5, 10);
    expect(bar.style.width).toBe('50%');
  });

  it('no falla si barEl es null', () => {
    expect(() => GameHelpers.updateProgressBar(null, 5, 10)).not.toThrow();
  });

  it('actualiza el label con el formato por defecto "current / total"', () => {
    const label = document.createElement('span');
    GameHelpers.updateProgressBar(null, 3, 10, label);
    expect(label.textContent).toBe('3 / 10');
  });

  it('usa labelFormat custom si se provee', () => {
    const label = document.createElement('span');
    const formatFn = (current: number, total: number) => `${current} de ${total} completados`;
    GameHelpers.updateProgressBar(null, 3, 10, label, formatFn);
    expect(label.textContent).toBe('3 de 10 completados');
  });

  it('no falla si labelEl es null/undefined', () => {
    expect(() => GameHelpers.updateProgressBar(null, 3, 10, null)).not.toThrow();
    expect(() => GameHelpers.updateProgressBar(null, 3, 10)).not.toThrow();
  });

  it('actualiza tanto la barra como el label en la misma llamada', () => {
    const bar = document.createElement('div');
    const label = document.createElement('span');
    const percent = GameHelpers.updateProgressBar(bar, 7, 10, label);

    expect(percent).toBe(70);
    expect(bar.style.width).toBe('70%');
    expect(label.textContent).toBe('7 / 10');
  });
});

describe('GameHelpers.shuffle', () => {
  it('devuelve un array de la misma longitud', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(GameHelpers.shuffle(arr)).toHaveLength(5);
  });

  it('contiene exactamente los mismos elementos (multiset)', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = GameHelpers.shuffle(arr);
    expect([...shuffled].sort()).toEqual([...arr].sort());
  });

  it('NO muta el array original (a diferencia de la implementación vieja en pairs.logic.ts)', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    GameHelpers.shuffle(arr);
    expect(arr).toEqual(original);
  });

  it('devuelve un array nuevo (no la misma referencia)', () => {
    const arr = [1, 2, 3];
    expect(GameHelpers.shuffle(arr)).not.toBe(arr);
  });

  it('maneja un array vacío sin fallar', () => {
    expect(GameHelpers.shuffle([])).toEqual([]);
  });

  it('maneja un array de un solo elemento sin fallar', () => {
    expect(GameHelpers.shuffle([42])).toEqual([42]);
  });

  it('con Math.random mockeado a 0, produce un orden determinístico verificable (no deja elementos en su posición original vía identidad)', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = GameHelpers.shuffle(arr);

    // Fisher-Yates con random()=0 siempre swapea con el índice 0:
    // resultado esperado analíticamente para este caso.
    expect(shuffled).toEqual([2, 3, 4, 5, 1]);
    randomSpy.mockRestore();
  });

  it('funciona con arrays de objetos, preservando las referencias', () => {
    const a = { id: 1 };
    const b = { id: 2 };
    const c = { id: 3 };
    const shuffled = GameHelpers.shuffle([a, b, c]);
    expect(shuffled).toContain(a);
    expect(shuffled).toContain(b);
    expect(shuffled).toContain(c);
  });
});

describe('GameHelpers.createCleanupManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addListener agrega el listener al target', () => {
    const manager = GameHelpers.createCleanupManager();
    const target = document.createElement('div');
    const handler = vi.fn();

    manager.addListener(target, 'click', handler);
    target.dispatchEvent(new Event('click'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('addListener no falla si target es null', () => {
    const manager = GameHelpers.createCleanupManager();
    expect(() => manager.addListener(null, 'click', vi.fn())).not.toThrow();
  });

  it('cleanup() remueve todos los listeners agregados (vía AbortController)', () => {
    const manager = GameHelpers.createCleanupManager();
    const target = document.createElement('div');
    const handler = vi.fn();

    manager.addListener(target, 'click', handler);
    manager.cleanup();
    target.dispatchEvent(new Event('click'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('addInterval programa un setInterval que se puede limpiar con cleanup()', () => {
    const manager = GameHelpers.createCleanupManager();
    const fn = vi.fn();

    manager.addInterval(fn, 100);
    vi.advanceTimersByTime(350);
    expect(fn).toHaveBeenCalledTimes(3);

    manager.cleanup();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(3); // no llamadas nuevas tras cleanup
  });

  it('addTimeout programa un setTimeout que se puede limpiar con cleanup()', () => {
    const manager = GameHelpers.createCleanupManager();
    const fn = vi.fn();

    manager.addTimeout(fn, 500);
    manager.cleanup();
    vi.advanceTimersByTime(1000);

    expect(fn).not.toHaveBeenCalled();
  });

  it('un timeout que ya se disparó no queda referenciado tras cleanup (se auto-remueve del Set)', () => {
    const manager = GameHelpers.createCleanupManager();
    const fn = vi.fn();

    manager.addTimeout(fn, 100);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    // cleanup posterior no debe volver a dispararlo ni fallar
    expect(() => manager.cleanup()).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('después de cleanup(), el manager sigue siendo usable (nuevo AbortController interno)', () => {
    const manager = GameHelpers.createCleanupManager();
    const target = document.createElement('div');
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    manager.addListener(target, 'click', handler1);
    manager.cleanup();

    manager.addListener(target, 'click', handler2);
    target.dispatchEvent(new Event('click'));

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('addInterval devuelve un id numérico distinto por cada llamada', () => {
    const manager = GameHelpers.createCleanupManager();
    const id1 = manager.addInterval(() => {}, 100);
    const id2 = manager.addInterval(() => {}, 200);
    expect(id1).not.toBe(id2);
    manager.cleanup();
  });

  it('cleanup() es seguro de llamar múltiples veces seguidas', () => {
    const manager = GameHelpers.createCleanupManager();
    manager.addTimeout(() => {}, 100);
    expect(() => {
      manager.cleanup();
      manager.cleanup();
    }).not.toThrow();
  });

  it('managers independientes no interfieren entre sí', () => {
    const managerA = GameHelpers.createCleanupManager();
    const managerB = GameHelpers.createCleanupManager();
    const fnA = vi.fn();
    const fnB = vi.fn();

    managerA.addTimeout(fnA, 100);
    managerB.addTimeout(fnB, 100);

    managerA.cleanup();
    vi.advanceTimersByTime(200);

    expect(fnA).not.toHaveBeenCalled();
    expect(fnB).toHaveBeenCalledTimes(1);
  });
});

describe('window.GameHelpers (compatibilidad legacy)', () => {
  it('expone la misma instancia en window.GameHelpers', () => {
    expect(window.GameHelpers).toBe(GameHelpers);
  });
});
