-- ============================================================================
-- Migración 020: guard genérico "un jugador no puede estar en dos partidas
-- activas a la vez", reutilizable entre minijuegos.
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_019_signal_triangulation_view_invoker_fix.sql).
--
-- Contexto: el mismo trigger ("antes de INSERT/UPDATE, si el jugador que
-- va a quedar activo en esta fila ya está en OTRA fila de la misma tabla
-- con status 'waiting'/'playing', rechazar") está implementado 4 veces,
-- una por minijuego cooperativo, cada vez a mano sobre columnas nombradas
-- distintas:
--   - prevent_double_active_match      (migration_011, lobby_matches,
--     player1_id/player2_id)
--   - prevent_double_active_st_match   (migration_016,
--     signal_triangulation_matches, player1_id..player3_id)
--   - prevent_double_active_sc_match   (migration_017, ship_control_matches,
--     navigation_player_id/sensors_player_id/energy_player_id/comms_player_id)
--   - prevent_double_active_fl_match   (migration_018,
--     fragmented_labyrinth_matches, role_a_id..role_d_id)
--
-- Cuatro copias del mismo concepto ya se desviaron entre sí de forma
-- accidental: FL usa `raise exception 'player_already_in_active_fl_match'`
-- SIN `using errcode = 'P0001'` (las otras 3 sí lo hacen explícito), y cada
-- una arma la comparación de columnas a mano (OR encadenados en lobby_matches,
-- arrays con && en ST/SC, IN(...) en FL) — trabajo repetido que además es
-- fácil de copiar mal en el próximo minijuego.
--
-- Esta migración NO reemplaza las 4 funciones existentes por una sola: los
-- nombres de función que cada `create trigger ... execute function ...`
-- referencia (prevent_double_active_match, _st_match, _sc_match, _fl_match)
-- siguen existiendo tal cual, así que ningún trigger cambia de definición
-- visible ni hay que volver a crearlos. Lo que cambia es que las 4 pasan a
-- ser wrappers de una sola función genérica y parametrizada
-- (public.check_no_active_match), que hace el trabajo real una sola vez.
--
-- Los mensajes de error NO cambian (siguen siendo exactamente
-- 'player_already_in_active_match' para lobby/ST/SC y
-- 'player_already_in_active_fl_match' para FL, con el mismo errcode
-- 'P0001' que ya tenían las primeras 3) porque el cliente ya hace
-- `error.message?.includes(...)` contra ese texto exacto en
-- js/lobbySystem.ts, js/signalTriangulationSystem.ts,
-- js/shipControlSystem.ts y js/fragmentedLabyrinthSystem.ts — cambiar el
-- texto acá sin tocar esos 4 archivos rompería en silencio la detección
-- de "ya estás en otra partida" del lado del cliente.
--
-- Para el PRÓXIMO minijuego cooperativo que necesite este mismo guard, el
-- patrón a seguir es:
--
--   create or replace function public.prevent_double_active_xx_match()
--   returns trigger language plpgsql security definer set search_path = public
--   as $$
--   begin
--     perform public.check_no_active_match(
--       p_table       => 'xx_matches',
--       p_player_cols => array['role_a_id', 'role_b_id'],
--       p_active_states => array['waiting', 'playing'],
--       p_new_id      => new.id,
--       p_new_values  => array[new.role_a_id, new.role_b_id],
--       p_error_message => 'player_already_in_active_xx_match'
--     );
--     return new;
--   end;
--   $$;
--
--   drop trigger if exists xx_prevent_double_active on public.xx_matches;
--   create trigger xx_prevent_double_active
--     before insert or update on public.xx_matches
--     for each row execute function public.prevent_double_active_xx_match();
--
-- — sin volver a escribir la consulta de "¿alguna de mis columnas de
-- jugador coincide con alguna columna de jugador de otra fila activa?" a
-- mano.
-- ============================================================================

do $$
begin
  if to_regclass('public.lobby_matches') is null
     or to_regclass('public.signal_triangulation_matches') is null
     or to_regclass('public.ship_control_matches') is null
     or to_regclass('public.fragmented_labyrinth_matches') is null then
    raise exception 'faltan migraciones previas (008/016/017/018) — corré esta migración después de esas.';
  end if;
end $$;

-- 1. Función genérica ---------------------------------------------------------
-- security definer, igual que las 4 funciones que reemplaza: el guard
-- necesita leer filas de la tabla de partidas sin depender de que las
-- policies de esa tabla dejen pasar el select bajo el rol de quien
-- dispara el INSERT/UPDATE (todas estas tablas son using(true) hoy, pero
-- el guard no debería depender de que eso siga siendo así).
--
-- p_table: nombre de la tabla de partidas (sin "public.", se cablea acá).
-- p_player_cols: columnas de jugador/rol de esa tabla, en el mismo orden
--   que p_new_values.
-- p_active_states: valores de `status` que cuentan como "partida activa"
--   (en las 4 tablas existentes siempre es array['waiting','playing'],
--   pero queda parametrizado por si un futuro minijuego usa otros nombres
--   de estado).
-- p_new_id: new.id de la fila que dispara el trigger (para excluirla de
--   la búsqueda de conflicto — una fila nunca conflictúa consigo misma).
-- p_new_values: new.<col> de cada columna en p_player_cols, en el mismo
--   orden — se recibe ya resuelto en vez de que esta función haga
--   `EXECUTE ... using new` genérico sobre un record, porque plpgsql no
--   permite indexar un record por nombre de columna dinámico sin recurrir
--   a JSON (perdiendo el tipo) o a otro nivel de EXECUTE; pasar el array
--   ya armado desde el trigger concreto (que sí conoce sus columnas en
--   tiempo de escritura) es más simple y más barato en runtime.
-- p_error_message: texto exacto del raise exception — se preserva
--   literal por compatibilidad con el cliente (ver comentario de
--   cabecera de esta migración).
create or replace function public.check_no_active_match(
  p_table text,
  p_player_cols text[],
  p_active_states text[],
  p_new_id uuid,
  p_new_values text[],
  p_error_message text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col_list text;
  v_new_conditions text;
  v_sql text;
  v_conflicting_count integer;
  i integer;
begin
  if array_length(p_player_cols, 1) is null
     or array_length(p_player_cols, 1) <> array_length(p_new_values, 1) then
    raise exception 'check_no_active_match: p_player_cols y p_new_values deben tener la misma longitud (tabla %)', p_table;
  end if;

  -- v_col_list: "m.col_a, m.col_b, m.col_c" — columnas a comparar del
  -- lado de la fila EXISTENTE, ya calificadas con el alias `m` que usa
  -- la subconsulta de más abajo (evita ambigüedad si en el futuro esta
  -- función se llama desde un contexto con más de un FROM en juego).
  select string_agg('m.' || quote_ident(col), ', ')
  into v_col_list
  from unnest(p_player_cols) as col;

  -- v_new_conditions: "(p_new_values[1] is not null and p_new_values[1] in (m.col_a, m.col_b, ...)) or ..."
  -- — una condición por cada columna de la fila NUEVA, cada una
  -- comparada contra TODAS las columnas de la fila existente (mismo
  -- criterio "cualquier rol mío pisa cualquier rol tuyo" que las 4
  -- implementaciones originales, necesario porque nada obliga a que un
  -- jugador reaparezca en la misma columna de rol de una partida a la
  -- siguiente).
  v_new_conditions := '';
  for i in 1 .. array_length(p_player_cols, 1) loop
    if p_new_values[i] is not null then
      if v_new_conditions <> '' then
        v_new_conditions := v_new_conditions || ' or ';
      end if;
      v_new_conditions := v_new_conditions
        || format('%L in (%s)', p_new_values[i], v_col_list);
    end if;
  end loop;

  -- Si ninguna columna de jugador viene con valor (p.ej. un INSERT que
  -- todavía no asigna ningún rol), no hay nada que chequear — mismo
  -- comportamiento implícito que las 4 versiones originales, que en ese
  -- caso el OR completo se evalúa false.
  if v_new_conditions = '' then
    return;
  end if;

  v_sql := format(
    'select count(*) from public.%I m
       where m.id <> %L
         and m.status = any(%L::text[])
         and (%s)',
    p_table,
    p_new_id,
    p_active_states,
    v_new_conditions
  );

  execute v_sql into v_conflicting_count;

  if v_conflicting_count > 0 then
    raise exception '%', p_error_message using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.check_no_active_match(text, text[], text[], uuid, text[], text) from public;
-- Sin grant a anon/authenticated: solo se invoca vía `perform` desde
-- dentro de las funciones `security definer` de cada trigger (mismo
-- alcance que las funciones que reemplaza, que tampoco eran ejecutables
-- directo por el cliente).

-- 2. Los 4 triggers existentes pasan a delegar en la función genérica ---------
-- Los nombres de función y de trigger NO cambian — `create or replace
-- function` solo reemplaza el CUERPO, y ningún `create trigger` de acá
-- para abajo hace falta re-ejecutar porque siguen apuntando al mismo
-- nombre de función que ya tenían asociado.

create or replace function public.prevent_double_active_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('waiting', 'playing') then
    return new;
  end if;

  perform public.check_no_active_match(
    p_table         => 'lobby_matches',
    p_player_cols   => array['player1_id', 'player2_id'],
    p_active_states => array['waiting', 'playing'],
    p_new_id        => new.id,
    p_new_values    => array[new.player1_id, new.player2_id],
    p_error_message => 'player_already_in_active_match'
  );

  return new;
end;
$$;

create or replace function public.prevent_double_active_st_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('waiting', 'playing') then
    return new;
  end if;

  perform public.check_no_active_match(
    p_table         => 'signal_triangulation_matches',
    p_player_cols   => array['player1_id', 'player2_id', 'player3_id'],
    p_active_states => array['waiting', 'playing'],
    p_new_id        => new.id,
    p_new_values    => array[new.player1_id, new.player2_id, new.player3_id],
    p_error_message => 'player_already_in_active_match'
  );

  return new;
end;
$$;

create or replace function public.prevent_double_active_sc_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('waiting', 'playing') then
    return new;
  end if;

  perform public.check_no_active_match(
    p_table         => 'ship_control_matches',
    p_player_cols   => array['navigation_player_id', 'sensors_player_id', 'energy_player_id', 'comms_player_id'],
    p_active_states => array['waiting', 'playing'],
    p_new_id        => new.id,
    p_new_values    => array[new.navigation_player_id, new.sensors_player_id, new.energy_player_id, new.comms_player_id],
    p_error_message => 'player_already_in_active_match'
  );

  return new;
end;
$$;

create or replace function public.prevent_double_active_fl_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- FL nunca tuvo el early-return "if new.status not in (...) then
  -- return" que las otras 3 sí tienen (ver migration_018) — se preserva
  -- ese comportamiento tal cual (chequea en cualquier status) para no
  -- introducir un cambio de conducta no pedido en esta migración.
  perform public.check_no_active_match(
    p_table         => 'fragmented_labyrinth_matches',
    p_player_cols   => array['role_a_id', 'role_b_id', 'role_c_id', 'role_d_id'],
    p_active_states => array['waiting', 'playing'],
    p_new_id        => new.id,
    p_new_values    => array[new.role_a_id, new.role_b_id, new.role_c_id, new.role_d_id],
    p_error_message => 'player_already_in_active_fl_match'
  );

  return new;
end;
$$;

-- 3. Verificación manual sugerida tras aplicar (Supabase SQL editor):
--   select public.check_no_active_match(
--     'lobby_matches', array['player1_id','player2_id'],
--     array['waiting','playing'],
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     array['algun-player-id-ya-activo', null], 'player_already_in_active_match'
--   );
--     → check_no_active_match devuelve void (no hay valor que inspeccionar
--       en el resultado): la señal es si el statement TERMINA en error o
--       no. Si 'algun-player-id-ya-activo' de verdad tiene una fila
--       waiting/playing en lobby_matches, este select debe fallar con
--       "player_already_in_active_match" (SQLSTATE P0001); si no tiene
--       ninguna fila activa, el select debe completar sin error
--       (columna "check_no_active_match" con una fila vacía/void).
--   Y el flujo normal de la app (crear partida en cada uno de los 4
--   minijuegos, intentar crear una segunda sin salir de la primera)
--   debe seguir rechazando exactamente igual que antes de esta migración.
-- ============================================================================
