/**
 * supabaseClient.ts — Único punto de conexión con el backend (Supabase).
 *
 * `SUPABASE_URL` y `SUPABASE_ANON_KEY` son públicas por diseño: Supabase
 * las está pensadas para vivir en el cliente (el bundle de JS que se
 * descarga al navegador). No son un secreto — cualquiera que abra
 * DevTools puede verlas igual, estén "ocultas" en una variable de entorno
 * o no. La seguridad real de este proyecto no depende de esconder estas
 * dos claves, sino de las políticas de Row Level Security definidas en
 * supabase/schema.sql: la base de datos rechaza cualquier operación que
 * no cumpla esas reglas, sin importar qué llame a la API ni con qué clave.
 *
 * La única clave que NUNCA debe aparecer acá ni en ningún archivo del
 * frontend es la `service_role` key (visible en el mismo panel de
 * Supabase que la anon key) — esa sí se salta RLS por completo y solo
 * debe vivir en un entorno de servidor de confianza, que este proyecto
 * no tiene.
 *
 * `@supabase/supabase-js` (con sus dependencias transitivas: auth-js,
 * postgrest-js, realtime-js, etc.) pesa varios cientos de KB sin
 * comprimir. Se carga con `import()` dinámico en vez de un import
 * estático arriba del archivo para que Vite/Rolldown lo separe en su
 * propio chunk lazy — el mismo mecanismo que ya usan los *.logic.ts de
 * cada juego (ver GameConfig.logic en core/gameRegistry.ts) — en vez de
 * quedar arrastrado dentro del chunk 'bootstrap' que main.ts carga
 * siempre. Se intentó primero resolver esto con `manualChunks` en
 * vite.config.ts, pero Rolldown 1.1.3 (motor de build de Vite 8) no
 * separaba el chunk pese a que la condición de matching sí se cumplía
 * — el import() dinámico evita el problema por completo, ya que ese
 * mecanismo de code-splitting sí funciona de forma confiable (probado
 * con los 26 juegos del proyecto).
 *
 * `getSupabaseClient()` cachea la promesa de inicialización: llamarla
 * varias veces en paralelo (p.ej. login y una consulta de scoreboard
 * disparadas casi al mismo tiempo) no dispara múltiples import()
 * simultáneos ni crea más de un cliente.
 *
 * IMPORTANTE para quien consuma este módulo: importar `getSupabaseClient`
 * con un `import { getSupabaseClient } from './core/supabaseClient.js'`
 * estático arriba de tu archivo ROMPE el code-splitting descrito
 * arriba — no importa que la función en sí se llame recién en runtime,
 * Rolldown decide si puede separar el chunk mirando si el módulo
 * `supabaseClient.ts` está enlazado de forma estática desde algún
 * punto del grafo, y con UN solo consumidor haciéndolo así alcanza
 * para neutralizarlo para todos los demás (confirmado con el warning
 * [INEFFECTIVE_DYNAMIC_IMPORT] del build: listaba a la vez los
 * consumidores que sí usaban `await import(...)` inline). Cada
 * consumidor debe usar su propio wrapper local:
 *
 *   async function getSupabaseClientLazy(): Promise<SupabaseClient> {
 *     const { getSupabaseClient } = await import('./core/supabaseClient.js');
 *     return getSupabaseClient();
 *   }
 *
 * Sí, esto se repite en cada archivo que lo necesita (authManager.ts,
 * globalScores.ts, lobbySystem.ts, utils/roleMatchSystemBase.ts,
 * multiplayerSystem.ts, socialSystem.ts, tournamentSystem.ts) — no se
 * puede centralizar en una función exportada desde este mismo archivo
 * ni desde ningún otro: cualquier módulo que la importara de forma
 * estática volvería a enlazar supabaseClient.ts estáticamente y
 * reproduciría el mismo problema un nivel más arriba.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhtanhtuxcowpwbgwupj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vA1wG_HRGnozElM-brAlfw_ZeFy6PIh';

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // Persiste la sesión en localStorage bajo su propia clave
          // (gestionada internamente por el SDK, no por SafeStorage)
          // para que el usuario siga logueado entre visitas sin tener
          // que loguearse cada vez.
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    );
  }
  return clientPromise;
}

export default getSupabaseClient;

