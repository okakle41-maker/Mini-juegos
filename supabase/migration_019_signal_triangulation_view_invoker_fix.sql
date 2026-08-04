-- ============================================================================
-- Migración 019: fix del warning "Security Definer View" (Supabase linter,
-- regla 0010) sobre public.signal_triangulation_rounds_public y
-- public.signal_triangulation_locks_public (creadas en migration_016).
-- ============================================================================
-- Contexto: migration_016 documenta un historial de bug con
-- security_invoker=true en estas dos vistas (ver comentarios "HISTORIAL DEL
-- BUG" ahí) y terminó dejándolas SIN security_invoker a propósito, porque en
-- ese momento la tabla base tenía el SELECT completo revocado de
-- anon/authenticated (revoke select on ... from anon, authenticated) — y
-- security_invoker exige que el INVOCADOR tenga privilegio de SELECT sobre
-- la tabla base antes de que RLS se evalúe siquiera.
--
-- El linter de Supabase (0010_security_definer_view) marca como riesgo
-- CUALQUIER vista sin security_invoker=true en el schema public, sin
-- distinguir "vista que además filtra columnas sensibles" — que es el caso
-- acá — de una vista sin ningún control. Es un falso positivo real para
-- este diseño, pero conviene resolverlo en vez de dejarlo en rojo en el
-- dashboard.
--
-- La solución (ya usada en migration_017_ship_control.sql para
-- ship_control_state_navigation/_energy, mismo patrón, ver esa migración):
-- en vez de revocar el SELECT de la tabla completa, se otorga SELECT
-- ACOTADO POR COLUMNA (Postgres soporta grants por columna) — solo las
-- columnas no sensibles. Así:
--   - security_invoker=true encuentra el privilegio de tabla que necesita
--     para no fallar (columnas seguras) y la vista pasa a heredar RLS del
--     invocador real, cerrando el warning del linter.
--   - Un intento de `select source_x from signal_triangulation_rounds`
--     directo (bypaseando la vista) sigue fallando — ya no por REVOKE
--     total, sino porque ese grant por columna nunca incluyó source_x/
--     source_y (ni guess_x/guess_y/distance en locks), así que Postgres
--     deniega el acceso a esa columna específica antes de llegar a RLS.
--   - Las vistas _public siguen sin exponer esas columnas porque su SELECT
--     interno nunca las nombra (sin cambios ahí).
-- ============================================================================

-- 1. signal_triangulation_rounds ---------------------------------------------
-- Vuelve a otorgar SELECT, pero solo de las columnas que ya expone
-- signal_triangulation_rounds_public (nunca source_x/source_y).
revoke select on public.signal_triangulation_rounds from anon, authenticated;
grant select (id, match_id, round_number, attempt_number, status, created_at, resolved_at)
  on public.signal_triangulation_rounds to anon, authenticated;

alter view public.signal_triangulation_rounds_public set (security_invoker = true);

-- 2. signal_triangulation_locks -----------------------------------------------
-- Acá conviven dos necesidades: cada jugador puede leer su PROPIA fila
-- completa (incluida guess_x/guess_y/distance — ya cubierto por la policy
-- "str_locks_select_own_full" de migration_016, using(auth.uid() =
-- player_id)), y además necesita ver, de las filas de sus compañeros, solo
-- el booleano has_locked vía la vista pública. El grant por columna acá NO
-- puede acotarse a (round_id, player_id, locked_at) solamente, porque eso
-- rompería la lectura de la fila propia completa (guess_x/guess_y/distance)
-- que la policy de "select own full" ya autoriza correctamente por fila —
-- un grant por columna es un techo aplicado ANTES de RLS, independiente de
-- qué fila sea.
--
-- La resolución: se mantiene el grant completo de columnas (ya existía
-- implícitamente antes del revoke de migration_016), y la protección de
-- guess_x/guess_y/distance de OTROS jugadores queda 100% a cargo de RLS
-- (la policy "str_locks_select_own_full" ya solo deja pasar filas propias)
-- — no de un revoke de columna. Esto es seguro porque, a diferencia de
-- rounds (donde CUALQUIER fila visible expondría la fuente a cualquier
-- jugador), acá el filtro correcto es por FILA (auth.uid() = player_id), que
-- es exactamente lo que RLS hace bien. security_invoker=true simplemente
-- deja de bypasear esa policy para la vista _public, en vez de forzar un
-- revoke total que impedía la lectura de la fila propia sin pasar por otra
-- vista _own separada (que no existe ni hace falta agregar).
revoke select on public.signal_triangulation_locks from anon, authenticated;
grant select on public.signal_triangulation_locks to anon, authenticated;

alter view public.signal_triangulation_locks_public set (security_invoker = true);

-- 3. Verificación manual sugerida tras aplicar (Supabase SQL editor, con un
-- JWT de un jugador que NO es dueño de la fila que se intenta leer):
--   select source_x from public.signal_triangulation_rounds limit 1;
--     → debe fallar con "permission denied for table
--       signal_triangulation_rounds" (columna no otorgada).
--   select guess_x from public.signal_triangulation_locks
--     where player_id <> auth.uid()::text limit 1;
--     → debe devolver 0 filas (RLS, no por permiso de columna — la policy
--       "str_locks_select_own_full" filtra la fila antes de llegar a
--       columnas).
--   select * from public.signal_triangulation_rounds_public limit 1;
--   select * from public.signal_triangulation_locks_public limit 1;
--     → ambas deben seguir funcionando igual que antes de esta migración.
