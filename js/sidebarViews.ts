/**
 * sidebarViews.ts — Rellena las vistas de Estadísticas, Progreso, Ranking
 * y Manual con datos reales (GameRegistry + Leaderboard + Favorites).
 *
 * Historial: esta clase apuntaba a `#sidebar-content`, un contenedor que
 * nunca existió en index.html — resto de una migración anterior en la que
 * las 4 vistas compartían una sola sección con pestañas. Desde esa
 * migración, cada vista vive en su propia `<section>` con su propio
 * contenedor (`#statsGrid`, `#progressList`, `#rankingList`, `#manualList`),
 * inyectado de forma lazy por viewManager.ts a partir de js/views/*.ts.
 * `updateAll()` nunca se llamaba desde ningún otro módulo, así que todo el
 * archivo era código muerto: css/styles.css ya tenía el diseño completo
 * (.stat-card, .progress-item, .ranking-item, .manual-item) para estos
 * contenedores, pero nada los rellenaba.
 *
 * Ahora escuchamos el evento `view-shown` que viewManager.ts ya dispara
 * cada vez que se muestra una vista (ver core/viewManager.ts) y, si es una
 * de las vistas que nos interesan, rellenamos su contenedor real con datos
 * actuales. Mismo patrón de delegación que configPanel.ts: no asumimos que
 * el contenedor ya existe en el DOM al cargar este módulo, porque las
 * vistas son lazy.
 */

import GameRegistry, { type GameConfig } from './core/gameRegistry.js';
import Favorites from './favoritesManager.js';
import Leaderboard, { getEntryTotal } from './leaderboardManager.js';
import ViewManager from './core/viewManager.js';
import { fetchGlobalTop } from './globalScores.js';

function renderStatistics(): void {
  const grid = document.getElementById('statsGrid');
  const byCategory = document.getElementById('statsByCategory');
  if (!grid) return;

  const games = GameRegistry.visible();
  const totalGames = games.length;
  const favoritesCount = Favorites.count();
  const gamesWithRecord = games.filter(game => Leaderboard.get(game.id).length > 0).length;

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-icon">🎮</div>
      <div class="stat-card-info">
        <span class="stat-card-value">${totalGames}</span>
        <span class="stat-card-label">MÓDULOS TOTALES</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">⭐</div>
      <div class="stat-card-info">
        <span class="stat-card-value">${favoritesCount}</span>
        <span class="stat-card-label">FAVORITOS</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card-icon">🏆</div>
      <div class="stat-card-info">
        <span class="stat-card-value">${gamesWithRecord}</span>
        <span class="stat-card-label">CON RÉCORD</span>
      </div>
    </div>
  `;

  if (!byCategory) return;

  if (totalGames === 0) {
    byCategory.innerHTML = '';
    return;
  }

  const byDifficulty = new Map<number, number>();
  games.forEach(game => {
    byDifficulty.set(game.difficulty, (byDifficulty.get(game.difficulty) ?? 0) + 1);
  });

  byCategory.innerHTML = Array.from(byDifficulty.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([difficulty, count]) => {
      const pct = Math.round((count / totalGames) * 100);
      return `
        <div class="category-card">
          <div class="category-head">
            <span class="category-tag">DIFICULTAD ${difficulty}</span>
            <span class="category-count">${count} módulo${count === 1 ? '' : 's'}</span>
          </div>
          <div class="category-bar"><span style="width:${pct}%"></span></div>
          <span class="category-pct">${pct}%</span>
        </div>
      `;
    })
    .join('');
}

function renderProgress(): void {
  const list = document.getElementById('progressList');
  if (!list) return;

  const games = GameRegistry.visible();
  if (games.length === 0) {
    list.innerHTML = '<p class="progress-empty">No hay módulos disponibles todavía.</p>';
    return;
  }

  list.innerHTML = games
    .map(game => {
      const best = Leaderboard.get(game.id)[0];
      const done = !!best;
      const total = done ? getEntryTotal(best) : null;
      const record = done ? (total !== null ? `${best.value}/${total}` : best.value.toString()) : 'Sin jugar';
      const date = done ? new Date(best.timestamp).toLocaleDateString() : '';
      return `
        <div class="progress-item${done ? ' progress-item--done' : ''}">
          <div class="progress-item-icon">${game.icon}</div>
          <div class="progress-item-body">
            <div class="progress-item-top">
              <span class="progress-item-name">${game.name}</span>
              <span class="progress-item-tag">${game.tag}</span>
            </div>
            <div class="progress-item-bottom">
              <span class="progress-item-record">${record}</span>
              <span class="progress-item-date">${date}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderRanking(): void {
  const list = document.getElementById('rankingList');
  if (!list) return;

  const ranked = GameRegistry.visible()
    .map(game => ({ game, best: Leaderboard.get(game.id)[0] }))
    .filter((entry): entry is { game: GameConfig; best: NonNullable<typeof entry.best> } => !!entry.best)
    .sort((a, b) => b.best.value - a.best.value);

  if (ranked.length === 0) {
    list.innerHTML = '<p class="ranking-empty">Todavía no hay récords guardados. ¡Juega para aparecer aquí!</p>';
    return;
  }

  list.innerHTML = ranked
    .map(({ game, best }, index) => {
      const total = getEntryTotal(best);
      const value = total !== null ? `${best.value}/${total}` : String(best.value);
      return `
      <div class="ranking-item${index === 0 ? ' ranking-item--top' : ''}">
        <span class="ranking-rank">#${index + 1}</span>
        <div class="ranking-icon">${game.icon}</div>
        <div class="ranking-info">
          <span class="ranking-name">${game.name}</span>
          <span class="ranking-tag">${game.tag}</span>
        </div>
        <span class="ranking-value">${value}</span>
      </div>
    `;
    })
    .join('');
}

function renderManual(): void {
  const list = document.getElementById('manualList');
  if (!list) return;

  const games = GameRegistry.visible();
  if (games.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = games
    .map(game => `
      <div class="manual-item">
        <div class="manual-item-icon">${game.icon}</div>
        <div class="manual-item-body">
          <div class="manual-item-head">
            <span class="manual-item-name">${game.name}</span>
            <span class="manual-item-tag">${game.tag}</span>
          </div>
          <span class="manual-item-num">MÓDULO ${game.num}</span>
          <p class="manual-item-desc">${game.description}</p>
          <div class="manual-item-foot">
            <button type="button" class="manual-item-launch" data-manual-launch="${game.id}">JUGAR →</button>
          </div>
        </div>
      </div>
    `)
    .join('');

  list.querySelectorAll<HTMLButtonElement>('[data-manual-launch]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.manualLaunch;
      if (id) ViewManager.showView(id);
    });
  });
}

