/**
 * authManager.ts — Registro, login y sesión de usuario vía Supabase Auth.
 *
 * El formulario de registro le pide al usuario solo nombre de usuario +
 * contraseña (no email) — pero Supabase Auth está construido alrededor
 * de email+password. Para no reimplementar autenticación desde cero (que
 * es exactamente el tipo de cosa que uno NO quiere reinventar: hashing
 * de contraseñas, tokens, expiración, recuperación de cuenta...),
 * derivamos un email sintético a partir del username:
 *
 *     "Ana_99" → "ana_99@minijuegos.local"
 *
 * Ese email nunca se muestra al usuario ni se usa para enviar nada; es
 * puramente la clave interna que Supabase Auth necesita. El nombre
 * "real" y único de cara al usuario vive en public.profiles.username
 * (ver supabase/schema.sql), con su propio constraint de unicidad
 * case-insensitive — evita que dos personas se registren como "Ana" y
 * "ana" pensando que son nombres distintos.
 *
 * Todo el trabajo de seguridad pesado (hashing con bcrypt, comparación
 * a tiempo constante, tokens de sesión firmados) lo hace Supabase del
 * lado del servidor; este archivo nunca ve ni maneja una contraseña en
 * texto plano más allá de pasarla directo al SDK en el momento del
 * submit.
 *
 * `getSupabaseClient()` es async (carga el SDK con import() dinámico
 * para separarlo en su propio chunk — ver supabaseClient.ts), así que
 * cada método de esta clase empieza pidiendo el cliente antes de
 * operar. La promesa está cacheada del lado de supabaseClient.ts, así
 * que llamarla muchas veces no repite la descarga del SDK.
 *
 * Nota sobre robustez de red: todos los métodos públicos (register,
 * login, logout) y la restauración de sesión al arrancar están
 * envueltos en try/catch. No es paranoia — se encontraron 3 unhandled
 * promise rejections reales (confirmados por el propio test suite al
 * simular offline) en versiones anteriores de este archivo, donde un
 * fallo de red al cargar el SDK de Supabase (getSupabaseClient()
 * rechazando) se propagaba sin capturar hacia consumidores que no
 * tenían su propio try/catch (accountView.ts hace `await
 * Auth.login(...)` directo, sin envolver la llamada).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import ErrorLogger from './core/errorLogger.js';

/**
 * Wrapper de getSupabaseClient() con import() dinámico *inline*, en vez
 * de un `import { getSupabaseClient } from './core/supabaseClient.js'`
 * estático arriba del archivo.
 *
 * La diferencia no es cosmética: Rolldown (motor de build de Vite 8)
 * decide si puede separar '@supabase/supabase-js' en su propio chunk
 * lazy mirando si *algún* módulo importa supabaseClient.ts de forma
 * estática — no importa que getSupabaseClient() en sí se llame recién
 * en runtime dentro de una promesa. Con un import estático acá, el
 * build tiraba el warning [INEFFECTIVE_DYNAMIC_IMPORT] y el SDK entero
 * (~218 KB / 56 KB gzip) terminaba en el chunk 'bootstrap' que carga
 * cualquier visitante — incluso alguien que solo juega offline y nunca
 * abre "Cuenta" ni un juego online. multiplayerSystem.ts, socialSystem.ts
 * y tournamentSystem.ts ya resolvían esto con el mismo patrón de
 * `await import(...)` inline; este archivo era el único de los cuatro
 * consumidores de supabaseClient.ts que todavía usaba un import
 * estático, y bastaba ese uno para neutralizar el code-splitting de
 * los otros tres también (el warning lista los cuatro archivos juntos).
 */
async function getSupabaseClientLazy(): Promise<SupabaseClient> {
  const { getSupabaseClient } = await import('./core/supabaseClient.js');
  return getSupabaseClient();
}

