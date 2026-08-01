import { describe, it, expect, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// A propósito NO se mockea @supabase/supabase-js en este test: el bug
// (t.rpc(...).catch is not a function) depende de un comportamiento
// real del SDK (PostgrestFilterBuilder no implementa .catch), que un
// mock manual ocultaría si no lo replica exactamente. Se usa el SDK
// real contra credenciales inválidas — la llamada de red falla, pero
// eso es justo lo que hay que probar: que el error de red se maneje
// con try/catch sin volver a explotar por un .catch inexistente.

vi.mock('../js/core/supabaseClient', () => ({
  getSupabaseClient: async () => createClient('https://example.invalid', 'fake-key'),
}));
vi.mock('../js/authManager', () => ({
  default: { getUser: (): null => null },
}));

describe('fix: client.rpc(...).catch is not a function', () => {
  it('el SDK real de supabase-js no expone .catch en el resultado de .rpc()', () => {
    const client = createClient('https://example.supabase.co', 'fake-key');
    const result = client.rpc('purge_stale_lobbies') as any;
    // Esto es la prueba de que el bug es real y no una casualidad de
    // versión: si esto deja de ser cierto en una futura versión del
    // SDK, este test empieza a fallar y hay que revisar si todavía
    // hace falta el try/catch en lobbySystem.ts.
    expect(typeof result.then).toBe('function');
    expect(typeof result.catch).toBe('undefined');
  });

  it('createLobby no revienta con "catch is not a function" cuando rpc() falla', async () => {
    const { lobbySystem } = await import('../js/lobbySystem.js');
    await (lobbySystem as any).waitForInitialization();

    // No se puede completar createLobby de verdad (no hay red real ni
    // proyecto de Supabase válido en este entorno), pero el punto es
    // que la excepción resultante NO debe ser "catch is not a
    // function" — cualquier otro error (red, DNS, etc.) confirma que
    // el try/catch alrededor de rpc() ya no revienta por sí mismo.
    await expect(lobbySystem.createLobby()).rejects.not.toThrow(/catch is not a function/);
  });
});
