/**
 * lobbyRenderer.ts — Genera dinámicamente las tarjetas de módulo y la
 * barra de filtros de una grilla de juegos a partir de GameRegistry.
 *
 * Reusado por dos vistas: el lobby principal (#home, todo el catálogo,
 * opciones por default) y "Lobby Online" (#online-lobby, solo juegos
 * con soporte multiplayer — ver GameConfig.online y
 * GameRegistry.visibleOnline() — pasando `games`/ids de contenedores
 * distintos a `render()`).
 */

import GameRegistry, { GameConfig } from './core/gameRegistry.js';
import ViewManager from './core/viewManager.js';
import Favorites from './favoritesManager.js';
import Leaderboard from './leaderboardManager.js';
import GameIcons, { UiIcons } from './core/gameIcons.js';
import { categorySlug } from './utils/categorySlug.js';

/** Ícono de respaldo (gamepad monolínea, mismo estilo que el resto del
 *  set) para cualquier gameId que en el futuro no tenga un ícono propio
 *  en GameIcons — hoy los 24 juegos del catálogo están cubiertos. */
const ICON_FALLBACK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<rect x="2.5" y="7.5" width="19" height="10" rx="4"/>' +
  '<path d="M7 10.5v4M5 12.5h4"/>' +
  '<circle cx="15.5" cy="10.5" r=".9" fill="currentColor" stroke="none"/>' +
  '<circle cx="18" cy="13" r=".9" fill="currentColor" stroke="none"/>' +
  '</svg>';

const MAX_DIFFICULTY_DOTS = 5;

/** Techo de "dominio" del ring de progreso: a partir de esta cantidad de
 *  partidas jugadas (con récord guardado) se considera 100%. */
const MASTERY_PLAYS_FOR_FULL_RING = 5;

interface RenderOptions {
  /** id del contenedor de la grilla de tarjetas. Default: 'gameList' (#home). */
  gridId?: string;
  /** id de la barra de filtros. Default: 'filterBar' (#home). */
  filterBarId?: string;
  /** id del bloque "Módulo del Día". Default: 'moduleOfDay' (#home). Pasar
   *  `null` explícito para omitir ese bloque por completo (la vista no lo
   *  tiene en su markup) sin que cuente como "no encontrado". */
  moduleOfDayId?: string | null;
  /** ids de contadores de cabecera a sincronizar con games.length. Default:
   *  los tres contadores de #home (modsCountHeader/Pill/Stats). */
  headerCountIds?: string[];
  /** Lista de juegos a pintar. Default: GameRegistry.visible() (catálogo
   *  completo). Pasar GameRegistry.visibleOnline() para la grilla filtrada
   *  de la vista "Lobby Online". */
  games?: GameConfig[];
  /** Callback opcional que reemplaza el comportamiento por defecto de hacer
   *  click/Enter en una card (ViewManager.showView(gameId)). Recibe el
   *  GameConfig de la card clickeada para que el llamador decida qué hacer
   *  — p.ej. abrir un panel de configuración previo en vez de navegar
   *  directo al juego (usado por la vista "Lobby Online" para los
   *  cooperativos de 4 jugadores: Signal Triangulation y Centro de
   *  Control, que requieren crear/elegir una partida antes de entrar). */
  onCardClick?: (game: GameConfig) => void;
}

const DEFAULT_HEADER_COUNT_IDS = ['modsCountHeader', 'modsCountPill', 'modsCountStats'];

class LobbyRenderer {
  private gridEl: HTMLElement | null = null;
  private filterBarEl: HTMLElement | null = null;
  private moduleOfDayEl: HTMLElement | null = null;
  private headerCountIds: string[] = DEFAULT_HEADER_COUNT_IDS;
  private activeFilter = 'TODOS';
  private lastOptions: RenderOptions = {};
  private onCardClick: ((game: GameConfig) => void) | null = null;

