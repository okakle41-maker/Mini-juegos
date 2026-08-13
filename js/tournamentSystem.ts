/**
 * Tournament System - Tournaments and Events
 * Sistema de torneos y eventos con brackets, fases y recompensas
 */

import Auth from './authManager.js';
import type { SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Fila cruda tal como llega de Supabase Realtime (snake_case), ver
// supabase/migration_006_social_tournaments.sql tabla `tournaments`.
// `is_registered` no es una columna real de esa tabla — se preserva acá
// como opcional porque handleTournamentUpdate la lee igual (ver nota
// abajo), sin que eso implique que el server la vaya a enviar hoy.
interface TournamentRow {
  id: string;
  name: string;
  description: string;
  type: string;
  game_id: string;
  max_participants: number;
  current_participants: number;
  status: string;
  start_time: string;
  end_time: string;
  registration_deadline: string;
  bracket: TournamentBracket;
  rules: TournamentRules;
  rewards: TournamentRewards;
  is_registered?: boolean;
}

interface EventRow {
  id: string;
  name: string;
  description: string;
  type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  challenges: EventChallenge[];
  rewards: EventRewards;
  theme: EventTheme;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  type: 'weekly' | 'seasonal' | 'special' | 'clan';
  gameId: string;
  maxParticipants: number;
  currentParticipants: number;
  status: 'registration' | 'in_progress' | 'completed' | 'cancelled';
  startTime: number;
  endTime: number;
  registrationDeadline: number;
  bracket: TournamentBracket;
  rules: TournamentRules;
  rewards: TournamentRewards;
  isRegistered: boolean;
}

interface TournamentBracket {
  type: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
  rounds: TournamentRound[];
  currentRound: number;
}

interface TournamentRound {
  number: number;
  matches: TournamentMatch[];
  status: 'pending' | 'in_progress' | 'completed';
}

interface TournamentMatch {
  id: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  winnerId?: string;
  score1: number;
  score2: number;
  status: 'pending' | 'in_progress' | 'completed';
  scheduledTime: number;
}

interface TournamentRules {
  bestOf: number;
  timeLimit: number;
  scoreLimit: number;
  allowedDifficulties: string[];
  bannedPowerups: string[];
}

interface TournamentRewards {
  firstPlace: { xp: number; cosmetics: string[]; titles: string[] };
  secondPlace: { xp: number; cosmetics: string[]; titles: string[] };
  thirdPlace: { xp: number; cosmetics: string[]; titles: string[] };
  participation: { xp: number };
}

export interface Event {
  id: string;
  name: string;
  description: string;
  type: 'thematic' | 'holiday' | 'community' | 'milestone';
  startDate: number;
  endDate: number;
  isActive: boolean;
  challenges: EventChallenge[];
  rewards: EventRewards;
  theme: EventTheme;
}

export interface EventChallenge {
  id: string;
  name: string;
  description: string;
  type: 'play_game' | 'complete_game' | 'high_score' | 'streak' | 'special';
  gameId?: string;
  target: number;
  progress: number;
  completed: boolean;
  reward: { xp: number; cosmetic?: string };
}

interface EventRewards {
  completion: { xp: number; cosmetics: string[]; titles: string[] };
  milestones: Map<number, { xp: number; cosmetic?: string }>;
}

interface EventTheme {
  id: string;
  name: string;
  colors: { primary: string; secondary: string; accent: string };
  specialEffects: string[];
  customIcons: Map<string, string>;
}

class TournamentSystem {
  private tournaments: Map<string, Tournament> = new Map();
  private events: Map<string, Event> = new Map();
  private currentTournament: Tournament | null = null;
  private currentEvent: Event | null = null;
  private tournamentHistory: Tournament[] = [];
  private eventHistory: Event[] = [];
  
  private storageKeys = {
    tournaments: 'tournament-tournaments',
    events: 'tournament-events',
    currentTournament: 'tournament-current',
    currentEvent: 'tournament-current-event',
    history: 'tournament-history',
    eventHistory: 'tournament-event-history'
  };

  private supabaseClient: SupabaseClient | null = null;
  private isConnected: boolean = false;
  // Ver el mismo patrón/nota en socialSystem.ts: guardada para un
  // futuro disconnect(), que hoy no existe en este sistema tampoco.
  private realtimeSubscriptions: Map<string, unknown> = new Map();

  constructor() {
    this.loadLocalData();
    void this.initializeSupabase().catch((err: unknown) => {
      console.error('[TournamentSystem] Error durante la inicialización:', err);
    });
    this.generateWeeklyTournament();
    this.initializeSeasonalEvents();
  }

  private async initializeSupabase(): Promise<void> {
    try {
      const { getSupabaseClient } = await import('./core/supabaseClient.js');
      this.supabaseClient = await getSupabaseClient();
      this.isConnected = true;
      this.setupRealtimeSubscriptions();
    } catch (e) {
      console.error('[Tournament] Failed to initialize Supabase:', e);
      this.isConnected = false;
    }
  }

  /**
   * Id real del jugador autenticado, o null sin sesión. Antes,
   * register/unregisterFromTournament usaban el string literal
   * 'current_player' para TODOS los usuarios — eso hacía que un mismo
   * placeholder representara a cualquier cantidad de inscriptos
   * distintos en la misma fila lógica de tournament_participants, y
   * que unregisterFromTournament (filtrando por ese mismo placeholder)
   * pudiera borrar la inscripción de otro jugador en vez de la propia.
   * Mismo patrón que socialSystem.currentPlayerId().
   */
  private currentPlayerId(): string | null {
    return Auth.getUser()?.id ?? null;
  }

  private currentPlayerName(): string {
    return Auth.getUser()?.username ?? 'Jugador';
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.supabaseClient || !this.isConnected) return;

    // Subscribe to tournament updates
    const tournamentSubscription = this.supabaseClient
      .channel('tournaments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, (payload: RealtimePostgresChangesPayload<TournamentRow>) => {
        this.handleTournamentUpdate(payload);
      })
      .subscribe();
    this.realtimeSubscriptions.set('tournaments', tournamentSubscription);

    // Nota: NO hay suscripción a una tabla `events` — no existe en el
    // schema real (supabase/schema.sql + migraciones): los "eventos
    // estacionales" (halloween, cyber week, etc.) son generados
    // enteramente en el cliente por initializeSeasonalEvents() y viven
    // solo en localStorage, nunca en Supabase. Antes había acá un
    // .channel('events').on(..., { table: 'events' }) que se suscribía
    // indefinidamente a una tabla inexistente — nunca iba a disparar
    // nada, pero quedaba como suscripción Realtime abierta sin ningún
    // propósito. Si en el futuro los eventos pasan a vivir en el
    // servidor, la suscripción y handleEventUpdate() (ver abajo, todavía
    // presente para ese caso) son el punto de partida correcto.
  }

  private handleTournamentUpdate(payload: RealtimePostgresChangesPayload<TournamentRow>): void {
    const { eventType, new: newRecord } = payload;

    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord && 'id' in newRecord) {
      const tournament: Tournament = {
        id: newRecord.id,
        name: newRecord.name,
        description: newRecord.description,
        type: newRecord.type as Tournament['type'],
        gameId: newRecord.game_id,
        maxParticipants: newRecord.max_participants,
        currentParticipants: newRecord.current_participants,
        status: newRecord.status as Tournament['status'],
        startTime: new Date(newRecord.start_time).getTime(),
        endTime: new Date(newRecord.end_time).getTime(),
        registrationDeadline: new Date(newRecord.registration_deadline).getTime(),
        // bracket/rules/rewards son columnas `jsonb` (ver
        // migration_006_social_tournaments.sql) — supabase-js ya las
        // entrega parseadas como objetos JS, no como strings JSON.
        // JSON.parse(objeto) lanza SyntaxError ("[object Object] is not
        // valid JSON"), sin capturar acá, así que este handler rompía
        // en cada evento Realtime real del canal `tournaments` en vez de
        // actualizar el torneo.
        bracket: newRecord.bracket,
        rules: newRecord.rules,
        rewards: newRecord.rewards,
        isRegistered: newRecord.is_registered || false
      };

      this.tournaments.set(tournament.id, tournament);
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('tournament:updated', {
        detail: { tournament }
      }));
    }
  }

  /**
   * Sin uso hoy (ver nota en setupRealtimeSubscriptions: no hay tabla
   * `events` en el schema real) — se mantiene lista para el día que los
   * eventos estacionales pasen a vivir en el servidor. `challenges`/
   * `rewards`/`theme` asumidos como columnas `jsonb` (mismo criterio que
   * handleTournamentUpdate), no como texto a parsear.
   */
  private handleEventUpdate(payload: RealtimePostgresChangesPayload<EventRow>): void {
    const { eventType, new: newRecord } = payload;

    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord && 'id' in newRecord) {
      const event: Event = {
        id: newRecord.id,
        name: newRecord.name,
        description: newRecord.description,
       type: newRecord.type as Event['type'],
        startDate: new Date(newRecord.start_date).getTime(),
        endDate: new Date(newRecord.end_date).getTime(),
        isActive: newRecord.is_active,
        challenges: newRecord.challenges,
        rewards: newRecord.rewards,
        theme: newRecord.theme
      };

      this.events.set(event.id, event);
      if (event.isActive) {
        this.currentEvent = event;
      }
      this.saveLocalData();

      window.dispatchEvent(new CustomEvent('event:updated', {
        detail: { event }
      }));
    }
  }

  private loadLocalData(): void {
    const tournamentsData = localStorage.getItem(this.storageKeys.tournaments);
    if (tournamentsData) {
      try {
        this.tournaments = new Map(JSON.parse(tournamentsData));
      } catch (e) {
        console.error('[Tournament] Failed to load tournaments:', e);
      }
    }

    const eventsData = localStorage.getItem(this.storageKeys.events);
    if (eventsData) {
      try {
        this.events = new Map(JSON.parse(eventsData));
      } catch (e) {
        console.error('[Tournament] Failed to load events:', e);
      }
    }

    const currentTournamentData = localStorage.getItem(this.storageKeys.currentTournament);
    if (currentTournamentData) {
      try {
        this.currentTournament = JSON.parse(currentTournamentData);
      } catch (e) {
        console.error('[Tournament] Failed to load current tournament:', e);
      }
    }

    const currentEventData = localStorage.getItem(this.storageKeys.currentEvent);
    if (currentEventData) {
      try {
        this.currentEvent = JSON.parse(currentEventData);
      } catch (e) {
        console.error('[Tournament] Failed to load current event:', e);
      }
    }

    const historyData = localStorage.getItem(this.storageKeys.history);
    if (historyData) {
      try {
        this.tournamentHistory = JSON.parse(historyData);
      } catch (e) {
        console.error('[Tournament] Failed to load history:', e);
      }
    }

    const eventHistoryData = localStorage.getItem(this.storageKeys.eventHistory);
    if (eventHistoryData) {
      try {
        this.eventHistory = JSON.parse(eventHistoryData);
      } catch (e) {
        console.error('[Tournament] Failed to load event history:', e);
      }
    }
  }

  private saveLocalData(): void {
    localStorage.setItem(this.storageKeys.tournaments, JSON.stringify([...this.tournaments]));
    localStorage.setItem(this.storageKeys.events, JSON.stringify([...this.events]));
    localStorage.setItem(this.storageKeys.currentTournament, JSON.stringify(this.currentTournament));
    localStorage.setItem(this.storageKeys.currentEvent, JSON.stringify(this.currentEvent));
    localStorage.setItem(this.storageKeys.history, JSON.stringify(this.tournamentHistory));
    localStorage.setItem(this.storageKeys.eventHistory, JSON.stringify(this.eventHistory));
  }

  private generateWeeklyTournament(): void {
    const now = Date.now();
    const weekStart = now - (now % (7 * 24 * 60 * 60 * 1000));
    const weekEnd = weekStart + (7 * 24 * 60 * 60 * 1000);
    const tournamentId = `weekly_${weekStart}`;

    // Check if tournament already exists
    if (this.tournaments.has(tournamentId)) {
      const tournament = this.tournaments.get(tournamentId)!;
      if (tournament.status === 'completed') {
        this.tournamentHistory.push(tournament);
        this.tournaments.delete(tournamentId);
        this.saveLocalData();
      }
      return;
    }

    const tournament: Tournament = {
      id: tournamentId,
      name: 'Torneo Semanal',
      description: 'Torneo semanal de eliminación directa',
      type: 'weekly',
      gameId: 'simon', // Weekly featured game
      maxParticipants: 32,
      currentParticipants: 0,
      status: 'registration',
      startTime: weekStart + (2 * 24 * 60 * 60 * 1000), // Starts 2 days after week start
      endTime: weekEnd,
      registrationDeadline: weekStart + (2 * 24 * 60 * 60 * 1000) - (24 * 60 * 60 * 1000),
      bracket: {
        type: 'single_elimination',
        rounds: [],
        currentRound: 0
      },
      rules: {
        bestOf: 3,
        timeLimit: 300, // 5 minutes per match
        scoreLimit: 1000,
        allowedDifficulties: ['easy', 'medium', 'hard'],
        bannedPowerups: []
      },
      rewards: {
        firstPlace: { xp: 5000, cosmetics: ['tournament_winner_badge'], titles: ['Campeón Semanal'] },
        secondPlace: { xp: 2500, cosmetics: ['tournament_runner_up'], titles: [] },
        thirdPlace: { xp: 1000, cosmetics: ['tournament_third_place'], titles: [] },
        participation: { xp: 200 }
      },
      isRegistered: false
    };

    this.tournaments.set(tournamentId, tournament);
    this.saveLocalData();
  }

  private initializeSeasonalEvents(): void {
    const now = Date.now();
    const currentMonth = new Date(now).getMonth();
    const currentYear = new Date(now).getFullYear();

    // Create seasonal events based on month
    const seasonalEvents = this.getSeasonalEvents(currentMonth, currentYear);
    
    seasonalEvents.forEach(eventData => {
      const eventId = `event_${eventData.id}_${currentYear}`;
      if (!this.events.has(eventId)) {
        const event: Event = {
          ...eventData,
          id: eventId,
          startDate: new Date(currentYear, currentMonth, 1).getTime(),
          endDate: new Date(currentYear, currentMonth + 1, 0).getTime(),
          isActive: now >= new Date(currentYear, currentMonth, 1).getTime() && 
                   now <= new Date(currentYear, currentMonth + 1, 0).getTime(),
          challenges: this.generateEventChallenges(eventData.type),
          rewards: {
            completion: { xp: 1000, cosmetics: [`event_${eventData.id}_badge`], titles: [] },
            milestones: new Map([
              [25, { xp: 250, cosmetic: `event_${eventData.id}_bronze` }],
              [50, { xp: 500, cosmetic: `event_${eventData.id}_silver` }],
              [75, { xp: 750, cosmetic: `event_${eventData.id}_gold` }],
              [100, { xp: 1000, cosmetic: `event_${eventData.id}_platinum` }]
            ])
          },
          theme: this.getEventTheme(eventData.id)
        };

        this.events.set(eventId, event);
        if (event.isActive) {
          this.currentEvent = event;
        }
      }
    });

    this.saveLocalData();
  }

  private getSeasonalEvents(month: number, _year: number): Array<{ id: string; name: string; description: string; type: Event['type'] }> {
    const events: Array<{ id: string; name: string; description: string; type: Event['type'] }> = [];

    // Holiday events
    if (month === 9) { // October
      events.push({ id: 'halloween', name: 'Terror Training', description: 'Evento de Halloween', type: 'holiday' });
    }
    if (month === 11) { // December
      events.push({ id: 'christmas', name: 'Navidad Neural', description: 'Evento de Navidad', type: 'holiday' });
    }
    if (month === 0) { // January
      events.push({ id: 'new_year', name: 'Nuevo Año', description: 'Celebración de Año Nuevo', type: 'holiday' });
    }

    // Thematic events
    events.push({ id: 'cyber_week', name: 'Cyber Week', description: 'Semana Cyberpunk', type: 'thematic' });
    events.push({ id: 'retro_week', name: 'Retro Week', description: 'Semana Retro', type: 'thematic' });

    // Community events
    events.push({ id: 'community_challenge', name: 'Reto Comunitario', description: 'Reto de la comunidad', type: 'community' });

    return events;
  }

  private generateEventChallenges(eventType: Event['type']): EventChallenge[] {
    const challenges: EventChallenge[] = [];

    switch (eventType) {
      case 'holiday':
        challenges.push(
          { id: 'play_10', name: 'Juega 10 partidas', description: 'Completa 10 partidas', type: 'play_game', target: 10, progress: 0, completed: false, reward: { xp: 100 } },
          { id: 'complete_5', name: 'Completa 5 partidas', description: 'Completa 5 partidas', type: 'complete_game', target: 5, progress: 0, completed: false, reward: { xp: 150 } },
          { id: 'special_score', name: 'Puntuación Especial', description: 'Alcanza 500 puntos', type: 'high_score', target: 500, progress: 0, completed: false, reward: { xp: 200, cosmetic: 'holiday_star' } }
        );
        break;
      case 'thematic':
        challenges.push(
          { id: 'theme_play', name: 'Juego Temático', description: 'Juga el juego destacado', type: 'play_game', target: 5, progress: 0, completed: false, reward: { xp: 120 } },
          { id: 'theme_complete', name: 'Compleción Temática', description: 'Completa 3 partidas', type: 'complete_game', target: 3, progress: 0, completed: false, reward: { xp: 180 } }
        );
        break;
      case 'community':
        challenges.push(
          { id: 'community_streak', name: 'Racha Comunitaria', description: 'Mantén racha de 3 días', type: 'streak', target: 3, progress: 0, completed: false, reward: { xp: 200 } },
          { id: 'community_special', name: 'Reto Especial', description: 'Completa el reto especial', type: 'special', target: 1, progress: 0, completed: false, reward: { xp: 300, cosmetic: 'community_badge' } }
        );
        break;
    }

    return challenges;
  }

  private getEventTheme(eventId: string): EventTheme {
    const themes: Record<string, EventTheme> = {
      halloween: {
        id: 'halloween',
        name: 'Terror',
        colors: { primary: '#ff6600', secondary: '#9900cc', accent: '#ff0066' },
        specialEffects: ['fog', 'particles_orange'],
        customIcons: new Map([['default', '🎃']])
      },
      christmas: {
        id: 'christmas',
        name: 'Navidad',
        colors: { primary: '#00cc00', secondary: '#cc0000', accent: '#ffff00' },
        specialEffects: ['snow', 'lights'],
        customIcons: new Map([['default', '🎄']])
      },
      cyber_week: {
        id: 'cyber',
        name: 'Cyberpunk',
        colors: { primary: '#00ffff', secondary: '#ff00ff', accent: '#00ff00' },
        specialEffects: ['glitch', 'neon'],
        customIcons: new Map([['default', '🤖']])
      },
      retro_week: {
        id: 'retro',
        name: 'Retro',
        colors: { primary: '#ff00ff', secondary: '#00ff00', accent: '#ffff00' },
        specialEffects: ['scanlines', 'pixelation'],
        customIcons: new Map([['default', '👾']])
      }
    };

    return themes[eventId] || {
      id: 'default',
      name: 'Default',
      colors: { primary: '#ff9a3c', secondary: '#f97316', accent: '#ea580c' },
      specialEffects: [],
      customIcons: new Map()
    };
  }

  // Tournament methods
  async registerForTournament(tournamentId: string): Promise<void> {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) throw new Error('Tournament not found');
    if (tournament.status !== 'registration') throw new Error('Registration closed');
    if (tournament.currentParticipants >= tournament.maxParticipants) throw new Error('Tournament full');

    const myId = this.currentPlayerId();
    if (!myId) {
      console.error('[Tournament] Cannot register: no session');
      throw new Error('Necesitás iniciar sesión para inscribirte a un torneo.');
    }

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('tournament_participants')
          .insert({
            tournament_id: tournamentId,
            player_id: myId,
            player_name: this.currentPlayerName(),
            registered_at: new Date().toISOString()
          });

        await this.supabaseClient
          .from('tournaments')
          .update({ current_participants: tournament.currentParticipants + 1 })
          .eq('id', tournamentId);
      } catch (e) {
        console.error('[Tournament] Failed to register:', e);
      }
    }

    tournament.currentParticipants++;
    tournament.isRegistered = true;
    this.currentTournament = tournament;
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('tournament:registered', {
      detail: { tournamentId }
    }));
  }

  async unregisterFromTournament(tournamentId: string): Promise<void> {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    const myId = this.currentPlayerId();
    if (!myId) {
      console.error('[Tournament] Cannot unregister: no session');
      return;
    }

    if (this.supabaseClient && this.isConnected) {
      try {
        await this.supabaseClient
          .from('tournament_participants')
          .delete()
          .eq('tournament_id', tournamentId)
          .eq('player_id', myId);

        await this.supabaseClient
          .from('tournaments')
          .update({ current_participants: tournament.currentParticipants - 1 })
          .eq('id', tournamentId);
      } catch (e) {
        console.error('[Tournament] Failed to unregister:', e);
      }
    }

    tournament.currentParticipants--;
    tournament.isRegistered = false;
    if (this.currentTournament?.id === tournamentId) {
      this.currentTournament = null;
    }
    this.saveLocalData();

    window.dispatchEvent(new CustomEvent('tournament:unregistered', {
      detail: { tournamentId }
    }));
  }

  getTournaments(): Tournament[] {
    return [...this.tournaments.values()];
  }

  getActiveTournaments(): Tournament[] {
    return [...this.tournaments.values()].filter(t => 
      t.status === 'registration' || t.status === 'in_progress'
    );
  }

  getCurrentTournament(): Tournament | null {
    return this.currentTournament;
  }

  getTournamentHistory(): Tournament[] {
    return this.tournamentHistory;
  }

  // Event methods
  getEvents(): Event[] {
    return [...this.events.values()];
  }

  getActiveEvents(): Event[] {
    const now = Date.now();
    return [...this.events.values()].filter(e => 
      e.isActive && now >= e.startDate && now <= e.endDate
    );
  }

  getCurrentEvent(): Event | null {
    return this.currentEvent;
  }

  getEventHistory(): Event[] {
    return this.eventHistory;
  }

  updateEventChallengeProgress(eventId: string, challengeId: string, progress: number): void {
    const event = this.events.get(eventId);
    if (!event) return;

    const challenge = event.challenges.find(c => c.id === challengeId);
    if (!challenge || challenge.completed) return;

    challenge.progress = Math.min(challenge.progress + progress, challenge.target);

    if (challenge.progress >= challenge.target) {
      challenge.completed = true;
      
      // Grant reward
      if (typeof window !== 'undefined' && window.progressionSystem) {
        window.progressionSystem.addXP(challenge.reward.xp, 'event');
      }

      window.dispatchEvent(new CustomEvent('event:challenge_completed', {
        detail: { eventId, challengeId, reward: challenge.reward }
      }));
    }

    this.saveLocalData();
  }

  claimEventReward(eventId: string, milestone: number): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    const reward = event.rewards.milestones.get(milestone);
    if (!reward) return false;

    // Grant reward
    if (typeof window !== 'undefined' && window.progressionSystem) {
      window.progressionSystem.addXP(reward.xp, '');
    }

    window.dispatchEvent(new CustomEvent('event:reward_claimed', {
      detail: { eventId, milestone, reward }
    }));

    return true;
  }

  applyEventTheme(eventId: string): void {
    const event = this.events.get(eventId);
    if (!event || !event.isActive) return;

    const theme = event.theme;
    const root = document.documentElement;
    
    root.style.setProperty('--event-primary', theme.colors.primary);
    root.style.setProperty('--event-secondary', theme.colors.secondary);
    root.style.setProperty('--event-accent', theme.colors.accent);

    // Apply special effects
    theme.specialEffects.forEach(effect => {
      document.body.classList.add(`event-effect-${effect}`);
    });

    window.dispatchEvent(new CustomEvent('event:theme_applied', {
      detail: { eventId, theme }
    }));
  }

  removeEventTheme(eventId: string): void {
    const event = this.events.get(eventId);
    if (!event) return;

    const theme = event.theme;
    
    // Remove special effects
    theme.specialEffects.forEach(effect => {
      document.body.classList.remove(`event-effect-${effect}`);
    });

    window.dispatchEvent(new CustomEvent('event:theme_removed', {
      detail: { eventId }
    }));
  }

  // Tournament bracket generation
  generateBracket(tournamentId: string): void {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    const participants = tournament.currentParticipants;
    const rounds = Math.ceil(Math.log2(participants));
    
    tournament.bracket.rounds = [];
    
    for (let i = 0; i < rounds; i++) {
      const matchesInRound = Math.max(1, Math.floor(participants / Math.pow(2, i + 1)));
      const round: TournamentRound = {
        number: i + 1,
        matches: [],
        status: i === 0 ? 'pending' : 'pending'
      };

      for (let j = 0; j < matchesInRound; j++) {
        round.matches.push({
          id: `match_${i}_${j}`,
          player1Id: '',
          player1Name: 'TBD',
          player2Id: '',
          player2Name: 'TBD',
          score1: 0,
          score2: 0,
          status: 'pending',
          scheduledTime: tournament.startTime + (i * 3600000) // Each round starts 1 hour later
        });
      }

      tournament.bracket.rounds.push(round);
    }

    tournament.bracket.currentRound = 0;
    this.saveLocalData();
  }

  // Reset
  resetData(): void {
    this.tournaments.clear();
    this.events.clear();
    this.currentTournament = null;
    this.currentEvent = null;
    this.tournamentHistory = [];
    this.eventHistory = [];
    this.saveLocalData();
  }
}

// Singleton instance
export const tournamentSystem = new TournamentSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.tournamentSystem = tournamentSystem;
}

export default tournamentSystem;
