import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateBackButtons } from '../js/utils/backButton';

describe('hydrateBackButtons', () => {
  let backToMenuMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    backToMenuMock = vi.fn();
    (window as any).backToMenu = backToMenuMock;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    delete (window as any).backToMenu;
  });

  it('ignora botones sin data-back-to', () => {
    document.body.innerHTML = '<button class="back-btn"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    expect(btn.dataset.hydrated).toBeUndefined();
    expect(btn.innerHTML).toBe('');
  });

  it('hidrata un botón con data-back-to="home": inyecta ícono + label por defecto', () => {
    document.body.innerHTML = '<button class="back-btn" data-back-to="home"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    expect(btn.innerHTML).toContain('<svg');
    expect(btn.innerHTML).toContain('Volver al lobby');
    expect(btn.dataset.hydrated).toBe('true');
  });

  it('usa el label por defecto específico para "multiplayer"', () => {
    document.body.innerHTML = '<button class="back-btn" data-back-to="multiplayer"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    expect(btn.innerHTML).toContain('Volver a Multiplayer');
  });

  it('usa el label FALLBACK ("Volver") para un target sin entrada en DEFAULT_LABELS', () => {
    document.body.innerHTML = '<button class="back-btn" data-back-to="algunJuegoRaro"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    expect(btn.innerHTML).toContain('Volver');
    expect(btn.innerHTML).not.toContain('Volver al lobby');
    expect(btn.innerHTML).not.toContain('Volver a Multiplayer');
  });

  it('data-back-label explícito tiene prioridad sobre el label por defecto', () => {
    document.body.innerHTML =
      '<button class="back-btn" data-back-to="home" data-back-label="Volver a Skillchecks"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    expect(btn.innerHTML).toContain('Volver a Skillchecks');
    expect(btn.innerHTML).not.toContain('Volver al lobby');
  });

  it('setea aria-label igual al texto visible', () => {
    document.body.innerHTML =
      '<button class="back-btn" data-back-to="home" data-back-label="Volver arriba"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Volver arriba');
  });

  it('conecta el click a window.backToMenu con el target correcto', () => {
    document.body.innerHTML = '<button class="back-btn" data-back-to="skillchecks"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    btn.click();

    expect(backToMenuMock).toHaveBeenCalledWith('skillchecks');
  });

  it('es idempotente: una segunda llamada no re-hidrata ni duplica el listener de click', () => {
    document.body.innerHTML = '<button class="back-btn" data-back-to="home"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    const htmlAfterFirst = btn.innerHTML;

    hydrateBackButtons(); // segunda pasada
    expect(btn.innerHTML).toBe(htmlAfterFirst);

    btn.click();
    // si el listener se hubiese agregado dos veces, esto llamaría 2 veces
    expect(backToMenuMock).toHaveBeenCalledTimes(1);
  });

  it('hidrata múltiples botones en una sola llamada, cada uno con su propio target', () => {
    document.body.innerHTML = `
      <button class="back-btn" data-back-to="home"></button>
      <button class="back-btn" data-back-to="multiplayer"></button>
      <button class="back-btn" data-back-to="skillchecks"></button>
    `;
    hydrateBackButtons();

    const buttons = document.querySelectorAll<HTMLButtonElement>('.back-btn');
    expect(buttons).toHaveLength(3);
    buttons.forEach((btn) => expect(btn.dataset.hydrated).toBe('true'));

    buttons[1].click();
    expect(backToMenuMock).toHaveBeenCalledWith('multiplayer');
  });

  it('acepta un root distinto de document (busca solo dentro de ese subárbol)', () => {
    document.body.innerHTML = `
      <div id="outside"><button class="back-btn" data-back-to="home"></button></div>
      <div id="scope"><button class="back-btn" data-back-to="skillchecks"></button></div>
    `;
    const scope = document.getElementById('scope') as HTMLElement;
    hydrateBackButtons(scope);

    const outsideBtn = document.querySelector('#outside .back-btn') as HTMLButtonElement;
    const scopedBtn = document.querySelector('#scope .back-btn') as HTMLButtonElement;

    expect(outsideBtn.dataset.hydrated).toBeUndefined();
    expect(scopedBtn.dataset.hydrated).toBe('true');
  });

  it('un botón ya hidratado externamente (data-hydrated preexistente) se salta', () => {
    document.body.innerHTML =
      '<button class="back-btn" data-back-to="home" data-hydrated="true"></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    // no debería haber tocado el innerHTML si ya estaba marcado como hidratado
    expect(btn.innerHTML).toBe('');
  });

  it('usa "home" como target por defecto si data-back-to está vacío', () => {
    document.body.innerHTML = '<button class="back-btn" data-back-to=""></button>';
    hydrateBackButtons();

    const btn = document.querySelector('.back-btn') as HTMLButtonElement;
    btn.click();

    expect(backToMenuMock).toHaveBeenCalledWith('home');
  });
});
