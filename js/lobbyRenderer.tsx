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
import GameIcons from './core/gameIcons.js';
import { escapeHtml } from './security.js';
import { render } from 'preact';
import { GameCard } from './components/GameCard.js';
import { FilterBar } from './components/FilterBar.js';
import { ModuleOfDay } from './components/ModuleOfDay.js';

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

/** Throttle de tiempo para el hover de cards, reescrito de cero (Aug
 *  2026) reemplazando el sistema anterior de contador/cupo
 *  (MAX_CONCURRENT_HOVER_ANIMATIONS + activeHoverAnimations +
 *  transitionend). Ese diseño necesitaba mantener sincronizados tres
 *  cosas por separado (el nombre de la propiedad CSS que se
 *  transicionaba, el momento exacto en que JS liberaba el cupo, y el
 *  comportamiento de perf-mode) — y en la práctica, cada vez que uno
 *  de los tres cambiaba sin que los otros dos se actualizaran en el
 *  mismo commit, aparecía un bug nuevo (cupo que nunca se liberaba,
 *  will-change que se promovía sin necesidad, etc.).
 *
 *  Acá no hay nada que sincronizar: `lastHoverAnimationStart` es
 *  simplemente el timestamp (performance.now()) de la última vez que
 *  alguna card arrancó su transición de hover, compartido entre todas
 *  las instancias de LobbyRenderer igual que antes. Si una card nueva
 *  entra en hover antes de que pase HOVER_THROTTLE_MS desde esa
 *  marca, salta directo al estado final sin transición
 *  (`.game-card--hover-instant`, ver styles.css). No hay contador que
 *  incrementar/decrementar, no hay evento de fin de transición que
 *  escuchar, no hay cupo que se pueda quedar "trabado" — es una
 *  lectura de reloj en cada hover, nada más. */
const HOVER_THROTTLE_MS = 120;
let lastHoverAnimationStart = 0;

/** El spotlight que sigue el cursor (ver .card-spotlight en
 *  _lobby-cards-hover.css) solo tiene sentido con mouse real: en
 *  touch no hay "posición del cursor" persistente que seguir, y el
 *  propio CSS ya lo oculta vía `@media (hover: hover)`. Evaluar esta
 *  media query una sola vez al construir el renderer (no por-card)
 *  evita registrar cientos de listeners de 'mousemove' que nunca
 *  harían nada útil en un dispositivo táctil.
 *  `window.matchMedia` no existe en jsdom (entorno de test) salvo que
 *  el test lo mockee explícitamente — de ahí el guard `typeof`: sin
 *  él, cualquier test que importe este módulo rompería solo por tener
 *  este spotlight, sin relación con lo que ese test intenta cubrir. */
const spotlightMediaQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover) and (pointer: fine)')
    : { matches: false };

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
   *  GameConfig de la card clickeada y el elemento DOM que originó el
   *  click (el botón .card-open-btn de la card en la grilla, o el CTA
   *  #modOfDayCta si viene de "Módulo del Día") para que el llamador
   *  decida qué hacer — p.ej. abrir un panel de configuración previo
   *  en vez de navegar directo al juego (usado por "Lobby Online" para
   *  los cooperativos de 4 jugadores) o anclar un popover a ese
   *  elemento (ver gameGroupMenuController.ts). */
  onCardClick?: (game: GameConfig, anchorEl: HTMLElement) => void;
}

const DEFAULT_HEADER_COUNT_IDS = ['modsCountHeader', 'modsCountPill', 'modsCountStats'];

class LobbyRenderer {
  private gridEl: HTMLElement | null = null;
  private filterBarEl: HTMLElement | null = null;
  private moduleOfDayEl: HTMLElement | null = null;
  private headerCountIds: string[] = DEFAULT_HEADER_COUNT_IDS;
  private activeFilter = 'TODOS';
  // Búsqueda del sidebar (lobbySidebarUI.ts). Antes vivía enteramente
  // en ese archivo, escribiendo `card.style.display` sin saber nada
  // del filtro de categoría activo — así que filtrar por categoría y
  // luego buscar hacía que la búsqueda "pisara" el filtro (mostraba
  // resultados de categorías ya descartadas). Centralizarlo acá, junto
  // a activeFilter, permite que applyVisibility() sea la única fuente
  // de verdad: una card se muestra solo si matchea AMBOS criterios.
  private searchQuery = '';
  private lastOptions: RenderOptions = {};
  private onCardClick: ((game: GameConfig, anchorEl: HTMLElement) => void) | null = null;

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

