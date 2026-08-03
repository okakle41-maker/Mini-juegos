/**
 * js/views/onlineLobby.ts
 *
 * Template de la vista "Lobby Online" — grilla de tarjetas igual a la
 * de #home (ver js/lobbyRenderer.ts), pero filtrada a solo los juegos
 * con soporte multiplayer real (Simon, Arrow, Termita, Letters Fall,
 * Signal Triangulation, Centro de Control — ver GameConfig.online).
 * Destino tras crear/unirse a un lobby grupal desde la pestaña
 * Multiplayer (ver showLobbyActive en views/multiplayer.logic.ts).
 *
 * Incluye un modal de configuración previa para TODOS los juegos de esta
 * grilla: al hacer click en cualquier card, en vez de navegar directo al
 * juego, se abre este panel para crear una partida nueva (eligiendo rol
 * en el caso de Centro de Control), unirse a una ya creada por otro
 * jugador del mismo lobby grupal, o espectar una en curso — lista debajo
 * del botón/selector de crear (ver views/onlineLobby.logic.ts). Este
 * modal es el ÚNICO punto de entrada para crear/unirse/espectar
 * cualquier sub-partida, sea 1v1 (Simon/Arrow/Termita, vía
 * olConfigLobbySection) o cooperativa de 4 (Signal Triangulation/Centro
 * de Control, vía olConfigStSection/olConfigScSection): la vista
 * Multiplayer (lobby grupal) ya no tiene sección propia para ninguno de
 * estos juegos.
 *
 * Se omiten el "Módulo del Día" y las stat-cards de sesión de #home:
 * ambos están pensados para el catálogo completo (destacar lo último
 * jugado, contar sesiones/completados en general) y no tienen mucho
 * sentido en una grilla ya reducida con un propósito puntual ("volver
 * a elegir con quién/qué jugar ahora").
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="lobby-inner">
        <div class="lobby-ambient" aria-hidden="true"></div>

        <div class="lobby-heading">
          <div>
            <button class="back-btn" data-back-to="multiplayer"></button>
            <div class="lobby-label">
              <span class="lobby-label-bar"></span>
              LOBBY ONLINE
            </div>
            <div class="online-lobby-code-badge hidden" id="onlineLobbyCodeBadge">
              Código de sala: <strong id="onlineLobbyCodeValue"></strong>
            </div>
            <h2 class="lobby-title">Elegí con qué jugar</h2>
            <p class="lobby-sub">Estos son los módulos con soporte multiplayer. Elegí uno para entrar a su sala.</p>
            <div class="lobby-pills">
              <span class="lobby-pill lobby-pill--active">
                <span class="lobby-pill-dot"></span><span id="onlineModsCountPill">4</span> MÓDULOS ONLINE
              </span>
              <span class="lobby-pill">🌐 MULTIJUGADOR</span>
            </div>
          </div>
        </div>

        <div class="lobby-toolbar">
          <div class="lobby-filter-bar" id="onlineFilterBar" role="toolbar" aria-label="Filtrar por categoría">
            <button class="filter-btn filter-btn--active" data-filter="TODOS">TODOS</button>
          </div>
        </div>

        <div class="game-grid" id="onlineGameList" role="grid" aria-label="Cuadrícula de minijuegos online disponibles">
          <!-- Las cartas se generan dinámicamente vía LobbyRenderer.render(),
               filtradas a GameRegistry.visibleOnline() -->
        </div>
      </div>

      <!-- Modal de configuración previa para los juegos con lobby real
           (Simon/Arrow/Termita vía olConfigLobbySection, Signal
           Triangulation vía olConfigStSection, Centro de Control vía
           olConfigScSection) — se abre al hacer click en cualquiera de
           esas cards (ver onlineLobby.logic.ts). Letters Fall es la
           única excepción: navega directo, maneja su propio panel de
           sala (Solo/Crear/Unirse) dentro de su propia vista. -->
      <div class="ol-modal-overlay hidden" id="olConfigModalOverlay" role="presentation">
        <div class="ol-modal" role="dialog" aria-modal="true" aria-labelledby="olConfigModalTitle">
          <button class="ol-modal-close" id="olConfigModalClose" type="button" aria-label="Cerrar">✕</button>
          <div class="ol-modal-header">
            <span class="ol-modal-icon" id="olConfigModalIcon">📡</span>
            <div>
              <h3 class="ol-modal-title" id="olConfigModalTitle">Signal Triangulation</h3>
              <p class="ol-modal-sub" id="olConfigModalDesc">Configurá la partida antes de empezar.</p>
            </div>
          </div>

          <div id="olConfigStSection">
            <p class="ol-modal-hint">
              Cooperativo puro de 4 jugadores. Cada uno ve solo su propia
              distancia a la señal oculta y deben coordinarse por voz para
              triangular la celda exacta. Requiere sesión iniciada.
            </p>
            <div class="ol-modal-error hidden" id="olConfigStError" role="alert"></div>
            <button class="ol-modal-primary-btn" id="olConfigStCreateBtn" type="button">
              📡 Crear partida de Signal Triangulation
            </button>
            <div class="lobby-st-matches-list" id="olConfigStMatchesList" style="margin-top: 1rem;">
              <p class="no-matches">Todavía no hay partidas de Signal Triangulation. ¡Creá una!</p>
            </div>
          </div>

          <div id="olConfigScSection" class="hidden">
            <p class="ol-modal-hint">
              Cooperativo puro de 4 jugadores con roles asimétricos. Cada
              uno ve una pantalla distinta (Navegación, Sensores, Energía,
              Comunicaciones). Elegí tu rol para crear la partida. Requiere
              sesión iniciada.
            </p>
            <div class="ol-modal-error hidden" id="olConfigScError" role="alert"></div>
            <div class="ol-modal-role-grid" id="olConfigScRolePicker">
              <button class="ol-modal-role-btn" data-role="navigation" type="button">
                <span class="ol-modal-role-icon">🧭</span>
                <span class="ol-modal-role-name">Navegación</span>
              </button>
              <button class="ol-modal-role-btn" data-role="sensors" type="button">
                <span class="ol-modal-role-icon">📡</span>
                <span class="ol-modal-role-name">Sensores</span>
              </button>
              <button class="ol-modal-role-btn" data-role="energy" type="button">
                <span class="ol-modal-role-icon">⚡</span>
                <span class="ol-modal-role-name">Energía</span>
              </button>
              <button class="ol-modal-role-btn" data-role="comms" type="button">
                <span class="ol-modal-role-icon">📻</span>
                <span class="ol-modal-role-name">Comunicaciones</span>
              </button>
            </div>
            <div class="lobby-sc-matches-list" id="olConfigScMatchesList" style="margin-top: 1rem;">
              <p class="no-matches">Todavía no hay partidas de Centro de Control. ¡Creá una eligiendo tu rol!</p>
            </div>
          </div>

          <div id="olConfigLobbySection" class="hidden">
            <p class="ol-modal-hint">
              Duelo 1v1. Creá una partida nueva y esperá a un rival, unite
              como rival a una que ya esté esperando, o espectá una que ya
              esté en curso.
            </p>
            <div class="ol-modal-error hidden" id="olConfigLobbyError" role="alert"></div>
            <button class="ol-modal-primary-btn" id="olConfigLobbyCreateBtn" type="button">
              🆕 Crear partida
            </button>
            <div class="lobby-matches-list" id="olConfigLobbyMatchesList" style="margin-top: 1rem;">
              <p class="no-matches">Todavía no hay partidas. ¡Creá una!</p>
            </div>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;