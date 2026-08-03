/**
 * js/games/arrowGame.logic.ts
 *
 * Lógica pesada del juego "Desafío Flechas" (init/stop + clase
 * ArrowClicker), extraída de arrowGame.ts para que el bundler le dé su
 * propio chunk y solo se descargue cuando el usuario abre la vista
 * "arrow" — ver `logic` en arrowGame.ts y el comentario de
 * GameConfig.logic en core/gameRegistry.ts.
 *
 * arrowGame.ts sigue siendo el módulo que se importa al arrancar la app
 * (contiene solo metadatos ligeros: nombre, tag, ícono, descripción,
 * necesarios de entrada para pintar el lobby); este archivo se importa
 * solo bajo demanda desde `game.logic()`.
 */

import GameInstanceRegistry from '../core/gameInstanceRegistry.js';
import safeStorage from '../core/safeStorage.js';
import GameHelpers from '../utils/gameHelpers.js';
import type { GameUi } from '../types/game.js';
import audioManager from '../audioManager.js';
import { lobbySystem } from '../lobbySystem.js';
import { setupSplitView, type SplitViewHandle } from '../utils/multiplayerSplitView.js';

interface ArrowClickerInstance {
  stop: (showResult: boolean, isExit?: boolean) => void;
}

interface ArrowOptions {
  steps: number;
  time: number;
  penalty: number;
}

