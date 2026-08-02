/**
 * js/views/onlineLobby.ts
 *
 * Template de la vista "Lobby Online" — grilla de tarjetas igual a la
 * de #home (ver js/lobbyRenderer.ts), pero filtrada a solo los juegos
 * con soporte multiplayer real (Simon, Arrow, Termita, Letters Fall —
 * ver GameConfig.online). Destino tras crear/unirse a un lobby grupal
 * desde la pestaña Multiplayer (ver showLobbyActive en
 * views/multiplayer.logic.ts).
 *
 * Se omiten el "Módulo del Día" y las stat-cards de sesión de #home:
 * ambos están pensados para el catálogo completo (destacar lo último
 * jugado, contar sesiones/completados en general) y no tienen mucho
 * sentido en una grilla ya reducida a 4 juegos con un propósito
 * puntual ("volver a elegir con quién/qué jugar ahora").
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
    `;
};

export default template satisfies ViewTemplate;
