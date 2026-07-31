# Minijuegos — Entrenador de Bots

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646cff)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.19.0-green)](https://nodejs.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange)](https://www.pwabuilder.com/)

Plataforma PWA de minijuegos de entrenamiento cognitivo: reflejos, memoria, lógica, percepción, cifrado, tipeo y análisis bajo presión. 26 módulos jugables, en español, pensados para sesiones cortas y repetibles con seguimiento de récords personales.

- **Versión:** 3.0.0
- **Stack:** TypeScript + Vite, sin framework de UI (DOM nativo, HTML generado como strings)
- **Persistencia:** `localStorage` (offline-first, sin backend)
- **Distribución:** PWA instalable con Service Worker

---

## Tabla de contenidos

1. [Instalación para Desarrolladores](#instalación-para-desarrolladores)
2. [Inicio rápido](#inicio-rápido)
3. [Scripts disponibles](#scripts-disponibles)
3. [Arquitectura](#arquitectura)
   - [Filosofía general](#filosofía-general)
   - [Ciclo de vida de un juego](#ciclo-de-vida-de-un-juego)
   - [Orden de arranque (`main.ts`)](#orden-de-arranque-maints)
   - [Sistema de vistas lazy](#sistema-de-vistas-lazy)
   - [`data-ui`: el contrato entre vista y lógica](#data-ui-el-contrato-entre-vista-y-lógica)
4. [Estructura de carpetas](#estructura-de-carpetas)
5. [Módulos `core/`](#módulos-core)
6. [Managers de estado](#managers-de-estado)
7. [Catálogo de minijuegos](#catálogo-de-minijuegos)
8. [Sistema de estilos](#sistema-de-estilos)
9. [Cuentas de usuario y scoreboard global](#cuentas-de-usuario-y-scoreboard-global)
10. [PWA y Service Worker](#pwa-y-service-worker)
11. [Testing](#testing)
12. [Build y bundling](#build-y-bundling)
13. [CI/CD](#cicd)
14. [Convenciones de código](#convenciones-de-código)
15. [Deuda técnica conocida](#deuda-técnica-conocida)
16. [Cómo agregar un minijuego nuevo](#cómo-agregar-un-minijuego-nuevo)
17. [Troubleshooting](#troubleshooting)

---

## Instalación para Desarrolladores

### Requisitos Previos

- **Node.js**: ≥ 20.19.0 (ver `engines` en `package.json`)
- **npm**: ≥ 9.0.0
- **Git**: para clonar el repositorio

### Pasos de Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd Main/1
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

   Esto instalará todas las dependencias de desarrollo necesarias:
   - TypeScript y Vite para el build
   - Vitest para testing unitario
   - Playwright para testing E2E
   - axe-core para testing de accesibilidad
   - k6 para testing de carga

3. **Verificar la instalación**
   ```bash
   npm run type-check  # Verificar tipos TypeScript
   npm run test        # Ejecutar tests
   ```

### Scripts de Desarrollo

```bash
npm run dev          # Servidor de desarrollo con HMR
npm run build        # Build para producción
npm run preview      # Preview del build de producción
npm run type-check   # Verificación de tipos TypeScript
```

### Scripts de Testing

```bash
npm run test         # Tests unitarios (modo watch)
npm run test:run     # Tests unitarios (single run)
npm run test:ui      # Tests unitarios con UI
npm run test:e2e     # Tests E2E con Playwright
npm run test:load    # Tests de carga con k6
```

### Troubleshooting de Instalación

**Error: "Cannot find module '@playwright/test'"**
- Ejecuta `npm install` para instalar las dependencias faltantes

**Error: "Module not found"**
- Verifica que estás en el directorio correcto del proyecto
- Ejecuta `npm install` nuevamente

**Error de permisos en Windows**
- Ejecuta PowerShell como Administrador
- O usa Git Bash en lugar de PowerShell

---

## Inicio rápido

Requiere Node ≥ 20.19.0 (ver `engines` en `package.json`).

```bash
npm install
npm run dev      # http://localhost:3000, con HMR
```

Para producción:

```bash
npm run build    # genera dist/ (Vite build + compilación del Service Worker)
npm run preview  # sirve dist/ localmente para probar el build final
```

---

## Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta Vite en modo desarrollo (puerto 3000, abre el navegador automáticamente) |
| `npm run build` | `vite build` (bundlea `index.html` + todos los módulos) seguido de `build:sw` |
| `npm run build:sw` | Compila `sw.ts` (Service Worker) por separado con `tsc`, ya que Vite no lo procesa como parte del bundle principal |
| `npm run preview` | Sirve el contenido de `dist/` para verificar el build de producción |
| `npm run type-check` | `tsc --noEmit` sobre la app + `tsc --noEmit -p tsconfig.sw.json` sobre el Service Worker. No emite archivos, solo valida tipos |
| `npm run type-check-watch` | Igual que arriba, en modo watch |
| `npm test` / `npm run test:run` | Corre la suite de Vitest (`test` en modo watch, `test:run` una sola pasada) |
| `npm run test:ui` | Abre la UI interactiva de Vitest |

---

## Arquitectura

### Filosofía general

El proyecto es una migración de una versión anterior basada en HTML estático + `<script>` inline por vista (`public/views/*.html` + fetch), hacia TypeScript modular con Vite. Varios comentarios en el código documentan explícitamente ese origen y las decisiones tomadas durante la migración — vale la pena leerlos antes de tocar `core/`, ya que explican *por qué* algo está hecho así y no de otra forma más "obvia".

Principios que se repiten en todo el código base:

- **Sin framework de UI.** Las vistas son funciones puras `() => string` que devuelven HTML; se inyectan con `innerHTML` y se conectan a mano vía `data-ui` + `getElementById`/`querySelectorAll`. No hay React/Vue ni virtual DOM.
- **Lazy-loading agresivo.** Tanto el HTML de cada vista como la lógica pesada de cada juego se cargan bajo demanda vía `import()` dinámico, para que abrir el lobby no descargue las ~20 mil líneas de TypeScript de los 26 juegos.
- **`localStorage` como única fuente de persistencia**, siempre detrás de una capa (`SafeStorage`) que absorbe fallos de entorno (modo privado, cuota excedida, JSON corrupto).
- **Registro central en vez de imports dispersos.** Cada juego se registra en `GameRegistry` con sus metadatos; el lobby, los filtros, las estadísticas y el ranking se generan **todos** a partir de ese registro, nunca hardcodeados.

### Ciclo de vida de un juego

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  js/games/*.ts   │────▶│  GameRegistry     │────▶│  lobbyRenderer.ts  │
│  (metadata liviana:    │  .register(config)│     │  pinta la card en  │
│   id, name, tag,  │     └──────────────────┘     │  el lobby a partir │
│   icon, difficulty,│                              │  de .visible()     │
│   logic: () =>... │                              └────────┬───────────┘
└─────────┬────────┘                                        │ click / hover
          │ import() bajo demanda                            ▼
          │ (solo al entrar a la vista)              ┌───────────────────┐
          ▼                                           │  viewManager.ts    │
┌──────────────────────┐                              │  showView(id)      │
│ js/games/*.logic.ts   │                              └────────┬───────────┘
│ (init/stop reales,    │◀─────────────────────────────────────┘
│  la clase del juego)  │   ensureInit(id) resuelve game.logic(),
└──────────────────────┘   luego resolveUi(id) + injectCSS(game.css),
                            luego init(ui)
```

Pasos exactos (ver `core/gameRegistry.ts` y `core/viewManager.ts`):

1. **Registro (arranque, síncrono y liviano).** Cada `js/games/<juego>.ts` llama a `GameRegistry.register({...})` con solo los metadatos necesarios para pintar una card en el lobby (`id`, `name`, `tag`, `icon`, `difficulty`, `description`) más una referencia `logic: () => import('./<juego>.logic.js')`. La lógica pesada (la clase del juego, cientos de líneas) **no se importa todavía**.
2. **Prefetch opcional (hover/focus sobre la card).** `GameRegistry.prefetch(id)` dispara el `import()` de `logic` por adelantado, sin tocar el DOM ni llamar `init`. Es fire-and-forget y silencioso ante errores a propósito — si de verdad falla, `ensureInit` lo va a reintentar y reportar en el flujo que importa (el click real).
3. **Navegación (click en la card).** `viewManager.showView(id)` oculta la vista actual, hidrata el HTML de la nueva vista si todavía no existe (`loadLazyView`, ver más abajo) y dispara el evento custom `view-shown`.
4. **`ensureInit(id)`.** Resuelve `game.logic()` (reutilizando la promesa del prefetch si ya estaba en vuelo), llama a `resolveUi(id)` para construir el objeto `GameUi` a partir de los `data-ui` del HTML recién inyectado, inyecta el CSS del juego si tiene uno (`game.css`), y finalmente llama `init(ui)`. El resultado se cachea: una segunda visita a la misma vista no vuelve a `import()` ni a `init()`.
5. **`stop()`.** Se guarda la función `stop` devuelta y se invoca al salir de la vista, para limpiar timers/listeners.

### Orden de arranque (`main.ts`)

`main.ts` es el único entry point real (referenciado desde `index.html`). El orden de los imports importa y está agrupado con comentarios explícitos:

```ts
// 1. Core (deben cargarse primero: registries y abstracciones de bajo nivel)
import './core/errorLogger';
import './core/safeStorage';
import './core/gameRegistry';
import './core/gameInstanceRegistry';
import './core/viewManager';

// 2. Managers (estado transversal: puntuaciones, favoritos, audio, tema...)
import './leaderboardManager';
import './favoritesManager';
import './audioManager';
import './backgroundManager';
import './configPanel';
import './configReset';
import './customCursor';
import './statsManager';

// 3. Juegos (cada uno se auto-registra en GameRegistry al importarse)
import './games/index';

// 4. Bootstrap y orquestación del lobby (necesitan que los juegos ya estén registrados)
import './gameBootstrap';
import './lobbyRenderer';
import './app';
import './transitions';
import './sidebarViews';

// 5. Widgets de UI del shell (sidebar, reproductor de música — dependen del DOM ya montado)
import './sideNavBoot';
import './musicPlayerDrag';
import './musicPlayer';
import './lobbySidebarUI';
import './headerUptime';
```

### Sistema de vistas lazy

Las vistas de juego individuales **no viven en `index.html`**. Cada una es un `<section id="..." data-lazy="1">` vacío; `viewManager.ts` hidrata su contenido la primera vez que el usuario la visita, importando `js/views/<id>.ts` (registrado en `core/viewTemplates.ts`) y haciendo `section.innerHTML = template()`.

Esto reemplaza una versión anterior que hacía `fetch()` sobre `public/views/*.html`: mismo comportamiento de lazy-loading, pero ahora resuelto por Vite (cada `js/views/*.ts` se convierte en su propio chunk) en vez de una petición de red a un archivo estático. El atributo `data-lazy="1"` en el HTML se conserva solo como bandera de "esta vista todavía no se hidrató" — su valor histórico (el path al `.html`) ya no se usa.

Al hidratar una vista, `viewManager.ts` dispara `document.dispatchEvent(new CustomEvent('view-shown', { detail: { id } }))`. Este evento es el punto de enganche para cualquier módulo que necesite reaccionar a "se está mostrando la vista X" sin acoplarse directamente a `viewManager` — lo usan, por ejemplo, `sidebarViews.ts` (para rellenar Estadísticas/Progreso/Ranking/Manual con datos frescos) y `configReset.ts` (para descartar un estado de confirmación pendiente si el usuario navega a otro lado).

### `data-ui`: el contrato entre vista y lógica

Cada vista marca los elementos que su lógica necesita tocar con `data-ui="algunNombre"`, en vez de usar `id` (que podría colisionar entre vistas si dos secciones estuvieran montadas a la vez, o requerir prefijos manuales). `GameRegistry.resolveUi(gameId)` busca `#gameId [data-ui]` y arma un objeto plano `{ algunNombre: HTMLElement, ... }` que se pasa como único argumento a `init(ui)`.

```ts
// En js/views/termita.ts (la vista):
`<div data-ui="grid" class="termita-grid"></div>
 <span data-ui="score">0</span>`

// En js/games/termita.logic.ts (la lógica):
export function init(ui: GameUi) {
  const grid = ui.grid as HTMLElement;
  const score = ui.score as HTMLElement;
  // ...
}
```

**Este contrato es puramente por convención de nombres** — no hay ningún chequeo de tipos que impida que la lógica lea `ui.algo` sin que ninguna vista declare `data-ui="algo"`. Cuando eso pasa, el código no crashea (casi siempre hay guards `if (ui.algo)` o `ui.algo?.method()`), simplemente esa parte de la UI queda muerta en silencio.

Esto ocurrió realmente en este proyecto (ver [Testing](#testing) → `dataUiIntegrity.test.ts`) y por eso existe un test dedicado a verificarlo automáticamente para los 26 juegos.

---

## Estructura de carpetas

```
project/
├── index.html                 # Shell de la app: header, sidebar, lobby, secciones vacías <section data-lazy>
├── manifest.json               # Manifest de la PWA
├── sw.ts                       # Service Worker (se compila aparte, ver build:sw)
├── vite.config.ts               # Config de Vite: manualChunks, terser, dev server
├── vitest.config.ts             # Config de Vitest: entorno jsdom, setup file
├── tsconfig.json / tsconfig.sw.json
│
├── js/
│   ├── main.ts                 # Entry point real (único <script type="module"> de index.html)
│   ├── app.ts                  # Orquestador del lobby (bootstrap del shell)
│   ├── gameBootstrap.ts         # Utilidades de arranque compartidas por los juegos
│   ├── lobbyRenderer.ts         # Genera cards + filtros del lobby a partir de GameRegistry
│   ├── sidebarViews.ts          # Rellena Estadísticas/Progreso/Ranking/Manual (escucha 'view-shown')
│   ├── configPanel.ts           # Selector de tema (header + vista Configuración, sincronizados)
│   ├── configReset.ts           # Botón "Borrar todos los récords" (confirmación de doble clic)
│   ├── leaderboardManager.ts    # Récords por juego (localStorage)
│   ├── favoritesManager.ts      # Juegos marcados como favoritos
│   ├── audioManager.ts          # SFX del juego (Web Audio)
│   ├── musicPlayer.ts / musicPlayerDrag.ts   # Reproductor de música de fondo, arrastrable
│   ├── backgroundManager.ts      # Tema oscuro (dark/neon/ocean), fondo, scanlines
│   ├── customCursor.ts          # Cursor personalizado con estela
│   ├── headerUptime.ts          # Reloj de "uptime" simulado del header
│   ├── sideNavBoot.ts            # Animación de arranque del side-nav + stats de sesión
│   ├── lobbySidebarUI.ts         # Buscador en vivo, colapso de sidebar, contador de favoritos
│   ├── statsManager.ts           # Fachada legacy sobre SafeStorage (compatibilidad con window.StatsManager)
│   ├── transitions.ts            # Transiciones suaves entre vistas
│   │
│   ├── core/
│   │   ├── gameRegistry.ts        # Registro central de juegos (ver arriba)
│   │   ├── viewManager.ts         # Navegación entre secciones + hidratación lazy
│   │   ├── viewTemplates.ts       # Registro de templates de vista (uno por id)
│   │   ├── gameInstanceRegistry.ts # Reemplaza el patrón window._xxxGame por juego
│   │   ├── safeStorage.ts         # Abstracción robusta de localStorage
│   │   └── errorLogger.ts         # Logging centralizado de errores
│   │
│   ├── games/                    # Un archivo de metadata + un .logic.ts por juego pesado
│   │   ├── index.ts                # Barrel: importa todos los juegos para que se auto-registren
│   │   ├── <juego>.ts               # register() con metadata liviana
│   │   └── <juego>.logic.ts         # init/stop reales, cargados vía import() bajo demanda
│   │
│   ├── views/                    # Un template () => string por vista/sección
│   │   └── <id>.ts
│   │
│   ├── types/
│   │   ├── game.ts                 # GameConfig (re-exportado), ViewTemplate, tipos compartidos
│   │   └── global.d.ts              # GameUi, extensiones de window, tipos de eventos custom
│   │
│   └── utils/
│       ├── gameHelpers.ts           # Helpers compartidos entre juegos (random, clamp, etc.)
│       └── backButton.ts            # Hidratación de botones "volver" (data-back-to)
│
├── css/
│   ├── styles.css                 # Base: layout del shell, lobby, sidebar, vistas de stats/ranking/manual
│   ├── redesign-extras.css         # Extras de la última pasada de rediseño visual
│   ├── lobby-*.css                 # Variantes de header/lobby (tactical, themes, new)
│   └── <juego>.css                 # Un archivo por juego con CSS propio (cargado vía injectCSS)
│
├── test/                          # Suite de Vitest (ver sección Testing)
├── assets/icons/                  # Íconos de la PWA en todos los tamaños requeridos
├── audio/                         # Efectos de sonido y música de fondo
└── components/ui/                  # Componentes de UI reutilizables sueltos
```

---

## Módulos `core/`

| Módulo | Responsabilidad | Nota de diseño |
|---|---|---|
| **`gameRegistry.ts`** | Registro central de juegos: `register`, `visible`, `ensureInit`, `prefetch`, `resolveUi`, `injectCSS`, `stopGame`. | Única fuente de verdad para "qué juegos existen" — el lobby, las estadísticas, el ranking y el manual se derivan todos de `GameRegistry.visible()`, nunca de una lista hardcodeada en otro lado. |
| **`viewManager.ts`** | Navegación entre secciones (`showView`), hidratación lazy del HTML de cada vista, disparo del evento `view-shown`. | Reemplaza un sistema anterior basado en `fetch()` sobre HTML estático. |
| **`viewTemplates.ts`** | Registro `{ id: () => import('../views/<id>.js') }` para que Vite pueda separar cada vista en su propio chunk. | Puramente declarativo — no contiene lógica, solo el mapa de loaders. |
| **`gameInstanceRegistry.ts`** | `set/get/clear` tipados y genéricos para que un juego comparta su instancia activa entre `init()` y `stop()`. | Reemplaza el patrón `window._xxxGame = instance` que usaban 7 juegos distintos (holematch, colorcount, arrowGame, lettersFall, memorygrid, simon, pairs) con convenciones inconsistentes entre sí y `as any` en cada uso. |
| **`safeStorage.ts`** | Capa única sobre `localStorage`: detección de disponibilidad, try/catch consistente, helpers tipados para JSON/string/número. | Antes de esto, 9+ archivos golpeaban `localStorage` directamente con manejo de errores desigual; en modo privado de Safari o con cuota excedida, algunos call-sites ni siquiera capturaban la excepción. |
| **`errorLogger.ts`** | `log(context, error, meta)` centralizado, con un buffer de errores recientes y un `sink` configurable (para conectar telemetría externa sin tocar cada call-site). | |

---

## Managers de estado

| Manager | Qué guarda | Clave de `localStorage` |
|---|---|---|
| **`leaderboardManager.ts`** | Récords por juego (`value`, `timestamp`, `meta` opcional), con formateador de valor configurable por juego (`GameConfig.leaderboard.format`) | `minijuegos_leaderboard` |
| **`favoritesManager.ts`** | Set de ids de juegos marcados como favoritos | `minijuegos_favorites` |
| **`audioManager.ts`** | Estado de volumen/mute de los SFX (no persiste historial, solo preferencia) | |
| **`backgroundManager.ts`** | Tema activo (dark / neon / ocean), fondo, scanlines | |
| **`musicPlayer.ts`** | Pista actual, posición de reproducción, volumen del BGM | |
| **`statsManager.ts`** | Fachada legacy: delega todo en `SafeStorage`, se conserva solo por compatibilidad con `window.StatsManager` | |

Todos los managers validan la **forma** de los datos leídos de `localStorage` antes de confiar en ellos (ver `isLeaderboardStore` en `leaderboardManager.ts` como ejemplo) — un valor con JSON válido pero forma inesperada (por ejemplo, tras una versión anterior del código) se descarta en vez de propagar un `TypeError` más adelante.

El leaderboard emite `window.dispatchEvent(new CustomEvent('leaderboard:updated', { detail: {...} }))` en cada `save()`, consumido por `sideNavBoot.ts` para refrescar el resumen de sesión sin acoplamiento directo.

---

## Catálogo de minijuegos

26 módulos jugables en el lobby (+ sub-juegos ocultos de Skill Check). `num` es el identificador visible en la card del lobby; `tag` determina el filtro por categoría (generado dinámicamente, no hardcodeado — ver `lobbyRenderer.ts`).

| # | Nombre | Categoría | Dificultad | Descripción |
|---|---|:---:|:---:|---|
| 01 | Termita | MEMORIA | ★★ | Memoriza la cuadrícula iluminada y señala las celdas correctas antes de que el sistema las borre |
| 02 | Simon Dice | SECUENCIA | ★★★ | Repite secuencias de colores en orden exacto; cada ronda suma un paso |
| 03 | Desafío Flechas | REFLEJOS | ★★ | Presiona la flecha correcta antes de que caduque la señal (teclado o D-pad táctil) |
| 04 | Hacking Device | CIFRADO | ★★★★★ | Descifra el código de acceso e infiltra el sistema antes de que el firewall te detecte |
| 05 | Caída de letras | TIPEO | ★★★ | Escribe las letras que caen en tiempo real antes de que lleguen al suelo |
| 06 | Hole Match | PERCEPCIÓN | ★★ | Empareja la forma con el hueco correcto al instante, margen de error cero |
| 07 | Color Count | ANÁLISIS | ★★★ | Cuenta los elementos del color indicado antes de que se agote el tiempo |
| 08 | Skill Check | REFLEJOS | ★★★ | Colección de sub-minijuegos de habilidad (timing, reflejos, teclado y puzzles cortos) |
| 09 | Typix | TIPEO | ★★ | Adivina el código de 5 dígitos en un máximo de 6 intentos |
| 10 | Rapid Lines | REFLEJOS | ★★★★ | Presiona la tecla correcta cuando la flecha llega al centro; la velocidad aumenta |
| 11 | Sequence | MEMORIA | ★★★ | Observa y repite la secuencia; cada nivel añade un paso |
| 12 | Rhythm Click | REFLEJOS | ★★★ | Clic en el núcleo justo cuando el anillo se contrae |
| 13 | Progress Timing | REFLEJOS | ★★★★ | Detén el marcador en la zona verde; velocidad y tamaño configurables |
| 16 | Neural Fragment Hack | MEMORIA | ★★★ | Reconstruye fragmentos de memoria corrupta, filtrando el ruido |
| 17 | Memory Grid | MEMORIA | ★★★ | Memoriza los números del tablero y encuentra la ruta de S a E con saltos exactos |
| 18 | Virus Overload | SUPERVISIÓN | ★★★★★ | Sobrevive a la infección del sistema: 4 fases progresivas con 20 minijuegos únicos dentro |
| 19 | Data Recall Grid | MEMORIA | ★★★ | Memoriza la red de datos y responde bajo presión |
| 20 | Bomb Defusal | ANÁLISIS | ★★★★★ | Desactiva módulos consultando el manual — estilo "Keep Talking and Nobody Explodes" |
| 21 | Reactor Nuclear | ESTRATEGIA | ★★★★★ | Mantén el reactor estable bajo variables interconectadas y eventos aleatorios |
| 22 | Ring Puzzle | LÓGICA | ★★★ | Alinea los nodos de colores de cada anillo girándolos hasta la posición objetivo |
| 23 | Pairs | ESTRATEGIA | ★★ | Encuentra todos los pares iguales con el menor número de movimientos |
| 24 | Cerradura Mecánica | LÓGICA | ★★★★ | Mecanismo procedural de engranajes, pestillos, imanes y contrapesos |

Sub-juegos ocultos del lobby principal (`hidden: true` en su `GameConfig`, solo accesibles desde Skill Check u otra vista contenedora): **Circle**, **Multi-Point**, **Bounce Bar**, **Hold & Release**, **Target Pop**, **Chord Keys**, **Orbit Catch**, **Lane Dodge**, **Pipe Align** (además de Rapid Lines, Maze, Key Spam, Sequence, Rhythm Click y Progress Timing, que también se abren desde el hub).

Cada entrada de la tabla corresponde a un par `js/games/<archivo>.ts` (metadata) + `js/games/<archivo>.logic.ts` (lógica pesada) + `js/views/<id>.ts` (HTML) + `css/<juego>.css` (estilos propios, cargado bajo demanda vía `GameRegistry.injectCSS`).

---

## Sistema de estilos

- **`css/styles.css`** (92 KB): la base — layout del shell, header, sidebar, lobby, y las vistas de Estadísticas/Progreso/Ranking/Manual (`.stat-card`, `.progress-item`, `.ranking-item`, `.manual-item`).
- **`css/redesign-extras.css`**: incrementos de una pasada de rediseño posterior, no fusionados en `styles.css` para mantener el diff acotado.
- **`css/lobby-*.css`**: variantes visuales del header/lobby (`tactical`, `themes`, `new`, `header-redesign`) — los cuatro se enlazan simultáneamente en `index.html`; `lobby-themes.css` define las paletas de los temas `neon` y `ocean` (variantes oscuras), activas según `body[data-theme]`, el resto aplica siempre.
- **Un `.css` por juego** (`arrow.css`, `simon.css`, `bombdefusal.css`, ...): se cargan de forma perezosa vía `GameRegistry.injectCSS(game.css)` la primera vez que se inicializa ese juego — nunca se descargan todos de una.

No hay preprocesador (Sass/Less) ni sistema de design tokens formal: los colores de acento (`accent` en `GameConfig`) se definen por juego y se usan tanto en el CSS del juego como en la card del lobby.

---

## Mejoras de UX/UI (v2.6.0)

### Sistema de Notificaciones Toast
- Contenedor de notificaciones en `index.html` con soporte para lectores de pantalla (`aria-live="polite"`)
- 4 variantes: success, error, warning, info con iconos y colores distintivos
- Animaciones de entrada/salida (slide-in/slide-out)
- Botón de cierre en cada notificación
- Responsive: bottom en móvil, top-right en desktop

### Atajos de Teclado Globales
- Sistema en `keyboardShortcuts.ts` con registro dinámico de atajos
- Atajos predeterminados:
  - `Ctrl/Cmd + K`: Foco en búsqueda
  - `Escape`: Cerrar vista actual / volver al lobby
  - `Ctrl/Cmd + /`: Mostrar ayuda de atajos
  - `Ctrl/Cmd + N/P`: Navegar entre secciones
- Ignora inputs/textareas para no interferir con escritura

### Persistencia de Preferencias
- Sistema en `preferencesManager.ts` que guarda automáticamente:
  - Tema (dark/neon/ocean)
  - Reducción de movimiento
  - Alto contraste
  - Volumen de música
  - Estado del sidebar
  - Juegos favoritos
  - Último juego jugado
- Sincronización automática con toggles del header

### Error Boundary Global
- Sistema en `errorBoundary.ts` que captura errores globales y promesas rechazadas
- Modal de error con información detallada (stack trace, source, línea/columna)
- Opciones para recargar página o cerrar
- Funciones helpers `withErrorHandling` y `withAsyncErrorHandling`

### Optimización de Rendimiento
- Lazy loading para imágenes con fade-in
- Placeholder shimmer para imágenes cargando
- Propiedad `contain` para optimizar layout de elementos interactivos
- Clases `will-change-transform` y `will-change-opacity` para animaciones
- GPU acceleration con `transform: translateZ(0)`

### Búsqueda Mejorada
- Filtrado en tiempo real con debounce (150ms)
- Búsqueda por nombre/categoría/descripción
- Animaciones de entrada para resultados
- Mensaje de "no resultados" cuando no hay coincidencias
- Soporte para Ctrl/Cmd+K y Escape

### Badges de Filtros
- Estilos mejorados con hover effects
- Estado activo con glow y línea inferior
- Animaciones suaves de transición

### Menú de Acciones Rápidas
- Botón de acciones en tarjetas (aparece en hover)
- Dropdown con opciones
- Animaciones de entrada/salida

### Efectos de Sonido UI
- Sistema Web Audio API en `uiSoundEffects.ts`
- Efectos para: click, hover, success, error, notification, filter, typing
- Control de volumen y enable/disable
- Inicialización automática en primera interacción del usuario

### Efectos de Partículas
- Gradiente radial que sigue la posición del mouse en hover de tarjetas
- Partículas con animación de flotación

### Dropdown de Perfil de Usuario
- Menú de usuario con header, items con iconos
- Divider y footer con logout
- Animaciones fluidas de entrada/salida

### Estadísticas en Tarjetas
- Preview de stats con colores según rendimiento (high/medium/low)
- Contador de partidas jugadas

### Toggle de Tema
- Switch animado con iconos de sol/luna
- Transiciones suaves entre temas
- Overlay de transición

### Efecto Confetti
- Sistema canvas-based para celebraciones
- Explosiones múltiples con física (gravedad, rotación)
- Colores variados

### Loading Skeleton
- Skeleton loading específico para tarjetas de juego
- Shimmer animation para mejor UX durante carga

### Sub Lobby de Skillcheck Unificado
- Diseño unificado con el lobby principal
- Logos reemplazados por emojis Unicode
- Grid responsive con `repeat(auto-fit, minmax(200px, 1fr))`
- Altura de tarjetas reducida para diseño más compacto
- Animaciones de entrada escalonadas

---

## Mejoras de Calidad y Mantenibilidad (v2.7.0)

### Corrección de Error en Snippet Race
- Corregido error de tipo en `snippetRace.logic.ts` línea 333
- `filterPool` ahora acepta `number` con validación interna
- Mejor robustez en manejo de dificultades

### Testing E2E con Playwright
- Configuración completa de Playwright para testing end-to-end
- Tests críticos del lobby: carga, filtrado, búsqueda, favoritos, navegación
- Soporte multi-navegador: Chrome, Firefox, Safari
- Tests móviles: Pixel 5, iPhone 12
- Scripts: `npm run test:e2e`, `npm run test:e2e:ui`, `npm run test:e2e:headed`

### Modo Alto Contraste Completo
- Soporte automático para `@media (prefers-contrast: high)`
- Toggle manual con clase `.high-contrast`
- Paleta de colores optimizada: negro/blanco/amarillo
- Bordes gruesos (2-3px) para mejor visibilidad
- Colores semánticos en notificaciones (verde/rojo/amarillo/cian)
- Mejor contraste en todos los elementos interactivos

### Monitoreo de Core Web Vitals
- Sistema en `performanceMonitor.ts` con PerformanceObserver
- Métricas monitoreadas:
  - LCP (Largest Contentful Paint)
  - FID (First Input Delay)
  - CLS (Cumulative Layout Shift)
  - FCP (First Contentful Paint)
  - TTFB (Time to First Byte)
  - DOM Content Loaded
  - Load Complete
- Ratings automáticos (good/needs-improvement/poor)
- API expuesta en window: `getWebVitals()`, `exportPerformanceReport()`
- Logging automático con emojis para identificación rápida

### Guía de Contribución Formal
- Documentación completa en `docs/CONTRIBUTING.md`
- Código de conducta y estándares de comportamiento
- Flujo de trabajo detallado para contribuciones
- Estándares de código y convenciones de nombres
- Guía de testing (unit, integration, E2E)
- Plantillas para Pull Requests, Bug Reports y Feature Requests
- Checklist de revisión antes de enviar PRs

---

## Mejoras de Calidad y Mantenibilidad (v2.8.0)

### Tests de Integración Adicionales
- Suite de tests de integración para GameRegistry (`test/gameRegistryIntegration.test.ts`)
- Tests con DOM real usando JSDOM
- Verificación de registro, resolución de UI, inicialización y cacheo
- Tests de filtrado por categoría y validación de tipos

### Documentación de API para Desarrolladores
- Documentación completa en `docs/API.md`
- APIs públicas documentadas: GameRegistry, ViewManager, SafeStorage, LeaderboardManager, FavoritesManager
- APIs de utilidades: PerformanceMonitor, UISoundEffects, ConfettiEffect, KeyboardShortcuts, PreferencesManager
- Ejemplos de uso y definiciones de tipos
- Guía de mejores prácticas

### Validaciones de Seguridad y Sanitización
- Sistema completo en `security.ts`
- Funciones de escape: `escapeHtml()`, `escapeJs()`, `sanitizeInput()`
- Validaciones: `isValidId()`, `isValidUrl()`, `isValidEmail()`, `isSafeString()`
- Sanitización de nombres de archivo y JSON seguro
- Validación de esquemas de configuración
- Rate limiter para prevenir abuso
- Generación de nonces CSP

### Mejoras de Accesibilidad con ARIA
- Sistema completo en `accessibility.ts`
- Utilidades ARIA: `setAriaLabel()`, `setAriaExpanded()`, `setAriaPressed()`, etc.
- Anunciador ARIA dinámico para lectores de pantalla
- Skip links para navegación por teclado
- Trap focus para modales y dropdowns
- Detección de preferencias: `prefersReducedMotion()`, `prefersHighContrast()`, `prefersDarkMode()`
- Manejo de foco visible (teclado vs mouse)

### Optimizaciones de Rendimiento
- Sistema completo en `performance.ts`
- Memoización: `memoize()`, `memoizeAsync()`
- Debounce/Throttle: `debounce()`, `throttle()`, `rafThrottle()`
- Lazy loading con cache
- Virtual scrolling para listas largas (`VirtualScroller`)
- Cache LRU (`LRUCache`)
- Batch DOM updates (`DOMBatcher`)
- Lazy loading de imágenes
- Preload/prefetch de recursos
- Detección de dispositivos de baja potencia
- State batching (`StateBatcher`)

### Tracking de Errores y Monitoreo
- Sistema completo en `errorTracking.ts`
- Captura automática de errores globales, promesas rechazadas y errores de recursos
- Contexto enriquecido: sesión, URL, vista, juego, acción
- Clasificación por severidad (low/medium/high/critical)
- Deduplicación de errores por ID
- Estadísticas y reportes exportables
- Wrappers para funciones con tracking: `withErrorTracking()`, `withSyncErrorTracking()`
- API expuesta en window: `getErrorStats()`, `getErrorReport()`, `clearErrors()`

### Testing Automatizado de Accesibilidad
- Integración con axe-core/Playwright
- Suite de tests en `e2e/accessibility.spec.ts`
- Verificaciones: violaciones de accesibilidad, contraste de color, etiquetas ARIA, jerarquía de headings
- Tests de manejo de foco, alt text en imágenes, labels de formularios
- Tests de landmarks, navegación por teclado, regiones ARIA live
- Scripts: `npm run test:e2e` incluye tests de accesibilidad

### Herramientas de Desarrollo y Debugging
- Consola de DevTools interactiva en `devTools.ts`
- Activación con Ctrl+Shift+D
- Comandos disponibles: `help`, `clear`, `games`, `game <id>`, `vitals`, `perf`, `errors`, `storage`, `theme`, `view`, `confetti`, `sound`, etc.
- Historial de comandos
- Logging en consola con colores
- API expuesta en window: `dev`, `devTools`

---

## Mejoras de Calidad y Mantenibilidad (v2.9.0)

### Unit Tests por Juego
- Suite de tests de estructura para 10 juegos representativos
- Tests de validación de funciones `init` y `stop`
- Verificación de exportaciones requeridas
- Tests de integración para GameRegistry
- Scripts: `npm run test`, `npm run test:run`, `npm run test:ui`

### Testing con Lectores de Pantalla Reales
- Guía completa en `docs/ACCESSIBILITY_TESTING.md`
- Procedimientos para NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS)
- Comandos de navegación específicos por lector
- Escenarios de testing: lobby, selección de juego, controles, navegación por teclado
- Plantilla de reporte de resultados
- Mejores prácticas y recursos

### Optimizaciones Específicas por Juego
- Sistema completo en `gameOptimizations.ts`
- `AnimationOptimizer`: control de animaciones según preferencias y calidad
- `CalculationOptimizer`: memoización y cache de cálculos
- `RenderOptimizer`: batch de actualizaciones DOM
- `EventOptimizer`: event delegation para reducir listeners

---

## Sistemas v3.0.0 - Gamificación y UX Avanzada

### Sistema de Notificaciones Toast Completo
- **Archivo**: `js/notificationSystem.ts`
- **Características**:
  - 5 tipos de notificaciones: success, error, warning, info, achievement
  - Stack de notificaciones con máximo 5 visibles simultáneamente
  - Auto-dismiss configurable con duración personalizable
  - Acciones personalizadas en cada notificación
  - Animaciones slideIn/slideOut suaves
  - Colores distintivos por tipo
  - Integración automática con eventos del sistema (logros, cambios de tema)
- **Uso**: `window.Minijuegos.notificationSystem.success('Título', 'Mensaje')`

### Sistema de Transiciones Mejorado
- **Archivo**: `js/transitionSystem.ts`
- **Características**:
  - 5 tipos de transiciones: fade, slide, scale, flip, none
  - 4 direcciones para slide: left, right, up, down
  - Duración y easing configurables
  - Transiciones asíncronas con Promise
  - Cleanup automático de estilos
  - Soporte para navegación entre vistas del sidebar
- **Uso**: `window.Minijuegos.transitionSystem.transition(fromView, toView, config)`

### Sistema de Badges/Insignias
- **Archivo**: `js/badgesSystem.ts`
- **Características**:
  - 4 rarezas: common, rare, epic, legendary
  - 5 categorías: achievement, social, skill, event, special
  - Sistema de showcase (hasta 5 badges en perfil)
  - Badges temporales con expiración automática
  - Sistema de progreso para badges
  - Estadísticas completas de colección
  - 15 badges predefinidos con requisitos específicos
- **Uso**: `window.Minijuegos.badgeSystem.unlockBadge('badge_id')`

### Sistema de Achievements Secuenciales
- **Archivo**: `js/achievements.ts` (extendido)
- **Características**:
  - Cadenas de logros con dependencias (prerequisiteId)
  - Método `trackSequentialProgress()` para progreso en cadenas
  - Método `getAvailableAchievements()` para logros desbloqueables
  - Soporte para logros ocultos
  - Recompensas especiales por completar cadenas completas
  - Integración con sistema de badges
- **Uso**: `window.Minijuegos.achievementManager.trackSequentialProgress('chain_id', step)`

### Sistema de Sound Effects
- **Archivo**: `js/soundSystem.ts`
- **Características**:
  - Sonidos sintéticos generados con Web Audio API (sin dependencias de archivos)
  - 6 categorías de volumen: master, ui, achievement, game, notification, ambient
  - 9 tipos de sonidos: click, hover, success, error, achievement, level_up, notification, game_start, game_end
  - Control de volumen por categoría
  - 3 temas: default, retro, modern, minimal
  - Generación en tiempo real sin archivos externos
- **Uso**: `window.Minijuegos.soundSystem.playSound('click', 'ui')`

### Sistema de Accessibility Mejorado
- **Archivo**: `js/accessibilitySystem.ts`
- **Características**:
  - Navegación por teclado completa con atajos
  - Skip links para contenido principal
  - Indicadores de focus mejorados y visibles
  - 3 modos de contraste: normal, high, increased
  - 4 tamaños de texto: small, normal, large, extra-large
  - 5 modos de daltonismo: none, protanopia, deuteranopia, tritanopia, achromatopsia
  - Reduced motion support
  - ARIA live regions para screen readers
  - Focus trap para modales y diálogos
  - 3 presets: High Contrast, Low Vision, Motor Impairment
- **Uso**: `window.Minijuegos.accessibilitySystem.setContrastMode('high')`

### Sistema de PWA Features
- **Archivo**: `js/pwaSystem.ts`
- **Características**:
  - Push Notifications con VAPID
  - Background Sync para datos offline
  - Offline Mode con monitoreo de conexión
  - App Shortcuts para acceso rápido
  - Install Prompt para PWA
  - Cache management y precarga de assets
  - Sincronización automática al recuperar conexión
- **Uso**: `window.Minijuegos.pwaSystem.promptInstall()`

### Sistema de Gamification Avanzado
- **Archivo**: `js/gamificationSystem.ts`
- **Características**:
  - Puntos globales acumulativos
  - 10 niveles de usuario con títulos y perks
  - Misiones semanales que se regeneran automáticamente
  - Eventos temporales con multiplicadores y recompensas exclusivas
  - XP Multiplier durante eventos especiales
  - Event listeners automáticos para juegos y progreso
  - Sistema de recompensas (XP, puntos, cosméticos)
- **Uso**: `window.Minijuegos.gamificationSystem.addGlobalPoints(100)`

### Sistema de Skeleton Loading
- **Archivo**: `js/skeletonSystem.ts`
- **Características**:
  - 8 tipos de skeletons: card, list, text, avatar, button, badge, stat, chart
  - Shimmer animation para mejor percepción de carga
  - Skeletons predefinidos para logros, progresión, leaderboard, perfil
  - API simple: `showSkeleton()`, `hideSkeleton()`, `withSkeleton()`
  - CSS inyectado automáticamente con tema oscuro
  - Fade transitions suaves al cargar contenido
  - Soporte para contenido asíncrono con Promises
- **Uso**: `window.Minijuegos.skeletonSystem.showSkeleton('container-id', { type: 'card', count: 6 })`

### Integración de Sistemas
Todos los sistemas v3.0.0 están completamente integrados en `js/app.ts`:
- Auto-inicialización en constructores
- Exposición global en `window.Minijuegos` para debugging
- Event listeners automáticos para integración entre sistemas
- Persistencia en localStorage cuando aplica
- Console logging de inicialización

---

## Mejoras de Calidad y Mantenibilidad (v2.9.0)

### Unit Tests por Juego
- Suite de tests de estructura para 10 juegos representativos
- Tests de validación de funciones `init` y `stop`
- Verificación de exportaciones requeridas
- Tests de integración para GameRegistry
- Scripts: `npm run test`, `npm run test:run`, `npm run test:ui`

### Testing con Lectores de Pantalla Reales
- Guía completa en `docs/ACCESSIBILITY_TESTING.md`
- Procedimientos para NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS)
- Comandos de navegación específicos por lector
- Escenarios de testing: lobby, selección de juego, controles, navegación por teclado
- Plantilla de reporte de resultados
- Mejores prácticas y recursos

### Optimizaciones Específicas por Juego
- Sistema completo en `gameOptimizations.ts`
- `AnimationOptimizer`: control de animaciones según preferencias y calidad
- `CalculationOptimizer`: memoización y cache de cálculos
- `RenderOptimizer`: batch de actualizaciones DOM
- `EventOptimizer`: event delegation para reducir listeners
- `MemoryOptimizer`: object pooling para reutilizar objetos
- `SequenceOptimizer`: cache de secuencias generadas
- `TimingOptimizer`: temporizadores optimizados con preferencias

### Monitoreo de Performance en Producción
- Sistema en `productionMonitoring.ts` para integración con Sentry/DataDog
- Soporte para múltiples proveedores: Sentry, Datadog, Custom
- Captura de excepciones con contexto
- Tracking de mensajes con niveles (info/warning/error)
- Gestión de usuarios y tags
- Transacciones para performance tracing
- Breadcrumbs para seguimiento de eventos

### Load y Stress Testing
- Suite de tests de carga con k6 en `load-test/load-test.js`
- Escenarios de ramp-up: 10 → 50 → 100 usuarios concurrentes
- Tests de carga de página, navegación a juegos, simulación de interacción
- Métricas: tiempo de respuesta, tasa de error, percentiles
- Script: `npm run test:load`
- Configuración de thresholds para CI/CD

### Escaneo de Seguridad Automatizado
- Workflow de GitHub Actions en `.github/workflows/security-scan.yml`
- SAST con CodeQL (JavaScript/TypeScript)
- Dependency scanning con Snyk
- NPM audit para vulnerabilidades
- Bandit security scan
- Semgrep para análisis de seguridad
- Ejecución automática en push, PR y schedule semanal

### Documentación de Arquitectura con Diagramas
- Documentación completa en `docs/ARCHITECTURE.md`
- Diagramas de arquitectura en capas
- Estructura de directorios y módulos
- Diagramas de flujo de datos
- Diagramas de secuencia (game launch, score saving)
- Diagramas de componentes (GameRegistry, ViewManager)
- Arquitectura de despliegue PWA
- Patrones de diseño implementados
- Consideraciones de performance, seguridad y accesibilidad

### Internacionalización (i18n)
- Sistema completo en `i18n.ts` con soporte para 8 idiomas
- Idiomas: Español, Inglés, Portugués, Francés, Alemán, Japonés, Chino, Árabe
- Detección automática de idioma del navegador
- Persistencia de preferencia de idioma
- Soporte para RTL (árabe)
- API simple: `t('key')`, `i18n.setLocale('en')`
- Eventos para actualización de_ui
- 80+ traducciones para UI común

---

## Mejoras de Calidad y Mantenibilidad (v3.0.0)

### Sistema de Logros y Trofeos Expandido
- Sistema completo en `achievements.ts` con 20+ logros
- **Logros por juego** con condiciones específicas (perfect game, rondas, tiempo de reacción)
- **Cadenas secuenciales** que requieren logros previos para desbloquear
- **Logros temporales** por temporada con eventos especiales
- **Sistema de recompensas**: XP, títulos, cosméticos con rarezas (common, rare, epic, legendary)
- **Eventos personalizados**: `achievement:unlocked`, `xp:gained`, `title:unlocked`, `cosmetic:unlocked`
- **Progreso visual** por logro con porcentaje completado
- **Filtrado** por categoría, rareza y estado
- API expuesta: `achievementManager`, `trackGamePlayed()`, `trackGameCompleted()`, `getUnlockedTitles()`

### Sistema de Progresión y RPG
- Sistema completo en `progressionSystem.ts` con 100 niveles
- **Sistema de niveles** con títulos desbloqueables (Recluta → Gran Mariscal)
- **Skill tree** con 8 habilidades mejorables:
  - Tiempo Extra I/II (+5/+10 segundos)
  - Puntuación Extra I/II (+10%/+25%)
  - Aprendizaje Rápido I/II (+15%/+30% XP)
  - Vidas Extra (+1 vida)
  - Sistema de Pistas
- **Daily quests** con 5 misiones diarias rotativas
- **Season pass** de 50 niveles con recompensas free y premium
- **Sistema de rachas** con seguimiento de días consecutivos
- **Bonus activos** aplicados automáticamente según habilidades desbloqueadas
- Eventos: `progression:xp_gained`, `progression:level_up`, `progression:skill_unlocked`, `progression:quest_completed`
- API expuesta: `progressionSystem`, `addXP()`, `unlockSkill()`, `getDailyQuests()`

### Sistema de Personalización Avanzada
- Sistema completo en `customizationSystem.ts` con múltiples opciones
- **8 avatares** desbloqueables con diferentes rarezas (Robot, Alien, Ninja, Mago, Dragón, etc.)
- **Skins** para juegos, interfaz y cursor (neón, retro, cyber, glass, rainbow, fire)
- **4 packs de sonido** (default, retro 8-bit, orquestal épico, naturaleza relajante)
- **6 marcos de perfil** con efectos visuales (dorado, plateado, diamante, arcoíris, neón)
- **4 animaciones de victoria** (confeti clásico, fuegos artificiales, partículas mágicas, victoria épica)
- **5 temas personalizados** (default, midnight, forest, ocean, sunset)
- **Creador de temas custom** con colores y fuentes personalizables
- **Sincronización** con sistema de logros para desbloqueos
- Eventos: `customization:avatar_changed`, `customization:theme_changed`, `customization:reward_claimed`
- API expuesta: `customizationSystem`, `setActiveAvatar()`, `createCustomTheme()`, `playVictoryAnimation()`

### Sistema de Estadísticas Avanzadas
- Sistema completo en `advancedStats.ts` con análisis profundo
- **8 categorías cognitivas**: Memoria, Reflejos, Lógica, Percepción, Tipeo, Análisis, Cifrado, Estrategia
- **Análisis de fortalezas/debilidades** con recomendaciones personalizadas
- **Heatmap de actividad** por hora y día de la semana
- **Gráficos de tiempo de juego** (semanal y mensual)
- **Predicciones de nivel** y juegos sugeridos
- **Comparación con promedios globales** y percentiles
- **Métricas de rendimiento**: accuracy, speed, consistency, improvement
- **Perfil cognitivo** con categorías dominantes y balance
- **Exportación/importación** de datos en JSON
- API expuesta: `advancedStatsSystem`, `recordGamePerformance()`, `getWeaknessAnalysis()`, `getCognitiveProfile()`

### Sistema de Multiplayer en Tiempo Real
- Sistema completo en `multiplayerSystem.ts` usando Supabase Realtime, sobre las tablas `live_matches`/`match_messages` (`migration_005_coop_rooms.sql`/`migration_008_room_settings.sql`).
- **Salas por código**, no matchmaking automático: `createRoomMatch()` genera un código de 4 caracteres (sin `0`/`O`/`1`/`I` para que sea fácil de compartir de palabra) y crea la sala; el segundo jugador se une con `joinRoomMatch(gameId, roomCode, role)`. Quien crea la sala fija la dificultad/config (`settings`) y el que se une la recibe de solo lectura. Un matchmaking automático por nivel de habilidad existió en el código pero **fue eliminado**: dependía de una tabla (`matchmaking_queue`) que nunca llegó a existir en el schema real, así que el botón fallaba siempre en producción.
- **Partidas 1v1** en tiempo real con sincronización de scores (`updateScore()`), y transmisión de eventos de juego estructurados punto a punto vía `sendGameEvent()`/`multiplayer:game_event` (usado por el split-view, ver abajo). Al terminar la partida, Simon/Arrow/Termita llaman `finishRoomMatch(score)`, que guarda el score propio y marca la sala `completed` en Supabase — antes de esto ningún juego cerraba la sala y `live_matches` quedaba `'playing'` para siempre, reservando el código indefinidamente (el índice único de `room_code` solo libera código en `completed`/`abandoned`).
- **Leaderboards en vivo por partida**: `updateLeaderboard()`/`getLeaderboard()` viven enteramente en memoria del lado del cliente (no hay tabla `live_leaderboard` en el schema real) — se resetean al recargar la página, no son un ranking persistente global (para eso existe el scoreboard de `scores`/`best_scores`, aparte).
- **Sistema de chat** durante partidas (`sendMatchMessage`), reutilizando la misma tabla `match_messages` que los eventos de juego.
- **Modo espectador** (`spectateMatch()`) y listado de salas activas (`listActiveMatches()`) para la UI de "Partidas Activas".
- **Estado de jugador** (online, playing, away) — se mantiene solo en memoria/localStorage local, no se persiste en Supabase (no existe tabla `players` en el schema real).
- Sin fallback offline: a diferencia del resto del proyecto, las salas por código requieren conexión a Supabase — sin ella, `createRoomMatch`/`joinRoomMatch` rechazan explícitamente en vez de fallar en silencio, porque dos pestañas no tienen forma de enterarse la una de la otra sin un servidor real de por medio.
- Los brackets de torneos **no** viven acá — son un sistema aparte, ver [Sistema de Torneos y Eventos](#sistema-de-torneos-y-eventos) más abajo (`tournamentSystem.ts`).
- Eventos: `multiplayer:match_started`, `multiplayer:score_updated`, `multiplayer:match_ended`, `multiplayer:leaderboard_updated`, `multiplayer:game_event`, `multiplayer:player_status_changed`.
- API expuesta: `multiplayerSystem`, `createRoomMatch()`, `joinRoomMatch()`, `sendGameEvent()`, `onRoomUpdate()`, `finishRoomMatch()`, `sendMatchMessage()`, `spectateMatch()`, `listActiveMatches()`.

#### Split-view (tablero del rival en vivo)

Mecanismo compartido en `js/utils/multiplayerSplitView.ts` (`setupSplitView()`) que, cuando hay una sala activa para el juego actual, muestra un panel con el propio tablero y una copia de solo lectura del tablero del rival, sincronizada en vivo vía `multiplayerSystem.sendGameEvent` / evento `multiplayer:game_event`. Pensado para juegos donde ambos jugadores compiten en paralelo sobre el mismo tablero (no aplica al modo coop asimétrico de Letters Fall). Integrado en tres juegos:

- **Simon** — tablero espejo completo (clona los botones reales vía `remirror()`). Emite `simon:flash` (memorización), `simon:press` (input), `simon:gameover` (resultado). La secuencia no está sincronizada entre jugadores: cada uno genera la suya, así que el split muestra el progreso del rival en su propia partida, no la misma secuencia.
- **Arrow** — panel resumen en vez de tablero espejo (solo símbolo actual + combo), en lugar de clonar toda la UI de progreso/secuencia. Emite `arrow:input` y `arrow:gameover`.
- **Termita** — tablero espejo completo (grid de celdas por `data-index`). Emite `termita:light`/`termita:clear` (fase de memorización), `termita:select` (clicks), `termita:result` (puntaje acumulado).

**Limitación conocida**: el tablero rival (Simon/Termita) solo tiene contenido una vez que el propio jugador construyó su tablero al menos una vez (presionar "Empezar" dispara `remirror()`) — no apenas el rival arranca su partida. En la práctica no suele notarse porque ambos jugadores llegan al juego casi al mismo tiempo vía `onRoomUpdate` en `multiplayer.logic.ts`. Ver el comentario de cabecera en `multiplayerSplitView.ts` para el contrato de integración de un juego nuevo.

### Sistema Social Completo
- Sistema completo en `socialSystem.ts` con features sociales completas
- **Sistema de amigos** con solicitudes, favoritos y estado online
- **Clanes** con roles (leader, officer, member) y XP grupal
- **Chat global y privado** con diferentes tipos de mensajes (text, system, achievement, challenge)
- **Muro de perfil** con posts, likes y comentarios
- **Sistema de kudos** para reconocer a otros jugadores
- **Estadísticas sociales**: amigos, miembros de clan, kudos dados/recibidos, posts
- **Subscripciones realtime** con Supabase para actualizaciones en vivo
- Eventos: `social:friend_updated`, `social:clan_joined`, `social:chat_message`, `social:kudos_sent`
- API expuesta: `socialSystem`, `sendFriendRequest()`, `createClan()`, `sendChatMessage()`, `createProfilePost()`

### Sistema de Torneos y Eventos
- Sistema completo en `tournamentSystem.ts` con eventos regulares
- **Torneos semanales** automáticos con brackets de eliminación directa
- **Eventos temáticos** (Halloween, Navidad, Cyber Week, Retro Week)
- **Sistema de desafíos** por evento con milestones y recompensas
- **Temas visuales especiales** por evento con efectos únicos
- **Recompensas exclusivas** para ganadores (XP, cosméticos, títulos)
- **Historial de torneos** con resultados pasados
- **Generación automática de brackets** (single elimination, double elimination, round robin)
- **Registro de participantes** con límite de cupo
- Eventos: `tournament:registered`, `tournament:match_started`, `event:challenge_completed`, `event:theme_applied`
- API expuesta: `tournamentSystem`, `registerForTournament()`, `getActiveTournaments()`, `updateEventChallengeProgress()`

### Service Worker Avanzado
- Versión actualizada a v3.0.0
- Estrategias de caching avanzadas:
  - Cache First con Stale-While-Revalidate para assets estáticos
  - Network First con timeout para HTML y JS crítico
  - Cache First para CSS
  - Cache First con expiración larga para imágenes
  - Network First con cache corto para API de Supabase
- Background sync para leaderboard y favoritos
- Push notifications con click handler
- Message handler para skipWaiting y clearCache
- Limpieza automática de caches antiguos

### Analytics con Gestión de Consentimiento
- Sistema completo en `analytics.ts` respetuoso de la privacidad
- Gestión de consentimiento granular (analytics, performance, errors, preferences)
- Opt-in por defecto (GDPR compliant)
- Banner de consentimiento
- Tracking de eventos: page views, game start/complete/abort, feature use, errors, performance, preferences
- Exportación de datos del usuario
- Derecho al olvido (deleteData)
- API expuesta en window: `analytics`

---

## Mejoras de Experiencia de Usuario (v3.0.0)

### Dark Mode / Tema Claro
- Sistema completo en `themeManager.ts` con soporte para light/dark/auto
- Detección automática de tema del sistema
- Persistencia de preferencia de tema
- Transiciones suaves entre temas
- Actualización de meta theme-color para móviles
- Eventos para actualización de UI
- API simple: `themeManager.setTheme('dark')`, `themeManager.toggleTheme()`

### Sistema de Logros
- Sistema completo en `achievements.ts` con 16 logros desbloqueables
- Categorías: juegos, rachas, puntuaciones, tiempo, especiales
- Tracking automático de progreso
- Notificaciones de logros desbloqueados
- Progreso de logros en porcentaje
- Exportación/importación de datos de logros
- API expuesta en window: `achievementManager`

### Estadísticas de Jugador Mejoradas
- Sistema completo en `playerStats.ts` con estadísticas detalladas
- Estadísticas por juego: jugados, completados, mejor puntuación, tiempo promedio
- Estadísticas globales: total jugados, favorito, más jugado, rachas
- Top juegos por puntuación, jugados, completados
- Juegos recientes
- Estadísticas de tiempo de juego
- Tasa de completación
- Exportación/importación de estadísticas

### Modo de Práctica
- Sistema en `practiceMode.ts` para practicar sin afectar estadísticas
- Modos: normal, práctica, tutorial
- Opciones: pistas, tiempo ilimitado, cámara lenta, saltar tutorial
- Ajuste automático de tiempo y dificultad
- Sistema de pistas contextuales por juego
- Estadísticas separadas para práctica

### Sistema de Confetti Mejorado
- Sistema en `confettiEffect.ts` con múltiples patrones y formas
- Formas: cuadrado, círculo, estrella, corazón, diamante
- Patrones: celebración, lluvia, cañón, espiral
- Configuración personalizable: colores, formas, gravedad, fricción
- Funciones helper: `triggerConfetti()`, `triggerConfettiRain()`, etc.

### Efectos de Sonido Mejorados
- Sistema en `enhancedAudio.ts` con más de 20 efectos de sonido
- Tipos de onda: sine, square, sawtooth, triangle
- Envelope ADSR para control de sonido
- Secuencias y acordes
- Sonidos especiales: logros, errores, victoria
- Control de volumen y mute

### Sistema de Notificaciones
- Sistema en `notificationSystem.ts` con notificaciones toast
- Tipos: success, error, warning, info, achievement
- Animaciones suaves de entrada/salida
- Acciones personalizables en notificaciones
- Auto-dismiss con duración configurable
- Integración con logros y cambios de tema

### Presets de Dificultad
- Sistema en `difficultyPresets.ts` con 4 niveles de dificultad
- Niveles: fácil, normal, difícil, experto
- Ajustes: tiempo, puntuación, pistas, errores permitidos, velocidad, complejidad
- Configuración personalizada por juego
- Ajuste automático de tiempo y puntuación
- Navegación entre niveles de dificultad

### Sistema de Replay de Partidas
- Sistema en `gameReplay.ts` para grabar y reproducir partidas
- Grabación de eventos: input, estado, puntuación, completado, error
- Reproducción con sincronización temporal
- Exportación/importación de replays
- Compartir replays vía URL
- Estadísticas de replays
- Mejores replays por juego

### Compartir en Redes Sociales
- Sistema en `socialSharing.ts` para compartir contenido
- Plataformas: Twitter, Facebook, LinkedIn, WhatsApp, Telegram, Reddit, Email
- Compartir puntuaciones, logros, juegos, leaderboard
- Soporte para Web Share API nativo
- Fallback a portapapeles
- Generación de imágenes para compartir
- Copiar enlace de compartir

---

## Cuentas de usuario y scoreboard global

A diferencia del resto de la app (100% cliente, sin red), el sistema de cuentas necesita un backend real: **un nombre de usuario único + contraseña no se puede validar de forma segura solo con `localStorage`** — cualquiera con acceso al navegador puede leer o editar esos datos. Por eso esta parte del proyecto usa [Supabase](https://supabase.com) (Postgres + autenticación + API, alojado por Supabase, gratis en el tier usado acá) como backend.

### ⚠️ Pasos pendientes antes del primer uso

El esquema de base de datos **no se aplica solo** — hay que correrlo una vez a mano:

1. Entrá al [dashboard de tu proyecto Supabase](https://supabase.com/dashboard) → **SQL Editor** → **New query**.
2. Pegá el contenido completo de **`supabase/schema.sql`** y ejecutalo. (Si ya lo corriste antes de la fecha en que se agregó `security_invoker` / `(select auth.uid())` a este archivo, corré también `supabase/migration_001_fix_advisors.sql` — corrige las advertencias de Database → Advisors sin tocar datos existentes.)
3. Corré también **`supabase/migration_002_rate_limit_scores.sql`** — agrega un trigger que rechaza más de 10 inserts de `scores` por usuario en 60 segundos. Sin esto, nada impide que una cuenta logueada llame a la API de Supabase en bucle para inflar el ranking global (ver [`docs/SUPABASE_RATE_LIMITING.md`](./docs/SUPABASE_RATE_LIMITING.md) para el resto de los límites de Auth, que se configuran desde el dashboard y no requieren SQL).
4. Corré en orden las migraciones restantes — cada una depende de que la anterior ya se haya aplicado:
   - **`migration_003_scores_value_check.sql`** — agrega un `CHECK (value >= 0)` en `scores`, ya que RLS por sí sola no valida el valor insertado.
   - **`migration_004_global_activity_rank.sql`** — crea la vista `global_activity_rank` que alimenta el panel "TOP GLOBAL" del HUD lateral (antes hardcodeado con datos de ejemplo).
   - **`migration_005_coop_rooms.sql`** — crea `live_matches` y `match_messages`, las tablas reales detrás del multiplayer por salas con código (`createRoomMatch`/`joinRoomMatch`, ver más abajo). **Sin esta migración el multiplayer por salas no funciona.**
   - **`migration_006_social_tournaments.sql`** — crea las 7 tablas que necesitan `socialSystem.ts` y `tournamentSystem.ts` (amigos, solicitudes, clanes, miembros de clan, chat, torneos, participantes). Sin esto, el sistema social y de torneos no tiene dónde persistir nada.
   - **`migration_007_friends_delete_policy.sql`** — agrega la policy de `DELETE` en `friends` que `migration_006` había omitido; sin ella, `removeFriend()` fallaba siempre en producción (silenciosamente).
   - **`migration_008_room_settings.sql`** — agrega la columna de `settings` compartidos en `live_matches`, para que la dificultad que fija quien crea una sala (simon/arrow/termita/letters) se propague al segundo jugador.
5. Verificá en **Table Editor** que aparecieron las tablas `profiles`, `scores`, `live_matches`, `match_messages`, `friends`, `clans`, etc., y la vista `best_scores`.
6. **Desactivá "Confirm email"**: Dashboard → **Authentication** → **Providers** → **Email** → apagá "Confirm email". Está activado por defecto en todo proyecto nuevo. El registro de este juego usa un email sintético interno (`usuario@minijuegos.local`, ver `authManager.ts`) que Supabase nunca podrá entregar de verdad — con la confirmación activada, cualquier registro queda atascado sin sesión. `authManager.ts` detecta este caso y devuelve un mensaje de error explicando qué hacer, en vez de fallar en silencio.

Sin el paso 2, el registro/login va a fallar (la tabla `profiles` no existe). Sin el paso 6, el registro parece fallar con un error de "no se pudo iniciar sesión automáticamente" pese a que las tablas estén bien. El paso 3 no bloquea el uso básico (todo funciona sin él), pero sin rate limiting el scoreboard global queda expuesto a manipulación. Los pasos 4-5 son necesarios para que multiplayer, social y torneos funcionen contra datos reales — sin ellos, esas pantallas cargan pero cualquier operación de escritura falla contra tablas inexistentes.

### Cómo funciona

```
┌─────────────┐   signUp(email sintético, password)   ┌──────────────────┐
│  Registro/    │ ─────────────────────────────────────▶ │  Supabase Auth    │
│  Login (UI)   │                                        │  (auth.users:     │
│  cuenta.ts    │ ◀───────────────────────────────────── │  password hasheado │
└──────┬────────┘         sesión (JWT)                   │  con bcrypt)       │
       │                                                  └──────────────────┘
       │ insert({id, username})
       ▼
┌──────────────────┐        RLS: solo el dueño          ┌──────────────────┐
│  public.profiles  │ ◀──── puede insertar su propia ──── │  Row Level         │
│  username único    │       fila (auth.uid() = id)       │  Security          │
│  (case-insensitive)│                                     │  (supabase/         │
└────────────────────┘                                     │  schema.sql)        │
                                                             └──────────────────┘
┌──────────────────┐   Leaderboard.save() dispara         
│  leaderboardManager│ ──submitScore() fire-and-forget──▶  public.scores
│  (100% local,       │   (solo si hay sesión activa)      (un score por partida,
│   sigue funcionando  │                                    inmutable)
│   offline)           │
└──────────────────────┘
```

- **`js/authManager.ts`**: registro, login, logout y sesión actual. El formulario le pide al usuario solo *nombre + contraseña* (no email), pero Supabase Auth está construido alrededor de email+password — se deriva un email sintético internamente (`"Ana_99"` → `"ana_99@minijuegos.local"`), nunca mostrado ni usado para enviar nada real. La unicidad de nombre (sin distinguir mayúsculas) la impone un índice único en `public.profiles`, no el frontend.
- **`js/core/supabaseClient.ts`**: el SDK de `@supabase/supabase-js` se carga con `import()` dinámico (no import estático) para que quede en su propio chunk separado del bundle inicial — pesa varios cientos de KB sin comprimir, y la mayoría de las visitas ni siquiera van a loguearse. `getSupabaseClient()` cachea la promesa de inicialización, así que llamarla desde varios lugares en paralelo no dispara múltiples cargas.
- **`js/globalScores.ts`**: puente entre el leaderboard local y la tabla `scores`. Separado a propósito de `leaderboardManager.ts` — el guardado local sigue siendo 100% síncrono y offline-first; `submitScore()` es fire-and-forget y solo actúa si hay sesión activa, sin bloquear ni afectar el flujo del juego si Supabase está caído.
- **`js/toast.ts`**: notificaciones flotantes no bloqueantes. Existe específicamente porque `submitScore()` es fire-and-forget — antes de este módulo, un fallo al subir el score al scoreboard global (red caída, rate limit) era 100% silencioso: solo quedaba un `console.error` que ningún jugador iba a ver nunca, pese a que el jugador esperaba legítimamente aparecer en el ranking global. No es un sistema de notificaciones genérico: está pensado para "algo falló en segundo plano, esto es FYI" — errores que si bloquean el flujo (login fallido) se siguen manejando con el mensaje inline en `accountView.ts`, no con un toast.
- **`js/views/cuenta.ts` + `js/accountView.ts`**: la vista (tabs login/registro + panel de sesión activa) y su lógica de interacción, mismo patrón `data-ui` + delegación de eventos que el resto del proyecto.
- **Ranking global**: la vista Ranking (`js/views/ranking.ts`) tiene una segunda sección, separada del ranking local existente, con un selector de módulo que consulta `public.best_scores` (una vista SQL que ya filtra al mejor score de cada usuario por juego, para no traer partidas repetidas del mismo jugador).

### Seguridad real (Row Level Security)

La seguridad de este sistema **no depende de que el frontend se comporte bien** — depende de las políticas RLS definidas en `supabase/schema.sql`, que la base de datos aplica sin importar qué llame a la API:

- Cualquiera (incluso sin sesión) puede **leer** `profiles` y `scores` — necesario para que el scoreboard sea público.
- Solo un usuario autenticado puede **insertar** en `scores`, y únicamente con su propio `user_id` (`auth.uid() = user_id`). Nadie puede insertar un score a nombre de otro jugador, ni siquiera abriendo DevTools y llamando a la API de Supabase directamente con su propia sesión.
- Los scores son inmutables: no hay política de `UPDATE`/`DELETE`, por diseño — evita manipular el historial después del hecho.
- El hashing de contraseñas (bcrypt), la comparación a tiempo constante y la firma de tokens de sesión los maneja Supabase Auth del lado del servidor; este proyecto nunca ve una contraseña en texto plano más allá de pasarla al SDK en el momento del submit.

`SUPABASE_URL` y la clave **anon/public** (en `supabaseClient.ts`) son seguras para exponer en el cliente — es el diseño de Supabase, no un descuido. La única clave que nunca debe aparecer en el frontend es la `service_role` key, que sí se salta RLS por completo.

### Bug de bundling encontrado y su solución (Rolldown)

Este proyecto usa **Vite 8**, que por defecto usa **Rolldown** (motor de build en Rust, todavía experimental) en vez de Rollup clásico. Al integrar Supabase se encontró que `manualChunks` **como función** en `vite.config.ts` no separaba correctamente el SDK de Supabase en su propio chunk — el módulo quedaba arrastrado dentro de `bootstrap` (247 KB sin comprimir) pese a que la condición de matching dentro de la función sí se cumplía (verificado imprimiendo el `id` recibido). Se probaron varias formas del patrón de matching y la sintaxis alternativa de objeto (`manualChunks: { 'x': [...] }`, que directamente no está soportada en esta versión y tira `TypeError: manualChunks is not a function`), sin éxito.

La solución fue evitar `manualChunks` por completo para este caso: `supabaseClient.ts` carga el SDK con `import()` dinámico (el mismo mecanismo de code-splitting que ya usan los 26 `*.logic.ts` de los juegos, que sí funciona de forma confiable) en vez de un import estático arriba del archivo. Resultado: el chunk `bootstrap` volvió a ~33 KB, y el chunk de Supabase (~215 KB) no aparece en el precache/modulepreload inicial de `index.html` — solo se descarga la primera vez que alguien realmente interactúa con login/registro/scoreboard.

El único costo cosmético de esta solución era que Rollup nombraba ese chunk lazy con un hash genérico sin sentido (`dist-[hash].js`) porque el nombre por defecto de un chunk lazy sale de su "módulo de entrada" — y el módulo de entrada de `import('@supabase/supabase-js')` es el propio paquete de `node_modules`, no algo bajo `/js/` con un nombre reconocible. Esto se resolvió con `chunkFileNames` como función (a diferencia de `manualChunks`, esta sí opera de forma confiable en Rolldown 1.1.3): inspecciona `chunkInfo.moduleIds` y, si el chunk contiene algún módulo bajo `node_modules/@supabase/`, le asigna el nombre `vendor-supabase-[hash].js`. Puramente cosmético — no cambia qué se separa de qué ni cuándo se descarga cada chunk — pero hace mucho más legible la salida de `npm run build` y el Network tab del navegador.

---

## PWA y Service Worker

- **`manifest.json`**: nombre, íconos (72px a 512px + maskable), tema oscuro, orientación `portrait-primary`, `display: standalone`.
- **`sw.ts`**: se compila por separado de la app principal (`npm run build:sw`, con su propio `tsconfig.sw.json`), porque Vite hashea los nombres de los bundles de JS/CSS en cada build (`games-tLZmfn3i.js`, distinto en cada compilación) — un Service Worker no puede listar esos nombres de forma estática sin romperse en el siguiente deploy.
  - **Precache estático** (`STATIC_ASSETS`): solo rutas con nombre estable (`/`, `/index.html`, `/manifest.json`). Un solo 404 en `cache.addAll()` aborta el precache completo, así que deliberadamente no se listan los chunks hasheados ahí.
  - **Cache en caliente** ("Network First"): los bundles hasheados se cachean dinámicamente a medida que se solicitan, en el handler de `fetch`.
  - Limpieza de caches obsoletas en el evento `activate`, comparando contra `STATIC_CACHE`/`DYNAMIC_CACHE`/`CACHE_NAME` vigentes.

---

## Testing

Framework: **Vitest** + **jsdom**. Configuración en `vitest.config.ts`; mocks globales (`localStorage`, `console`) en `test/setup.ts`.

```bash
npm test          # modo watch
npm run test:run  # una sola pasada (usado en CI)
npm run test:ui   # UI interactiva
```

| Archivo | Qué cubre |
|---|---|
| **`gameRegistry.test.ts`** | El registro central: `register`, `visible`/`all`, `ensureInit` (incluyendo el flujo `logic` con `import()` dinámico y su cacheo), `prefetch`, `resolveUi`, `stopGame`. |
| **`dataUiIntegrity.test.ts`** | Verificación de integración genérica: para cada uno de los 26 juegos, extrae todas las claves `ui.<algo>` que su `.logic.ts` referencia y falla si la vista correspondiente no declara el `data-ui="<algo>"` equivalente. Detectó y previene la regresión de un bug real (ver [Deuda técnica conocida](#deuda-técnica-conocida)). Incluye además un test de cobertura que verifica que todo archivo `.logic.ts` en `js/games/` tenga un `viewId` asociado, para que un juego nuevo no quede fuera de esta verificación por accidente. |
| **`inputAccessibility.test.ts`** | Dos verificaciones. (1) Recorre las 40 vistas registradas en `viewTemplates.ts` y exige que cada `<input>`/`<select>`/`<textarea>` tenga una etiqueta accesible real: `aria-label`, `aria-labelledby` apuntando a un id que existe de verdad, `label[for]` emparejado, o `<label>` envolvente. (2) Recorre también cada `<button>`, simulando la hidratación real de `hydrateBackButtons()` (ver `js/utils/backButton.ts`) para no dar falso positivo en los `.back-btn` que reciben su `aria-label` recién en runtime — un botón vacío en el HTML estático de una vista puede estar perfectamente bien si algo lo hidrata después; un test que no simule esa hidratación no lo puede saber. Parsea HTML real con jsdom (no regex), lo que permitió detectar un caso donde el label visual estaba fuera del elemento que técnicamente lo envolvía — invisible a una revisión manual rápida. |
| **`viewTemplates.test.ts`** | Contrato de `ViewTemplate`: cada vista registrada exporta un `default()` puro (sin argumentos, sin dependencias del DOM) que devuelve HTML no vacío, y es idempotente (dos invocaciones seguidas producen el mismo markup). |
| **`sidebarViews.test.ts`** | Que Estadísticas/Progreso/Ranking se rellenen con datos reales de `GameRegistry`/`Leaderboard`/`Favorites` al recibir el evento `view-shown` real — contra el DOM real de la app, no un contenedor inventado. |
| **`configReset.test.ts`** | El flujo de doble confirmación del botón "Borrar todos los récords": primer clic arma, segundo clic ejecuta `Leaderboard.clear()`, y navegar a otra vista sin confirmar descarta el estado pendiente. |
| **`configPanel.test.ts`** | El selector de tema sigue funcionando aunque `localStorage.getItem`/`setItem` lancen excepción (simulación de Tracking Prevention / modo privado estricto), y que los dos selectores de tema del sitio (header + vista Configuración) queden sincronizados entre sí. |
| **`favoritesManager.test.ts`** | Alta/baja de favoritos y persistencia. |
| **`leaderboardManagerTotal.test.ts`** | Que `save(gameKey, value, total)` persista `total` en `meta.total` (recuperable con `getEntryTotal`), que el resto de `meta` no se pierda al agregarlo, que no invente un total para llamadores que no lo pasan (retrocompatibilidad), y que `getEntryTotal` no crashee ante datos corruptos. |
| **`arrowGameFlashButton.test.ts`** | Que el D-pad táctil de Arrow Game aplique `active-success`/`active-fail` (no siempre la misma clase) según el parámetro `correct`, que la clase se limpie tras el timeout, y que una tecla sin flecha asociada no crashee `flashButton`. Monta la vista real; como la secuencia de flechas es aleatoria, prueba las 4 teclas posibles en vez de asumir cuál es la correcta. |
| **`buildStaticAssets.test.ts`** | El único test de la suite que corre `vite build` de verdad (a un `outDir` separado) en vez de operar sobre el código fuente: verifica que `css/` y `assets/` sobrevivan al build de producción y que un archivo servido desde `dist/css/` tenga contenido CSS real, no el fallback SPA de `index.html`. Ver [Deuda técnica conocida](#deuda-técnica-conocida) para el bug que motivó este test — el más grave de los detectados, porque era invisible en `npm run dev` y casi invisible incluso en el `dist/` de producción sin inspeccionar el `Content-Type` de la respuesta. |
| **`authManager.test.ts`** | Registro, login, logout: validación de username/contraseña sin llamar a Supabase si ya es inválido localmente, derivación correcta del email sintético, creación del perfil tras un `signUp` exitoso, rechazo de username duplicado, traducción de errores crudos de Supabase a mensajes en español (incluyendo rate limiting, cuenta deshabilitada, sesión expirada — casos que no salen en pruebas manuales normales), y el caso de "Confirm email" activado con un dominio sintético. Cubre también robustez ante fallo de red: si `getSupabaseClient()` rechaza (offline, el `import()` dinámico del SDK no descarga), ningún método debe propagar una excepción sin capturar — se encontraron y corrigieron 3 unhandled promise rejections reales de este tipo (confirmados por el propio test suite al simular el fallo), el más grave en el listener de `onAuthStateChange` registrado en el constructor. Mockea `supabaseClient.ts` por completo — no depende de red ni de las credenciales reales del proyecto. |
| **`globalScores.test.ts`** | `submitScore` no llama a Supabase si no hay sesión activa, inserta con el `user_id` correcto cuando sí la hay, no lanza si la red falla ni si falla la carga del SDK (mismo tipo de robustez que `authManager.test.ts`), y muestra el toast correcto según el tipo de fallo — genérico ("no se pudo subir") o el mensaje específico de rate limiting cuando el trigger SQL de `migration_002_rate_limit_scores.sql` rechaza con el código `P0001`. `fetchGlobalTop` devuelve `[]` en vez de lanzar ante cualquier tipo de error. |
| **`toast.test.ts`** | Las notificaciones se crean con el `variant`/mensaje correcto, se auto-descartan pasado su `duration` (o no, si `duration: 0`), y múltiples toasts conviven en el contenedor sin pisarse. |
| **`multiplayerSystemInteraction.test.ts`** | Aislamiento de estado entre modos: `currentMatch` y las suscripciones no se filtran entre distintos flujos activos a la vez, un fallo en un modo no tira abajo al otro, operaciones concurrentes no corrompen el estado, y `resetData()`/las actualizaciones de estado del jugador dejan todo en el estado esperado. Mockea `supabaseClient.ts` por completo. |

**Patrón usado en los tests que tocan DOM:** montar el HTML **real** de la app (importando la vista real o copiando su estructura de contenedores reales) en vez de inventar un DOM ad-hoc que no existe en producción — un test con un DOM inventado puede dar falso verde mientras la funcionalidad real está rota (ver el caso documentado en `sidebarViews.test.ts` y en la sección de deuda técnica).

---

## Build y bundling

`vite.config.ts` define `manualChunks` explícitos para controlar el code-splitting:

- **`core`**: todo `js/core/*`.
- **`managers`**: `leaderboardManager`, `favoritesManager`, `audioManager`, `backgroundManager`.
- **`bootstrap`**: `gameBootstrap`, `app`, `transitions`, `sidebarViews`.
- **`games`**: metadata liviana de cada juego (`js/games/*.ts`, **excepto** los `*.logic.ts`).

El punto importante es esa exclusión: si los archivos `*.logic.ts` cayeran también en el chunk `games`, Rollup los empaquetaría junto con el resto y el `import()` dinámico de `GameConfig.logic` dejaría de tener efecto — el chunk pesado nunca se separaría del resto y se descargaría igual con la carga inicial, anulando todo el lazy-loading. Al no asignarles `manualChunks`, Rollup vuelve a su comportamiento por defecto: cada `import()` dinámico obtiene su propio chunk, verificable en la salida de `npm run build` (cada `<juego>.logic-<hash>.js` aparece como archivo independiente).

Minificación con **Terser**. `drop_console` está configurado como `['log', 'info']`: las trazas de debug/arranque (`"[GameRegistry] Registrado: X"`, `"[ViewManager] Vista mostrada: X"`, etc.) pasan por `js/core/devLog.ts` (`devLog`/`devWarn`, gateadas por `import.meta.env.DEV` — Vite las reduce a código muerto en build, ni siquiera llegan al bundle final), así que Terser no tiene ya casi nada que quitar salvo algún `console.log` residual que se cuele sin pasar por `devLog` — funciona como red de seguridad, no como mecanismo principal. `console.error`/`console.warn` reales (fallos de Service Worker, elementos de UI faltantes, etc.) están deliberadamente **fuera** de esta lista: son la señal que un desarrollador necesita ver al abrir la consola de un usuario que reporta un problema en producción. (`drop_debugger: true`.) Sourcemaps activos.

**`css/` y `assets/`** se copian a `outDir` con un plugin propio (`copyStaticAssets()`), no por convención de `publicDir` de Vite — ambas carpetas se referencian desde JS como rutas string planas, no como imports, así que Vite no las detecta por sí solo. Ver [Deuda técnica conocida](#deuda-técnica-conocida) para el bug real que esto corrigió y por qué era particularmente difícil de notar.

---

## CI/CD

Dos workflows de GitHub Actions en `.github/workflows/`:

### `ci.yml` — corre en cada push a `main` y en cada Pull Request

Dos jobs secuenciales:

1. **`verify`** — `npm run type-check` + `npm run test:run`. Es el que debería bloquear un merge (ver más abajo la regla de branch protection recomendada). Incluye `buildStaticAssets.test.ts`, que corre un `vite build` real contra un `outDir` aislado — por eso este job tarda un poco más que un suite puramente unitario, a propósito: es la única red que detecta regresiones de assets estáticos que solo se manifiestan en producción (ver [Deuda técnica conocida](#deuda-técnica-conocida)).
2. **`build`** — solo corre si `verify` pasó. Genera el build de producción completo (`npm run build`, incluye el Service Worker) y lo sube como artefacto descargable de la corrida. Hoy no despliega a ningún lado — es la base sobre la que engancha un paso de deploy real más adelante sin tener que rehacer el workflow.

Los pushes/PRs sucesivos sobre la misma rama cancelan la corrida anterior en vuelo (`concurrency` + `cancel-in-progress`), para no gastar minutos de CI validando un commit que ya quedó obsoleto.

### `sql-lint.yml` — corre solo cuando cambia algo bajo `supabase/`

Levanta un Postgres real (efímero, vive y muere con el job — no es tu proyecto de Supabase, no tiene tus datos) y aplica `schema.sql` y `migration_001_fix_advisors.sql` en secuencia, incluyendo una segunda aplicación de `schema.sql` al final para confirmar que de verdad es idempotente (usa `if not exists` / `or replace` en todos lados). Como Postgres vanilla no tiene `auth.users` ni `auth.uid()` (son específicos de Supabase), el workflow crea un stub mínimo de ambos antes de aplicar el schema real.

**Esto valida sintaxis y orden de dependencias, no el comportamiento exacto de Supabase** — no reemplaza probar el SQL una vez en el SQL Editor real antes de confiar en él a ciegas, pero sí atrapa errores de tipeo (encontró uno real: `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS`, sintaxis que no existe en Postgres estándar, corregido con el patrón `DO $$ ... EXCEPTION WHEN duplicate_object`) antes de que lleguen a producción.

### Branch protection recomendada (configurar en GitHub, no versionado)

En **Settings → Branches → Add rule** para `main`:
- ✅ Require status checks to pass before merging → seleccionar `Type-check & tests`.
- ✅ Require branches to be up to date before merging.

Esto convierte a `ci.yml` en un gate real: nadie puede mergear a `main` con tests rotos, sin importar quién sea. No se puede versionar esta configuración dentro del repo — es un ajuste del repositorio en GitHub, se configura una sola vez.

### Deploy: GitHub Pages

El frontend se despliega en **GitHub Pages** vía `.github/workflows/deploy.yml`: cada push a `main`/`master` construye el proyecto (`npm run build`) y publica `dist/` automáticamente. No requiere ninguna cuenta ni configuración externa — solo que **GitHub Pages esté habilitado** en el repo (Settings → Pages → Source: "GitHub Actions").

**`base` de Vite y el nombre del repo.** GitHub Pages sirve el sitio en `https://usuario.github.io/<nombre-del-repo>/`, no en la raíz del dominio — por eso `vite.config.ts` fija `base: process.env.VITE_BASE || '/Mini-juegos/'`. Si el repo en GitHub **no se llama exactamente `Mini-juegos`**, hay que actualizar el valor de `VITE_BASE` en el step "Build" de `deploy.yml` con el nombre real; de lo contrario todo el CSS/JS/audio da 404 en producción aunque el build local funcione perfecto.

**Content-Security-Policy.** GitHub Pages no permite fijar cabeceras HTTP custom (no hay equivalente al `_headers` de Cloudflare Pages), así que la política de seguridad vive como `<meta http-equiv="Content-Security-Policy">` en `index.html` — con las limitaciones que eso implica: no soporta `frame-ancestors`, `report-uri` ni cabeceras puras como `X-Frame-Options`/`Permissions-Policy`. Ver el comentario junto a esa etiqueta en `index.html` para el detalle completo de qué cubre y qué no.

**Cache del Service Worker.** GitHub Pages sirve todos los archivos con las mismas cabeceras de caché por defecto — no hay forma de forzar `Cache-Control: no-cache` solo para `sw.js` como sí permitía `public/_headers` en Cloudflare. `sw.ts` ya incluye su propia estrategia de invalidación por versión (`CACHE_NAME`) para no depender de esto, pero conviene tenerlo presente si en el futuro los usuarios reportan quedarse "atascados" en una versión vieja de la PWA.

---

## Convenciones de código

- **Comentarios que explican el "por qué", no el "qué".** Es la convención más consistente del proyecto: casi todo módulo no trivial tiene un comentario de cabecera explicando qué problema resuelve, qué patrón reemplaza, y qué pasaría si se hiciera de la forma "obvia" en su lugar. Al modificar un módulo existente, mantené ese estilo — si tu cambio invalida el razonamiento de un comentario existente, actualizalo en el mismo commit.
- **Tipado estricto, con pocas excepciones documentadas.** El proyecto completo (≈20.000 líneas de TypeScript) tiene 3 usos de `any`, todos en `Record<string, any>` para datos de minijuego intencionalmente polimórficos (`ModuleData` en `bombdefusal.logic.ts`, `MinigameData` en `virusOverload.logic.ts`) — cada módulo/minijuego trae su propia forma de datos y tipar la unión completa no aportaría seguridad real, solo ruido. Evitá introducir `any` fuera de ese patrón; si un tipo es genuinamente difícil de expresar, es preferible `unknown` + un type guard explícito (patrón usado en `safeStorage.ts` y `leaderboardManager.ts`).
- **`data-ui`, no `id`, para elementos que la lógica de un juego necesita tocar.** Ver [`data-ui`: el contrato entre vista y lógica](#data-ui-el-contrato-entre-vista-y-lógica). Si agregás una clave nueva en un `.logic.ts`, agregá el `data-ui` correspondiente en la vista **en el mismo cambio** — el test `dataUiIntegrity.test.ts` te lo va a exigir igual, pero es más fácil no olvidarlo que depurarlo después.
- **Guards defensivos en vez de asunciones sobre el DOM.** Los elementos resueltos vía `data-ui` son `HTMLElement | undefined` en el tipo `GameUi`; el patrón estándar es `if (!elemento) return;` antes de usarlo, no un `!` de aserción no nula.
- **Eventos custom para desacoplar, no imports cruzados.** `view-shown`, `leaderboard:updated`, `theme-changed` son el mecanismo preferido para que un módulo reaccione a algo que pasa en otro sin importarlo directamente. Antes de agregar un import cruzado entre dos módulos de UI que no tienen relación jerárquica clara, considerá si un evento custom encaja mejor.
- **Género y tono de los textos de UI:** todos los textos visibles están en español neutro. Mantené consistencia terminológica dentro de un mismo juego (por ejemplo, no mezclar "palabra" y "código" para referirse al mismo dato — ver la sección de deuda técnica, fue un bug real).

---

## Deuda técnica conocida

Documentado aquí a propósito, en vez de solo en el historial de commits, para que quien siga trabajando en el proyecto tenga el contexto completo sin tener que arqueológicamente reconstruirlo.

### Resuelto: contenedores del sidebar sin conectar

`js/sidebarViews.ts` apuntaba originalmente a un contenedor `#sidebar-content` que **nunca existió** en `index.html` — resto de una migración anterior en la que Estadísticas/Progreso/Ranking/Manual compartían una sola sección con pestañas. Como consecuencia:

- Los contenedores reales (`#statsGrid`, `#progressList`, `#rankingList`, `#manualList`) quedaban siempre vacíos, aunque `css/styles.css` ya tenía el diseño completo esperando (`.stat-card`, `.progress-item`, `.ranking-item`, `.manual-item`) sin usar.
- El único test que cubría el archivo (`sidebarViews.test.ts`) creaba `#sidebar-content` a mano en el DOM de prueba, algo que la app real nunca hacía — daba cobertura verde sobre una ruta de código que en producción jamás se ejecutaba.

**Corregido:** `sidebarViews.ts` ahora escucha el evento `view-shown` real (ya emitido por `viewManager.ts`) y rellena los contenedores que realmente existen, usando datos reales de `GameRegistry`/`Leaderboard`/`Favorites`. El test se reescribió para montar el DOM real de la app.

### Resuelto: `data-ui="arrowButtons"` huérfano

`arrowGame.logic.ts` implementaba un D-pad táctil completo (controles de flecha para pantallas sin teclado, con su propio texto ARIA) leyendo `ui.arrowButtons`, pero `js/views/arrow.ts` nunca declaraba ese `data-ui`. No crasheaba (había guards `if (arrowButtons)` en cada uso), simplemente la feature nunca se renderizaba.

**Corregido:** se agregó el markup del D-pad a `arrow.ts` y su CSS a `arrow.css`. Se agregó `dataUiIntegrity.test.ts` para detectar automáticamente este patrón en cualquier juego, presente o futuro.

### Resuelto: listeners de `keydown` sin limpiar al salir de un juego

12 juegos (`arrowGame`, `bouncebarGame`, `circleGame`, `holematch`, `memorygrid`, `multipointGame`, `progresstiming`, `rapidlinesGame`, `simon`, `virusOverload`, `Maze`, `keyspam`) registraban `document.addEventListener('keydown', ...)` en su `init()` pero no lo removían en `stop()`. El impacto real estaba acotado — `GameRegistry`/`GameInstanceRegistry` evitan reinicializar un juego ya montado, así que no se acumulaban listeners duplicados dentro de una misma sesión de la vista — pero seguía siendo un listener global vivo después de que el jugador ya había vuelto al lobby, atado a un handler que referencia estado (clases, closures) de una partida que ya terminó.

**Corregido:** cada juego ahora nombra su handler (`onKeyDown`, `boundKeyDown`, etc., según si vive en un closure de módulo o como propiedad de instancia de clase) y lo remueve explícitamente con `document.removeEventListener` desde su `stop()`/`cleanup()`/`destroy()`. `bouncebarGame` y `multipointGame` ya lo hacían bien y sirvieron de referencia para el resto.

### Resuelto: menú de Skill Check inalcanzable por teclado

Los 9 "cubos" de selección en `js/views/skillchecks.ts` (la puerta de entrada a Rapid Lines, Circle, Maze, Key Spam, Sequence, Rhythm Click, Progress Timing, Multi-Point y Bounce Bar) eran `<div data-game="...">` con un `click` listener en `skillchecksHub.logic.ts` y nada más — sin `role`, sin `tabindex`, sin manejo de `Enter`/`Space`. Todo ese menú era invisible para navegación por teclado.

**Corregido:** cada cubo ahora tiene `role="button"`, `tabindex="0"` y `aria-label`; el listener maneja `click` y `keydown` (`Enter`/`Space`) sobre la misma función `activate()`. De paso, el markup de los 9 cubos (antes HTML repetido casi palabra por palabra) se generó desde un array `SKILL_CUBES`, eliminando también un `</div>` huérfano que quedaba del HTML original mal balanceado.

### Resuelto: mensajes de estado sin anunciar a lectores de pantalla

Una auditoría de los contenedores de feedback dinámico (resultado de ronda, mensaje de acierto/fallo, evento crítico) encontró que la mayoría cambiaba su `textContent` sin ningún `aria-live`, así que un lector de pantalla no se enteraba del cambio salvo que el foco estuviera exactamente ahí.

**Corregido**, con un criterio explícito según la frecuencia de cambio de cada elemento (aplicado de forma consistente en `keyspam`, `maze`, `rapidlines`, `sequence`, `rhythmclick`, `holematch`, `memorygrid`, `colorcount`, `simon`, `multipoint`, `bouncebar`, `mechlock`, `reactor`, `virusOverload`, `ringpuzzle`, `bombdefusal`, `letters`):

- **Resultado final / feedback puntual por ronda** (cambia como máximo unas pocas veces por partida): `role="status" aria-live="polite"`.
- **Evento crítico que requiere acción del jugador** (`reactor`, `virusOverload` — aparece con frecuencia aleatoria baja, no en cada tick): `role="alert" aria-live="assertive"`, para que no espere cola detrás de otros anuncios.
- **Valores que cambian en cada tick del loop de render** (`circleGame` score/combo, `reactor` `stabilityEl`, `bouncebar` `bbPhase` durante countdown): **intencionalmente sin** `aria-live`. Ponerlo ahí generaría un lector de pantalla anunciando varias veces por segundo, ahogando el resto de la UI — la decisión de omitirlo está comentada in situ en cada vista para que no se lea como un olvido en una futura auditoría.

### Resuelto: texto de Typix inconsistente con su propia mecánica

`js/views/typix.ts` decía "Adivina la palabra de 5 letras", pero `generateRepeated()`/`generateUnique()` en `typix.logic.ts` generan un código de 5 dígitos (0-9), no letras — confirmado que ningún camino del juego produce letras. Es el caso concreto que motivó la nota sobre terminología en [Convenciones de código](#convenciones-de-código).

**Corregido:** el texto ahora dice "Adivina el código de 5 dígitos".

### Resuelto: botón "Borrar todos los récords" sin listener

Existía en el markup de `js/views/configuracion.ts` (`#configResetBtn`) con estilos de "botón de peligro" (incluyendo un estado `.config-danger-btn--confirm` con animación de pulso, definido en CSS pero nunca activado por nada), pero sin ningún `addEventListener`.

**Corregido:** `configReset.ts` conecta el botón con `Leaderboard.clear()`, exigiendo doble clic (arma → confirma, con descarte automático a los 4s o al cambiar de vista).

### Resuelto: `aria-label`/`aria-labelledby` faltante en 8 inputs

Una auditoría manual inicial de los 52 `<input>` en `js/views/` encontró la mayoría ya correctamente etiquetados (`<label>` envolvente, `label[for]`, `aria-label` o `aria-labelledby` apuntando a un id real), pero tres patrones sin ninguna asociación programática:

- **`progresstiming.ts` — sliders de "Velocidad" y "Tamaño de la zona":** el texto vivía en un `<span>` visual junto al `<input type="range">`, sin `aria-label` ni `aria-labelledby` conectándolo.
- **`rapidlines-game.ts` — 5 campos de configuración** (Velocidad inicial, Aceleración, Velocidad máxima, Flechas, Tiempo): `<label>` visualmente al lado de su `<input>`, pero sin el atributo `for` que los asocia de verdad.
- **`progresstiming.ts` — 6 switches** (`renderSwitch`): el `<label>` envolvía el checkbox y un `<span class="pt-toggle">` decorativo, pero el texto real del label (`opts.label`) estaba en un `<span>` **hermano**, fuera del `<label>` — este caso se le escapó a la primera revisión manual (parecía correcto a simple vista) y solo lo encontró el test automatizado, que parsea DOM real con jsdom en vez de inspeccionar visualmente.

### Resuelto: `total` de `leaderboardManager.save()` se descartaba en silencio

`save(gameKey, value, total?, meta?)` recibía `total` (Simon y Termita lo pasan como cantidad de rondas configuradas para esa partida — el jugador puede elegir entre 5 y 20) pero `LeaderboardEntry` no tenía ningún campo para persistirlo, así que un récord de "8 aciertos" no distinguía si la partida era de 8/8 rondas o 8/20.

**Decisión de producto tomada:** persistirlo en `meta.total` (el campo `meta` ya existía y ya era opcional) en vez de agregar un campo propio a `LeaderboardEntry` — evita migrar entradas ya guardadas por usuarios existentes. Se agregó el helper `getEntryTotal(entry)` (con su type guard, sin `any`) en `leaderboardManager.ts`, y se usa en el badge del lobby, `renderProgress()` y `renderRanking()` (`sidebarViews.ts`) para mostrar `score/total` cuando está disponible y solo `score` para las entradas que no lo tienen (retrocompatible por diseño, no requiere backfill). Cubierto por `test/leaderboardManagerTotal.test.ts`.

### Resuelto: el D-pad táctil de Arrow Game no distinguía acierto de fallo

`flashButton(key, correct)` recibía `correct: boolean` (los 2 call sites en `handleInput` sí lo pasaban con el valor real) pero el cuerpo de la función lo ignoraba y siempre aplicaba la misma clase `active` — a diferencia de `.arrow-display` (el símbolo central grande), que sí distingue con `.correct`/`.wrong` en verde/rojo.

**Decisión de producto tomada:** reusar exactamente la misma paleta que `.arrow-display.correct`/`.wrong` ya usa (`#4ade80`/`#22c55e` para acierto, `#f87171`/`#ef4444` para fallo — la misma que ya aparece en `bouncebarGame`, `multipointGame` y `colorcount`), en vez de introducir un color nuevo. Se agregaron `.active-success`/`.active-fail` en `arrow.css` y `flashButton` ahora las aplica según `correct`. Cubierto por `test/arrowGameFlashButton.test.ts`, que monta la vista real y prueba las 4 teclas de flecha (la secuencia es aleatoria, así que no se puede asumir cuál es la correcta de antemano).

### Resuelto: `css/` y `assets/` no sobrevivían a `vite build`

El más grave de los hallazgos de esta lista, y el más tardío en aparecer: no lo detectó ningún test, ninguna revisión de código, ni `npm run dev` (donde todo se veía perfecto). Solo apareció al inspeccionar el contenido real de `dist/` tras un build de producción.

`GameConfig.css` (24 de los 26 juegos) y `renderCube()` en `views/skillchecks.ts` (9 íconos) referencian `css/<juego>.css` y `assets/icons/<icono>.svg` como **rutas string planas**, inyectadas en runtime vía `injectCSS()`/`<img src="...">` — no como `import './archivo.css'`. Vite solo copia al `outDir` lo que reconoce como asset importado o lo que vive dentro de `publicDir` (por convención, la carpeta `public/`). Con `css/` y `assets/` en la raíz del proyecto y sin `publicDir` configurado, ninguna de las dos sobrevivía a `vite build`.

`npm run dev` ocultaba el problema por completo: con `root: '.'`, el dev server de Vite expone todo el filesystem del proyecto, así que `css/bombdefusal.css` se servía igual sin que nada estuviera realmente "copiado" a ningún lado. El bug solo existía en el `dist/` de producción — y ahí, además, era casi invisible a una inspección superficial: una petición a una ruta inexistente no devolvía 404, caía en el fallback SPA de Vite y devolvía `index.html` con `HTTP 200` (confirmado con `curl -v`, mirando el `Content-Type: text/html` de la respuesta en vez de solo el status code). El navegador cargaba ese HTML donde esperaba CSS o una imagen: sin crash visible, sin error de consola evidente, solo un juego sin sus estilos propios y un menú de Skill Check con 9 íconos rotos.

**Corregido:** un plugin liviano (`copyStaticAssets()` en `vite.config.ts`) copia `css/` y `assets/` completas a `outDir` en el hook `closeBundle`, leyendo el `outDir` real vía `configResolved` (no hardcodeado a `'dist'`, para no romperse si se sobreescribe con `--outDir`, como hace el test de regresión). Se evaluó mover ambas carpetas dentro de `public/` en su lugar, pero se descartó: hubiera requerido tocar los ~40 sitios que ya referencian esas rutas relativas al root del proyecto, por un beneficio equivalente.

Se agregó `test/buildStaticAssets.test.ts`, deliberadamente distinto al resto de la suite: **corre `vite build` de verdad** (a un `outDir` separado, para no pisar un `dist/` que el desarrollador pueda tener abierto en paralelo) y audita el filesystem de salida, no el código fuente — es el único punto de la suite que hace esto, y el único capaz de detectar esta clase de bug. Verificado deliberadamente en ambos sentidos: falla si se revierte el plugin, pasa con el plugin correcto.

### Resuelto: `test/buildStaticAssets.test.ts` copiaba al `outDir` incorrecto en su propia implementación inicial

Nota breve porque es una buena ilustración de un patrón que ya se documentó antes en esta misma sección (ver "contenedores del sidebar sin conectar"): la primera versión de `copyStaticAssets()` copiaba a `resolve(__dirname, 'dist', dir)` hardcodeado. El test de regresión, que corre el build con `--outDir dist-test-build-check` para no pisar un `dist/` real, falló inmediatamente — el plugin seguía copiando a `dist/` a secas, ignorando el `outDir` real de esa invocación. Se corrigió leyendo `config.build.outDir` en el hook `configResolved` de Vite en vez de asumir el nombre por defecto. Sirve de recordatorio de por qué vale la pena que un test de regresión se verifique a sí mismo fallando ante el bug que dice cubrir, no solo pasando en verde una vez escrito.

---

## Cómo agregar un minijuego nuevo

1. **Metadata liviana:** creá `js/games/<tuJuego>.ts` con `GameRegistry.register({...})`. Definí `id`, `name`, `tag` (categoría — se agrega solo al filtro del lobby, no hace falta registrarlo en otro lado), `icon`, `num`, `description`, `difficulty` (1–5), y `logic: () => import('./<tuJuego>.logic.js')`.
2. **Lógica pesada:** creá `js/games/<tuJuego>.logic.ts` exportando `init(ui: GameUi)` y `stop()`. Usá `GameInstanceRegistry.set/get('id', instancia)` si necesitás compartir estado entre `init` y `stop` en vez de una variable de módulo o `window`.
3. **Vista:** creá `js/views/<id>.ts` exportando por default una función `() => string` (contrato `ViewTemplate`) que devuelva el HTML de la vista, marcando con `data-ui="clave"` cada elemento que tu `.logic.ts` va a leer.
4. **Registrá la vista** agregando `'<id>': () => import('../views/<id>.js')` en `core/viewTemplates.ts`.
5. **Importá el juego** desde `js/games/index.ts` (el barrel que hace que se auto-registre al arrancar la app).
6. **(Opcional) CSS propio:** creá `css/<tuJuego>.css` y referencialo en `css` dentro de `GameConfig` — se inyecta perezosamente, no hace falta enlazarlo en `index.html`.
7. **Corré la suite completa** (`npm run test:run` + `npm run type-check`) — `dataUiIntegrity.test.ts` y `viewTemplates.test.ts` van a validar automáticamente que tu vista y tu lógica están correctamente conectadas antes de que llegue a producción.

---

## Troubleshooting

**Cambié un `data-ui` y el juego dejó de reaccionar, sin errores en consola.**
Es el patrón descrito en [`data-ui`: el contrato entre vista y lógica](#data-ui-el-contrato-entre-vista-y-lógica) — no hay chequeo de tipos entre ambos lados. Corré `npm run test:run -- dataUiIntegrity` para confirmar si la clave que cambiaste dejó de coincidir entre vista y lógica.

**Un juego nuevo no aparece en el lobby.**
Confirmá que esté importado en `js/games/index.ts` (si no se importa, nunca se ejecuta el `register()`) y que `hidden` no esté en `true` en su `GameConfig`.

**El Service Worker sirve una versión vieja tras el deploy.**
Bump de `CACHE_NAME`/`STATIC_CACHE`/`DYNAMIC_CACHE` en `sw.ts` fuerza la invalidación de caches antiguas en el próximo `activate`. Si estás debuggeando localmente, "Update on reload" en DevTools → Application → Service Workers evita el problema durante desarrollo.

**`localStorage` no persiste en modo privado / Tracking Prevention.**
Es comportamiento esperado y manejado: `SafeStorage` degrada silenciosamente (los datos viven solo para la sesión actual). Ver `configPanel.test.ts` para el caso concreto que motivó esto.