export function init(ui: GameUi) {
  const startArrow = ui.start as HTMLButtonElement | undefined;
  const arrowLevelEl = ui.arrowLevel as HTMLSelectElement | undefined;
  const arrowLengthEl = ui.arrowLength as HTMLInputElement | undefined;
  const arrowTimeInput = ui.arrowTimeInput as HTMLInputElement | undefined;
  const {
    arrowButtons,
    arrowDisplay,
    arrowStep,
    arrowCombo,
    arrowPercent,
    arrowProgress,
    arrowRecord,
    arrowMessage,
    arrowSequence
  } = ui;

  if (!startArrow) return;

  // Partida de lobby (ver lobbySystem.ts): la sub-partida ya queda en
  // 'playing' con settings fijados por quien la creó apenas se une el
  // segundo jugador — no hay pantalla previa de "esperando anfitrión"
  // (eso era del viejo flujo de sala 1v1 suelta sobre MultiplayerSystem,
  // ver nota histórica en multiplayerSplitView.ts).
  const activeMatch = lobbySystem.getCurrentMatch();
  const isMultiplayer = activeMatch?.gameId === 'arrow';

  const applyArrowSettings = (s: Record<string, any>) => {
    if (!arrowLengthEl || !arrowTimeInput) return;
    arrowLengthEl.value = String(s.steps ?? 20);
    arrowTimeInput.value = String(s.time ?? 15);
  };

  // Split screen "Vos"/"Rival" (ver js/utils/multiplayerSplitView.ts):
  // acá es un panel resumen (solo símbolo actual + combo), no un
  // tablero espejo completo — Arrow no usa remirror/ownBoard.
  const split: SplitViewHandle = setupSplitView('arrow', ui, 'arrow');
  const rivalDisplay = ui.arrowRivalDisplay as HTMLElement | undefined;
  const rivalCombo = ui.arrowRivalCombo as HTMLElement | undefined;
  const rivalLabel = ui.arrowRivalLabel as HTMLElement | undefined;

  if (isMultiplayer) {
    applyArrowSettings(activeMatch!.settings || {});
    [arrowLevelEl, arrowLengthEl, arrowTimeInput].forEach(el => {
      if (el) el.disabled = true;
    });
    if (split.isSpectating) {
      startArrow.disabled = true;
      startArrow.classList.add('hidden');
      if (arrowMessage) {
        arrowMessage.textContent = 'Especteando esta partida.';
        arrowMessage.classList.remove('hidden');
      }
    } else if (split.isHost) {
      if (arrowMessage) {
        arrowMessage.textContent = 'Partida de lobby: presioná Empezar cuando quieras. Tu rival arranca junto con vos.';
        arrowMessage.classList.remove('hidden');
      }
    } else {
      // No-host: espera la señal de arranque del anfitrión (ver
      // split.onStart más abajo).
      startArrow.disabled = true;
      startArrow.classList.add('hidden');
      if (arrowMessage) {
        arrowMessage.textContent = 'Esperando a que el anfitrión empiece la partida...';
        arrowMessage.classList.remove('hidden');
      }
    }
  }

  split.onRivalEvent('arrow:input', ({ symbol, correct, combo }: { symbol: string; correct: boolean; combo: number }) => {
    if (rivalDisplay) {
      rivalDisplay.textContent = symbol;
      rivalDisplay.classList.remove('correct', 'wrong');
      rivalDisplay.classList.add(correct ? 'correct' : 'wrong');
    }
    if (rivalCombo) rivalCombo.textContent = `Combo: ${combo}`;
  });

  split.onRivalEvent('arrow:gameover', ({ percent }: { percent: number }) => {
    if (rivalLabel) rivalLabel.textContent = `Rival — ${percent}%`;
  });

  class ArrowClicker {
    ui: GameUi;
    options: ArrowOptions;
    arrows: Array<{ key: string; symbol: string; name: string }>;
    recordKey: string;
    record: number;
    cleanup: ReturnType<typeof GameHelpers.createCleanupManager>;
    state: {
      sequence: Array<{ key: string; symbol: string; name: string }>;
      currentStep: number;
      timeLeft: number;
      active: boolean;
      combo: number;
      lastResult: boolean | null;
    };

    constructor(ui: GameUi, options: Partial<ArrowOptions> = {}) {
      this.ui = ui;
      this.cleanup = GameHelpers.createCleanupManager();
      this.options = {
        steps: 20,
        time: 15,
        penalty: 0.5,
        ...options
      };
      this.arrows = [
        { key: 'ArrowUp', symbol: '↑', name: 'Arriba' },
        { key: 'ArrowDown', symbol: '↓', name: 'Abajo' },
        { key: 'ArrowLeft', symbol: '←', name: 'Izquierda' },
        { key: 'ArrowRight', symbol: '→', name: 'Derecha' }
      ];
      this.recordKey = 'arrowClickerRecord';
      this.loadRecord();
      this.reset();
    }

    loadRecord() {
      this.record = safeStorage.getNumber(this.recordKey, 0);
    }

    saveRecord() {
      safeStorage.setNumber(this.recordKey, this.record);
    }

    generateSequence(length: number) {
      return Array.from({ length }, () => this.arrows[Math.floor(Math.random() * this.arrows.length)]);
    }

    reset() {
      this.state = {
        sequence: [],
        currentStep: 0,
        timeLeft: this.options.time,
        active: false,
        combo: 0,
        lastResult: null
      };
      this.cleanup.cleanup();
      this.clearMessage();
      this.clearDisplayState();
      this.updateUI();
    }

    start(options: Partial<ArrowOptions> = {}) {
      if (this.state.active) return;
      if (split.isSpectating) return;
      this.options.steps = Number(options.steps || this.options.steps);
      this.options.time = Number(options.time || this.options.time);
      this.state.sequence = this.generateSequence(this.options.steps);
      this.state.currentStep = 0;
      this.state.timeLeft = this.options.time;
      this.state.combo = 0;
      this.state.active = true;
      this.state.lastResult = null;
      this.clearMessage();
      this.clearDisplayState();
      startArrow.disabled = true;
      this.updateUI();
      this.startTimer();
      return true;
    }

    stop(success: boolean, isExit = false) {
      // isExit: true cuando stop() se llama desde afuera para forzar el
      // cierre (stop() global del módulo, al salir de la vista), no
      // porque la secuencia realmente terminó por sí sola (ganó o falló
      // en el juego). success=false en ese caso es solo para completar
      // la animación visual de "fin de intento" — no es un resultado
      // real que deba reportarse a completeMatch(). Antes no existía
      // esta distinción: salir de la vista de Arrow a mitad de una
      // sub-partida del lobby reportaba ese resultado parcial forzado
      // como si el jugador hubiese fallado la secuencia intencionalmente,
      // en vez de dejarla resumible (la UI del lobby sí ofrece "Volver a
      // mi partida" mientras la sub-partida siga 'playing') o marcarla
      // abandoned vía leaveCurrentMatch() (ver stop() global más abajo).
      if (!this.state.active) return success === true;
      const wasForcedExit = isExit;
      this.state.active = false;
      this.cleanup.cleanup();
      startArrow.disabled = false;
      this.state.lastResult = success;
      let finalPercent: number;
      if (success) {
        this.setMessage('HACK COMPLETE', 'success');
        this.ui.arrowDisplay?.classList.add('correct');
        if (audioManager) audioManager.play('perfect');
        this.updateRecord(100);
        split.sendEvent('arrow:gameover', { percent: 100 });
        finalPercent = 100;
      } else {
        this.setMessage('ACCESS DENIED', 'fail');
        this.ui.arrowDisplay?.classList.add('wrong');
        if (audioManager) audioManager.play('gameover');
        const percent = Math.round((this.state.currentStep / this.state.sequence.length) * 100);
        this.updateRecord(percent);
        split.sendEvent('arrow:gameover', { percent });
        finalPercent = percent;
      }
      this.updateUI();
      // Reporta el resultado propio a la sub-partida del lobby — ver
      // lobbySystem.completeMatch: se marca 'completed' recién cuando
      // ambos jugadores reportaron el suyo. No aplica si se está
      // especteando (un espectador no tiene resultado propio que
      // reportar — su "stop" solo limpia estado visual local), ni si
      // wasForcedExit es true: en ese caso es leaveCurrentMatch(),
      // llamado desde el mismo stop() global, quien decide si
      // corresponde marcar la sub-partida abandoned.
      if (split.isMultiplayer && !split.isSpectating && !wasForcedExit) {
        void lobbySystem.completeMatch(finalPercent);
      }
      return success === true;
    }

    updateRecord(percent: number) {
      if (percent > this.record) {
        this.record = percent;
        this.saveRecord();
      }
      if (window.Leaderboard) window.Leaderboard.save('arrow', percent);
    }

    startTimer() {
      this.cleanup.cleanup();
      this.cleanup.addInterval(() => {
        if (!this.state.active) return;
        this.state.timeLeft = Math.max(0, this.state.timeLeft - 0.1);
        this.updateUI();
        if (this.state.timeLeft <= 0) {
          this.stop(false);
        }
      }, 100);
    }

    clearMessage() {
      const arrowMessage = this.ui.arrowMessage as HTMLElement;
      if (!arrowMessage) return;
      arrowMessage.textContent = '';
      arrowMessage.classList.remove('visible', 'success', 'fail');
    }

    clearDisplayState() {
      (this.ui.arrowDisplay as HTMLElement)?.classList.remove('correct', 'wrong', 'shake');
      (this.ui.arrowMessage as HTMLElement)?.classList.remove('visible', 'success', 'fail');
    }

    setMessage(text: string, type: string) {
      const arrowMessage = this.ui.arrowMessage as HTMLElement;
      if (!arrowMessage) return;
      arrowMessage.textContent = text;
      arrowMessage.classList.remove('success', 'fail', 'visible');
      if (type) arrowMessage.classList.add(type);
      requestAnimationFrame(() => arrowMessage.classList.add('visible'));
    }

    // El botón táctil ahora distingue acierto/fallo con las mismas
    // clases que .arrow-display.correct/.wrong (ver arrow.css), en vez
    // de aplicar siempre la misma clase 'active' sin importar el
    // resultado.
    flashButton(key: string, correct: boolean) {
      const buttons = Array.from(this.ui.arrowButtons?.querySelectorAll<HTMLElement>('button[data-key]') || []);
      const button = buttons.find((btn) => btn.dataset.key === key);
      if (!button) return;
      const feedbackClass = correct ? 'active-success' : 'active-fail';
      (button as HTMLElement).classList.add('active', feedbackClass);
      this.cleanup.addTimeout(() => (button as HTMLElement).classList.remove('active', feedbackClass), 140);
    }

    shakeDisplay() {
      const display = this.ui.arrowDisplay;
      if (!display) return;
      display.classList.add('shake');
      this.cleanup.addTimeout(() => display.classList.remove('shake'), 260);
    }

    formatTime(value: number) {
      return `${Math.max(0, value).toFixed(1)}s`;
    }

    handleInput(key: string) {
      if (!this.state.active) return;
      if (split.isSpectating) return;
      const expected = this.state.sequence[this.state.currentStep];
      if (!expected) return;
      const isCorrect = key === expected.key;
      const arrowDisplay = this.ui.arrowDisplay as HTMLElement;
      if (isCorrect) {
        this.state.currentStep += 1;
        this.state.combo += 1;
        arrowDisplay?.classList.remove('wrong');
        arrowDisplay?.classList.add('correct');
        this.setMessage('Correcto', 'success');
        this.flashButton(key, true);
        if (audioManager) audioManager.play('click');
        split.sendEvent('arrow:input', { symbol: expected.symbol, correct: true, combo: this.state.combo });
        if (this.state.currentStep >= this.state.sequence.length) {
          return this.stop(true);
        }
      } else {
        this.state.combo = 0;
        this.state.timeLeft = Math.max(0, this.state.timeLeft - this.options.penalty);
        arrowDisplay?.classList.remove('correct');
        arrowDisplay?.classList.add('wrong');
        this.shakeDisplay();
        this.setMessage('Penalización -0.5s', 'fail');
        if (audioManager) audioManager.play('miss');
        this.flashButton(key, false);
        split.sendEvent('arrow:input', { symbol: expected.symbol, correct: false, combo: 0 });
        if (this.state.timeLeft <= 0) {
          return this.stop(false);
        }
      }
      this.updateUI();
    }

    handleKey(event: KeyboardEvent) {
      if (!this.state.active) return;
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault();
      this.handleInput(event.key);
    }

    updateUI() {
      const currentArrow = this.state.sequence[this.state.currentStep] || this.arrows[0];
      const percent = this.state.sequence.length
        ? Math.round((this.state.currentStep / this.state.sequence.length) * 100)
        : 0;
      const arrowDisplay = this.ui.arrowDisplay as HTMLElement;
      const arrowStep = this.ui.arrowStep as HTMLElement;
      const arrowPercent = this.ui.arrowPercent as HTMLElement;
      const arrowProgress = this.ui.arrowProgress as HTMLElement;
      const arrowCombo = this.ui.arrowCombo as HTMLElement;
      const arrowRecord = this.ui.arrowRecord as HTMLElement;
      const arrowTime = this.ui.arrowTime as HTMLElement;
      const arrowSequence = this.ui.arrowSequence as HTMLElement;
      
      // El símbolo Unicode (↑↓←→) es el texto visible, pero sin contexto
      // no dice nada a un lector de pantalla. init() ya pone un aria-label
      // genérico ("Flecha actual a presionar") junto con role="img" —
      // acá lo sobreescribimos en cada actualización con el nombre real
      // de la flecha (currentArrow.name, ya existe en el dataset de
      // flechas, evita mantener dos mapeos símbolo→nombre distintos).
      if (arrowDisplay) {
        arrowDisplay.textContent = currentArrow.symbol;
        arrowDisplay.setAttribute('aria-label', `Flecha actual: ${currentArrow.name}`);
      }
      if (arrowStep) arrowStep.textContent = `${Math.min(this.state.currentStep, this.state.sequence.length)}/${this.state.sequence.length}`;
      if (arrowPercent) arrowPercent.textContent = `${percent}%`;
      if (arrowProgress) arrowProgress.style.width = `${percent}%`;
      if (arrowCombo) arrowCombo.textContent = `Combo: ${this.state.combo}`;
      if (arrowRecord) arrowRecord.textContent = `Récord: ${this.record}%`;
      if (arrowTime) {
        arrowTime.textContent = this.formatTime(this.state.timeLeft);
        const ratio = this.state.timeLeft / this.options.time;
        if (ratio > 0.5) {
          arrowTime.style.color = '#00ff88';
        } else if (ratio > 0.25) {
          arrowTime.style.color = '#ffd166';
        } else {
          arrowTime.style.color = '#ff3333';
        }
      }
      if (arrowSequence) {
        arrowSequence.innerHTML = this.state.sequence.map((arrow, index) => {
          const classes = [
            index < this.state.currentStep ? 'passed' : '',
            index === this.state.currentStep ? 'current' : ''
          ].filter(Boolean).join(' ');
          return `<span class="${classes}">${arrow.symbol}</span>`;
        }).join('');
      }
    }
  }

  const clicker = new ArrowClicker(
    {
      arrowDisplay,
      arrowStep,
      arrowCombo,
      arrowPercent,
      arrowProgress,
      arrowTime: ui.arrowTime,
      arrowRecord,
      arrowMessage,
      arrowSequence,
      arrowButtons
    },
    {
      steps: 20,
      time: 15,
      penalty: 0.5
    }
  );

  const difficultyLevels: Record<string, { time: number }> = {
    easy: { time: 20 },
    normal: { time: 15 },
    hard: { time: 10 }
  };

  if (arrowLevelEl) {
    const applyLevel = () => {
      const level = arrowLevelEl.value || 'normal';
      const targetTime = difficultyLevels[level]?.time || 15;
      if (arrowTimeInput) arrowTimeInput.value = String(targetTime);
      clicker.options.time = targetTime;
      clicker.updateUI();
    };
    arrowLevelEl.addEventListener('change', applyLevel);
    applyLevel();
  }

  startArrow.addEventListener('click', () => {
    if (split.isSpectating) return;
    // En multiplayer, solo el host tiene este botón visible/habilitado
    // (ver el bloque isMultiplayer más arriba) — el rival arranca
    // reaccionando a onStart. Se mantiene el guard por si igual
    // llegara a dispararse.
    if (split.isMultiplayer && !split.isHost) return;
    const steps = Math.max(1, Math.min(parseInt(arrowLengthEl.value, 10) || 20, 30));
    const time = Math.max(5, Math.min(parseFloat(arrowTimeInput.value) || 15, 30));
    clicker.start({ steps, time });
    // Avisa al rival para que arranque su partida en el mismo
    // instante — cada lado sigue generando su propia secuencia
    // localmente (ver comentario de broadcastStart en
    // multiplayerSplitView.ts).
    split.broadcastStart();
  });

  // No-host: arranca cuando el anfitrión efectivamente empieza.
  split.onStart(() => {
    if (split.isSpectating) return;
    const steps = Math.max(1, Math.min(parseInt(arrowLengthEl.value, 10) || 20, 30));
    const time = Math.max(5, Math.min(parseFloat(arrowTimeInput.value) || 15, 30));
    clicker.start({ steps, time });
  });

  // El rival abandonó la partida a mitad de juego (ver
  // multiplayerSplitView.onOpponentLeft): corta el propio intento acá
  // (sin reportar resultado, isExit=true como en stop() global) y
  // muestra mensaje + botón para volver al lobby, en vez de dejar que
  // el jugador siga jugando solo sin enterarse.
  split.onOpponentLeft(() => {
    clicker.stop(false, true);
    startArrow.disabled = true;
    startArrow.classList.add('hidden');
    const backToLobbyBtn = ui.backToLobby as HTMLButtonElement | undefined;
    if (arrowMessage) {
      (arrowMessage as HTMLElement).textContent = 'Tu rival abandonó la partida.';
      (arrowMessage as HTMLElement).classList.remove('hidden');
      (arrowMessage as HTMLElement).classList.add('visible');
    }
    if (backToLobbyBtn) backToLobbyBtn.classList.remove('hidden');
  });

  // ARIA labels para accesibilidad
  if (arrowDisplay) {
    arrowDisplay.setAttribute('role', 'img');
    arrowDisplay.setAttribute('aria-label', 'Flecha actual a presionar');
  }
  if (arrowSequence) {
    arrowSequence.setAttribute('role', 'img');
    arrowSequence.setAttribute('aria-label', 'Secuencia completa de flechas');
  }
  if (arrowButtons) {
    arrowButtons.setAttribute('role', 'group');
    arrowButtons.setAttribute('aria-label', 'Botones de flechas para control táctil');
  }

  if (arrowButtons) {
    arrowButtons.querySelectorAll('button[data-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        clicker.handleInput((btn as HTMLElement).dataset.key || '');
      });
    });
  }

  const onKeyDown = (event: KeyboardEvent) => clicker.handleKey(event);
  document.addEventListener('keydown', onKeyDown);
  GameInstanceRegistry.set<ArrowClickerInstance>('arrow', clicker);
  arrowKeyDownHandler = onKeyDown;
  arrowSplitCleanup = split.cleanup;
}

let arrowKeyDownHandler: ((event: KeyboardEvent) => void) | null = null;
let arrowSplitCleanup: (() => void) | null = null;

export function stop() {
  const clicker = GameInstanceRegistry.get<ArrowClickerInstance>('arrow');
  if (clicker) clicker.stop(false, true);
  if (arrowKeyDownHandler) {
    document.removeEventListener('keydown', arrowKeyDownHandler);
    arrowKeyDownHandler = null;
  }
  if (arrowSplitCleanup) {
    arrowSplitCleanup();
    arrowSplitCleanup = null;
  }
  // Libera el estado del lobby si el jugador sale de la vista sin
  // haber terminado su sub-partida (o si estaba especteando): sin
  // esto, lobby_players quedaba con status:'playing'/'spectating' y
  // current_match_id apuntando a una sub-partida en curso para
  // siempre, y lobby_matches nunca se marcaba 'abandoned' — nada
  // limpiaba ese estado hasta ahora. No-op si no hay match activo
  // (currentMatch null) o si ya se reportó completeMatch arriba
  // (leaveCurrentMatch no hace nada si currentMatch ya es null).
  void lobbySystem.leaveCurrentMatch();
  GameInstanceRegistry.clear('arrow');
}
