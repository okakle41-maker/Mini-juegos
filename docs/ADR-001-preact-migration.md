# ADR-001: Migración incremental a Preact

**Estado:** Aceptado, en curso
**Fecha:** 2026-08-15

## Contexto

El proyecto arrancó con una arquitectura 100% DOM nativo: cada vista es una
función que devuelve un HTML string (`ViewTemplate`), y cada minijuego tiene
un `logic.ts` que manipula el DOM directamente vía el contrato `data-ui` (ver
[README § `data-ui`](../README.md#data-ui-el-contrato-entre-vista-y-lógica)).
Ese contrato es puramente por convención de nombres — sin chequeo de tipos
entre vista y lógica — y ya causó al menos un bug real de UI silenciosamente
rota (documentado en el README).

Preact (`preact` + `@preact/preset-vite`) se agregó como dependencia y ya
hay 13 archivos `.tsx` en el repo. Esta migración avanzó de forma orgánica,
módulo por módulo, sin un criterio escrito de qué se migra primero ni cuándo
se considera terminada. Este documento registra el criterio que **ya se
siguió implícitamente** (auditado contra el código real, no supuesto) y lo
deja explícito para las próximas migraciones.

## Estado real migrado (auditado 2026-08-15)

El proyecto tiene dos categorías de vista, registradas en dos sitios
distintos:

- **30 minijuegos jugables**, registrados vía `GameRegistry.register()` en
  `js/games/index.ts` (Arrow Game, Bomb Defusal, Memory Grid, Simon, etc.).
- **9 vistas de sistema**, registradas en `js/registerSystemViews.ts`
  (paneles de lobby/meta-juego: logros, progresión, personalización,
  estadísticas avanzadas, multiplayer, lobby online, sala de espera,
  social, torneos).

De los 13 archivos `.tsx` existentes:

| Archivo | Categoría |
|---|---|
| `views/logros.logic.tsx` | vista de sistema |
| `views/progresion.logic.tsx` | vista de sistema |
| `views/personalizacion.logic.tsx` | vista de sistema |
| `views/torneos.logic.tsx` | vista de sistema |
| `components/GameCard.tsx` | componente de UI reutilizable |
| `components/FilterBar.tsx` | componente de UI reutilizable |
| `components/ModuleOfDay.tsx` | componente de UI reutilizable |
| `components/HealthCheck.tsx` | componente de UI reutilizable |
| `components/HeaderUserBadge.tsx` | componente de UI reutilizable |
| `accountView.tsx` | vista de sistema (cuenta de usuario) |
| `notificationSystem.tsx` | sistema transversal (toasts) |
| `lobbyRenderer.tsx` | orquestador del lobby (monta `GameCard` vía `render()`) |

`app.ts` (bootstrap principal, `js/main.ts` → `import './app'`) nunca tuvo
JSX real pese a haber estado nombrado `app.tsx` — un falso positivo de "ya
migrado" para quien navegara el repo por extensión de archivo. Se corrigió
como parte de este ADR: renombrado de vuelta a `.ts`.

**Ninguno de los 30 minijuegos jugables (`js/games/*.logic.ts`) está
migrado.** El patrón real seguido hasta ahora — sin que estuviera escrito en
ningún lado — es:

> Preact se adopta en vistas de sistema (paneles de meta-juego) y
> componentes de UI reutilizables. La lógica de gameplay de un minijuego
> (`js/games/*.logic.ts`, el contrato `data-ui`) no se toca.

## Decisión

Se adopta explícitamente el criterio ya seguido, con las siguientes reglas
para lo que falta:

### 1. Orden de migración

1. **Vistas de sistema restantes** (quedan 5 de 9): `estadisticas-avanzadas`,
   `multiplayer`, `online-lobby`, `match-waiting`, `social`. Mismo patrón que
   las 4 ya migradas — no requieren tocar el contrato `data-ui` de ningún
   minijuego.
2. **Componentes de UI reutilizables nuevos**, a medida que surja la
   necesidad (ya migrados: `GameCard`, `FilterBar`, `ModuleOfDay`,
   `HealthCheck`, `HeaderUserBadge`).
3. **Minijuegos jugables — fuera de alcance por ahora.** Migrar un
   `*.logic.ts` implica reescribir su contrato `data-ui` completo. Con 30
   juegos y el patrón de convivencia ya probado en las vistas de sistema, la
   recomendación es no arrancar esto sin antes correr un piloto (ver
   siguiente sección) y medir el costo real de migrar uno.

### 2. Piloto antes de escalar a minijuegos

Antes de migrar el primer minijuego jugable, se recomienda:

- Elegir **uno** de complejidad media (ni el más simple ni `bombdefusal`,
  el más grande del proyecto — ver la división en
  `js/games/bombdefusal.*.ts`).
- Migrarlo completo (vista + lógica), conservando el contrato `init(ui)` /
  `stop()` que espera `GameRegistry`, tal como ya hacen las vistas de
  sistema migradas (ver comentario de cabecera en
  `views/logros.logic.tsx`).
- Verificar contra la suite existente: `dataUiIntegrity.test.ts` y
  `viewTemplates.test.ts` deben seguir pasando o actualizarse a propósito,
  no por accidente.
- Solo después de ese piloto, decidir si se generaliza a los 29 restantes.

### 3. Convención de archivos (ya vigente, se mantiene)

- Un módulo con JSX real se nombra `.tsx`. El resto sigue en `.ts`.
- La presencia de `.tsx` es la señal de si un módulo ya fue migrado —
  ver más arriba el caso de `app.ts`, corregido como parte de este ADR
  precisamente para que esta señal sea confiable.
- Los componentes Preact se montan sobre DOM nativo vía `render(<X />, host)`
  (ver `lobbyRenderer.tsx`, `logros.logic.tsx`) — no hay (ni se plantea) un
  árbol Preact único para toda la app.

## Consecuencias

**Positivas:**
- La convivencia ya está probada en producción (4 vistas de sistema
  migradas, suite de tests en verde).
- El costo de una migración fallida se acota a un solo módulo por vez.

**Negativas / riesgo aceptado:**
- La base queda con dos paradigmas de UI conviviendo indefinidamente
  mientras dure la migración — más carga cognitiva para quien no conoce
  el criterio (mitigado por este documento).

## Referencias

- [README § Preact incremental](../README.md#preact-incremental)
- [README § `data-ui`: el contrato entre vista y lógica](../README.md#data-ui-el-contrato-entre-vista-y-lógica)
- [README § Dividir bombdefusal.logic.ts](../README.md) — ejemplo de qué tan
  grande puede ser un solo `*.logic.ts` de minijuego
