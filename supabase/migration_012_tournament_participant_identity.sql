-- ============================================================================
-- Migración 012: identidad real en tournament_participants
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_011_prevent_double_match.sql).
--
-- Contexto: registerForTournament()/unregisterFromTournament()
-- (js/tournamentSystem.ts) insertaban/borraban filas de
-- tournament_participants con el string literal 'current_player' para
-- TODOS los usuarios, en vez de su auth.uid() real. Consecuencias:
--   1. Todo inscripto comparte la misma fila lógica — no hay forma de
--      saber quién es cada participante real a partir de esta tabla.
--   2. unregisterFromTournament() filtraba por ese mismo placeholder:
--      cualquier usuario que se desinscribiera podía borrar la
--      inscripción de OTRO usuario (la primera fila que Postgres
--      encontrara con player_id='current_player'), no necesariamente
--      la propia.
--   3. current_participants se incrementaba/decrementaba a mano desde
--      el cliente sin ningún control de concurrencia — dos inscripciones
--      simultáneas pueden pisarse (ambas leen el mismo contador viejo),
--      a diferencia de clans.member_count, que ya tiene un trigger de
--      recálculo desde migration_007.
--
-- Ya se corrigió el cliente (tournamentSystem.ts) para usar
-- Auth.getUser()?.id real. Esta migración cierra el resto del lado del
-- servidor:
--   - RLS de tournament_participants pasa de using(true)/with check(true)
--     a auth.uid()::text = player_id, mismo criterio que friends/
--     friend_requests — con identidad real disponible, no hay motivo
--     para dejarla abierta (a diferencia de las salas efímeras por
--     código, que sí necesitan aceptar clientes sin sesión).
--   - Un trigger recalcula tournaments.current_participants a partir de
--     las filas reales de tournament_participants, con el mismo patrón
--     que sync_clan_member_count (migration_007) — el cliente ya no
--     necesita (ni debería) actualizar ese contador a mano; el UPDATE
--     que tournamentSystem.ts todavía hace sobre current_participants
--     queda como no-op inofensivo una vez que este trigger es la fuente
--     de verdad (se puede quitar del cliente en una limpieza futura, no
--     hace falta para que esto funcione correctamente).
-- ============================================================================

do $$
begin
  if to_regclass('public.tournament_participants') is null then
    raise exception 'migration_006_social_tournaments.sql no se ejecutó todavía — corré esa migración primero (crea la tabla public.tournament_participants que esta migración protege).';
  end if;
end $$;

-- 1. RLS de tournament_participants con identidad real ------------------------
drop policy if exists "tournament_participants_select_all" on public.tournament_participants;
create policy "tournament_participants_select_all"
  on public.tournament_participants for select
  using (true);
-- Select se deja abierto: el bracket/lista de inscriptos de un torneo es
-- información pública (se muestra a cualquiera que mire el torneo, esté
-- o no inscripto), igual criterio que scores/profiles en schema.sql.

drop policy if exists "tournament_participants_insert_all" on public.tournament_participants;
drop policy if exists "tournament_participants_insert_own" on public.tournament_participants;
create policy "tournament_participants_insert_own"
  on public.tournament_participants for insert
  with check ((select auth.uid())::text = player_id);

drop policy if exists "tournament_participants_delete_all" on public.tournament_participants;
drop policy if exists "tournament_participants_delete_own" on public.tournament_participants;
create policy "tournament_participants_delete_own"
  on public.tournament_participants for delete
  using ((select auth.uid())::text = player_id);

-- 2. Trigger: mantener tournaments.current_participants en sync ---------------
-- Mismo patrón que sync_clan_member_count (migration_007): el conteo se
-- recalcula siempre a partir de las filas reales de
-- tournament_participants, sin depender de que el cliente calcule bien
-- el +1/-1 ni de qué permisos tenga.
create or replace function public.sync_tournament_participant_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tournaments
  set current_participants = (
    select count(*) from public.tournament_participants
    where tournament_id = coalesce(new.tournament_id, old.tournament_id)
  )
  where id = coalesce(new.tournament_id, old.tournament_id);
  return null;
end;
$$;

drop trigger if exists tournament_participants_sync_count on public.tournament_participants;
create trigger tournament_participants_sync_count
  after insert or delete on public.tournament_participants
  for each row execute function public.sync_tournament_participant_count();