    // Badges de récord y estado de favoritos, una vez las tarjetas existen.
    Leaderboard.renderBadges();
    //
    // Nota sobre Favorites.refreshCard() conviviendo con Preact: este
    // método toca el DOM directamente (classList.toggle, setAttribute,
    // textContent) por fuera de Preact — es un patrón que en general
    // hay que evitar mezclar con un framework declarativo, porque un
    // re-render posterior del mismo componente puede pisar ese cambio
    // manual si el componente no sabe de él. Acá es seguro porque
    // renderCards() SIEMPRE vacía el grid (`this.gridEl.innerHTML =
    // ''`) y vuelve a montar cada GameCard desde cero leyendo
    // `Favorites.isFavorite()` en el momento del render (ver
    // buildCardProps) — no hay reconciliación parcial de Preact sobre
    // cards existentes entre un `refreshCard` y el próximo `render()`,
    // así que no hay ventana en la que el estado manual y el estado de
    // React/Preact puedan desincronizarse. Si en una fase futura
    // renderCards() dejara de recrear todo el grid (por ejemplo, para
    // aprovechar el diffing de Preact y evitar remontar cards que no
    // cambiaron), este `refreshCard` tendría que migrarse a props en
    // vez de manipulación directa del DOM.
    games.forEach(game => Favorites.refreshCard(game.id));
    this.syncFooterScores(games);

