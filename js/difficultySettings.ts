/**
 * difficultySettings.ts — Conecta el selector "DIFICULTAD GLOBAL" de la
 * vista Configuración (js/views/configuracion.ts, #configDifficultySelect)
 * con DifficultyPresetsManager (js/difficultyPresets.ts).
 *
 * difficultyPresets.ts se cargaba desde main.ts pero ningún selector ni
 * juego lo consultaba — existía el motor de presets sin ninguna forma de
 * que el usuario los eligiera. Este módulo guarda el preset elegido bajo
 * el gameId especial 'global' y lo usa como default: los juegos que
 * todavía no tienen su propio selector de dificultad (ver
 * js/games/rhythmclick.logic.ts para un ejemplo ya conectado) pueden leer
 * `difficultyPresets.getGameSettings('global')` para escalar tiempo,
 * puntaje, etc. según este valor.
 *
 * Mismo patrón de delegación de eventos sobre `document` que
 * configPanel.ts / configReset.ts, porque la vista "configuracion" se
 * hidrata de forma lazy y el <select> no existe en el DOM cuando este
 * módulo se carga.
 */

import difficultyPresets from './difficultyPresets.js';

const SELECT_ID = 'configDifficultySelect';
const GLOBAL_GAME_ID = 'global';

type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'expert';

function isDifficultyLevel(value: string): value is DifficultyLevel {
  return value === 'easy' || value === 'normal' || value === 'hard' || value === 'expert';
}

function syncSelectWithStoredPreset(): void {
  const select = document.getElementById(SELECT_ID);
  if (!(select instanceof HTMLSelectElement)) return;
  select.value = difficultyPresets.getGamePreset(GLOBAL_GAME_ID);
}

function handleChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.id !== SELECT_ID) return;

  const value = target.value;
  if (!isDifficultyLevel(value)) return;

  difficultyPresets.setGamePreset(GLOBAL_GAME_ID, value);
}

document.addEventListener('change', handleChange);
// Al hidratarse la vista (o volver a ella), refleja el preset guardado.
document.addEventListener('view-shown', syncSelectWithStoredPreset);

export default { syncSelectWithStoredPreset };
