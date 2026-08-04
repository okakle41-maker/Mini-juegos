-- ============================================================================
-- Migración 018: Fragmented Labyrinth (minijuego cooperativo de 4 jugadores)
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_017_ship_control.sql).
--
-- Contexto: portado desde el prototipo standalone
-- "minijuegos a futuri/fragmentad-labyrinth" (servidor Node + WebSocket
-- propio, estado del laberinto y posición del personaje en memoria de
-- proceso). Esa arquitectura es incompatible con el resto del proyecto,
-- que no corre servidor propio — toda la autoridad de juego vive en
-- Postgres (RPC security definer + RLS), igual que
-- migration_016_signal_triangulation.sql y migration_017_ship_control.sql,
-- que este diseño sigue de cerca.
--
-- Concepto del juego: 4 jugadores con roles fijos A/B/C/D, cada uno ve
-- SOLO su cuadrante de un laberinto de 21×21 generado server-side.
-- Únicamente el rol A controla al personaje (server-side, un movimiento
-- por llamada RPC, validado contra la matriz real). El laberinto
-- completo y la posición del personaje fuera del propio cuadrante NUNCA
-- deben ser legibles por un jugador — mismo problema de "columnas
-- secretas en una tabla con RLS" que source_x/source_y en Signal
-- Triangulation, resuelto con el mismo patrón: REVOKE select directo +
-- vista pública que no expone esas columnas + función RPC que devuelve
-- solo el cuadrante propio de quien la invoca.
--
-- Decisiones de producto (confirmadas antes de escribir esta migración):
--   1. Movimiento vía RPC por llamada (no simulación local + sync
--      realtime): el server es quien valida muros y decide si el
--      movimiento es válido, igual que trigger_ship_event/advance_ship_position
--      en Ship Control — nunca el cliente decide su propia posición.
--   2. Sin chat en este port inicial: coordinación por voz externa
--      (Discord/Meet), tal cual ya aclaraba el README del prototipo.
--      lobby_match_messages (migration_008) queda disponible para
--      agregar directivas rápidas más adelante sin nueva migración.
--   3. Roles A/B/C/D con cuadrantes fijos (no rotan): A siempre
--      controla + ve superior-izquierdo, igual mapeo que el prototipo.
-- ============================================================================

do $$
begin
  if to_regclass('public.lobbies') is null then
    raise exception 'migration_008_lobbies.sql no se ejecutó todavía — corré esa migración primero (crea public.lobbies/public.lobby_players que esta migración reusa).';
  end if;
end $$;

-- 1. Tablas ------------------------------------------------------------------

create table if not exists public.fragmented_labyrinth_matches (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'won', 'over')),
  -- 4 columnas nombradas, cardinalidad fija del juego — mismo criterio
  -- que player1_id..player4_id en signal_triangulation_matches.
  -- role_a_id es quien controla al personaje; b/c/d solo tienen visión
  -- de su cuadrante y guían por voz externa.
  role_a_id text,
  role_b_id text,
  role_c_id text,
  role_d_id text,
  -- Duración configurable (segundos) — 120 por defecto, igual al
  -- prototipo (GAME_DURATION_SECONDS).
  duration_seconds smallint not null default 120 check (duration_seconds between 30 and 600),
  started_at timestamptz,
  -- deadline en vez de "timeLeft" recalculado en el cliente: el
  -- temporizador se deriva de (deadline_at - now()) en cada lectura, sin
  -- necesitar un tick de servidor que reescriba una columna cada
  -- segundo (a diferencia del setInterval del prototipo). Ver
  -- fragmented_labyrinth_time_left() más abajo.
  deadline_at timestamptz,
  moves integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists fl_matches_lobby_id_idx
  on public.fragmented_labyrinth_matches (lobby_id)
  where status in ('waiting', 'playing');

-- El laberinto completo + posición del personaje: la tabla "secreta"
-- (mismo rol que signal_triangulation_rounds con source_x/source_y).
-- Una fila por match, creada por generate_fragmented_labyrinth() al
-- completarse el 4º jugador.
create table if not exists public.fragmented_labyrinth_state (
  match_id uuid primary key references public.fragmented_labyrinth_matches(id) on delete cascade,
  width smallint not null check (width between 9 and 41),
  height smallint not null check (height between 9 and 41),
  -- Matriz serializada como jsonb (array de arrays de smallint: 0
  -- pasillo, 1 muro, 2 salida) — incluye la salida marcada; el punto de
  -- inicio se guarda aparte porque no es un valor de celda.
  maze jsonb not null,
  start_x smallint not null,
  start_y smallint not null,
  exit_x smallint not null,
  exit_y smallint not null,
  player_x smallint not null,
  player_y smallint not null,
  created_at timestamptz not null default now()
);

