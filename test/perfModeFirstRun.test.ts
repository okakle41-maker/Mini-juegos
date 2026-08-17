import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../js/customCursor.js', () => ({
  default: { init: vi.fn(), destroy: vi.fn() },
}));

const notificationCustom = vi.fn();
vi.mock('../js/notificationSystem.js', () => ({
  default: { custom: notificationCustom },
}));

/**
 * El mock global de localStorage (ver test/setup.ts) es un spy sin
 * almacenamiento real: getItem/setItem no comparten estado entre sí,
 * a diferencia de un localStorage real. El resto de la suite (ver
 * test/safeStorage.test.ts) ya sigue este patrón: mockear
 * getItem.mockImplementation según la key pedida, en vez de esperar
 * que un setString anterior se refleje en un getString posterior.
 */
function mockStoredValues(values: Record<string, string | null>): void {
  (localStorage.getItem as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => (key in values ? values[key] : null)
  );
}

async function loadFreshPerfModeFirstRun() {
  vi.resetModules();
  // perfMode.ts corre su propio init() como side-effect al importarse
  // (igual que perfModeFirstRun.ts) — hay que resetear ambos módulos
  // relacionados para que cada test arranque desde un estado limpio,
  // no desde el `document.body.classList` que dejó un test anterior.
  document.body.className = '';
  await import('../js/perfMode');
  return import('../js/perfModeFirstRun');
}

describe('perfModeFirstRun', () => {
  beforeEach(() => {
    notificationCustom.mockClear();
    (localStorage.getItem as unknown as ReturnType<typeof vi.fn>).mockReset();
    (localStorage.setItem as unknown as ReturnType<typeof vi.fn>).mockReset();
    mockStoredValues({});
  });

  afterEach(() => {
    document.body.className = '';
  });

  it('en la primera visita real (sin ninguna preferencia guardada), activa perf-mode', async () => {
    await loadFreshPerfModeFirstRun();

    expect(document.body.classList.contains('perf-mode')).toBe(true);
  });

  it('en la primera visita, muestra un toast persistente explicando el modo bajo consumo', async () => {
    await loadFreshPerfModeFirstRun();

    expect(notificationCustom).toHaveBeenCalledTimes(1);
    const call = notificationCustom.mock.calls[0][0];
    expect(call.persistent).toBe(true);
    expect(call.title).toMatch(/bajo consumo/i);
    expect(call.message).toMatch(/Configuración/);
  });

  it('el toast incluye una acción "No volver a ver"', async () => {
    await loadFreshPerfModeFirstRun();

    const call = notificationCustom.mock.calls[0][0];
    expect(call.actions).toHaveLength(1);
    expect(call.actions[0].label).toBe('No volver a ver');
  });

  it('NO activa perf-mode automáticamente si ya hay una preferencia guardada (usuario ya la configuró antes)', async () => {
    mockStoredValues({ st_perf_mode: '0' });

    await loadFreshPerfModeFirstRun();

    expect(document.body.classList.contains('perf-mode')).toBe(false);
    expect(notificationCustom).not.toHaveBeenCalled();
  });

  it('respeta st_perf_mode=1 ya guardado sin volver a mostrar el toast', async () => {
    mockStoredValues({ st_perf_mode: '1' });

    await loadFreshPerfModeFirstRun();

    // perf-mode queda activo porque perfMode.ts restaura la
    // preferencia guardada — pero el toast de "primera vez" no debe
    // dispararse, porque ya existe una preferencia real.
    expect(document.body.classList.contains('perf-mode')).toBe(true);
    expect(notificationCustom).not.toHaveBeenCalled();
  });

  it('NO vuelve a mostrar el toast si ya se marcó como visto ("No volver a ver" tocado antes)', async () => {
    mockStoredValues({ st_first_run_seen: '1' });

    await loadFreshPerfModeFirstRun();

    expect(notificationCustom).not.toHaveBeenCalled();
    // Tampoco debe forzar perf-mode de nuevo en visitas siguientes:
    // una vez descartado el aviso, la ausencia de st_perf_mode pasa a
    // significar "el usuario no tiene preferencia y ya fue avisado",
    // no "hay que reactivar el modo por él cada vez".
    expect(document.body.classList.contains('perf-mode')).toBe(false);
  });

  it('al ejecutar la acción "No volver a ver" llama a setItem con st_first_run_seen=1', async () => {
    await loadFreshPerfModeFirstRun();

    const call = notificationCustom.mock.calls[0][0];
    call.actions[0].action();

    expect(localStorage.setItem).toHaveBeenCalledWith('st_first_run_seen', '1');
  });

  it('activar perf-mode en la primera visita NO escribe st_perf_mode (no se confunde con una elección del usuario)', async () => {
    await loadFreshPerfModeFirstRun();

    const setItemCalls = (localStorage.setItem as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const wroteRealPreference = setItemCalls.some((call: unknown[]) => call[0] === 'st_perf_mode');

    // Clave: si esto quedara escrito, una futura visita ya no se
    // distinguiría de "el usuario activó el modo a mano" — el toggle
    // de Configuración se vería marcado sin que el usuario supiera por
    // qué, y perfModeFirstRun ya no podría diferenciar los casos.
    expect(wroteRealPreference).toBe(false);
  });
});
