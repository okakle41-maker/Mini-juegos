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
import Leaderboard, { getEntryTotal, type LeaderboardEntry } from './leaderboardManager.js';
import ViewManager from './core/viewManager.js';
import { fetchGlobalTop } from './globalScores.js';
import { categorySlug } from './utils/categorySlug.js';
import GameIcons from './core/gameIcons.js';
import { escapeHtml } from './security.js';

function renderStatistics(): void {
  const grid = document.getElementById('statsGrid');
  const byCategory = document.getElementById('statsByCategory');
  if (!grid) return;

  const games = GameRegistry.visible();
  const totalGames = games.length;
  const favoritesCount = Favorites.count();
  const gamesWithRecord = games.filter(game => Leaderboard.get(game.id).length > 0).length;

  // Nota: estas cards viven dentro de #statsGrid/.stats-grid (vista
  // Estadísticas), un layout distinto al de .stat-card-row del header
  // del lobby (ver _pages-stats-config.css vs redesign-extras.css) — no
  // llevan el stagger fade-in de esas, que está scopeado a
  // `.stat-card-row .stat-card` a propósito para no afectar esta vista.
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
    renderSelfCompare([]);
    return;
  }

  list.innerHTML = games
    .map(game => {
      const best = Leaderboard.getBest(game.id);
      const done = !!best;
      const total = done ? getEntryTotal(best) : null;
      const record = done ? (total !== null ? `${best.value}/${total}` : best.value.toString()) : 'Sin jugar';
      const date = done ? new Date(best.timestamp).toLocaleDateString() : '';
      const icon = GameIcons.get(game.id) ?? game.icon;
      return `
        <div class="progress-item${done ? ' progress-item--done' : ''}" data-category="${categorySlug(game.tag)}">
          <div class="progress-item-icon">${icon}</div>
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

  renderSelfCompare(games);
}

let selfCompareBound = false;

function formatScore(entry: LeaderboardEntry): string {
  const total = getEntryTotal(entry);
  return total !== null ? `${entry.value}/${total}` : String(entry.value);
}

function buildSparklineSVG(history: LeaderboardEntry[], catSlug: string): string {
  const w = 320;
  const h = 88;
  const padX = 8;
  const padY = 12;
  const values = history.map(e => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = history.map((entry, i) => {
    const x = history.length === 1
      ? w / 2
      : padX + (i / (history.length - 1)) * (w - padX * 2);
    const y = h - padY - ((entry.value - min) / range) * (h - padY * 2);
    return { x, y };
  });

  const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = points.length > 1
    ? `M ${points[0].x.toFixed(1)} ${(h - padY).toFixed(1)} L ${points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} L ${points[points.length - 1].x.toFixed(1)} ${(h - padY).toFixed(1)} Z`
    : '';

  const dots = points.map((p, i) => {
    const isLast = i === points.length - 1;
    return `<circle class="self-compare-dot${isLast ? ' self-compare-dot--last' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${isLast ? 4 : 3}" />`;
  }).join('');

  return `
    <svg class="self-compare-svg" data-category="${catSlug}" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">
      ${areaPath ? `<path class="self-compare-area" d="${areaPath}" />` : ''}
      <polyline class="self-compare-line" points="${polyline}" fill="none" />
      ${dots}
    </svg>
  `;
}

function renderSelfComparePanel(gameId: string): void {
  const statsEl = document.getElementById('selfCompareStats');
  const chartEl = document.getElementById('selfCompareChart');
  if (!statsEl || !chartEl) return;

  const game = GameRegistry.get(gameId);
  const history = Leaderboard.getHistory(gameId);
  const best = Leaderboard.getBest(gameId);
  const cat = game ? categorySlug(game.tag) : '';

  if (history.length === 0 || !best) {
    statsEl.innerHTML = `
      <div class="self-compare-stat">
        <span class="self-compare-stat-label">Estado</span>
        <span class="self-compare-stat-value">Sin partidas</span>
      </div>
    `;
    chartEl.innerHTML = '<p class="self-compare-empty">Jugá este módulo para ver tu evolución.</p>';
    chartEl.removeAttribute('data-category');
    return;
  }

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  let trendLabel = '—';
  let trendClass = '';
  if (previous) {
    const delta = latest.value - previous.value;
    if (delta > 0) {
      trendLabel = `↑ +${delta}`;
      trendClass = 'self-compare-trend--up';
    } else if (delta < 0) {
      trendLabel = `↓ ${delta}`;
      trendClass = 'self-compare-trend--down';
    } else {
      trendLabel = '= igual';
    }
  }

  const first = history[0];
  const vsFirst = latest.value - first.value;
  const vsFirstLabel = history.length > 1
    ? (vsFirst > 0 ? `+${vsFirst} vs 1ª` : vsFirst < 0 ? `${vsFirst} vs 1ª` : '= vs 1ª')
    : '1 partida';

  statsEl.innerHTML = `
    <div class="self-compare-stat">
      <span class="self-compare-stat-label">Mejor</span>
      <span class="self-compare-stat-value">${formatScore(best)}</span>
    </div>
    <div class="self-compare-stat">
      <span class="self-compare-stat-label">Última</span>
      <span class="self-compare-stat-value">${formatScore(latest)}</span>
    </div>
    <div class="self-compare-stat">
      <span class="self-compare-stat-label">Tendencia</span>
      <span class="self-compare-stat-value ${trendClass}">${trendLabel}</span>
    </div>
    <div class="self-compare-stat">
      <span class="self-compare-stat-label">Partidas</span>
      <span class="self-compare-stat-value">${history.length} · ${vsFirstLabel}</span>
    </div>
  `;

  chartEl.setAttribute('data-category', cat);
  chartEl.innerHTML = buildSparklineSVG(history, cat);
  chartEl.setAttribute(
    'aria-label',
    `Evolución de ${game?.name ?? gameId}: ${history.length} partidas, mejor ${best.value}, última ${latest.value}`
  );
}

function renderSelfCompare(games: GameConfig[]): void {
  const select = document.getElementById('selfCompareSelect') as HTMLSelectElement | null;
  if (!select) return;

  const withHistory = games.filter(g => Leaderboard.get(g.id).length > 0);
  const optionsSource = withHistory.length > 0 ? withHistory : games;

  const previous = select.value;
  select.innerHTML = optionsSource
    .map(g => `<option value="${g.id}">${g.name}</option>`)
    .join('');

  if (previous && optionsSource.some(g => g.id === previous)) {
    select.value = previous;
  } else if (withHistory[0]) {
    select.value = withHistory[0].id;
  }

  if (!selfCompareBound) {
    select.addEventListener('change', () => {
      if (select.value) renderSelfComparePanel(select.value);
    });
    selfCompareBound = true;
  }

  if (select.value) renderSelfComparePanel(select.value);
}

function renderRanking(): void {
  const list = document.getElementById('rankingList');
  if (!list) return;

  const ranked = GameRegistry.visible()
    .map(game => ({ game, best: Leaderboard.getBest(game.id) }))
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
          <span class="ranking-name">${escapeHtml(row.username)}</span>
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
