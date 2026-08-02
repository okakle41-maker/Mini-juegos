-- ============================================================================
-- Migración 015: cerrar la carrera en enforce_lobby_capacity
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_014_friends_update_check.sql).
--
-- Contexto: enforce_lobby_capacity (migration_008) hace
-- `select count(*) ... >= 8` dentro de un trigger BEFORE INSERT. Bajo el
-- nivel de aislamiento por defecto de Postgres (READ COMMITTED), un
-- SELECT no bloquea filas para otras transacciones — dos INSERT
-- concurrentes en lobby_players para el MISMO lobby_id (dos personas
-- tocando "unirse" al mismo lobby casi al mismo tiempo, con el lobby ya
-- en 7/8) pueden ambos ejecutar su count() antes de que cualquiera de
-- las dos confirme, ambos leer 7, ambos pasar el chequeo, y el lobby
-- termina con 9 jugadores en vez de 8. Impacto acotado (un jugador de
-- más en un lobby social, no un problema de autorización), pero es un
-- bug real y la causa está identificada con precisión.
--
-- Fix: antes de contar, el trigger toma un lock de fila sobre la propia
-- fila de `lobbies` correspondiente a `new.lobby_id`
-- (`select ... for update`). Todo INSERT concurrente hacia el mismo
-- lobby_id queda serializado esperando ese lock — la segunda
-- transacción no puede correr su propio count() hasta que la primera
-- termine (commit o rollback), momento en el que ya ve el conteo
-- actualizado. Se usa la fila de `lobbies` como punto de lock en vez de
-- lockear filas de `lobby_players` directamente porque cualquier INSERT
-- nuevo por definición no tiene todavía una fila propia que lockear —
-- lockear la fila del lobby padre (que sí existe siempre) es el patrón
-- estándar de Postgres para serializar inserts que dependen de un
-- conteo de filas hermanas.
-- ============================================================================

do $$
begin
  if to_regclass('public.lobbies') is null then
    raise exception 'migration_008_lobbies.sql no se ejecutó todavía — corré esa migración primero (crea las tablas public.lobbies/public.lobby_players que esta migración protege).';
  end if;
end $$;

create or replace function public.enforce_lobby_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Lockea la fila del lobby padre hasta el fin de esta transacción —
  -- cualquier otro INSERT concurrente en lobby_players para el mismo
  -- lobby_id queda bloqueado en este mismo punto hasta que esta
  -- transacción confirme o revierta, cerrando la ventana de carrera
  -- donde dos counts() concurrentes ven ambos 7 antes de que ninguno
  -- confirme. Si el lobby_id no existiera (no debería pasar, hay FK),
  -- esto simplemente no bloquea nada y el INSERT sigue su curso normal
  -- (fallará más abajo por la FK, no por esto).
  perform 1 from public.lobbies where id = new.lobby_id for update;

  if (select count(*) from public.lobby_players where lobby_id = new.lobby_id) >= 8 then
    raise exception 'lobby_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- El trigger ya existe (creado en migration_008) y apunta a esta misma
-- función por nombre — con create or replace function alcanza, no hace
-- falta recrear el trigger. Se deja el drop/create acá de todos modos
-- por si alguna vez se corre esta migración de forma aislada contra un
-- estado inconsistente (mismo criterio defensivo que el resto de las
-- migraciones de este proyecto).
drop trigger if exists lobby_players_capacity_check on public.lobby_players;
create trigger lobby_players_capacity_check
  before insert on public.lobby_players
  for each row
  execute function public.enforce_lobby_capacity();
