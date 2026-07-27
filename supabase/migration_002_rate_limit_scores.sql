-- ============================================================================
-- Migración 002: rate limit de inserts en public.scores
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query.
-- Completa el punto dejado pendiente en SUPABASE_RATE_LIMITING.md — ver
-- ese archivo para el contexto completo de por qué esto vive en SQL y
-- no en el cliente (RLS/triggers son la única capa que un script no
-- puede saltarse llamando a la API de Supabase directo).
--
-- Umbral elegido: máximo 10 scores por usuario en una ventana de 60
-- segundos.
--
-- Cómo se llegó a ese número (a partir de datos reales del catálogo,
-- no a ojo): el minijuego más corto del catálogo es Typix, con un
-- timer fijo de 60s por partida (ver `let timeLeft = 60` en
-- js/games/typix.logic.ts) — es decir, ni jugando el juego más rápido
-- del catálogo de punta a punta un usuario real genera más de 1 score
-- por minuto en ESE juego. Pero el límite es global por usuario (no
-- por juego), y un jugador legítimo puede alternar entre varios
-- minijuegos cortos seguidos (terminar Termita, entrar a Typix,
-- terminar y salir, entrar a Simon...) — 10/minuto da margen de sobra
-- para eso (un score cada 6s en promedio) sin abrir la puerta a un
-- script insertando scores en bucle.
--
-- Es un límite conservador a propósito: mejor demasiado permisivo que
-- bloquear a un jugador legítimo por error. Si en el futuro se ve
-- abuso real que este umbral no frena, se ajusta bajando el número, no
-- cambiando el mecanismo.
-- ============================================================================

create or replace function public.check_scores_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  select count(*)
  into recent_count
  from public.scores
  where user_id = new.user_id
    and created_at > now() - interval '60 seconds';

  if recent_count >= 10 then
    raise exception 'Demasiadas puntuaciones enviadas en poco tiempo. Esperá un momento.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists scores_rate_limit_trigger on public.scores;
create trigger scores_rate_limit_trigger
  before insert on public.scores
  for each row
  execute function public.check_scores_rate_limit();
