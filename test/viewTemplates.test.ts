import { describe, expect, it } from 'vitest';
import { viewTemplates } from '../js/core/viewTemplates';

/**
 * El tipo `ViewTemplate = () => string` (js/types/game.ts) ya obliga a que
 * cada módulo en js/views/*.ts exporte por default una función con esa
 * firma exacta — si alguien la cambia, `tsc` falla al compilar
 * viewTemplates.ts (probado manualmente: un default con firma distinta
 * revienta la asignación a `Record<string, ViewTemplateLoader>`).
 *
 * Lo que el tipo NO puede garantizar en tiempo de compilación es el
 * comportamiento en tiempo de ejecución del contrato descrito en el
 * comentario de ViewTemplate: "función pura y sin dependencias del DOM,
 * devuelve markup HTML estático no vacío". Este test cierra ese hueco:
 * importa cada template registrado y verifica en runtime que sigue el
 * contrato completo, no solo la firma de tipos.
 */
describe('Contrato ViewTemplate', () => {
  const ids = Object.keys(viewTemplates);

  it('el registro no está vacío', () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  it.each(ids)('%s: exporta un default() puro que devuelve HTML no vacío', async (id) => {
    const mod = await viewTemplates[id]();

    expect(typeof mod.default).toBe('function');

    // Longitud 0 = template invocable sin depender de argumentos, tal
    // como exige ViewTemplate = () => string.
    expect(mod.default.length).toBe(0);

    const html = mod.default();
    expect(typeof html).toBe('string');
    expect(html.trim().length).toBeGreaterThan(0);

    // Pureza básica: dos invocaciones seguidas deben producir el mismo
    // markup (nada de estado global mutable, Math.random(), Date.now(),
    // etc. filtrándose al template estático).
    expect(mod.default()).toBe(html);
  });
});
