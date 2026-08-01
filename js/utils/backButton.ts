/**
 * backButton.ts — Hidratación del botón "Volver" compartido
 *
 * Antes, cada una de las ~32 vistas repetía el mismo bloque de 3-4 líneas
 * (icono SVG + texto) para su botón de "volver". Ahora cada vista solo
 * declara el destino:
 *
 *   <button class="back-btn" data-back-to="home"></button>
 *   <button class="back-btn" data-back-to="skillchecks" data-back-label="Volver"></button>
 *
 * y `hydrateBackButtons()` rellena el icono y la etiqueta la primera vez
 * que ese fragmento de DOM aparece (vista inicial `home` en el bootstrap,
 * y cada vista lazy justo después de inyectar su HTML).
 */

const BACK_ICON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>';

const DEFAULT_LABELS: Record<string, string> = {
  home: 'Volver al lobby',
};
const FALLBACK_LABEL = 'Volver';

/**
 * Busca botones `.back-btn[data-back-to]` sin hidratar dentro de `root`,
 * les añade el icono + etiqueta, y conecta el click a `window.backToMenu`.
 *
 * Nota: se usa el global `window.backToMenu` en vez de
 * `import ViewManager from '../core/viewManager.js'` — a diferencia de
 * otros consumidores de ViewManager que sí migraron al import directo
 * (ver sideNavBoot.ts, ringpuzzle.logic.ts, etc.) — porque viewManager.ts
 * ya importa ESTE archivo (`hydrateBackButtons`, ver el import al tope de
 * viewManager.ts): un import en sentido contrario crearía un ciclo entre
 * ambos módulos. El ciclo sería técnicamente inofensivo (ninguno de los
 * dos lee el valor importado durante la inicialización del módulo, solo
 * dentro de funciones que corren después), pero no vale la complejidad
 * cuando el HTML ya usa este mismo global (`onclick="window.backToMenu()"`
 * en el back-btn no hidratado de viewManager.ts/virusOverload.ts) para
 * exactamente el mismo propósito — es el caso de uso legítimo para el
 * que window.backToMenu existe.
 */
export function hydrateBackButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>('.back-btn[data-back-to]:not([data-hydrated])').forEach((btn) => {
    const target = btn.dataset.backTo || 'home';
    const label = btn.dataset.backLabel || DEFAULT_LABELS[target] || FALLBACK_LABEL;

    btn.innerHTML = `${BACK_ICON_SVG}${label}`;
    btn.dataset.hydrated = 'true';
    // aria-label explícito aunque el texto ya quede visible en innerHTML:
    // el ícono SVG decorativo va sin alt/aria-hidden, así que sin esto
    // algunos lectores de pantalla anuncian "botón" a secas o leen el
    // contenido del SVG en vez del label. Redundante mirando el DOM final,
    // pero es la forma más simple de garantizar el anuncio correcto sin
    // tener que marcar el SVG con aria-hidden="true" en cada call site.
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => window.backToMenu(target));
  });
}
