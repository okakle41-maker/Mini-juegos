# Rate limiting en Supabase Auth

Supabase Auth ya tiene rate limits por defecto (no arrancás desde cero
sin ninguna protección), pero vale la pena revisarlos y ajustarlos antes
de lanzar a usuarios reales — los valores por defecto están pensados
para desarrollo, no necesariamente para el volumen o el perfil de abuso
que puede tener un juego público.

Todo esto se configura en el dashboard, no en código — no hay nada que
versionar en el repo para esta parte.

## Dónde configurarlo

**Dashboard → Authentication → Rate Limits**

Los límites relevantes para este proyecto:

| Límite | Qué protege | Recomendación inicial |
|---|---|---|
| **Sign ups / hour** | Que alguien scriptee registros masivos (usernames tomados a propósito, spam de cuentas) | Empezar con el default de Supabase; si el juego crece, subirlo a mano según el uso real |
| **Sign ins / hour (por IP)** | Fuerza bruta de contraseña contra una cuenta existente | Dejar el default — es agresivo a propósito, y este juego no tiene "recuperar contraseña" implementado (ver más abajo), así que un usuario bloqueado temporalmente no tiene forma de resolverlo solo |
| **Token refresh / hour** | Abuso del refresco de sesión | Default suele ser suficiente, no hay necesidad de tocarlo para este uso |

## Rate limiting sobre la tabla `scores` (esto sí es relevante para este proyecto en particular)

Los límites de arriba son de **Auth** (login/registro). Pero también
importa limitar cuántos scores puede insertar un usuario en poco
tiempo — sin esto, nada impide que alguien loggeado escriba un script
que llame `submitScore()` (o directamente la API de Supabase) miles de
veces por segundo para inflar el ranking global o simplemente saturar
la base.

Supabase no tiene un rate limit nativo por tabla en el plan gratuito —
la forma correcta de resolver esto es a nivel de base de datos, con
una función que rechace inserts demasiado seguidos del mismo usuario.
Esto **sí requiere una migración SQL nueva** (no está en
`supabase/schema.sql` todavía) — se puede agregar como
`supabase/migration_002_rate_limit_scores.sql` cuando se decida el
umbral exacto (¿cuántos scores por minuto son razonables para un
jugador humano jugando varios minijuegos distintos?). No se agregó como
parte de este trabajo porque el umbral correcto depende del diseño real
de cada minijuego (cuánto dura una partida típica), y ponerlo mal
(demasiado estricto) rompería el uso legítimo.

## Sobre "recuperar contraseña"

Este proyecto (ver `authManager.ts`) no implementa recuperación de
contraseña — es una consecuencia directa de usar emails sintéticos
(`usuario@minijuegos.local`, no reales): Supabase no tiene forma de
enviar un correo de recuperación a un dominio inventado.

Esto significa que si un usuario olvida su contraseña, **hoy no hay
forma de recuperar la cuenta** — hay que registrarse con otro nombre de
usuario. Vale la pena decidir conscientemente si esto es aceptable para
el producto real:

- Si el juego sigue siendo "diversión casual, sin datos valiosos
  atados a la cuenta" (solo scores, nada que de verdad importe
  perder), puede ser una limitación aceptable a cambio de la
  simplicidad de no pedir email real.
- Si en algún momento se agrega algo de valor real a la cuenta (compras,
  progreso que costó mucho tiempo, etc.), esto se vuelve un problema de
  producto serio y ahí sí conviene migrar a pedir un email real (lo cual
  habilita recuperación de contraseña gratis, porque pasa a ser el flujo
  estándar de Supabase Auth).