export interface AuthUser {
  id: string;
  username: string;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_DOMAIN = 'minijuegos.local';

function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@${EMAIL_DOMAIN}`;
}

/**
 * Traduce errores crudos de Supabase a mensajes que un usuario final
 * puede entender, sin exponer detalles internos de la API.
 *
 * La lista cubre los códigos de error documentados de Supabase Auth
 * que este flujo puede realmente disparar (signUp/signInWithPassword
 * con email+password) — no es exhaustiva de TODO lo que Supabase puede
 * devolver (hay decenas de códigos para OAuth, magic links, MFA, etc.
 * que este proyecto no usa), pero cubre los casos con probabilidad real
 * de ocurrir acá, incluyendo los que solo aparecen bajo uso intensivo
 * (rate limiting, ver SUPABASE_RATE_LIMITING.md) que no salen en
 * pruebas manuales normales.
 */
function friendlyError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();
  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Ese nombre de usuario ya está en uso.';
  }
  if (msg.includes('invalid login credentials')) {
    return 'Usuario o contraseña incorrectos.';
  }
  if (msg.includes('password') && msg.includes('at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  // Rate limiting de Supabase Auth: "email rate limit exceeded",
  // "over_email_send_rate_limit", o el genérico "too many requests"
  // (HTTP 429). No sale en pruebas manuales normales — solo aparece con
  // varios intentos seguidos — pero es real y sin este caso el usuario
  // vería "Ocurrió un error inesperado", que no explica que simplemente
  // tiene que esperar. Ver también SUPABASE_RATE_LIMITING.md para los
  // límites configurados en el dashboard de Supabase.
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
    return 'Demasiados intentos. Esperá un minuto antes de volver a intentar.';
  }
  if (msg.includes('user is disabled') || msg.includes('user_banned')) {
    return 'Esta cuenta está deshabilitada.';
  }
  // "Unable to validate email address" / "invalid format": no debería
  // pasar nunca en la práctica porque el email siempre lo construye
  // usernameToEmail() a partir de un username ya validado por
  // USERNAME_PATTERN — pero si algún día ese pattern cambia y permite
  // caracteres que no forman un email válido, mejor un mensaje
  // entendible que "Ocurrió un error inesperado".
  if (msg.includes('unable to validate email') || msg.includes('invalid format')) {
    return 'El nombre de usuario contiene caracteres no permitidos.';
  }
  if (msg.includes('session') && (msg.includes('not found') || msg.includes('expired'))) {
    return 'Tu sesión expiró. Iniciá sesión de nuevo.';
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'No se pudo conectar con el servidor. Revisá tu conexión.';
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

class AuthManager {
  private currentUser: AuthUser | null = null;
  private initPromise: Promise<void>;
  /**
   * true mientras register()/login()/logout() están en curso.
   *
   * Supabase-js v2 dispara `onAuthStateChange` (evento SIGNED_IN /
   * SIGNED_OUT) no solo ante cambios externos de sesión (otra pestaña,
   * refresh de token, expiración), sino también como reacción directa a
   * las propias llamadas a signUp/signInWithPassword/signOut que hacen
   * register()/login()/logout() acá abajo. Sin esta bandera, cada una de
   * esas tres operaciones terminaba disparando el flujo DOS veces:
   *
   *   register(): signUp() → listener ve SIGNED_IN → loadProfile(userId)
   *               (ANTES de que register() llegue a insertar la fila en
   *               profiles unas líneas más abajo) → esa lectura falla o
   *               trae un perfil todavía inexistente → currentUser=null +
   *               emitChange() de forma espuria, pisado un instante
   *               después por el emitChange() correcto de register(). El
   *               usuario podía ver un parpadeo real del badge del
   *               header (logueado → "DESCONOCIDO" → logueado) entre
   *               medio, o directamente quedarse en el estado erróneo si
   *               la segunda emisión se demoraba.
   *   login():    signInWithPassword() → listener dispara su propio
   *               loadProfile(), y login() dispara otro loadProfile()
   *               explícito — dos queries a `profiles` en paralelo por
   *               cada login, con dos emitChange() en carrera.
   *   logout():   signOut() → listener pone currentUser=null y emite, Y
   *               logout() hace lo mismo de nuevo al final — inofensivo
   *               en el resultado final (ambos coinciden en null), pero
   *               duplica el evento 'auth:changed' que escuchan
   *               accountView.ts/sideNavBoot.ts, cada uno
   *               re-renderizando dos veces por cada logout real.
   *
   * Con la bandera activa, el listener del constructor ignora esos
   * eventos "propios" y deja que sea el método explícito (que ya sabe
   * el orden correcto de sus propios pasos, como insertar en profiles
   * antes de leerlo) el único que actualiza currentUser y emite
   * 'auth:changed'. El listener sigue activo para lo que de verdad le
   * corresponde: cambios de sesión que authManager.ts no originó (otra
   * pestaña cerrando sesión, refresh automático de token, expiración).
   */
  private selfInitiatedAuthChange = false;

  /**
   * Envuelve una llamada a signUp/signInWithPassword/signOut que dispara
   * `onAuthStateChange` de forma asíncrona (no antes de que el propio
   * `await` de la llamada resuelva: la doc de Supabase dice "events are
   * awaited in order", es decir se encolan y se procesan en su propio
   * turno, no de forma síncrona dentro del `await` de arriba). Bajar
   * `selfInitiatedAuthChange` inmediatamente después del `await` de la
   * llamada no alcanza a cubrir esa cola — el evento podría llegar un
   * tick después, ya con la bandera en `false`, reabriendo la misma
   * carrera que esto busca evitar. Por eso se le da un margen explícito
   * (una vuelta de macrotask vía setTimeout) antes de bajar la bandera:
   * suficiente para que el evento ya encolado por esta misma llamada
   * llegue al listener mientras todavía se lo va a ignorar a propósito.
   */
  private async withSelfInitiatedAuthChange<T>(fn: () => Promise<T>): Promise<T> {
    this.selfInitiatedAuthChange = true;
    try {
      return await fn();
    } finally {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      this.selfInitiatedAuthChange = false;
    }
  }

  constructor() {
    // Al cargar la app, restauramos la sesión si el usuario ya estaba
    // logueado (Supabase persiste el token en localStorage por su cuenta,
    // ver supabaseClient.ts). ready() deja que el resto de la app espere
    // a que esto termine antes de decidir qué UI mostrar.
    this.initPromise = this.restoreSession();

    // Sin .catch() acá, si getSupabaseClient() rechaza (offline al
    // cargar la app) esto era un unhandled promise rejection real —
    // confirmado por el propio test suite (Vitest reportó "Unhandled
    // Rejection" apuntando exactamente a esta línea al simular un
    // fallo de red en el constructor). Si el SDK no carga, simplemente
    // no hay listener de auth state — currentUser se queda en null
    // (estado "no logueado"), que ya es lo correcto para ese escenario.
    getSupabaseClientLazy()
      .then((supabase) => {
        supabase.auth.onAuthStateChange((_event, session) => {
          // Ver comentario de selfInitiatedAuthChange: si este evento lo
          // disparó nuestro propio register()/login()/logout() en
          // curso, esos métodos ya se encargan de actualizar
          // currentUser y emitir 'auth:changed' en el momento y orden
          // correctos — procesarlo también acá sería una segunda
          // ejecución redundante (login/logout) o directamente
          // incorrecta por orden de ejecución (register, que necesita
          // insertar en profiles antes de poder leerlo).
          if (this.selfInitiatedAuthChange) return;

          if (!session) {
            this.currentUser = null;
            this.emitChange();
            return;
          }
          // No confiamos en session.user.user_metadata para el username:
          // la fuente de verdad es public.profiles, no los metadatos internos
          // de auth.users (que el propio usuario podría llegar a editar vía
          // API si Supabase lo permitiera en el futuro).
          void this.loadProfile(session.user.id);
        });
      })
      .catch((error) => {
        ErrorLogger?.log('authManager.onAuthStateChange.setup', error, {});
      });
  }

  private async restoreSession(): Promise<void> {
    // Nunca debe rechazar: initPromise (expuesta como ready()) se espera
    // desde accountView.ts con `Auth.ready().then(...)` sin .catch() —
    // si esta promesa rechazara, ese .then() nunca correría y quedaría
    // un unhandled promise rejection en cada carga sin conexión. Sin
    // sesión restaurable, currentUser simplemente se queda en null — el
    // mismo estado que "nunca inició sesión", que es lo correcto: el
    // usuario ve la pantalla de login, no un error.
    try {
      const supabase = await getSupabaseClientLazy();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await this.loadProfile(data.session.user.id);
      }
    } catch (error) {
      ErrorLogger?.log('authManager.restoreSession', error, {});
    }
  }

  private async loadProfile(userId: string): Promise<void> {
    const supabase = await getSupabaseClientLazy();
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    if (error) {
      // Esto puede ser "no existe ninguna fila con ese id" (raro: una
      // cuenta de auth.users sin su fila en profiles, algo que
      // register() ya evita dejar a medias) o un fallo de red/timeout
      // consultando Supabase mientras la sesión JWT en sí sigue siendo
      // válida. Se loguea para que un fallo de red no se vea idéntico
      // a un logout real sin dejar rastro.
      ErrorLogger?.log('authManager.loadProfile', error, { userId });
      this.currentUser = null;
      this.emitChange();
      return;
    }
    if (!data) {
      this.currentUser = null;
      this.emitChange();
      return;
    }

    this.currentUser = { id: userId, username: data.username };
    this.emitChange();
  }

  private emitChange(): void {
    window.dispatchEvent(
      new CustomEvent('auth:changed', { detail: { user: this.currentUser } })
    );
  }

  /** Se resuelve cuando terminó de restaurarse (o no) la sesión inicial. */
  ready(): Promise<void> {
    return this.initPromise;
  }

  getUser(): AuthUser | null {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Registra un usuario nuevo: crea la cuenta en auth.users (vía
   * signUp) y, si sale bien, la fila correspondiente en public.profiles.
   * Si el segundo paso falla (p.ej. el nombre ya existía con otra
   * mayúscula/minúscula, algo que el constraint case-insensitive
   * detecta pero signUp con el email sintético podría no haber
   * detectado antes), no dejamos una cuenta "fantasma" a medias: no hay
   * forma de revertir el signUp desde el cliente sin la service_role
   * key, así que devolvemos un error claro para que el usuario intente
   * con otro nombre — la cuenta de auth queda sin perfil asociado, pero
   * inutilizable de cara al juego (no puede loguearse a nada útil sin
   * su fila en profiles).
   */
  async register(username: string, password: string): Promise<AuthResult> {
    const trimmed = username.trim();

    if (!USERNAME_PATTERN.test(trimmed)) {
      return {
        ok: false,
        error: 'El nombre de usuario debe tener 3-20 caracteres: letras, números o guion bajo.',
      };
    }
    if (password.length < 6) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    // Todo lo que sigue depende de red (carga del SDK vía import()
    // dinámico, llamadas a Supabase Auth y a la tabla profiles). Si algo
    // de esto falla por conectividad se devuelve un AuthResult de error
    // en vez de dejar la excepción sin capturar: accountView.ts hace
    // `await Auth.register(...)` sin su propio try/catch.
    try {
      const supabase = await getSupabaseClientLazy();

      const { data, error } = await this.withSelfInitiatedAuthChange(() =>
        supabase.auth.signUp({
          email: usernameToEmail(trimmed),
          password,
        })
      );

      if (error) {
        return { ok: false, error: friendlyError(error.message) };
      }
      if (!data.user) {
        return { ok: false, error: 'No se pudo crear la cuenta. Intentá de nuevo.' };
      }

      // Si el proyecto de Supabase tiene "Confirm email" activado
      // (Authentication → Providers → Email — está ON por defecto en
      // proyectos nuevos), signUp crea el usuario en auth.users pero
      // data.session viene null hasta que se confirme el email. Como acá
      // el email es sintético (usuario@minijuegos.local, ver
      // usernameToEmail), Supabase nunca va a poder entregar ese correo
      // — el usuario quedaría sin confirmar para siempre. Se detecta este
      // caso y se devuelve un error explicando qué hacer, en vez de
      // seguir como si el registro hubiera sido exitoso y dejar al
      // usuario con un login que después falla sin explicación.
      if (!data.session) {
        return {
          ok: false,
          error:
            'No se pudo iniciar sesión automáticamente tras el registro. ' +
            'Esto pasa si "Confirm email" está activado en el proyecto de Supabase — ' +
            'desactivalo en Authentication → Providers → Email, ya que el juego usa ' +
            'un email interno que no puede recibir el correo de confirmación.',
        };
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, username: trimmed });

      if (profileError) {
        // Constraint de unicidad case-insensitive violado, u otro fallo de
        // inserción — el username ya estaba tomado en otra capitalización.
        //
        // En este punto ya existe una sesión de Supabase Auth activa y
        // persistida (data.session del signUp de arriba era truthy) para
        // una cuenta que nunca va a tener fila en profiles — no hay forma
        // de revertir el signUp desde el cliente. Sin este signOut, esa
        // sesión huérfana quedaba viva: this.currentUser se queda en
        // null acá (por eso el registro se ve "fallido" a nivel UI), pero
        // el token seguía persistido, y sobre todo el email sintético
        // (usuario@minijuegos.local) quedaba tomado en auth.users para
        // siempre — cualquier reintento posterior de registrarse con ESE
        // MISMO username fallaría con "already registered" incluso si el
        // primer intento nunca llegó a tener un perfil usable. Se ignora
        // el resultado de signOut() a propósito: si también falla (p.ej.
        // sin red en este instante), igual currentUser sigue en null y el
        // usuario ve el mismo error; el token simplemente dejará de
        // usarse la próxima vez que haya red.
        await this.withSelfInitiatedAuthChange(() => supabase.auth.signOut()).catch(() => {});
        return { ok: false, error: 'Ese nombre de usuario ya está en uso.' };
      }

      this.currentUser = { id: data.user.id, username: trimmed };
      this.emitChange();
      return { ok: true };
    } catch (error) {
      ErrorLogger?.log('authManager.register', error, { username: trimmed });
      return { ok: false, error: friendlyError(error instanceof Error ? error.message : String(error)) };
    }
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const trimmed = username.trim();
    try {
      const supabase = await getSupabaseClientLazy();

      const { data, error } = await this.withSelfInitiatedAuthChange(() =>
        supabase.auth.signInWithPassword({
          email: usernameToEmail(trimmed),
          password,
        })
      );

      if (error) {
        return { ok: false, error: friendlyError(error.message) };
      }
      if (!data.user) {
        return { ok: false, error: 'No se pudo iniciar sesión. Intentá de nuevo.' };
      }

      await this.loadProfile(data.user.id);
      return { ok: true };
    } catch (error) {
      ErrorLogger?.log('authManager.login', error, { username: trimmed });
      return { ok: false, error: friendlyError(error instanceof Error ? error.message : String(error)) };
    }
  }

  async logout(): Promise<void> {
    try {
      const supabase = await getSupabaseClientLazy();
      await this.withSelfInitiatedAuthChange(() => supabase.auth.signOut());
    } catch (error) {
      // Aunque falle el signOut remoto (offline, red caída), igual
      // limpiamos el estado local — no tiene sentido dejar al usuario
      // "atascado" logueado en la UI solo porque no se pudo avisar al
      // servidor. La próxima vez que haya red, el token viejo
      // simplemente deja de usarse.
      ErrorLogger?.log('authManager.logout', error, {});
    }
    this.currentUser = null;
    this.emitChange();
  }
}

const Auth = new AuthManager();

export default Auth;
