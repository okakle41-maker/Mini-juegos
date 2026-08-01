import { describe, expect, it } from 'vitest';
import { init } from '../js/games/lettersFall.logic.js';

function buildLettersUi() {
  document.body.innerHTML = `
    <div data-ui="lettersModePanel"></div>
    <div data-ui="roleChooser" class="hidden"></div>
    <div data-ui="roomStatus" class="hidden"></div>
    <div data-ui="roomStatusText"></div>
    <div data-ui="roomCodeDisplay"></div>
    <button data-ui="modeSolo"></button>
    <button data-ui="modeCreate"></button>
    <button data-ui="modeJoin"></button>
    <button data-ui="roleViewer"></button>
    <button data-ui="roleTyper"></button>
    <div data-ui="joinCodeRow" class="hidden"></div>
    <input data-ui="joinCodeInput" />
    <button data-ui="roleConfirm" disabled></button>
    <button data-ui="roleBack"></button>
    <button data-ui="roomCancel"></button>
    <button data-ui="start"></button>
    <input data-ui="lettersInput" />
    <div data-ui="lettersArea"></div>
    <div data-ui="lettersMessage"></div>
    <div data-ui="lettersDifficulty"></div>
    <div data-ui="lettersDifficultySelect"></div>
    <div data-ui="lettersScore"></div>
    <div data-ui="lettersBest"></div>
    <div data-ui="lettersLives"></div>
    <div data-ui="lettersCard"></div>
    <div data-ui="lettersControls"></div>
    <div data-ui="lettersRoleBadge"></div>
    <div data-ui="roleChooserLabel"></div>
  `;

  const ui: any = {};
  for (const selector of [
    'lettersModePanel',
    'roleChooser',
    'roomStatus',
    'roomStatusText',
    'roomCodeDisplay',
    'modeSolo',
    'modeCreate',
    'modeJoin',
    'roleViewer',
    'roleTyper',
    'joinCodeRow',
    'joinCodeInput',
    'roleConfirm',
    'roleBack',
    'roomCancel',
    'start',
    'lettersInput',
    'lettersArea',
    'lettersMessage',
    'lettersDifficulty',
    'lettersDifficultySelect',
    'lettersScore',
    'lettersBest',
    'lettersLives',
    'lettersCard',
    'lettersControls',
    'lettersRoleBadge',
    'roleChooserLabel'
  ]) {
    ui[selector] = document.querySelector(`[data-ui="${selector}"]`);
  }

  return ui;
}

describe('Letters Fall coop mode', () => {
  it('resetea el rol y deshabilita el confirmar cuando se alterna entre crear y unirse', () => {
    const ui = buildLettersUi();
    init(ui);

    ui.modeCreate.click();
    ui.roleViewer.click();
    expect(ui.roleConfirm.disabled).toBe(false);

    ui.modeJoin.click();

    expect(ui.roleViewer.getAttribute('aria-pressed')).toBe('false');
    expect(ui.roleTyper.getAttribute('aria-pressed')).toBe('false');
    expect(ui.roleConfirm.disabled).toBe(true);
  });

  /**
   * Regresión: en el markup real (js/views/letters.ts), roleChooser y
   * roomStatus viven ANIDADOS dentro de lettersModePanel, no como
   * hermanos al mismo nivel (a diferencia del fixture plano del test
   * de arriba). showStep() ocultaba lettersModePanel completo al
   * mostrar cualquiera de sus hijos, dejando la pantalla en blanco
   * (solo el back-btn general de la vista, fuera de este panel) al
   * elegir "Crear sala coop" o "Unirse a sala" en producción.
   */
  it('mantiene visible lettersModePanel y su hijo roleChooser al elegir crear sala (markup anidado real)', () => {
    document.body.innerHTML = `
      <div class="letters-card letters-mode-panel" data-ui="lettersModePanel">
        <div class="letters-mode-options">
          <button data-ui="modeSolo"></button>
          <button data-ui="modeCreate"></button>
          <button data-ui="modeJoin"></button>
        </div>
        <div data-ui="roleChooser" class="letters-role-chooser hidden">
          <p data-ui="roleChooserLabel"></p>
          <button data-ui="roleViewer"></button>
          <button data-ui="roleTyper"></button>
          <div data-ui="joinCodeRow" class="hidden"></div>
          <input data-ui="joinCodeInput" />
          <button data-ui="roleConfirm" disabled></button>
          <button data-ui="roleBack"></button>
        </div>
        <div data-ui="roomStatus" class="letters-room-status hidden">
          <p data-ui="roomStatusText"></p>
          <p data-ui="roomCodeDisplay"></p>
          <button data-ui="roomCancel"></button>
        </div>
      </div>
      <button data-ui="start"></button>
      <input data-ui="lettersInput" />
      <div data-ui="lettersArea"></div>
      <div data-ui="lettersMessage"></div>
      <div data-ui="lettersDifficulty"></div>
      <div data-ui="lettersDifficultySelect"></div>
      <div data-ui="lettersScore"></div>
      <div data-ui="lettersBest"></div>
      <div data-ui="lettersLives"></div>
      <div data-ui="lettersCard"></div>
      <div data-ui="lettersControls"></div>
      <div data-ui="lettersRoleBadge"></div>
    `;

    const ui: any = {};
    document.querySelectorAll('[data-ui]').forEach((el) => {
      ui[(el as HTMLElement).dataset.ui!] = el;
    });

    init(ui);
    ui.modeCreate.click();

    expect(ui.lettersModePanel.classList.contains('hidden')).toBe(false);
    expect(ui.roleChooser.classList.contains('hidden')).toBe(false);
    expect(ui.roomStatus.classList.contains('hidden')).toBe(true);
  });
});
