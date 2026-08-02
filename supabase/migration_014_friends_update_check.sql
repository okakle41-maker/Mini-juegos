-- ============================================================================
-- Migración 014: WITH CHECK en updates de friends/friend_requests
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_013_clan_leader_scope.sql).
--
-- Contexto: friend_requests_update_own y friends_update_own
-- (migration_006) tenían USING para decidir qué filas se pueden tocar,
-- pero ningún WITH CHECK que valide los valores resultantes del UPDATE.
-- En Postgres RLS, sin WITH CHECK en un UPDATE, el USING solo se evalúa
-- contra la fila ANTES del cambio — nada impide que, dentro de esa
-- misma fila ya autorizada, el UPDATE reescriba sender_id/receiver_id
-- (friend_requests) o player1_id/player2_id (friends) hacia terceros
-- arbitrarios. Ejemplo concreto: quien es receiver_id de una solicitud
-- pendiente podría, en vez de solo aceptarla/rechazarla (que es lo
-- único que el cliente real hace, ver acceptFriendRequest/
-- declineFriendRequest en socialSystem.ts), reescribir esa misma fila
-- para que quede como si fuera entre otras dos personas — falsificando
-- de quién es la solicitud, o "regalándole" una amistad ya aceptada a
-- un tercero sin su participación.
--
-- El cliente hoy nunca necesita cambiar esas columnas de identidad en
-- un UPDATE (solo status en friend_requests; friends no tiene ningún
-- UPDATE remoto hoy, is_favorite es local-only vía setFavoriteFriend en
-- socialSystem.ts), así que este WITH CHECK no rompe ningún flujo
-- existente — solo cierra la puerta a reescribir columnas que el
-- frontend nunca tocó.
-- ============================================================================

do $$
begin
  if to_regclass('public.friend_requests') is null then
    raise exception 'migration_006_social_tournaments.sql no se ejecutó todavía — corré esa migración primero (crea las tablas public.friend_requests/public.friends que esta migración protege).';
  end if;
end $$;

-- 1. friend_requests: el UPDATE no puede cambiar sender_id/receiver_id -------
drop policy if exists "friend_requests_update_own" on public.friend_requests;
create policy "friend_requests_update_own"
  on public.friend_requests for update
  using ((select auth.uid())::text = sender_id or (select auth.uid())::text = receiver_id)
  with check ((select auth.uid())::text = sender_id or (select auth.uid())::text = receiver_id);
-- Nota: el with check no puede distinguir "solo puede tocar status" de
-- "puede tocar cualquier columna siempre que sender_id/receiver_id no
-- cambien" con esta sola condición — sigue permitiendo, por ejemplo,
-- que el receiver reescriba created_at. Alcanza para cerrar el hueco
-- principal (suplantar de quién es la solicitud); restringir columna
-- por columna requeriría una función security definer dedicada en vez
-- de una policy declarativa, que no se justifica hoy dado que el
-- cliente real solo toca status.

-- 2. friends: el UPDATE no puede cambiar player1_id/player2_id ---------------
drop policy if exists "friends_update_own" on public.friends;
create policy "friends_update_own"
  on public.friends for update
  using ((select auth.uid())::text = player1_id or (select auth.uid())::text = player2_id)
  with check ((select auth.uid())::text = player1_id or (select auth.uid())::text = player2_id);
