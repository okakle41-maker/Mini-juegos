/**
 * js/views/fragmentedLabyrinth.ts
 *
 * Template de la vista "Fragmented Labyrinth" — minijuego cooperativo
 * de EXACTAMENTE 4 jugadores simultáneos con roles fijos A/B/C/D. Cada
 * jugador ve únicamente:
 *   - su rol y una descripción corta de qué le toca hacer,
 *   - su propio cuadrante del laberinto (SVG, ver fragmentedLabyrinth.logic.ts),
 *   - el timer compartido y el conteo de movimientos,
 *   - si su cuadrante contiene el inicio y/o la salida.
 *
 * Solo el Jugador A controla al personaje (teclado/WASD) — B/C/D son
 * observadores puros de su cuadrante y coordinan por voz externa (sin
 * chat integrado en este port, ver decisión de producto en
 * supabase/migration_018_fragmented_labyrinth.sql). Igual criterio que
 * signalTriangulation.ts: esta vista asume que ya existe una partida
 * activa (currentMatch) — crear/unirse se maneja desde el modal de
 * views/onlineLobby.logic.ts, nunca desde acá.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="online-lobby"></button>
        <div class="fl-game-container">
          <div class="fl-card">
            <div class="fl-header">
              <div>
                <h2>Fragmented Labyrinth</h2>
                <p>Un laberinto, cuatro cuadrantes, un solo personaje. Coordinense por voz para llegar a la salida.</p>
              </div>
              <div class="fl-role-badge-wrap">
                <span data-ui="flRoleBadge" class="fl-role-badge">Rol —</span>
              </div>
            </div>

            <div data-ui="flLoginRequired" class="fl-message hidden" role="status">
              Necesitás iniciar sesión para jugar Fragmented Labyrinth — el laberinto completo se oculta incluso a tus propios compañeros de equipo, así que hace falta identidad real.
            </div>

            <div data-ui="flWaitingPanel" class="fl-waiting-panel hidden" role="status" aria-live="polite">
              <p data-ui="flWaitingMessage">Esperando a que se completen los 4 jugadores...</p>
              <div data-ui="flRolesList" class="fl-roles-list"></div>
            </div>

            <div data-ui="flPlayPanel" class="fl-play-panel hidden">
              <p data-ui="flRoleHint" class="fl-role-hint"></p>

              <div class="fl-hud">
                <div class="fl-hud-item">
                  <span class="fl-hud-label">⏱️ Tiempo</span>
                  <span data-ui="flTimer" class="fl-timer">—</span>
                </div>
                <div class="fl-hud-item">
                  <span data-ui="flMoves" class="fl-moves">👣 0 movimientos</span>
                </div>
              </div>

              <svg data-ui="flSvg" class="fl-svg" role="img" aria-label="Tu cuadrante del laberinto"></svg>

              <p data-ui="flQuadrantHint" class="fl-quadrant-hint"></p>
              <p data-ui="flControlsHint" class="fl-controls-hint"></p>
            </div>

            <div data-ui="flResult" class="fl-result hidden" role="status" aria-live="assertive"></div>
            <button data-ui="backToLobby" class="hidden" data-back-to="online-lobby">Volver al lobby online</button>
          </div>
        </div>
      </div>
    `;
};

export default template satisfies ViewTemplate;
