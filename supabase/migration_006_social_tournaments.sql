-- ============================================================================
-- Migración 006: Tablas para Social System y Tournament System
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_005_coop_rooms.sql).
--
-- Contexto: socialSystem.ts y tournamentSystem.ts tienen código completo
-- para amigos, clanes, chat y torneos, pero las tablas de Supabase que
-- necesitan no existen. Esta migración crea las 7 tablas faltantes:
-- friends, friend_requests, clans, clan_members, chat_messages, tournaments,
-- tournament_participants.
-- ============================================================================

-- 1. Tabla de solicitudes de amistad -----------------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  receiver_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para búsquedas comunes
create index if not exists friend_requests_sender_idx
  on public.friend_requests (sender_id, status);
create index if not exists friend_requests_receiver_idx
  on public.friend_requests (receiver_id, status);

-- 2. Tabla de amigos ---------------------------------------------------------
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  player1_id text not null,
  player2_id text not null,
  friend_name text not null,
  friend_avatar text default '👤',
  friend_level int default 1,
  status text not null default 'offline'
    check (status in ('online', 'playing', 'away', 'offline')),
  current_game text,
  last_seen timestamptz not null default now(),
  is_favorite boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para búsquedas de amigos
create index if not exists friends_player1_idx
  on public.friends (player1_id);
create index if not exists friends_player2_idx
  on public.friends (player2_id);
create index if not exists friends_status_idx
  on public.friends (status, last_seen);

-- 3. Tabla de clanes ---------------------------------------------------------
create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  description text,
  leader_id text not null,
  member_count int not null default 1,
  level int not null default 1,
  xp int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice único para tags (no pueden haber dos clanes con el mismo tag)
create unique index if not exists clans_tag_key
  on public.clans (tag);

-- 4. Tabla de miembros de clanes --------------------------------------------
create table if not exists public.clan_members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  player_id text not null,
  role text not null default 'member'
    check (role in ('leader', 'officer', 'member')),
  joined_at timestamptz not null default now()
);

-- Índices para búsquedas de miembros
create index if not exists clan_members_clan_idx
  on public.clan_members (clan_id);
create index if not exists clan_members_player_idx
  on public.clan_members (player_id);

-- 5. Tabla de mensajes de chat -----------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null default 'global',
  sender_id text not null,
  sender_name text not null,
  sender_avatar text default '👤',
  content text not null,
  type text not null default 'text'
    check (type in ('text', 'system', 'achievement', 'challenge')),
  created_at timestamptz not null default now()
);

-- Índices para recuperar mensajes de un chat
create index if not exists chat_messages_chat_idx
  on public.chat_messages (chat_id, created_at desc);

-- 6. Tabla de torneos --------------------------------------------------------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null default 'weekly'
    check (type in ('weekly', 'seasonal', 'special', 'clan')),
  game_id text not null,
  max_participants int not null,
  current_participants int not null default 0,
  status text not null default 'registration'
    check (status in ('registration', 'in_progress', 'completed', 'cancelled')),
  start_time timestamptz not null,
  end_time timestamptz not null,
  registration_deadline timestamptz not null,
  bracket jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  rewards jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para búsquedas de torneos
create index if not exists tournaments_status_idx
  on public.tournaments (status, start_time);
create index if not exists tournaments_game_idx
  on public.tournaments (game_id, status);

-- 7. Tabla de participantes de torneos ---------------------------------------
create table if not exists public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id text not null,
  player_name text not null,
  avatar text default '👤',
  seed int default 0,
  current_rank int default 0,
  eliminated boolean default false,
  eliminated_at timestamptz,
  registered_at timestamptz not null default now()
);

-- Índices para búsquedas de participantes
create index if not exists tournament_participants_tournament_idx
  on public.tournament_participants (tournament_id);
create index if not exists tournament_participants_player_idx
  on public.tournament_participants (player_id);

-- 8. Row Level Security -------------------------------------------------------
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;
alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;

-- Políticas para friend_requests
-- Users can only see requests where they are sender or receiver
--
-- Dropea tanto el nombre viejo ("_all", de una versión anterior de este
-- mismo archivo) como el nombre actual ("_own") — sin el segundo drop,
-- correr esta migración una segunda vez (por ejemplo tras clonar el
-- repo en un proyecto Supabase que ya tenía el schema aplicado) fallaba
-- con 42710 "policy already exists", porque CREATE POLICY no admite
-- IF NOT EXISTS ni OR REPLACE.
drop policy if exists "friend_requests_select_all" on public.friend_requests;
drop policy if exists "friend_requests_select_own" on public.friend_requests;
create policy "friend_requests_select_own"
  on public.friend_requests for select
  using ((select auth.uid())::text = sender_id or (select auth.uid())::text = receiver_id);

