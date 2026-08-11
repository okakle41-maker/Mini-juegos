-- ============================================================================
-- Migración 022: RLS faltante en ship_control_morse_table
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query (después de
-- migration_021_generic_role_helpers.sql).
--
-- Contexto: auditoría de RLS sobre las 21 migraciones existentes. Todas las
-- tablas nuevas creadas después de schema.sql habilitan RLS excepto esta
-- (migration_017_ship_control.sql crea ship_control_morse_table pero nunca
-- llama a `enable row level security` sobre ella, a diferencia de las otras
-- 6 tablas que sí crea esa misma migración).
--
-- Sin RLS, el default de Supabase para una tabla en `public` es dejar pasar
-- select/insert/update/delete a los roles anon/authenticated (no hay ningún
-- REVOKE explícito en schema.sql que lo cambie). El contenido en sí es
-- público a propósito (dígito → patrón Morse, ver comentario original en
-- migration_017: "es dominio público, no un secreto") así que el problema
-- no es de confidencialidad — es que además de poder leerla, cualquiera con
-- la anon key podría hacer INSERT/UPDATE/DELETE sobre ella. Y esta tabla no
-- es solo decorativa: encode_ship_morse() (también en migration_017) la
-- consulta para calcular el patrón Morse real que ve un jugador a partir
-- del código de la partida (ver línea ~757, uso dentro del flujo de
-- resolución). Si se pudiera alterar una fila (ej. cambiar el pattern de
-- un symbol), se rompe la integridad de esa resolución para cualquier
-- partida en curso — no expone el código, pero permite manipular cómo se
-- traduce.
--
-- Fix: habilitar RLS y agregar solo una policy de SELECT (using true, es
-- dato público de referencia). No se agrega policy de insert/update/delete
-- a propósito: sin ellas, RLS deniega esas operaciones por default para
-- cualquier rol — que es lo que corresponde para una tabla de referencia
-- estática que el cliente nunca necesita escribir.
-- ============================================================================

alter table public.ship_control_morse_table enable row level security;

drop policy if exists "ship_control_morse_table_select_all" on public.ship_control_morse_table;
create policy "ship_control_morse_table_select_all"
  on public.ship_control_morse_table for select
  using (true);
