import { describe, expect, it, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * test/buildStaticAssets.test.ts
 *
 * Motivación: `css/<juego>.css` y `assets/icons/*.svg` se referencian
 * desde JS como rutas string planas (`css` en GameConfig,
 * `renderCube()` en views/skillchecks.ts) en vez de `import './foo.css'`
 * — Vite nunca las veía como assets a procesar. Con `root: '.'`,
 * `npm run dev` las servía igual (expone todo el filesystem del
 * proyecto), así que el problema era invisible en desarrollo. En
 * `vite build`, sin embargo, ninguna de las dos carpetas sobrevivía a
 * `dist/`: un `<link>`/`<img>` a esas rutas en el sitio desplegado caía
 * en el fallback SPA de Vite y devolvía `index.html` (HTTP 200,
 * `Content-Type: text/html`) en vez de un 404 limpio — lo que hacía el
 * bug invisible incluso a una inspección rápida de status code sin
 * mirar el Content-Type real de la respuesta. Afectaba a 30 de los 34
 * juegos (los que declaran `css:` en su `GameConfig`) y al menú
 * completo de Skill Check (9 íconos SVG).
 *
 * Ningún otro test en la suite podía detectar esto: dataUiIntegrity y
 * viewTemplates verifican el código fuente, no el resultado de
 * `vite build`. Este test es deliberadamente distinto — ejecuta el
 * build real (más lento, ~5s) y audita el filesystem de salida, no el
 * código fuente. Se lo aísla en su propio archivo para que quede claro
 * en cualquier reporte de test cuál es el único que paga ese costo.
 */

const DIST = resolve(__dirname, '../dist-test-build-check');

describe('vite build copia css/ y assets/ a dist/ (regresión: activos estáticos referenciados por ruta plana)', () => {
  beforeAll(() => {
    // outDir separado del dist/ real para no pisar un build que el
    // desarrollador pueda tener abierto en `vite preview` en paralelo.
    execFileSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], {
      cwd: resolve(__dirname, '..'),
      stdio: 'pipe'
    });
  }, 30_000);

  it('copia todos los .css de css/ a dist/css/', () => {
    const srcCssDir = resolve(__dirname, '../css');
    const distCssDir = resolve(DIST, 'css');

    expect(existsSync(distCssDir)).toBe(true);

    const srcFiles = readdirSync(srcCssDir).filter((f) => f.endsWith('.css'));
    const distFiles = readdirSync(distCssDir).filter((f) => f.endsWith('.css'));

    // No comparamos cantidades exactas con un número fijo (se
    // desactualizaría con cada .css nuevo/eliminado, mismo motivo que el
    // fix del conteo de juegos en gameRegistry.test.ts): comparamos que
    // el set de nombres de archivo sea el mismo en origen y destino.
    expect(distFiles.sort()).toEqual(srcFiles.sort());
    expect(distFiles.length).toBeGreaterThan(0);
  });

  it('copia todos los .svg de assets/icons/ a dist/assets/icons/', () => {
    const srcIconsDir = resolve(__dirname, '../assets/icons');
    const distIconsDir = resolve(DIST, 'assets/icons');

    expect(existsSync(distIconsDir)).toBe(true);

    const srcFiles = readdirSync(srcIconsDir);
    const distFiles = readdirSync(distIconsDir);

    expect(distFiles.sort()).toEqual(srcFiles.sort());
    expect(distFiles.length).toBeGreaterThan(0);
  });

  it('cada GameConfig.css declarado en js/games/ apunta a un archivo que existe en dist/', () => {
    const gamesDir = resolve(__dirname, '../js/games');
    const cssDeclarations: string[] = [];

    // Barrido simple de texto (mismo enfoque que dataUiIntegrity.test.ts:
    // chequeo estático, no un parser de AST) sobre los .ts de nivel
    // superior en js/games/ (no los .logic.ts, que no declaran css:).
    for (const file of readdirSync(gamesDir)) {
      if (!file.endsWith('.ts') || file.endsWith('.logic.ts')) continue;
      const content = readFileSync(resolve(gamesDir, file), 'utf-8');
      const match = content.match(/css:\s*'([^']+)'/);
      if (match) cssDeclarations.push(match[1]);
    }

    expect(cssDeclarations.length).toBeGreaterThan(0);

    for (const cssPath of cssDeclarations) {
      const distPath = resolve(DIST, cssPath);
      expect(existsSync(distPath), `${cssPath} declarado en GameConfig pero no existe en dist/`).toBe(true);
    }
  });

  it('un archivo servido desde dist/css/ tiene contenido CSS real, no el fallback SPA de index.html', () => {
    // Cinturón y tirantes: existsSync ya lo prueba, pero el bug original
    // no era "el archivo no existe" en abstracto, era "algo con ese
    // nombre responde, pero es HTML" (ver preview() en el README). Este
    // test verifica el contenido, no solo la presencia del archivo.
    const anyCss = readdirSync(resolve(DIST, 'css')).find((f) => f.endsWith('.css'));
    const content = readFileSync(resolve(DIST, 'css', anyCss!), 'utf-8');

    expect(content).not.toMatch(/<!doctype html>/i);
    expect(content).not.toMatch(/<html/i);
  });

  // No usamos afterAll con rmSync porque si el test falla queremos que
  // dist-test-build-check/ quede en disco para inspección manual; se
  // limpia solo al iniciar la siguiente corrida (emptyOutDir arriba).
});
