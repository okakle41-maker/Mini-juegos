/**
 * Tests para authManager.ts
 *
 * supabase/supabase-js se mockea por completo: estos tests validan la
 * lógica de authManager.ts (validación de username/password, traducción
 * de errores, orquestación signUp → insert en profiles), no el SDK de
 * Supabase en sí ni la conectividad real con el proyecto configurado en
 * supabaseClient.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

const profilesInsert = vi.fn();
const profilesSelectSingle = vi.fn();

// getSupabaseClientImpl es reasignable por test para simular un fallo de
// red al cargar el SDK (p.ej. el import() dinámico rechaza porque el
// usuario está offline) — por defecto resuelve el cliente mockeado normal.
let getSupabaseClientImpl = async () => ({
  auth: authState,
  from: (table: string) => {
    if (table !== 'profiles') throw new Error(`tabla inesperada en el mock: ${table}`);
    return {
      select: () => ({
        eq: () => ({
          single: profilesSelectSingle,
        }),
      }),
      insert: profilesInsert,
    };
  },
});

vi.mock('../js/core/supabaseClient', () => ({
  getSupabaseClient: () => getSupabaseClientImpl(),
}));

const errorLoggerMock = { log: vi.fn(), setSink: vi.fn(), recent: (): any[] => [], clear: vi.fn() };
vi.mock('../js/core/errorLogger', () => ({
  default: errorLoggerMock,
}));

describe('AuthManager', () => {
  let Auth: typeof import('../js/authManager').default;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Restaurar el mock exitoso por defecto, por si un test anterior lo
    // reasignó para simular un fallo de red.
    getSupabaseClientImpl = async () => ({
      auth: authState,
      from: (table: string) => {
        if (table !== 'profiles') throw new Error(`tabla inesperada en el mock: ${table}`);
        return {
          select: () => ({
            eq: () => ({
              single: profilesSelectSingle,
            }),
          }),
          insert: profilesInsert,
        };
      },
    });

    authState.getSession.mockResolvedValue({ data: { session: null } });
    authState.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    profilesInsert.mockResolvedValue({ error: null });
    errorLoggerMock.log.mockClear();

    const mod = await import('../js/authManager');
    Auth = mod.default;
    await Auth.ready();
  });

  describe('register', () => {
    it('rechaza un username con formato inválido sin llamar a Supabase', async () => {
      const result = await Auth.register('a', 'password123');
      expect(result.ok).toBe(false);
      expect(authState.signUp).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña corta sin llamar a Supabase', async () => {
      const result = await Auth.register('usuarioValido', '123');
      expect(result.ok).toBe(false);
      expect(authState.signUp).not.toHaveBeenCalled();
    });

    it('deriva un email sintético a partir del username, en minúsculas', async () => {
      authState.signUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: { access_token: 'tok' } }, error: null });

      await Auth.register('Jugador_Uno', 'password123');

      expect(authState.signUp).toHaveBeenCalledWith({
        email: 'jugador_uno@minijuegos.local',
        password: 'password123',
      });
    });

    it('crea el perfil público tras un signUp exitoso y deja al usuario logueado', async () => {
      authState.signUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: { access_token: 'tok' } }, error: null });

      const result = await Auth.register('Jugador1', 'password123');

      expect(result.ok).toBe(true);
      expect(profilesInsert).toHaveBeenCalledWith({ id: 'u1', username: 'Jugador1' });
      expect(Auth.getUser()).toEqual({ id: 'u1', username: 'Jugador1' });
    });

    it('devuelve error si el username ya existe (constraint de profiles)', async () => {
      authState.signUp.mockResolvedValue({ data: { user: { id: 'u2' }, session: { access_token: 'tok' } }, error: null });
      profilesInsert.mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint' } });

      const result = await Auth.register('Repetido', 'password123');

      expect(result.ok).toBe(false);
      expect(Auth.getUser()).toBeNull();
    });

    it('cierra la sesión huérfana de Supabase Auth si la inserción en profiles falla', async () => {
      // Antes de este fix: si profiles.insert fallaba (username ya
      // tomado en otra capitalización), signUp() ya había dejado una
      // sesión activa y persistida en auth.users para esa cuenta —
      // nunca se llamaba signOut(), así que el token quedaba vivo y el
      // email sintético (usuario@minijuegos.local) quedaba tomado para
      // siempre, bloqueando cualquier reintento futuro con ese mismo
      // username aunque nunca hubiera llegado a tener un perfil usable.
      authState.signUp.mockResolvedValue({ data: { user: { id: 'u3' }, session: { access_token: 'tok' } }, error: null });
      profilesInsert.mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint' } });
      authState.signOut.mockResolvedValue({ error: null });

      await Auth.register('OtroRepetido', 'password123');

      expect(authState.signOut).toHaveBeenCalled();
    });

    it('traduce el error de Supabase "already registered" a un mensaje entendible', async () => {
      authState.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      const result = await Auth.register('YaExiste', 'password123');

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error).toMatch(/ya está en uso/i);
      }
    });

    it('devuelve error claro si signUp no entrega sesión (Confirm email activado)', async () => {
      // data.session viene null cuando el proyecto de Supabase exige
      // confirmar el email antes de autenticar — algo que nunca va a
      // pasar con el dominio sintético usado acá (ver usernameToEmail).
      authState.signUp.mockResolvedValue({
        data: { user: { id: 'u5' }, session: null },
        error: null,
      });

      const result = await Auth.register('SinConfirmar', 'password123');

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error).toMatch(/Confirm email/i);
      }
      // No debe haber intentado crear el perfil ni dejar al usuario
      // "logueado" con una sesión que no existe.
      expect(profilesInsert).not.toHaveBeenCalled();
      expect(Auth.getUser()).toBeNull();
    });
  });

  describe('login', () => {
    it('inicia sesión y carga el perfil real desde la tabla profiles', async () => {
      authState.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u3' } }, error: null });
      profilesSelectSingle.mockResolvedValue({ data: { username: 'MiNombre' }, error: null });

      const result = await Auth.login('MiNombre', 'password123');

      expect(result.ok).toBe(true);
      expect(Auth.getUser()).toEqual({ id: 'u3', username: 'MiNombre' });
    });

    it('devuelve error amigable ante credenciales inválidas', async () => {
      authState.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await Auth.login('Nadie', 'wrongpass');

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error).toMatch(/incorrectos/i);
      }
      expect(Auth.isLoggedIn()).toBe(false);
    });
  });

  describe('logout', () => {
    it('limpia el usuario actual tras cerrar sesión', async () => {
      authState.signUp.mockResolvedValue({ data: { user: { id: 'u4' }, session: { access_token: 'tok' } }, error: null });
      await Auth.register('ParaCerrar', 'password123');
      expect(Auth.isLoggedIn()).toBe(true);

      authState.signOut.mockResolvedValue({ error: null });
      await Auth.logout();

      expect(Auth.isLoggedIn()).toBe(false);
      expect(Auth.getUser()).toBeNull();
    });

    it('limpia el usuario local igual si signOut falla por red (no deja al usuario atascado logueado)', async () => {
      authState.signUp.mockResolvedValue({ data: { user: { id: 'u6' }, session: { access_token: 'tok' } }, error: null });
      await Auth.register('ParaCerrarOffline', 'password123');
      expect(Auth.isLoggedIn()).toBe(true);

      authState.signOut.mockRejectedValue(new Error('network error'));

      await expect(Auth.logout()).resolves.toBeUndefined();
      expect(Auth.isLoggedIn()).toBe(false);
      expect(errorLoggerMock.log).toHaveBeenCalledWith(
        'authManager.logout',
        expect.any(Error),
        expect.anything()
      );
    });
  });

  describe('robustez ante fallo de red (getSupabaseClient rechaza)', () => {
    it('register() devuelve AuthResult de error en vez de lanzar si falla la carga del SDK', async () => {
      getSupabaseClientImpl = () => Promise.reject(new Error('Failed to fetch dynamically imported module'));

      await expect(Auth.register('Offline1', 'password123')).resolves.toEqual(
        expect.objectContaining({ ok: false })
      );
      expect(Auth.isLoggedIn()).toBe(false);
    });

    it('login() devuelve AuthResult de error en vez de lanzar si falla la carga del SDK', async () => {
      getSupabaseClientImpl = () => Promise.reject(new Error('Failed to fetch dynamically imported module'));

      await expect(Auth.login('Offline2', 'password123')).resolves.toEqual(
        expect.objectContaining({ ok: false })
      );
    });

    it('ready() nunca rechaza aunque restoreSession falle por red al arrancar', async () => {
      // Reconfigura el mock ANTES de importar authManager de nuevo, para
      // que restoreSession() (disparado en el constructor) se ejecute
      // contra un getSupabaseClient que rechaza.
      getSupabaseClientImpl = () => Promise.reject(new Error('network error'));
      vi.resetModules();

      const mod = await import('../js/authManager');
      const FreshAuth = mod.default;

      // Si restoreSession no capturara el rechazo, esto lanzaría en vez
      // de resolver — que es exactamente el bug que se corrigió: sin el
      // try/catch, cualquier `Auth.ready().then(...)` (ver
      // accountView.ts) quedaba como una promesa rechazada sin manejar.
      await expect(FreshAuth.ready()).resolves.toBeUndefined();
      expect(FreshAuth.getUser()).toBeNull();
    });
  });

  describe('friendlyError: casos adicionales de Supabase Auth', () => {
    it('traduce rate limiting a un mensaje de "esperá un momento"', async () => {
      authState.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'email rate limit exceeded' },
      });

      const result = await Auth.register('RateLimited', 'password123');

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error).toMatch(/demasiados intentos/i);
      }
    });

    it('traduce cuenta deshabilitada a un mensaje entendible', async () => {
      authState.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'User is disabled' },
      });

      const result = await Auth.login('Deshabilitado', 'password123');

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error).toMatch(/deshabilitada/i);
      }
    });

    it('traduce sesión expirada a un mensaje de "iniciá sesión de nuevo"', async () => {
      authState.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Session not found' },
      });

      const result = await Auth.login('SesionVencida', 'password123');

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.error).toMatch(/sesión expiró/i);
      }
    });
  });
});
