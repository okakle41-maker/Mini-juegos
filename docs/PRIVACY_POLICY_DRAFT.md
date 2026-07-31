<!--
  ⚠️ BORRADOR — NO ES ASESORAMIENTO LEGAL

  Este documento fue redactado por un modelo de lenguaje (Claude, de
  Anthropic), no por un abogado, y no debe publicarse tal cual para un
  producto real. Está basado exactamente en lo que el código de este
  proyecto hace hoy (ver las referencias a archivos entre paréntesis),
  no en una plantilla genérica — pero eso no lo convierte en un
  documento legalmente válido.

  Antes de publicar cualquier versión de esto:
  - Hacé que lo revise un abogado, especialmente si vas a operar en
    jurisdicciones con reglas específicas de protección de datos
    (GDPR en la Unión Europea, CCPA en California, LGPD en Brasil, la
    Ley 25.326 en Argentina, etc.) — cada una exige cosas distintas
    (base legal para el tratamiento, derecho a portabilidad de datos,
    plazos de respuesta a solicitudes, etc.) que este borrador no
    necesariamente cubre.
  - Actualizalo cada vez que el código cambie qué datos se recolectan
    o cómo se usan — un documento desalineado con la realidad del
    código es peor que no tener ninguno, porque es una promesa
    incumplida.
  - Completá los campos marcados [ENTRE CORCHETES] con información real
    antes de publicar.
-->

# Política de Privacidad

**Última actualización:** [FECHA]
**Versión:** 3.0.0

## Qué datos recolectamos

### Si jugás sin crear una cuenta

Ningún dato sale de tu dispositivo. Tus récords personales, favoritos y
preferencias (tema visual, volumen) se guardan únicamente en el
almacenamiento local de tu navegador (`localStorage`) — ver
`js/core/safeStorage.ts` y los distintos managers (`leaderboardManager.ts`,
`favoritesManager.ts`) del código fuente. No tenemos acceso a esa
información: vive solo en tu navegador y desaparece si borrás los datos
del sitio.

**Datos adicionales v3.0.0 (almacenados localmente):**
- Progreso de gamificación (puntos globales, niveles, misiones semanales)
- Badges/insignias desbloqueados
- Progreso de logros secuenciales
- Preferencias de accesibilidad (contraste, tamaño de texto, daltonismo)
- Configuración de PWA (push notifications, shortcuts)
- Configuración de efectos de sonido (volumen por categoría)

### Si creás una cuenta

Para el registro (ver `js/authManager.ts`) recolectamos:

- **Nombre de usuario** — elegido por vos, visible públicamente en el
  scoreboard global. No uses tu nombre real ni información identificable
  si preferís mantener el anonimato.
- **Contraseña** — nunca la almacenamos en texto plano. Se procesa con
  hashing (bcrypt) por nuestro proveedor de autenticación, Supabase
  (supabase.com); nosotros no tenemos forma de ver tu contraseña real
  en ningún momento.
- **Un identificador interno técnico** (un email sintético derivado de
  tu nombre de usuario, con el formato `nombredeusuario@minijuegos.local`)
  — esto es un requisito técnico de nuestro proveedor de autenticación,
  no un email real, nunca se te envía nada a esa dirección, y no la
  compartimos con nadie.

Si jugás algún módulo y tenés sesión iniciada, tu puntaje puede subirse
al scoreboard global (`js/globalScores.ts`), donde queda asociado a tu
nombre de usuario y visible para cualquier otra persona que use la
aplicación.

## Qué NO recolectamos

- No usamos cookies de seguimiento ni analytics de terceros.
- No recolectamos tu dirección de email real, ubicación, ni ningún dato
  de contacto — el registro solo pide nombre de usuario y contraseña.
- No vendemos ni compartimos tus datos con terceros con fines
  publicitarios.
- **v3.0.0:** No recolectamos datos biométricos, geolocalización, ni
  información de dispositivo más allá de lo necesario para el
  funcionamiento de la PWA (Service Worker, cache local).
- **v3.0.0:** Los efectos de sonido son generados sintéticamente en
  tiempo real con Web Audio API — no se envían ni graban audio del
  usuario.

## Dónde se almacenan tus datos

- Los datos de cuenta (nombre de usuario, contraseña hasheada, scores
  asociados a tu cuenta) se almacenan en la infraestructura de
  **Supabase** (supabase.com), un proveedor de base de datos e
  infraestructura de autenticación. [COMPLETAR: región/ubicación de los
  servidores de tu proyecto de Supabase — Dashboard → Project Settings
  → General].
- Los datos locales (récords sin cuenta, preferencias) nunca salen de
  tu navegador.

## Seguridad

Aplicamos Row Level Security (políticas de acceso a nivel de base de
datos, ver `supabase/schema.sql`) para que ningún usuario pueda leer,
modificar ni insertar datos a nombre de otro. El scoreboard global es
público por diseño — cualquier persona, tenga cuenta o no, puede ver
los nombres de usuario y puntajes en el ranking.

## Tus derechos sobre tus datos

Podés solicitar:
- **Eliminar tu cuenta** y los datos asociados: [COMPLETAR: proceso —
  hoy el código no tiene una función de "borrar mi cuenta" en la UI;
  hay que decidir si se implementa en la app o se atiende manualmente
  vía [EMAIL DE CONTACTO]].
- **Acceder a qué datos tenemos sobre vos**: tu nombre de usuario y tus
  scores son visibles públicamente en el scoreboard; no guardamos
  ningún otro dato personal más allá de eso.

## Menores de edad

[COMPLETAR: definir una política — por ejemplo, edad mínima para crear
una cuenta, o una declaración de que el servicio no está dirigido a
menores de cierta edad sin consentimiento de un adulto responsable.
Esto depende de tu jurisdicción y de a quién apunta el producto.]

## Cambios a esta política

[COMPLETAR: cómo se notifican los cambios — por ejemplo, actualizando
la fecha de "Última actualización" arriba, y opcionalmente un aviso en
la propia aplicación.]

## Contacto

[COMPLETAR: email o formulario de contacto para consultas sobre
privacidad.]
