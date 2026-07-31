-- ============================================================================
-- Migración 005: Salas coop por código para MultiplayerSystem
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- schema.sql y las migraciones 001-004).
--
-- Contexto: js/multiplayerSystem.ts ya definía Match/Player/matchmaking en
-- TypeScript, pero las tablas que necesita (live_matches, match_messages)
-- nunca se crearon — la vista Multiplayer del lobby no funcionaba en
-- producción. Esta migración las agrega, con un cambio de diseño respecto
-- a lo que insinuaba el código original: en vez de (o adicionalmente a)
-- matchmaking automático por skill, se agrega emparejamiento manual por
-- código de sala + rol elegido por el jugador — es lo que usa Letters Fall
-- coop (uno ve las palabras, el otro solo escribe), donde "el jugador más
-- parecido en skill" no tiene sentido: los dos roles son necesariamente
-- distintos, no hay curva de habilidad que emparejar.
--
-- Diseño de acceso: a diferencia de profiles/scores (ligadas a una cuenta
-- autenticada), una sala coop es efímera y no requiere login — cualquiera
-- con el código de 4 caracteres puede unirse. Por eso el modelo de RLS acá
-- es distinto: no se filtra por auth.uid(), se filtra por "conocer el
-- room_code". Esto es intencional y equivalente en garantías a lo que ya
-- hacía roomManager.ts sobre Realtime Broadcast (un canal por código, sin
-- autenticación) — simplemente ahora el transporte es la propia tabla en
-- vez de un canal efímero, para reutilizar la infraestructura de
-- MultiplayerSystem en vez de mantener dos sistemas de tiempo real
-- paralelos.
-- ============================================================================

-- 1. Tabla de salas/matches --------------------------------------------------
-- Una fila por sala. room_code es lo que el jugador que crea la sala
-- comparte de palabra con el otro. game_id identifica el minijuego
-- ('letters' hoy, cualquier otro coop futuro reutiliza la misma tabla).
-- players es un array JSON de { id, role, joined_at } — no una tabla
-- separada, porque una sala coop de este tipo tiene siempre 2 jugadores
-- como máximo y nunca necesita un JOIN; modelarlo como columna evita una
-- tabla extra y las políticas RLS que le corresponderían.
create table if not exists public.live_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  game_id text not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'completed', 'abandoned')),
  players jsonb not null default '[]'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  winner_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Índice de búsqueda por código: es la única forma en que el frontend
-- localiza una sala (nunca por id directamente al unirse).
create index if not exists live_matches_room_code_idx
  on public.live_matches (room_code)
  where status in ('waiting', 'playing');

-- Un código no puede tener dos salas activas a la vez — evita que "crear
-- sala" genere un código que colisione con una sala en curso.
create unique index if not exists live_matches_active_room_code_key
  on public.live_matches (room_code)
  where status in ('waiting', 'playing');

-- Las salas viejas no sirven de nada pasado un rato: sin este límite, una
-- sala 'waiting' que nadie nunca acompaña quedaría reservando su código
-- para siempre porque el índice único de arriba solo libera el código al
-- cambiar de estado. Este check no lo hace cumplir la base de datos por sí
-- sola (no hay cron job acá) — ver nota en migration_002 sobre por qué el
-- rate limiting de scores tampoco se resuelve completamente en SQL; acá el
-- frontend marca 'abandoned' salas propias al salir de la vista de sala
-- (ver leaveRoomMatch() en js/multiplayerSystem.ts, llamado tanto desde
-- js/views/multiplayer.logic.ts al salir de esa vista como desde
-- RoomSession.leave() en cada juego coop, p.ej. js/games/lettersFall.logic.ts)
-- y esta migración deja preparado el terreno para un cron de limpieza
-- futuro si hiciera falta.

-- 2. Tabla de mensajes dentro de una sala ------------------------------------
-- Transporte de eventos de juego en tiempo real (no solo chat de texto,
-- pese al nombre heredado de multiplayerSystem.sendMatchMessage): el
-- campo `message` guarda JSON serializado con { type, payload } — por
-- ejemplo { type: 'typer:input', payload: { value: 'AGUA' } } — y cada
-- lado del match escucha postgres_changes sobre esta tabla filtrando por
-- match_id, igual que ya hacía handleMatchUpdate en multiplayerSystem.ts
-- para live_matches.
create table if not exists public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.live_matches(id) on delete cascade,
  player_id text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists match_messages_match_id_idx
  on public.match_messages (match_id, created_at);

-- 3. Row Level Security -------------------------------------------------------
alter table public.live_matches enable row level security;
alter table public.match_messages enable row level security;

-- live_matches: lectura y escritura abiertas a cualquiera (con o sin
-- sesión). Esto es intencional, no un descuido — ver la nota de diseño al
-- principio del archivo: una sala coop es efímera, se protege por el
-- conocimiento del room_code (4 caracteres al azar, igual de "secreto"
-- que lo era antes un nombre de canal de Realtime Broadcast), no por
-- auth.uid(). El peor caso de abuso es que alguien cree salas vacías sin
-- parar, que es exactamente igual de barato/inofensivo que lo que ya
-- permitía roomManager.ts sobre Realtime.
drop policy if exists "live_matches_select_all" on public.live_matches;
create policy "live_matches_select_all"
  on public.live_matches for select
  using (true);

drop policy if exists "live_matches_insert_all" on public.live_matches;
create policy "live_matches_insert_all"
  on public.live_matches for insert
  with check (true);

drop policy if exists "live_matches_update_all" on public.live_matches;
create policy "live_matches_update_all"
  on public.live_matches for update
  using (true);

-- match_messages: mismo criterio — cualquiera que sepa el match_id (que
-- solo se conoce habiendo entrado a la sala por su código) puede leer y
-- escribir. No hay política de UPDATE/DELETE: los mensajes son
-- inmutables, igual que los scores del scoreboard principal.
drop policy if exists "match_messages_select_all" on public.match_messages;
create policy "match_messages_select_all"
  on public.match_messages for select
  using (true);

drop policy if exists "match_messages_insert_all" on public.match_messages;
create policy "match_messages_insert_all"
  on public.match_messages for insert
  with check (true);

-- 4. Habilitar Realtime sobre ambas tablas -----------------------------------
-- postgres_changes (lo que usa multiplayerSystem.ts, a diferencia del
-- Broadcast/Presence que usaba roomManager.ts) requiere que la tabla esté
-- agregada a la publicación de Realtime — si esto no se corre, los
-- listeners de setupRealtimeSubscriptions() se suscriben sin error pero
-- nunca reciben ningún evento, un fallo silencioso difícil de diagnosticar
-- desde el frontend.
do $$
begin
  alter publication supabase_realtime add table public.live_matches;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.match_messages;
exception
  when duplicate_object then null;
end $$;
