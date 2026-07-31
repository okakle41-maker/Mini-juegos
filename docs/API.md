# API Documentation for Developers

Esta documentación describe las APIs públicas disponibles para desarrolladores que deseen extender o integrar con Minijuegos — Entrenador de Bots.

## Table of Contents

1. [GameRegistry API](#gameregistry-api)
2. [ViewManager API](#viewmanager-api)
3. [SafeStorage API](#safestorage-api)
4. [LeaderboardManager API](#leaderboardmanager-api)
5. [FavoritesManager API](#favoritesmanager-api)
6. [PerformanceMonitor API](#performancemonitor-api)
7. [UISoundEffects API](#uisoundeffects-api)
8. [ConfettiEffect API](#confettieffect-api)
9. [KeyboardShortcuts API](#keyboardshortcuts-api)
10. [PreferencesManager API](#preferencesmanager-api)
11. [NotificationSystem API (v3.0.0)](#notificationsystem-api-v300)
12. [TransitionSystem API (v3.0.0)](#transitionsystem-api-v300)
13. [BadgeSystem API (v3.0.0)](#badgesystem-api-v300)
14. [SoundSystem API (v3.0.0)](#soundsystem-api-v300)
15. [AccessibilitySystem API (v3.0.0)](#accessibilitysystem-api-v300)
16. [PWASystem API (v3.0.0)](#pwasystem-api-v300)
17. [GamificationSystem API (v3.0.0)](#gamificationsystem-api-v300)
18. [SkeletonSystem API (v3.0.0)](#skeletonsystem-api-v300)

---

## GameRegistry API

Registro central de minijuegos. Única fuente de verdad para "qué juegos existen".

### Methods

#### `register(config: GameConfig): void`

Registra un nuevo juego en el sistema.

```typescript
import GameRegistry from './core/gameRegistry.js';

GameRegistry.register({
  id: 'my-game',
  name: 'Mi Juego',
  tag: 'MEMORIA',
  accent: '#ff6600',
  icon: 'my-game.svg',
  num: '27',
  description: 'Descripción del juego',
  difficulty: 2,
  logic: () => import('./games/my-game.logic.js'),
  init: (ui: GameUi) => { /* init logic */ },
  stop: () => { /* cleanup */ }
});
```

**Parameters:**
- `config`: `GameConfig` - Configuración del juego

**GameConfig Interface:**
```typescript
interface GameConfig {
  id: string;              // ID único del juego
  name: string;            // Nombre visible
  tag: string;             // Categoría (MEMORIA, REFLEJOS, etc.)
  accent: string;          // Color de acento (hex)
  icon: string;            // Ruta al ícono
  num: string;             // Número visible en la card
  description: string;     // Descripción corta
  difficulty: number;     // Dificultad (1-5)
  css?: string;           // CSS opcional específico
  hidden?: boolean;       // Si no debe aparecer en el lobby
  logic?: () => Promise<{ init: (ui: GameUi) => void; stop: () => void }>;
  init: (ui: GameUi) => void;
  stop: () => void;
  leaderboard?: { format?: (value: number) => string };
}
```

---

#### `visible(): GameConfig[]`

Retorna todos los juegos visibles (no hidden).

```typescript
const games = GameRegistry.visible();
// Returns: GameConfig[]
```

---

#### `all(): GameConfig[]`

Retorna todos los juegos registrados (incluyendo hidden).

```typescript
const allGames = GameRegistry.all();
// Returns: GameConfig[]
```

---

#### `get(id: string): GameConfig | undefined`

Retorna un juego específico por ID.

```typescript
const game = GameRegistry.get('termita');
// Returns: GameConfig | undefined
```

---

#### `ensureInit(id: string): Promise<void>`

Inicializa un juego (resuelve logic, inyecta CSS, llama init). Cachea el resultado.

```typescript
await GameRegistry.ensureInit('termita');
```

---

#### `stopGame(id: string): void`

Detiene un juego activo (llama stop function).

```typescript
GameRegistry.stopGame('termita');
```

---

#### `resolveUi(id: string): GameUi`

Resuelve todos los elementos con `data-ui` de una vista.

```typescript
const ui = GameRegistry.resolveUi('termita');
// Returns: { grid: HTMLElement, score: HTMLElement, ... }
```

---

#### `injectCSS(href: string | null | undefined): void`

Injeta CSS específico de un juego.

```typescript
GameRegistry.injectCSS('css/termita.css');
```

---

## ViewManager API

Maneja la navegación entre secciones y lazy-loading de vistas.

### Methods

#### `showView(id: string): void`

Navega a una vista específica.

```typescript
import { showView } from './core/viewManager.js';

showView('termita');
```

---

#### `hideCurrentView(): void`

Oculta la vista actual.

```typescript
hideCurrentView();
```

---

### Events

#### `view-shown`

Evento disparado cuando una vista se muestra.

```typescript
document.addEventListener('view-shown', (e) => {
  const { id } = e.detail;
  console.log('View shown:', id);
});
```

---

## SafeStorage API

Abstracción robusta sobre localStorage con manejo de errores.

### Methods

#### `getItem<T>(key: string, defaultValue?: T): T | null`

Lee un valor de localStorage con manejo de errores.

```typescript
import SafeStorage from './core/safeStorage.js';

const value = SafeStorage.getItem('my-key', 'default');
// Returns: string | null
```

---

#### `setItem(key: string, value: string): boolean`

Guarda un valor en localStorage con manejo de errores.

```typescript
const success = SafeStorage.setItem('my-key', 'my-value');
// Returns: boolean (true if successful)
```

---

#### `removeItem(key: string): boolean`

Elimina un valor de localStorage.

```typescript
const success = SafeStorage.removeItem('my-key');
// Returns: boolean (true if successful)
```

---

#### `getJSON<T>(key: string, defaultValue?: T): T | null`

Lee y parsea un JSON de localStorage.

```typescript
const data = SafeStorage.getJSON('my-data', { count: 0 });
// Returns: T | null
```

---

#### `setJSON(key: string, value: any): boolean`

Stringifica y guarda un objeto en localStorage.

```typescript
const success = SafeStorage.setJSON('my-data', { count: 5 });
// Returns: boolean (true if successful)
```

---

## LeaderboardManager API

Maneja récords por juego.

### Methods

#### `save(gameKey: string, value: number, total?: number, meta?: any): void`

Guarda un récord para un juego.

```typescript
import leaderboardManager from './leaderboardManager.js';

leaderboardManager.save('termita', 100, 10, { rounds: 10 });
```

---

#### `get(gameKey: string): LeaderboardEntry | null`

Retorna el mejor récord de un juego.

```typescript
const record = leaderboardManager.get('termita');
// Returns: { value: number, timestamp: number, meta?: any } | null
```

---

#### `getAll(): Record<string, LeaderboardEntry>`

Retorna todos los récords.

```typescript
const allRecords = leaderboardManager.getAll();
// Returns: Record<string, LeaderboardEntry>
```

---

#### `clear(): void`

Elimina todos los récords.

```typescript
leaderboardManager.clear();
```

---

### Events

#### `leaderboard:updated`

Evento disparado cuando se guarda un récord.

```typescript
window.addEventListener('leaderboard:updated', (e) => {
  const { gameKey, entry } = e.detail;
  console.log('Leaderboard updated:', gameKey, entry);
});
```

---

## FavoritesManager API

Maneja juegos favoritos.

### Methods

#### `toggle(gameId: string): void`

Agrega o elimina un juego de favoritos.

```typescript
import favoritesManager from './favoritesManager.js';

favoritesManager.toggle('termita');
```

---

#### `isFavorite(gameId: string): boolean`

Verifica si un juego es favorito.

```typescript
const isFav = favoritesManager.isFavorite('termita');
// Returns: boolean
```

---

#### `getAll(): Set<string>`

Retorna todos los IDs de juegos favoritos.

```typescript
const favorites = favoritesManager.getAll();
// Returns: Set<string>
```

---

#### `clear(): void`

Elimina todos los favoritos.

```typescript
favoritesManager.clear();
```

---

## PerformanceMonitor API

Monitorea Core Web Vitals y métricas de rendimiento.

### Methods

#### `getMetrics(): Metric[]`

Retorna todas las métricas recolectadas.

```typescript
import performanceMonitor from './performanceMonitor.js';

const metrics = performanceMonitor.getMetrics();
// Returns: Metric[]
```

---

#### `getCoreWebVitals(): { lcp: Metric | null; fid: Metric | null; cls: Metric | null }`

Retorna las Core Web Vitals principales.

```typescript
const vitals = performanceMonitor.getCoreWebVitals();
// Returns: { lcp, fid, cls }
```

---

#### `getReport(): PerformanceReport`

Retorna un reporte completo.

```typescript
const report = performanceMonitor.getReport();
// Returns: { metrics, url, userAgent, timestamp }
```

---

#### `exportReport(): string`

Exporta el reporte como JSON string.

```typescript
const jsonReport = performanceMonitor.exportReport();
// Returns: string
```

---

#### `clear(): void`

Limpia todas las métricas recolectadas.

```typescript
performanceMonitor.clear();
```

---

### Global Helpers

Disponibles en `window` para debugging:

```javascript
// En consola del navegador
window.getWebVitals();        // Retorna Core Web Vitals
window.exportPerformanceReport(); // Exporta reporte JSON
```

---

## UISoundEffects API

Sistema de efectos de sonido para interacciones de UI.

### Methods

#### `click(): void`

Reproduce sonido de click.

```typescript
import uiSoundEffects from './uiSoundEffects.js';

uiSoundEffects.click();
```

---

#### `hover(): void`

Reproduce sonido de hover.

```typescript
uiSoundEffects.hover();
```

---

#### `success(): void`

Reproduce sonido de éxito.

```typescript
uiSoundEffects.success();
```

---

#### `error(): void`

Reproduce sonido de error.

```typescript
uiSoundEffects.error();
```

---

#### `notification(): void`

Reproduce sonido de notificación.

```typescript
uiSoundEffects.notification();
```

---

#### `filter(): void`

Reproduce sonido de filtro.

```typescript
uiSoundEffects.filter();
```

---

#### `type(): void`

Reproduce sonido de tipeo.

```typescript
uiSoundEffects.type();
```

---

#### `enable(): void`

Habilita efectos de sonido.

```typescript
uiSoundEffects.enable();
```

---

#### `disable(): void`

Deshabilita efectos de sonido.

```typescript
uiSoundEffects.disable();
```

---

#### `setVolume(volume: number): void`

Establece volumen (0-1).

```typescript
uiSoundEffects.setVolume(0.5);
```

---

#### `getVolume(): number`

Retorna el volumen actual.

```typescript
const volume = uiSoundEffects.getVolume();
// Returns: number (0-1)
```

---

## ConfettiEffect API

Sistema de efectos de confetti para celebraciones.

### Methods

#### `celebrate(): void`

Dispara una celebración completa con múltiples explosiones.

```typescript
import confettiEffect from './confettiEffect.js';

confettiEffect.celebrate();
```

---

#### `burst(x: number, y: number, count?: number): void`

Dispara una explosión de confetti en una posición específica.

```typescript
confettiEffect.burst(500, 300, 50);
```

---

#### `clear(): void`

Limpia todas las partículas de confetti.

```typescript
confettiEffect.clear();
```

---

#### `destroy(): void`

Destruye el sistema de confetti (canvas y listeners).

```typescript
confettiEffect.destroy();
```

---

### Helper Functions

```typescript
import { triggerConfetti, triggerConfettiBurst } from './confettiEffect.js';

triggerConfetti();              // Celebración completa
triggerConfettiBurst(x, y, 50); // Explosión específica
```

---

## KeyboardShortcuts API

Sistema de atajos de teclado globales.

### Methods

#### `register(shortcut: string, callback: () => void, description?: string): void`

Registra un nuevo atajo de teclado.

```typescript
import keyboardShortcuts from './keyboardShortcuts.js';

keyboardShortcuts.register('Ctrl+K', () => {
  console.log('Search focused');
}, 'Foco en búsqueda');
```

---

#### `unregister(shortcut: string): void`

Elimina un atajo registrado.

```typescript
keyboardShortcuts.unregister('Ctrl+K');
```

---

#### `getHelp(): Shortcut[]`

Retorna todos los atajos registrados.

```typescript
const shortcuts = keyboardShortcuts.getHelp();
// Returns: Shortcut[]
```

---

#### `showHelp(): void`

Muestra el modal de ayuda de atajos.

```typescript
keyboardShortcuts.showHelp();
```

---

### Default Shortcuts

- `Ctrl/Cmd + K`: Foco en búsqueda
- `Escape`: Cerrar vista actual / volver al lobby
- `Ctrl/Cmd + /`: Mostrar ayuda de atajos
- `Ctrl/Cmd + N`: Navegar a siguiente sección
- `Ctrl/Cmd + P`: Navegar a sección anterior

---

## PreferencesManager API

Sistema de persistencia de preferencias de usuario.

### Methods

#### `set(key: string, value: any): void`

Guarda una preferencia.

```typescript
import preferencesManager from './preferencesManager.js';

preferencesManager.set('theme', 'dark');
preferencesManager.set('reducedMotion', true);
```

---

#### `get<T>(key: string, defaultValue?: T): T | null`

Lee una preferencia.

```typescript
const theme = preferencesManager.get('theme', 'dark');
// Returns: string | null
```

---

#### `remove(key: string): void`

Elimina una preferencia.

```typescript
preferencesManager.remove('theme');
```

---

#### `clear(): void`

Elimina todas las preferencias.

```typescript
preferencesManager.clear();
```

---

### Default Preferences

- `theme`: 'dark' | 'neon' | 'ocean'
- `reducedMotion`: boolean
- `highContrast`: boolean
- `musicVolume`: number (0-1)
- `sfxVolume`: number (0-1)
- `sidebarCollapsed`: boolean

---

## Type Definitions

### GameUi

Objeto plano con elementos DOM resueltos por `data-ui`.

```typescript
interface GameUi {
  [key: string]: HTMLElement | undefined;
}
```

---

### Metric

Métrica de rendimiento.

```typescript
interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}
```

---

### LeaderboardEntry

Entrada de leaderboard.

```typescript
interface LeaderboardEntry {
  value: number;
  timestamp: number;
  meta?: {
    total?: number;
    [key: string]: any;
  };
}
```

---

### Shortcut

Atajo de teclado.

```typescript
interface Shortcut {
  shortcut: string;
  description: string;
  callback: () => void;
}
```

---

## NotificationSystem API (v3.0.0)

Sistema de notificaciones toast con múltiples tipos y configuraciones.

### Methods

#### `success(title: string, message: string, options?: NotificationOptions): void`

Muestra una notificación de éxito.

```typescript
import { notificationSystem } from './notificationSystem.js';

notificationSystem.success('¡Logro desbloqueado!', 'Has completado tu primera partida');
```

#### `error(title: string, message: string, options?: NotificationOptions): void`

Muestra una notificación de error.

```typescript
notificationSystem.error('Error', 'No se pudo conectar al servidor');
```

#### `warning(title: string, message: string, options?: NotificationOptions): void`

Muestra una notificación de advertencia.

```typescript
notificationSystem.warning('Atención', 'Tu sesión está por expirar');
```

#### `info(title: string, message: string, options?: NotificationOptions): void`

Muestra una notificación informativa.

```typescript
notificationSystem.info('Información', 'Nuevos eventos disponibles');
```

#### `achievement(title: string, message: string, options?: NotificationOptions): void`

Muestra una notificación de logro con estilo especial.

```typescript
notificationSystem.achievement('🏆 Maestro', 'Has alcanzado el nivel 10');
```

---

## TransitionSystem API (v3.0.0)

Sistema de transiciones animadas entre vistas.

### Methods

#### `transition(fromView: HTMLElement, toView: HTMLElement, config?: TransitionConfig): Promise<void>`

Ejecuta una transición entre dos vistas.

```typescript
import { transitionSystem } from './transitionSystem.js';

await transitionSystem.transition(fromView, toView, {
  type: 'fade',
  duration: 300,
  easing: 'ease-in-out'
});
```

#### `setDefaultConfig(config: TransitionConfig): void`

Establece la configuración por defecto para todas las transiciones.

```typescript
transitionSystem.setDefaultConfig({
  type: 'slide',
  direction: 'right',
  duration: 250
});
```

---

## BadgeSystem API (v3.0.0)

Sistema de badges/insignias con rarezas y categorías.

### Methods

#### `unlockBadge(badgeId: string): boolean`

Desbloquea un badge específico.

```typescript
import { badgeSystem } from './badgesSystem.js';

badgeSystem.unlockBadge('first_win');
```

#### `getBadge(badgeId: string): Badge | undefined`

Obtiene información de un badge específico.

```typescript
const badge = badgeSystem.getBadge('first_win');
console.log(badge?.name, badge?.rarity);
```

#### `getAllBadges(): Badge[]`

Obtiene todos los badges disponibles.

```typescript
const allBadges = badgeSystem.getAllBadges();
```

#### `getUnlockedBadges(): Badge[]`

Obtiene solo los badges desbloqueados.

```typescript
const unlockedBadges = badgeSystem.getUnlockedBadges();
```

#### `addToShowcase(badgeId: string): boolean`

Agrega un badge al showcase del perfil.

```typescript
badgeSystem.addToShowcase('first_win');
```

#### `getCollectionStats(): CollectionStats`

Obtiene estadísticas completas de la colección.

```typescript
const stats = badgeSystem.getCollectionStats();
console.log(stats.total, stats.unlocked, stats.percentage);
```

---

## SoundSystem API (v3.0.0)

Sistema de efectos de sonido sintéticos con Web Audio API.

### Methods

#### `playSound(type: SoundType, category: SoundCategory): void`

Reproduce un efecto de sonido.

```typescript
import { soundSystem } from './soundSystem.js';

soundSystem.playSound('click', 'ui');
soundSystem.playSound('achievement', 'achievement');
```

#### `setEnabled(enabled: boolean): void`

Activa o desactiva el sistema de sonido.

```typescript
soundSystem.setEnabled(true);
```

#### `setMasterVolume(volume: number): void`

Establece el volumen maestro (0-1).

```typescript
soundSystem.setMasterVolume(0.7);
```

#### `setCategoryVolume(category: SoundCategory, volume: number): void`

Establece el volumen de una categoría específica.

```typescript
soundSystem.setCategoryVolume('ui', 0.8);
soundSystem.setCategoryVolume('game', 0.6);
```

---

## AccessibilitySystem API (v3.0.0)

Sistema de accesibilidad mejorado con soporte para lectores de pantalla.

### Methods

#### `setContrastMode(mode: ContrastMode): void`

Establece el modo de contraste.

```typescript
import { accessibilitySystem } from './accessibilitySystem.js';

accessibilitySystem.setContrastMode('high');
```

#### `setTextSize(size: TextSize): void`

Establece el tamaño de texto.

```typescript
accessibilitySystem.setTextSize('large');
```

#### `setColorBlindnessMode(mode: ColorBlindnessMode): void`

Establece el modo de daltonismo.

```typescript
accessibilitySystem.setColorBlindnessMode('protanopia');
```

#### `announce(message: string, priority: 'polite' | 'assertive'): void`

Anuncia un mensaje para lectores de pantalla.

```typescript
accessibilitySystem.announce('Logro desbloqueado', 'assertive');
```

#### `trapFocus(element: HTMLElement): void`

Trampa el foco dentro de un elemento (para modales).

```typescript
accessibilitySystem.trapFocus(modalElement);
```

#### `applyHighContrastPreset(): void`

Aplica el preset de alto contraste.

```typescript
accessibilitySystem.applyHighContrastPreset();
```

---

## PWASystem API (v3.0.0)

Sistema de PWA con push notifications y offline support.

### Methods

#### `setupPushNotifications(): Promise<boolean>`

Configura las notificaciones push.

```typescript
import { pwaSystem } from './pwaSystem.js';

await pwaSystem.setupPushNotifications();
```

#### `sendLocalNotification(title: string, options: NotificationOptions): Promise<void>`

Envía una notificación local.

```typescript
await pwaSystem.sendLocalNotification('¡Hola!', {
  body: 'Tienes nuevos logros',
  icon: '/assets/icon-192.png'
});
```

#### `queueSync(url: string, data: any): Promise<void>`

Agrega datos a la cola de sincronización offline.

```typescript
await pwaSystem.queueSync('/api/scores', { score: 100 });
```

#### `promptInstall(): Promise<boolean>`

Muestra el prompt de instalación de la PWA.

```typescript
const installed = await pwaSystem.promptInstall();
```

#### `isOnline(): boolean`

Verifica si hay conexión a internet.

```typescript
const online = pwaSystem.isOnline();
```

---

## GamificationSystem API (v3.0.0)

Sistema de gamificación con puntos, niveles y misiones.

### Methods

#### `addGlobalPoints(points: number): void`

Agrega puntos globales al usuario.

```typescript
import { gamificationSystem } from './gamificationSystem.js';

gamificationSystem.addGlobalPoints(100);
```

#### `addXP(xp: number): void`

Agrega XP al usuario (puede subir de nivel).

```typescript
gamificationSystem.addXP(50);
```

#### `getLevel(): UserLevel`

Obtiene información del nivel actual.

```typescript
const level = gamificationSystem.getLevel();
console.log(level.level, level.xp, level.title);
```

#### `updateMissionProgress(type: MissionType, amount: number): void`

Actualiza el progreso de misiones.

```typescript
gamificationSystem.updateMissionProgress('games', 1);
gamificationSystem.updateMissionProgress('score', 500);
```

#### `getWeeklyMissions(): WeeklyMission[]`

Obtiene las misiones semanales activas.

```typescript
const missions = gamificationSystem.getWeeklyMissions();
```

#### `getActiveEvents(): TemporaryEvent[]`

Obtiene los eventos temporales activos.

```typescript
const events = gamificationSystem.getActiveEvents();
```

#### `getStats(): GamificationStats`

Obtiene estadísticas completas de gamificación.

```typescript
const stats = gamificationSystem.getStats();
console.log(stats.totalPoints, stats.currentLevel);
```

---

## SkeletonSystem API (v3.0.0)

Sistema de skeleton loading para contenido asíncrono.

### Methods

#### `showSkeleton(containerId: string, config: SkeletonConfig): void`

Muestra un skeleton en un contenedor.

```typescript
import { skeletonSystem } from './skeletonSystem.js';

skeletonSystem.showSkeleton('achievements-container', {
  type: 'card',
  count: 6,
  shimmer: true
});
```

#### `hideSkeleton(containerId: string, content?: string): void`

Oculta el skeleton y muestra el contenido.

```typescript
skeletonSystem.hideSkeleton('achievements-container', actualContent);
```

#### `withSkeleton<T>(containerId: string, config: SkeletonConfig, asyncOperation: () => Promise<T>): Promise<T>`

Ejecuta una operación asíncrona con skeleton loading.

```typescript
const data = await skeletonSystem.withSkeleton('data-container', 
  { type: 'list', count: 10 },
  async () => await fetchData()
);
```

#### `getAchievementsSkeleton(): string`

Obtiene el HTML predefinido para skeleton de logros.

```typescript
const skeletonHTML = skeletonSystem.getAchievementsSkeleton();
```

#### `getProfileSkeleton(): string`

Obtiene el HTML predefinido para skeleton de perfil.

```typescript
const skeletonHTML = skeletonSystem.getProfileSkeleton();
```

---

## Usage Examples

### Creating a New Game

```typescript
// 1. Register the game
import GameRegistry from './core/gameRegistry.js';

GameRegistry.register({
  id: 'my-game',
  name: 'Mi Juego',
  tag: 'MEMORIA',
  accent: '#ff6600',
  icon: 'my-game.svg',
  num: '27',
  description: 'Juego de memoria personalizado',
  difficulty: 2,
  logic: () => import('./games/my-game.logic.js'),
  init: (ui: GameUi) => {
    // Game initialization logic
    console.log('Game initialized', ui);
  },
  stop: () => {
    // Cleanup logic
    console.log('Game stopped');
  }
});

// 2. Create the logic file (my-game.logic.ts)
export function init(ui: GameUi) {
  const grid = ui.grid as HTMLElement;
  const score = ui.score as HTMLElement;
  
  // Game logic here
  
  return () => {
    // Cleanup
  };
}

export function stop() {
  // Additional cleanup if needed
}
```

---

### Using Performance Monitoring

```typescript
import performanceMonitor from './performanceMonitor.js';

// Get Core Web Vitals
const vitals = performanceMonitor.getCoreWebVitals();
console.log('LCP:', vitals.lcp?.value);
console.log('FID:', vitals.fid?.value);
console.log('CLS:', vitals.cls?.value);

// Export report for analysis
const report = performanceMonitor.exportReport();
console.log(report);
```

---

### Custom Keyboard Shortcuts

```typescript
import keyboardShortcuts from './keyboardShortcuts.js';

// Register custom shortcut
keyboardShortcuts.register('Ctrl+Shift+M', () => {
  preferencesManager.set('musicVolume', 0);
}, 'Silenciar música');

// Show help modal
keyboardShortcuts.showHelp();
```

---

## Best Practices

1. **Always use SafeStorage** instead of localStorage directly
2. **Register games with logic** for lazy-loading
3. **Use data-ui attributes** for game elements
4. **Handle errors gracefully** with try-catch
5. **Clean up resources** in stop functions
6. **Use events for cross-module communication**
7. **Test with different screen sizes** and devices
8. **Follow TypeScript strict mode** guidelines

---

## Support

For questions or issues:
- Open an issue on GitHub
- Check the main README.md
- Review CONTRIBUTING.md for contribution guidelines