  render(options: RenderOptions = {}): void {
    this.lastOptions = options;
    const {
      gridId = 'gameList',
      filterBarId = 'filterBar',
      moduleOfDayId = 'moduleOfDay',
      headerCountIds = DEFAULT_HEADER_COUNT_IDS,
      games = GameRegistry.visible()
    } = options;

    this.gridEl = document.getElementById(gridId);
    this.filterBarEl = document.getElementById(filterBarId);
    this.moduleOfDayEl = moduleOfDayId ? document.getElementById(moduleOfDayId) : null;
    this.headerCountIds = headerCountIds;
    this.activeFilter = 'TODOS';
    this.onCardClick = options.onCardClick ?? null;

    if (!this.gridEl) {
      console.warn(`[LobbyRenderer] No se encontró #${gridId} en el DOM`);
      return;
    }

    this.renderModuleOfDay(games);
    this.renderFilterBar(games);
    this.renderCards(games);
    this.updateHeaderCounts(games.length);

    // Badges de récord y estado de favoritos, una vez las tarjetas existen
    Leaderboard.renderBadges();
    games.forEach(game => Favorites.refreshCard(game.id));
    this.syncFooterScores(games);

    this.bindThemeChangeOnce();
  }

  private themeListenerBound = false;

  /** Reacciona a cambios de tema (p. ej. cambiar a "neon" u "ocean" desde
   *  Configuración) volviendo a pintar el lobby con los nombres/tags/
   *  iconos correctos. Se registra una sola vez. */
  private bindThemeChangeOnce(): void {
    if (this.themeListenerBound) return;
    this.themeListenerBound = true;
    document.addEventListener('theme-changed', () => this.render(this.lastOptions));
  }

  /**
   * Resuelve name/tag/description/icon de un juego. Centraliza la
   * lectura para que renderCards, renderFilterBar y renderModuleOfDay
   * siempre muestren el mismo set de datos.
   */
  private resolveDisplay(game: GameConfig): { name: string; tag: string; description: string; icon: string } {
    const iconSvg = GameIcons.get(game.id) ?? ICON_FALLBACK_SVG;
    return { name: game.name, tag: game.tag, description: game.description, icon: iconSvg };
  }

  /** Cuenta veces jugadas (nº de récords guardados) para un juego. */
  private playsOf(gameId: string): number {
    return Leaderboard.get(gameId).length;
  }

  /** Timestamp ISO de la última partida jugada (si existe). */
  private lastPlayedOf(gameId: string): string | null {
    return Leaderboard.get(gameId)[0]?.timestamp ?? null;
  }

  /** "hace 2m" / "hace 3h" / "hace 5d" a partir de un ISO timestamp. */
  private formatRelativeTime(iso: string | null): string {
    if (!iso) return 'Sin jugar';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  }

  /** Copia el texto del badge de récord (ya formateado por Leaderboard)
   *  al footer visible de la card, mostrando "—" si aún no hay partidas. */
  private syncFooterScores(games: GameConfig[]): void {
    games.forEach(game => {
      const card = this.gridEl?.querySelector<HTMLElement>(`.game-card[data-game-id="${game.id}"]`);
      if (!card) return;
      const badge = card.querySelector<HTMLElement>('.card-record-badge');
      const scoreEl = card.querySelector<HTMLElement>('.card-footer-score');
      if (!scoreEl) return;
      const raw = badge && !badge.hidden ? badge.textContent?.replace(/^⬡\s*/, '') : null;
      scoreEl.textContent = raw || '—';
    });
  }

