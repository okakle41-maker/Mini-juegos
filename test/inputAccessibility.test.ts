import { describe, expect, it } from 'vitest';
import { viewTemplates } from '../js/core/viewTemplates';

/**
 * test/inputAccessibility.test.ts
 *
 * Motivación: una auditoría manual encontró 52 <input> en js/views/*.ts,
 * de los cuales la mayoría ya tenía una etiqueta accesible real (label
 * envolvente, label[for], aria-label o aria-labelledby), pero un puñado
 * no tenía ninguna asociación programática:
 *
 *   - progresstiming.ts: los sliders de "Velocidad" y "Tamaño de la zona"
 *     mostraban el texto en un <span> visual al lado, sin aria-label ni
 *     aria-labelledby conectándolo al <input type="range">.
 *   - rapidlines-game.ts: 5 <label> (Velocidad inicial, Aceleración,
 *     Velocidad máxima, Flechas, Tiempo) estaban visualmente al lado de
 *     su <input> pero sin el atributo `for` que los asocia de verdad —
 *     un lector de pantalla no tiene forma de saber qué input describe
 *     cada label suelto.
 *
 * Ambos casos se corrigieron. Este test generaliza la verificación para
 * que una regresión futura (o un juego nuevo con el mismo problema) se
 * detecte automáticamente en vez de requerir otra auditoría manual.
 *
 * Se apoya en jsdom (ya usado por todo el resto de la suite, ver
 * vitest.config.ts) para parsear el HTML real de cada vista y recorrer
 * el DOM en vez de usar regex sobre texto — así el patrón
 * `<label>Texto: <input></label>` (válido, el label envuelve el input)
 * no genera falsos positivos como haría un regex ingenuo.
 */

function hasAccessibleName(input: HTMLElement, doc: Document): boolean {
  // 1. aria-label directo.
  if (input.getAttribute('aria-label')?.trim()) return true;

  // 2. aria-labelledby apuntando a un id que realmente existe en el
  // documento (un aria-labelledby colgando de un id inexistente no le
  // sirve a ningún lector de pantalla, así que no cuenta).
  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    if (ids.length > 0 && ids.every((id) => doc.getElementById(id))) return true;
  }

  // 3. <label for="inputId"> en cualquier parte del documento.
  if (input.id) {
    const labelFor = Array.from(doc.querySelectorAll('label[for]')).find(
      (label) => label.getAttribute('for') === input.id
    );
    if (labelFor?.textContent?.trim()) return true;
  }

  // 4. <label> envolvente (el patrón <label>Texto <input></label>).
  const wrappingLabel = input.closest('label');
  if (wrappingLabel?.textContent?.trim()) return true;

  return false;
}

describe('Accesibilidad: todo <input>/<select>/<textarea> tiene una etiqueta accesible real', () => {
  const viewIds = Object.keys(viewTemplates);

  it.each(viewIds)('%s: cada <input> tiene aria-label, aria-labelledby válido, label[for] o label envolvente', async (viewId) => {
    const mod = await viewTemplates[viewId]();
    const html = mod.default();

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
    // No solo <input>: <select> y <textarea> tienen exactamente el mismo
    // requisito de accesibilidad (label/aria-label/aria-labelledby) y el
    // mismo riesgo de quedar sin asociar. hasAccessibleName() ya es
    // genérica para cualquier control de formulario.
    const inputs = Array.from(doc.querySelectorAll<HTMLElement>('input, select, textarea'));
    if (inputs.length === 0) return;

    const unlabeled = inputs.filter((input) => !hasAccessibleName(input, doc));

    const describe = (input: HTMLElement) => {
      const attrs = ['data-ui', 'id', 'type', 'name']
        .map((a) => (input.getAttribute(a) ? `${a}="${input.getAttribute(a)}"` : null))
        .filter(Boolean)
        .join(' ');
      return `<input ${attrs}>`;
    };

    expect(
      unlabeled.map(describe),
      `${viewId}: ${unlabeled.length} <input> sin etiqueta accesible: ${unlabeled.map(describe).join(', ')}`
    ).toEqual([]);
  });
});

