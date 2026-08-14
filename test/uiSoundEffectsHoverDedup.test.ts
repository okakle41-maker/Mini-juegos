import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * test/uiSoundEffectsHoverDedup.test.ts
 *
 * Motivación: en js/uiSoundEffects.ts el listener de hover escuchaba
 * 'mouseover' a nivel document y disparaba uiSoundEffects.hover() para
 * CUALQUIER mouseover cuyo target (o un closest('button')) cayera
 * dentro de .game-card / .filter-btn / button — sin deduplicar por el
 * elemento "hover-able" contenedor. Como mouseover hace bubble y se
 * dispara de nuevo cada vez que el mouse cruza entre hijos internos de
 * una misma card (imagen, título, badge, botón favorito, etc.), el
 * sonido se re-disparaba en cada micro-movimiento dentro de la tarjeta,
 * en vez de solo una vez al entrar.
 *
 * El fix usa closest() para encontrar el elemento hover-able más
 * cercano y compara contra e.relatedTarget: si el elemento del que
 * venimos ya estaba contenido en el mismo hover-able, no es una
 * entrada nueva y no se reproduce el sonido.
 *
 * Nota sobre DOMContentLoaded: el listener de uiSoundEffects.ts se
 * registra dentro de un callback de 'DOMContentLoaded'. En jsdom con
 * Vitest ese evento normalmente ya se disparó antes de que el test
 * importe el módulo dinámicamente, así que lo disparamos manualmente
 * tras el import. Como solo hacemos esto una vez (no hay disparo
 * "real" adicional del entorno compitiendo dentro del mismo test),
 * no hay riesgo de registrar el listener dos veces y duplicar el
 * conteo de sonidos.
 */

function dispatchMouseOver(target: Element, relatedTarget: Element | null) {
  const event = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    relatedTarget: relatedTarget as EventTarget | null,
  });
  target.dispatchEvent(event);
}

describe('uiSoundEffects hover dedup', () => {
  let hoverSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div class="game-card" id="card">
        <img id="img" />
        <span id="title">Juego</span>
        <button id="fav-btn">★</button>
      </div>
      <div id="outside">fuera</div>
    `;

    const mod = await import('../js/uiSoundEffects');
    hoverSpy = vi.spyOn(mod.uiSoundEffects, 'hover').mockImplementation(() => {});

    // El listener real se registra dentro de un callback de DOMContentLoaded.
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    hoverSpy.mockRestore();
  });

  it('no repite el sonido al moverse entre elementos no-interactivos de la misma card', () => {
    const img = document.getElementById('img')!;
    const title = document.getElementById('title')!;
    const outside = document.getElementById('outside')!;

    // Entrada real a la card desde fuera: debe sonar una vez.
    dispatchMouseOver(img, outside);
    expect(hoverSpy).toHaveBeenCalledTimes(1);

    // Moverse entre hijos internos NO interactivos (imagen, título) dentro
    // de la misma card: NO debe volver a sonar, porque ambos resuelven al
    // mismo elemento "hoverable" (la card).
    dispatchMouseOver(title, img);
    dispatchMouseOver(img, title);
    expect(hoverSpy).toHaveBeenCalledTimes(1);
  });

  it('sí suena al entrar a un botón anidado dentro de la card (es su propio hoverable)', () => {
    const card = document.getElementById('card')!;
    const img = document.getElementById('img')!;
    const favBtn = document.getElementById('fav-btn')!;
    const outside = document.getElementById('outside')!;

    dispatchMouseOver(img, outside);
    expect(hoverSpy).toHaveBeenCalledTimes(1);

    // Entrar al botón favorito: es un hoverable distinto (button), suena de nuevo.
    dispatchMouseOver(favBtn, img);
    expect(hoverSpy).toHaveBeenCalledTimes(2);

    // Volver de favBtn a la card (no al botón): otro hoverable distinto, suena.
    dispatchMouseOver(card, favBtn);
    expect(hoverSpy).toHaveBeenCalledTimes(3);
  });

  it('sí suena de nuevo al salir de la card y volver a entrar', () => {
    const card = document.getElementById('card')!;
    const outside = document.getElementById('outside')!;

    dispatchMouseOver(card, outside);
    expect(hoverSpy).toHaveBeenCalledTimes(1);

    // Salir de la card hacia un elemento externo no dispara hover().
    dispatchMouseOver(outside, card);
    expect(hoverSpy).toHaveBeenCalledTimes(1);

    // Reentrar a la card sí dispara hover() de nuevo.
    dispatchMouseOver(card, outside);
    expect(hoverSpy).toHaveBeenCalledTimes(2);
  });
});
