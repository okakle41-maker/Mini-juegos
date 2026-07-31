-- ============================================================================
-- Migración 007: policy de DELETE faltante en friends
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_006_social_tournaments.sql).
--
-- Contexto: migration_006 habilitó RLS en friends con policies de
-- select/insert/update, pero nunca agregó una de delete. Sin policy de
-- delete, RLS deniega el delete por defecto — removeFriend() en
-- socialSystem.ts fallaba siempre en producción (silenciosamente,
-- atrapado por su propio try/catch), aunque el filtro del delete fuera
-- correcto.
-- ============================================================================

drop policy if exists "friends_delete_own" on public.friends;
create policy "friends_delete_own"
  on public.friends for delete
  using ((select auth.uid())::text = player1_id or (select auth.uid())::text = player2_id);

-- ============================================================================
-- Trigger: mantener clans.member_count en sync con clan_members
-- ============================================================================
-- Antes, joinClan/leaveClan en TypeScript hacían un UPDATE manual de
-- member_count desde el cliente. Eso tiene dos problemas: (1) condición
-- de carrera si dos jugadores se unen/salen al mismo tiempo (ambos leen
-- el mismo memberCount viejo y escriben el mismo valor +1), y (2) con
-- clans_update_all (using true) cualquiera puede tocarlo igual, pero si
-- en el futuro se restringe ese update al líder, un miembro no-líder
-- que sale del clan ya no podría actualizar member_count. Un trigger
-- en el servidor resuelve ambos de raíz: el conteo se recalcula siempre
-- a partir de las filas reales de clan_members, sin depender de que el
-- cliente calcule bien el +1/-1 ni de qué permisos tenga.
create or replace function public.sync_clan_member_count()
returns trigger as $$
begin
  update public.clans
  set member_count = (
    select count(*) from public.clan_members
    where clan_id = coalesce(new.clan_id, old.clan_id)
  )
  where id = coalesce(new.clan_id, old.clan_id);
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists clan_members_sync_count on public.clan_members;
create trigger clan_members_sync_count
  after insert or delete on public.clan_members
  for each row execute function public.sync_clan_member_count();
