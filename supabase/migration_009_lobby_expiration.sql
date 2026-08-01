-- ============================================================================
-- Migración 009: expiración de lobbies abandonados
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_008_lobbies.sql).
--
-- Contexto: leaveLobby() (js/lobbySystem.ts) cierra el lobby y libera su
-- room_code cuando el último jugador sale explícitamente. Eso no cubre
-- el caso de que alguien simplemente cierre la pestaña o pierda
-- conexión sin llamar a leaveLobby() — su fila en lobby_players nunca
-- se borra (nada la borra del lado del servidor) y el lobby queda
-- 'open' indefinidamente, con lobbies_active_room_code_key impidiendo
-- que nadie más use ese código nunca más.
--
-- El proyecto no tiene pg_cron disponible (ningún plan gratuito de
-- Supabase lo incluye, y ninguna migración anterior lo usa), así que se
-- sigue el mismo patrón ya establecido para el resto de la limpieza de
-- salas (ver comentario "el frontend marca 'abandoned'..." en
-- migration_005_coop_rooms.sql): una función que el cliente invoca
-- oportunísticamente, no un job en el servidor. Acá se usa un enfoque
-- más agresivo — un RPC que cierra TODOS los lobbies vencidos de un
-- saque, no solo el propio — porque a diferencia de live_matches (que
-- se limpia solo al salir de una vista puntual), un código de lobby
-- bloqueado para siempre es un recurso compartido (nadie más puede
-- usar ese código) y conviene liberarlo apenas alguien, cualquiera,
-- toque el sistema.
--
-- Umbral elegido: 30 minutos sin actividad. Un lobby grupal (hasta 8
-- personas, con sub-partidas yendo y viniendo) tiene sesiones bastante
-- más largas que una sala 1v1 suelta — 30 min da margen para que la
-- gente hable, arme la siguiente partida, etc. sin que el lobby se
-- cierre solo mientras todavía lo están usando activamente.
-- ============================================================================

-- 1. Última actividad del lobby ---------------------------------------------
alter table public.lobbies
  add column if not exists last_activity_at timestamptz not null default now();

-- Acelera el filtro `where status = 'open' and last_activity_at < ...`
-- de purge_stale_lobbies() — sin este índice, cada purga escanea todos
-- los lobbies abiertos secuencialmente.
create index if not exists lobbies_open_last_activity_idx
  on public.lobbies (last_activity_at)
  where status = 'open';

-- 2. Función de purga ---------------------------------------------------------
-- security definer: el cliente que la invoca via RPC no necesita (ni
-- debería tener) permiso de UPDATE general sobre filas de lobbies que
-- no son las suyas — la función corre con los privilegios de quien la
-- definió, no de quien la llama, igual que enforce_lobby_capacity en
-- migration_008.
--
-- Devuelve la cantidad de lobbies cerrados (integer), útil para logging
-- del lado del cliente si hace falta debuggear por qué un código
-- "desapareció", aunque hoy nada del cliente lee ese valor.
create or replace function public.purge_stale_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer;
begin
  with stale as (
    update public.lobbies
    set status = 'closed', closed_at = now()
    where status = 'open'
      and last_activity_at < now() - interval '30 minutes'
    returning id
  )
  select count(*) into closed_count from stale;

  -- lobby_players/lobby_matches no se borran acá explícitamente: no
  -- tienen "on delete cascade" atado al status de lobbies (solo al
  -- borrado físico de la fila, que no ocurre — se cierra, no se
  -- elimina, para conservar el historial). Quedan como filas huérfanas
  -- de un lobby 'closed'; el frontend ya las ignora (loadLobbyState
  -- filtra sub-partidas por status in ('waiting','playing') y un lobby
  -- 'closed' nunca se vuelve a cargar por código porque
  -- lobbies_active_room_code_key/joinLobby solo buscan status='open').

  return closed_count;
end;
$$;

-- 3. RPC público ---------------------------------------------------------------
-- Ejecutable por el rol anon/authenticated que usa el cliente (mismo
-- criterio "protegido por conocimiento del código, no por auth.uid()"
-- que el resto de las policies de esta tabla) — no hace falta grant
-- explícito adicional, `security definer` + ser propietario de la
-- función ya alcanza en el esquema por default de Supabase, pero se
-- deja explícito para que quede documentado en el propio SQL.
grant execute on function public.purge_stale_lobbies() to anon, authenticated;

-- 4. Mantener last_activity_at al día -----------------------------------------
-- En vez de que cada acción del cliente (crear sub-partida, salir,
-- etc.) tenga que acordarse de hacer un UPDATE extra a `lobbies` además
-- de su propio cambio, un trigger en lobby_players / lobby_matches
-- toca `lobbies.last_activity_at` automáticamente ante cualquier
-- INSERT/UPDATE/DELETE relacionado con ese lobby — cubre uniones,
-- salidas, creación de sub-partidas y cambios de estado sin tener que
-- tocar lobbySystem.ts en cada punto por separado ni arriesgarse a
-- olvidar alguno.
create or replace function public.touch_lobby_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lobbies
  set last_activity_at = now()
  where id = coalesce(new.lobby_id, old.lobby_id);
  return null;
end;
$$;

drop trigger if exists lobby_players_touch_activity on public.lobby_players;
create trigger lobby_players_touch_activity
  after insert or update or delete on public.lobby_players
  for each row
  execute function public.touch_lobby_activity();

drop trigger if exists lobby_matches_touch_activity on public.lobby_matches;
create trigger lobby_matches_touch_activity
  after insert or update or delete on public.lobby_matches
  for each row
  execute function public.touch_lobby_activity();
