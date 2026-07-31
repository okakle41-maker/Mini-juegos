/**
 * Torneos View Template
 * Vista para el sistema de torneos y eventos
 */

export function template(): string {
  return `
    <div class="tournaments-view">
      <div class="tournaments-header">
        <h2 class="tournaments-title">🏆 Torneos y Eventos</h2>
      </div>

      <!-- Tournaments and Events Tabs -->
      <div class="tournaments-tabs">
        <button class="tournament-tab tournament-tab--active" data-tab="tournaments">🏆 Torneos</button>
        <button class="tournament-tab" data-tab="events">🎪 Eventos</button>
      </div>

      <!-- Tournaments Tab -->
      <div class="tournament-tab-content" id="tournaments-tab">
        <div class="tournaments-section">
          <h3 class="section-title">🏆 Torneos Activos</h3>
          <div class="section-decorative">
            <span>🏆</span><span>🎯</span><span>🥇</span>
          </div>
          <div class="tournaments-list" id="active-tournaments">
            <!-- Los torneos activos se generan dinámicamente -->
          </div>
        </div>
        <div class="tournaments-section">
          <h3 class="section-title">📜 Historial de Torneos</h3>
          <div class="section-decorative">
            <span>📜</span><span>🏅</span><span>🎖️</span>
          </div>
          <div class="tournaments-list" id="tournament-history">
            <!-- El historial se genera dinámicamente -->
          </div>
        </div>
        <div class="current-tournament-section" id="current-tournament-section" style="display: none;">
          <h3 class="section-title">Mi Torneo Actual</h3>
          <div class="tournament-info" id="tournament-info">
            <!-- La info del torneo se genera dinámicamente -->
          </div>
          <div class="tournament-bracket" id="tournament-bracket">
            <!-- El bracket se genera dinámicamente -->
          </div>
          <div class="tournament-actions">
            <button class="tournament-btn" id="leave-tournament-btn">🚪 Abandonar Torneo</button>
          </div>
        </div>
      </div>

      <!-- Events Tab -->
      <div class="tournament-tab-content" id="events-tab" style="display: none;">
        <div class="events-section">
          <h3 class="section-title">🎪 Eventos Activos</h3>
          <div class="section-decorative">
            <span>🎪</span><span>🎊</span><span>✨</span>
          </div>
          <div class="events-list" id="active-events">
            <!-- Los eventos activos se generan dinámicamente -->
          </div>
        </div>
        <div class="events-section">
          <h3 class="section-title">📅 Próximos Eventos</h3>
          <div class="section-decorative">
            <span>📅</span><span>🗓️</span><span>⏰</span>
          </div>
          <div class="events-list" id="upcoming-events">
            <!-- Los próximos eventos se generan dinámicamente -->
          </div>
        </div>
        <div class="current-event-section" id="current-event-section" style="display: none;">
          <h3 class="section-title">Evento Actual</h3>
          <div class="event-info" id="event-info">
            <!-- La info del evento se genera dinámicamente -->
          </div>
          <div class="event-challenges">
            <h4 class="subsection-title">Desafíos del Evento</h4>
            <div class="challenges-list" id="event-challenges">
              <!-- Los desafíos se generan dinámicamente -->
            </div>
          </div>
          <div class="event-rewards">
            <h4 class="subsection-title">Recompensas</h4>
            <div class="rewards-list" id="event-rewards">
              <!-- Las recompensas se generan dinámicamente -->
            </div>
          </div>
          <div class="event-actions">
            <button class="event-btn" id="apply-event-theme">🎨 Aplicar Tema del Evento</button>
            <button class="event-btn" id="remove-event-theme">🚫 Quitar Tema del Evento</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
