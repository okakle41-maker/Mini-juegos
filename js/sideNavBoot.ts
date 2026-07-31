/**
 * sideNavBoot.ts — Animación de arranque del side-nav, estadísticas de sesión
 * y sincronización del panel de progreso/nivel.
 * Versión TypeScript (antes: <script> inline en index.html)
 */

import safeStorage from './core/safeStorage.js';
import ViewManager from './core/viewManager.js';
import GameRegistry from './core/gameRegistry.js';

interface LeaderboardEntry {
  value: number;
  timestamp: number;
  meta?: unknown;
}

type LeaderboardStore = Record<string, LeaderboardEntry[]>;

function isLeaderboardStore(value: unknown): value is LeaderboardStore {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => Array.isArray(v));
}

function readLeaderboardStore(): LeaderboardStore {
  return safeStorage.getJSON<LeaderboardStore>('minijuegos_leaderboard', {}, {
    validate: isLeaderboardStore,
  });
}

function initBootFill(): void {
  const fill = document.getElementById('sideNavBootFill');
  const text = document.getElementById('sideNavBootText');
  if (!fill) return;

  requestAnimationFrame(() => {
    setTimeout(() => {
      fill.style.width = '100%';
      setTimeout(() => {
        if (text) text.textContent = 'PROTOCOLO LISTO';
      }, 900);
    }, 250);
  });
}

function initCompletedStat(): void {
  try {
    const store = readLeaderboardStore();
    const completedEl = document.getElementById('sysCompletedStat');
    if (completedEl) completedEl.textContent = String(Object.keys(store).length);
  } catch {
    /* noop */
  }
}

function initSessionsStat(): void {
  const sessions = safeStorage.getNumber('minijuegos_sessions', 0) + 1;
  safeStorage.setNumber('minijuegos_sessions', sessions);
  const sessionsEl = document.getElementById('sysSessionsStat');
  if (sessionsEl) sessionsEl.textContent = String(sessions);
}

/**
 * Puebla el panel de sesión del sidebar con datos reales del Leaderboard.
 * El shape real de LeaderboardManager es: { [gameId]: Array<{value, timestamp, meta}> }
 * No es { [gameId]: { played, updatedAt } } — un juego "jugado" es simplemente
 * una clave cuyo array de entradas no está vacío.
 */
function updateSidebarSession(): void {
  try {
    const store = readLeaderboardStore();
    const playedKeys = Object.keys(store).filter(
      (k) => Array.isArray(store[k]) && store[k].length > 0
    );
    const completed = playedKeys.length;

    // Necesitamos el total de módulos; el registro puede seguir vacío si
    // todavía no corrió el import() de cada juego individual. Por eso
    // primero se intenta leer del contador del header que gameBootstrap
    // ya actualiza, y solo si eso falla se recurre a GameRegistry.visible().
    const totalEl = document.getElementById('modsCountHeader');
    let total = totalEl ? parseInt(totalEl.textContent || '0', 10) || 0 : 0;
    if (!total) total = GameRegistry.visible().length;

    // Porcentaje de completado → ancho de la barra
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Sistema de niveles según porcentaje completado
    let levelName: string;
    if (pct === 0) levelName = 'RECRUTA';
    else if (pct < 20) levelName = 'APRENDIZ';
    else if (pct < 40) levelName = 'INICIADO';
    else if (pct < 60) levelName = 'OPERADOR';
    else if (pct < 80) levelName = 'ESPECIALISTA';
    else if (pct < 100) levelName = 'EXPERTO';
    else levelName = 'MAESTRO';

    const levelEl = document.getElementById('sideNavLevel');
    const barEl = document.getElementById('sideNavLevelBar');
    const modulosEl = document.getElementById('sideNavModulos');
    const headerLevelEl = document.getElementById('headerUserLevel');

    if (levelEl) levelEl.textContent = levelName;
    if (headerLevelEl) headerLevelEl.textContent = levelName;
    if (modulosEl) modulosEl.textContent = total > 0 ? `${completed} / ${total}` : '—';
    if (barEl) {
      // Pequeño delay para que la transición CSS arranque desde 0
      setTimeout(() => {
        barEl.style.width = `${pct}%`;
      }, 300);
    }

    // Último juego visitado (la entrada más reciente = índice 0, porque
    // LeaderboardManager.save() hace unshift() al guardar)
    let latestId: string | null = null;
    let latestTs: number | null = null;
    playedKeys.forEach((k) => {
      const ts = store[k][0] && store[k][0].timestamp;
      if (ts && (!latestTs || ts > latestTs)) {
        latestTs = ts;
        latestId = k;
      }
    });

    const lastRow = document.getElementById('sideNavLastRow');
    const lastGame = document.getElementById('sideNavLastGame');
    if (latestId && lastRow && lastGame) {
      // Intentar obtener el nombre del juego desde GameRegistry
      let gameName: string = latestId;
      const g = GameRegistry.get(latestId);
      if (g && g.name) gameName = g.name.toUpperCase();
      lastGame.textContent = gameName;
      lastRow.style.display = '';
    }
  } catch {
    /* noop */
  }
}

