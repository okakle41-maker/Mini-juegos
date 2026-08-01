# Architecture Documentation

Documentación de arquitectura del proyecto Minijuegos — Entrenador de Bots.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Module Structure](#module-structure)
4. [Data Flow](#data-flow)
5. [Component Diagrams](#component-diagrams)
6. [Sequence Diagrams](#sequence-diagrams)
7. [Deployment Architecture](#deployment-architecture)
8. [Design Patterns](#design-patterns)

---

## Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   UI Layer   │  │  Game Layer  │  │  Data Layer  │      │
│  │  (Views)     │  │  (Logic)     │  │  (Storage)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │ Core Layer   │                          │
│                    │ (Registry,   │                          │
│                    │  Manager)    │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

- **Modular Design**: Each game is an independent module
- **Lazy Loading**: Game logic loads only when needed
- **Event-Driven**: Communication via custom events
- **Type Safety**: TypeScript strict mode
- **Performance First**: Optimizations for low-end devices

---

## System Architecture

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Lobby      │  │   Game UI    │  │   Sidebar    │      │
│  │   Renderer   │  │   Templates  │  │   Views      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │GameRegistry  │  │ViewManager   │  │  Managers    │      │
│  │  (Registry)  │  │ (Navigation) │  │ (State)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Business Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Game Logic   │  │  Game State  │  │  Game Rules  │      │
│  │  (26 Games)  │  │  (Scoring)   │  │ (Validation) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │localStorage  │  │  Supabase    │  │  IndexedDB   │      │
│  │ (Offline)     │  │ (Online)     │  │ (Cache)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

### Directory Structure

```
minijuegos-entrenador-bots/
├── js/
│   ├── core/                    # Core abstractions
│   │   ├── gameRegistry.ts      # Game registration system
│   │   ├── gameInstanceRegistry.ts
│   │   ├── viewManager.ts       # Navigation manager
│   │   ├── safeStorage.ts       # localStorage wrapper
│   │   ├── errorLogger.ts       # Error logging
│   │   └── supabaseClient.ts    # Supabase integration
│   ├── games/                   # Game modules
│   │   ├── simon.logic.ts       # Simon Says logic
│   │   ├── termita.logic.ts     # Memory grid logic
│   │   ├── arrowGame.logic.ts   # Reflex game logic
│   │   └── ... (23 more games)
│   ├── managers/                # State managers
│   │   ├── leaderboardManager.ts
│   │   ├── favoritesManager.ts
│   │   ├── audioManager.ts
│   │   └── ...
│   ├── views/                   # View templates
│   ├── types/                   # TypeScript types
│   ├── security.ts              # Security utilities
│   ├── accessibility.ts         # ARIA utilities
│   ├── performance.ts           # Performance optimizations
│   ├── errorTracking.ts        # Error monitoring
│   ├── devTools.ts             # Developer tools
│   ├── gameOptimizations.ts    # Game-specific optimizations
│   └── productionMonitoring.ts # Production monitoring
├── css/
│   └── styles.css               # Main stylesheet
├── test/
│   ├── gameRegistryIntegration.test.ts
│   ├── simonGame.test.ts
│   └── ...
├── e2e/
│   ├── lobby.spec.ts            # E2E tests
│   └── accessibility.spec.ts    # Accessibility tests
├── load-test/
│   └── load-test.js            # Load testing with k6
└── .github/workflows/
    └── security-scan.yml        # Security scanning
```

---

## Data Flow

### Game Initialization Flow

```
User Action
    ↓
ViewManager.showView('game-id')
    ↓
GameRegistry.ensureInit('game-id')
    ↓
Load game logic (lazy import)
    ↓
GameRegistry.resolveUi('game-id')
    ↓
Game.init(ui)
    ↓
Game ready for interaction
```

### Game Completion Flow

```
Game completes
    ↓
Calculate score
    ↓
LeaderboardManager.save(gameId, score)
    ↓
localStorage (offline)
    ↓
Supabase (online, if authenticated)
    ↓
UI update with results
    ↓
Return to lobby
```

### Event Flow

```
Component A
    ↓
dispatchEvent(new CustomEvent('game:complete', { detail: score }))
    ↓
Event listener in Component B
    ↓
Handle event
    ↓
Update state/UI
```

---

## Component Diagrams

### Game Registry Component

```
┌─────────────────────────────────────────┐
│           GameRegistry                  │
├─────────────────────────────────────────┤
│ + register(config: GameConfig)          │
│ + visible(): GameConfig[]               │
│ + get(id: string): GameConfig          │
│ + ensureInit(id: string): Promise<void> │
│ + stopGame(id: string): void           │
│ + resolveUi(id: string): GameUi        │
├─────────────────────────────────────────┤
│ - games: Map<string, GameConfig>        │
│ - initialized: Map<string, GameInstance> │
└─────────────────────────────────────────┘
```

### View Manager Component

```
┌─────────────────────────────────────────┐
│           ViewManager                   │
├─────────────────────────────────────────┤
│ + showView(id: string): void           │
│ + hideCurrentView(): void               │
│ + getCurrentView(): string              │
├─────────────────────────────────────────┤
│ - currentView: string                  │
│ - viewCache: Map<string, HTMLElement>  │
└─────────────────────────────────────────┘
```

---

## Sequence Diagrams

### Game Launch Sequence

```
User      LobbyRenderer    ViewManager    GameRegistry    GameLogic
  │             │                │               │            │
  │─click───────>│                │               │            │
  │             │─showView───────>│               │            │
  │             │                │─ensureInit────>│            │
  │             │                │               │─import────>│
  │             │                │               │<──logic───│
  │             │                │               │─init─────>│
  │             │                │               │            │
  │             │                │<──ready───────│            │
  │             │<──render───────│               │            │
  │<──UI────────│                │               │            │
```

### Score Saving Sequence

```
GameLogic  LeaderboardManager  SafeStorage  localStorage  Supabase
    │                │                │              │          │
    │─save───────>    │                │              │          │
    │                │─setJSON───────>│              │          │
    │                │                │─setItem─────>│          │
    │                │                │              │          │
    │                │                │<──success────│          │
    │                │<──success─────│               │          │
    │                │─upload────────>│              │          │
    │                │                │              │─POST────>│
    │                │                │              │<──200───│
    │                │<──success─────│               │          │
    │<──success──────│                │              │          │
```

---

## Deployment Architecture

### PWA Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                      Build Process                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ TypeScript   │  │   Vite       │  │   Terser     │      │
│  │  Compile     │  │   Bundle     │  │  Minify      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   dist/      │                          │
│                    │  (Output)    │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Deployment                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  GitHub Pages│  │   Netlify    │  │   Vercel     │      │
│  │  (Static)     │  │  (CDN)       │  │  (Edge)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Service Worker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Service Worker                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Cache       │  │  Fetch       │  │  Background  │      │
│  │  Strategy     │  │  Handler     │  │  Sync        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Cache Storage                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Static      │  │  Dynamic     │  │  Offline     │      │
│  │  Assets     │  │  Content     │  │  Data        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Patterns

### Registry Pattern

**Purpose**: Centralized game registration

```typescript
class GameRegistry {
  private games: Map<string, GameConfig> = new Map();
  
  register(config: GameConfig): void {
    this.games.set(config.id, config);
  }
  
  get(id: string): GameConfig | undefined {
    return this.games.get(id);
  }
}
```

### Lazy Loading Pattern

**Purpose**: Load game logic only when needed

```typescript
const gameConfig = {
  id: 'my-game',
  logic: () => import('./games/my-game.logic.js')
};

// Logic loads only when ensureInit is called
await GameRegistry.ensureInit('my-game');
```

### Event-Driven Pattern

**Purpose**: Decouple components

```typescript
// Dispatch event
dispatchEvent(new CustomEvent('game:complete', { detail: score }));

// Listen for event
addEventListener('game:complete', (e) => {
  const score = e.detail;
  // Handle completion
});
```

### Singleton Pattern

**Purpose**: Single instance for managers

```typescript
class LeaderboardManager {
  private static instance: LeaderboardManager;
  
  static getInstance(): LeaderboardManager {
    if (!LeaderboardManager.instance) {
      LeaderboardManager.instance = new LeaderboardManager();
    }
    return LeaderboardManager.instance;
  }
}
```

### Factory Pattern

**Purpose**: Create game instances

```typescript
class GameFactory {
  static create(gameId: string): GameInstance {
    const config = GameRegistry.get(gameId);
    const logic = await config.logic();
    return new GameInstance(config, logic);
  }
}
```

### Observer Pattern

**Purpose**: React to state changes

```typescript
class Observable {
  private observers: Set<Observer> = new Set();
  
  subscribe(observer: Observer): void {
    this.observers.add(observer);
  }
  
  notify(data: any): void {
    this.observers.forEach(obs => obs.update(data));
  }
}
```

---

## Performance Considerations

### Multiplayer Split-View Pattern

`js/utils/multiplayerSplitView.ts` exports `setupSplitView(gameId, ui, prefix?, ownBoard?)`, a shared helper any game's `.logic.ts` can call from `init()` to show a live, read-only copy of the opponent's board next to the player's own, when a multiplayer match for that game is active (`multiplayerSystem.getCurrentMatch()`). It broadcasts/receives game events over `multiplayer:game_event` via `multiplayerSystem.sendGameEvent`.

Integration contract for a new game:

1. Template adds a `data-ui="<prefix>Split"` container (`class="hidden"`) wrapping the existing board, plus an empty `data-ui="<prefix>Rival"` mirror target.
2. `.logic.ts` calls `setupSplitView(gameId, ui, prefix, ownBoard)` in `init()`, which returns `{ isMultiplayer, sendEvent, onRivalEvent, remirror, cleanup }`.
3. `sendEvent(type, payload)` is called unconditionally at each emission point (button flash, cell reveal) — it's a no-op when not in a match, so call sites don't need to branch on `isMultiplayer`.
4. `onRivalEvent(type, handler)` registers reception handlers that replay the action onto the rival board (see `findRivalElement`, which matches elements by shared `data-*` attributes since `mirrorBoard` clones markup 1:1).
5. `remirror()` re-clones the player's own board into the rival container — call it every time the board is rebuilt (e.g. `setupSimonBoard`/`setupGrid` on each "Start"), not just once, since board size can change between rounds.
6. `cleanup()` on `stop()`.

Currently wired into Simon and Termita (full mirrored board) and Arrow (summary panel instead of a full mirror, since Arrow's own UI is too visually noisy to clone usefully — only current symbol + combo are shown).

Known limitation: the rival board only has content once the local player has built their own board at least once (mirrored on `remirror()`), not as soon as the opponent starts — in practice this is rarely noticeable since both players reach the game view at roughly the same time via `onRoomUpdate`.

### Code Splitting

- Game logic split into separate chunks
- Lazy loading of non-critical modules
- Dynamic imports for heavy dependencies

### Caching Strategy

- Static assets cached indefinitely
- Dynamic content cached with TTL
- Service Worker for offline support

### Optimization Techniques

- Memoization of expensive calculations
- Debouncing of user input
- Throttling of animations
- Virtual scrolling for large lists

---

## Security Considerations

### Input Validation

- All user inputs sanitized
- XSS prevention with escape functions
- SQL injection prevention (Supabase RLS)

### Data Protection

- Sensitive data encrypted
- Secure storage for credentials
- Rate limiting for API calls

### Authentication

- Supabase Auth for user accounts
- JWT token management
- Session persistence

---

## Accessibility Considerations

### ARIA Attributes

- Proper labels on interactive elements
- Live regions for dynamic content
- Role attributes for semantic meaning

### Keyboard Navigation

- Full keyboard support
- Logical tab order
- Focus indicators

### Screen Reader Support

- Semantic HTML structure
- Descriptive alt text
- Skip links for navigation

---

## Monitoring and Observability

### Error Tracking

- Global error handler
- Error reporting to Sentry
- Contextual error information

### Performance Monitoring

- Core Web Vitals tracking
- Custom metrics logging

---

## v3.0.0 Systems Architecture

### Gamification Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Gamification System                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Points     │  │    Levels    │  │   Missions   │      │
│  │  System      │  │   System     │  │   System     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   Events     │                          │
│                    │   System     │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Notification System

```
┌─────────────────────────────────────────────────────────────┐
│                  Notification System                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Toast      │  │   Stack      │  │   Actions    │      │
│  │  Manager     │  │  Manager     │  │  Handler     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   Events     │                          │
│                    │   Bridge     │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Badge System

```
┌─────────────────────────────────────────────────────────────┐
│                      Badge System                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Badge      │  │   Showcase   │  │   Progress    │      │
│  │  Registry    │  │   Manager    │  │   Tracker    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │  Rarity &    │                          │
│                    │  Category    │                          │
│                    │  System      │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### PWA System

```
┌─────────────────────────────────────────────────────────────┐
│                       PWA System                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Push       │  │  Background  │  │   Offline     │      │
│  │  Notifications│   Sync        │  │   Manager     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   Service    │                          │
│                    │   Worker     │                          │
│                    │   Bridge     │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Accessibility System

```
┌─────────────────────────────────────────────────────────────┐
│                  Accessibility System                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Keyboard   │  │   Screen     │  │   Focus       │      │
│  │  Navigation  │  │   Reader     │  │   Management  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   ARIA       │                          │
│                    │   Live       │                          │
│                    │   Regions    │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Sound System

```
┌─────────────────────────────────────────────────────────────┐
│                    Sound System                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web Audio  │  │   Volume     │  │   Theme       │      │
│  │   API        │  │   Control    │  │   Manager     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   Synthetic  │                          │
│                    │   Sound      │                          │
│                    │   Generator  │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Transition System

```
┌─────────────────────────────────────────────────────────────┐
│                  Transition System                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Fade       │  │   Slide      │  │   Scale       │      │
│  │   Engine     │  │   Engine     │  │   Engine      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   rAF        │                          │
│                    │   Optimized  │                          │
│                    │   Renderer   │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Skeleton Loading System

```
┌─────────────────────────────────────────────────────────────┐
│                  Skeleton System                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Card       │  │   List       │  │   Chart       │      │
│  │   Skeleton   │  │   Skeleton   │  │   Skeleton    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   Shimmer    │                          │
│                    │   Animation  │                          │
│                    │   Engine     │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### System Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Event      │  │   Local      │  │   Global      │      │
│  │   Bus        │  │   Storage    │  │   API        │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   App        │                          │
│                    │   Bootstrap  │                          │
│                    │   Manager    │                          │
│                    └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow v3.0.0

```
User Action → Event Bus → System Manager → Local Storage → UI Update
     ↓              ↓              ↓               ↓            ↓
  Click      Custom Event    Process Data    Save Data    Render
  Play      achievement    Calculate XP    Persist    Toast
  Win       unlocked       Add Points     Badge      Transition
```

### Key Design Decisions v3.0.0

1. **Singleton Pattern**: All systems use singleton pattern for global access
2. **Event-Driven**: Communication via custom events for loose coupling
3. **Lazy Loading**: CSS and logic loaded on-demand for performance
4. **Type Safety**: Full TypeScript coverage with strict mode
5. **Accessibility First**: ARIA attributes and keyboard navigation built-in
6. **Performance Optimized**: Web Audio API, rAF, memoization, debouncing
7. **Offline-First**: Service Worker with background sync
8. **Progressive Enhancement**: Works without accounts, enhanced with accounts
- Performance budgets

### Analytics

- User behavior tracking
- Feature usage statistics
- Performance metrics
