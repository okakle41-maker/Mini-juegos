-- ============================================================================
-- Migración 003: CHECK (value >= 0) en public.scores
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query.
-- Seguro de correr sobre una base con datos existentes: no borra ni
-- modifica ninguna fila. Si ya existiera algún score negativo cargado
-- previamente, este ALTER TABLE fallará al validar los datos existentes
-- — en ese caso hay que decidir a mano qué hacer con esas filas (no se
-- eliminan automáticamente acá) antes de re-correr la migración.
--
-- Por qué: RLS (scores_insert_own) solo garantiza que el user_id
-- insertado sea el del usuario autenticado — no valida que el valor
-- del score tenga sentido. Sin este check, cualquier usuario logueado
-- podía insertar un score negativo o arbitrariamente alto llamando a
-- la API de Supabase directo desde DevTools, sin pasar por ningún
-- minijuego real, y aparecer primero en el scoreboard global.
--
-- Mismo patrón idempotente que username_format en schema.sql:
-- "ADD CONSTRAINT IF NOT EXISTS" no es sintaxis válida en Postgres, así
-- que se intenta agregar dentro de un bloque DO y se ignora el error si
-- la constraint ya existe (duplicate_object) — permite re-correr este
-- archivo sin que falle en una base donde ya se aplicó.
-- ============================================================================

do $$
begin
  alter table public.scores
    add constraint scores_value_non_negative
    check (value >= 0);
exception
  when duplicate_object then null;
end $$;
