# 🎮 Guía de Integración de Minijuegos

> **Propósito**: Este documento explica **exactamente** cómo agregar un minijuego nuevo al proyecto.
> Está pensado para que **una IA (o un desarrollador) genere el código en una carpeta aparte** y luego
> lo copie/aplique al proyecto principal siguiendo los pasos aquí indicados.

---

## 📋 Tabla de Contenidos

1. [Arquitectura del Sistema (Cómo funciona un juego)](#1-arquitectura-del-sistema)
2. [Estructura de Archivos que necesita un Juego](#2-estructura-de-archivos)
3. [Paso 1: Crear el archivo de vista (html)](#3-paso-1-vista-del-juego)
4. [Paso 2: Crear el archivo de metadatos + registro](#4-paso-2-archivo-de-metadatos)
5. [Paso 3: Crear el archivo de lógica](#5-paso-3-archivo-de-logica)
6. [Paso 4: Registrar en el barrel `js/games/index.ts`](#6-paso-4-registrar-en-el-barrel)
7. [Paso 5: Registrar en `js/core/viewTemplates.ts`](#7-paso-5-registrar-en-viewtemplates)
8. [Paso 6: Crear la sección en `index.html`](#8-paso-6-crear-la-seccion-en-indexhtml)
9. [Paso 7: Agregar ícono en `js/core/gameIcons.ts`](#9-paso-7-agregar-icono)
10. [Paso 8: Crear el CSS del juego](#10-paso-8-crear-el-css)
11. [Paso 9: Guardar la puntuación (Leaderboard)](#11-paso-9-guardar-puntuacion)
12. [Paso 10: Usar sonidos](#12-paso-10-usar-sonidos)
13. [Integración con Multiplayer](#13-integracion-multiplayer)
14. [Checklist Final de Integración](#14-checklist-final)
15. [Resolución de Problemas (Troubleshooting)](#15-troubleshooting)

---

## 1. Arquitectura del Sistema (Cómo funciona un juego)

Cada minijuego sigue un patrón de **3 archivos + 4 registros**:

```
┌─────────────────────────────────────────────────────────────────┐
│                         FLUJO DE CARGA                           │
│                                                                  │
│  1. index.html define la sección:                                │
│     <section id="mi-juego" class="view hidden" data-lazy="1">    │
│                                                                  │
│  2. Usuario hace click en la card del lobby                      │
│     → LobbyRenderer → ViewManager.showView('mi-juego')           │
│                                                                  │
│  3. ViewManager trae el template (HTML) vía import() dinámico    │
│     → js/views/mi-juego.ts → inyecta el HTML en la sección       │
│                                                                  │
│  4. ViewManager llama GameRegistry.ensureInit('mi-juego')        │
│     → import() dinámico del archivo de lógica                    │
│     → resolveUi() recolecta los elementos data-ui                │
│     → injectCSS() carga el CSS del juego                         │
│     → init(ui) se ejecuta                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Flujo detallado de inicialización:**

```
Usuario hace click
    ↓
ViewManager.showView('mi-juego')
    ↓  (si la sección tiene data-lazy)
ViewManager.loadLazyView() → import() de js/views/mi-juego.ts → inyecta HTML
    ↓
GameRegistry.ensureInit('mi-juego')
    ↓  (si el juego tiene `logic`)
import() dinámico de js/games/mi-juego.logic.ts
    ↓
GameRegistry.resolveUi('mi-juego') → recolecta [data-ui] → GameUi
    ↓
GameRegistry.injectCSS(css) → carga css/mi-juego.css
    ↓
init(ui) → se ejecuta la lógica del juego
```

---

## 2. Estructura de Archivos

Un minijuego completo requiere estos **7 archivos/puntos de contacto**:

| # | Archivo / Ubicación | Propósito |
|---|---------------------|-----------|
| 1 | `js/views/<mi-juego>.ts` | Template HTML (marcado de la vista) |
| 2 | `js/games/<mi-juego>.ts` | Metadatos + registro en GameRegistry |
| 3 | `js/games/<mi-juego>.logic.ts` | Lógica del juego (init/stop) |
| 4 | `js/games/index.ts` | Barrel: exporta el juego y dispara el registro |
| 5 | `js/core/viewTemplates.ts` | Registra el loader del template de vista |
| 6 | `index.html` | Sección `<section id="mi-juego" ...>` |
| 7 | `css/<mi-juego>.css` | Estilos del juego |
| 8 | `js/core/gameIcons.ts` (opcional) | Ícono SVG para la card del lobby |

---

## 3. Paso 1: Vista del Juego (html)

**Archivo**: `js/views/<mi-juego>.ts`

**Estructura obligatoria**:

```typescript
/**
 * js/views/<mi-juego>.ts
 *
 * Template de la vista "<Mi Juego>".
 * Devuelve el markup HTML de la vista como string.
 * ViewManager lo inyecta vía innerHTML tras el import() dinámico.
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
    <div class="game-view-inner">
      <button class="back-btn" data-back-to="home"></button>
      <div class="card">
        <h2>Mi Juego</h2>
        <p>Descripción corta del juego.</p>

        <!-- Elementos interactivos con data-ui -->
        <button data-ui="start" class="start-btn">▶ Iniciar</button>
        <div data-ui="board" class="board"></div>
        <div data-ui="score" class="score">0</div>
        <div data-ui="message" class="message" role="status" aria-live="polite"></div>
      </div>
    </div>
  `;
};

export default template satisfies ViewTemplate;
```

**Reglas de oro del template**:

- ✅ El contenedor raíz debe ser `<div class="game-view-inner">`.
- ✅ Debe incluir el botón de volver: `<button class="back-btn" data-back-to="home"></button>`.
- ✅ Cada elemento que la lógica necesite manipular debe tener `data-ui="<clave>"`.
- ✅ Los elementos de texto/feedback deben tener `aria-live="polite"` y `role="status"` para accesibilidad.
- ✅ Usar `satisfies ViewTemplate` al exportar (mantiene el tipo correcto).

> ⚠️ **NOTA sobre `data-ui-all`**: Si necesitas un grupo de botones (ej. dificultades),
> usa `data-ui-all="<clave>"` en cada uno. `GameRegistry.resolveUi` los agrupa en un
> `NodeList` bajo esa clave. Ejemplo (de pairs.ts):
>
> ```html
> <button class="pairs-diff-btn" data-ui-all="pairsDiffBtns" data-pairs="12">FÁCIL</button>
> <button class="pairs-diff-btn" data-ui-all="pairsDiffBtns" data-pairs="16">MEDIO</button>
> ```
>
> Y en la lógica se accede con:
> ```typescript
> const btns = document.querySelectorAll<HTMLElement>('[data-ui-all="pairsDiffBtns"]');
> ```

---

## 4. Paso 2: Archivo de Metadatos (Registro)

**Archivo**: `js/games/<mi-juego>.ts`

**Estructura obligatoria**:

```typescript
/**
 * js/games/<mi-juego>.ts
 *
 * <Mi Juego> — descripción corta.
 * Migrado al sistema GameRegistry (metadatos + lazy logic).
 * Lógica pesada en <mi-juego>.logic.ts.
 */

import GameRegistry from '../core/gameRegistry.js';
import type { GameConfig } from '../types/game.js';

const gameConfig: GameConfig = {
  id:          'mi-juego',                  // ⚠️ IGUAL al id del <section> en index.html
  name:        'Mi Juego',                  // Nombre mostrado en el lobby
  tag:         'CATEGORÍA',                 // Categoría para el filtro del lobby
  accent:      '#ff0000',                   // Color de acento (hex)
  icon:        '🎮',                        // Emoji legacy (ya no se usa para cards)
  num:         '06',                        // Número de módulo (2 dígitos)
  description: 'Descripción corta que aparece en la card del lobby.',
  difficulty:  2,                           // 1-5 (puntos de dificultad en la card)
  css:         'css/mi-juego.css',          // Ruta del CSS (relativa al proyecto raíz)

  init: () => {
    throw new Error('[mi-juego] init directo no debería llamarse: usar logic()');
  },
  stop: () => {
    throw new Error('[mi-juego] stop directo no debería llamarse: usar logic()');
  },
  logic: () => import('./mi-juego.logic.js'),  // ⚠️ IMPORTANTE: lazy loading
};

GameRegistry.register(gameConfig);

export default gameConfig;
```

**Descripción de cada campo**:

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | `string` | ✅ | Identificador único. **Debe coincidir** con el `id` del `<section>` en `index.html` |
| `name` | `string` | ✅ | Nombre visible en la card del lobby |
| `tag` | `string` | ✅ | Categoría para el filtro. Usar SOLO una de estas: `LÓGICA`, `MEMORIA`, `REFLEJOS`, `TIPEO`, `ESTRATEGIA`, `ANÁLISIS`, `CIFRADO`, `RITMO`, `SECUENCIA`, `PRECISIÓN`, `LABERINTO`, `TIMING` |
| `accent` | `string` | ✅ | Color hexadecimal (ej. `'#fb7185'`) que tiñe la card del lobby |
| `icon` | `string` | ✅ | Emoji legacy (no se usa en cards modernas, pero se mantiene por compatibilidad) |
| `num` | `string` | ✅ | Número de módulo mostrado en la card (ej. `'23'`, `'07'`). Debe ser el **siguiente número disponible** |
| `description` | `string` | ✅ | Texto descriptivo mostrado en la card del lobby |
| `difficulty` | `number` | ✅ | 1-5. Controla los puntos de dificultad en la card |
| `css` | `string` | ⬜ (recomendado) | Ruta del CSS que `GameRegistry.injectCSS` cargará automáticamente |
| `hidden` | `boolean` | ⬜ | Si es `true`, el juego no aparece en el lobby (se puede acceder igual por URL) |
| `online` | `boolean` | ⬜ | Si es `true`, aparece en el "Lobby Online" (solo si el juego tiene soporte multiplayer real) |
| `logic` | `function` | ✅ | **Obligatorio para juegos nuevos** — lazy loading del archivo de lógica |
| `init` / `stop` | `function` | ✅ | Siempre lanzar error (la implementación real vive en el `.logic.ts`) |
| `leaderboard` | `object` | ⬜ | Formato de la puntuación. Ej: `{ format: (v) => `${v} pts` }` |

**Tags válidos** (extraídos de los juegos existentes):

```
LÓGICA · MEMORIA · REFLEJOS · TIPEO · ESTRATEGIA · ANÁLISIS · CIFRADO
RITMO · SECUENCIA · PRECISIÓN · LABERINTO · TIMING
```

**Cómo elegir el número (`num`)**: Enumera los juegos existentes en `js/games/index.ts`.
El nuevo juego debe usar el **siguiente número correlativo** (los existentes van de 01 a 34+).

---

## 5. Paso 3: Archivo de Lógica

**Archivo**: `js/games/<mi-juego>.logic.ts`

**Estructura obligatoria** — el módulo debe exportar `init(ui)` y `stop()`:

```typescript
/**
 * js/games/<mi-juego>.logic.ts
 *
 * Lógica pesada del juego "<Mi Juego>".
 * Se carga bajo demanda vía import() dinámico desde <mi-juego>.ts.
 */

import type { GameUi } from '../types/game.js';
import GameHelpers from '../utils/gameHelpers.js';
import audioManager from '../audioManager.js';
import Leaderboard from '../leaderboardManager.js';

let cleanup: ReturnType<typeof GameHelpers.createCleanupManager> | null = null;

export function init(ui: GameUi) {
  // Desestructurar los elementos UI por su clave data-ui
  const { start, board, score, message } = ui;
  if (!start) return;

  // Cleanup manager centraliza timers y listeners para limpieza segura
  cleanup = GameHelpers.createCleanupManager();

  // ---- Lógica del juego ----
  let gameScore = 0;

  function startGame() {
    cleanup?.cleanup();          // limpiar partida anterior
    gameScore = 0;
    if (score) score.textContent = '0';
    if (message) message.textContent = '';

    // Registrar listeners con cleanup manager
    cleanup.addListener(start, 'click', () => {
      gameScore++;
      if (score) score.textContent = String(gameScore);
      if (audioManager) audioManager.play('click');
    });

    cleanup.addInterval(() => {
      // timer / cuenta regresiva
    }, 1000);
  }

  function endGame(won: boolean) {
    cleanup?.cleanup();
    if (!message) return;

    if (won) {
      message.textContent = '✓ ¡Ganaste!';
      if (audioManager) audioManager.play('perfect');
      // Guardar puntuación en el leaderboard
      Leaderboard.save('mi-juego', gameScore);
    } else {
      message.textContent = '✗ Tiempo agotado';
      if (audioManager) audioManager.play('gameover');
    }
  }

  startGame();
}

export function stop() {
  cleanup?.cleanup();
}
```

**Reglas de oro de la lógica**:

1. **Exportar exactamente** `export function init(ui: GameUi)` y `export function stop()`.
2. **Usar `GameHelpers.createCleanupManager()`** para timers (`addInterval`/`addTimeout`) y listeners (`addListener`). `stop()` debe llamar `cleanup?.cleanup()`.
3. **Acceder a los elementos UI** con la clave de su `data-ui`: `const { start, board } = ui;`.
4. **Guardar puntuación** con `Leaderboard.save('mi-juego', score)` ó `window.Leaderboard.save(...)`.
5. **Sonidos** con `audioManager.play('click' | 'good' | 'perfect' | 'miss' | 'gameover' | 'beep')`.
6. **Si hay elementos extra no cubiertos por `data-ui`** (ej. grupos `data-ui-all`), consultarlos con `document.querySelectorAll('[data-ui-all="<clave>"]')` — ver nota en la sección 3.

---

## 6. Paso 4: Registrar en el Barrel

**Archivo**: `js/games/index.ts`

Agrega el export de tu juego **en el orden en que aparece su número de módulo**:

```typescript
export { default as miJuego } from './mi-juego.js';
```

**Ejemplo** — así se ve el barrel actual (fragmento):

```typescript
export { default as datarecallgrid } from './datarecallgrid.js';
export { default as neuralfragment } from './neuralfragment.js';
export { default as termita } from './termita.js';
// ... etc
export { default as bombdefusal } from './bombdefusal.js';
export { default as reactor } from './reactor.js';
export { default as mechlock } from './mechlock.js';
export { default as virusOverload } from './virusOverload.js';

// ✅ AGREGAR NUEVO JUEGO AQUÍ:
export { default as miJuego } from './mi-juego.js';
```

> ⚠️ **IMPORTANTE**: Este import **dispara** `GameRegistry.register(gameConfig)` como efecto
> secundario (está al final del archivo `<mi-juego>.ts`). No necesitas llamar `register()`
> aquí — solo importar el módulo.

---

## 7. Paso 5: Registrar en viewTemplates

**Archivo**: `js/core/viewTemplates.ts`

Agrega una entrada al objeto `viewTemplates`:

```typescript
export const viewTemplates: Record<string, ViewTemplateLoader> = {
  // ... entradas existentes ...
  'virusOverload': () => import('../views/virusOverload.js'),

  // ✅ AGREGAR NUEVA VISTA AQUÍ:
  'mi-juego': () => import('../views/mi-juego.js'),
};
```

> ⚠️ La **clave** (`'mi-juego'`) debe ser **exactamente igual** al `id` del `<section>`
> en `index.html` y al `id` del `GameConfig`.

---

## 8. Paso 6: Crear la Sección en index.html

**Archivo**: `index.html`

Agrega una sección vacía con **lazy loading** (debe estar dentro del contenedor de vistas):

```html
<!-- ── Mi Juego ───────────────────────────── -->
<section id="mi-juego" class="view hidden" data-lazy="1"></section>
```

**Reglas**:
- El `id` debe coincidir **exactamente** con `GameConfig.id`.
- `class="view hidden"` es obligatorio (sistema de navegación de ViewManager).
- `data-lazy="1"` es obligatorio (le indica a ViewManager que cargue el template con import() dinámico).

---

## 9. Paso 7: Agregar Ícono (Opcional pero recomendado)

**Archivo**: `js/core/gameIcons.ts`

Agrega un SVG monolínea (viewBox 0 0 24 24) bajo la clave de tu `id`:

```typescript
const ICONS: Record<string, string> = {
  // ... íconos existentes ...

  // MI JUEGO — descripción breve del ícono
  'mi-juego': svg(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 7v5l3.5 2"/>'
  ),
};
```

**Reglas del SVG**:
- `viewBox="0 0 24 24"`.
- `fill="none"`, `stroke="currentColor"`, `stroke-width="1.6"`.
- `stroke-linecap="round"` y `stroke-linejoin="round"`.
- Estilo monolínea (una sola línea de trazo, sin rellenos planos excepto detalles puntuales con `fill="currentColor" stroke="none"`).

> ⚠️ **FALLBACK**: Si no agregas ícono, el lobby usa un gamepad genérico
> (`ICON_FALLBACK_SVG` en `lobbyRenderer.ts`). El juego funciona igual, pero
> se ve menos polido en el lobby.

---

## 10. Paso 8: Crear el CSS del Juego

**Archivo**: `css/<mi-juego>.css`

Crea estilos con prefijo del juego para evitar colisiones:

```css
/* ============================================
   <Mi Juego> — estilos
   Prefijo: mj- (mi-juego)
   ============================================ */

.mj-board {
  display: grid;
  gap: 8px;
  padding: 16px;
}

.mj-cell {
  aspect-ratio: 1;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.mj-cell:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(1.04);
}

.mj-cell--active {
  background: var(--accent, #ff0000);
}

.mj-message {
  text-align: center;
  padding: 12px;
  font-weight: 700;
  min-height: 1.5em;
}

.mj-message--win { color: #4ade80; }
.mj-message--fail { color: #f43f5e; }
```

**Reglas del CSS**:
- ✅ Prefijar todas las clases con la inicial del juego (`mj-`, `pairs-`, `maze-`, etc.).
- ✅ Usar `var(--accent, #fallback)` cuando quieras heredar el color de acento del juego.
- ✅ Añadir estados `--active`, `--win`, `--fail`, etc.
- ✅ Incluir responsive: `@media (max-width: 600px)` para pantallas pequeñas.

---

## 11. Paso 9: Guardar la Puntuación (Leaderboard)

Cuando el juego termina, guarda el récord:

```typescript
import Leaderboard from '../leaderboardManager.js';

// En la lógica:
Leaderboard.save('mi-juego', gameScore);
// Con total (opcional, ej. "8 de 20 rondas"):
Leaderboard.save('mi-juego', gameScore, totalRounds);
// Con meta adicional:
Leaderboard.save('mi-juego', gameScore, totalRounds, { extra: 'info' });
```

También funciona vía global (compatibilidad legacy):

```typescript
window.Leaderboard.save('mi-juego', score);
```

**Formato personalizado** (en `<mi-juego>.ts`, dentro del `GameConfig`):

```typescript
const gameConfig: GameConfig = {
  // ...
  leaderboard: {
    format: (v: number) => `${v} pts`,
  },
};
```

Esto conecta automáticamente con `LeaderboardManager.setConfig` (lo hace
`GameRegistry.register` internamente), así los badges de récord del lobby
muestran "⬡ 123 pts" en vez de "⬡ 123".

---

## 12. Paso 10: Usar Sonidos

Los sonidos se generan con Web Audio API (no archivos MP3). Importa el manager:

```typescript
import audioManager from '../audioManager.js';

audioManager.play('click');     // 300Hz — feedback general/click
audioManager.play('good');      // 600Hz — acierto
audioManager.play('perfect');   // 800Hz — victoria perfecta
audioManager.play('miss');      // 200Hz — fallo
audioManager.play('beep');      // 900Hz — beep de sistema
audioManager.play('gameover');  // 150Hz — derrota
audioManager.play('open');      // 500Hz — apertura
audioManager.play('tone1');     // 262Hz — escala ascendente (Simon/Sequence)
audioManager.play('tone2');     // 294Hz
audioManager.play('tone3');     // 330Hz
audioManager.play('tone4');     // 349Hz
audioManager.play('tone5');     // 392Hz
audioManager.play('tone6');     // 440Hz
audioManager.play('tone7');     // 494Hz
audioManager.play('tone8');     // 523Hz
audioManager.play('key1');      // 350Hz — mash de teclas (KeySpam)
audioManager.play('key2');      // 450Hz
audioManager.play('key3');      // 550Hz
audioManager.play('step1');     // 320Hz — pasos/secuencia
audioManager.play('step2');     // 420Hz
audioManager.play('step3');     // 520Hz
```

> ⚠️ Siempre proteger con `if (audioManager) audioManager.play(...)` para evitar
> errores si el manager no está inicializado (ej. en tests).

---

## 13. Integración con Multiplayer

Si tu juego tiene soporte **multiplayer real** (como Simon, Arrow, Termita, Letters Fall):

1. Agrega `online: true` al `GameConfig`.
2. Usa el helper compartido `setupSplitView(gameId, ui, prefix, ownBoard)` de
   `js/utils/multiplayerSplitView.ts` en el `init()` de la lógica.

Contrato de integración (extraído de `docs/ARCHITECTURE.md`):

1. **Template**: agrega `data-ui="<prefix>Split"` en un contenedor `class="hidden"` que envuelva el tablero del jugador, más un contenedor vacío `data-ui="<prefix>Rival"` como espejo.
2. **Lógica**: llama `setupSplitView(gameId, ui, prefix, ownBoard)` en `init()`. Devuelve `{ isMultiplayer, sendEvent, onRivalEvent, remirror, cleanup }`.
3. **Emitir eventos**: `sendEvent(type, payload)` se llama **incondicionalmente** en cada punto de emisión (flash de botón, revelación de celda) — es no-op si no hay partida activa, así que los call sites no necesitan ramificar con `isMultiplayer`.
4. **Recibir eventos**: `onRivalEvent(type, handler)` registra handlers que reproducen la acción en el tablero rival.
5. **Re-mirror**: `remirror()` re-clona el tablero del jugador en el contenedor rival — llamarlo cada vez que el tablero se reconstruye (ej. en cada "Start"), no solo una vez, porque el tamaño puede cambiar entre rondas.
6. **Cleanup**: llamar `cleanup()` en `stop()`.

---

## 14. Checklist Final de Integración

Antes de dar por integrado un minijuego, verifica todo esto:

### Archivos Creados
- [ ] `js/views/<mi-juego>.ts` — template con `data-ui` y `data-back-to="home"`
- [ ] `js/games/<mi-juego>.ts` — GameConfig con `logic: () => import(...)`
- [ ] `js/games/<mi-juego>.logic.ts` — exporta `init(ui)` y `stop()`
- [ ] `css/<mi-juego>.css` — estilos con prefijo del juego

### Registros
- [ ] `js/games/index.ts` — `export { default as miJuego } from './mi-juego.js';`
- [ ] `js/core/viewTemplates.ts` — `'mi-juego': () => import('../views/mi-juego.js')`
- [ ] `index.html` — `<section id="mi-juego" class="view hidden" data-lazy="1"></section>`
- [ ] `js/core/gameIcons.ts` — SVG bajo `'mi-juego'` (opcional)

### Coherencia de IDs
- [ ] `GameConfig.id` === `section id` en `index.html` === clave en `viewTemplates`
- [ ] `Leaderboard.save('mi-juego', ...)` usa el mismo ID

### Lógica (Buenas Prácticas)
- [ ] `init(ui)` desestructura los elementos por `data-ui`
- [ ] Usa `GameHelpers.createCleanupManager()` para timers/listeners
- [ ] `stop()` llama `cleanup?.cleanup()`
- [ ] Guarda puntuación con `Leaderboard.save(...)` al terminar
- [ ] Usa `audioManager.play(...)` para feedback de sonido
- [ ] `gameConfig.tag` es una de las categorías válidas
- [ ] `gameConfig.difficulty` es 1-5
- [ ] `gameConfig.accent` es un color hex
- [ ] `gameConfig.num` es el siguiente número disponible (sin duplicar)

### Verificación
- [ ] `npm run build` compila sin errores de TypeScript
- [ ] El juego aparece en el lobby con nombre, ícono, dificultad y descripción
- [ ] Click en la card → se abre la vista → se carga el template → se ejecuta init
- [ ] El juego funciona con el teclado (accesibilidad)
- [ ] Los sonidos se reproducen correctamente
- [ ] El récord se guarda y aparece en el badge de la card

---

## 15. Troubleshooting

### "No se pudo cargar este minijuego"
- Revisa que la clave en `viewTemplates` coincida exactamente con el `section id`.
- Revisa que el archivo `js/views/<mi-juego>.ts` exista y exporte `default`.

### El juego no aparece en el lobby
- Revisa que `js/games/index.ts` importe `<mi-juego>.js`.
- Revisa que `GameRegistry.register(gameConfig)` esté al final de `<mi-juego>.ts`.
- Revisa que `hidden` no esté en `true`.

### El juego abre pero la vista queda vacía
- Revisa el `data-lazy="1"` en la sección de `index.html`.
- Revisa que el template exporte correctamente con `satisfies ViewTemplate`.

### Los elementos UI son undefined en `init(ui)`
- Revisa que los elementos del template tengan `data-ui="<clave>"` y que la clave
  desestructurada coincida exactamente (case-sensitive).

### El juego crashea al hacer "Back" o cambiar de vista
- Revisa que `stop()` llame `cleanup?.cleanup()`.
- Revisa que no queden `setInterval`/`setTimeout` sin registrar en el cleanup manager.

### El badge de récord no muestra formato personalizado
- Revisa que `leaderboard.format` esté definido en el `GameConfig`.
- `GameRegistry.register` conecta automáticamente con `LeaderboardManager.setConfig`.

### Cambios no se reflejan al recargar
- Ejecuta `npm run dev` (Vite dev server) para desarrollo.
- Para build de producción: `npm run build && npm run preview`.

---

## 📌 Resumen Final

```
┌─────────────────────────────────────────────────────────────┐
│                PASOS DE INTEGRACIÓN RÁPIDOS                  │
├─────────────────────────────────────────────────────────────┤
│  1. Crear js/views/<mi-juego>.ts        → Template HTML     │
│  2. Crear js/games/<mi-juego>.ts        → Metadatos + reg.  │
│  3. Crear js/games/<mi-juego>.logic.ts  → Lógica init/stop  │
│  4. Editar js/games/index.ts            → Export del juego  │
│  5. Editar js/core/viewTemplates.ts     → Loader de vista   │
│  6. Editar index.html                   → <section> con id  │
│  7. Editar js/core/gameIcons.ts         → Ícono SVG         │
│  8. Crear css/<mi-juego>.css            → Estilos           │
│  9. (Opcional) leaderboard.format       → Formato de récord │
│ 10. (Opcional) online:true + splitView → Multiplayer        │
└─────────────────────────────────────────────────────────────┘
```

> 💡 **Consejo para IA**: Cuando se te pida crear un minijuego, genera siempre los 3
> archivos del juego (`views/`, `games/`, `games/*.logic.ts`) + el CSS en una carpeta
> temporal aparte, y luego aplica las ediciones exactas a los 4 puntos de registro
> (`index.ts`, `viewTemplates.ts`, `index.html`, `gameIcons.ts`) directamente en el
> proyecto principal, siguiendo los ejemplos de esta guía.