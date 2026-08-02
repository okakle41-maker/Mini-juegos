-- ============================================================================
-- Migración 017: Centro de Control de una Nave (minijuego cooperativo de 4 jugadores)
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_016_signal_triangulation.sql).
--
-- Contexto (ver diseño completo, ship-control-design.md, revisión v2):
-- mismo criterio de encaje que Signal Triangulation (migration_016) — 4
-- jugadores simultáneos, sin modo solo, no cabe en lobby_matches (2
-- columnas fijas). Tabla nueva paralela, reusando lobbies/lobby_players
-- para sala/presencia. A diferencia de SigTri (una decisión puntual por
-- ronda), esto es un flujo continuo de estado compartido con eventos —
-- una máquina de estados con log de acciones, no "rondas" con intentos.
--
-- Decisiones de producto confirmadas antes de escribir esta migración:
--   1. Cadencia de eventos: aleatoria, con probabilidad CRECIENTE a
--      medida que avanza la partida (no un guion fijo de N eventos).
--   2. Condición de victoria: llegar a un punto de destino
--      (position_x/position_y objetivo), no "sobrevivir T minutos" ni
--      "sobrevivir N eventos" — aunque events_survived se seguía
--      registrando como métrica secundaria.
--   3. Penalización de fallo: resta 1 de X vidas (lives, no
--      hull_integrity 0-100 como en el borrador — más legible para 4
--      personas coordinando por voz bajo presión: "nos queda 1 vida" es
--      más claro que "38% de integridad") Y ADEMÁS aumenta la cadencia
--      de eventos futuros (el barco se vuelve más caótico cuantas más
--      fallas acumula — refuerza la decisión #1).
--   4. Timeout: el proyecto NO tiene pg_cron disponible (ver
--      migration_009_lobby_expiration.sql, que ya documentó esto y
--      resolvió el mismo problema de "esto debería pasar solo con el
--      tiempo" con una función de barrido invocada oportunísticamente
--      en vez de un job de servidor). Se sigue el mismo patrón acá:
--      sweep_ship_events() se invoca desde submit_ship_action() en cada
--      acción de cualquier rol, y el cliente puede además invocarla por
--      polling ligero (ver nota en sección 6). Si en el futuro el
--      proyecto confirma pg_cron habilitado, agregar
--      `select cron.schedule(...)` es un cambio de una línea sobre esta
--      misma función, no un rediseño.
--   5. Dificultad de partida: dos perfiles ('normal' y 'dificil'),
--      elegidos al crear la partida (matches.difficulty) — 'dificil'
--      sube el mix de difficulty_tier de eventos más rápido y acorta
--      timeouts (ver trigger_ship_event, sección 5).
--   6. Daño de fallo basado en dificultad del EVENTO (no un valor fijo
--      por match): un evento tier 1 fallado cuesta menos que un tier 3
--      compuesto — ship_control_event_types.hull_damage_on_fail pasa a
--      significar "vidas perdidas" (normalmente 1, pero tier 3 puede
--      configurarse para costar más en dificultad 'dificil').
--   7. Tolerancia de decodificación: 1 carácter de margen en el código
--      Morse decodificado (Levenshtein <= 1), checksum exacto (0 margen
--      — es 1 sola cifra).
--   8. Curva de dificultad progresiva vía difficulty_tier (1-3) en el
--      catálogo de eventos, ponderada según events_survived Y
--      lives_lost (ver trigger_ship_event, sección 5).
--
-- El generador/evaluador de cada evento (Morse, checksum, ruido de
-- sensor, secuencia de encendido, rumbo de evasión) vive ÚNICAMENTE en
-- funciones server-side de esta migración — security definer, nunca
-- alcanzable desde el bundle del cliente. Mismo criterio de aislamiento
-- que generate_signal_triangulation_round y
-- generate_sudoku_coop_puzzle.
-- ============================================================================

do $$
begin
  if to_regclass('public.lobbies') is null then
    raise exception 'migration_008_lobbies.sql no se ejecutó todavía — corré esa migración primero (crea public.lobbies/public.lobby_players que esta migración reusa).';
  end if;
end $$;

-- 1. Tablas -------------------------------------------------------------

create table if not exists public.ship_control_matches (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'completed', 'abandoned', 'failed')),
  -- Roles fijos con nombre (no slots numerados — el rol SÍ importa
  -- semánticamente para el resto del sistema, a diferencia de las
  -- antenas intercambiables de SigTri).
  navigation_player_id text,
  sensors_player_id text,
  energy_player_id text,
  comms_player_id text,
  -- Decisión #5: perfil de dificultad elegido al crear la partida.
  difficulty text not null default 'normal' check (difficulty in ('normal', 'dificil')),
  -- Decisión #3: vidas en vez de hull_integrity 0-100 (más legible bajo
  -- presión de voz). Un evento fallado resta 1 (o más, tier alto en
  -- 'dificil' — ver decisión #6) hasta llegar a 0, ahí status='failed'.
  lives smallint not null default 3 check (lives >= 0),
  max_lives smallint not null default 3 check (max_lives between 1 and 9),
  -- Decisión #2: condición de victoria es llegar a un destino, no
  -- sobrevivir tiempo/eventos — position_x/y objetivo generado al
  -- crear la partida (ver trigger de creación, sección 4).
  destination_x smallint check (destination_x between 0 and 99),
  destination_y smallint check (destination_y between 0 and 99),
  -- Métrica secundaria — ya no es condición de victoria, pero se sigue
  -- registrando para el resumen final y para ponderar la curva de
  -- dificultad (decisión #8).
  events_survived smallint not null default 0,
  events_failed smallint not null default 0,
  -- Decisión #1 + #3: probabilidad base de que se dispare un evento en
  -- cada tick de evaluación, y cuánto sube por evento sobrevivido y por
  -- evento fallado — ver trigger_ship_event (sección 5) para el uso
  -- exacto de estos 3 valores.
  event_probability_base numeric(4,3) not null default 0.150
    check (event_probability_base between 0 and 1),
  event_probability_current numeric(4,3) not null default 0.150
    check (event_probability_current between 0 and 1),
  event_probability_growth_per_event numeric(4,3) not null default 0.020,
  event_probability_growth_per_failure numeric(4,3) not null default 0.060,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sc_matches_lobby_id_idx
  on public.ship_control_matches (lobby_id)
  where status in ('waiting', 'playing');

-- Estado MUTABLE y compartido de la nave — cada rol lee de acá
-- (filtrado por su propia visibilidad, ver RLS sección 3) y las
-- acciones de un rol modifican esto, lo cual el resto observa en su
-- panel vía Realtime/polling.
create table if not exists public.ship_control_state (
  match_id uuid primary key references public.ship_control_matches(id) on delete cascade,
  -- Navegación
  heading_deg smallint not null default 0 check (heading_deg between 0 and 359),
  speed smallint not null default 0 check (speed between 0 and 100),
  position_x smallint not null default 50 check (position_x between 0 and 99),
  position_y smallint not null default 50 check (position_y between 0 and 99),
  -- Energía: 5 sistemas, deben sumar como máximo 100 (trigger de
  -- validación, sección 6).
  power_shields smallint not null default 20 check (power_shields between 0 and 100),
  power_engines smallint not null default 20 check (power_engines between 0 and 100),
  power_comms smallint not null default 20 check (power_comms between 0 and 100),
  power_weapons smallint not null default 20 check (power_weapons between 0 and 100),
  power_life_support smallint not null default 20 check (power_life_support between 0 and 100),
  updated_at timestamptz not null default now()
);

-- Catálogo de eventos posibles — server-side, define qué le llega a
-- cada rol, qué mecánicas aplica, y la condición de éxito.
create table if not exists public.ship_control_event_types (
  code text primary key,
  -- Mensaje narrativo por rol (JSON: {"sensors": "...", "comms": "...", ...})
  -- — puede tener null para un rol si ese evento no le manda nada.
  role_messages jsonb not null,
  -- Banderas de mecánica — combinables, no un enum único (ej. misil =
  -- morse + checksum + triangulación con ruido).
  requires_morse boolean not null default false,
  requires_checksum boolean not null default false,
  requires_triangulation boolean not null default false,
  requires_power_sequence boolean not null default false,
  -- Orden esperado de pasos si requires_power_sequence, ej.
  -- '["stabilize_reactor","restore_comms","restore_shields"]'::jsonb
  power_sequence jsonb,
  -- Decisión #8: 1 = mecánica simple (v1), 2 = una mecánica nueva
  -- (morse O ruido O secuencia), 3 = evento compuesto tipo "Misil
  -- entrante" v2 con varias combinadas. trigger_ship_event pondera
  -- hacia tier 1 al inicio de la partida y sube el mix con
  -- events_survived/lives perdidas (sección 5).
  difficulty_tier smallint not null default 1 check (difficulty_tier between 1 and 3),
  timeout_seconds smallint not null default 45,
  -- Decisión #6: vidas que cuesta fallar ESTE evento — normalmente 1,
  -- pero un tier 3 puede configurarse a 2 en dificultad 'dificil' (el
  -- multiplicador de dificultad se aplica en trigger de resolución,
  -- sección 6, no acá — este valor es el base en dificultad 'normal').
  lives_lost_on_fail smallint not null default 1 check (lives_lost_on_fail between 1 and 3)
);

-- Instancia de un evento activo/resuelto/fallido en una partida.
create table if not exists public.ship_control_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.ship_control_matches(id) on delete cascade,
  event_code text not null references public.ship_control_event_types(code),
  status text not null default 'active'
    check (status in ('active', 'resolved', 'failed')),
  role_messages_resolved jsonb not null,
  -- La "solución" server-only de este evento — nunca se expone directo
  -- al cliente, solo se usa para comparar contra las acciones
  -- registradas. Ejemplo para el misil:
  -- {"morse_code": "349", "checksum_digit": 7, "hazard_true_bearing":
  --  132, "hazard_true_distance": 42, "correct_evasion_heading": 222,
  --  "evasion_tolerance_deg": 10, "min_shields_pct": 60}
  hidden_solution jsonb not null,
  -- Rango de error de la lectura de Sensores para ESTA instancia (fijo
  -- durante toda su duración) — ej.
  -- {"bearing_noise_deg": -12, "distance_noise_pct": 8}
  sensor_noise jsonb,
  triggered_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  resolved_at timestamptz
);

create index if not exists sc_events_match_active_idx
  on public.ship_control_events (match_id)
  where status = 'active';

create index if not exists sc_events_deadline_idx
  on public.ship_control_events (deadline_at)
  where status = 'active';

-- Progreso parcial de un evento compuesto — necesario porque un evento
-- puede tener sub-pasos que se cumplen en momentos distintos
-- (Comunicaciones decodifica antes de que Sensores pueda calcular;
-- Energía avanza su secuencia paso a paso).
create table if not exists public.ship_control_event_progress (
  event_id uuid primary key references public.ship_control_events(id) on delete cascade,
  -- true una vez que Comunicaciones acertó submit_decoded_code para
  -- este evento (dentro de tolerancia, decisión #7) — habilita que
  -- Sensores vea el offset real de trayectoria en su cálculo.
  comms_decoded boolean not null default false,
  -- índice del próximo paso esperado en power_sequence (0-based), null
  -- si el evento no requiere secuencia.
  power_sequence_step smallint,
  -- último rumbo que Navegación confirmó, para comparar contra
  -- hidden_solution.correct_evasion_heading con tolerancia.
  last_confirmed_heading smallint,
  updated_at timestamptz not null default now()
);

-- Log de acciones — auditoría de qué hizo cada rol y cuándo. Necesario
-- para condiciones tipo "no hubo corte de escudos en los últimos 10s",
-- que no se pueden derivar de un valor puntual de progreso.
create table if not exists public.ship_control_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.ship_control_matches(id) on delete cascade,
  player_id text not null,
  role text not null check (role in ('navigation', 'sensors', 'energy', 'comms')),
  action_type text not null,
  -- 'set_heading' | 'set_speed' | 'redistribute_power' |
  -- 'submit_decoded_code' | 'refine_sensor_reading' |
  -- 'submit_evasion_bearing' | 'reactor_sequence_step' | ...
  action_payload jsonb not null default '{}'::jsonb,
  event_id uuid references public.ship_control_events(id) on delete set null,
  was_correct boolean,
  created_at timestamptz not null default now()
);

create index if not exists sc_actions_match_id_idx
  on public.ship_control_actions (match_id, created_at desc);

create index if not exists sc_actions_event_id_idx
  on public.ship_control_actions (event_id)
  where event_id is not null;

-- 2. Función auxiliar de identidad de rol --------------------------------

create or replace function public.is_ship_role(p_match_id uuid, p_role text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.ship_control_matches m
    where m.id = p_match_id
      and (
        (p_role = 'navigation' and m.navigation_player_id = (select auth.uid())::text) or
        (p_role = 'sensors'    and m.sensors_player_id    = (select auth.uid())::text) or
        (p_role = 'energy'     and m.energy_player_id     = (select auth.uid())::text) or
        (p_role = 'comms'      and m.comms_player_id      = (select auth.uid())::text)
      )
  );
$$;

create or replace function public.get_my_ship_role(p_match_id uuid)
returns text
language sql security definer stable
set search_path = public
as $$
  select case
    when navigation_player_id = (select auth.uid())::text then 'navigation'
    when sensors_player_id    = (select auth.uid())::text then 'sensors'
    when energy_player_id     = (select auth.uid())::text then 'energy'
    when comms_player_id      = (select auth.uid())::text then 'comms'
    else null
  end
  from public.ship_control_matches
  where id = p_match_id;
$$;

-- 3. RLS ------------------------------------------------------------------

alter table public.ship_control_matches enable row level security;
alter table public.ship_control_state enable row level security;
alter table public.ship_control_event_types enable row level security;
alter table public.ship_control_events enable row level security;
alter table public.ship_control_event_progress enable row level security;
alter table public.ship_control_actions enable row level security;

-- 3.1 matches: régimen abierto de sala, igual que SigTri — nada acá es
-- secreto entre los 4 jugadores del propio match.
drop policy if exists "sc_matches_select_all" on public.ship_control_matches;
create policy "sc_matches_select_all"
  on public.ship_control_matches for select using (true);

drop policy if exists "sc_matches_insert_all" on public.ship_control_matches;
create policy "sc_matches_insert_all"
  on public.ship_control_matches for insert with check (true);

drop policy if exists "sc_matches_update_all" on public.ship_control_matches;
create policy "sc_matches_update_all"
  on public.ship_control_matches for update using (true);

-- 3.2 event_types: catálogo público de solo lectura — el cliente puede
-- ver qué tipos de evento existen (timeout, requires_morse, etc. son
-- metadatos de UI legítimos), pero JAMÁS hidden_solution vive acá (esa
-- tabla es ship_control_events, protegida abajo). role_messages es la
-- plantilla narrativa sin los valores concretos de la instancia.
drop policy if exists "sc_event_types_select_all" on public.ship_control_event_types;
create policy "sc_event_types_select_all"
  on public.ship_control_event_types for select using (true);
-- Sin policies de insert/update para el cliente: el catálogo se puebla
-- por migración/seed, no en runtime.

-- 3.3 ship_control_state: cada rol ve un subconjunto DISTINTO de
-- columnas de la MISMA fila — RLS protege filas, no columnas, así que
-- se bloquea select directo y se exponen vistas por rol.
revoke select on public.ship_control_state from anon, authenticated;

drop policy if exists "sc_state_no_direct_select" on public.ship_control_state;
create policy "sc_state_no_direct_select"
  on public.ship_control_state for select using (false);
-- Sin policies de insert/update para el cliente: toda escritura pasa
-- por submit_ship_action (security definer, sección 6).

create or replace view public.ship_control_state_navigation as
  select match_id, heading_deg, speed, position_x, position_y, updated_at
  from public.ship_control_state
  where public.is_ship_role(match_id, 'navigation');

create or replace view public.ship_control_state_energy as
  select match_id, power_shields, power_engines, power_comms, power_weapons, power_life_support, updated_at
  from public.ship_control_state
  where public.is_ship_role(match_id, 'energy');
-- Sensores y Comunicaciones no tienen vista sobre esta tabla: su
-- información vive 100% en ship_control_events (role_messages_resolved
-- filtrado por rol vía get_my_ship_events, sección 3.4) y en
-- ship_control_event_progress. Darles una vista vacía sería ruido sin
-- función.

grant select on public.ship_control_state_navigation to anon, authenticated;
grant select on public.ship_control_state_energy to anon, authenticated;
alter view public.ship_control_state_navigation set (security_invoker = true);
alter view public.ship_control_state_energy set (security_invoker = true);
-- security_invoker = true: la vista corre con los privilegios de quien
-- consulta — sin esto, is_ship_role (security definer) igual protegería
-- la fila filtrada por WHERE, pero la policy using(false) de la tabla
-- base no se heredaría correctamente para otros roles intentando leer
-- la vista de un match ajeno. Con security_invoker en true, el WHERE de
-- la vista se evalúa con el auth.uid() real de quien llama.

-- 3.4 ship_control_events: role_messages_resolved y hidden_solution
-- están en la MISMA fila — un jugador de Comunicaciones no debe poder
-- leer el mensaje de Navegación, y NADIE del cliente debe poder leer
-- hidden_solution jamás. Igual que sudoku_coop_solutions, esto no se
-- puede resolver con una vista de columnas fijas (el filtrado es "una
-- clave dentro de un JSON"), así que la única vía de lectura es una
-- función.
revoke select on public.ship_control_events from anon, authenticated;

drop policy if exists "sc_events_no_direct_select" on public.ship_control_events;
create policy "sc_events_no_direct_select"
  on public.ship_control_events for select using (false);

create or replace function public.get_my_ship_events(p_match_id uuid)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_role text := public.get_my_ship_role(p_match_id);
  v_result jsonb;
begin
  if v_role is null then
    raise exception 'not_a_player_of_this_match' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'event_code', e.event_code,
    'status', e.status,
    -- role_messages_resolved -> v_role ahora es {"text": "...",
    -- "morse_pattern": "..."} o null (nunca un string plano — ver
    -- comentario del seed, sección 8, y de trigger_ship_event, sección
    -- 5, para el porqué de este cambio de forma). Se extraen los dos
    -- campos por separado; ninguno de los dos es hidden_solution.
    'message', e.role_messages_resolved -> v_role -> 'text',
    -- Patrón Morse en '.'/'-' YA CALCULADO server-side (encode_ship_morse
    -- sobre hidden_solution.morse_code) — es sonido reproducible, no la
    -- solución en sí: el jugador de Comunicaciones lo escucha/decodifica,
    -- exactamente el mismo dato que "oiría" en la ficción del juego.
    -- Solo presente si mi rol es 'comms' y el evento activo lo generó.
    'morse_pattern', case when v_role = 'comms' then
      e.role_messages_resolved -> v_role -> 'morse_pattern'
    else null end,
    'deadline_at', e.deadline_at,
    'triggered_at', e.triggered_at,
    -- Sensores necesita su lectura con ruido YA aplicada, no la fuente
    -- real — se calcula acá, nunca se expone hidden_solution.
    'sensor_reading', case when v_role = 'sensors' then
      jsonb_build_object(
        'bearing', ((e.hidden_solution->>'hazard_true_bearing')::int
                    + coalesce((e.sensor_noise->>'bearing_noise_deg')::int, 0) + 360) % 360,
        'distance', greatest(0, round(
          (e.hidden_solution->>'hazard_true_distance')::numeric
          * (1 + coalesce((e.sensor_noise->>'distance_noise_pct')::numeric, 0) / 100.0)
        ))
      )
    else null end,
    -- El offset real de trayectoria solo se revela a Sensores si
    -- Comunicaciones ya decodificó correctamente (dependencia cruzada,
    -- ver 2.5 del diseño) — progress.comms_decoded gatea esto.
    'trajectory_unlocked', case when v_role = 'sensors' then
      exists (select 1 from public.ship_control_event_progress p
              where p.event_id = e.id and p.comms_decoded)
    else null end
  )), '[]'::jsonb)
  into v_result
  from public.ship_control_events e
  where e.match_id = p_match_id and e.status = 'active';

  return v_result;
