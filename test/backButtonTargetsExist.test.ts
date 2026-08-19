import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { viewTemplates } from '../js/core/viewTemplates';

/**
 * test/backButtonTargetsExist.test.ts
 *
 * Regresión directa del bug reportado tras migrar Skill Check (ver
 * js/games/Skillcheck.ts, js/utils/gameGroupMenuController.tsx): las
 * 15 vistas agrupadas bajo "Skill Check" tenían su botón "Volver"
 * (`<button class="back-btn" data-back-to="skillchecks">`) apuntando
 * a la vieja grilla de "cubos" (js/views/skillchecks.ts). Al migrar la
 * navegación al menú flotante y eliminar esa vista/su <section> de
 * index.html, `data-back-to="skillchecks"` quedó apuntando a un id
 * inexistente: ViewManager.backToMenu('skillchecks') ->
 * showView('skillchecks') -> document.getElementById('skillchecks')
 * -> null -> falla silenciosamente (loguea un error, no navega a
 * ningún lado) — el síntoma reportado como "el botón volver no
 * funciona".
 *
 * Se corrigieron las 15 vistas a data-back-to="home", pero el bug de
 * fondo (un `data-back-to` que deja de tener destino válido) puede
 * repetirse con cualquier otra vista en el futuro — este test evita
 * que vuelva a pasar desapercibido: extrae CADA data-back-to real de
 * CADA template registrado y confirma que su target existe como
 * sección navegable real en index.html (estática o data-lazy), sin
 * mantener a mano una lista de "targets válidos conocidos" que
 * quedaría desactualizada tan pronto se agregue o quite una vista.
 */
describe('back-btn: todo data-back-to apunta a una vista que existe de verdad', () => {
  const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');

  /** ids de TODAS las <section id="..."> reales de index.html —
   *  estáticas (home, multiplayer, online-lobby, etc.) y data-lazy
   *  (el esqueleto vacío que ViewManager llena on-demand). Cualquier
   *  id que exista acá es un destino de navegación válido. */
  function realSectionIds(): Set<string> {
    const ids = new Set<string>();
    const re = /<section\s+id="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(indexHtml))) ids.add(m[1]);
    return ids;
  }

  it('index.html tiene secciones reales para chequear (sanity check del propio test)', () => {
    expect(realSectionIds().size).toBeGreaterThan(10);
  });

  it.each(Object.keys(viewTemplates))('%s: cada data-back-to de su template apunta a una <section id> real', async (id) => {
    const mod = await viewTemplates[id]();
    const html = mod.default();
    const sectionIds = realSectionIds();

    const backToRe = /data-back-to="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = backToRe.exec(html))) {
      const target = m[1];
      expect(
        sectionIds.has(target),
        `data-back-to="${target}" en la vista "${id}" no tiene ninguna <section id="${target}"> real en index.html — el botón "Volver" navegaría a nada.`
      ).toBe(true);
    }
  });

  it('las 15 vistas migradas de Skill Check vuelven a "home" (ver SKILLCHECKS_HUB_GAME_IDS)', async () => {
    const { SKILLCHECKS_HUB_GAME_IDS } = await import('../js/games/Skillcheck');

    for (const gameId of SKILLCHECKS_HUB_GAME_IDS) {
      const loader = viewTemplates[gameId];
      expect(loader, `No hay entrada en viewTemplates para "${gameId}"`).toBeDefined();

      const mod = await loader();
      const html = mod.default();
      expect(
        html.includes('data-back-to="home"'),
        `La vista "${gameId}" (agrupada bajo Skill Check) no tiene data-back-to="home" — sigue apuntando a la vieja grilla eliminada o a otro destino inesperado.`
      ).toBe(true);
    }
  });
});