const RENDERERS: Record<string, () => void> = {
  estadisticas: renderStatistics,
  progreso: renderProgress,
  ranking: renderRanking,
  manual: renderManual,
};

let globalScoresListenersBound = false;

async function renderGlobalScoresFor(gameId: string): Promise<void> {
  const list = document.querySelector<HTMLElement>('[data-ui="globalScoresList"]');
  if (!list) return;

  list.innerHTML = '<p class="ranking-empty">Cargando…</p>';

  const rows = await fetchGlobalTop(gameId, 10);

  if (rows.length === 0) {
    list.innerHTML = '<p class="ranking-empty">Nadie registró un puntaje en este módulo todavía.</p>';
    return;
  }

  list.innerHTML = rows
    .map((row, index) => {
      const value = row.total !== null ? `${row.value}/${row.total}` : String(row.value);
      return `
      <div class="ranking-item${index === 0 ? ' ranking-item--top' : ''}">
        <span class="ranking-rank">#${index + 1}</span>
        <div class="ranking-info">
          <span class="ranking-name">${row.username}</span>
        </div>
        <span class="ranking-value">${value}</span>
      </div>
    `;
    })
    .join('');
}

/**
 * Rellena el selector de módulo y dispara la primera consulta al
 * scoreboard global. Separado de renderRanking() (que es síncrono y
 * puramente local) porque este sí depende de red — un fallo acá no
 * debe afectar al ranking local, que ya se pintó igual.
 */
function renderGlobalScoreboard(): void {
  const select = document.querySelector<HTMLSelectElement>('[data-ui="globalScoresGameSelect"]');
  if (!select) return;

  const games = GameRegistry.visible();
  if (select.options.length === 0) {
    select.innerHTML = games.map((game) => `<option value="${game.id}">${game.name}</option>`).join('');
  }

  if (!globalScoresListenersBound) {
    select.addEventListener('change', () => {
      void renderGlobalScoresFor(select.value);
    });
    globalScoresListenersBound = true;
  }

  if (select.value) {
    void renderGlobalScoresFor(select.value);
  }
}

function handleViewShown(event: Event): void {
  const id = (event as CustomEvent<{ id: string }>).detail?.id;
  if (!id) return;
  const renderer = RENDERERS[id];
  if (renderer) renderer();
  if (id === 'ranking') renderGlobalScoreboard();
}

document.addEventListener('view-shown', handleViewShown);

export default {
  renderStatistics,
  renderProgress,
  renderRanking,
  renderManual,
};
