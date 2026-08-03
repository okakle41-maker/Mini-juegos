-- ============================================================================
-- Migración 016: Signal Triangulation (minijuego cooperativo de 4 jugadores)
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_015_lobby_capacity_race_fix.sql).
--
-- Contexto (ver diseño completo revisado antes de esta migración):
-- lobby_matches (migration_008) está construido alrededor de exactamente
-- 2 jugadores (player1_id/player2_id como columnas fijas,
-- completeMatch() y el trigger prevent_double_active_match de
-- migration_011 razonan sobre esas 2 columnas por nombre). Signal
-- Triangulation es de 4 jugadores simultáneos, sin modo solo, con
-- información oculta entre los propios jugadores del equipo (cada uno
-- ve solo su propia distancia, nunca la fuente ni las celdas ajenas) —
-- una forma de partida fundamentalmente distinta, así que esta migración
-- crea tablas nuevas PARALELAS a lobby_matches, no una extensión de esa
-- tabla, siguiendo el mismo criterio por el que lobby_matches ya es
-- paralela a live_matches (migration_005/008) en vez de una extensión de
-- aquella.
--
-- Se sigue reusando lobbies/lobby_players (migration_008) para el
-- descubrimiento de partida (código de sala, presencia, estado
-- idle/waiting/playing) — solo la sub-partida en sí vive en tablas
-- nuevas:
--   signal_triangulation_matches → la partida de 4 jugadores dentro de
--                                  un lobby (2 rondas).
--   signal_triangulation_rounds  → una fila por INTENTO de ronda (una
--                                  ronda puede reintentarse varias veces
--                                  si falla — ver sección 3.3 del
--                                  diseño). Contiene la fuente oculta
--                                  server-side, nunca expuesta en claro
--                                  a los jugadores.
--   signal_triangulation_locks   → el LOCK de cada jugador por intento
--                                  de ronda: su distancia asignada y su
--                                  celda elegida.
--
-- Decisiones de producto resueltas antes de escribir esta migración:
--   1. Criterio de acierto: coincidir ENTRE SÍ y con la fuente real
--      (no alcanza solo con consenso del grupo).
--   2. Identidad real (auth.uid()) — este juego, a diferencia del resto
--      del sistema de lobby, EXIGE sesión iniciada (no hay modo
--      invitado), porque acá sí hay algo que ocultar entre los propios
--      jugadores de la partida.
--   3. Sin des-lockeo (se aplica en el cliente, no necesita constraint
--      de base de datos — ver comentario en signal_triangulation_locks).
--   4. Ronda fallida: reintentable, con límite de intentos.
--
-- El generador de niveles (elegir una fuente (x,y) con solución única)
-- vive ÚNICAMENTE en la función generate_signal_triangulation_round()
-- de esta migración — security definer, nunca alcanzable desde el
-- bundle del cliente. El cliente solo puede invocarla vía RPC (que
-- devuelve el round_id creado, nunca la fuente), nunca leer
-- source_x/source_y directamente — ver la sección de RLS más abajo.
-- ============================================================================

do $$
begin
  if to_regclass('public.lobbies') is null then
    raise exception 'migration_008_lobbies.sql no se ejecutó todavía — corré esa migración primero (crea public.lobbies/public.lobby_players que esta migración reusa).';
  end if;
end $$;

-- 1. Tablas ------------------------------------------------------------------

