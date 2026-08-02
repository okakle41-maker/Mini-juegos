/**
 * js/games/shipControl.logic.ts
 *
 * Lógica pesada de "Centro de Control" — cargada lazy vía
 * GameConfig.logic (ver games/shipControl.ts) solo cuando el usuario
 * abre la vista.
 *
 * A diferencia de signalTriangulation.logic.ts (un solo tablero
 * rotado 4 formas), acá hay 4 paneles TOTALMENTE DISTINTOS — este
 * módulo muestra únicamente el panel del rol propio
 * (shipControlSystem.myRole()) y oculta los otros 3 por completo, no
 * solo visualmente: nunca pide datos que no le corresponden a mi rol
 * (getMyState devuelve null para sensors/comms, ver
 * shipControlSystem.ts).
 *
 * Dos loops de polling independientes, ambos arrancados acá (no en
 * shipControlSystem, que solo expone los métodos):
 *   - shipControlSystem.startTicking(): dispara tick_ship_control_match
 *     (generación de eventos + movimiento físico + chequeo de destino),
 *     cualquiera de los 4 roles lo corre, es idempotente del lado servidor.
 *   - refreshLoop local (POLL_INTERVAL_MS, más corto): refresca mi
 *     propio estado filtrado por rol + mis eventos activos, para pintar
 *     el panel. Separado del tick porque uno modifica el mundo (una
 *     sola vez es suficiente entre los 4) y el otro solo lee mi propia
 *     vista (cada cliente necesita el suyo).
 *
 * Lo que este módulo NUNCA hace: leer hidden_solution, calcular si una
 * acción es correcta, o mostrar el panel de un rol que no es el propio.
 * Toda esa validación vive exclusivamente en submit_ship_action
 * (security definer) — ver migration_017_ship_control.sql sección 6.
 */

import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import GameHelpers from '../utils/gameHelpers.js';
import type { GameUi } from '../types/game.js';
import {
  shipControlSystem,
  type SCRole,
  type SCEvent,
  type SCNavigationState,
  type SCEnergyState,
  type SCMatch
} from '../shipControlSystem.js';
import { playMorsePattern, type MorsePlaybackHandle } from '../utils/shipControlMorseAudio.js';

const POLL_INTERVAL_MS = 1500;

const ROLE_LABELS: Record<SCRole, string> = {
  navigation: 'Navegación',
  sensors: 'Sensores',
  energy: 'Energía',
  comms: 'Comunicaciones'
};

interface SCGameInstance {
  stop: () => void;
}

function fmtCountdown(deadlineAt: string): string {
  const ms = new Date(deadlineAt).getTime() - Date.now();
  if (ms <= 0) return '0s';
  return `${Math.ceil(ms / 1000)}s`;
}