/**
 * Segunda pasada: <button> sin texto visible ni aria-label. El caso real
 * encontrado fue `.back-btn[data-back-to]` — presente en las ~32 vistas,
 * sin texto en el HTML estático que genera cada views/*.ts (el ícono y
 * la etiqueta se inyectan recién en runtime, ver
 * js/utils/backButton.ts:hydrateBackButtons()). Sin simular esa
 * hidratación acá, el test daría falso positivo en los 32 casos aunque
 * en la app real ya estén bien etiquetados — por eso se llama a la
 * función real de hidratación contra el DOM parseado, en vez de asumir
 * cualquier cosa sobre lo que hace.
 */
function hasAccessibleButtonName(button: HTMLElement): boolean {
  if (button.getAttribute('aria-label')?.trim()) return true;
  if (button.textContent?.trim()) return true;
  return false;
}

// reactor.ts declara 5 <button class="rx-type-btn" data-ui-all="typeButtons">
// vacíos a propósito: reactor.logic.ts los rellena con
// `btn.innerHTML = '<span class="rx-type-dot">...<strong>{label}</strong>...'`
// recién en init() (ver reactor.logic.ts, sección "Pintar botones de tipo
// de reactor"), el mismo patrón que hydrateBackButtons() para .back-btn
// pero sin una función standalone reusable — está integrado a la lógica
// completa del juego (que además engancha selección, aria-pressed, y
// listeners de click), así que no vale la pena extraer/importar esa
// lógica completa solo para este test. Se documenta como excepción
// conocida en vez de silenciarla sin explicación: si en el futuro
// aparece OTRO botón vacío en reactor.ts que no sea uno de estos 5, el
// test lo va a seguir detectando igual (el filtro es por selector
// exacto, no "cualquier botón de reactor.ts").
const KNOWN_HYDRATED_ELSEWHERE = new Set([
  'reactor::rx-type-btn',
]);

function isKnownHydratedElsewhere(viewId: string, button: HTMLElement): boolean {
  if (!button.classList.contains('rx-type-btn')) return false;
  return KNOWN_HYDRATED_ELSEWHERE.has(`${viewId}::rx-type-btn`);
}

describe('Accesibilidad: todo <button> tiene un nombre accesible tras la hidratación real', () => {
  const viewIds = Object.keys(viewTemplates);

  it.each(viewIds)('%s: cada <button> tiene texto visible o aria-label después de hydrateBackButtons()', async (viewId) => {
    const { hydrateBackButtons } = await import('../js/utils/backButton');

    const mod = await viewTemplates[viewId]();
    const html = mod.default();

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');

    // hydrateBackButtons() necesita window.backToMenu para el listener
    // de click (no se ejecuta en este test, solo se registra), y opera
    // sobre un ParentNode real — se le pasa el documento parseado.
    (globalThis as { window: typeof window }).window ??= globalThis as unknown as typeof window;
    if (typeof window.backToMenu !== 'function') {
      window.backToMenu = () => {};
    }
    hydrateBackButtons(doc);

    const buttons = Array.from(doc.querySelectorAll('button'));
    if (buttons.length === 0) return;

    const unlabeled = buttons.filter(
      (button) => !hasAccessibleButtonName(button) && !isKnownHydratedElsewhere(viewId, button)
    );

    const describeButton = (button: HTMLElement) => {
      const attrs = ['data-ui', 'id', 'class', 'data-back-to']
        .map((a) => (button.getAttribute(a) ? `${a}="${button.getAttribute(a)}"` : null))
        .filter(Boolean)
        .join(' ');
      return `<button ${attrs}>`;
    };

    expect(
      unlabeled.map(describeButton),
      `${viewId}: ${unlabeled.length} <button> sin nombre accesible tras hidratación: ${unlabeled.map(describeButton).join(', ')}`
    ).toEqual([]);
  });
});