end;
$$;

revoke all on function public.get_my_ship_events(uuid) from public;
grant execute on function public.get_my_ship_events(uuid) to anon, authenticated;

-- 3.5 event_progress: mismo criterio — no revela nada por columna
-- suelta que un rol no debería ver todavía, pero acá el contenido ya
-- es agregado/booleano, no hay campo secreto por-rol dentro de una fila
-- compartida (a diferencia de events). select abierto es seguro.
drop policy if exists "sc_progress_select_all" on public.ship_control_event_progress;
create policy "sc_progress_select_all"
  on public.ship_control_event_progress for select using (true);

-- 3.6 actions: un jugador puede ver el log completo de SU match (es
-- información compartida del equipo — "quién hizo qué y cuándo" no es
-- secreto entre compañeros, a diferencia de hidden_solution). Sin
-- policies de insert/update directas: todo pasa por submit_ship_action.
drop policy if exists "sc_actions_select_all" on public.ship_control_actions;
create policy "sc_actions_select_all"
  on public.ship_control_actions for select using (true);

-- 4. Inicio de partida ------------------------------------------------------
--
-- El match se crea con un insert directo del cliente (policy abierta,
-- igual que SigTri) con status='waiting' y los 4 *_player_id llenándose
-- a medida que se unen. Cuando el host arranca la partida, invoca este
-- RPC — análogo en espíritu a generate_signal_triangulation_round: es
-- la única vía para inicializar ship_control_state y elegir el destino
-- (decisión #2), nunca se calcula en el cliente.
create or replace function public.start_ship_control_match(p_match_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_match record;
  v_start_x smallint;
  v_start_y smallint;
  v_dest_x smallint;
  v_dest_y smallint;
  v_min_distance constant smallint := 40; -- evita destinos triviales/cercanos
begin
  select * into v_match from public.ship_control_matches where id = p_match_id for update;
  if v_match is null then raise exception 'match_not_found'; end if;
  if v_match.status != 'waiting' then
    raise exception 'match_not_waiting' using errcode = 'P0001';
  end if;
  if v_match.navigation_player_id is null or v_match.sensors_player_id is null
     or v_match.energy_player_id is null or v_match.comms_player_id is null then
    raise exception 'match_missing_players' using errcode = 'P0001';
  end if;

  v_start_x := 50;
  v_start_y := 50;

  -- Destino a distancia mínima del punto de partida, dentro del
  -- tablero — simple rechazo por muestreo, el espacio es lo bastante
  -- grande (100x100) para que esto converja casi siempre en el primer
  -- intento.
  loop
    v_dest_x := floor(random() * 100)::smallint;
    v_dest_y := floor(random() * 100)::smallint;
    exit when sqrt(power(v_dest_x - v_start_x, 2) + power(v_dest_y - v_start_y, 2)) >= v_min_distance;
  end loop;

  insert into public.ship_control_state (match_id, position_x, position_y)
  values (p_match_id, v_start_x, v_start_y)
  on conflict (match_id) do update set position_x = v_start_x, position_y = v_start_y;

  update public.ship_control_matches
  set status = 'playing',
      started_at = now(),
      destination_x = v_dest_x,
      destination_y = v_dest_y,
      -- Dificultad 'dificil' arranca con probabilidad base más alta y
      -- crece más rápido (decisión #5).
      event_probability_base = case when v_match.difficulty = 'dificil' then 0.220 else 0.150 end,
      event_probability_current = case when v_match.difficulty = 'dificil' then 0.220 else 0.150 end,
      event_probability_growth_per_event = case when v_match.difficulty = 'dificil' then 0.030 else 0.020 end,
      event_probability_growth_per_failure = case when v_match.difficulty = 'dificil' then 0.090 else 0.060 end
  where id = p_match_id;

  return jsonb_build_object('destination_x', v_dest_x, 'destination_y', v_dest_y);
end;
$$;

revoke all on function public.start_ship_control_match(uuid) from public;
grant execute on function public.start_ship_control_match(uuid) to anon, authenticated;

-- Evita que un jugador quede activo en dos partidas de Ship Control a
-- la vez — mismo criterio que prevent_double_active_st_match.
create or replace function public.prevent_double_active_sc_match()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  conflicting_count integer;
  new_players text[];
begin
  if new.status not in ('waiting', 'playing') then
    return new;
  end if;

  new_players := array_remove(
    array[new.navigation_player_id, new.sensors_player_id, new.energy_player_id, new.comms_player_id],
    null
  );
  if array_length(new_players, 1) is null then
    return new;
  end if;

  select count(*)
  into conflicting_count
  from public.ship_control_matches m
  where m.id <> new.id
    and m.status in ('waiting', 'playing')
    and (
      array[m.navigation_player_id, m.sensors_player_id, m.energy_player_id, m.comms_player_id]
      && new_players
    );

  if conflicting_count > 0 then
    raise exception 'player_already_in_active_match' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists sc_matches_prevent_double_active on public.ship_control_matches;
create trigger sc_matches_prevent_double_active
  before insert or update on public.ship_control_matches
  for each row
  execute function public.prevent_double_active_sc_match();

-- 5. Generación/disparo de eventos -------------------------------------------
--
-- Tabla de códigos Morse — subset reducido a A-Z y 0-9 (lo único que
-- puede aparecer en un código de evento). Vive server-side únicamente:
-- el cliente de Comunicaciones puede mostrar esta MISMA tabla como
-- referencia visual (es dominio público, no un secreto — ver 6.3 del
-- diseño), pero el código a decodificar en sí nunca se manda en texto
-- plano, solo como patrón de puntos/rayas ya traducido.
create table if not exists public.ship_control_morse_table (
  symbol text primary key,
  pattern text not null -- '.' y '-', ej. 'A' -> '.-'
);

insert into public.ship_control_morse_table (symbol, pattern) values
  ('0','-----'),('1','.----'),('2','..---'),('3','...--'),('4','....-'),
  ('5','.....'),('6','-....'),('7','--...'),('8','---..'),('9','----.')
on conflict (symbol) do nothing;

-- Convierte un código (solo dígitos, ver hidden_solution.morse_code) a
-- su patrón Morse concatenado con separador " / " entre símbolos.
create or replace function public.encode_ship_morse(p_code text)
returns text
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_result text := '';
  v_char text;
  v_pattern text;
begin
  for i in 1..length(p_code) loop
    v_char := substr(p_code, i, 1);
    select pattern into v_pattern from public.ship_control_morse_table where symbol = v_char;
    if v_pattern is null then
      raise exception 'unsupported_morse_symbol %', v_char;
    end if;
    v_result := v_result || case when i > 1 then ' / ' else '' end || v_pattern;
  end loop;
  return v_result;
end;
$$;

-- Distancia de edición simple (Levenshtein) para la tolerancia de
-- decodificación de la decisión #7 (1 carácter de margen permitido en
-- el código, exacto en el checksum). Implementación estándar de
-- programación dinámica, sin dependencias externas (no se asume la
-- extensión fuzzystrmatch habilitada en el proyecto).
create or replace function public.ship_levenshtein(a text, b text)
returns integer
language plpgsql immutable
as $$
declare
  la int := length(a);
  lb int := length(b);
  d int[];
  i int; j int; cost int;
begin
  d := array_fill(0, array[la+1, lb+1]);
  for i in 0..la loop d[i][0] := i; end loop;
  for j in 0..lb loop d[0][j] := j; end loop;
  for i in 1..la loop
    for j in 1..lb loop
      cost := case when substr(a,i,1) = substr(b,j,1) then 0 else 1 end;
      d[i][j] := least(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost);
    end loop;
  end loop;
  return d[la][lb];
end;
$$;

-- Dispara UN evento nuevo para el match, eligiendo un event_type según
-- la curva de dificultad progresiva (decisión #8): pondera hacia
-- tier 1 al inicio de la partida y sube el mix con events_survived y
-- con vidas ya perdidas (decisión #3: fallar sube tanto la PROBABILIDAD
-- de que ocurra un evento como el TIER esperado — el barco se vuelve
-- más caótico y más difícil a la vez cuantas más fallas acumula).
create or replace function public.trigger_ship_event(p_match_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_match record;
  v_lives_lost smallint;
  v_tier_weights numeric[3]; -- pesos relativos para tier 1/2/3
  v_chosen_tier smallint;
  v_event_type record;
  v_event_id uuid;
  v_roll numeric;
  -- Generación de la solución oculta (depende del tipo elegido).
  v_morse_code text;
  v_checksum smallint;
  v_true_bearing smallint;
  v_true_distance smallint;
  v_evasion_heading smallint;
  v_bearing_noise smallint;
  v_distance_noise smallint;
  v_role_messages jsonb;
  v_timeout smallint;
begin
  select * into v_match from public.ship_control_matches m where m.id = p_match_id for update;
  if v_match is null or v_match.status != 'playing' then
    return null;
  end if;

  -- No dispara un evento nuevo si ya hay uno activo (decisión abierta
  -- #5 del diseño: un evento a la vez en la v1).
  if exists (select 1 from public.ship_control_events where match_id = p_match_id and status = 'active') then
    return null;
  end if;

  v_lives_lost := v_match.max_lives - v_match.lives;

  -- Pesos de tier: arrancan fuertemente hacia tier 1, se desplazan
  -- hacia tier 2/3 con eventos sobrevividos y con vidas perdidas. Los
  -- números son arbitrarios pero monótonos — ajustables sin migración
  -- si el balance requiere otro valor (podrían moverse a columnas de
  -- match en una iteración futura si hace falta tunearlos en runtime).
  v_tier_weights := array[
    greatest(1, 10 - v_match.events_survived - v_lives_lost * 2)::numeric, -- tier 1
    least(8, v_match.events_survived + v_lives_lost)::numeric,             -- tier 2
    greatest(0, v_match.events_survived - 3 + v_lives_lost * 2)::numeric   -- tier 3
  ];

  v_roll := random() * (v_tier_weights[1] + v_tier_weights[2] + v_tier_weights[3]);
  if v_roll < v_tier_weights[1] then
    v_chosen_tier := 1;
  elsif v_roll < v_tier_weights[1] + v_tier_weights[2] then
    v_chosen_tier := 2;
  else
    v_chosen_tier := 3;
  end if;

  select * into v_event_type from public.ship_control_event_types
    where difficulty_tier = v_chosen_tier
    order by random() limit 1;

  -- Si no hay eventos cargados en ese tier todavía (catálogo parcial),
  -- degrada a cualquier tier disponible en vez de fallar en silencio.
  if v_event_type is null then
    select * into v_event_type from public.ship_control_event_types order by random() limit 1;
  end if;
  if v_event_type is null then
    raise exception 'no_event_types_seeded' using errcode = 'P0001';
  end if;

  -- Genera la solución oculta según qué mecánicas requiere este tipo.
  v_morse_code := null; v_checksum := null;
  if v_event_type.requires_morse then
    v_morse_code := lpad(floor(random() * 1000)::text, 3, '0'); -- 3 dígitos
    if v_event_type.requires_checksum then
      -- checksum = suma de dígitos mod 10 (fórmula simple, decisión de
      -- diseño original: aprendible en 1-2 partidas).
      select sum(d::int) % 10 into v_checksum
      from unnest(string_to_array(v_morse_code, null)) as d;
    end if;
  end if;

  v_true_bearing := null; v_true_distance := null; v_evasion_heading := null;
  v_bearing_noise := null; v_distance_noise := null;
  if v_event_type.requires_triangulation then
    v_true_bearing := floor(random() * 360)::smallint;
    v_true_distance := 15 + floor(random() * 60)::smallint;
    v_evasion_heading := case
      when v_true_distance < 30 then (v_true_bearing + 90) % 360
      else (v_true_bearing + 45) % 360
    end;
    -- Ruido fijo para toda la duración del evento (sección 2.1 del
    -- diseño) — no se regenera en cada lectura, sería incomunicable
    -- por voz si cambiara solo.
    v_bearing_noise := (floor(random() * 31) - 15)::smallint;   -- ±15°
    v_distance_noise := (floor(random() * 21) - 10)::smallint;  -- ±10%
  end if;

  v_role_messages := v_event_type.role_messages;
  if v_morse_code is not null then
    -- jsonb_set requiere que el elemento en el path intermedio
    -- ({comms}) sea un objeto para poder anidarle una clave nueva
    -- (morse_pattern) — funciona porque el seed (sección 8) y cualquier
    -- catálogo futuro de eventos con requires_morse=true SIEMPRE
    -- guardan role_messages->comms como {"text": "..."} y nunca como
    -- string plano. Antes de esta revisión el seed usaba strings
    -- planos acá, lo cual hacía que este jsonb_set no tuviera dónde
    -- anidar y devolviera el jsonb sin cambios en silencio — el patrón
    -- Morse nunca llegaba al cliente pese a calcularse. Ver también el
    -- comentario de get_my_ship_events (sección 3.4) que lee este mismo
    -- campo.
    -- Nota para catálogo futuro: si algún event_type con
    -- requires_morse=true llegara a tener role_messages->comms en null,
    -- este jsonb_set tampoco tendría dónde anidar morse_pattern (mismo
    -- problema que con un string plano) — ningún evento del seed actual
    -- cae en ese caso (todos los que requieren morse definen texto para
    -- comms), pero un catálogo nuevo debe mantener esa invariante o
    -- inicializar 'comms' en '{}'::jsonb en vez de null.
    v_role_messages := jsonb_set(
      coalesce(v_role_messages, '{}'::jsonb), '{comms,morse_pattern}',
      to_jsonb(public.encode_ship_morse(v_morse_code))
    );
  end if;

  -- Dificultad 'dificil' acorta timeouts (más presión), sin cambiar la
  -- lógica de resolución.
  v_timeout := case when v_match.difficulty = 'dificil'
    then greatest(15, round(v_event_type.timeout_seconds * 0.75))
    else v_event_type.timeout_seconds
  end;

  insert into public.ship_control_events (
    match_id, event_code, role_messages_resolved, hidden_solution, sensor_noise,
    deadline_at
  ) values (
    p_match_id, v_event_type.code, v_role_messages,
    jsonb_build_object(
      'morse_code', v_morse_code,
      'checksum_digit', v_checksum,
      'hazard_true_bearing', v_true_bearing,
      'hazard_true_distance', v_true_distance,
      'correct_evasion_heading', v_evasion_heading,
      'evasion_tolerance_deg', 10,
      'min_shields_pct', 60
    ),
    case when v_event_type.requires_triangulation then
      jsonb_build_object('bearing_noise_deg', v_bearing_noise, 'distance_noise_pct', v_distance_noise)
    else null end,
    now() + make_interval(secs => v_timeout)
  )
  returning id into v_event_id;

  if v_event_type.requires_power_sequence then
    insert into public.ship_control_event_progress (event_id, power_sequence_step)
    values (v_event_id, 0);
  else
    insert into public.ship_control_event_progress (event_id) values (v_event_id);
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.trigger_ship_event(uuid) from public;
grant execute on function public.trigger_ship_event(uuid) to anon, authenticated;

-- Punto de entrada de "tick" del juego: evalúa probabilísticamente si
-- corresponde disparar un evento nuevo (decisión #1: probabilidad
-- creciente, no guion fijo) y de paso barre timeouts vencidos
-- (decisión #4: sin pg_cron, ver sweep_ship_events en sección 6). El
-- cliente debe invocar esto por polling ligero (cada 3-5s, mientras
-- status='playing' y no hay evento activo) — es la pieza que reemplaza
-- al "disparador temporizado" mencionado en el diseño original, ahora
-- resuelto sin infraestructura de cron.
-- Integración física mínima: mueve position_x/y según heading_deg/speed
-- del estado actual. Sin esto, set_speed guardaba la velocidad pero la
-- nave nunca se acercaba al destino — bug bloqueante para la condición
-- de victoria (decisión #2), detectado en revisión antes de habilitar
-- el cliente. Se invoca en cada tick_ship_control_match (cada 4s de
-- polling, ver shipControlSystem.startTicking), así que la velocidad es
-- "unidades de mapa por tick", no por segundo real — mismo espíritu que
-- el resto del proyecto evita depender de un cron de precisión.
-- speed 0-100 -> hasta 3 unidades de mapa por tick a velocidad máxima;
-- valor de gameplay ajustable, no una decisión de arquitectura.
create or replace function public.advance_ship_position(p_match_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_state record;
  v_distance numeric;
  v_dx numeric;
  v_dy numeric;
  v_new_x numeric;
  v_new_y numeric;
begin
  select * into v_state from public.ship_control_state where match_id = p_match_id for update;
  if v_state is null or v_state.speed = 0 then
    return;
  end if;

  v_distance := v_state.speed / 100.0 * 3.0;
  v_dx := v_distance * sin(radians(v_state.heading_deg));
  v_dy := -v_distance * cos(radians(v_state.heading_deg));

  v_new_x := least(99, greatest(0, v_state.position_x + v_dx));
  v_new_y := least(99, greatest(0, v_state.position_y + v_dy));

  update public.ship_control_state
  set position_x = round(v_new_x)::smallint,
      position_y = round(v_new_y)::smallint,
      updated_at = now()
  where match_id = p_match_id;
end;
$$;

revoke all on function public.advance_ship_position(uuid) from public;
grant execute on function public.advance_ship_position(uuid) to anon, authenticated;

-- Chequeo de victoria INDEPENDIENTE de que haya un evento activo o
-- recién resuelto — bug bloqueante detectado en revisión: la versión
-- original solo evaluaba distancia-a-destino dentro del bloque de
-- resolución exitosa de check_ship_event_resolution, así que una nave
-- que llegara al destino en un momento sin evento activo (el caso
-- normal — los eventos son intermitentes) nunca disparaba victoria. Se
-- invoca desde tick_ship_control_match (cada poll) y sigue
-- invocándose también al resolver un evento, por si la llegada
-- coincide exactamente con esa resolución.
create or replace function public.check_ship_destination_reached(p_match_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_match record;
  v_state record;
  v_distance numeric;
begin
  select * into v_match from public.ship_control_matches where id = p_match_id for update;
  if v_match is null or v_match.status != 'playing' or v_match.destination_x is null then
    return false;
  end if;

  select * into v_state from public.ship_control_state where match_id = p_match_id;
  if v_state is null then return false; end if;

  v_distance := sqrt(
    power(v_state.position_x - v_match.destination_x, 2)
    + power(v_state.position_y - v_match.destination_y, 2)
  );

  if v_distance <= 3 then
    update public.ship_control_matches
    set status = 'completed', completed_at = now()
    where id = p_match_id;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.check_ship_destination_reached(uuid) from public;
grant execute on function public.check_ship_destination_reached(uuid) to anon, authenticated;

create or replace function public.tick_ship_control_match(p_match_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_match record;
  v_new_event_id uuid;
  v_won boolean;
begin
  perform public.sweep_ship_events(p_match_id);
  perform public.advance_ship_position(p_match_id);
  v_won := public.check_ship_destination_reached(p_match_id);

  if v_won then
    return jsonb_build_object('triggered', false, 'won', true);
  end if;

  select * into v_match from public.ship_control_matches where id = p_match_id;
  if v_match is null or v_match.status != 'playing' then
    return jsonb_build_object('triggered', false);
  end if;

  if exists (select 1 from public.ship_control_events where match_id = p_match_id and status = 'active') then
    return jsonb_build_object('triggered', false);
  end if;

  if random() < v_match.event_probability_current then
    v_new_event_id := public.trigger_ship_event(p_match_id);
    return jsonb_build_object('triggered', v_new_event_id is not null, 'event_id', v_new_event_id);
  end if;

  return jsonb_build_object('triggered', false);
end;
$$;

revoke all on function public.tick_ship_control_match(uuid) from public;
grant execute on function public.tick_ship_control_match(uuid) to anon, authenticated;

-- 6. Timeout sin pg_cron, resolución de eventos, y punto de entrada de acciones
--
-- Decisión #4: el proyecto no tiene pg_cron (ver nota de cabecera y
-- migration_009_lobby_expiration.sql). sweep_ship_events barre
-- deadlines vencidos de UN match — se invoca oportunísticamente desde
-- tick_ship_control_match (arriba) y desde submit_ship_action (abajo),
-- así que en la práctica se ejecuta en cada interacción de cualquiera
-- de los 4 roles, no solo en el polling — un evento vencido queda
-- "sin marcar" como mucho el intervalo entre dos acciones/ticks de
-- cualquier jugador, que en una partida activa de 4 personas es
-- segundos, no minutos.
create or replace function public.sweep_ship_events(p_match_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_expired record;
begin
  for v_expired in
    select e.id, e.event_code, et.lives_lost_on_fail
    from public.ship_control_events e
    join public.ship_control_event_types et on et.code = e.event_code
    where e.match_id = p_match_id and e.status = 'active' and e.deadline_at < now()
    for update of e
  loop
    perform public.fail_ship_event(v_expired.id, v_expired.lives_lost_on_fail);
  end loop;
end;
$$;

revoke all on function public.sweep_ship_events(uuid) from public;
grant execute on function public.sweep_ship_events(uuid) to anon, authenticated;

-- Marca un evento como fallado, aplica la penalización (decisión #3:
-- resta vidas Y sube la probabilidad/mix de dificultad futura) y
-- termina la partida en derrota si las vidas llegan a 0.
create or replace function public.fail_ship_event(p_event_id uuid, p_lives_lost smallint)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_match record;
  v_new_lives smallint;
begin
  update public.ship_control_events
  set status = 'failed', resolved_at = now()
  where id = p_event_id and status = 'active'
  returning match_id into v_match_id;

  if v_match_id is null then
    return; -- ya estaba resuelto por otra vía concurrente
  end if;

  select * into v_match from public.ship_control_matches where id = v_match_id for update;
  v_new_lives := greatest(0, v_match.lives - p_lives_lost);

  update public.ship_control_matches
  set lives = v_new_lives,
      events_failed = events_failed + 1,
      -- Decisión #3: fallar sube la cadencia futura de eventos, no
      -- solo el daño puntual — el barco se vuelve más caótico.
      event_probability_current = least(0.9,
        event_probability_current + event_probability_growth_per_failure),
      status = case when v_new_lives = 0 then 'failed' else status end,
      completed_at = case when v_new_lives = 0 then now() else completed_at end
  where id = v_match_id;
end;
$$;

revoke all on function public.fail_ship_event(uuid, smallint) from public;
grant execute on function public.fail_ship_event(uuid, smallint) to anon, authenticated;

-- Evalúa si un evento activo ya cumple TODAS sus sub-condiciones
-- aplicables a su event_code (ver 6.2 del diseño) y lo marca resolved
-- si es así — sube la cadencia también al resolver (decisión #1: sube
-- con eventos SOBREVIVIDOS, más lento que con fallos) y chequea
-- victoria por destino (decisión #2).
create or replace function public.check_ship_event_resolution(p_event_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_event record;
  v_event_type record;
  v_progress record;
  v_state record;
  v_match record;
  v_sol jsonb;
  v_heading_ok boolean := true;
  v_decoded_ok boolean := true;
  v_sequence_ok boolean := true;
  v_shields_ok boolean := true;
  v_shields_held boolean;
begin
  select * into v_event from public.ship_control_events where id = p_event_id and status = 'active' for update;
  if v_event is null then return; end if;

  select * into v_event_type from public.ship_control_event_types where code = v_event.event_code;
  select * into v_progress from public.ship_control_event_progress where event_id = p_event_id;
  select * into v_state from public.ship_control_state where match_id = v_event.match_id;
  v_sol := v_event.hidden_solution;

  if v_event_type.requires_morse then
    v_decoded_ok := coalesce(v_progress.comms_decoded, false);
  end if;

  if v_event_type.requires_triangulation then
    v_heading_ok := v_progress.last_confirmed_heading is not null
      and abs(v_progress.last_confirmed_heading - (v_sol->>'correct_evasion_heading')::int) <= (v_sol->>'evasion_tolerance_deg')::int;
    -- min_shields sostenido: ni un solo redistribute_power en los
    -- últimos 10s que haya bajado power_shields por debajo del mínimo.
    v_shields_ok := v_state.power_shields >= (v_sol->>'min_shields_pct')::int;
    select not exists (
      select 1 from public.ship_control_actions a
      where a.match_id = v_event.match_id
        and a.action_type = 'redistribute_power'
        and a.created_at > now() - interval '10 seconds'
        and (a.action_payload->>'power_shields')::int < (v_sol->>'min_shields_pct')::int
    ) into v_shields_held;
    v_shields_ok := v_shields_ok and v_shields_held;
  end if;

  if v_event_type.requires_power_sequence then
    v_sequence_ok := coalesce(v_progress.power_sequence_step, 0)
      >= jsonb_array_length(v_event_type.power_sequence);
  end if;

  if v_decoded_ok and v_heading_ok and v_sequence_ok and v_shields_ok then
    update public.ship_control_events set status = 'resolved', resolved_at = now() where id = p_event_id;

    select * into v_match from public.ship_control_matches where id = v_event.match_id for update;
    update public.ship_control_matches
    set events_survived = events_survived + 1,
        event_probability_current = least(0.9,
          event_probability_current + event_probability_growth_per_event)
    where id = v_event.match_id;

    -- Decisión #2: condición de victoria es llegar al destino. El
    -- chequeo real vive en check_ship_destination_reached (invocada
    -- también en cada tick_ship_control_match, no solo acá) — este
    -- llamado cubre el caso borde de llegar exactamente al resolver un
    -- evento, sin duplicar el cálculo de distancia.
    perform public.check_ship_destination_reached(v_event.match_id);
  end if;
end;
$$;

revoke all on function public.check_ship_event_resolution(uuid) from public;
grant execute on function public.check_ship_event_resolution(uuid) to anon, authenticated;

-- Invariante de energía: los 5 power_* no pueden superar 100 en total
-- (menor a 100 se permite — energía sin asignar).
create or replace function public.validate_power_distribution()
returns trigger language plpgsql as $$
begin
  if (new.power_shields + new.power_engines + new.power_comms + new.power_weapons + new.power_life_support) > 100 then
    raise exception 'power_distribution_exceeds_total' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists sc_state_validate_power on public.ship_control_state;
create trigger sc_state_validate_power
  before update on public.ship_control_state
  for each row
  execute function public.validate_power_distribution();

-- Punto de entrada ÚNICO para toda acción de cualquier rol. Valida
-- identidad, valida la acción contra hidden_solution/sensor_noise si
-- corresponde (con tolerancia de decisión #7 para morse/checksum),
-- actualiza state/progress, registra en el log, y re-evalúa la
-- resolución del evento.
create or replace function public.submit_ship_action(
  p_match_id uuid,
  p_action_type text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_match record;
  v_event record;
  v_role text;
  v_correct boolean := null;
  v_state record;
begin
  perform public.sweep_ship_events(p_match_id);

  select * into v_match from public.ship_control_matches where id = p_match_id for update;
  if v_match is null then raise exception 'match_not_found'; end if;
  if v_match.status != 'playing' then raise exception 'match_not_playing' using errcode = 'P0001'; end if;

  v_role := public.get_my_ship_role(p_match_id);
  if v_role is null then raise exception 'not_a_player_of_this_match'; end if;

  select * into v_event from public.ship_control_events
    where match_id = p_match_id and status = 'active'
    order by triggered_at desc limit 1;

  if p_action_type = 'set_heading' and v_role = 'navigation' then
    update public.ship_control_state
    set heading_deg = (p_payload->>'heading_deg')::smallint, updated_at = now()
    where match_id = p_match_id;

  elsif p_action_type = 'set_speed' and v_role = 'navigation' then
    update public.ship_control_state
    set speed = (p_payload->>'speed')::smallint, updated_at = now()
    where match_id = p_match_id;
    -- Avance físico simple proporcional a velocidad y rumbo — el
    -- detalle de integración de movimiento (cuánto avanza por tick) es
    -- un parámetro de gameplay a afinar en implementación, no una
    -- decisión de arquitectura; se deja como placeholder consciente.

  elsif p_action_type = 'confirm_evasion' and v_role = 'navigation' and v_event is not null then
    v_correct := v_event.hidden_solution is not null
      and abs((select heading_deg from public.ship_control_state where match_id = p_match_id)
              - (v_event.hidden_solution->>'correct_evasion_heading')::int)
          <= coalesce((v_event.hidden_solution->>'evasion_tolerance_deg')::int, 10);
    update public.ship_control_event_progress
    set last_confirmed_heading = (select heading_deg from public.ship_control_state where match_id = p_match_id),
        updated_at = now()
    where event_id = v_event.id;

  elsif p_action_type = 'redistribute_power' and v_role = 'energy' then
    select * into v_state from public.ship_control_state where match_id = p_match_id;
    update public.ship_control_state
    set power_shields = coalesce((p_payload->>'power_shields')::smallint, v_state.power_shields),
        power_engines = coalesce((p_payload->>'power_engines')::smallint, v_state.power_engines),
        power_comms = coalesce((p_payload->>'power_comms')::smallint, v_state.power_comms),
        power_weapons = coalesce((p_payload->>'power_weapons')::smallint, v_state.power_weapons),
        power_life_support = coalesce((p_payload->>'power_life_support')::smallint, v_state.power_life_support),
        updated_at = now()
    where match_id = p_match_id;

  elsif p_action_type = 'reactor_sequence_step' and v_role = 'energy' and v_event is not null then
    declare
      v_expected text;
      v_progress record;
      v_seq jsonb;
    begin
      select power_sequence into v_seq from public.ship_control_event_types where code = v_event.event_code;
      select * into v_progress from public.ship_control_event_progress where event_id = v_event.id;
      v_expected := v_seq ->> coalesce(v_progress.power_sequence_step, 0);
      v_correct := (p_payload->>'step' = v_expected);
      if v_correct then
        update public.ship_control_event_progress
        set power_sequence_step = coalesce(power_sequence_step, 0) + 1, updated_at = now()
        where event_id = v_event.id;
      end if;
    end;

  elsif p_action_type = 'submit_decoded_code' and v_role = 'comms' and v_event is not null then
    -- Tolerancia decisión #7: 1 carácter de margen en el código
    -- (Levenshtein <= 1), checksum exacto (0 margen, es 1 cifra).
    v_correct := (v_event.hidden_solution->>'morse_code') is not null
      and public.ship_levenshtein(p_payload->>'code', v_event.hidden_solution->>'morse_code') <= 1
      and (
        (v_event.hidden_solution->>'checksum_digit') is null
        or (p_payload->>'checksum')::int = (v_event.hidden_solution->>'checksum_digit')::int
      );
    if v_correct then
      update public.ship_control_event_progress
      set comms_decoded = true, updated_at = now()
      where event_id = v_event.id;
    end if;

  elsif p_action_type = 'submit_evasion_bearing' and v_role = 'sensors' and v_event is not null then
    -- Solo se acepta si Comunicaciones ya decodificó — dependencia
    -- cruzada explícita (sección 2.5 del diseño), no solo narrativa.
    if not coalesce((select comms_decoded from public.ship_control_event_progress where event_id = v_event.id), false) then
      raise exception 'comms_not_decoded_yet' using errcode = 'P0001';
    end if;
    v_correct := abs((p_payload->>'bearing_deg')::int - (v_event.hidden_solution->>'correct_evasion_heading')::int) <= 10;

  else
    raise exception 'unsupported_action_for_role %/%', p_action_type, v_role;
  end if;

  insert into public.ship_control_actions (match_id, player_id, role, action_type, action_payload, event_id, was_correct)
  values (p_match_id, (select auth.uid())::text, v_role, p_action_type, p_payload, v_event.id, v_correct);

  if v_event is not null then
    perform public.check_ship_event_resolution(v_event.id);
  end if;

  return jsonb_build_object('correct', v_correct);
end;
$$;

revoke all on function public.submit_ship_action(uuid, text, jsonb) from public;
grant execute on function public.submit_ship_action(uuid, text, jsonb) to anon, authenticated;

-- 7. Habilitar Realtime -------------------------------------------------------
--
-- Mismo riesgo documentado en migration_016: alter publication solo
-- acepta tablas base, no vistas, y Realtime de Supabase transmite el
-- contenido crudo de la fila sin importar las policies de SELECT del
-- cliente normal. ship_control_state y ship_control_events NUNCA deben
-- consumirse por Realtime sin filtrar server-side — el cliente debe
-- usar polling ligero sobre get_my_ship_events/las vistas por rol, no
-- suscribirse crudo a estas tablas. matches y actions sí son seguras
-- para Realtime sin filtro (nada secreto por fila en esas dos).
do $$
begin
  alter publication supabase_realtime add table public.ship_control_matches;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ship_control_actions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ship_control_event_progress;
exception
  when duplicate_object then null;
end $$;
-- ship_control_state y ship_control_events deliberadamente NO se
-- agregan a la publicación de Realtime: contienen columnas por-rol
-- (power_* vs heading/speed) y hidden_solution respectivamente, que
-- Realtime expondría crudas sin respetar la policy using(false) de la
-- tabla base. El cliente debe pollear get_my_ship_events y las vistas
-- ship_control_state_navigation/_energy en su lugar.

-- 8. Seed del catálogo de eventos --------------------------------------------
--
-- Al menos un evento por tier, para que trigger_ship_event tenga de
-- dónde elegir en cada franja de dificultad (decisión #8). Ampliar este
-- catálogo (más variedad por tier) es contenido, no arquitectura —
-- puede crecer en migraciones futuras sin tocar la lógica de arriba.

insert into public.ship_control_event_types
  (code, role_messages, requires_morse, requires_checksum, requires_triangulation, requires_power_sequence, power_sequence, difficulty_tier, timeout_seconds, lives_lost_on_fail)
values
  -- Tier 1: mecánica simple, un solo rol resuelve casi todo (fiel al
  -- diseño v1 original) — sirve de "tutorial" al inicio de la partida.
  --
  -- role_messages ahora es {"rol": {"text": "..."} | null, ...} en vez
  -- de {"rol": "string" | null, ...} — bug corregido en esta revisión:
  -- jsonb_set no puede anidar una clave nueva (morse_pattern) dentro de
  -- un valor que es un string plano, solo dentro de un objeto/array. Con
  -- {"text": "..."} como contenedor desde el seed, trigger_ship_event
  -- puede agregarle '{comms,morse_pattern}' sin pisar el texto (ver
  -- sección 5). get_my_ship_events y el cliente TS leen 'text' y
  -- 'morse_pattern' como hermanos dentro del mismo objeto de rol.
  ('power_dip', jsonb_build_object(
    'energy', jsonb_build_object('text', 'Caída de energía en escudos — subí Escudos a 50% o más.'),
    'comms', jsonb_build_object('text', 'AVISO: fluctuación menor detectada en el reactor.')
  ), false, false, false, false, null, 1, 40, 1),

  ('simple_heading_correction', jsonb_build_object(
    'navigation', jsonb_build_object('text', 'Corrección de rumbo requerida — giro leve solicitado por el ordenador.'),
    'comms', jsonb_build_object('text', 'CORRECCION DE RUMBO — nuevo rumbo (escuchá el código):')
  ), true, false, false, false, null, 1, 45, 1),

  -- Tier 2: una mecánica nueva por evento.
  ('asteroid_field', jsonb_build_object(
    'sensors', jsonb_build_object('text', 'Campo de asteroides detectado — calculá rumbo de evasión.'),
    'navigation', null
  ), false, false, true, false, null, 2, 40, 1),

  ('reactor_flicker', jsonb_build_object(
    'energy', jsonb_build_object('text', 'Reactor inestable — ejecutar secuencia de estabilización en el orden correcto.'),
    'comms', jsonb_build_object('text', 'SECUENCIA DE ESTABILIZACION: estabilizar reactor, luego restaurar comunicaciones, luego restaurar escudos.')
  ), false, false, false, true,
    '["stabilize_reactor","restore_comms","restore_shields"]'::jsonb, 2, 50, 1),

  -- Tier 3: evento compuesto — el ejemplo canónico del diseño (2.5).
  ('incoming_missile', jsonb_build_object(
    'comms', jsonb_build_object('text', 'ALERTA MISIL — TRAYECTORIA (escuchá el código) — ESCUDOS MIN 60.'),
    'sensors', jsonb_build_object('text', 'Misil entrante detectado — pendiente trayectoria confirmada por Comunicaciones.'),
    'energy', null,
    'navigation', null
  ), true, true, true, false, null, 3, 35, 2),

  ('electrical_storm', jsonb_build_object(
    'energy', jsonb_build_object('text', 'Tormenta eléctrica — corte generalizado, ejecutar secuencia de recuperación completa.'),
    'comms', jsonb_build_object('text', 'PROTOCOLO DE EMERGENCIA (escuchá el código) — orden: reactor, comunicaciones, escudos.'),
    'sensors', jsonb_build_object('text', 'Interferencia — posición de la nave inestable, confirmá rumbo con Navegación.')
  ), true, true, false, true,
    '["stabilize_reactor","restore_comms","restore_shields"]'::jsonb, 3, 40, 2)
on conflict (code) do nothing;
