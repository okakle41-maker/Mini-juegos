/**
 * hudPanel.ts — Rellena las secciones "SEMANA" y "TOP GLOBAL" del HUD
 * lateral (aside#hudPanel en index.html) con datos reales.
 *
 * El HUD tenía 4 secciones hardcodeadas en el HTML con nombres y cifras
 * de ejemplo (ACTIVIDAD, SEMANA, TOP GLOBAL, Conexión/Energía/Cifrado).
 * Solo SEMANA y TOP GLOBAL tienen una fuente de datos real disponible
 * en el proyecto:
 *   - SEMANA: partidas jugadas por día de la semana, calculado a partir
 *     de los timestamps guardados en LeaderboardManager (100% local).
 *   - TOP GLOBAL: ranking por cantidad de partidas jugadas, usando la
 *     vista global_activity_rank de Supabase (ver globalScores.ts).
 * ACTIVIDAD (eventos de otros usuarios en vivo) y el bloque de
 * Conexión/Energía/Cifrado no tienen tabla ni fuente real en el
 * proyecto — se dejan como están, puramente decorativos.
 */

import Leaderboard from './leaderboardManager.js';
import Auth from './authManager.js';
import { fetchGlobalActivityRank } from './globalScores.js';

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']; // getDay(): 0=domingo

/**
 * Cuenta partidas jugadas por día de la semana en los últimos 7 días
 * (incluyendo hoy), a partir de todas las entradas de todos los
 * juegos. Devuelve un array de 7 posiciones alineado a L-M-X-J-V-S-D
 * (igual que el markup estático que reemplaza), con el máximo de
 * partidas en un solo día usado como 100% para las barras.
 */
function computeWeekActivity(): { label: string; count: number; pct: number; isToday: boolean }[] {
  const entries = Leaderboard.getAllEntries();

  // Índice 0 = hace 6 días, índice 6 = hoy — reordenado a L..D más abajo.
  const counts = new Array(7).fill(0) as number[]; // alineado a getDay(): 0=domingo..6=sábado
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  entries.forEach((entry) => {
    const ts = new Date(entry.timestamp);
    if (Number.isNaN(ts.getTime())) return;
    if (ts < sevenDaysAgo) return; // fuera de la ventana de 7 días
    counts[ts.getDay()] += 1;
  });

  const maxCount = Math.max(1, ...counts); // evita división por 0 si no jugó nada
  const todayIndex = now.getDay();

  // Reordenar de domingo-primero (getDay) a lunes-primero (L, M, X, J, V, S, D),
  // que es el orden que ya usa el markup estático que este código reemplaza.
  const mondayFirstOrder = [1, 2, 3, 4, 5, 6, 0];
  return mondayFirstOrder.map((dayIdx) => ({
    label: DAY_LABELS[dayIdx],
    count: counts[dayIdx],
    pct: Math.round((counts[dayIdx] / maxCount) * 100),
    isToday: dayIdx === todayIndex,
  }));
}

function renderWeekPanel(): void {
  const container = document.querySelector<HTMLElement>('.hud-week');
  if (!container) return;

  const days = computeWeekActivity();
  const totalPlayed = days.reduce((sum, d) => sum + d.count, 0);

  if (totalPlayed === 0) {
    // Sin actividad todavía: barras en 0 en vez de ocultar la sección,
    // así se ve la estructura real en vez de dejar el ejemplo hardcodeado.
    container.innerHTML = days
      .map(
        (d) => `
      <div class="hud-week-row${d.isToday ? ' is-today' : ''}"><span>${d.label}</span><div class="hud-bar"><span style="width:0%"></span></div><em>0</em></div>
    `
      )
      .join('');
    return;
  }

  container.innerHTML = days
    .map(
      (d) => `
      <div class="hud-week-row${d.isToday ? ' is-today' : ''}"><span>${d.label}</span><div class="hud-bar"><span style="width:${d.pct}%"></span></div><em>${d.count}</em></div>
    `
    )
    .join('');
}