    this.bindThemeChangeOnce();
  }

  private themeListenerBound = false;
  // Referencia nombrada (no arrow inline) para poder removerla en reset().
  // Antes el listener de 'theme-changed' quedaba atado al `document` real
  // para siempre una vez registrado, sobreviviendo incluso a
  // vi.resetModules() entre tests — un test que importaba lobbyRenderer,
  // llamaba render() y terminaba, dejaba este listener vivo; el próximo
  // test del mismo archivo que disparara 'theme-changed' por cualquier
  // motivo (p.ej. importar un módulo que llama BackgroundManager.setTheme)
  // hacía que ESTA instancia repintara sobre el DOM del test siguiente,
  // usando el gridId/games de this.lastOptions ya obsoleto — vaciando
  // silenciosamente un #gameList armado a mano por otro test. Bug real
  // encontrado en test/lobbySidebarUI.test.ts (ver reset() más abajo).
  private readonly onThemeChanged = (): void => this.render(this.lastOptions);

  /** Reacciona a cambios de tema (p. ej. cambiar a "neon" u "ocean" desde
   *  Configuración) volviendo a pintar el lobby con los nombres/tags/
   *  iconos correctos. Se registra una sola vez. */
  private bindThemeChangeOnce(): void {
    if (this.themeListenerBound) return;
    this.themeListenerBound = true;
    document.addEventListener('theme-changed', this.onThemeChanged);
  }

  /**
   * Reinicia el estado de esta instancia (singleton) para tests.
   *
   * Igual que GameRegistry.reset() (ver core/gameRegistry.ts): sin esto,
   * el listener de 'theme-changed' registrado por bindThemeChangeOnce()
   * sobrevive entre tests dentro del mismo proceso de Vitest, porque está
   * atado al `document` real, no a un módulo que vi.resetModules() pueda
   * limpiar. No se llama desde ningún flujo de producción.
   */
  reset(): void {
    document.removeEventListener('theme-changed', this.onThemeChanged);
    this.themeListenerBound = false;
    this.gridEl = null;
    this.filterBarEl = null;
    this.moduleOfDayEl = null;
    this.headerCountIds = DEFAULT_HEADER_COUNT_IDS;
    this.activeFilter = 'TODOS';
    this.searchQuery = '';
    this.lastOptions = {};
    this.onCardClick = null;
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

  /** Tags de la última tanda de juegos renderizada, retenidos para
   *  poder re-pintar FilterBar (resaltar el botón activo) desde
   *  applyFilter() sin tener que recalcular la lista de tags cada vez
   *  que el usuario hace click en un filtro. */
  private filterTags: string[] = [];

  private renderFilterBar(games: GameConfig[]): void {
    if (!this.filterBarEl) return;
    this.filterTags = Array.from(new Set(games.map(g => this.resolveDisplay(g).tag))).sort();
    this.paintFilterBar();
  }

  private paintFilterBar(): void {
    if (!this.filterBarEl) return;
    render(
      <FilterBar
        tags={this.filterTags}
        activeFilter={this.activeFilter}
        onSelect={filter => this.applyFilter(filter)}
      />,
      this.filterBarEl
    );
  }

  private applyFilter(filter: string): void {
    this.activeFilter = filter;
    this.paintFilterBar();
    this.applyVisibility();
  }

  /**
   * Única función que decide display de cada .game-card, combinando
   * el filtro de categoría activo Y la query de búsqueda: una card se
   * muestra solo si matchea AMBOS criterios a la vez (antes eran dos
   * funciones separadas —applyFilter y performSearch, esta última en
   * lobbySidebarUI.ts— escribiendo `display` cada una por su cuenta,
   * y la que corría después pisaba a la otra sin tenerla en cuenta).
   *
   * La búsqueda matchea contra nombre, tag/categoría y descripción —
   * igual que el performSearch original en lobbySidebarUI.ts. La
   * animación de entrada (fade + translateY) se dispara para
   * cualquier card que pase de oculta a visible, sea por escribir en
   * el buscador o por hacer click en un filtro de categoría (Todos,
   * Análisis, Cifrado, etc.) — mismo trigger (wasHidden), sin
   * distinguir el origen del cambio.
   */
  private applyVisibility(): void {
    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.game-card') ?? [];
    let visibleCount = 0;

    cards.forEach(card => {
      // Cada `.game-card` vive dentro de un `host` <div> (ver
      // renderCards) que es el grid item real de `.game-grid`. Ocultar
      // solo `.game-card` dejaba ese wrapper vacío pero VISIBLE como
      // celda del grid — el navegador seguía reservándole espacio, así
      // que las cards restantes no se compactaban hacia las primeras
      // posiciones (quedaban en sus huecos originales dispersos). El
      // toggle de display tiene que aplicarse al wrapper, que es el
      // elemento que el grid realmente layoutea.
      const host = card.parentElement ?? card;

      const matchesFilter = this.activeFilter === 'TODOS' || card.dataset.tag === this.activeFilter;

      const matchesSearch =
        this.searchQuery === '' ||
        [
          card.querySelector('.card-name')?.textContent,
          card.querySelector('.card-tag')?.textContent,
          card.querySelector('.card-desc')?.textContent,
        ]
          .join(' ')
          .toLowerCase()
          .includes(this.searchQuery);

      const visible = matchesFilter && matchesSearch;

      if (visible) {
        const wasHidden = host.style.display === 'none';
        host.style.display = '';

        if (wasHidden) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          requestAnimationFrame(() => {
            card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          });
        }

        visibleCount++;
      } else {
        host.style.display = 'none';
      }
    });

    this.updateNoResultsMessage(visibleCount, cards.length);
  }

  /** Punto de entrada público para lobbySidebarUI.ts. Antes, el
   *  buscador manipulaba `card.style.display` directamente sobre el
   *  DOM del grid (ver performSearch en lobbySidebarUI.ts), sin saber
   *  nada del filtro de categoría activo. */
  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.applyVisibility();
  }

  /** Mensaje "no se encontraron resultados", antes vivía en
   *  lobbySidebarUI.ts como updateNoResultsMessage(). Vive acá ahora
   *  porque solo tiene sentido calcularlo junto al recuento real de
   *  cards visibles que applyVisibility() ya produce. Distingue tres
   *  casos: sin resultados por búsqueda, sin resultados por filtro de
   *  categoría (sin búsqueda activa), y "todo visible" (oculta el
   *  mensaje). */
  private updateNoResultsMessage(visibleCount: number, totalCount: number): void {
    if (!this.gridEl) return;
    let msgEl = this.gridEl.querySelector<HTMLElement>('.no-results-message');

    if (visibleCount === 0 && totalCount > 0) {
      if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'no-results-message';
        // `aria-live="polite"` + `role="status"`: sin esto, un usuario
        // de lector de pantalla que filtra o busca y no obtiene
        // resultados no recibe ningún anuncio — el mensaje aparece
        // visualmente pero el DOM no notifica el cambio de forma
        // pasiva (a diferencia de un cambio de foco, insertar un nodo
        // nuevo no dispara nada por sí solo). "polite" espera a que
        // termine cualquier anuncio en curso antes de leer este, en
        // vez de interrumpir de inmediato como haría "assertive".
        msgEl.setAttribute('role', 'status');
        msgEl.setAttribute('aria-live', 'polite');
        this.gridEl.appendChild(msgEl);
      }
      const text = this.searchQuery
        ? `No se encontraron resultados para "${escapeHtml(this.searchQuery)}"`
        : 'No hay módulos en esta categoría';
      const hint = this.searchQuery ? '<div class="no-results-hint">Intenta con otro término de búsqueda</div>' : '';
      msgEl.innerHTML = `
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">${text}</div>
        ${hint}
      `;
      msgEl.style.display = 'flex';
    } else if (msgEl) {
      msgEl.style.display = 'none';
    }
  }

  private renderCards(games: GameConfig[]): void {
    if (!this.gridEl) return;

    // Cada card se monta en su propio nodo contenedor dentro del
    // grid (en vez de un innerHTML con el HTML de las 20+ cards
    // concatenado en un solo string, como hacía buildCardHTML antes).
    // El grid en sí (`.game-grid`, CSS Grid con cada `.game-card`
    // como celda directa) no le importa que exista un wrapper extra:
    // ese wrapper no tiene estilos propios y el layout sigue viendo
    // los mismos elementos `.game-card` como celdas — se verificó al
    // migrar la card a Preact que nada del CSS depende del padre
    // inmediato exacto de `.game-card`.
    this.gridEl.innerHTML = '';
    games.forEach(game => {
      const host = document.createElement('div');
      this.gridEl!.appendChild(host);
      render(<GameCard {...this.buildCardProps(game)} />, host);
    });

    // Entrada escalonada (stagger): `.game-card` ya trae `animation:
    // cardAppear` con `animation-delay: var(--stagger-delay, 0s)`
    // definido en _lobby-cards.css (mismo mecanismo que usa el submenú
    // de Skill Check, ver skillchecks.ts) — solo faltaba alimentar la
    // variable acá, así que se reusa ese sistema existente en vez de
    // crear uno nuevo en paralelo. Sin esto, cardAppear igual corría en
    // cada card pero todas con el mismo delay (0s), por eso entraban
    // todas juntas pese a que la animación de fade ya estaba definida.
    //
    // Antes esto vivía en su propio `querySelectorAll('.game-card').forEach()`,
    // separado del loop de wiring de eventos que sigue — ambos recorren
    // exactamente el mismo node list recién pintado, así que se
    // fusionaron en un solo recorrido: mismo trabajo total, una sola
    // consulta al DOM en vez de dos.
    this.gridEl.querySelectorAll<HTMLElement>('.game-card').forEach((card, i) => {
      card.style.setProperty('--stagger-delay', `${i * 0.045}s`);

      const gameId = card.dataset.gameId;
      if (!gameId) return;

      const openBtn = card.querySelector<HTMLButtonElement>('.card-open-btn');
      const gameConfig = GameRegistry.get(gameId);
      const openCard = () => {
        if (this.onCardClick && gameConfig && openBtn) {
          this.onCardClick(gameConfig, openBtn);
        } else {
          ViewManager.showView(gameId);
        }
      };
      // card-open-btn ahora es un <button> real: el navegador ya
      // dispara 'click' de forma nativa tanto con mouse como con
      // Enter/Espacio por teclado, así que no hace falta el manejo
      // manual de keydown que existía cuando la card completa
      // simulaba ser un botón vía role="button".
      openBtn?.addEventListener('click', openCard);

      // Precarga el chunk de la lógica pesada del juego (si es lazy) en
      // cuanto el usuario muestra intención de abrirlo — hover con mouse
      // o foco por teclado — así el click/Enter que sigue no espera la
      // descarga de red. Ver GameRegistry.prefetch: no-op silencioso
      // para juegos sin `logic` o ya inicializados/precargados.
      card.addEventListener('mouseenter', () => GameRegistry.prefetch(gameId));
      openBtn?.addEventListener('focus', () => GameRegistry.prefetch(gameId));

      // Hover instantáneo vs. animado: throttle por tiempo, no por
      // contador. En vez de llevar la cuenta de "cuántas cards están
      // animando ahora mismo" (el sistema anterior, con un contador
      // global + liberar el cupo en transitionend/mouseleave/blur —
      // fuente de varios bugs reales: el nombre de propiedad que
      // escuchaba `transitionend` quedaba desincronizado del CSS más
      // de una vez, y en `perf-mode` esa transición ni corría, así
      // que el cupo nunca se liberaba), acá solo miramos el reloj:
      // si la última vez que UNA card arrancó su animación de hover
      // fue hace menos de HOVER_THROTTLE_MS, esta card salta directo
      // al estado final sin transición. No hay nada que "liberar"
      // después — es solo una lectura de timestamp en cada hover, así
      // que no hay estado que pueda quedar inconsistente.
      const addHoverClass = () => {
        card.classList.remove('game-card--hover-instant');

        const now = performance.now();
        if (now - lastHoverAnimationStart < HOVER_THROTTLE_MS) {
          card.classList.add('game-card--hover-instant');
          return;
        }

        lastHoverAnimationStart = now;
      };

      const removeHoverClass = () => {
        card.classList.remove('game-card--hover-instant');
      };

      card.addEventListener('mouseenter', addHoverClass);
      card.addEventListener('mouseleave', removeHoverClass);
      openBtn?.addEventListener('focus', addHoverClass);
      openBtn?.addEventListener('blur', removeHoverClass);

      // Spotlight que sigue el cursor (--mx/--my leídos por
      // .card-spotlight en _lobby-cards-hover.css). Throttle por rAF:
      // 'mousemove' puede disparar bastante más rápido que 60fps, así
      // que sin este guard estaríamos escribiendo la custom property
      // (y por lo tanto pintando el radial-gradient) muchas más veces
      // por segundo de las que el monitor puede mostrar — trabajo
      // puro desperdiciado. `spotlightRaf` es por-card (closure), no
      // global: cada card puede tener su propio frame pendiente sin
      // pisar el de otra si el usuario mueve el mouse rápido entre
      // varias.
      if (spotlightMediaQuery.matches) {
        let spotlightRaf = 0;
        card.addEventListener('mousemove', (e: MouseEvent) => {
          if (spotlightRaf) return;
          spotlightRaf = requestAnimationFrame(() => {
            spotlightRaf = 0;
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mx', `${x}%`);
            card.style.setProperty('--my', `${y}%`);
          });
        });
      }

      const favBtn = card.querySelector<HTMLButtonElement>('.card-favorite-btn');
      favBtn?.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        Favorites.toggle(gameId);
      });
    });

    // Reaplica filtro + búsqueda tras remontar todas las cards (por
    // ejemplo, un render() disparado por cambio de tema). Antes esto
    // solo corría si activeFilter !== 'TODOS', y solo reaplicaba el
    // filtro — una búsqueda activa se perdía en cada remontaje. Ahora
    // applyVisibility() siempre corre y respeta ambos criterios,
    // aunque el filtro esté en 'TODOS' pero haya una query activa.
    this.applyVisibility();
  }

  /** Arma las props que GameCard necesita a partir de un GameConfig,
   *  centralizando la misma lógica que antes vivía inline en
   *  buildCardHTML (favoritos, partidas jugadas, % del ring, última
   *  vez jugado). */
  private buildCardProps(game: GameConfig) {
    const plays = this.playsOf(game.id);
    const ringPct = Math.min(100, Math.round((plays / MASTERY_PLAYS_FOR_FULL_RING) * 100));
    return {
      game,
      display: this.resolveDisplay(game),
      isFavorite: Favorites.isFavorite(game.id),
      plays,
      ringPct,
      lastPlayed: this.formatRelativeTime(this.lastPlayedOf(game.id)),
    };
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

    render(
      <ModuleOfDay
        display={this.resolveDisplay(featured)}
        accent={featured.accent}
        difficulty={featured.difficulty}
        hasRecentPlay={featuredTimestamp > 0}
        onHoverPrefetch={() => GameRegistry.prefetch(featured.id)}
        onPlay={() => this.openFeatured(featured)}
      />,
      this.moduleOfDayEl
    );
  }

  private updateHeaderCounts(total: number): void {
    this.headerCountIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(total);
    });
  }

  /** Comportamiento del CTA de "Módulo del Día" — mismo criterio que
   *  openCard() dentro de renderCards(): si el llamador pasó
   *  onCardClick, se delega ahí (necesario para que una card "hub"
   *  destacada como módulo del día —ver gameGroupMenuController.ts—
   *  abra su menú flotante en vez de navegar directo a una vista que
   *  ni siquiera existe para ese id); si no, navegación normal. El
   *  CTA (#modOfDayCta) ya existe en el DOM en el momento del click
   *  (se resuelve recién acá, no al montar, porque es el único
   *  momento en que hace falta la referencia real). */
  private openFeatured(featured: GameConfig): void {
    if (this.onCardClick) {
      const ctaEl = document.getElementById('modOfDayCta');
      if (ctaEl) {
        this.onCardClick(featured, ctaEl);
        return;
      }
    }
    ViewManager.showView(featured.id);
  }
}

const LobbyRendererInstance = new LobbyRenderer();

export default LobbyRendererInstance;
