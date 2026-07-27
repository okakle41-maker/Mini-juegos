-- ============================================================================
-- Migración: corrige las 4 advertencias de Database → Advisors
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query.
-- Seguro de correr sobre una base con datos existentes: solo reemplaza
-- políticas y la vista, no toca ninguna fila de profiles/scores.
--
-- Corrige:
--   1. profiles_insert_own / profiles_update_own / scores_insert_own:
--      auth.uid() envuelto en (select auth.uid()) — evita que Postgres
--      lo re-evalúe por cada fila (advertencia de performance).
--   2. best_scores: agrega security_invoker = true — la vista pasa a
--      ejecutarse con los permisos de quien consulta, no de quien la
--      creó (advertencia de seguridad).
-- ============================================================================

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using ((select auth.uid()) = id);

drop policy if exists "scores_insert_own" on public.scores;
create policy "scores_insert_own"
  on public.scores for insert
  with check ((select auth.uid()) = user_id);

create or replace view public.best_scores
  with (security_invoker = true)
as
select distinct on (s.user_id, s.game_key)
  s.game_key,
  s.user_id,
  p.username,
  s.value,
  s.total,
  s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.user_id, s.game_key, s.value desc, s.created_at asc;
