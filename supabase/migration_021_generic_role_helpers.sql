-- ============================================================================
-- Migración 021: helpers genéricos "¿cuál es mi rol en esta partida?",
-- reutilizables entre minijuegos (continúa migration_020, mismo criterio).
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_020_generic_double_match_guard.sql).
--
-- Contexto: el mismo par de funciones ("¿el usuario autenticado ocupa el
-- rol X en esta partida?" / "¿qué rol ocupa, si alguno?") está
-- implementado 2 veces, con el mismo comentario "mismo patrón que..."
-- copiado de un archivo al otro:
--   - is_ship_role / get_my_ship_role
--     (migration_017, ship_control_matches,
--     navigation_player_id/sensors_player_id/energy_player_id/comms_player_id,
--     roles 'navigation'|'sensors'|'energy'|'comms')
--   - is_fragmented_labyrinth_role / get_my_fragmented_labyrinth_role
--     (migration_018, fragmented_labyrinth_matches,
--     role_a_id/role_b_id/role_c_id/role_d_id, roles 'A'|'B'|'C'|'D')
--
-- (signal_triangulation_matches NO tiene su propio is_/get_my_ — resuelve
-- "cuál es mi slot" distinto, ver mySlot() en
-- js/signalTriangulationSystem.ts; no se toca acá.)
--
-- Mismo criterio que migration_020: NO se borran las 4 funciones
-- existentes (is_ship_role, get_my_ship_role, is_fragmented_labyrinth_role,
-- get_my_fragmented_labyrinth_role) — cualquiera de las dos podría estar
-- referenciada por nombre exacto en una policy ya creada (is_ship_role sí
-- lo está, ver sc_state_navigation/sc_state_energy en migration_017) o
-- invocada por rpc() desde el cliente en el futuro. Pasan a ser wrappers
-- de dos funciones genéricas (public.get_my_role_generic /
-- public.is_my_role_generic) que hacen el trabajo real una sola vez.
--
-- Los nombres de rol devueltos NO cambian ('navigation'/'sensors'/'energy'/
-- 'comms' para Ship Control, 'A'/'B'/'C'/'D' para Fragmented Labyrinth):
-- js/shipControlSystem.ts y js/fragmentedLabyrinthSystem.ts comparan el
-- resultado de myRole()/get_my_ship_role() contra esos strings literales
-- (ver p.ej. `if (v_role === 'comms')`), así que tocarlos rompería la
-- lógica de rol en el cliente.
--
-- Para el PRÓXIMO minijuego cooperativo que necesite este mismo helper,
-- el patrón a seguir es:
--
--   create or replace function public.get_my_xx_role(p_match_id uuid)
--   returns text language sql security definer stable
--   set search_path = public
--   as $$
--     select public.get_my_role_generic(
--       'xx_matches',
--       array['role_a_id', 'role_b_id'],
--       array['A', 'B'],
--       p_match_id
--     );
--   $$;
--
--   create or replace function public.is_xx_role(p_match_id uuid, p_role text)
--   returns boolean language sql security definer stable
--   set search_path = public
--   as $$
--     select public.is_my_role_generic(
--       'xx_matches',
--       array['role_a_id', 'role_b_id'],
--       array['A', 'B'],
--       p_match_id,
--       p_role
--     );
--   $$;
--
-- — sin volver a escribir el `case when col1 = auth.uid() then 'x' ...`
-- a mano por cada columna de rol nueva.
-- ============================================================================

do $$
begin
  if to_regclass('public.ship_control_matches') is null
     or to_regclass('public.fragmented_labyrinth_matches') is null then
    raise exception 'faltan migraciones previas (017/018) — corré esta migración después de esas.';
  end if;
end $$;

-- 1. Funciones genéricas -------------------------------------------------------
-- Ambas son `language plpgsql` (a diferencia de las 4 funciones que
-- reemplazan, que eran `language sql`) porque necesitan EXECUTE dinámico
-- para resolver el nombre de tabla/columnas en tiempo de ejecución — SQL
-- puro no puede parametrizar un nombre de columna. `stable` se mantiene
-- (ninguna de las dos escribe nada, ambas dependen solo de sus argumentos
-- + el estado ya commiteado de la tabla), así el planner las sigue
-- pudiendo cachear/inlinear dentro de una misma sentencia igual que
-- antes.
--
-- p_table: nombre de la tabla de partidas (sin "public.").
-- p_role_cols: columnas de rol de esa tabla, en el mismo orden que
--   p_role_names.
-- p_role_names: el string que cada columna representa (p.ej. 'navigation'
--   para navigation_player_id) — se preserva 1 a 1 por compatibilidad con
--   los strings de rol que el cliente ya conoce (ver comentario de
--   cabecera).
-- p_match_id: partida sobre la que se pregunta.
-- p_role (solo is_my_role_generic): el rol puntual a verificar.
create or replace function public.get_my_role_generic(
  p_table text,
  p_role_cols text[],
  p_role_names text[],
  p_match_id uuid
) returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_case text;
  v_sql text;
  v_result text;
  i integer;
begin
  if array_length(p_role_cols, 1) is null
     or array_length(p_role_cols, 1) <> array_length(p_role_names, 1) then
    raise exception 'get_my_role_generic: p_role_cols y p_role_names deben tener la misma longitud (tabla %)', p_table;
  end if;

  -- v_case: "when col_a = (select auth.uid())::text then 'A' when col_b = ... then 'B' ..."
  v_case := '';
  for i in 1 .. array_length(p_role_cols, 1) loop
    v_case := v_case || format(
      'when %I = (select auth.uid())::text then %L ',
      p_role_cols[i],
      p_role_names[i]
    );
  end loop;

  v_sql := format(
    'select case %s else null end from public.%I where id = %L',
    v_case,
    p_table,
    p_match_id
  );

  execute v_sql into v_result;
  return v_result;
end;
$$;

create or replace function public.is_my_role_generic(
  p_table text,
  p_role_cols text[],
  p_role_names text[],
  p_match_id uuid,
  p_role text
) returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return public.get_my_role_generic(p_table, p_role_cols, p_role_names, p_match_id) = p_role;
end;
$$;

revoke all on function public.get_my_role_generic(text, text[], text[], uuid) from public;
revoke all on function public.is_my_role_generic(text, text[], text[], uuid, text) from public;
-- Sin grant a anon/authenticated: mismo alcance que las 4 funciones que
-- reemplazan (is_ship_role/get_my_ship_role/is_fragmented_labyrinth_role/
-- get_my_fragmented_labyrinth_role no tenían grant explícito tampoco —
-- se invocan desde dentro de otras funciones `security definer` o desde
-- el cuerpo de una policy, ninguno de los dos casos requiere que
-- anon/authenticated tengan EXECUTE directo).

-- 2. Las 4 funciones existentes pasan a delegar en las genéricas --------------
-- Los nombres NO cambian — `create or replace function` solo reemplaza el
-- CUERPO. Cualquier policy o llamada rpc() que ya referencia
-- is_ship_role/get_my_ship_role/etc. por nombre sigue funcionando sin
-- modificar nada más.

create or replace function public.is_ship_role(p_match_id uuid, p_role text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.is_my_role_generic(
    'ship_control_matches',
    array['navigation_player_id', 'sensors_player_id', 'energy_player_id', 'comms_player_id'],
    array['navigation', 'sensors', 'energy', 'comms'],
    p_match_id,
    p_role
  );
$$;

create or replace function public.get_my_ship_role(p_match_id uuid)
returns text
language sql security definer stable
set search_path = public
as $$
  select public.get_my_role_generic(
    'ship_control_matches',
    array['navigation_player_id', 'sensors_player_id', 'energy_player_id', 'comms_player_id'],
    array['navigation', 'sensors', 'energy', 'comms'],
    p_match_id
  );
$$;

create or replace function public.is_fragmented_labyrinth_role(p_match_id uuid, p_role text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.is_my_role_generic(
    'fragmented_labyrinth_matches',
    array['role_a_id', 'role_b_id', 'role_c_id', 'role_d_id'],
    array['A', 'B', 'C', 'D'],
    p_match_id,
    p_role
  );
$$;

create or replace function public.get_my_fragmented_labyrinth_role(p_match_id uuid)
returns text
language sql security definer stable
set search_path = public
as $$
  select public.get_my_role_generic(
    'fragmented_labyrinth_matches',
    array['role_a_id', 'role_b_id', 'role_c_id', 'role_d_id'],
    array['A', 'B', 'C', 'D'],
    p_match_id
  );
$$;

-- 3. Verificación manual sugerida tras aplicar (Supabase SQL editor, con
-- un JWT de un jugador real que sea navigation_player_id de algún match
-- de ship_control_matches en curso):
--   select public.get_my_ship_role('<ese-match-id>'::uuid);
--     → debe devolver 'navigation', igual que antes de esta migración.
--   select public.is_ship_role('<ese-match-id>'::uuid, 'navigation');
--     → debe devolver true.
--   select public.is_ship_role('<ese-match-id>'::uuid, 'comms');
--     → debe devolver false.
--   Repetir el mismo chequeo con get_my_fragmented_labyrinth_role /
--   is_fragmented_labyrinth_role contra un match de
--   fragmented_labyrinth_matches y rol 'A'..'D'.
--   Y el flujo normal de la app (Ship Control: HUD de navegación
--   mostrando solo su propio panel; Fragmented Labyrinth: cada jugador
--   viendo solo su cuadrante) debe seguir funcionando igual que antes de
--   esta migración — ambos dependen de get_my_*_role() para saber qué
--   mostrar.
-- ============================================================================
