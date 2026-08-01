-- ============================================================================
-- Migración 010: settings compartidos en live_matches
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_007_friends_delete_policy.sql — independiente de
-- migration_008_lobbies.sql/migration_009_lobby_expiration.sql, que
-- tocan un sistema de salas distinto (live_matches acá, lobbies allá);
-- el orden entre estas y aquellas no importa, alcanza con que las tres
-- corran después de la 007).
--
-- Contexto: para que el jugador que crea una sala (simon/arrow/termita/
-- letters) pueda fijar la dificultad para ambos, necesitamos un lugar en
-- la fila de la sala donde guardar esa config y que el segundo jugador la
-- lea al unirse. `players`/`scores` ya tienen semántica propia (estado de
-- jugadores, puntajes) — se agrega una columna dedicada en vez de
-- sobrecargar esas.
-- ============================================================================

alter table public.live_matches
  add column if not exists settings jsonb not null default '{}'::jsonb;
