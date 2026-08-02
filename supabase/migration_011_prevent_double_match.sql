-- ============================================================================
-- Migración 011: evitar que un jugador quede activo en dos sub-partidas
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_010_room_settings.sql).
--
-- Contexto: createMatch()/joinMatchAsPlayer() (js/lobbySystem.ts) no
-- validaban que quien llama ya fuera player1Id/player2Id de OTRA
-- sub-partida en 'waiting' o 'playing' antes de crear/unirse a una
-- nueva. Como this.currentMatch (estado en memoria del cliente) se
-- pisa con la partida nueva, la anterior queda huérfana: nadie vuelve a
-- llamar completeMatch()/leaveCurrentMatch() sobre ella (el cliente ya
-- perdió la referencia), y esa fila puede quedar en 'playing' para
-- siempre, o peor, completeMatch()/leaveCurrentMatch() de la partida
-- vieja termina actuando sobre this.currentMatch, que para ese momento
-- ya es la partida nueva.
--
-- Ya se agregó un guard del lado del cliente (mismo archivo, antes de
-- esta migración) que cubre el flujo normal de la UI, pero — igual que
-- el resto de las tablas de lobby, ver comentario "protegido por
-- conocimiento del código, no por auth.uid()" en migration_008 — las
-- policies de lobby_matches son using(true)/with check(true), así que
-- cualquier cliente (modificado, con dos pestañas, o simplemente en
-- una condición de carrera de red) puede saltarse ese guard escribiendo
-- directo a la tabla. Esta migración cierra el hueco del lado del
-- servidor con el mismo patrón que enforce_lobby_capacity
-- (migration_008): un trigger que rechaza el INSERT/UPDATE si deja a
-- alguno de los dos jugadores con más de una sub-partida activa.
--
-- "Activa" acá significa status en ('waiting', 'playing') — una
-- sub-partida 'completed'/'abandoned' no cuenta, así que terminar o
-- abandonar una libera al jugador para crear/unirse a la siguiente,
-- que es exactamente el flujo normal de uso.
-- ============================================================================

do $$
begin
  if to_regclass('public.lobby_matches') is null then
    raise exception 'migration_008_lobbies.sql no se ejecutó todavía — corré esa migración primero (crea la tabla public.lobby_matches que esta migración protege).';
  end if;
end $$;

-- 1. Función de chequeo -------------------------------------------------------
-- security definer, igual que enforce_lobby_capacity: el trigger necesita
-- leer filas de lobby_matches que pueden no ser "visibles" bajo el rol
-- del que dispara el INSERT/UPDATE si en el futuro las policies dejan
-- de ser using(true) — corriendo con los privilegios de quien definió
-- la función, no depende de eso.
--
-- Se chequea player1_id Y player2_id por separado porque ambos casos
-- disparan este trigger: createMatch() hace un INSERT con solo
-- player1_id (player2_id null todavía), joinMatchAsPlayer() hace un
-- UPDATE que rellena player2_id. En ambos casos el jugador que se
-- vuelve "activo" en esta fila es el que hay que verificar.
create or replace function public.prevent_double_active_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conflicting_count integer;
begin
  if new.status not in ('waiting', 'playing') then
    return new;
  end if;

  select count(*)
  into conflicting_count
  from public.lobby_matches m
  where m.id <> new.id
    and m.status in ('waiting', 'playing')
    and (
      m.player1_id = new.player1_id
      or m.player1_id = new.player2_id
      or (new.player2_id is not null and m.player2_id = new.player2_id)
      or (new.player2_id is not null and m.player2_id = new.player1_id)
    );

  if conflicting_count > 0 then
    raise exception 'player_already_in_active_match' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists lobby_matches_prevent_double_active on public.lobby_matches;
create trigger lobby_matches_prevent_double_active
  before insert or update on public.lobby_matches
  for each row
  execute function public.prevent_double_active_match();

-- Nota: el update de joinMatchAsPlayer() ya trae
-- .eq('status', 'waiting').is('player2_id', null) para cerrar la carrera
-- de "dos jugadores uniéndose a la misma partida a la vez" — este
-- trigger es una capa distinta (mismo jugador en DOS partidas distintas
-- a la vez), así que no reemplaza esa condición, la complementa.
