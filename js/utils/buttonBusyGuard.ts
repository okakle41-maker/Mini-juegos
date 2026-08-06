/**
 * js/utils/buttonBusyGuard.ts
 *
 * Evita doble-submit en botones que disparan una acción async (crear
 * sala, unirse, etc.): deshabilita el botón mientras la promesa está
 * en vuelo y lo reactiva al terminar, sea cual sea el resultado.
 *
 * Antes, botones como "Crear partida" quedaban clickeables durante
 * todo el round-trip a Supabase — con conexión lenta, un segundo click
 * disparaba una segunda llamada en paralelo antes de que la primera
 * terminara. El guard del servidor (trigger
 * player_already_in_active_match/_fl_match, ver migration_011/020)
 * evita el peor caso (dos partidas activas del mismo jugador a la
 * vez), pero el segundo intento le mostraba al jugador un error crudo
 * de "ya tenés una partida activa" por algo que él no veía como dos
 * clicks distintos, solo como un click que no respondía.
 */

/**
 * Envuelve `action` para que, mientras se ejecuta, `btn` quede
 * deshabilitado (con `aria-busy` para lectores de pantalla). No
 * cambia el texto del botón — algunos ya tienen su propio ícono/label
 * que no conviene pisar, y el estado disabled ya es suficiente señal
 * visual (la mayoría de los botones de esta app ya tienen un estilo
 * :disabled distinguible).
 *
 * Reentrante: si `btn` ya está deshabilitado por una llamada anterior
 * todavía en vuelo (no debería pasar, ya que el propio disabled evita
 * el segundo click, pero por las dudas ante un dispatch programático),
 * no vuelve a envolver — corre `action` directo.
 */
export async function withButtonBusy(
  btn: HTMLButtonElement | null | undefined,
  action: () => Promise<void>
): Promise<void> {
  if (!btn || btn.disabled) {
    await action();
    return;
  }
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  try {
    await action();
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}