/**
 * Cuenta las partidas locales (Leaderboard, 100% en el navegador) para
 * usarlas como fallback de "TÚ" en el ranking cuando no hay sesión
 * iniciada o Supabase no responde — el ranking global en sí solo
 * puede incluir usuarios con cuenta, pero el jugador sin cuenta igual
 * puede ver cuánto jugó localmente.
 */
function countLocalGamesPlayed(): number {
  return Leaderboard.getAllEntries().length;
}

async function renderTopGlobalPanel(): Promise<void> {
  const list = document.querySelector<HTMLElement>('.hud-rank-list');
  if (!list) return;

  const rows = await fetchGlobalActivityRank(10);
  const user = Auth.getUser();

  if (rows.length === 0) {
    // Sin datos de red (nadie con cuenta jugó todavía, o falló la
    // consulta): mostrar solo la actividad local del jugador actual.
    const localCount = countLocalGamesPlayed();
    list.innerHTML = `
      <li class="is-you"><span class="hud-rank-pos">—</span><span class="hud-rank-name">TÚ</span><span class="hud-rank-xp">${localCount} partidas</span></li>
    `;
    return;
  }

  const userIndex = user ? rows.findIndex((r) => r.username.toLowerCase() === user.username.toLowerCase()) : -1;

  const topRows = rows.slice(0, 3);
  let html = topRows
    .map(
      (row, i) => `
      <li><span class="hud-rank-pos">#${i + 1}</span><span class="hud-rank-name">${row.username.toUpperCase()}</span><span class="hud-rank-xp">${row.gamesPlayed} partidas</span></li>
    `
    )
    .join('');

  if (userIndex >= 0) {
    // El usuario ya está en el top 3 mostrado arriba — no duplicar la fila.
    if (userIndex >= 3) {
      html += `
        <li class="is-you"><span class="hud-rank-pos">#${userIndex + 1}</span><span class="hud-rank-name">TÚ</span><span class="hud-rank-xp">${rows[userIndex].gamesPlayed} partidas</span></li>
      `;
    } else {
      // Marcar la fila correspondiente como "TÚ" reemplazando el html generado
      // arriba sería más código que simplemente re-generar con el flag.
      html = topRows
        .map((row, i) => {
          const isYou = i === userIndex;
          return `
      <li${isYou ? ' class="is-you"' : ''}><span class="hud-rank-pos">#${i + 1}</span><span class="hud-rank-name">${isYou ? 'TÚ' : row.username.toUpperCase()}</span><span class="hud-rank-xp">${row.gamesPlayed} partidas</span></li>
    `;
        })
        .join('');
    }
  } else {
    // Usuario sin cuenta, o con cuenta pero sin scores subidos todavía:
    // mostrar su actividad local como referencia, sin posición global real.
    const localCount = countLocalGamesPlayed();
    html += `
      <li class="is-you"><span class="hud-rank-pos">—</span><span class="hud-rank-name">TÚ</span><span class="hud-rank-xp">${localCount} partidas</span></li>
    `;
  }

  list.innerHTML = html;
}

function renderAll(): void {
  renderWeekPanel();
  void renderTopGlobalPanel();
}

function init(): void {
  const panel = document.getElementById('hudPanel');
  if (!panel) return;

  // El HUD ya no es puramente decorativo: refleja datos reales.
  panel.removeAttribute('aria-hidden');

  renderAll();

  // Refrescar SEMANA cada vez que se guarda un nuevo score local.
  window.addEventListener('leaderboard:updated', renderWeekPanel);
  // Refrescar TOP GLOBAL al iniciar/cerrar sesión (cambia si "TÚ" aparece
  // en el ranking global, y con qué nombre).
  window.addEventListener('auth:changed', () => void renderTopGlobalPanel());
  // También al terminar una partida, por si subió a un nuevo puesto.
  window.addEventListener('leaderboard:updated', () => void renderTopGlobalPanel());
}

void Auth.ready().then(init);

export {};
