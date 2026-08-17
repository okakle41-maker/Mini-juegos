/**
 * perfModeFirstRun.ts — Activa "modo bajo consumo" por defecto en la
 * primera visita real de un usuario (nunca antes vino a la app, sin
 * ninguna preferencia guardada) y lo avisa con un toast persistente,
 * una sola vez.
 *
 * Por qué una key separada de `st_perf_mode` (ver perfMode.ts) en vez
 * de reusarla para decidir "primera vez": `st_perf_mode` solo existe en
 * localStorage cuando el usuario tocó el toggle de Configuración (o
 * cuando ESTE módulo lo activa). Si guardáramos el valor por defecto
 * ahí directamente, quedaría indistinguible de una elección real del
 * usuario — y el toggle en Configuración reflejaría "activado" sin que
 * el usuario supiera por qué, además de no poder volver a distinguir
 * "primera vez" en una visita futura si por algún motivo se revirtiera
 * la key. `st_first_run_seen` es exclusivamente el flag de "ya se
 * mostró el aviso" — no toca ni lee la preferencia de perf-mode en sí,
 * que sigue siendo enteramente responsabilidad de perfMode.ts.
 *
 * Por qué no se activa perf-mode síncronamente en main.ts (como sí pasa
 * con la preferencia ya guardada, para evitar parpadeo): ese bloque
 * corre antes de importar notificationSystem, y necesitamos mostrar el
 * toast en el mismo momento en que decidimos activar el modo — separar
 * "activar" de "avisar" en dos lugares distintos del código arriesga
 * que uno de los dos cambie sin el otro. Un pequeño flash antes de que
 * este módulo corra (~mismo orden que perfMode.ts) es aceptable acá:
 * es una activación nueva para el usuario, no una preferencia que ya
 * tenía y que debía respetarse desde el primer paint.
 */

import safeStorage from './core/safeStorage.js';
import notificationSystem from './notificationSystem.js';
import PerfMode from './perfMode.js';

const FIRST_RUN_SEEN_KEY = 'st_first_run_seen';
const PERF_MODE_STORAGE_KEY = 'st_perf_mode';

function init(): void {
  // Si ya existe CUALQUIER valor guardado de st_perf_mode, el usuario
  // (o una visita anterior de este mismo flujo) ya pasó por acá o ya
  // tocó el toggle a mano — no es una primera visita real.
  const hasStoredPreference = safeStorage.getString(PERF_MODE_STORAGE_KEY, '') !== '';
  const alreadySeen = safeStorage.getString(FIRST_RUN_SEEN_KEY, '0') === '1';

  if (hasStoredPreference || alreadySeen) return;

  // Activa el modo pero sin persistir todavía como si fuera una
  // elección del usuario (persist: false) — si más adelante entra a
  // Configuración y lo desactiva, o lo vuelve a activar a mano, ESA
  // acción es la que primero escribe st_perf_mode con persist: true
  // dentro de perfMode.ts. Antes de eso, dejamos la key de preferencia
  // vacía a propósito para no confundir "el sistema lo activó de
  // arranque" con "el usuario lo eligió".
  PerfMode.setPerfMode(true, { persist: false });

  notificationSystem.custom({
    type: 'info',
    title: 'Modo bajo consumo activado',
    message:
      'Debido a problemas de rendimiento, la aplicación se ejecuta en modo bajo consumo. Podés cambiarlo en Configuración.',
    persistent: true,
    actions: [
      {
        label: 'No volver a ver',
        primary: true,
        action: () => {
          safeStorage.setString(FIRST_RUN_SEEN_KEY, '1');
        },
      },
    ],
  });
}

init();

export default { init };
