-- ============================================================================
-- Migración 018: Fix de vistas con security_invoker que rompen SELECT del cliente
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_017_ship_control.sql).
--
-- Problema detectado en runtime (error 42501):
--   signalTriangulationSystem.refreshCurrentRound → 403 (permission denied
--   for table signal_triangulation_rounds).
--
-- Causa raíz: las vistas públicas (signal_triangulation_rounds_public,
-- signal_triangulation_locks_public, ship_control_state_navigation,
-- ship_control_state_energy) se crearon con `security_invoker = true`
-- sobre tablas base cuyo SELECT fue explícitamente revocado para
-- anon/authenticated. Con security_invoker, Postgres evalúa la vista con
-- los privilegios del rol que consulta — y como ese rol no tiene SELECT
-- directo sobre la tabla base, la consulta falla con 42501 (permission
-- denied) aunque la vista sí tenga grant select otorgado.
--
-- Por qué quitar security_invoker es seguro acá:
--   1. Sin security_invoker, una vista corre con los privilegios del
--      owner de la vista (normalmente postgres/supabase_admin), no del
--      llamador. Eso es exactamente lo que se busca: el llamador puede
--      hacer SELECT sobre la vista, y los filtros internos protegen el
--      contenido.
--   2. Las vistas ya están diseñadas para NO exponer datos sensibles:
--      - signal_triangulation_rounds_public: NO selecciona source_x/
--        source_y (la fuente oculta se queda en la tabla base).
--      - signal_triangulation_locks_public: solo expresa un booleano
--        has_locked = (locked_at is not null), nunca guess_x/guess_y.
--      - ship_control_state_navigation/_energy: filtran por rol vía
--        is_ship_role() (security definer, usa auth.uid() real).
--   3. El diseño documentado (migration_016, sección 2.2) ya advertía
--      que "security_invoker = true ... el resultado es el mismo" — pero
--      en la práctica el REVOKE del SELECT de la tabla base hace que con
--      security_invoker la vista sea totalmente inaccesible para el
--      cliente. Quitar security_invoker restaura el funcionamiento
--      real (la vista SÍ funciona, porque el owner tiene privilegios) y
--      los comentarios de diseño quedan acordes.
-- ============================================================================

-- 1. Signal Triangulation -----------------------------------------------------

-- Rounds públicos (sin source_x/source_y).
alter view public.signal_triangulation_rounds_public set (security_invoker = false);
grant select on public.signal_triangulation_rounds_public to anon, authenticated;

-- Locks públicos (solo booleano has_locked).
alter view public.signal_triangulation_locks_public set (security_invoker = false);
grant select on public.signal_triangulation_locks_public to anon, authenticated;

-- 2. Centro de Control --------------------------------------------------------

-- Estado de navegación (filtrado por is_ship_role → auth.uid() real).
alter view public.ship_control_state_navigation set (security_invoker = false);
grant select on public.ship_control_state_navigation to anon, authenticated;

-- Estado de energía (filtrado por is_ship_role → auth.uid() real).
alter view public.ship_control_state_energy set (security_invoker = false);
grant select on public.ship_control_state_energy to anon, authenticated;