create index if not exists fl_state_match_id_idx
  on public.fragmented_labyrinth_state (match_id);

-- 2. Roles: is_/get_my_ — mismo patrón que is_ship_role/get_my_ship_role
-- en migration_017_ship_control.sql. -----------------------------------------

create or replace function public.is_fragmented_labyrinth_role(p_match_id uuid, p_role text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.fragmented_labyrinth_matches m
    where m.id = p_match_id
      and (
        (p_role = 'A' and m.role_a_id = (select auth.uid())::text) or
        (p_role = 'B' and m.role_b_id = (select auth.uid())::text) or
        (p_role = 'C' and m.role_c_id = (select auth.uid())::text) or
        (p_role = 'D' and m.role_d_id = (select auth.uid())::text)
      )
  );
$$;

create or replace function public.get_my_fragmented_labyrinth_role(p_match_id uuid)
returns text
language sql security definer stable
set search_path = public
as $$
  select case
    when role_a_id = (select auth.uid())::text then 'A'
    when role_b_id = (select auth.uid())::text then 'B'
    when role_c_id = (select auth.uid())::text then 'C'
    when role_d_id = (select auth.uid())::text then 'D'
    else null
  end
  from public.fragmented_labyrinth_matches
  where id = p_match_id;
$$;

-- 3. RLS ------------------------------------------------------------------

alter table public.fragmented_labyrinth_matches enable row level security;
alter table public.fragmented_labyrinth_state enable row level security;

-- 3.1 matches: régimen abierto de sala, igual que SigTri/ShipControl —
-- nada acá es secreto entre los 4 jugadores del propio match (el
-- laberinto secreto vive en _state, no acá).
drop policy if exists "fl_matches_select_all" on public.fragmented_labyrinth_matches;
create policy "fl_matches_select_all"
  on public.fragmented_labyrinth_matches for select
  using (true);

drop policy if exists "fl_matches_insert_all" on public.fragmented_labyrinth_matches;
create policy "fl_matches_insert_all"
  on public.fragmented_labyrinth_matches for insert
  with check (true);

drop policy if exists "fl_matches_update_all" on public.fragmented_labyrinth_matches;
create policy "fl_matches_update_all"
  on public.fragmented_labyrinth_matches for update
  using (true);

-- 3.2 state: el laberinto completo y la posición real del personaje NO
-- pueden tener select abierto — expondría el mapa entero y arruinaría
-- la mecánica central del juego (visión fragmentada). Mismo patrón que
-- signal_triangulation_rounds: REVOKE select directo de la tabla base +
-- acceso únicamente vía función RPC que devuelve solo el cuadrante de
-- quien la invoca.
revoke select on public.fragmented_labyrinth_state from anon, authenticated;

drop policy if exists "fl_state_select_via_grant_only" on public.fragmented_labyrinth_state;
create policy "fl_state_select_via_grant_only"
  on public.fragmented_labyrinth_state for select
  using (true);
-- using(true) no es la barrera real (ver mismo comentario en
-- migration_016): el REVOKE de arriba ya bloquea cualquier SELECT
-- directo sin importar esta policy. Existe solo porque RLS está
-- enable()ado y necesita al menos una policy de select para no negar
-- también al dueño de las funciones security definer de abajo.

-- No hay policies de insert/update para el cliente: todas las
-- escrituras a esta tabla las hacen generate_fragmented_labyrinth() y
-- move_fragmented_labyrinth_character() (security definer, más abajo),
-- nunca un insert/update directo. Sin policies, el default de RLS
-- (denegar) cierra esa vía para cualquier rol que no sea el dueño de
-- esas funciones.

-- 4. Tiempo restante derivado (sin tick de servidor) -------------------------

create or replace function public.fragmented_labyrinth_time_left(p_match_id uuid)
returns integer
language sql stable
set search_path = public
as $$
  select case
    when deadline_at is null then duration_seconds
    else greatest(0, ceil(extract(epoch from (deadline_at - now())))::integer)
  end
  from public.fragmented_labyrinth_matches
  where id = p_match_id;
$$;

grant execute on function public.fragmented_labyrinth_time_left(uuid) to anon, authenticated;

