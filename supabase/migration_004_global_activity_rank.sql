-- ============================================================================
-- Migración 004: vista public.global_activity_rank
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query.
-- Seguro de correr sobre una base con datos existentes: solo crea/reemplaza
-- una vista, no toca ninguna tabla ni fila.
--
-- Por qué: alimenta el panel "TOP GLOBAL" del HUD lateral (aside
-- #hudPanel en index.html), antes hardcodeado con nombres y cifras de
-- ejemplo. Los distintos minijuegos usan unidades incompatibles entre sí
-- (segundos, aciertos, puntos...), así que no hay una "suma de XP" real
-- comparable entre usuarios. games_played (cantidad de partidas
-- registradas) sí es comparable sin importar qué juegue cada quien, y
-- es la métrica que usa este ranking.
-- ============================================================================

create or replace view public.global_activity_rank
  with (security_invoker = true)
as
select
  p.username,
  count(s.id) as games_played
from public.profiles p
join public.scores s on s.user_id = p.id
group by p.id, p.username
order by games_played desc;
