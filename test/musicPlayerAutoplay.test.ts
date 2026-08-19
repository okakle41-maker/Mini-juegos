import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/musicPlayerAutoplay.test.ts
 *
 * Regresión del bug reportado: "que la música siempre comience
 * desactivada". Antes, LS_PAUSED (la clave de localStorage que guarda
 * si el usuario dejó la música sonando o pausada al salir) tenía
 * default '0' ("no estaba pausado" = sonando) — así que en la primera
 * visita de cualquier persona, sin nada guardado todavía, el primer
 * click o tecla en CUALQUIER parte de la página (no necesariamente en
 * el botón de play — ver onFirstInteraction/doUnlock en
 * musicPlayer.ts) hacía arrancar el audio automáticamente, sin que
 * nadie hubiera tocado nunca el reproductor.
 *
 * Fix: el default pasó a '1' (pausado). La música solo arranca sola
 * en el primer gesto si una sesión ANTERIOR real la dejó sonando
 * (LS_PAUSED='0' persistido explícitamente al hacer play/pause).
 */

const MUSIC_PLAYER_HTML = `
  <button type="button" id="musicPlayerFab" hidden>
    <span id="mpFabNote"></span>
  </button>
  <div id="musicPlayer">
    <span id="mpNoteIcon"></span>
    <span id="mpEq"></span>
    <span id="mpTrackBadge"></span>
    <button type="button" id="mpCollapseBtn" aria-expanded="true"></button>
    <select id="mpTrackSelect"></select>
    <button id="mpPrev"></button>
    <button id="mpPlayPause"></button>
    <svg id="mpIconPlay"></svg>
    <svg id="mpIconPause" style="display:none"></svg>
    <button id="mpNext"></button>
    <button id="mpMuteBtn"></button>
    <svg id="mpVolIcon"></svg>
    <svg id="mpMuteIcon" style="display:none"></svg>
    <input type="range" id="mpVolume" min="0" max="1" step="0.02" value="0.5">
  </div>
`;

/** jsdom no implementa HTMLMediaElement.play()/pause() — se mockean
 *  para simular reproducción exitosa sin depender de audio real. */
function mockAudioPlayback(): { playMock: ReturnType<typeof vi.fn> } {
  const playMock = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.play = playMock;
  window.HTMLMediaElement.prototype.pause = vi.fn();
  return { playMock };
}

describe('musicPlayer — la música arranca siempre desactivada por defecto', () => {
  beforeEach(() => {
    vi.resetModules();
    // El mock global de localStorage (ver test/setup.ts) son espías
    // vacíos (vi.fn()) que no persisten nada entre sí — getItem()
    // siempre devuelve undefined sin importar lo que setItem() haya
    // "guardado". Acá sí necesitamos un localStorage que realmente
    // recuerde valores entre llamadas (para simular una sesión previa
    // real que dejó LS_PAUSED en un estado concreto), así que se
    // reemplaza por un Map en memoria respaldando get/set/clear real.
    const store = new Map<string, string>();
    (global.localStorage as unknown as Storage) = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size; },
    };
    document.body.innerHTML = MUSIC_PLAYER_HTML;
  });

  afterEach(() => {
    document.body.replaceWith(document.createElement('body'));
  });

  it('primera visita (sin nada guardado): un click en cualquier parte de la página NO arranca la música', async () => {
    const { playMock } = mockAudioPlayback();

    await import('../js/musicPlayer');

    // Simula el primer gesto del usuario en cualquier lugar de la
    // página (no en el botón de play) — exactamente el disparador de
    // onFirstInteraction/doUnlock en musicPlayer.ts.
    document.body.click();
    // doUnlock() dispara audio.play(), que devuelve una promesa — hay
    // que dejar correr el microtask queue para que el .then/.catch
    // resuelva antes de verificar el estado.
    await Promise.resolve();
    await Promise.resolve();

    expect(playMock).not.toHaveBeenCalled();

    const iconPlay = document.getElementById('mpIconPlay') as HTMLElement;
    const iconPause = document.getElementById('mpIconPause') as HTMLElement;
    expect(iconPlay.style.display).not.toBe('none'); // ícono "play" visible = pausado
    expect(iconPause.style.display).toBe('none');
  });

  it('primera visita: clickear el botón de play SÍ arranca la música (gesto explícito)', async () => {
    const { playMock } = mockAudioPlayback();

    await import('../js/musicPlayer');

    const btnPlay = document.getElementById('mpPlayPause') as HTMLButtonElement;
    btnPlay.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it('visita posterior con LS_PAUSED="0" (el usuario dejó la música sonando la vez pasada): sí arranca sola', async () => {
    localStorage.setItem('mgb_paused', '0');
    const { playMock } = mockAudioPlayback();

    await import('../js/musicPlayer');

    document.body.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it('visita posterior con LS_PAUSED="1" (el usuario la dejó pausada): no arranca sola', async () => {
    localStorage.setItem('mgb_paused', '1');
    const { playMock } = mockAudioPlayback();

    await import('../js/musicPlayer');

    document.body.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(playMock).not.toHaveBeenCalled();
  });
});
