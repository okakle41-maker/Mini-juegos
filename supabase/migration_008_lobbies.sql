-- ============================================================================
-- Migración 008: Lobbies grupales (hasta 8 jugadores) con sub-partidas 1v1
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_007_social_fixes.sql).
--
-- Contexto: live_matches/match_messages (migration_005) modelan una sala
-- como exactamente 1v1 con game_id fijo desde su creación — el comentario
-- de esa migración lo dice explícitamente ("una sala coop de este tipo
-- tiene siempre 2 jugadores como máximo"). Eso sirve para Letters Fall
-- (coop asimétrico) y para las partidas 1v1 sueltas de Simon/Arrow/Termita,
-- pero no alcanza para "8 amigos en un mismo lobby, jugando distintos
-- minijuegos entre ellos o especteándose" — game_id fijo por sala no
-- permite que dentro del mismo grupo unos jueguen Simon y otros Termita a
-- la vez.
--
-- Modelo nuevo (paralelo a live_matches, no lo reemplaza — Letters Fall
-- sigue usando live_matches tal cual):
--   lobbies        → el grupo de hasta 8 personas, identificado por código.
--   lobby_players  → una fila por persona en el lobby, con su estado
--                    actual (idle/waiting_match/playing/spectating) y en
--                    qué sub-partida está, si corresponde.
--   lobby_matches  → una sub-partida 1v1 (Simon/Arrow/Termita) dentro de
--                    un lobby. Puede haber varias activas a la vez para
--                    el mismo lobby_id, cada una con su propio game_id.
--   lobby_match_messages → transporte de eventos de juego (split-screen:
--                    sendEvent/onRivalEvent) para una lobby_match — tabla
--                    separada de match_messages a propósito, para no
--                    mezclar los dos sistemas de sala en la misma tabla ni
--                    tener que discriminar de qué sistema es cada fila.
-- ============================================================================

-- 1. Lobbies ------------------------------------------------------------------
create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  host_id text not null,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists lobbies_room_code_idx
  on public.lobbies (room_code)
  where status = 'open';

-- Un código no puede tener dos lobbies abiertos a la vez, igual criterio
-- que live_matches_active_room_code_key en migration_005.
create unique index if not exists lobbies_active_room_code_key
  on public.lobbies (room_code)
  where status = 'open';

-- 2. Jugadores del lobby --------------------------------------------------------
-- Una fila por persona presente en el lobby. `status` es el estado
-- "global" de esa persona dentro del lobby en un momento dado — el
-- producto pedido es que cada jugador esté en una sola cosa a la vez
-- (jugando, esperando rival, o especteando), nunca varias sub-partidas
-- en simultáneo, así que esto es una columna simple y no una relación
-- N a N con lobby_matches.
--
-- current_match_id es nullable: null cuando status='idle' (parado en el
-- lobby sin hacer nada todavía). Cuando status='spectating',
-- current_match_id apunta a la sub-partida que está mirando (no es
-- jugador de esa partida — spectator_ids en lobby_matches es la lista
-- real de quién especta qué, esta columna es solo para que el propio
-- cliente sepa qué estaba mirando al reconectar).
create table if not exists public.lobby_players (
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  player_id text not null,
  username text not null,
  status text not null default 'idle'
    check (status in ('idle', 'waiting_match', 'playing', 'spectating')),
  current_match_id uuid,
  joined_at timestamptz not null default now(),
  primary key (lobby_id, player_id)
);

-- 3. Sub-partidas dentro de un lobby --------------------------------------------
create table if not exists public.lobby_matches (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  game_id text not null check (game_id in ('simon', 'arrow', 'termita')),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'completed', 'abandoned')),
  player1_id text not null,
  player2_id text,
  settings jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  winner_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists lobby_matches_lobby_id_idx
  on public.lobby_matches (lobby_id)
  where status in ('waiting', 'playing');

-- 4. Mensajes/eventos de juego de una sub-partida -------------------------------
create table if not exists public.lobby_match_messages (
  id uuid primary key default gen_random_uuid(),
  lobby_match_id uuid not null references public.lobby_matches(id) on delete cascade,
  player_id text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists lobby_match_messages_match_id_idx
  on public.lobby_match_messages (lobby_match_id, created_at);

-- 5. Row Level Security ---------------------------------------------------------
-- Mismo criterio que migration_005: protegido por conocimiento del
-- room_code/lobby_id (efímero, no ligado a cuenta), no por auth.uid().
-- Unirse a un lobby no requiere sesión iniciada.
alter table public.lobbies enable row level security;
alter table public.lobby_players enable row level security;
alter table public.lobby_matches enable row level security;
alter table public.lobby_match_messages enable row level security;

drop policy if exists "lobbies_select_all" on public.lobbies;
create policy "lobbies_select_all" on public.lobbies for select using (true);
drop policy if exists "lobbies_insert_all" on public.lobbies;
create policy "lobbies_insert_all" on public.lobbies for insert with check (true);
drop policy if exists "lobbies_update_all" on public.lobbies;
create policy "lobbies_update_all" on public.lobbies for update using (true);

drop policy if exists "lobby_players_select_all" on public.lobby_players;
create policy "lobby_players_select_all" on public.lobby_players for select using (true);
drop policy if exists "lobby_players_insert_all" on public.lobby_players;
create policy "lobby_players_insert_all" on public.lobby_players for insert with check (true);
drop policy if exists "lobby_players_update_all" on public.lobby_players;
create policy "lobby_players_update_all" on public.lobby_players for update using (true);
drop policy if exists "lobby_players_delete_all" on public.lobby_players;
create policy "lobby_players_delete_all" on public.lobby_players for delete using (true);

drop policy if exists "lobby_matches_select_all" on public.lobby_matches;
create policy "lobby_matches_select_all" on public.lobby_matches for select using (true);
drop policy if exists "lobby_matches_insert_all" on public.lobby_matches;
create policy "lobby_matches_insert_all" on public.lobby_matches for insert with check (true);
drop policy if exists "lobby_matches_update_all" on public.lobby_matches;
create policy "lobby_matches_update_all" on public.lobby_matches for update using (true);

drop policy if exists "lobby_match_messages_select_all" on public.lobby_match_messages;
create policy "lobby_match_messages_select_all" on public.lobby_match_messages for select using (true);
drop policy if exists "lobby_match_messages_insert_all" on public.lobby_match_messages;
create policy "lobby_match_messages_insert_all" on public.lobby_match_messages for insert with check (true);

-- 6. Límite de 8 jugadores por lobby --------------------------------------------
-- No se puede expresar como constraint declarativo simple sobre
-- lobby_players (necesita contar filas hermanas), así que se aplica con
-- un trigger BEFORE INSERT — rechaza el insert #9 en vez de dejar que el
-- frontend sea la única barrera (que además tiene que chequear esto de
-- todos modos para poder avisarle al usuario "lobby lleno" con un mensaje
-- claro, en vez de un error crudo de Postgres).
create or replace function public.enforce_lobby_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.lobby_players where lobby_id = new.lobby_id) >= 8 then
    raise exception 'lobby_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists lobby_players_capacity_check on public.lobby_players;
create trigger lobby_players_capacity_check
  before insert on public.lobby_players
  for each row
  execute function public.enforce_lobby_capacity();

-- 7. Habilitar Realtime -----------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.lobbies;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.lobby_players;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.lobby_matches;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.lobby_match_messages;
exception
  when duplicate_object then null;
end $$;