function initSideNavLinks(): void {
  const sideLinks = document.querySelectorAll<HTMLElement>('.side-nav-link');

  const setActiveLink = (sideNavKey: string): void => {
    sideLinks.forEach((l) => {
      const isActive = l.dataset.sideNav === sideNavKey;
      l.classList.toggle('side-nav-link--active', isActive);
      if (isActive) l.setAttribute('aria-current', 'page');
      else l.removeAttribute('aria-current');
    });
  };

  sideLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.sideNav || '';

      // side-nav-link--active es solo visual (CSS). aria-current="page" es
      // su equivalente para lectores de pantalla: sin esto, la sección
      // activa del sidebar no se anuncia como tal al navegar por teclado.
      // Se sincronizan juntas para que nunca queden desalineadas entre sí.
      setActiveLink(target);

      // Navegación real: "modulos" es un alias del sidebar para la vista
      // "home" (no hay una sección <section id="modulos">), el resto de
      // los data-side-nav coinciden 1:1 con el id de su <section>. Antes
      // de este fix, este listener solo actualizaba el estado visual del
      // link sin llamar a showView/backToMenu en ningún caso más que
      // "modulos" — el resto de los botones del sidebar (Estadísticas,
      // Progreso, Ranking, Configuración, Manual, Cuenta) no navegaban a
      // ningún lado pese a marcarse como "activos".
      if (target === 'modulos') {
        ViewManager.backToMenu('home');
      } else if (target) {
        ViewManager.showView(target);
      }
    });
  });

  // El clic en el sidebar no es la única forma de navegar: cada minijuego
  // tiene su propio botón "volver" que llama a window.backToMenu('home')
  // directamente (ver back-btn en utils/backButton.ts y los onclick
  // inline en viewManager.ts/virusOverload.ts), sin pasar por los
  // listeners de arriba. Sin este listener, volver desde un juego dejaba
  // aria-current apuntando a la última sección clickeada en el sidebar
  // (o a ninguna) en vez de a "MÓDULOS", que es la vista realmente
  // visible tras el back-btn. view-shown lo dispara viewManager.ts en
  // cada cambio de vista real, sea cual sea el origen del click.
  document.addEventListener('view-shown', ((e: CustomEvent<{ id: string }>) => {
    const viewId = e.detail?.id;
    if (!viewId) return;
    // Toda vista que no sea una de las páginas propias del sidebar
    // (estadisticas/progreso/ranking/configuracion/manual/logros/personalizacion/estadisticas-avanzadas/multiplayer/social/torneos) es un
    // minijuego individual, y esos viven bajo "MÓDULOS" en la nav.
    const knownPages = ['estadisticas', 'progreso', 'ranking', 'configuracion', 'manual', 'logros', 'personalizacion', 'estadisticas-avanzadas', 'multiplayer', 'social', 'torneos'];
    const sideNavKey = knownPages.includes(viewId) ? viewId : 'modulos';
    setActiveLink(sideNavKey);
  }) as EventListener);
}

// La sincronización del badge de usuario del header (#headerUserBadge) con
// Auth.getUser(), y su navegación a la vista "cuenta" al hacer click/Enter/
// Espacio, ya las cubre js/accountView.ts (renderHeaderBadge +
// handleClick/handleHeaderBadgeKeydown). Antes había una segunda
// implementación acá mismo (initHeaderUserBadge) que registraba su propio
// listener de 'auth:changed' y su propio click handler sobre el mismo
// #headerUserBadge — inofensivo en apariencia (ambos hacían lo mismo), pero
// enmascaraba el bug real: accountView.ts nunca se importaba desde main.ts,
// así que sus listeners (incluidos los de submit de los formularios de
// login/registro) nunca se registraban. Con solo esta implementación
// duplicada activa, el badge parecía "andar" en los casos donde ya había
// sesión restaurada al arrancar, pero el login en sí no completaba nunca
// (el submit del formulario no tenía handler), así que tras loguearse el
// badge se quedaba en "DESCONOCIDO" para siempre. Ver import de
// './accountView' en main.ts.

function init(): void {
  initBootFill();
  initCompletedStat();
  initSessionsStat();

  // Llamar ahora (puede que total=0 si GameRegistry aún no registró los juegos)
  updateSidebarSession();
  // Llamar de nuevo cuando el DOM esté completamente listo (todos los juegos registrados)
  document.addEventListener('DOMContentLoaded', updateSidebarSession);
  // Y también cada vez que se guarde un nuevo récord
  window.addEventListener('leaderboard:updated', updateSidebarSession);

  initSideNavLinks();
}

init();

export {};
