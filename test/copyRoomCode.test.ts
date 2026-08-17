import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const successMock = vi.fn();

vi.mock('../js/notificationSystem.js', () => ({
  default: {
    success: successMock
  }
}));

describe('attachCopyButton', () => {
  let displayEl: HTMLElement;

  beforeEach(() => {
    vi.resetModules();
    successMock.mockClear();
    document.body.innerHTML = '<div id="roomCode">ABC123</div>';
    displayEl = document.getElementById('roomCode') as HTMLElement;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inserta un botón inmediatamente después de displayEl', async () => {
    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn1');

    expect(btn.id).toBe('copyBtn1');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.type).toBe('button');
    expect(btn.className).toBe('copy-code-btn');
    expect(displayEl.nextElementSibling).toBe(btn);
  });

  it('setea el texto y aria-label por defecto', async () => {
    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn2');

    expect(btn.textContent).toBe('📋 Copiar');
    expect(btn.getAttribute('aria-label')).toBe('Copiar código de sala');
  });

  it('reutiliza el botón existente en vez de duplicarlo si se llama dos veces con el mismo buttonId', async () => {
    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    attachCopyButton(displayEl, 'copyBtn3');
    attachCopyButton(displayEl, 'copyBtn3');

    const buttons = document.querySelectorAll('#copyBtn3');
    expect(buttons.length).toBe(1);
  });

  it('reemplaza el listener anterior al re-llamar (clona el nodo) en vez de acumular handlers', async () => {
    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    });

    attachCopyButton(displayEl, 'copyBtn4');
    const secondBtn = attachCopyButton(displayEl, 'copyBtn4');

    secondBtn.click();
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });
  });

  it('al hacer click, copia el textContent (trimmed) de displayEl al clipboard', async () => {
    displayEl.textContent = '  XYZ789  ';
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn5');
    btn.click();

    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('XYZ789');
    });
  });

  it('no hace nada si displayEl.textContent está vacío tras el trim', async () => {
    displayEl.textContent = '   ';
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn6');
    btn.click();

    // damos chance a cualquier microtask pendiente
    await Promise.resolve();
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it('en éxito: cambia el texto a "Copiado", dispara la notificación y vuelve al label default tras el delay', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn7');
    btn.click();

    // resolver la promesa de writeText
    await vi.advanceTimersByTimeAsync(0);

    expect(btn.textContent).toBe('✓ Copiado');
    expect(successMock).toHaveBeenCalledWith('¡Copiado!', 'Código de sala copiado al portapapeles');

    await vi.advanceTimersByTimeAsync(1500);

    expect(btn.textContent).toBe('📋 Copiar');
  });

  it('un segundo click antes de que expire el timeout reinicia el temporizador (clearTimeout del anterior)', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn8');

    btn.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(btn.textContent).toBe('✓ Copiado');

    await vi.advanceTimersByTimeAsync(1000); // aún no llega a 1500

    btn.click(); // reinicia el timer
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(1000); // 1000+1000=2000 desde el 1er click, pero el 2do reinició en t=1000
    expect(btn.textContent).toBe('✓ Copiado'); // todavía no pasaron 1500 desde el 2do click

    await vi.advanceTimersByTimeAsync(500);
    expect(btn.textContent).toBe('📋 Copiar');
  });

  it('en fallo (rechazo de writeText): mantiene/restaura el label default sin romper la UI', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('permiso denegado'));
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn9');
    btn.click();

    await vi.waitFor(() => {
      expect(btn.textContent).toBe('📋 Copiar');
    });
    expect(successMock).not.toHaveBeenCalled();
  });

  it('fallback: si navigator.clipboard no existe, usa document.execCommand("copy") sobre un textarea oculto', async () => {
    // @ts-expect-error - simulamos ausencia de Clipboard API
    delete navigator.clipboard;
    if (!('execCommand' in document)) {
      (document as any).execCommand = () => true;
    }
    const execCommandSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn10');
    btn.click();

    await vi.waitFor(() => {
      expect(execCommandSpy).toHaveBeenCalledWith('copy');
    });
    // el textarea temporal se crea y se remueve; no debe quedar en el DOM
    expect(document.querySelectorAll('textarea').length).toBe(0);

    execCommandSpy.mockRestore();
  });

  it('fallback: si execCommand devuelve false, se trata como fallo (no rompe, vuelve al label default)', async () => {
    // @ts-expect-error - simulamos ausencia de Clipboard API
    delete navigator.clipboard;
    if (!('execCommand' in document)) {
      (document as any).execCommand = () => true;
    }
    const execCommandSpy = vi.spyOn(document, 'execCommand').mockReturnValue(false);

    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn11');
    btn.click();

    await vi.waitFor(() => {
      expect(btn.textContent).toBe('📋 Copiar');
    });
    // el textarea igual se limpia en el finally
    expect(document.querySelectorAll('textarea').length).toBe(0);

    execCommandSpy.mockRestore();
  });

  it('devuelve el botón (freshBtn), no una referencia al nodo original clonado', async () => {
    const { attachCopyButton } = await import('../js/utils/copyRoomCode');
    const btn = attachCopyButton(displayEl, 'copyBtn12');

    // el nodo devuelto debe ser el que efectivamente está en el DOM
    expect(document.getElementById('copyBtn12')).toBe(btn);
  });
});