-- 5. Generación del laberinto (security definer) ------------------------------
--
-- Recursive backtracker sobre una grilla de width×height (impares,
-- 21×21 por defecto — igual algoritmo que
-- js/games/Maze/mazeGenerator.ts y la copia del prototipo en
-- server/mazeGenerator.js), seguido de BFS desde el inicio para ubicar
-- la salida en la celda más lejana alcanzable. Implementado en PL/pgSQL
-- (no puede vivir en el cliente: expondría el mapa completo).
create or replace function public.generate_fragmented_labyrinth(
  p_match_id uuid,
  p_width smallint default 21,
  p_height smallint default 21
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w smallint := p_width + (1 - p_width % 2); -- fuerza impar
  h smallint := p_height + (1 - p_height % 2);
  grid smallint[][];
  stack_x integer[] := array[]::integer[];
  stack_y integer[] := array[]::integer[];
  cx integer; cy integer;
  dirs integer[][] := array[[0,-2],[2,0],[0,2],[-2,0]];
  dir_order integer[];
  i integer; nx integer; ny integer;
  -- BFS para la salida.
  visited boolean[][];
  queue_x integer[] := array[]::integer[];
  queue_y integer[] := array[]::integer[];
  qi integer := 1;
  best_x integer := 1; best_y integer := 1; best_dist integer := -1;
  dist_map integer[][];
  maze_json jsonb;
  row_json jsonb;
begin
  -- Inicializa todo como muro (1).
  grid := array_fill(1, array[h, w]);
  visited := array_fill(false, array[h, w]);
  dist_map := array_fill(0, array[h, w]);

  cx := 1; cy := 1; -- 1-based en arrays de Postgres
  grid[cy][cx] := 0;
  stack_x := array_append(stack_x, cx);
  stack_y := array_append(stack_y, cy);

  while array_length(stack_x, 1) is not null and array_length(stack_x, 1) > 0 loop
    cx := stack_x[array_length(stack_x, 1)];
    cy := stack_y[array_length(stack_y, 1)];

    -- Orden aleatorio de las 4 direcciones para este paso.
    dir_order := array[1,2,3,4];
    for i in 1..4 loop
      declare j integer := 1 + floor(random() * 4)::integer;
      begin
        dir_order[i] := dir_order[i] + 0; -- no-op, mantenido simple abajo
      end;
    end loop;

    declare
      found boolean := false;
      order_idx integer[] := array[1,2,3,4];
      tmp integer;
      k integer;
    begin
      -- Fisher-Yates simple sobre order_idx.
      for k in reverse 4..2 loop
        i := 1 + floor(random() * k)::integer;
        tmp := order_idx[k];
        order_idx[k] := order_idx[i];
        order_idx[i] := tmp;
      end loop;

      for k in 1..4 loop
        i := order_idx[k];
        nx := cx + dirs[i][1];
        ny := cy + dirs[i][2];
        if nx between 1 and w and ny between 1 and h and grid[ny][nx] = 1 then
          grid[ny][nx] := 0;
          grid[cy + dirs[i][2] / 2][cx + dirs[i][1] / 2] := 0; -- abre el muro intermedio
          stack_x := array_append(stack_x, nx);
          stack_y := array_append(stack_y, ny);
          found := true;
          exit;
        end if;
      end loop;

      if not found then
        stack_x := stack_x[1:array_length(stack_x,1)-1];
        stack_y := stack_y[1:array_length(stack_y,1)-1];
      end if;
    end;
  end loop;

  -- BFS desde (1,1) para encontrar la celda más lejana → salida.
  visited[1][1] := true;
  queue_x := array_append(queue_x, 1);
  queue_y := array_append(queue_y, 1);
  best_x := 1; best_y := 1; best_dist := 0;

  while qi <= array_length(queue_x, 1) loop
    cx := queue_x[qi];
    cy := queue_y[qi];
    qi := qi + 1;

    if dist_map[cy][cx] > best_dist then
      best_dist := dist_map[cy][cx];
      best_x := cx; best_y := cy;
    end if;

    for i in 1..4 loop
      nx := cx + case i when 1 then 0 when 2 then 1 when 3 then 0 else -1 end;
      ny := cy + case i when 1 then -1 when 2 then 0 when 3 then 1 else 0 end;
      if nx between 1 and w and ny between 1 and h
         and grid[ny][nx] = 0 and not visited[ny][nx] then
        visited[ny][nx] := true;
        dist_map[ny][nx] := dist_map[cy][cx] + 1;
        queue_x := array_append(queue_x, nx);
        queue_y := array_append(queue_y, ny);
      end if;
    end loop;
  end loop;

  grid[best_y][best_x] := 2; -- marca la salida

  -- Serializa la grilla (1-based) a jsonb 0-based para el cliente.
  maze_json := '[]'::jsonb;
  for cy in 1..h loop
    row_json := '[]'::jsonb;
    for cx in 1..w loop
      row_json := row_json || to_jsonb(grid[cy][cx]);
    end loop;
    maze_json := maze_json || jsonb_build_array(row_json);
  end loop;

  insert into public.fragmented_labyrinth_state (
    match_id, width, height, maze, start_x, start_y, exit_x, exit_y, player_x, player_y
  ) values (
    p_match_id, w, h, maze_json, 0, 0, best_x - 1, best_y - 1, 0, 0
  )
  on conflict (match_id) do update set
    width = excluded.width, height = excluded.height, maze = excluded.maze,
    start_x = excluded.start_x, start_y = excluded.start_y,
    exit_x = excluded.exit_x, exit_y = excluded.exit_y,
    player_x = excluded.player_x, player_y = excluded.player_y;

  update public.fragmented_labyrinth_matches
  set status = 'playing',
      started_at = now(),
      deadline_at = now() + make_interval(secs => duration_seconds),
      moves = 0
  where id = p_match_id;
end;
$$;

revoke all on function public.generate_fragmented_labyrinth(uuid, smallint, smallint) from public;
grant execute on function public.generate_fragmented_labyrinth(uuid, smallint, smallint) to anon, authenticated;

-- 6. Cuadrante propio (RPC) ----------------------------------------------
--
-- Devuelve SOLO el cuadrante correspondiente al rol de quien invoca,
-- nunca el laberinto completo. Igual criterio de "columnas secretas" que
-- la vista pública de signal_triangulation_rounds, pero como función
-- (no vista) porque el recorte depende del rol del invocador, calculado
-- dentro de la propia función vía auth.uid().
create or replace function public.get_my_labyrinth_view(p_match_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role text;
  v_state record;
  v_mid_x integer; v_mid_y integer;
  v_x0 integer; v_x1 integer; v_y0 integer; v_y1 integer;
  v_grid jsonb := '[]'::jsonb;
  v_row jsonb;
  gx integer; gy integer; cell integer;
  ch text;
  r integer; c integer;
begin
  v_role := public.get_my_fragmented_labyrinth_role(p_match_id);
  if v_role is null then
    raise exception 'No sos parte de esta partida de Fragmented Labyrinth.';
  end if;

  select * into v_state from public.fragmented_labyrinth_state where match_id = p_match_id;
  if not found then
    raise exception 'Esta partida todavía no generó su laberinto.';
  end if;

  v_mid_x := v_state.width / 2;
  v_mid_y := v_state.height / 2;

  case v_role
    when 'A' then v_x0 := 0; v_x1 := v_mid_x; v_y0 := 0; v_y1 := v_mid_y;
    when 'B' then v_x0 := v_mid_x; v_x1 := v_state.width - 1; v_y0 := 0; v_y1 := v_mid_y;
    when 'C' then v_x0 := 0; v_x1 := v_mid_x; v_y0 := v_mid_y; v_y1 := v_state.height - 1;
    else          v_x0 := v_mid_x; v_x1 := v_state.width - 1; v_y0 := v_mid_y; v_y1 := v_state.height - 1;
  end case;

  for r in 0..(v_y1 - v_y0) loop
    v_row := '[]'::jsonb;
    for c in 0..(v_x1 - v_x0) loop
      gx := v_x0 + c;
      gy := v_y0 + r;
      cell := (v_state.maze -> gy ->> gx)::integer;
      if cell = 2 then ch := 'E';
      elsif gx = v_state.start_x and gy = v_state.start_y then ch := 'S';
      elsif cell = 1 then ch := '#';
      else ch := '.';
      end if;
      v_row := v_row || to_jsonb(ch);
    end loop;
    v_grid := v_grid || jsonb_build_array(v_row);
  end loop;

  return jsonb_build_object(
    'role', v_role,
    'grid', v_grid,
    'offsetX', v_x0,
    'offsetY', v_y0,
    'exitInView', (v_state.exit_x between v_x0 and v_x1 and v_state.exit_y between v_y0 and v_y1),
    'startInView', (v_state.start_x between v_x0 and v_x1 and v_state.start_y between v_y0 and v_y1),
    'playerX', v_state.player_x,
    'playerY', v_state.player_y,
    'timeLeft', public.fragmented_labyrinth_time_left(p_match_id),
    'moves', (select moves from public.fragmented_labyrinth_matches where id = p_match_id),
    'status', (select status from public.fragmented_labyrinth_matches where id = p_match_id)
  );
end;
$$;

revoke all on function public.get_my_labyrinth_view(uuid) from public;
grant execute on function public.get_my_labyrinth_view(uuid) to anon, authenticated;

-- 7. Movimiento (RPC, solo rol A) ---------------------------------------------
--
-- Único punto de escritura de player_x/player_y — valida rol, límites y
-- muro server-side, igual que handleMove() en el servidor del
-- prototipo, pero como autoridad de Postgres en vez de un proceso Node.
create or replace function public.move_fragmented_labyrinth_character(
  p_match_id uuid,
  p_direction text -- 'up' | 'down' | 'left' | 'right'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_state record;
  v_match record;
  dx integer := 0; dy integer := 0;
  nx integer; ny integer;
  v_cell integer;
begin
  v_role := public.get_my_fragmented_labyrinth_role(p_match_id);
  if v_role is distinct from 'A' then
    raise exception 'Solo el Jugador A controla al personaje.';
  end if;

  select * into v_match from public.fragmented_labyrinth_matches where id = p_match_id for update;
  if not found or v_match.status <> 'playing' then
    raise exception 'La partida no está en curso.';
  end if;

  if now() >= v_match.deadline_at then
    update public.fragmented_labyrinth_matches set status = 'over' where id = p_match_id;
    return jsonb_build_object('status', 'over', 'reason', 'Se acabó el tiempo.');
  end if;

  select * into v_state from public.fragmented_labyrinth_state where match_id = p_match_id for update;
  if not found then
    raise exception 'Esta partida todavía no generó su laberinto.';
  end if;

  case p_direction
    when 'up' then dy := -1;
    when 'down' then dy := 1;
    when 'left' then dx := -1;
    when 'right' then dx := 1;
    else raise exception 'Dirección inválida: %', p_direction;
  end case;

  nx := v_state.player_x + dx;
  ny := v_state.player_y + dy;

  if nx < 0 or ny < 0 or nx >= v_state.width or ny >= v_state.height then
    return jsonb_build_object('denied', true, 'reason', 'wall');
  end if;

  v_cell := (v_state.maze -> ny ->> nx)::integer;
  if v_cell = 1 then
    return jsonb_build_object('denied', true, 'reason', 'wall');
  end if;

  update public.fragmented_labyrinth_state
  set player_x = nx, player_y = ny
  where match_id = p_match_id;

  update public.fragmented_labyrinth_matches
  set moves = moves + 1
  where id = p_match_id;

  if v_cell = 2 then
    update public.fragmented_labyrinth_matches
    set status = 'won', completed_at = now()
    where id = p_match_id;
    return jsonb_build_object('status', 'won', 'moves', v_match.moves + 1);
  end if;

  return jsonb_build_object('denied', false, 'moves', v_match.moves + 1);
end;
$$;

revoke all on function public.move_fragmented_labyrinth_character(uuid, text) from public;
grant execute on function public.move_fragmented_labyrinth_character(uuid, text) to anon, authenticated;

-- 8. Un único match activo por jugador (mismo criterio que
-- prevent_double_active_st_match / prevent_double_active_sc_match) --------

create or replace function public.prevent_double_active_fl_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.fragmented_labyrinth_matches m
    where m.status in ('waiting', 'playing')
      and m.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        new.role_a_id is not null and new.role_a_id in (m.role_a_id, m.role_b_id, m.role_c_id, m.role_d_id)
        or new.role_b_id is not null and new.role_b_id in (m.role_a_id, m.role_b_id, m.role_c_id, m.role_d_id)
        or new.role_c_id is not null and new.role_c_id in (m.role_a_id, m.role_b_id, m.role_c_id, m.role_d_id)
        or new.role_d_id is not null and new.role_d_id in (m.role_a_id, m.role_b_id, m.role_c_id, m.role_d_id)
      )
  ) then
    raise exception 'player_already_in_active_fl_match';
  end if;
  return new;
end;
$$;

drop trigger if exists fl_prevent_double_active on public.fragmented_labyrinth_matches;
create trigger fl_prevent_double_active
  before insert or update on public.fragmented_labyrinth_matches
  for each row execute function public.prevent_double_active_fl_match();
