import { describe, expect, it } from 'vitest';
import { categorySlug } from '../js/utils/categorySlug';

describe('categorySlug', () => {
  it('convierte a minúsculas y remueve acentos (casos base)', () => {
    expect(categorySlug('PERCEPCIÓN')).toBe('percepcion');
    expect(categorySlug('ANÁLISIS')).toBe('analisis');
  });

  it('reemplaza espacios por guiones', () => {
    expect(categorySlug('Puzzle Espacial')).toBe('puzzle-espacial');
  });

  it('colapsa espacios múltiples en un solo guion', () => {
    expect(categorySlug('Puzzle    Espacial')).toBe('puzzle-espacial');
  });

  it('reemplaza símbolos/puntuación por guiones', () => {
    expect(categorySlug('Rápido & Furioso!')).toBe('rapido-furioso');
  });

  it('colapsa una secuencia de símbolos consecutivos en un único guion', () => {
    expect(categorySlug('A---B')).toBe('a-b');
    expect(categorySlug('A!!!B')).toBe('a-b');
  });

  it('remueve guiones al inicio y al final del resultado', () => {
    expect(categorySlug('¡Acción!')).toBe('accion');
    expect(categorySlug('-ya con guion-')).toBe('ya-con-guion');
  });

  it('preserva dígitos', () => {
    expect(categorySlug('Nivel 2')).toBe('nivel-2');
    expect(categorySlug('Top10')).toBe('top10');
  });

  it('devuelve string vacío para un input vacío', () => {
    expect(categorySlug('')).toBe('');
  });

  it('devuelve string vacío si el input es solo símbolos/espacios', () => {
    expect(categorySlug('!!!   ###')).toBe('');
  });

  it('maneja acentos en varias vocales dentro de la misma palabra', () => {
    expect(categorySlug('Ágil Rápidísimo')).toBe('agil-rapidisimo');
  });

  it('normaliza la Ñ a "n": bajo NFD se descompone en N + tilde combinante, que el regex de diacríticos remueve', () => {
    expect(categorySlug('Añejo')).toBe('anejo');
  });

  it('ya en minúsculas y sin símbolos, se mantiene igual', () => {
    expect(categorySlug('reflejos')).toBe('reflejos');
  });

  it('es determinístico: misma entrada, mismo resultado', () => {
    expect(categorySlug('Lógica Difusa')).toBe(categorySlug('Lógica Difusa'));
  });
});
