import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { viewTemplates } from '../js/core/viewTemplates';

/**
 * test/dataUiIntegrity.test.ts
 *
 * Motivación: encontramos `arrowButtons` — una clave `data-ui` que
 * js/games/arrowGame.logic.ts leía (`ui.arrowButtons`, con guards
 * `if (arrowButtons)` en cada uso, así que nunca crasheaba) pero que
 * ninguna vista declaraba en su HTML. Resultado: una feature completa
 * (controles táctiles de flechas para pantallas sin teclado) nunca se
 * renderizaba, en silencio, sin ningún error ni test que lo detectara.
 *
 * Este test generaliza esa verificación a todos los juegos: para cada
 * `ui.<clave>` que aparece en el código fuente de un *.logic.ts, exige
 * que exista al menos un `data-ui="<clave>"` en el HTML que su vista
 * correspondiente produce. Así, si en el futuro alguien agrega un nuevo
 * `ui.algo` a la lógica de un juego y olvida agregar el `data-ui`
 * correspondiente a la vista (o viceversa, renombra uno de los dos),
 * el test falla en vez de quedar como código muerto silencioso.
 *
 * Nota: esto es un chequeo estático de texto (regex sobre el código
 * fuente), no de AST — evita falsos negativos con `if (ui.x)` pero no
 * distingue `ui.foo` real de un comentario que mencione `ui.foo`. Es
 * intencionalmente conservador: preferimos un false positive ocasional
 * (raro, dado que casi nadie escribe `ui.algo` en un comentario) a no
 * tener esta verificación en absoluto.
 */

const GAMES_DIR = join(__dirname, '..', 'js', 'games');
const VIEWS_DIR = join(__dirname, '..', 'js', 'views');

// Mapeo id de vista -> nombre de archivo .logic.ts, para los pocos casos
// donde no coinciden 1:1 (el id de GameRegistry difiere del nombre del
// archivo de lógica). Ver core/viewTemplates.ts y games/index.ts.
const VIEW_TO_LOGIC_FILE: Record<string, string> = {
  'arrow': 'arrowGame.logic.ts',
  'circle-game': 'circleGame.logic.ts',
  'bouncebar': 'bouncebarGame.logic.ts',
  'multipoint': 'multipointGame.logic.ts',
  'rapidlines-game': 'rapidlinesGame.logic.ts',
  'soup': 'hackingDevice.logic.ts',
  'letters': 'lettersFall.logic.ts',
  'sequence-game': 'sequence.logic.ts',
  'ring-puzzle': 'ringpuzzle.logic.ts',
  'skillchecks': 'skillchecksHub.logic.ts',
  'snippet-race': 'snippetRace.logic.ts',
  'signal_triangulation': 'signalTriangulation.logic.ts',
};

function findLogicFile(viewId: string): string | null {
  const mapped = VIEW_TO_LOGIC_FILE[viewId];
  if (mapped) return join(GAMES_DIR, mapped);

  const direct = join(GAMES_DIR, `${viewId}.logic.ts`);
  try {
    readFileSync(direct, 'utf-8');
    return direct;
  } catch {
    return null; // vista sin lógica pesada propia (p.ej. estadisticas, manual) — no aplica
  }
}

function extractUiKeysUsedInSource(source: string): Set<string> {
  const keys = new Set<string>();
  // ui.algo / this.ui.algo
  for (const m of source.matchAll(/\bui\.([a-zA-Z][a-zA-Z0-9_]*)/g)) {
    keys.add(m[1]);
  }
  // ui['algo']
  for (const m of source.matchAll(/\bui\[['"]([a-zA-Z][a-zA-Z0-9_]*)['"]\]/g)) {
    keys.add(m[1]);
  }
  return keys;
}

function extractDataUiKeysInHtml(html: string): Set<string> {
  const keys = new Set<string>();
  for (const m of html.matchAll(/data-ui="([a-zA-Z][a-zA-Z0-9_]*)"/g)) {
    keys.add(m[1]);
  }
  return keys;
}

// Claves que son propiedades legítimas de GameUi / patrones genéricos de
// JS que el regex `ui.algo` puede confundir con una clave data-ui real
// (p.ej. destructuring de otro objeto llamado `ui` en un contexto no
// relacionado con GameUi, o helpers de terceros). Mantener esta lista
// corta y justificar cada entrada si se agrega alguna.
const IGNORED_KEYS = new Set<string>([]);

describe('Integridad data-ui: toda clave que la lógica lee existe en la vista', () => {
  const viewIds = Object.keys(viewTemplates);

  it.each(viewIds)('%s: ui.<clave> usadas en su .logic.ts están declaradas en el HTML de la vista', async (viewId) => {
    const logicPath = findLogicFile(viewId);
    if (!logicPath) return; // sin lógica pesada propia, nada que verificar

    const source = readFileSync(logicPath, 'utf-8');
    const usedKeys = extractUiKeysUsedInSource(source);
    if (usedKeys.size === 0) return;

    const mod = await viewTemplates[viewId]();
    const html = mod.default();
    const declaredKeys = extractDataUiKeysInHtml(html);

    const missing = Array.from(usedKeys).filter(
      (key) => !declaredKeys.has(key) && !IGNORED_KEYS.has(key)
    );

    expect(
      missing,
      `${viewId}: ${logicPath} lee ui.${missing.join(', ui.')} pero la vista no declara data-ui="${missing.join('" ni "')}"`
    ).toEqual([]);
  });

  it('cobertura: todos los archivos .logic.ts de js/games tienen un viewId mapeado (directo o vía VIEW_TO_LOGIC_FILE)', () => {
    const logicFiles = readdirSync(GAMES_DIR).filter((f) => f.endsWith('.logic.ts'));
    const mappedFiles = new Set(Object.values(VIEW_TO_LOGIC_FILE));
    const directIds = new Set(Object.keys(viewTemplates));

    const unmapped = logicFiles.filter((file) => {
      if (mappedFiles.has(file)) return false;
      const implicitId = file.replace(/\.logic\.ts$/, '');
      return !directIds.has(implicitId);
    });

    expect(
      unmapped,
      `Archivos .logic.ts sin viewId asociado (agregar a VIEW_TO_LOGIC_FILE si el id no coincide con el nombre de archivo): ${unmapped.join(', ')}`
    ).toEqual([]);
  });
});
