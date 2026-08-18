import { test, expect } from '@playwright/test';

test.describe('Lobby - Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load lobby and display game cards', async ({ page }) => {
    // Esperar a que el lobby cargue. 30s (no 10s) para alinear con el
    // timeout por defecto del resto de la suite — en hardware real
    // (no el entorno headless liviano de CI), WebKit/Safari tardan
    // consistentemente más que Chromium en parsear y ejecutar el
    // bundle completo (~440KB entre bootstrap y el chunk vendor de
    // Supabase), sin que eso sea un bug de la app: 10s alcanzaba en
    // Chromium pero no daba margen suficiente en los otros motores.
    await page.waitForSelector('#gameList', { timeout: 30000 });

    // Verificar que hay tarjetas de juego. El lobby muestra 19 juegos
    // (27 archivos totales, menos ~13 configs con hidden:true de
    // sub-vistas de skillcheck, más algunos archivos que registran más
    // de un juego). Se usa >= 19 en vez de un valor mayor para no
    // acoplar el test al conteo exacto de módulos del proyecto (que
    // cambia con cada juego agregado/quitado), mientras sigue
    // detectando que el lobby casi no renderizó nada.
    const gameCards = page.locator('.game-card');
    const count = await gameCards.count();
    expect(count).toBeGreaterThanOrEqual(19);

    // Verificar que cada tarjeta tiene elementos esperados.
    // Nota: la clase real es "card-icon-lg" (ver buildCardHTML en
    // js/lobbyRenderer.ts), no "card-icon" — este test apuntaba a un
    // nombre de clase que no existe en el código actual.
    const firstCard = gameCards.first();
    await expect(firstCard.locator('.card-icon-lg')).toBeVisible();
    await expect(firstCard.locator('.card-name')).toBeVisible();

    // .card-desc está oculta por diseño hasta hover/focus (ver
    // .game-card:hover .card-desc en css/styles.css) — es un reveal
    // intencional, no un bug. Sin el hover acá, el locator siempre
    // resuelve pero queda "hidden" (opacity:0/max-height:0 en el
    // estado base), y el toBeVisible() de más abajo fallaría contra
    // el diseño real, no contra un defecto de la app.
    await firstCard.hover();
    await expect(firstCard.locator('.card-desc')).toBeVisible();
  });

  test('should filter games by category', async ({ page }) => {
    await page.waitForSelector('#gameList');

    // Click en filtro de categoría
    const firstFilter = page.locator('.filter-btn').first();
    await firstFilter.click();

    // Esperar que el filtro se active
    await expect(firstFilter).toHaveClass(/filter-btn--active/);

    // Verificar que se muestran juegos filtrados. Playwright no tiene
    // un matcher toHaveCountGreaterThan — el equivalente real es leer
    // el conteo y comparar con un matcher de número normal.
    //
    // Nota: el filtro/búsqueda oculta el `host` <div> que envuelve a
    // cada `.game-card` (ver applyVisibility() en lobbyRenderer.tsx),
    // no la propia `.game-card` — así el grid layoutea bien el hueco
    // colapsado. El selector `:not([style*="display: none"])` solo
    // mira el atributo `style` inline de `.game-card` en sí, que nunca
    // cambia, así que siempre "ve" las 20 cards sin importar el
    // filtro. `:visible` de Playwright evalúa el estilo COMPUTADO
    // (heredando display:none del padre oculto), que es lo que
    // realmente hay que verificar acá.
    const visibleCards = page.locator('.game-card:visible');
    const visibleCount = await visibleCards.count();
    expect(visibleCount).toBeGreaterThan(0);
  });

  test('should search games by name', async ({ page }) => {
    await page.waitForSelector('#lobbySearch');

    // Escribir en el buscador
    const searchInput = page.locator('#lobbySearch');
    await searchInput.fill('termita');

    // Esperar filtrado
    await page.waitForTimeout(200);

    // Verificar que solo se muestra el juego buscado. Ver nota de
    // arriba (test 'should filter games by category'): hay que usar
    // `:visible` (estilo computado), no mirar el atributo `style`
    // inline de `.game-card`, que vive en el `host` padre y nunca en
    // la card misma.
    const visibleCards = page.locator('.game-card:visible');
    await expect(visibleCards).toHaveCount(1);

    const cardName = visibleCards.locator('.card-name').first();
    await expect(cardName).toContainText('Termita');
  });

  test('should toggle favorite on game card', async ({ page }) => {
    await page.waitForSelector('#gameList');

    const firstCard = page.locator('.game-card').first();
    const favButton = firstCard.locator('.card-favorite-btn');

    // El estado de favorito no se refleja con una clase en el propio
    // botón (no existe "card-favorite-btn--active" en el código, ver
    // favoritesManager.ts → refreshCard()): se refleja con
    // aria-pressed="true"/"false" en el botón y con la clase
    // "game-card--favorite" en el <article> contenedor.
    await expect(favButton).toHaveAttribute('aria-pressed', 'false');

    // Click en favorito
    await favButton.click();

    // Verificar que cambia el estado
    await expect(favButton).toHaveAttribute('aria-pressed', 'true');
    await expect(firstCard).toHaveClass(/game-card--favorite/);

    // Click nuevamente para quitar favorito
    await favButton.click();

    // Verificar que vuelve al estado original
    await expect(favButton).toHaveAttribute('aria-pressed', 'false');
    await expect(firstCard).not.toHaveClass(/game-card--favorite/);
  });

  test('should navigate to game view on card click', async ({ page }) => {
    await page.waitForSelector('#gameList');

    const firstCard = page.locator('.game-card').first();
    // El id real de la vista destino es el mismo gameId que identifica
    // la card (data-game-id) — no una versión "slugificada" del
    // nombre visible. ViewManager.showView(gameId) hace
    // document.getElementById(gameId) y le quita la clase "hidden"
    // (ver js/core/viewManager.ts); no existe ningún atributo
    // data-view en el proyecto.
    const gameId = await firstCard.getAttribute('data-game-id');
    expect(gameId).toBeTruthy();

    // Click en la tarjeta
    await firstCard.click();

    // Esperar navegación a la vista del juego
    await page.waitForTimeout(500);

    // Verificar que la vista del juego es visible (perdió la clase
    // "hidden" que ViewManager aplica a todas las demás vistas)
    const gameView = page.locator(`#${gameId}`);
    await expect(gameView).toBeVisible();
    await expect(gameView).not.toHaveClass(/hidden/);
  });

  test('should use keyboard shortcut for search (Ctrl+K)', async ({ page }) => {
    await page.waitForSelector('#lobbySearch');

    // Presionar Ctrl+K
    await page.keyboard.press('Control+k');

    // Verificar que el input de búsqueda tiene foco
    const searchInput = page.locator('#lobbySearch');
    await expect(searchInput).toBeFocused();
  });

  test('should clear search with Escape key', async ({ page }) => {
    await page.waitForSelector('#lobbySearch');

    const searchInput = page.locator('#lobbySearch');
    await searchInput.fill('test');

    // Presionar Escape
    await page.keyboard.press('Escape');

    // Verificar que el input se limpió
    await expect(searchInput).toHaveValue('');

    // Verificar que todas las tarjetas vuelven a ser visibles. Mismo
    // criterio de umbral que en el primer test: 19 juegos reales,
    // no hardcodear un número mayor arbitrario. Ver nota sobre
    // `:visible` vs `[style*="display: none"]` en 'should filter
    // games by category' más arriba en este archivo.
    const visibleCards = page.locator('.game-card:visible');
    const visibleCount = await visibleCards.count();
    expect(visibleCount).toBeGreaterThanOrEqual(19);
  });
});
