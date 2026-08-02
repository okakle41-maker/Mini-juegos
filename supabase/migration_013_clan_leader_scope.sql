-- ============================================================================
-- Migración 013: acotar clans/clan_members al liderazgo real
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_012_tournament_participant_identity.sql).
--
-- Contexto: migration_006 dejó clans_update_all y clan_members_delete_all
-- como using(true) — a diferencia de las salas efímeras por código
-- (live_matches/lobby_matches, protegidas por "conocer el código", un
-- modelo documentado y aceptado para ese caso), un clan es una entidad
-- persistente con noción explícita de liderazgo: la propia tabla ya
-- modela clan_members.role in ('leader','officer','member') y
-- clans.leader_id, pero ninguna policy lo hacía cumplir. En la práctica
-- esto significaba que cualquier cliente con la anon key podía:
--   - Reescribir leader_id/name/tag/xp/level de un clan ajeno
--     (clans_update_all).
--   - Borrar la fila de clan_members de CUALQUIER jugador en cualquier
--     clan (clan_members_delete_all), expulsándolo sin ser su líder ni
--     el propio jugador — el cliente hoy solo expone "salir vos mismo"
--     (leaveClan en socialSystem.ts), nunca "expulsar a otro", así que
--     esto no rompe ninguna funcionalidad existente, solo cierra una
--     puerta que el frontend nunca necesitó abierta.
--
-- Diseño elegido:
--   - clans_update_all → solo el líder actual del clan (leader_id =
--     auth.uid()) puede actualizar la fila. El cliente hoy no hace
--     ningún UPDATE sobre clans (solo INSERT al crear, ver createClan
--     en socialSystem.ts), así que esto no rompe nada existente; deja
--     preparado el terreno para una futura función "editar clan" sin
--     tener que volver a tocar RLS.
--   - clan_members_delete_all → el propio jugador (para salir, ya
--     usado por leaveClan) O el líder del clan (para expulsar, sin uso
--     hoy en el cliente pero coherente con el modelo de roles ya
--     definido en el esquema).
--   - clans_insert_all y clan_members_insert_all quedan como using(true)
--     sin cambios: crear un clan nuevo o unirse a uno abierto no
--     depende de ya ser su líder (todavía no existe la fila), es el
--     mismo tipo de acción "abierta a cualquier autenticado" que ya
--     tienen otras tablas.
-- ============================================================================

do $$
begin
  if to_regclass('public.clans') is null then
    raise exception 'migration_006_social_tournaments.sql no se ejecutó todavía — corré esa migración primero (crea las tablas public.clans/public.clan_members que esta migración protege).';
  end if;
end $$;

-- 1. clans: solo el líder puede actualizar su propio clan --------------------
drop policy if exists "clans_update_all" on public.clans;
drop policy if exists "clans_update_leader" on public.clans;
create policy "clans_update_leader"
  on public.clans for update
  using ((select auth.uid())::text = leader_id)
  with check ((select auth.uid())::text = leader_id);
-- with check además de using: sin esto, un líder legítimo podría
-- actualizar su propia fila para transferirle leader_id a otro usuario
-- sin su participación, o a un id inventado — el with check obliga a
-- que la fila siga siendo del mismo líder después del update también
-- (transferencia de liderazgo real, si se agrega en el futuro, debería
-- ser su propia función explícita, no un efecto secundario de un
-- update abierto).

-- 2. clan_members: borrar la propia fila, o si sos el líder del clan ---------
drop policy if exists "clan_members_delete_all" on public.clan_members;
drop policy if exists "clan_members_delete_own_or_leader" on public.clan_members;
create policy "clan_members_delete_own_or_leader"
  on public.clan_members for delete
  using (
    (select auth.uid())::text = player_id
    or exists (
      select 1 from public.clans c
      where c.id = clan_members.clan_id
        and c.leader_id = (select auth.uid())::text
    )
  );
