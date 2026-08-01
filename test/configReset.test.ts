import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('configReset', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <button id="configResetBtn" class="config-danger-btn">BORRAR TODOS LOS RÉCORDS</button>
    `;
  });

  it('el primer clic arma la confirmación sin borrar nada', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    await import('../js/configReset');

    Leaderboard.save('termita', 10);

    const btn = document.getElementById('configResetBtn') as HTMLButtonElement;
    btn.click();

    expect(btn.classList.contains('config-danger-btn--confirm')).toBe(true);
    expect(Leaderboard.get('termita')).toHaveLength(1);
  });

  it('el segundo clic confirma y borra todos los récords', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    await import('../js/configReset');

    Leaderboard.save('termita', 10);

    const btn = document.getElementById('configResetBtn') as HTMLButtonElement;
    btn.click(); // arma confirmación
    btn.click(); // confirma

    expect(Leaderboard.get('termita')).toHaveLength(0);
    expect(btn.classList.contains('config-danger-btn--confirm')).toBe(false);
  });

  it('cambiar de vista sin confirmar descarta el estado de confirmación', async () => {
    const { default: Leaderboard } = await import('../js/leaderboardManager');
    await import('../js/configReset');

    Leaderboard.save('termita', 10);

    const btn = document.getElementById('configResetBtn') as HTMLButtonElement;
    btn.click(); // arma confirmación
    expect(btn.classList.contains('config-danger-btn--confirm')).toBe(true);

    document.dispatchEvent(new CustomEvent('view-shown', { detail: { id: 'home' } }));
    expect(btn.classList.contains('config-danger-btn--confirm')).toBe(false);

    btn.click(); // este clic vuelve a armar, no confirma
    expect(Leaderboard.get('termita')).toHaveLength(1);
  });
});