-- Users can only insert requests where they are the sender
drop policy if exists "friend_requests_insert_all" on public.friend_requests;
drop policy if exists "friend_requests_insert_own" on public.friend_requests;
create policy "friend_requests_insert_own"
  on public.friend_requests for insert
  with check ((select auth.uid())::text = sender_id);

-- Users can only update requests where they are sender (cancel) or receiver (accept/decline)
drop policy if exists "friend_requests_update_all" on public.friend_requests;
drop policy if exists "friend_requests_update_own" on public.friend_requests;
create policy "friend_requests_update_own"
  on public.friend_requests for update
  using ((select auth.uid())::text = sender_id or (select auth.uid())::text = receiver_id);

-- Políticas para friends
-- Users can only see their own friend relationships
drop policy if exists "friends_select_all" on public.friends;
drop policy if exists "friends_select_own" on public.friends;
create policy "friends_select_own"
  on public.friends for select
  using ((select auth.uid())::text = player1_id or (select auth.uid())::text = player2_id);

-- Users can only insert friend relationships where they are player1
drop policy if exists "friends_insert_all" on public.friends;
drop policy if exists "friends_insert_own" on public.friends;
create policy "friends_insert_own"
  on public.friends for insert
  with check ((select auth.uid())::text = player1_id);

-- Users can only update their own friend relationships
drop policy if exists "friends_update_all" on public.friends;
drop policy if exists "friends_update_own" on public.friends;
create policy "friends_update_own"
  on public.friends for update
  using ((select auth.uid())::text = player1_id or (select auth.uid())::text = player2_id);

-- Políticas para clans
drop policy if exists "clans_select_all" on public.clans;
create policy "clans_select_all"
  on public.clans for select
  using (true);

drop policy if exists "clans_insert_all" on public.clans;
create policy "clans_insert_all"
  on public.clans for insert
  with check (true);

drop policy if exists "clans_update_all" on public.clans;
create policy "clans_update_all"
  on public.clans for update
  using (true);

-- Políticas para clan_members
drop policy if exists "clan_members_select_all" on public.clan_members;
create policy "clan_members_select_all"
  on public.clan_members for select
  using (true);

drop policy if exists "clan_members_insert_all" on public.clan_members;
create policy "clan_members_insert_all"
  on public.clan_members for insert
  with check (true);

drop policy if exists "clan_members_delete_all" on public.clan_members;
create policy "clan_members_delete_all"
  on public.clan_members for delete
  using (true);

-- Políticas para chat_messages
drop policy if exists "chat_messages_select_all" on public.chat_messages;
create policy "chat_messages_select_all"
  on public.chat_messages for select
  using (true);

drop policy if exists "chat_messages_insert_all" on public.chat_messages;
create policy "chat_messages_insert_all"
  on public.chat_messages for insert
  with check (true);

-- Políticas para tournaments
drop policy if exists "tournaments_select_all" on public.tournaments;
create policy "tournaments_select_all"
  on public.tournaments for select
  using (true);

drop policy if exists "tournaments_insert_all" on public.tournaments;
create policy "tournaments_insert_all"
  on public.tournaments for insert
  with check (true);

drop policy if exists "tournaments_update_all" on public.tournaments;
create policy "tournaments_update_all"
  on public.tournaments for update
  using (true);

-- Políticas para tournament_participants
drop policy if exists "tournament_participants_select_all" on public.tournament_participants;
create policy "tournament_participants_select_all"
  on public.tournament_participants for select
  using (true);

drop policy if exists "tournament_participants_insert_all" on public.tournament_participants;
create policy "tournament_participants_insert_all"
  on public.tournament_participants for insert
  with check (true);

drop policy if exists "tournament_participants_delete_all" on public.tournament_participants;
create policy "tournament_participants_delete_all"
  on public.tournament_participants for delete
  using (true);

-- 9. Habilitar Realtime sobre las tablas que necesitan suscripciones ---------
-- socialSystem.ts se suscribe a friends, clans, chat_messages
-- tournamentSystem.ts se suscribe a tournaments

do $$
begin
  alter publication supabase_realtime add table public.friends;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.clans;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tournaments;
exception
  when duplicate_object then null;
end $$;