export function init(ui: GameUi) {
  const loginRequiredEl = ui.scLoginRequired as HTMLElement | undefined;
  const waitingPanelEl = ui.scWaitingPanel as HTMLElement | undefined;
  const rolePickerEl = ui.scRolePicker as HTMLElement | undefined;
  const roleErrorEl = ui.scRoleError as HTMLElement | undefined;
  const livesLabelEl = ui.scLivesLabel as HTMLElement | undefined;

  const eventBannerEl = ui.scEventBanner as HTMLElement | undefined;
  const eventMessageEl = ui.scEventMessage as HTMLElement | undefined;
  const eventTimerEl = ui.scEventTimer as HTMLElement | undefined;

  const navPanelEl = ui.scNavPanel as HTMLElement | undefined;
  const headingValueEl = ui.scHeadingValue as HTMLElement | undefined;
  const speedValueEl = ui.scSpeedValue as HTMLElement | undefined;
  const positionValueEl = ui.scPositionValue as HTMLElement | undefined;
  const headingSliderEl = ui.scHeadingSlider as HTMLInputElement | undefined;
  const speedSliderEl = ui.scSpeedSlider as HTMLInputElement | undefined;
  const confirmEvasionBtn = ui.scConfirmEvasionBtn as HTMLButtonElement | undefined;

  const sensorsPanelEl = ui.scSensorsPanel as HTMLElement | undefined;
  const sensorReadingEl = ui.scSensorReading as HTMLElement | undefined;
  const trajectoryLockedEl = ui.scTrajectoryLocked as HTMLElement | undefined;
  const bearingInputWrapEl = ui.scBearingInputWrap as HTMLElement | undefined;
  const bearingInputEl = ui.scBearingInput as HTMLInputElement | undefined;
  const submitBearingBtn = ui.scSubmitBearingBtn as HTMLButtonElement | undefined;

  const energyPanelEl = ui.scEnergyPanel as HTMLElement | undefined;
  const powerShieldsEl = ui.scPowerShields as HTMLInputElement | undefined;
  const powerEnginesEl = ui.scPowerEngines as HTMLInputElement | undefined;
  const powerCommsEl = ui.scPowerComms as HTMLInputElement | undefined;
  const powerWeaponsEl = ui.scPowerWeapons as HTMLInputElement | undefined;
  const powerLifeSupportEl = ui.scPowerLifeSupport as HTMLInputElement | undefined;
  const powerShieldsValueEl = ui.scPowerShieldsValue as HTMLElement | undefined;
  const powerEnginesValueEl = ui.scPowerEnginesValue as HTMLElement | undefined;
  const powerCommsValueEl = ui.scPowerCommsValue as HTMLElement | undefined;
  const powerWeaponsValueEl = ui.scPowerWeaponsValue as HTMLElement | undefined;
  const powerLifeSupportValueEl = ui.scPowerLifeSupportValue as HTMLElement | undefined;
  const powerTotalEl = ui.scPowerTotal as HTMLElement | undefined;
  const applyPowerBtn = ui.scApplyPowerBtn as HTMLButtonElement | undefined;
  const sequencePanelEl = ui.scSequencePanel as HTMLElement | undefined;
  const sequenceButtonsEl = ui.scSequenceButtons as HTMLElement | undefined;

  const commsPanelEl = ui.scCommsPanel as HTMLElement | undefined;
  const commsMessageEl = ui.scCommsMessage as HTMLElement | undefined;
  const morseWrapEl = ui.scMorseWrap as HTMLElement | undefined;
  const playMorseBtn = ui.scPlayMorseBtn as HTMLButtonElement | undefined;
  const checksumWrapEl = ui.scChecksumWrap as HTMLElement | undefined;
  const codeInputEl = ui.scCodeInput as HTMLInputElement | undefined;
  const checksumInputEl = ui.scChecksumInput as HTMLInputElement | undefined;
  const submitCodeBtn = ui.scSubmitCodeBtn as HTMLButtonElement | undefined;

  const actionResultEl = ui.scActionResult as HTMLElement | undefined;
  const matchResultEl = ui.scMatchResult as HTMLElement | undefined;

  const cleanup = GameHelpers.createCleanupManager();
  const allPanels = [navPanelEl, sensorsPanelEl, energyPanelEl, commsPanelEl];

  if (!shipControlSystem.isPlayerEligible()) {
    loginRequiredEl?.classList.remove('hidden');
    waitingPanelEl?.classList.add('hidden');
    allPanels.forEach((p) => p?.classList.add('hidden'));
    GameInstanceRegistry.set<SCGameInstance>('ship_control', { stop: () => {} });
    return;
  }

  const match = shipControlSystem.getCurrentMatch();

  if (!match) {
    // Sin partida activa: igual criterio que Signal Triangulation, la
    // vista de lobby es responsable de crear/unirse antes de entrar acá.
    waitingPanelEl?.classList.remove('hidden');
    const msgEl = ui.scWaitingMessage as HTMLElement | undefined;
    if (msgEl) msgEl.textContent = 'No hay ninguna partida de Centro de Control activa. Volvé al lobby para crear o unirte a una.';
    rolePickerEl?.classList.add('hidden');
    GameInstanceRegistry.set<SCGameInstance>('ship_control', { stop: () => {} });
    return;
  }

  let myRole: SCRole | null = shipControlSystem.myRole();
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let lastEventIds = new Set<string>();
  let currentMorsePattern: string | null = null;
  let activeMorsePlayback: MorsePlaybackHandle | null = null;

  cleanup.addListener(playMorseBtn ?? null, 'click', () => {
    if (!currentMorsePattern) return;
    activeMorsePlayback?.cancel();
    activeMorsePlayback = playMorsePattern(currentMorsePattern);
  });

  function showActionResult(text: string, ok: boolean | null) {
    if (!actionResultEl) return;
    actionResultEl.textContent = text;
    actionResultEl.classList.remove('hidden');
    actionResultEl.classList.toggle('sc-result-ok', ok === true);
    actionResultEl.classList.toggle('sc-result-bad', ok === false);
  }

  function showRolePanelFor(role: SCRole | null) {
    allPanels.forEach((p) => p?.classList.add('hidden'));
    if (!role) return;
    const map: Record<SCRole, HTMLElement | undefined> = {
      navigation: navPanelEl,
      sensors: sensorsPanelEl,
      energy: energyPanelEl,
      comms: commsPanelEl
    };
    map[role]?.classList.remove('hidden');
  }

  // ── Selección de rol (mientras la partida está 'waiting') ──────────
  function renderRolePicker() {
    if (!rolePickerEl) return;
    const current = shipControlSystem.getCurrentMatch();
    if (!current) return;
    rolePickerEl.querySelectorAll<HTMLButtonElement>('.sc-role-btn').forEach((btn) => {
      const role = btn.dataset.role as SCRole;
      const takenBy = current.players[role];
      btn.disabled = !!takenBy;
      btn.textContent = takenBy
        ? `${btn.textContent?.split(' — ')[0] ?? ROLE_LABELS[role]} — ocupado`
        : (btn.textContent?.split(' — ')[0] ?? ROLE_LABELS[role]);
    });
  }

  if (match.status === 'waiting') {
    waitingPanelEl?.classList.remove('hidden');
    allPanels.forEach((p) => p?.classList.add('hidden'));
    renderRolePicker();

    cleanup.addListener(rolePickerEl ?? null, 'click', (event: Event) => {
      const btn = (event.target as HTMLElement).closest('.sc-role-btn') as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      const role = btn.dataset.role as SCRole;
      roleErrorEl?.classList.add('hidden');
      shipControlSystem.joinMatch(match.id, role)
        .then(() => {
          myRole = role;
          waitingPanelEl?.classList.add('hidden');
          showRolePanelFor(myRole);
          startPolling();
        })
        .catch((e) => {
          if (roleErrorEl) {
            roleErrorEl.textContent = e instanceof Error ? e.message : 'No se pudo unir a ese rol.';
            roleErrorEl.classList.remove('hidden');
          }
          renderRolePicker();
        });
    });
  } else {
    showRolePanelFor(myRole);
  }

  shipControlSystem.startTicking();

  // ── Render por rol ───────────────────────────────────────────────

  function renderNavigation(state: SCNavigationState | null) {
    if (!state) return;
    if (headingValueEl) headingValueEl.textContent = `${state.headingDeg}°`;
    if (speedValueEl) speedValueEl.textContent = String(state.speed);
    if (positionValueEl) positionValueEl.textContent = `(${state.positionX}, ${state.positionY})`;
    if (headingSliderEl && document.activeElement !== headingSliderEl) headingSliderEl.value = String(state.headingDeg);
    if (speedSliderEl && document.activeElement !== speedSliderEl) speedSliderEl.value = String(state.speed);
  }

  function renderEnergy(state: SCEnergyState | null) {
    if (!state) return;
    const pairs: [HTMLInputElement | undefined, HTMLElement | undefined, number][] = [
      [powerShieldsEl, powerShieldsValueEl, state.powerShields],
      [powerEnginesEl, powerEnginesValueEl, state.powerEngines],
      [powerCommsEl, powerCommsValueEl, state.powerComms],
      [powerWeaponsEl, powerWeaponsValueEl, state.powerWeapons],
      [powerLifeSupportEl, powerLifeSupportValueEl, state.powerLifeSupport]
    ];
    for (const [slider, label, value] of pairs) {
      if (slider && document.activeElement !== slider) slider.value = String(value);
      if (label) label.textContent = String(value);
    }
    updatePowerTotal();
  }

  function currentPowerValues() {
    return {
      power_shields: Number(powerShieldsEl?.value ?? 0),
      power_engines: Number(powerEnginesEl?.value ?? 0),
      power_comms: Number(powerCommsEl?.value ?? 0),
      power_weapons: Number(powerWeaponsEl?.value ?? 0),
      power_life_support: Number(powerLifeSupportEl?.value ?? 0)
    };
  }

  function updatePowerTotal() {
    const v = currentPowerValues();
    const total = v.power_shields + v.power_engines + v.power_comms + v.power_weapons + v.power_life_support;
    if (powerTotalEl) {
      powerTotalEl.textContent = `Total: ${total} / 100`;
      powerTotalEl.classList.toggle('sc-power-total--over', total > 100);
    }
  }

  [powerShieldsEl, powerEnginesEl, powerCommsEl, powerWeaponsEl, powerLifeSupportEl].forEach((el) => {
    cleanup.addListener(el ?? null, 'input', updatePowerTotal);
  });

  cleanup.addListener(applyPowerBtn ?? null, 'click', () => {
    shipControlSystem.submitAction('redistribute_power', currentPowerValues())
      .then(() => showActionResult('Distribución de energía aplicada.', true))
      .catch((e) => showActionResult(e instanceof Error ? e.message : 'No se pudo aplicar.', false));
  });

  cleanup.addListener(headingSliderEl ?? null, 'change', () => {
    const heading = Number(headingSliderEl?.value ?? 0);
    if (headingValueEl) headingValueEl.textContent = `${heading}°`;
    shipControlSystem.submitAction('set_heading', { heading_deg: heading })
      .catch((e) => showActionResult(e instanceof Error ? e.message : 'No se pudo girar la nave.', false));
  });

  cleanup.addListener(speedSliderEl ?? null, 'change', () => {
    const speed = Number(speedSliderEl?.value ?? 0);
    if (speedValueEl) speedValueEl.textContent = String(speed);
    shipControlSystem.submitAction('set_speed', { speed })
      .catch((e) => showActionResult(e instanceof Error ? e.message : 'No se pudo cambiar la velocidad.', false));
  });

  cleanup.addListener(confirmEvasionBtn ?? null, 'click', () => {
    shipControlSystem.submitAction('confirm_evasion', {})
      .then((r) => showActionResult(r.correct ? '¡Maniobra correcta!' : 'Maniobra registrada — no coincide con la evasión esperada.', r.correct))
      .catch((e) => showActionResult(e instanceof Error ? e.message : 'No se pudo confirmar.', false));
  });

  cleanup.addListener(submitBearingBtn ?? null, 'click', () => {
    const bearing = Number(bearingInputEl?.value ?? -1);
    if (!Number.isFinite(bearing) || bearing < 0 || bearing > 359) {
      showActionResult('Ingresá un rumbo válido (0-359°).', false);
      return;
    }
    shipControlSystem.submitAction('submit_evasion_bearing', { bearing_deg: bearing })
      .then((r) => showActionResult(r.correct ? '¡Rumbo de evasión correcto!' : 'Rumbo registrado — no coincide con el cálculo esperado.', r.correct))
      .catch((e) => showActionResult(e instanceof Error ? e.message : 'No se pudo enviar.', false));
  });

  cleanup.addListener(submitCodeBtn ?? null, 'click', () => {
    const code = codeInputEl?.value?.trim() ?? '';
    if (!code) {
      showActionResult('Ingresá el código decodificado.', false);
      return;
    }
    const payload: Record<string, unknown> = { code };
    if (checksumWrapEl && !checksumWrapEl.classList.contains('hidden')) {
      payload.checksum = Number(checksumInputEl?.value ?? -1);
    }
    shipControlSystem.submitAction('submit_decoded_code', payload)
      .then((r) => showActionResult(r.correct ? '¡Código correcto! Retransmitido.' : 'Código registrado — no coincide (probá de nuevo, hay tolerancia de 1 carácter).', r.correct))
      .catch((e) => showActionResult(e instanceof Error ? e.message : 'No se pudo retransmitir.', false));
  });

  // Botones de secuencia de reactor — SIN orden marcado en el cliente
  // (decisión explícita: Energía no recibe power_sequence/step
  // estructurado desde get_my_ship_events, a diferencia de Sensores con
  // su sensor_reading — acá el orden se lo dice Comunicaciones por voz,
  // igual criterio "fuera de banda" que el resto del juego, ver
  // ship-control-design.md sección 2.5). Los 3 botones están siempre
  // habilitados; submit_ship_action/reactor_sequence_step es quien
  // acepta o rechaza cada paso contra power_sequence_step server-side.
  const REACTOR_STEPS: { step: string; label: string }[] = [
    { step: 'stabilize_reactor', label: 'Estabilizar reactor' },
    { step: 'restore_comms', label: 'Restaurar comunicaciones' },
    { step: 'restore_shields', label: 'Restaurar escudos' }
  ];

  function renderSequenceButtons(show: boolean) {
    if (!sequencePanelEl || !sequenceButtonsEl) return;
    sequencePanelEl.classList.toggle('hidden', !show);
    if (!show) return;
    if (!sequenceButtonsEl.dataset.built) {
      sequenceButtonsEl.dataset.built = '1';
      sequenceButtonsEl.innerHTML = REACTOR_STEPS
        .map(({ step, label }) => `<button type="button" class="sc-seq-btn" data-step="${step}">${label}</button>`)
        .join('');
    }
  }

  cleanup.addListener(sequenceButtonsEl ?? null, 'click', (event: Event) => {
    const btn = (event.target as HTMLElement).closest('.sc-seq-btn') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;
    const step = btn.dataset.step;
    shipControlSystem.submitAction('reactor_sequence_step', { step })
      .then((r) => showActionResult(r.correct ? 'Paso correcto.' : 'Paso incorrecto — revisá el orden.', r.correct))
      .catch((e) => showActionResult(e instanceof Error ? e.message : 'No se pudo enviar el paso.', false));
  });

  // ── Eventos activos (filtrados por rol) ─────────────────────────────

  function renderEvents(events: SCEvent[]) {
    const primary = events[0] ?? null;

    if (!primary || !primary.message) {
      eventBannerEl?.classList.add('hidden');
    } else {
      eventBannerEl?.classList.remove('hidden');
      if (eventMessageEl) eventMessageEl.textContent = primary.message;
      if (eventTimerEl) eventTimerEl.textContent = fmtCountdown(primary.deadlineAt);
    }

    if (myRole === 'sensors') {
      if (primary?.sensorReading) {
        if (sensorReadingEl) {
          sensorReadingEl.textContent = `Rumbo aproximado: ${primary.sensorReading.bearing}° — distancia: ${primary.sensorReading.distance}`;
        }
        const unlocked = !!primary.trajectoryUnlocked;
        trajectoryLockedEl?.classList.toggle('hidden', unlocked);
        bearingInputWrapEl?.classList.toggle('hidden', !unlocked);
        submitBearingBtn?.classList.toggle('hidden', !unlocked);
      } else {
        if (sensorReadingEl) sensorReadingEl.textContent = 'Sin lecturas activas.';
        trajectoryLockedEl?.classList.add('hidden');
        bearingInputWrapEl?.classList.add('hidden');
        submitBearingBtn?.classList.add('hidden');
      }
    }

    if (myRole === 'comms') {
      if (primary?.message) {
        if (commsMessageEl) commsMessageEl.textContent = primary.message;
        morseWrapEl?.classList.remove('hidden');
        // El checksum solo aplica a eventos que lo requieren (ver
        // event_types.requires_checksum) — el mensaje narrativo no
        // distingue esto por texto, así que se muestra siempre que haya
        // un evento activo con mensaje; enviar checksum vacío en
        // eventos que no lo piden simplemente no afecta la validación
        // server-side (hidden_solution.checksum_digit es null ahí).
        checksumWrapEl?.classList.remove('hidden');

        // Patrón Morse: solo presente si el evento activo requiere
        // morse (ver get_my_ship_events, migración sección 3.4). Si
        // cambió de evento (o de patrón), cancelamos cualquier
        // reproducción en curso del código anterior — evita que un
        // clip viejo termine de sonar mezclado con el nuevo evento.
        if (primary.morsePattern !== currentMorsePattern) {
          activeMorsePlayback?.cancel();
          activeMorsePlayback = null;
        }
        currentMorsePattern = primary.morsePattern;
        playMorseBtn?.classList.toggle('hidden', !currentMorsePattern);
      } else {
        if (commsMessageEl) commsMessageEl.textContent = 'Sin mensajes del ordenador.';
        morseWrapEl?.classList.add('hidden');
        currentMorsePattern = null;
        activeMorsePlayback?.cancel();
        activeMorsePlayback = null;
        playMorseBtn?.classList.add('hidden');
      }
    }

    if (myRole === 'navigation') {
      // Navegación no recibe mensaje propio para la mayoría de eventos
      // (ver diseño sección 1) pero sí necesita el botón de confirmar
      // evasión disponible mientras haya CUALQUIER evento activo que lo
      // requiera — se habilita siempre que haya un evento activo, el
      // servidor determina si corresponde (submit_ship_action rechaza
      // si el action_type no aplica al evento, ver migración sección 6).
      confirmEvasionBtn?.classList.toggle('hidden', !primary);
    }

    if (myRole === 'energy') {
      // Igual criterio que el botón de confirmar evasión de Navegación:
      // se muestra el panel de secuencia siempre que haya un evento
      // activo (el servidor determina si reactor_sequence_step aplica a
      // ESTE evento en particular vía power_sequence_step no nulo — un
      // paso enviado a un evento que no la requiere simplemente no
      // matchea nada y submit_ship_action lo trata como incorrecto sin
      // romper nada, ver migración sección 6).
      renderSequenceButtons(!!primary);
    }

    lastEventIds = new Set(events.map((e) => e.id));
  }

  // ── Loop de refresco de estado propio + eventos ──────────────────────

  async function refresh() {
    const current = shipControlSystem.getCurrentMatch();
    if (!current) return;

    if (livesLabelEl) livesLabelEl.textContent = `❤️ ${current.lives}`;

    if (current.status !== 'waiting' && current.status !== 'playing') {
      finishMatch(current);
      return;
    }

    if (current.status === 'waiting') {
      renderRolePicker();
      return;
    }

    if (!myRole) myRole = shipControlSystem.myRole();
    if (!myRole) return;

    const [state, events] = await Promise.all([
      shipControlSystem.getMyState(myRole),
      shipControlSystem.getMyEvents()
    ]);

    if (myRole === 'navigation') renderNavigation(state as SCNavigationState | null);
    if (myRole === 'energy') renderEnergy(state as SCEnergyState | null);
    renderEvents(events);
  }

  function finishMatch(m: SCMatch) {
    stopPolling();
    allPanels.forEach((p) => p?.classList.add('hidden'));
    eventBannerEl?.classList.add('hidden');
    if (matchResultEl) {
      const text = m.status === 'completed'
        ? `¡Misión cumplida! Llegaron a destino tras superar ${m.eventsSurvived} eventos.`
        : m.status === 'failed'
          ? `Nave perdida — se quedaron sin vidas tras ${m.eventsFailed} fallos.`
          : 'Partida abandonada.';
      matchResultEl.textContent = text;
      matchResultEl.classList.remove('hidden');
    }
  }

  function startPolling() {
    stopPolling();
    void refresh();
    refreshTimer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  if (match.status !== 'waiting') {
    startPolling();
  }

  cleanup.addListener(window, 'sc:match_changed', () => {
    const current = shipControlSystem.getCurrentMatch();
    if (!current) return;
    if (current.status === 'playing' && waitingPanelEl && !waitingPanelEl.classList.contains('hidden')) {
      // Los 4 roles se completaron y start_ship_control_match ya corrió
      // (ver shipControlSystem.joinMatch) — pasar de selección de rol al
      // panel de juego.
      waitingPanelEl.classList.add('hidden');
      showRolePanelFor(myRole);
      startPolling();
    }
    if (current.status !== 'waiting' && current.status !== 'playing') {
      finishMatch(current);
    }
  });

  GameInstanceRegistry.set<SCGameInstance>('ship_control', {
    stop: () => {
      stopPolling();
      shipControlSystem.stopTicking();
      activeMorsePlayback?.cancel();
      cleanup.cleanup();
    }
  });
}

export function stop() {
  const instance = GameInstanceRegistry.get<SCGameInstance>('ship_control');
  if (instance) instance.stop();
  void shipControlSystem.leaveCurrentMatch();
  GameInstanceRegistry.clear('ship_control');
}