  private renderFilterBar(games: GameConfig[]): void {
    if (!this.filterBarEl) return;

    const tags = Array.from(new Set(games.map(g => this.resolveDisplay(g).tag))).sort();

    // Conserva el botón TODOS ya presente en el HTML y añade el resto
    const existingButtons = this.filterBarEl.querySelectorAll('.filter-btn:not([data-filter="TODOS"])');
    existingButtons.forEach(btn => btn.remove());

    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.type = 'button';
      btn.dataset.filter = tag;
      btn.dataset.category = categorySlug(tag);
      btn.textContent = tag;
      this.filterBarEl!.appendChild(btn);
    });

    this.filterBarEl.querySelectorAll<HTMLButtonElement>('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => this.applyFilter(btn.dataset.filter || 'TODOS'));
    });
  }

  private applyFilter(filter: string): void {
    this.activeFilter = filter;

    this.filterBarEl?.querySelectorAll<HTMLButtonElement>('.filter-btn').forEach(btn => {
      btn.classList.toggle('filter-btn--active', (btn.dataset.filter || 'TODOS') === filter);
    });

    this.gridEl?.querySelectorAll<HTMLElement>('.game-card').forEach(card => {
      const matches = filter === 'TODOS' || card.dataset.tag === filter;
      card.style.display = matches ? '' : 'none';
    });
  }

  private renderCards(games: GameConfig[]): void {
    if (!this.gridEl) return;

    this.gridEl.innerHTML = games.map(game => this.buildCardHTML(game)).join('');

    this.gridEl.querySelectorAll<HTMLElement>('.game-card').forEach(card => {
      const gameId = card.dataset.gameId;
      if (!gameId) return;

      const gameConfig = GameRegistry.get(gameId);
      const openCard = () => {
        if (this.onCardClick && gameConfig) {
          this.onCardClick(gameConfig);
        } else {
          ViewManager.showView(gameId);
        }
      };
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;

        // Si el foco está en el botón de favoritos (un <button> real,
        // anidado dentro de la card y focuseable de forma independiente
        // por teclado), Enter/Espacio ahí lo activa de forma nativa: el
        // navegador dispara su propio evento 'click' sobre el botón, que
        // sí hace stopPropagation() (ver el listener de favBtn más
        // abajo). Pero el propio 'keydown' burbujea hasta la card ANTES
        // de que el navegador sintetice ese click, y sin este chequeo el
        // handler de la card lo interpretaba igual como "activar la
        // card completa" — abriendo el juego (openCard()) además de
        // marcar/desmarcar el favorito, cuando el usuario solo quería
        // lo segundo. e.target es el elemento real donde ocurrió la
        // tecla (no se ve afectado por bubbling), así que basta con
        // excluir el botón de favoritos del comportamiento de la card.
        if (e.target instanceof HTMLElement && e.target.closest('.card-favorite-btn')) return;

        e.preventDefault();
        openCard();
      });

      // Precarga el chunk de la lógica pesada del juego (si es lazy) en
      // cuanto el usuario muestra intención de abrirlo — hover con mouse
      // o foco por teclado — así el click/Enter que sigue no espera la
      // descarga de red. Ver GameRegistry.prefetch: no-op silencioso
      // para juegos sin `logic` o ya inicializados/precargados.
      card.addEventListener('mouseenter', () => GameRegistry.prefetch(gameId));
      card.addEventListener('focus', () => GameRegistry.prefetch(gameId));

      const favBtn = card.querySelector<HTMLButtonElement>('.card-favorite-btn');
      favBtn?.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        Favorites.toggle(gameId);
      });
    });

    if (this.activeFilter !== 'TODOS') {
      this.applyFilter(this.activeFilter);
    }
  }

  private buildCardHTML(game: GameConfig): string {
    const isFavorite = Favorites.isFavorite(game.id);
    const dots = Array.from({ length: MAX_DIFFICULTY_DOTS }, (_, i) =>
      `<span class="diff-dot ${i < game.difficulty ? 'diff-dot--filled' : 'diff-dot--empty'}"></span>`
    ).join('');

    const plays = this.playsOf(game.id);
    const ringPct = Math.min(100, Math.round((plays / MASTERY_PLAYS_FOR_FULL_RING) * 100));
    const display = this.resolveDisplay(game);
    const iconName = display.icon;
    const lastPlayed = this.formatRelativeTime(this.lastPlayedOf(game.id));

    return `
      <article
        class="game-card${isFavorite ? ' game-card--favorite' : ''}"
        data-game-id="${game.id}"
        data-tag="${display.tag}"
        data-category="${categorySlug(display.tag)}"
        style="--accent:${game.accent}"
        tabindex="0"
        role="button"
        aria-label="Abrir módulo ${display.name}"
      >
        <span class="card-accent-strip"></span>
        <button
          class="card-favorite-btn"
          type="button"
          aria-pressed="${isFavorite}"
          aria-label="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
        >${isFavorite ? '★' : '☆'}</button>
        <div class="card-hero">
          <div class="card-hero-bg"></div>
          <span class="card-num">${game.num}</span>
          <div class="card-top-row">
            <span class="card-icon-lg">${iconName}</span>
            <div class="card-top-right">
              ${plays > 0 ? `
                <span class="card-streak" title="${plays} partida${plays === 1 ? '' : 's'} jugada${plays === 1 ? '' : 's'}">
                  ${UiIcons.flame}${plays}
                </span>
              ` : ''}
              ${this.buildRingHTML(ringPct)}
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-tag">${display.tag}</span>
            <span class="card-recent-badge">RECIENTE</span>
          </div>
          <h3 class="card-name">${display.name}</h3>
          <p class="card-desc">${display.description}</p>
          <span class="card-record-badge" hidden></span>
          <div class="card-bottom">
            <div class="diff-dots">${dots}</div>
            <span class="card-cta">JUGAR →</span>
          </div>
          <div class="card-footer-row">
            <span class="card-footer-time">${UiIcons.clock}${lastPlayed}</span>
            <span class="card-footer-score">—</span>
          </div>
        </div>
        <span class="card-bottom-glow"></span>
      </article>
    `;
  }

  /** SVG del ring de progreso ("dominio" del módulo, según partidas jugadas). */
  private buildRingHTML(pct: number, size = 34): string {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return `
      <div class="card-progress-ring" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}"></circle>
          <circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${r}"
            stroke-dasharray="${dash} ${circ - dash}"></circle>
        </svg>
        <span class="card-progress-label">${pct}%</span>
      </div>
    `;
  }

  /** Diff-bar segmentada (10 tramos) a partir de una dificultad 0-100. */
  private buildDiffBarHTML(pct: number, segments = 10): string {
    const filled = Math.round((pct / 100) * segments);
    const spans = Array.from({ length: segments }, (_, i) =>
      `<span class="${i < filled ? 'filled' : ''}"></span>`
    ).join('');
    return `<div class="diffbar-seg">${spans}</div>`;
  }

  /**
   * Módulo del Día: destaca el juego jugado más recientemente (según
   * Leaderboard); si todavía no hay ninguna partida registrada, cae al
   * primer módulo visible del registro. 100% datos reales de GameRegistry
   * y Leaderboard — no hay valores inventados de XP/tiempo por módulo,
   * así que usamos la dificultad y el accent reales del juego.
   */
  private renderModuleOfDay(games: GameConfig[]): void {
    if (!this.moduleOfDayEl || games.length === 0) return;

    let featured = games[0];
    let featuredTimestamp = 0;
    games.forEach(game => {
      const last = this.lastPlayedOf(game.id);
      if (!last) return;
      const t = new Date(last).getTime();
      if (t > featuredTimestamp) {
        featuredTimestamp = t;
        featured = game;
      }
    });

    const display = this.resolveDisplay(featured);
    const iconName = display.icon;
    const diffPct = (featured.difficulty / MAX_DIFFICULTY_DOTS) * 100;
    const eyebrowLabel = featuredTimestamp ? 'Continuar entrenamiento' : 'Módulo del Día';

    this.moduleOfDayEl.innerHTML = `
      <div class="module-of-day" data-category="${categorySlug(display.tag)}" style="--accent:${featured.accent}">
        <span class="mod-brackets" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
        <div class="mod-inner">
          <div class="mod-eyebrow">
            <span class="mod-eyebrow-dot"></span>
            <span class="mod-eyebrow-label">${eyebrowLabel}</span>
            <span class="mod-eyebrow-line"></span>
            <span class="mod-eyebrow-priority"><span class="mod-eyebrow-priority-icon">${UiIcons['alert-triangle']}</span>Prioridad Alta</span>
          </div>
          <div class="mod-body">
            <div class="mod-main">
              <div class="mod-head">
                <span class="mod-icon-box">${iconName}</span>
                <div>
                  <h3 class="mod-name">${display.name}</h3>
                  <span class="mod-tag">${display.tag}</span>
                </div>
              </div>
              <p class="mod-desc">${display.description}</p>
              <div class="mod-meta">
                <div>
                  <span class="mod-meta-label">Dificultad</span>
                  <div class="mod-diffbar">${this.buildDiffBarHTML(diffPct)}</div>
                </div>
              </div>
            </div>
            <div class="mod-side">
              <button type="button" class="mod-cta" id="modOfDayCta">
                <span class="mod-cta-icon">${UiIcons.play}</span>
                Iniciar Módulo
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const modOfDayCta = this.moduleOfDayEl.querySelector('#modOfDayCta');
    modOfDayCta?.addEventListener('mouseenter', () => GameRegistry.prefetch(featured.id));
    modOfDayCta?.addEventListener('click', () => {
      ViewManager.showView(featured.id);
    });
  }

  private updateHeaderCounts(total: number): void {
    this.headerCountIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(total);
    });
  }
}

const LobbyRendererInstance = new LobbyRenderer();

export default LobbyRendererInstance;
