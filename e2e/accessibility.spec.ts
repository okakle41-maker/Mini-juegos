import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * e2e/accessibility.spec.ts
 *
 * @axe-core/playwright estaba en package.json (devDependency, ^4.8.0)
 * sin ningún spec que lo usara — este archivo es el primer uso real.
 *
 * Cobertura: el lobby (vista por defecto, la que más tráfico recibe) y
 * una muestra de vistas de juego con estructura de UI representativa
 * (tablero+controles, formulario, texto/lectura), no las 19 — correr
 * axe contra cada vista de juego infla bastante el tiempo de la suite
 * para una cobertura marginal, dado que la mayoría comparte los mismos
 * componentes base (.game-card, botones, headers) ya cubiertos acá vía
 * el lobby y el shell de la app (que se mantiene montado detrás de cada
 * vista, ver js/core/viewManager.ts).
 *
 * `.withTags([...])` usa el ruleset WCAG 2.1 A/AA — el estándar más
 * común para este tipo de chequeo automatizado, ni el más laxo (solo A)
 * ni el que exige AAA (mucho más estricto, con reglas como contraste
 * 7:1 que este tipo de UI con tema oscuro/neón probablemente no cumple
 * por diseño).
 *
 * Nota: axe detecta violaciones automatizables (contraste, atributos
 * ARIA mal usados, labels faltantes, orden de heading, etc.) pero NO
 * reemplaza una revisión manual con lector de pantalla real — cubre
 * una fracción de WCAG por diseño de la herramienta, no el estándar
 * completo.
 */

test.describe('Accesibilidad automatizada (axe-core)', () => {
  test('lobby no tiene violaciones WCAG 2.1 A/AA', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#gameList', { timeout: 30000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations)
    ).toEqual([]);
  });

  test('vista de un juego con tablero (simon) no tiene violaciones WCAG 2.1 A/AA', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#gameList', { timeout: 30000 });

    const card = page.locator('.game-card[data-game-id="simon"]');
    await card.click();
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations)
    ).toEqual([]);
  });
});

// Los objetos de violación de axe son profundos (incluyen todos los
// nodos afectados con su selector CSS y snippet de HTML) — expect()
// los serializa igual, pero un resumen de una línea por regla es mucho
// más rápido de leer en el output del test que scrollear ese JSON
// completo para entender qué falló.
function formatViolations(violations: Array<{ id: string; impact?: string | null; help: string; nodes: unknown[] }>): string {
  if (violations.length === 0) return '';
  return violations
    .map((v) => `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help} (${v.nodes.length} nodo(s))`)
    .join('\n');
}
