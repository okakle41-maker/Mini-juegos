import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GameUi } from '../js/types/game';
import type { STRoundPublic, STTeamLockStatus, STSlot } from '../js/signalTriangulationSystem';

// Mock del singleton completo: teamLockView.ts importa el objeto ya
// instanciado (no la clase), así que vi.mock reemplaza el módulo
// entero por esta implementación falsa antes de que teamLockView lo
// importe.
const mockSystem = {
  getCurrentMatch: vi.fn(),
  mySlot: vi.fn(),
  getTeamLockStatus: vi.fn(),
  refreshCurrentRound: vi.fn(),
};

vi.mock('../js/signalTriangulationSystem.js', () => ({
  signalTriangulationSystem: mockSystem,
}));

// Import dinámico post-mock (patrón ya usado en el resto del proyecto,
// ver test/setup.ts) para asegurar que setupTeamLockView vea el mock,
// no el módulo real.
async function loadSetupTeamLockView() {
  const mod = await import('../js/utils/teamLockView');
  return mod.setupTeamLockView;
}

function makeRound(overrides: Partial<STRoundPublic> = {}): STRoundPublic {
  return {
    id: 'round-1',
    matchId: 'match-1',
    roundNumber: 1,
    attemptNumber: 1,
    status: 'active',
    ...overrides,
  };
}

