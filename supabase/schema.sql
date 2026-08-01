-- ============================================================================
-- Esquema de Supabase para Minijuegos: usuarios + scoreboard global
-- ============================================================================
-- Ejecutar esto UNA VEZ en: Supabase Dashboard → SQL Editor → New query
--
-- Diseño:
--   - auth.users (tabla interna de Supabase): guarda email + password
--     hasheado. Nosotros nunca vemos ni tocamos el hash — Supabase Auth
--     se encarga con bcrypt por debajo. El "email" que va a usar el juego
--     es sintético (username@minijuegos.local), porque el registro pide
--     nombre de usuario, no email real — ver auth.ts en el frontend.
--   - public.profiles: una fila por usuario, con el username visible y
--     único. Ligada 1:1 a auth.users por id. Es la tabla que garantiza
--     "no se pueden repetir nombres" (constraint UNIQUE + índice
--     case-insensitive, para que "Ana" y "ana" no puedan coexistir).
--   - public.scores: un score por partida jugada. game_key identifica el
--     minijuego (mismo string que gameId en GameRegistry). Un usuario
--     autenticado solo puede insertar scores con su propio user_id — lo
--     impone RLS, no el frontend, así que no se puede falsear ni con
--     DevTools abierto.
-- ============================================================================

-- 1. Tabla de perfiles públicos, uno por usuario autenticado ------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_lower text generated always as (lower(username)) stored,
  created_at timestamptz not null default now()
);

-- Unicidad de username sin distinguir mayúsculas/minúsculas: "Ana" y "ana"
-- se consideran el mismo nombre para evitar confusión en el scoreboard.
create unique index if not exists profiles_username_lower_key
  on public.profiles (username_lower);

-- Username: 3-20 caracteres, solo letras/números/guion bajo. Se valida acá
-- Y en el frontend (el frontend es solo UX, esto es lo que de verdad
-- impide guardar algo inválido).
--
-- Nota: "ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS" NO es sintaxis
-- válida en Postgres (a diferencia de CREATE TABLE/POLICY IF NOT
-- EXISTS, que sí existen) — un error real que este script tenía y que
-- solo se nota al re-ejecutar el archivo completo una segunda vez
-- (falla con "syntax error at or near NOT"). Se usa el patrón estándar
-- de Postgres para constraints idempotentes: intentar agregarla dentro
-- de un bloque DO, y si ya existe, Postgres lanza duplicate_object, que
-- se atrapa y se ignora.
do $$
begin
  alter table public.profiles
    add constraint username_format
    check (username ~ '^[A-Za-z0-9_]{3,20}$');
exception
  when duplicate_object then null;
end $$;

-- 2. Tabla de puntuaciones (scoreboard global) --------------------------------
-- check (value >= 0): RLS (más abajo) solo garantiza que el user_id sea
-- el del usuario logueado, no que el valor tenga sentido — sin este
-- check, cualquier usuario autenticado podría insertar un score
-- negativo o absurdamente alto llamando a la API de Supabase directo
-- desde DevTools, sin pasar por ningún minijuego real. Ver migración
-- 003 para el mismo check aplicado sobre una base ya existente.
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_key text not null,
  value integer not null check (value >= 0),
  total integer,
  created_at timestamptz not null default now()
);

create index if not exists scores_game_key_value_idx
  on public.scores (game_key, value desc);

create index if not exists scores_user_id_idx
  on public.scores (user_id);

-- 3. Row Level Security --------------------------------------------------------
-- RLS es lo que hace que esto sea seguro de verdad, no el código del
-- frontend: aunque alguien abra DevTools y llame a la API de Supabase
-- directamente con su propia sesión, la base de datos rechaza cualquier
-- operación que no cumpla estas políticas.

alter table public.profiles enable row level security;
alter table public.scores enable row level security;

-- profiles: cualquiera (incluso sin sesión) puede LEER todos los perfiles
-- — se necesita para mostrar nombres en el scoreboard global — pero solo
-- el dueño de la fila puede crear/editar la suya, y nunca puede tener
-- más de un perfil (el INSERT exige id = auth.uid()).
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  -- (select auth.uid()) en vez de auth.uid() directo: envuelto en un
  -- subselect, Postgres lo evalúa una sola vez por consulta en vez de
  -- una vez por fila. Con pocas filas no se nota, pero es la forma
  -- recomendada por Supabase (Database → Advisors marca lo contrario
  -- como advertencia de performance) y no cuesta nada hacerlo bien
  -- desde el principio.
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- scores: cualquiera puede LEER (scoreboard global público), pero solo
-- un usuario autenticado puede insertar, y únicamente con su propio
-- user_id — así nadie puede insertar un score a nombre de otro jugador.
-- No hay política de UPDATE/DELETE: los scores son inmutables una vez
-- guardados, por diseño (evita manipular el historial después del hecho).
drop policy if exists "scores_select_all" on public.scores;
create policy "scores_select_all"
  on public.scores for select
  using (true);

drop policy if exists "scores_insert_own" on public.scores;
create policy "scores_insert_own"
  on public.scores for insert
  with check ((select auth.uid()) = user_id);

-- 4. Vista de "mejor score por usuario y juego" -------------------------------
-- Simplifica el leaderboard: sin esto, el frontend tendría que traer TODOS
-- los scores y filtrar el mejor de cada usuario en JS. Con la vista, la
-- base de datos ya devuelve solo el mejor de cada quien.
-- security_invoker = true: por defecto Postgres crea las vistas con
-- SECURITY DEFINER implícito (se ejecutan con los permisos de quien la
-- creó, no de quien la consulta). Para esta vista específica el efecto
-- práctico es el mismo hoy (solo lee tablas ya públicas para SELECT),
-- pero es la práctica correcta: si en el futuro se restringe el acceso
-- de lectura a `scores` o `profiles`, esta vista respeta esa
-- restricción en vez de ignorarla silenciosamente. Sin esto, Supabase
-- Database → Advisors la marca como advertencia de seguridad.
create or replace view public.best_scores
  with (security_invoker = true)
as
select distinct on (s.user_id, s.game_key)
  s.game_key,
  s.user_id,
  p.username,
  s.value,
  s.total,
  s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.user_id, s.game_key, s.value desc, s.created_at asc;

-- 5. Vista de ranking global agregado (panel "TOP GLOBAL" del HUD) ------------
-- Los distintos minijuegos usan unidades incompatibles entre sí (segundos,
-- aciertos, puntos...), así que no existe una "suma de XP" real que se
-- pueda comparar entre usuarios. La métrica que sí es comparable entre
-- cualquier par de jugadores, sin importar qué jueguen, es la cantidad
-- total de partidas registradas — por eso el ranking global usa
-- games_played, no una suma de value.
create or replace view public.global_activity_rank
  with (security_invoker = true)
as
select
  p.username,
  count(s.id) as games_played
from public.profiles p
join public.scores s on s.user_id = p.id
group by p.id, p.username
order by games_played desc;