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
});