describe('setupTeamLockView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSystem.getCurrentMatch.mockReset();
    mockSystem.mySlot.mockReset();
    mockSystem.getTeamLockStatus.mockReset();
    mockSystem.refreshCurrentRound.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('isActive es false y no arranca polling si no hay partida activa', async () => {
    mockSystem.getCurrentMatch.mockReturnValue(null);
    mockSystem.mySlot.mockReturnValue(null);
    const setupTeamLockView = await loadSetupTeamLockView();

    const handle = setupTeamLockView({});

    expect(handle.isActive).toBe(false);
    expect(handle.mySlot).toBeNull();

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockSystem.refreshCurrentRound).not.toHaveBeenCalled();

    handle.cleanup();
  });

  it('isActive es true y expone mySlot cuando hay partida activa', async () => {
    mockSystem.getCurrentMatch.mockReturnValue({ id: 'match-1' });
    mockSystem.mySlot.mockReturnValue(2 as STSlot);
    mockSystem.refreshCurrentRound.mockResolvedValue(null);
    const setupTeamLockView = await loadSetupTeamLockView();

    const handle = setupTeamLockView({});

    expect(handle.isActive).toBe(true);
    expect(handle.mySlot).toBe(2);

    handle.cleanup();
  });

  it('hace polling de refreshCurrentRound cada 1.5s mientras la partida está activa', async () => {
    mockSystem.getCurrentMatch.mockReturnValue({ id: 'match-1' });
    mockSystem.mySlot.mockReturnValue(1 as STSlot);
    mockSystem.refreshCurrentRound.mockResolvedValue(makeRound());
    mockSystem.getTeamLockStatus.mockResolvedValue([]);
    const setupTeamLockView = await loadSetupTeamLockView();

    const handle = setupTeamLockView({});

    // Una llamada inmediata al arrancar (no espera al primer intervalo).
    await vi.advanceTimersByTimeAsync(0);
    expect(mockSystem.refreshCurrentRound).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1500);
    expect(mockSystem.refreshCurrentRound).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1500);
    expect(mockSystem.refreshCurrentRound).toHaveBeenCalledTimes(3);

    handle.cleanup();
  });

  it('actualiza el contador en el DOM con el conteo de jugadores lockeados', async () => {
    mockSystem.getCurrentMatch.mockReturnValue({ id: 'match-1' });
    mockSystem.mySlot.mockReturnValue(1 as STSlot);
    mockSystem.refreshCurrentRound.mockResolvedValue(makeRound());
    const statuses: STTeamLockStatus[] = [
      { roundId: 'round-1', playerId: 'p1', hasLocked: true },
      { roundId: 'round-1', playerId: 'p2', hasLocked: true },
      { roundId: 'round-1', playerId: 'p3', hasLocked: false },
      { roundId: 'round-1', playerId: 'p4', hasLocked: false },
    ];
    mockSystem.getTeamLockStatus.mockResolvedValue(statuses);
    const setupTeamLockView = await loadSetupTeamLockView();

    const statusEl = document.createElement('div');
    const ui = { stTeamStatus: statusEl } as unknown as GameUi;

    const handle = setupTeamLockView(ui);
    await vi.advanceTimersByTimeAsync(0);

    expect(statusEl.textContent).toBe('2 de 4 ya confirmaron su posición');

    handle.cleanup();
  });

  it('dispara los handlers de onRoundResolved cuando la ronda pasa de active a solved', async () => {
    mockSystem.getCurrentMatch.mockReturnValue({ id: 'match-1' });
    mockSystem.mySlot.mockReturnValue(1 as STSlot);
    mockSystem.getTeamLockStatus.mockResolvedValue([]);
    // Primero activa, después resuelta — simula el paso del tiempo real.
    mockSystem.refreshCurrentRound
      .mockResolvedValueOnce(makeRound({ status: 'active' }))
      .mockResolvedValueOnce(makeRound({ status: 'solved' }));
    const setupTeamLockView = await loadSetupTeamLockView();

    const handle = setupTeamLockView({});
    const onResolved = vi.fn();
    handle.onRoundResolved(onResolved);

    await vi.advanceTimersByTimeAsync(0); // ronda activa, no dispara
    expect(onResolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500); // ronda resuelta, dispara
    expect(onResolved).toHaveBeenCalledWith('solved');
    expect(onResolved).toHaveBeenCalledTimes(1);

    handle.cleanup();
  });

  it('no dispara onRoundResolved de nuevo si el status resuelto no cambia entre polls', async () => {
    mockSystem.getCurrentMatch.mockReturnValue({ id: 'match-1' });
    mockSystem.mySlot.mockReturnValue(1 as STSlot);
    mockSystem.getTeamLockStatus.mockResolvedValue([]);
    mockSystem.refreshCurrentRound.mockResolvedValue(makeRound({ status: 'failed' }));
    const setupTeamLockView = await loadSetupTeamLockView();

    const handle = setupTeamLockView({});
    const onResolved = vi.fn();
    handle.onRoundResolved(onResolved);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(1500);

    // lastKnownRoundStatus ya es 'failed' desde el primer poll, así que
    // los polls siguientes con el mismo status no deben re-disparar.
    expect(onResolved).toHaveBeenCalledTimes(1);

    handle.cleanup();
  });

  it('cleanup() detiene el polling y limpia los handlers registrados', async () => {
    mockSystem.getCurrentMatch.mockReturnValue({ id: 'match-1' });
    mockSystem.mySlot.mockReturnValue(1 as STSlot);
    mockSystem.refreshCurrentRound.mockResolvedValue(makeRound());
    mockSystem.getTeamLockStatus.mockResolvedValue([]);
    const setupTeamLockView = await loadSetupTeamLockView();

    const handle = setupTeamLockView({});
    await vi.advanceTimersByTimeAsync(0);
    const callsBeforeCleanup = mockSystem.refreshCurrentRound.mock.calls.length;

    handle.cleanup();
    await vi.advanceTimersByTimeAsync(5000);

    // Sin más llamadas tras cleanup(): el setInterval quedó limpiado.
    expect(mockSystem.refreshCurrentRound.mock.calls.length).toBe(callsBeforeCleanup);
  });

  it('refreshTeamStatus expuesto en el handle puede llamarse manualmente', async () => {
    mockSystem.getCurrentMatch.mockReturnValue(null);
    mockSystem.mySlot.mockReturnValue(null);
    mockSystem.getTeamLockStatus.mockResolvedValue([
      { roundId: 'round-9', playerId: 'p1', hasLocked: true },
    ]);
    const setupTeamLockView = await loadSetupTeamLockView();

    const statusEl = document.createElement('div');
    const ui = { stTeamStatus: statusEl } as unknown as GameUi;
    const handle = setupTeamLockView(ui);

    await handle.refreshTeamStatus('round-9');

    expect(mockSystem.getTeamLockStatus).toHaveBeenCalledWith('round-9');
    expect(statusEl.textContent).toBe('1 de 1 ya confirmaron su posición');

    handle.cleanup();
  });
});
