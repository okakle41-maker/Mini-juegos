import { test, expect, type Page } from '@playwright/test';

/**
 * e2e/games.spec.ts
 *
 * Cobertura e2e de los juegos individuales — hasta ahora e2e/lobby.spec.ts
 * solo probaba el lobby (listar, filtrar, buscar, navegar UNA vez a la
 * primera card) y ningún test e2e abría el resto de los juegos. A nivel
 * unitario (test/*.test.ts con Vitest) sí hay bastante cobertura dispersa
 * por juego, pero eso corre sin navegador real y sin el DOM/CSS real de
 * cada vista — no detecta, por ejemplo, que una vista quede en blanco por
 * un error de runtime que Vitest no ve porque nunca ejecuta ese código en
 * un browser de verdad.
 *
 * Enfoque: en vez de escribir un test a mano por cada uno de los ~16
 * juegos/cards visibles en el lobby (ver comentario sobre el conteo en
 * lobby.spec.ts), se recorren TODAS las cards reales del lobby — salvo
 * las cards "hub" (classics-hub, skillchecks: ver exclusión más abajo)
 * — y para cada una se verifica que:
 *   1. Navegar a esa vista no deja la página en blanco / vista oculta.
 *   2. No se dispara ningún error de consola ni un `pageerror` (excepción
 *      no capturada) al cargar el juego.
 *
 * Esto da cobertura real de "el juego carga sin explotar" para todos los
 * juegos de una sola pasada, sin acoplar el test a la mecánica interna de
 * cada uno (que sí varía mucho: turnos, multiplayer, timers, canvas...).
 * Jugar una partida completa de cada juego queda fuera de alcance de este
 * archivo a propósito — eso ya lo cubren los tests unitarios por juego en
 * test/*.test.ts cuando existen, y agregarlo acá para los 19 juegos
 * infla el tiempo de la suite mucho más de lo que suma en señal.
 *
 * Juegos explícitamente excluidos de este recorrido genérico:
 *   - Los que requieren un segundo jugador para arrancar de verdad
 *     (multiplayer 1v1/coop vía lobbySystem: simon, arrowGame, termita,
 *     letters, y los de 4 jugadores fijos: signalTriangulation,
 *     shipControl, fragmentedLabyrinth). Sin rival, algunos de estos
 *     juegos legítimamente muestran una pantalla de configuración/espera
 *     en vez de arrancar — no es un bug, pero tampoco es "el juego cargó
 *     y corre", así que un check genérico de pageerror ya alcanza para
 *     ellos y no hace falta excluirlos del recorrido, solo no asumir más
 *     que eso. Se dejan dentro del loop igual: la señal que buscamos acá
 *     (no revienta al cargar) sigue aplicando aunque no lleguen a jugarse.
 *   - Las cards "hub" (classics-hub, skillchecks — ver
 *     js/games/classicsHub.ts, js/games/Skillcheck.ts): a diferencia de
 *     cualquier otra card, clickearlas NO navega a ninguna vista propia
 *     — abren un popover flotante (GameGroupMenu, ver
 *     js/utils/gameGroupMenuController.tsx) con los juegos que agrupan.
 *     El check genérico de este archivo ("¿#{gameId} quedó visible tras
 *     el click?") no aplica para ellas: no existe ningún <section
 *     id="classics-hub">/<section id="skillchecks">, así que fallarían
 *     siempre aunque el popover funcione perfecto. Ese flujo ya tiene su
 *     propia cobertura e2e dedicada en lobby.spec.ts ('classics-hub card
 *     opens...' / 'skillchecks card opens...').
 */

/** ids de cards "hub" que no navegan a una vista propia — ver nota de
 *  exclusión arriba. Único punto de verdad para el filtro de abajo. */
const HUB_CARD_IDS = new Set(['classics-hub', 'skillchecks']);

async function collectRuntimeErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

test.describe('Juegos individuales - carga sin errores', () => {
  test('cada juego del lobby navega a su vista sin quedar oculto ni tirar errores', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#gameList', { timeout: 30000 });

    const gameIds = await page.locator('.game-card').evaluateAll((cards) =>
      cards
        .map((c) => c.getAttribute('data-game-id'))
        .filter((id): id is string => !!id)
    );

    // Sanity check: si esto es 0 o muy bajo, algo rompió el render del
    // lobby antes de siquiera llegar a probar los juegos — falla temprano
    // con un mensaje claro en vez de que el loop de abajo silenciosamente
    // no itere nada.
    expect(gameIds.length).toBeGreaterThanOrEqual(16);

    const failures: string[] = [];

    for (const gameId of gameIds) {
      if (HUB_CARD_IDS.has(gameId)) continue; // ver nota de exclusión arriba

      const errors = await collectRuntimeErrors(page);

      await page.goto('/');
      await page.waitForSelector('#gameList', { timeout: 30000 });

      const card = page.locator(`.game-card[data-game-id="${gameId}"]`);
      await card.click();
      await page.waitForTimeout(500);

      const gameView = page.locator(`#${gameId}`);
      const isVisible = await gameView.isVisible().catch(() => false);
      const hasHiddenClass = await gameView
        .evaluate((el) => el.classList.contains('hidden'))
        .catch(() => true);

      if (!isVisible || hasHiddenClass) {
        failures.push(`${gameId}: vista no visible tras el click (isVisible=${isVisible}, hidden=${hasHiddenClass})`);
      }

      if (errors.length > 0) {
        failures.push(`${gameId}: ${errors.length} error(es) — ${errors.slice(0, 3).join(' | ')}`);
      }

      page.removeAllListeners('pageerror');
      page.removeAllListeners('console');
    }

    expect(failures, `Juegos con problemas:\n${failures.join('\n')}`).toEqual([]);
  });
});
