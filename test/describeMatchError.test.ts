import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeMatchError } from '../js/utils/describeMatchError';

describe('describeMatchError', () => {
  let onLineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Por defecto asumimos "en línea"; cada test ajusta según necesite.
    onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => {
    onLineSpy.mockRestore();
  });

  it('devuelve el mensaje de sin conexión si navigator.onLine es false, sin importar el error', () => {
    onLineSpy.mockReturnValue(false);
    const result = describeMatchError(new Error('cualquier cosa'), 'No se pudo crear la partida.');
    expect(result).toBe('Parece que no tenés conexión a internet. Revisá tu wifi/datos y probá de nuevo.');
  });

  it('devuelve el mensaje de sin conexión incluso si onLine es false y no hay error en absoluto', () => {
    onLineSpy.mockReturnValue(false);
    const result = describeMatchError(undefined, 'No se pudo unir a la partida.');
    expect(result).toBe('Parece que no tenés conexión a internet. Revisá tu wifi/datos y probá de nuevo.');
  });

  it.each([
    'Failed to fetch',
    'FAILED TO FETCH',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'Network request failed',
    'The Internet connection appears to be offline.'
  ])('reconoce el mensaje de red crudo del navegador aunque onLine sea true: "%s"', (message) => {
    onLineSpy.mockReturnValue(true);
    const result = describeMatchError(new Error(message), 'No se pudo crear la partida.');
    expect(result).toBe('Parece que no tenés conexión a internet. Revisá tu wifi/datos y probá de nuevo.');
  });

  it('la detección de patrones de red es case-insensitive e insensible a texto alrededor', () => {
    const result = describeMatchError(
      new Error('TypeError: Failed To Fetch en el módulo X'),
      'fallback'
    );
    expect(result).toBe('Parece que no tenés conexión a internet. Revisá tu wifi/datos y probá de nuevo.');
  });

  it('pasa a través el mensaje de un Error de aplicación con mensaje propio (caso 2: mensaje ya accionable)', () => {
    const result = describeMatchError(new Error('Ese rol ya está ocupado'), 'No se pudo unir a la partida.');
    expect(result).toBe('Ese rol ya está ocupado');
  });

  it('pasa a través otro mensaje de aplicación típico sin modificarlo', () => {
    const result = describeMatchError(new Error('El lobby ya tiene 8 jugadores'), 'fallback');
    expect(result).toBe('El lobby ya tiene 8 jugadores');
  });

  it('usa el fallback (con sufijo de reintento) si error no es instancia de Error', () => {
    const result = describeMatchError('un string plano, no un Error', 'No se pudo crear la partida.');
    expect(result).toBe('No se pudo crear la partida. Puede ser un problema temporal del servidor — probá de nuevo en unos segundos.');
  });

  it('usa el fallback si error es null', () => {
    const result = describeMatchError(null, 'No se pudo crear la partida.');
    expect(result).toBe('No se pudo crear la partida. Puede ser un problema temporal del servidor — probá de nuevo en unos segundos.');
  });

  it('usa el fallback si error es undefined', () => {
    const result = describeMatchError(undefined, 'No se pudo crear la partida.');
    expect(result).toBe('No se pudo crear la partida. Puede ser un problema temporal del servidor — probá de nuevo en unos segundos.');
  });

  it('usa el fallback si error es un Error con message vacío (rawMessage falsy)', () => {
    const result = describeMatchError(new Error(''), 'No se pudo crear la partida.');
    expect(result).toBe('No se pudo crear la partida. Puede ser un problema temporal del servidor — probá de nuevo en unos segundos.');
  });

  it('usa el fallback si error es un objeto plano sin forma de Error', () => {
    const result = describeMatchError({ code: 500 }, 'No se pudo crear la partida.');
    expect(result).toBe('No se pudo crear la partida. Puede ser un problema temporal del servidor — probá de nuevo en unos segundos.');
  });

  it('cada llamador aporta su propio texto de fallback, y se preserva tal cual en el mensaje final', () => {
    const result = describeMatchError({}, 'No se pudo unir a la partida.');
    expect(result).toContain('No se pudo unir a la partida.');
  });

  it('un Error de red tiene prioridad sobre el hecho de que también sea un Error con mensaje propio', () => {
    // Verifica el orden real de las condiciones: si el mensaje matchea
    // un patrón de red, se devuelve el mensaje de conexión ANTES de
    // llegar a la rama que pasaría el mensaje de Error tal cual.
    const result = describeMatchError(new Error('Failed to fetch'), 'fallback');
    expect(result).not.toBe('Failed to fetch');
    expect(result).toBe('Parece que no tenés conexión a internet. Revisá tu wifi/datos y probá de nuevo.');
  });
});