create table if not exists public.signal_triangulation_matches (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'completed', 'abandoned')),
  -- 4 columnas nombradas, no una tabla N-a-N: la cardinalidad de este
  -- juego es una constante de diseño (siempre 4, nunca varía), igual
  -- criterio que player1_id/player2_id en lobby_matches. La esquina de
  -- cada jugador es implícita por el número de columna:
  --   player1_id → antena (0,0)
  --   player2_id → antena (9,0)
  --   player3_id → antena (9,9)
  --   player4_id → antena (0,9)
  -- Todas nullable porque se van llenando de a uno a medida que se unen
  -- (igual que player2_id en lobby_matches antes de que se una el rival).
  -- Contienen auth.uid()::text real (ver decisión #2) — nunca un id
  -- anónimo de lobby_players.
  player1_id text,
  player2_id text,
  player3_id text,
  player4_id text,
  current_round smallint not null default 1 check (current_round in (1, 2)),
  rounds_won smallint not null default 0,
  -- Límite de intentos por ronda antes de dar la partida por terminada
  -- (decisión #4) — configurable por partida en vez de una constante de
  -- código, para poder ajustarlo sin migración si en el futuro se
  -- decide otro valor por defecto.
  max_attempts_per_round smallint not null default 5 check (max_attempts_per_round between 1 and 20),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists str_matches_lobby_id_idx
  on public.signal_triangulation_matches (lobby_id)
  where status in ('waiting', 'playing');

-- Una fila por INTENTO de ronda (no una fila fija por round_number: una
-- ronda fallida genera un intento nuevo con una fuente nueva — ver
-- decisión #4 y el trigger de avance más abajo). attempt_number empieza
-- en 1 y se incrementa por cada reintento del mismo round_number.
create table if not exists public.signal_triangulation_rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.signal_triangulation_matches(id) on delete cascade,
  round_number smallint not null check (round_number in (1, 2)),
  attempt_number smallint not null default 1 check (attempt_number >= 1),
  source_x smallint not null check (source_x between 0 and 9),
  source_y smallint not null check (source_y between 0 and 9),
  status text not null default 'active'
    check (status in ('active', 'solved', 'failed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (match_id, round_number, attempt_number)
);

-- Solo puede haber UN intento 'active' a la vez por (match_id,
-- round_number) — los intentos anteriores de la misma ronda ya están
-- 'failed' para cuando este se crea. Este índice es lo que reemplaza al
-- unique(match_id, round_number) simple de un diseño sin reintentos.
create unique index if not exists str_rounds_one_active_per_round
  on public.signal_triangulation_rounds (match_id, round_number)
  where status = 'active';

create index if not exists str_rounds_match_id_idx
  on public.signal_triangulation_rounds (match_id);

-- El LOCK de cada jugador para un intento de ronda: su distancia
-- asignada (fija desde que se crea la fila, nunca recalculada en el
-- cliente) y su celda elegida (se actualiza en vivo mientras discute
-- por voz; locked_at queda null hasta que confirma).
create table if not exists public.signal_triangulation_locks (
  round_id uuid not null references public.signal_triangulation_rounds(id) on delete cascade,
  player_id text not null,
  distance smallint not null check (distance >= 0),
  guess_x smallint check (guess_x between 0 and 9),
  guess_y smallint check (guess_y between 0 and 9),
  locked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- Nota sobre "sin des-lockeo" (decisión #3): esta tabla NO tiene un
-- constraint que impida escribir sobre una fila ya lockeada — la
-- restricción es de UX (el cliente deshabilita sus propios controles
-- tras lockear), no de integridad de datos. No hay ganancia de
-- seguridad en bloquear esto server-side: el snapshot que decide
-- solved/failed (ver el trigger de la sección 3) se toma una sola vez,
-- cuando los 4 confirmaron, así que un jugador editando su propia fila
-- después de su propio lock (si lograra saltarse la UI) como mucho se
-- perjudica a sí mismo, nunca a los demás ni al resultado ya resuelto
-- (el trigger no reevalúa una ronda que ya salió de 'active').

-- 2. RLS -----------------------------------------------------------------

alter table public.signal_triangulation_matches enable row level security;
alter table public.signal_triangulation_rounds enable row level security;
alter table public.signal_triangulation_locks enable row level security;

-- 2.1 signal_triangulation_matches: mismo régimen que lobby_matches
-- (sala efímera por conocimiento de lobby_id) para select/insert/update
-- de metadatos de partida — nada acá es secreto entre los 4 jugadores
-- (a diferencia de rounds/locks, donde sí hay algo que ocultar). No se
-- exige auth.uid() a nivel de esta tabla: el requisito de sesión real
-- (decisión #2) se aplica en profundidad en signal_triangulation_locks,
-- que es donde vive la información sensible.
drop policy if exists "str_matches_select_all" on public.signal_triangulation_matches;
create policy "str_matches_select_all"
  on public.signal_triangulation_matches for select
  using (true);

drop policy if exists "str_matches_insert_all" on public.signal_triangulation_matches;
create policy "str_matches_insert_all"
  on public.signal_triangulation_matches for insert
  with check (true);

drop policy if exists "str_matches_update_all" on public.signal_triangulation_matches;
create policy "str_matches_update_all"
  on public.signal_triangulation_matches for update
  using (true);

-- 2.2 signal_triangulation_rounds: la fuente (source_x/source_y) NO
-- puede tener select abierto — RLS protege filas, no columnas, así que
-- "dar select con using(true)" expondría la fuente en claro a
-- cualquiera con la consola de red abierta, sin importar qué columnas
-- "debería" pedir el cliente normal. Se bloquea select directo sobre la
-- tabla base por completo para los roles del cliente (vía REVOKE, no
-- vía RLS: ver nota más abajo), y se expone en cambio una vista sin
-- esas dos columnas.
revoke select on public.signal_triangulation_rounds from anon, authenticated;

drop policy if exists "str_rounds_no_direct_select" on public.signal_triangulation_rounds;
create policy "str_rounds_select_via_grant_only"
  on public.signal_triangulation_rounds for select
  using (true);
-- using(true), NO using(false) — bug corregido en esta revisión.
-- signal_triangulation_rounds_public más abajo tiene
-- security_invoker=true, lo que significa que sus lecturas se evalúan
-- CON los permisos y policies RLS de quien llama a la vista, no con los
-- del dueño. Con using(false) acá, ese security_invoker heredaba el
-- "false" también dentro de la vista, y CUALQUIER lectura — directa o
-- vía la vista pública — devolvía 0 filas o 403 (permission denied),
-- rompiendo por completo Signal Triangulation en producción: el REVOKE
-- de arriba ya es lo único necesario para bloquear el acceso DIRECTO a
-- la tabla (sin GRANT SELECT, ningún SELECT directo puede ejecutarse,
-- con o sin RLS) — la policy no necesita bloquear nada extra, solo
-- necesita existir porque RLS está enable()ado en la tabla y sin
-- ninguna policy de SELECT el default también sería denegar. El
-- control real de qué columnas se exponen lo hace la vista pública
-- (select explícito de columnas, sin source_x/source_y) más abajo, no
-- esta policy.
-- No se agrega policy de insert/update para el cliente: las únicas
-- escrituras a esta tabla las hace generate_signal_triangulation_round()
-- (security definer, más abajo), nunca un insert/update directo del
-- cliente. Sin policies de insert/update, el default de RLS (denegar)
-- ya cierra esa vía para cualquier rol que no sea el dueño de la
-- función security definer.

create or replace view public.signal_triangulation_rounds_public as
  select id, match_id, round_number, attempt_number, status, created_at, resolved_at
  from public.signal_triangulation_rounds;

grant select on public.signal_triangulation_rounds_public to anon, authenticated;

alter view public.signal_triangulation_rounds_public set (security_invoker = true);
-- security_invoker = true: la vista corre con los privilegios de quien
-- consulta, no con los del dueño de la vista — sin esto, una vista
-- creada por un rol con permisos amplios podría filtrar filas que la
-- policy de la tabla base (using(false) de arriba) debería bloquear.
-- Con security_invoker, la policy de la tabla base SÍ se evalúa al
-- consultar la vista, así que en la práctica el resultado es el mismo
-- (esta vista nunca expone source_x/source_y de todos modos, al no
-- seleccionar esas columnas) pero es la configuración correcta por
-- principio de menor privilegio, no solo por lo que la vista selecciona
-- hoy.

-- (No se agrega una policy separada para la vista: las vistas con
-- security_invoker heredan la policy de SELECT de la tabla base,
-- "str_rounds_select_via_grant_only" — ver esa policy más arriba para
-- el porqué de using(true) y no using(false).)

-- 2.3 signal_triangulation_locks: identidad real exigida (decisión #2).
-- Un jugador puede ver/escribir su PROPIA fila completa (incluida su
-- distance). Las filas de sus compañeros NO son legibles directamente
-- desde esta tabla (mismo problema de columnas que en rounds: guess_x/
-- guess_y de otro jugador no debe ser legible) — se expone en cambio
-- una vista reducida (solo el booleano de lockeado) para el resto del
-- equipo.
revoke select on public.signal_triangulation_locks from anon, authenticated;

drop policy if exists "str_locks_select_own_full" on public.signal_triangulation_locks;
create policy "str_locks_select_own_full"
  on public.signal_triangulation_locks for select
  using ((select auth.uid())::text = player_id);

drop policy if exists "str_locks_insert_own" on public.signal_triangulation_locks;
create policy "str_locks_insert_own"
  on public.signal_triangulation_locks for insert
  with check (
    (select auth.uid()) is not null
    and (select auth.uid())::text = player_id
  );
-- El chequeo explícito de "auth.uid() is not null" es lo que bloquea a
-- un cliente sin sesión: sin login, auth.uid() es null, la igualdad
-- contra cualquier player_id que mande el cliente falla siempre, y el
-- insert es rechazado — este es el mecanismo real detrás de "Signal
-- Triangulation exige sesión iniciada" (decisión #2), no solo una
-- policy más estricta que las demás.

drop policy if exists "str_locks_update_own" on public.signal_triangulation_locks;
create policy "str_locks_update_own"
  on public.signal_triangulation_locks for update
  using ((select auth.uid())::text = player_id)
  with check ((select auth.uid())::text = player_id);

create or replace view public.signal_triangulation_locks_public as
  select round_id, player_id, (locked_at is not null) as has_locked
  from public.signal_triangulation_locks;

grant select on public.signal_triangulation_locks_public to anon, authenticated;
alter view public.signal_triangulation_locks_public set (security_invoker = true);

-- 3. Función de generación de niveles (RPC, security definer) ----------------
--
-- ÚNICO lugar del sistema donde se elige/verifica la fuente oculta. No
-- existe equivalente de esta lógica en ningún archivo bajo js/views ni
-- js/games — el cliente solo invoca este RPC (o recibe su resultado
-- indirectamente vía el trigger de avance de ronda, sección 4) y jamás
-- ve source_x/source_y.
--
-- Algoritmo (ver diseño, sección 1.3): elige (x,y) al azar, calcula las
-- 4 distancias Manhattan reales a las 4 antenas fijas, y verifica por
-- fuerza bruta sobre las 100 celdas del tablero que ninguna otra celda
-- produce las 4 mismas distancias a la vez (evita el caso degenerado
-- de Manhattan) y que ninguna distancia sea trivialmente baja (< 2,
-- evita que un solo jugador delate la celda con su propio número).
create or replace function public.generate_signal_triangulation_round(
  p_match_id uuid,
  p_round_number smallint,
  p_attempt_number smallint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_x smallint;
  v_y smallint;
  v_d1 smallint; v_d2 smallint; v_d3 smallint; v_d4 smallint;
  v_candidates integer;
  v_attempts integer := 0;
  v_round_id uuid;
begin
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 500 then
      raise exception 'signal_triangulation_generation_failed'
        using errcode = 'P0001';
    end if;

    v_x := floor(random() * 10)::smallint;
    v_y := floor(random() * 10)::smallint;

    -- Antenas fijas: J1 (0,0), J2 (9,0), J3 (9,9), J4 (0,9).
    v_d1 := abs(v_x - 0) + abs(v_y - 0);
    v_d2 := abs(v_x - 9) + abs(v_y - 0);
    v_d3 := abs(v_x - 9) + abs(v_y - 9);
    v_d4 := abs(v_x - 0) + abs(v_y - 9);

    -- Rechazo 1: trivialidad (algún jugador está a distancia 0 o 1 de
    -- la fuente y podría delatarla sin necesitar al resto del equipo).
    if least(v_d1, v_d2, v_d3, v_d4) < 2 then
      continue;
    end if;

    -- Rechazo 2: unicidad real en la grilla acotada — fuerza bruta
    -- sobre las 100 celdas, no la derivación algebraica continua (que
    -- no considera los bordes 0..9). Cuenta cuántas celdas del tablero
    -- producen las 4 mismas distancias; debe ser exactamente 1 (la
    -- propia).
    select count(*) into v_candidates
    from generate_series(0, 9) gx,
         generate_series(0, 9) gy
    where abs(gx - 0) + abs(gy - 0) = v_d1
      and abs(gx - 9) + abs(gy - 0) = v_d2
      and abs(gx - 9) + abs(gy - 9) = v_d3
      and abs(gx - 0) + abs(gy - 9) = v_d4;

    if v_candidates != 1 then
      continue;
    end if;

    -- Candidato válido.
    exit;
  end loop;

  insert into public.signal_triangulation_rounds (
    match_id, round_number, attempt_number, source_x, source_y, status
  ) values (
    p_match_id, p_round_number, p_attempt_number, v_x, v_y, 'active'
  )
  returning id into v_round_id;

  -- Crea las 4 filas de lock (una por jugador de la partida), con la
  -- distancia ya calculada y guess/locked_at en null — el jugador ve su
  -- distance desde este momento (str_locks_select_own_full, sección
  -- 2.3), sin esperar a que nadie más haga nada.
  insert into public.signal_triangulation_locks (round_id, player_id, distance)
  select v_round_id, player_id, dist
  from (
    select m.player1_id as player_id, v_d1 as dist from public.signal_triangulation_matches m where m.id = p_match_id
    union all
    select m.player2_id, v_d2 from public.signal_triangulation_matches m where m.id = p_match_id
    union all
    select m.player3_id, v_d3 from public.signal_triangulation_matches m where m.id = p_match_id
    union all
    select m.player4_id, v_d4 from public.signal_triangulation_matches m where m.id = p_match_id
  ) as players(player_id, dist)
  where player_id is not null;

  return v_round_id;
end;
$$;

-- Solo puede invocarse vía RPC explícito (permiso de EXECUTE, no de
-- SELECT/INSERT directo sobre las tablas que toca) — mismo patrón que
-- purge_stale_lobbies del resto del proyecto.
revoke all on function public.generate_signal_triangulation_round(uuid, smallint, smallint) from public;
grant execute on function public.generate_signal_triangulation_round(uuid, smallint, smallint) to anon, authenticated;

-- 4. Resolución de LOCKs y avance/reintento de ronda -------------------------
--
-- Se dispara en cada insert/update de signal_triangulation_locks que
-- setea locked_at. Compara las 4 celdas entre sí Y contra la fuente real
-- (decisión #1) — coincidir solo entre sí no alcanza, porque un grupo
-- podría en teoría acordar socialmente una celda fija sin usar sus
-- distancias en absoluto; comparar también contra la fuente real es lo
-- que hace que "distance" (correctamente calculado) sea la única
-- fuente de verdad del juego.
create or replace function public.resolve_signal_triangulation_round()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  round_row record;
  match_row record;
  total_locked integer;
  distinct_cells integer;
  all_agree_and_correct boolean;
  next_round smallint;
  next_attempt smallint;
begin
  -- No hay riesgo de recursión infinita: este trigger llama (indirectamente,
  -- vía generate_signal_triangulation_round más abajo) a un INSERT sobre
  -- esta misma tabla para crear las 4 filas del siguiente intento/ronda,
  -- lo cual SÍ re-dispara este mismo trigger para cada una de esas 4
  -- filas nuevas — pero esas filas se insertan con locked_at en su
  -- default (null), así que el primer `if new.locked_at is null then
  -- return new` de cada una de esas re-invocaciones corta la cadena de
  -- inmediato. La recursión solo continuaría si se insertara una fila ya
  -- lockeada desde el vamos, lo cual generate_signal_triangulation_round
  -- nunca hace.
  if new.locked_at is null then
    return new;
  end if;

  -- Lockea la fila de la ronda para serializar chequeos concurrentes —
  -- mismo patrón que enforce_lobby_capacity (migration_015): sin este
  -- lock, 2 jugadores lockeando casi al mismo tiempo podrían ambos ver
  -- "todavía no son 4" antes de que cualquiera confirme, dejando la
  -- resolución sin disparar aunque en verdad ya sean 4.
  select * into round_row
  from public.signal_triangulation_rounds
  where id = new.round_id
  for update;

  if round_row.status != 'active' then
    return new; -- ya resuelta por otra fila concurrente; no reprocesar
  end if;

  select count(*) into total_locked
  from public.signal_triangulation_locks
  where round_id = new.round_id and locked_at is not null;

  if total_locked < 4 then
    return new; -- todavía esperando a que el resto confirme
  end if;

  select count(distinct (guess_x, guess_y)) into distinct_cells
  from public.signal_triangulation_locks
  where round_id = new.round_id;

  all_agree_and_correct := (
    distinct_cells = 1
    and exists (
      select 1 from public.signal_triangulation_locks l
      where l.round_id = new.round_id
        and l.guess_x = round_row.source_x
        and l.guess_y = round_row.source_y
      limit 1
    )
  );

  update public.signal_triangulation_rounds
  set status = case when all_agree_and_correct then 'solved' else 'failed' end,
      resolved_at = now()
  where id = new.round_id;

  select * into match_row
  from public.signal_triangulation_matches
  where id = round_row.match_id
  for update;

  if all_agree_and_correct then
    if round_row.round_number = 1 then
      -- Avanza a la ronda 2, intento 1.
      update public.signal_triangulation_matches
      set current_round = 2,
          rounds_won = rounds_won + 1
      where id = match_row.id;

      perform public.generate_signal_triangulation_round(match_row.id, 2, 1);
    else
      -- Ronda 2 superada: partida completa.
      update public.signal_triangulation_matches
      set status = 'completed',
          rounds_won = rounds_won + 1,
          completed_at = now()
      where id = match_row.id;
    end if;
  else
    -- Falló: reintentar la MISMA ronda con una fuente nueva, salvo que
    -- se haya agotado el límite de intentos (decisión #4).
    if round_row.attempt_number >= match_row.max_attempts_per_round then
      update public.signal_triangulation_matches
      set status = 'completed',
          completed_at = now()
      where id = match_row.id;
    else
      next_round := round_row.round_number;
      next_attempt := round_row.attempt_number + 1;
      perform public.generate_signal_triangulation_round(match_row.id, next_round, next_attempt);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists str_locks_resolve_round on public.signal_triangulation_locks;
create trigger str_locks_resolve_round
  after insert or update on public.signal_triangulation_locks
  for each row
  execute function public.resolve_signal_triangulation_round();

-- 5. Trigger: evitar que un jugador quede activo en dos partidas de
--    Signal Triangulation a la vez (mismo criterio que
--    prevent_double_active_match, migration_011, adaptado a 4 columnas
--    en vez de 2). No se reutiliza el trigger de lobby_matches porque
--    esta es una tabla distinta con su propia forma de fila — ver
--    sección 4 del diseño sobre por qué no se comparte lógica entre
--    ambos tipos de sub-partida.
create or replace function public.prevent_double_active_st_match()
returns trigger
language plpgsql
security definer
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
    array[new.player1_id, new.player2_id, new.player3_id, new.player4_id],
    null
  );
  if array_length(new_players, 1) is null then
    return new; -- ninguna columna de jugador llena todavía (fila recién creada)
  end if;

  select count(*)
  into conflicting_count
  from public.signal_triangulation_matches m
  where m.id <> new.id
    and m.status in ('waiting', 'playing')
    and (
      array[m.player1_id, m.player2_id, m.player3_id, m.player4_id]
      && new_players
    );
  -- El operador && de arrays de Postgres es "tienen algún elemento en
  -- común" — equivalente al OR explícito de comparaciones 1-a-1 que usa
  -- prevent_double_active_match, pero expresado sin repetir 8
  -- comparaciones manuales para 4x4 columnas.

  if conflicting_count > 0 then
    raise exception 'player_already_in_active_match' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists str_matches_prevent_double_active on public.signal_triangulation_matches;
create trigger str_matches_prevent_double_active
  before insert or update on public.signal_triangulation_matches
  for each row
  execute function public.prevent_double_active_st_match();

-- 6. Habilitar Realtime -------------------------------------------------------
--
-- IMPORTANTE: `alter publication ... add table` de Postgres solo acepta
-- tablas base, no vistas — intentar agregar
-- signal_triangulation_rounds_public/_locks_public fallaría en tiempo de
-- migración (error de Postgres, no algo que se pueda "intentar y
-- descartar" como el duplicate_object de abajo). Realtime debe
-- suscribirse a las TABLAS BASE.
--
-- Esto reabre el problema que la sección 2 quiso evitar: Realtime de
-- Supabase transmite por defecto el contenido crudo de la fila
-- (incluyendo columnas fuera de cualquier vista) a cualquier cliente
-- suscripto al canal `postgres_changes`, independientemente de las
-- policies de SELECT de la tabla — el mecanismo de RLS para
-- postgres_changes en Supabase es la propia publicación/autorización de
-- Realtime, no la policy de SELECT normal de PostgREST. En este
-- proyecto (ver setupRealtimeSubscriptions en lobbySystem.ts), las
-- suscripciones existentes no dependen de esto porque ninguna tabla del
-- lobby actual tiene una columna que deba ocultarse a algún participante
-- del propio lobby — este es el primer caso del proyecto donde sí
-- importa.
--
-- Nota sobre el fix de la policy de SELECT de esta revisión (más
-- arriba, "str_rounds_select_via_grant_only", using(true) en vez del
-- using(false) original): ese cambio es indiferente al riesgo de
-- Realtime descripto arriba. Realtime en Supabase evalúa autorización
-- vía la publicación/canal, no vía la policy de SELECT estándar de
-- PostgREST — así que using(false) NUNCA bloqueó el payload crudo de
-- Realtime sobre esta tabla (el riesgo documentado arriba ya existía
-- con el using(false) original), y using(true) tampoco lo empeora. Lo
-- único que cambió con el fix es que PostgREST (REST/RPC normal) ahora
-- puede leer la tabla vía la vista pública sin RLS, resolviendo el 403
-- que rompía Signal Triangulation en producción — el riesgo de Realtime
-- sigue abierto y documentado, sin relación con este fix.
do $$
begin
  alter publication supabase_realtime add table public.signal_triangulation_matches;
exception
  when duplicate_object then null;
end $$;

-- signal_triangulation_rounds: agregada a Realtime únicamently porque
-- Postgres no permite publicar una vista. El cliente NO debe suscribirse
-- a esta tabla sin verificar antes qué expone Realtime en la práctica —
-- ver nota extensa arriba. Esta migración documenta el riesgo en vez de
-- ocultarlo; resolverlo en firme (p. ej. con Realtime Authorization
-- basado en RLS, disponible en proyectos Supabase recientes) es trabajo
-- de infraestructura fuera del alcance de esta migración de esquema.
do $$
begin
  alter publication supabase_realtime add table public.signal_triangulation_rounds;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.signal_triangulation_locks;
exception
  when duplicate_object then null;
end $$;
-- Mismo riesgo documentado arriba aplica a signal_triangulation_locks
-- (guess_x/guess_y ajeno). El cliente debe consumir esta tabla por
-- Realtime SOLO para el propio player_id (filtro
-- `player_id=eq.<auth.uid()>` en la suscripción, ver
-- signalTriangulationSystem.ts) y usar
-- signal_triangulation_locks_public (consultada por REST, no por
-- Realtime crudo) para el conteo agregado "N de 4 lockeados" del resto
-- del equipo — nunca suscribirse sin filtro a esta tabla completa.
