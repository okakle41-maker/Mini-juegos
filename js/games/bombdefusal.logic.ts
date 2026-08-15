/**
 * js/games/bombdefusal.logic.ts
 *
 * Lógica pesada extraída de bombdefusal.ts para lazy loading — ver
 * `logic` en bombdefusal.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 *
 * Este archivo tenía originalmente 3212 líneas (tipos, audio,
 * solvers, factories de módulo y el manual, todo junto). Se dividió
 * en archivos hermanos por responsabilidad — este archivo ahora es
 * solo el orquestador (init/stop y el render de cada módulo, que
 * comparten estado local vía closures y no se movieron):
 *   - bombdefusal.types.ts     — BombState y los 31 tipos de módulo
 *   - bombdefusal.data.ts      — tablas de datos estáticos (colores, palabras, nombres)
 *   - bombdefusal.audio.ts     — feedback sonoro (Web Audio API)
 *   - bombdefusal.solvers.ts   — reglas de resolución (solveX) + helpers de azar
 *   - bombdefusal.factories.ts — createXModule() y MODULE_FACTORIES
 *   - bombdefusal.manual.ts    — buildManualHTML()
 */

import type { GameUi } from '../types/game.js';
import GameHelpers from '../utils/gameHelpers.js';
import Leaderboard from '../leaderboardManager.js';
import type {
  BombState, BombModule, WiresModule, ButtonsModule, SymbolsModule,
  MemoryModule, ScreenModule, FrequencyModule, ColorsModule, PatternModule,
  SwitchesModule, CodeModule, KeypadModule, MorseModule, PasswordModule,
  SimonModule, KnobsModule, MazeModule, TimerModule, SequenceModule,
  BinaryModule, MathModule, WordModule, ReactionModule, MatchingModule,
  CipherModule, TimingModule, CoordinatesModule, BatteryModule, PortsModule,
  CompassModule, SlotsModule
} from './bombdefusal.types.js';
import {
  FREQS, SCREEN_OPTS, MODULE_NAMES, COLOR_CSS, SIMON_COLORS,
  KNOB_POSITIONS, MAZE_SIZE, SEQUENCE_NUMBERS, SYMBOL_NAMES
} from './bombdefusal.data.js';
import { initAudio, playSound, setVolume } from './bombdefusal.audio.js';
import { randInt, pick, genSerial, genBatteryLevel, genPortType, genPortCount } from './bombdefusal.solvers.js';
import { MODULE_FACTORIES } from './bombdefusal.factories.js';
import { buildManualHTML } from './bombdefusal.manual.js';

let timerInterval: ReturnType<typeof setInterval> | null = null;
let holdInterval: ReturnType<typeof setInterval> | null = null;
let activeState: BombState | null = null;

interface BombdefusalUi {
  setupPhase: HTMLElement;
  gamePhase: HTMLElement;
  start?: HTMLElement;
  restart?: HTMLElement;
  timeLimit: HTMLInputElement;
  moduleCount: HTMLInputElement;
  maxStrikes: HTMLInputElement;
  difficulty: HTMLInputElement;
  animSpeed: HTMLInputElement;
  allowDup: HTMLInputElement;
  modTypeChips: HTMLElement[];
  roleOperator: HTMLElement;
  roleExpert: HTMLElement;
  operatorPanel: HTMLElement;
  expertPanel: HTMLElement;
  bombGrid: HTMLElement;
  manualContent: HTMLElement;
  manualNav: HTMLElement;
  timerEl: HTMLElement;
  timerBar: HTMLElement;
  strikesEl: HTMLElement;
  modulesEl: HTMLElement;
  serialEl: HTMLElement;
  indicatorEl: HTMLElement;
  batteryLevelEl?: HTMLElement;
  portTypeEl?: HTMLElement;
  portCountEl?: HTMLElement;
  info: HTMLElement;
  result: HTMLElement;
}

export function init(rawUi: GameUi) {
  const ui = rawUi as unknown as BombdefusalUi;
  const {
    setupPhase, gamePhase, start, restart,
    timeLimit, moduleCount, maxStrikes, difficulty, animSpeed, allowDup,
    modTypeChips, roleOperator, roleExpert,
    operatorPanel, expertPanel, bombGrid, manualContent, manualNav,
    timerEl, timerBar, strikesEl, modulesEl, serialEl, indicatorEl,
    batteryLevelEl, portTypeEl, portCountEl,
    info, result
  } = ui;

  if (!start) return;

  manualContent.innerHTML = buildManualHTML();

  manualNav.querySelectorAll<HTMLElement>('.bd-manual-link').forEach(link => {
    link.addEventListener('click', () => {
      const target = manualContent.querySelector(link.dataset.target as string);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const state: BombState = {
    playing: false,
    serial: '',
    timeLeft: 300,
    totalTime: 300,
    strikes: 0,
    maxStrikes: 3,
    indicatorLit: false,
    modules: [],
    animMs: 400,
    role: 'operator',
    buttonLight: false,
    batteryLevel: 0,
    portType: '',
    portCount: 0
  };
  activeState = state;

  function getConfig() {
    const types: string[] = [];
    modTypeChips.forEach(chip => {
      const input = chip.querySelector('input');
      if (input && input.checked) types.push(input.value);
    });
    const volumeInput = document.querySelector<HTMLInputElement>('[data-ui="volume"]');
    if (volumeInput) {
      setVolume(parseInt(volumeInput.value, 10) / 100);
    }
    return {
      totalTime: parseInt(timeLimit.value, 10) || 300,
      moduleCount: parseInt(moduleCount.value, 10) || 4,
      maxStrikes: parseInt(maxStrikes.value, 10),
      difficulty: parseInt(difficulty.value, 10) || 3,
      animMs: parseInt(animSpeed.value, 10) || 400,
      allowDup: allowDup.checked,
      types: types.length ? types : Object.keys(MODULE_FACTORIES)
    };
  }

  function setPhase(phase: string) {
    setupPhase.classList.toggle('bd-phase--active', phase === 'setup');
    gamePhase.classList.toggle('bd-phase--active', phase === 'game');
  }

  function setRole(role: string) {
    state.role = role;
    roleOperator.classList.toggle('bd-role-btn--active', role === 'operator');
    roleOperator.setAttribute('aria-pressed', String(role === 'operator'));
    roleExpert.classList.toggle('bd-role-btn--active', role === 'expert');
    roleExpert.setAttribute('aria-pressed', String(role === 'expert'));
    operatorPanel.classList.toggle('bd-panel--visible', role === 'operator');
    expertPanel.classList.toggle('bd-panel--visible', role === 'expert');
  }

  function updateHud() {
    const mins = Math.floor(state.timeLeft / 60);
    const secs = state.timeLeft % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    const pct = (state.timeLeft / state.totalTime) * 100;
    timerBar.style.width = pct + '%';
    timerBar.style.background = pct > 40 ? 'var(--accent)' : pct > 15 ? '#f97316' : '#ef4444';
    strikesEl.textContent = state.maxStrikes > 0
      ? `${state.strikes} / ${state.maxStrikes}`
      : `${state.strikes} (∞)`;
    modulesEl.textContent = String(state.modules.filter(m => !m.solved).length);
    serialEl.textContent = state.serial;
    indicatorEl.querySelector('.bd-indicator-dot')?.classList.toggle(
      'bd-indicator-dot--lit', state.indicatorLit
    );
    
    // Update device components
    if (batteryLevelEl) batteryLevelEl.textContent = state.batteryLevel > 0 ? `${state.batteryLevel}/4` : '--';
    if (portTypeEl) portTypeEl.textContent = state.portType || '--';
    if (portCountEl) portCountEl.textContent = state.portCount > 0 ? String(state.portCount) : '--';
  }

  function setInfo(msg: string, type?: string) {
    info.textContent = msg;
    info.className = 'bd-info' + (type ? ` bd-info--${type}` : '');
  }

  function generateBomb(cfg: ReturnType<typeof getConfig>) {
    const pool = cfg.types.slice();
    const modules: BombModule[] = [];
    const used = new Set<string>();

    for (let i = 0; i < cfg.moduleCount; i++) {
      let type;
      if (cfg.allowDup) {
        type = pick(pool);
      } else {
        const available = pool.filter(t => !used.has(t));
        type = available.length ? pick(available) : pick(pool);
        used.add(type);
      }
      const factory = MODULE_FACTORIES[type];
      // `state` ya tiene `strikes = 0` en este punto (generateBomb se
      // llama una sola vez, al iniciar la partida, antes de que pueda
      // existir ningún strike). Se lo pasamos a cada factory para que
      // pueda fijar `data.strikesAtStart` en el momento de creación —
      // ver el comentario en cada interfaz *Module afectada.
      if (factory) modules.push(factory(cfg.difficulty, state));
    }
    return modules;
  }

  function onModuleStrike(modEl: HTMLElement | null) {
    playSound('strike');
    if (state.maxStrikes > 0) {
      state.strikes += 1;
      if (modEl) {
        modEl.classList.add('bd-module--strike', 'bd-module--error');
        setTimeout(() => modEl.classList.remove('bd-module--strike', 'bd-module--error'), 500);
      }
      updateHud();
      // .find() puede no encontrar módulo sin resolver (caso borde: el
      // strike que dispara el fin del juego llega justo cuando ya no
      // queda ninguno) — ?.type entonces es undefined, y MODULE_NAMES
      // es Record<string,string> (no acepta indexar con undefined).
      // El '' ya cubría ese caso para el string final; solo se separa
      // el índice para que el tipo sea correcto sin cambiar el output.
      const strikeModType = state.modules.find(m => !m.solved)?.type;
      setInfo(`¡Strike! Error en módulo ${(strikeModType ? MODULE_NAMES[strikeModType] : '') || ''}.`, 'fail');
      if (state.strikes >= state.maxStrikes) endGame(false);
    } else {
      setInfo('Error en módulo — sin límite de strikes activo.', 'fail');
    }
  }

  function onModuleSolved(mod: BombModule, modEl: HTMLElement | null) {
    playSound('success');
    mod.solved = true;
    if (modEl) {
      modEl.classList.add('bd-module--success');
      setTimeout(() => modEl.classList.remove('bd-module--success'), 500);
    }
    updateHud();
    const left = state.modules.filter(m => !m.solved).length;
    setInfo(`Módulo ${MODULE_NAMES[mod.type]} desactivado. Quedan ${left}.`, 'ok');
    if (left === 0) endGame(true);
  }

  function renderModules() {
    bombGrid.innerHTML = '';
    state.modules.forEach((mod) => {
      const el = document.createElement('div');
      el.className = 'bd-module' + (mod.solved ? ' bd-module--solved' : '');
      el.innerHTML = `<div class="bd-module-tag">${MODULE_NAMES[mod.type]}</div><div class="bd-module-body"></div>`;
      const body = el.querySelector<HTMLElement>('.bd-module-body')!;
      if (!mod.solved) renderModuleBody(mod, body, el);
      else body.innerHTML = '<span style="color:#86efac;font-size:0.8rem">✓ DESACTIVADO</span>';
      bombGrid.appendChild(el);
    });
  }

  function renderModuleBody(mod: BombModule, body: HTMLElement, modEl: HTMLElement) {
    if (mod.type === 'wires') renderWires(mod, body, modEl);
    else if (mod.type === 'buttons') renderButtons(mod, body, modEl);
    else if (mod.type === 'symbols') renderSymbols(mod, body, modEl);
    else if (mod.type === 'memory') renderMemory(mod, body, modEl);
    else if (mod.type === 'screen') renderScreen(mod, body, modEl);
    else if (mod.type === 'frequency') renderFrequency(mod, body, modEl);
    else if (mod.type === 'colors') renderColors(mod, body, modEl);
    else if (mod.type === 'pattern') renderPattern(mod, body, modEl);
    else if (mod.type === 'switches') renderSwitches(mod, body, modEl);
    else if (mod.type === 'code') renderCode(mod, body, modEl);
    else if (mod.type === 'keypad') renderKeypad(mod, body, modEl);
    else if (mod.type === 'morse') renderMorse(mod, body, modEl);
    else if (mod.type === 'password') renderPassword(mod, body, modEl);
    else if (mod.type === 'simon') renderSimon(mod, body, modEl);
    else if (mod.type === 'knobs') renderKnobs(mod, body, modEl);
    else if (mod.type === 'maze') renderMaze(mod, body, modEl);
    else if (mod.type === 'timer') renderTimer(mod, body, modEl);
    else if (mod.type === 'sequence') renderSequence(mod, body, modEl);
    else if (mod.type === 'binary') renderBinary(mod, body, modEl);
    else if (mod.type === 'math') renderMath(mod, body, modEl);
    else if (mod.type === 'word') renderWord(mod, body, modEl);
    else if (mod.type === 'reaction') renderReaction(mod, body, modEl);
    else if (mod.type === 'matching') renderMatching(mod, body, modEl);
    else if (mod.type === 'cipher') renderCipher(mod, body, modEl);
    else if (mod.type === 'timing') renderTiming(mod, body, modEl);
    else if (mod.type === 'coordinates') renderCoordinates(mod, body, modEl);
    else if (mod.type === 'battery') renderBattery(mod, body, modEl);
    else if (mod.type === 'ports') renderPorts(mod, body, modEl);
    else if (mod.type === 'compass') renderCompass(mod, body, modEl);
    else if (mod.type === 'slots') renderSlots(mod, body, modEl);
  }

  function renderWires(mod: WiresModule, body: HTMLElement, modEl: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'bd-wires';
    mod.data.wires.forEach((color, i) => {
      const w = document.createElement('div');
      w.className = `bd-wire bd-wire--${color}`;
      if (mod.data.cutIndex === i) w.classList.add('bd-wire--cut');
      w.title = `Cable ${i + 1}`;
      w.setAttribute('role', 'button');
      w.setAttribute('tabindex', '0');
      const cutLabel = mod.data.cutIndex === i ? ', cortado' : '';
      w.setAttribute('aria-label', `Cable ${i + 1}, color ${color}${cutLabel}`);
      const cutWire = () => {
        if (mod.solved || mod.data.cutIndex !== null) return;
        const sol = mod.getSolution(state).wireIndex;
        mod.data.cutIndex = i;
        if (i === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      };
      w.addEventListener('click', cutWire);
      w.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          cutWire();
        }
      });
      wrap.appendChild(w);
    });
    body.appendChild(wrap);
  }

  function renderButtons(mod: ButtonsModule, body: HTMLElement, modEl: HTMLElement) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bd-big-btn bd-big-btn--${mod.data.color}`;
    btn.textContent = mod.data.label.slice(0, 6);
    btn.setAttribute(
      'aria-label',
      `Botón ${mod.data.label}, color ${mod.data.color}. Mantené presionado y soltá según la regla del manual.`
    );

    const label = document.createElement('div');
    label.className = 'bd-btn-label';
    label.textContent = mod.data.label;

    const light = document.createElement('div');
    light.className = 'bd-indicator';
    light.innerHTML = '<span class="bd-indicator-dot"></span> Luz estado';
    // querySelector siempre encuentra el <span> recién creado en la
    // línea de arriba (mismo elemento, sin async entre medio) — el
    // '!' es seguro acá, TS solo no puede saberlo porque no hay forma
    // de expresar "el innerHTML que acabo de asignar" como tipo.
    const lightDot = light.querySelector('.bd-indicator-dot')!;
    light.setAttribute('role', 'status');
    light.setAttribute('aria-live', 'polite');
    light.setAttribute('aria-label', 'Luz de estado: apagada');

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let holdStart = 0;

    function finishButton(success: boolean) {
      if (mod.solved) return;
      mod.data.pressed = true;
      if (success) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    }

    function startHold() {
      if (mod.solved || mod.data.holding) return;
      mod.data.holding = true;
      holdStart = Date.now();
      state.buttonLight = false;
      lightDot.classList.remove('bd-indicator-dot--lit');
      light.setAttribute('aria-label', 'Luz de estado: apagada');

      const sol = mod.getSolution(state);
      if (sol.action === 'hold') {
        holdTimer = setTimeout(() => {
          state.buttonLight = true;
          lightDot.classList.add('bd-indicator-dot--lit');
          light.setAttribute('aria-label', 'Luz de estado: encendida');
        }, state.animMs * 2);
      }
    }

    function endHold() {
      if (mod.solved || !mod.data.holding) return;
      mod.data.holding = false;
      if (holdTimer) clearTimeout(holdTimer);

      const sol = mod.getSolution(state);
      const elapsed = Date.now() - holdStart;
      const secs = state.timeLeft % 60;
      let success: boolean;

      if (sol.action === 'tap') {
        success = elapsed < 250;
      } else if (sol.releaseOnSecondDigit === 1) {
        success = Math.floor(secs / 10) === 1 || secs % 10 === 1;
      } else if (sol.releaseOnLight) {
        success = state.buttonLight;
      } else {
        success = elapsed > 300;
      }

      finishButton(success);
    }

    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', endHold);
    btn.addEventListener('mouseleave', () => {
      if (mod.data.holding) {
        mod.data.holding = false;
        if (holdTimer) clearTimeout(holdTimer);
      }
    });

    // Enter/Espacio no disparan mousedown/mouseup en un <button> — sin
    // esto, la mecánica de "mantener presionado" (idéntica a la de
    // mouse) sería inalcanzable por teclado. keydown con e.repeat evita
    // reiniciar el hold en cada repetición automática del navegador.
    btn.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        startHold();
      }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        endHold();
      }
    });

    body.appendChild(btn);
    body.appendChild(label);
    body.appendChild(light);
  }

  function renderSymbols(mod: SymbolsModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-symbols-grid';
    mod.data.symbols.forEach((sym: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-symbol-btn';
      b.textContent = sym;
      b.setAttribute('aria-label', SYMBOL_NAMES[sym] || sym);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const expected = mod.data.order[mod.data.step];
        if (sym === expected) {
          mod.data.step += 1;
          if (mod.data.step >= mod.data.order.length) onModuleSolved(mod, modEl);
          else setInfo(`Símbolos: ${mod.data.step}/${mod.data.order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  function renderMemory(mod: MemoryModule, body: HTMLElement, modEl: HTMLElement) {
    const disp = document.createElement('div');
    disp.className = 'bd-mem-display';
    disp.textContent = String(mod.data.display);
    disp.setAttribute('role', 'status');
    disp.setAttribute('aria-live', 'polite');
    disp.setAttribute('aria-label', `Pantalla: número ${mod.data.display}`);

    const btns = document.createElement('div');
    btns.className = 'bd-mem-btns';
    mod.data.labels.forEach((lab, pos) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-mem-btn';
      b.textContent = String(lab);
      b.setAttribute('aria-label', `Posición ${pos + 1}, etiqueta ${lab}`);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution(state).position;
        if (pos === sol) {
          mod.data.history.push({ position: pos, label: lab });
          if (mod.data.stage >= 5) {
            onModuleSolved(mod, modEl);
          } else {
            mod.data.stage += 1;
            mod.data.display = randInt(1, 4);
            setInfo(`Memoria: etapa ${mod.data.stage}/5`, 'ok');
          }
        } else {
          mod.data.stage = 1;
          mod.data.display = randInt(1, 4);
          mod.data.history = [];
          onModuleStrike(modEl);
        }
        renderModules();
      });
      btns.appendChild(b);
    });

    body.appendChild(disp);
    body.appendChild(btns);
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Etapa ${mod.data.stage}/5`;
    body.appendChild(hint);
  }

  function renderScreen(mod: ScreenModule, body: HTMLElement, modEl: HTMLElement) {
    const disp = document.createElement('div');
    disp.className = 'bd-screen-display';
    disp.textContent = mod.data.msg;
    disp.setAttribute('role', 'status');
    disp.setAttribute('aria-live', 'polite');

    const opts = document.createElement('div');
    opts.className = 'bd-screen-options';
    SCREEN_OPTS.forEach(opt => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-screen-opt';
      b.textContent = opt;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution(state).answer;
        if (opt === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      opts.appendChild(b);
    });

    body.appendChild(disp);
    body.appendChild(opts);
  }

  function renderFrequency(mod: FrequencyModule, body: HTMLElement, modEl: HTMLElement) {
    const labels = document.createElement('div');
    labels.className = 'bd-freq-labels';
    labels.textContent = `${mod.data.labelA} · ${mod.data.labelB}`;

    const dial = document.createElement('div');
    dial.className = 'bd-freq-dial';
    FREQS.forEach(freq => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-freq-opt';
      b.textContent = freq;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution().freq;
        if (freq === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      dial.appendChild(b);
    });

    body.appendChild(labels);
    body.appendChild(dial);
  }

  function renderColors(mod: ColorsModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-colors-grid';
    mod.data.colors.forEach(color => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-color-btn';
      b.style.background = COLOR_CSS[color as keyof typeof COLOR_CSS];
      b.setAttribute('aria-label', `Color ${color}`);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const expected = mod.getSolution(state).order[mod.data.step];
        if (color === expected) {
          mod.data.step += 1;
          if (mod.data.step >= mod.getSolution(state).order.length) onModuleSolved(mod, modEl);
          else setInfo(`Colores: ${mod.data.step}/${mod.getSolution(state).order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Secuencia ${mod.data.step}/${mod.getSolution(state).order.length}`;
    body.appendChild(grid);
    body.appendChild(hint);
  }

  function renderPattern(mod: PatternModule, body: HTMLElement, modEl: HTMLElement) {
    const { size, litCount, decoy, selected } = mod.data;
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `${litCount} celdas iluminadas (señuelo)`;

    const grid = document.createElement('div');
    grid.className = 'bd-pattern-grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    for (let i = 0; i < size * size; i++) {
      const row = Math.floor(i / size) + 1;
      const col = (i % size) + 1;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bd-pattern-cell';
      if (decoy.includes(i)) cell.classList.add('bd-pattern-cell--decoy');
      if (selected.has(i)) cell.classList.add('bd-pattern-cell--sel');
      cell.setAttribute('aria-pressed', String(selected.has(i)));
      const decoyLabel = decoy.includes(i) ? ', señuelo' : '';
      cell.setAttribute('aria-label', `Celda fila ${row}, columna ${col}${decoyLabel}`);
      cell.addEventListener('click', () => {
        if (mod.solved) return;
        if (selected.has(i)) selected.delete(i);
        else selected.add(i);
        renderModules();
      });
      grid.appendChild(cell);
    }

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Confirmar';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = new Set(mod.getSolution(state).cells);
      const sel = selected;
      const match = sol.size === sel.size && [...sol].every(c => sel.has(c));
      if (match) onModuleSolved(mod, modEl);
      else {
        selected.clear();
        onModuleStrike(modEl);
      }
      renderModules();
    });

    body.appendChild(hint);
    body.appendChild(grid);
    body.appendChild(confirm);
  }

  function renderSwitches(mod: SwitchesModule, body: HTMLElement, modEl: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'bd-switches-wrap';
    mod.data.states.forEach((on, i) => {
      const row = document.createElement('div');
      row.className = 'bd-switch-row';
      const lbl = document.createElement('span');
      lbl.textContent = `SW${i + 1}`;
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'bd-switch' + (on ? ' bd-switch--on' : '');
      sw.textContent = on ? 'ON' : 'OFF';
      sw.setAttribute('aria-pressed', String(on));
      sw.setAttribute('aria-label', `Interruptor ${i + 1}`);
      sw.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.states[i] = !mod.data.states[i];
        renderModules();
      });
      row.appendChild(lbl);
      row.appendChild(sw);
      wrap.appendChild(row);
    });

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Confirmar';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).states;
      const match = sol.every((v, i) => v === mod.data.states[i]);
      if (match) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    });

    body.appendChild(wrap);
    body.appendChild(confirm);
  }

  function renderCode(mod: CodeModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(4, '_').split('').join(' ');
    display.setAttribute('role', 'status');
    display.setAttribute('aria-live', 'polite');
    display.setAttribute(
      'aria-label',
      mod.data.input ? `Código ingresado: ${mod.data.input.split('').join(' ')}` : 'Código vacío'
    );

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(d);
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= 4) return;
        mod.data.input += d;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).code;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderKeypad(mod: KeypadModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-keypad-grid';
    mod.data.symbols.forEach((sym: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-symbol-btn';
      b.textContent = sym;
      b.setAttribute('aria-label', SYMBOL_NAMES[sym] || sym);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const order = mod.getSolution(state).order;
        const expected = order[mod.data.step];
        if (sym === expected) {
          mod.data.step += 1;
          if (mod.data.step >= order.length) onModuleSolved(mod, modEl);
          else setInfo(`Teclado: ${mod.data.step}/${order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Teclas ${mod.data.step}/${mod.getSolution(state).order.length}`;
    body.appendChild(grid);
    body.appendChild(hint);
  }

  function renderMorse(mod: MorseModule, body: HTMLElement, modEl: HTMLElement) {
    const disp = document.createElement('div');
    disp.className = 'bd-morse-display';
    disp.textContent = mod.data.code;

    const opts = document.createElement('div');
    opts.className = 'bd-morse-opts';
    mod.data.options.forEach(letter => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-screen-opt';
      b.textContent = letter;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const sol = mod.getSolution().letter;
        if (letter === sol) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      opts.appendChild(b);
    });

    body.appendChild(disp);
    body.appendChild(opts);
  }

  function renderPassword(mod: PasswordModule, body: HTMLElement, modEl: HTMLElement) {
    const clues = document.createElement('div');
    clues.className = 'bd-password-clues';
    clues.textContent = 'Posibles: ' + mod.data.clues.join(', ');

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(6, '_').split('').join(' ');

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(4, 1fr)';
    mod.data.clues.forEach(word => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key bd-code-key--wide';
      b.textContent = word;
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length > 0) return;
        mod.data.input = word;
        renderModules();
      });
      pad.appendChild(b);
    });

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = '';
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).password;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(clues);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderSimon(mod: SimonModule, body: HTMLElement, modEl: HTMLElement) {
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Secuencia: ${mod.data.step + 1}/${mod.data.sequenceLength}`;

    const grid = document.createElement('div');
    grid.className = 'bd-simon-grid';
    SIMON_COLORS.forEach((color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `bd-simon-btn bd-simon-btn--${color}`;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const order = mod.getSolution(state).colors;
        const expected = order[mod.data.step];
        if (color === expected) {
          mod.data.step += 1;
          if (mod.data.step >= mod.data.sequenceLength) onModuleSolved(mod, modEl);
          else setInfo(`Simon: ${mod.data.step + 1}/${mod.data.sequenceLength}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });

    body.appendChild(hint);
    body.appendChild(grid);
  }

  // BUG DE JUEGO (no código muerto, mismo espíritu que la nota en
  // solvePassword): `getSolution(state).positions` (ver solveKnobs)
  // devuelve un array de LABELS de KNOB_POSITIONS (p.ej. ['IZQ', 'DER']),
  // pero el chequeo de "confirmar" más abajo hace
  // `KNOB_POSITIONS[pos] === KNOB_POSITIONS[current[i]]` tratando cada
  // `pos` como si fuera un ÍNDICE numérico. `KNOB_POSITIONS['IZQ']` es
  // `undefined` (acceso de string como key en un array), así que la
  // comparación solo puede dar `true` si ambos lados son `undefined` —
  // el módulo de knobs no tiene forma correcta de resolverse tal como
  // está. Encontrado al tipar BombModule como discriminated union: con
  // `data: Record<string, any>` esto compilaba sin avisar nada. No lo
  // arreglo acá, igual que solvePassword: es un bug de lógica de juego,
  // fuera del alcance de esta migración de tipos.
  function renderKnobs(mod: KnobsModule, body: HTMLElement, modEl: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'bd-knobs-wrap';
    mod.data.positions.forEach((pos, i) => {
      const row = document.createElement('div');
      row.className = 'bd-knob-row';
      const lbl = document.createElement('span');
      lbl.className = 'bd-btn-label';
      lbl.textContent = `K${i + 1}`;
      const controls = document.createElement('div');
      controls.className = 'bd-knob-controls';
      
      KNOB_POSITIONS.forEach((position, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bd-knob-btn' + (pos === idx ? ' bd-knob-btn--active' : '');
        b.textContent = position[0];
        b.addEventListener('click', () => {
          if (mod.solved) return;
          mod.data.positions[i] = idx;
          renderModules();
        });
        controls.appendChild(b);
      });
      
      row.appendChild(lbl);
      row.appendChild(controls);
      wrap.appendChild(row);
    });

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Confirmar';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).positions;
      const current = mod.data.positions;
      const knobPositionsByKey = KNOB_POSITIONS as unknown as Record<string, string>;
      const match = sol.every((pos, i) => knobPositionsByKey[pos] === knobPositionsByKey[current[i]]);
      if (match) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    });

    body.appendChild(wrap);
    body.appendChild(confirm);
  }

  function renderMaze(mod: MazeModule, body: HTMLElement, modEl: HTMLElement) {
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Pos: (${mod.data.playerRow},${mod.data.playerCol})`;

    const grid = document.createElement('div');
    grid.className = 'bd-maze-grid';
    grid.style.gridTemplateColumns = `repeat(${MAZE_SIZE}, 1fr)`;

    for (let r = 0; r < MAZE_SIZE; r++) {
      for (let c = 0; c < MAZE_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'bd-maze-cell';
        if (r === mod.data.playerRow && c === mod.data.playerCol) {
          cell.classList.add('bd-maze-cell--player');
          cell.textContent = '●';
        }
        grid.appendChild(cell);
      }
    }

    const controls = document.createElement('div');
    controls.className = 'bd-maze-controls';
    const directions = [
      { label: '↑', dr: -1, dc: 0 },
      { label: '↓', dr: 1, dc: 0 },
      { label: '←', dr: 0, dc: -1 },
      { label: '→', dr: 0, dc: 1 }
    ];
    directions.forEach(dir => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-maze-btn';
      b.textContent = dir.label;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const newRow = mod.data.playerRow + dir.dr;
        const newCol = mod.data.playerCol + dir.dc;
        if (newRow >= 0 && newRow < MAZE_SIZE && newCol >= 0 && newCol < MAZE_SIZE) {
          mod.data.playerRow = newRow;
          mod.data.playerCol = newCol;
          const sol = mod.getSolution(state);
          if (newRow === sol.row && newCol === sol.col) {
            onModuleSolved(mod, modEl);
          }
          renderModules();
        }
      });
      controls.appendChild(b);
    });

    body.appendChild(hint);
    body.appendChild(grid);
    body.appendChild(controls);
  }

  function renderTimer(mod: TimerModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-timer-display';
    display.textContent = mod.data.stopped ? `: ${mod.data.stopSecond}s` : ': --';

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'bd-pattern-confirm';
    stopBtn.textContent = 'STOP';
    stopBtn.addEventListener('click', () => {
      if (mod.solved || mod.data.stopped) return;
      const secs = state.timeLeft % 60;
      mod.data.stopped = true;
      mod.data.stopSecond = secs;
      const sol = mod.getSolution(state).targetSecond;
      if (secs === sol) onModuleSolved(mod, modEl);
      else onModuleStrike(modEl);
      renderModules();
    });

    body.appendChild(display);
    body.appendChild(stopBtn);
  }

  function renderSequence(mod: SequenceModule, body: HTMLElement, modEl: HTMLElement) {
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Paso ${mod.data.step + 1}/5`;

    const grid = document.createElement('div');
    grid.className = 'bd-sequence-grid';
    SEQUENCE_NUMBERS.forEach(num => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-sequence-btn';
      b.textContent = num;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        const order = mod.getSolution(state).order;
        const expected = order[mod.data.step];
        if (num === expected) {
          mod.data.step += 1;
          if (mod.data.step >= order.length) onModuleSolved(mod, modEl);
          else setInfo(`Secuencia: ${mod.data.step + 1}/${order.length}`, 'ok');
        } else {
          mod.data.step = 0;
          onModuleStrike(modEl);
        }
        renderModules();
      });
      grid.appendChild(b);
    });

    body.appendChild(hint);
    body.appendChild(grid);
  }

  function renderBinary(mod: BinaryModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(5, '_').split('').join(' ');

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let i = 0; i < 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = i === 0 ? '0' : '1';
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= 5) return;
        mod.data.input += b.textContent;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      const sol = mod.getSolution(state).binary;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderMath(mod: MathModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state);
    const equation = document.createElement('div');
    equation.className = 'bd-math-equation';
    equation.textContent = `${sol.a} ${sol.op} ${sol.b} = ?`;

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.answer || '_';

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(d);
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.answer.length >= 3) return;
        mod.data.answer += d;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.answer = mod.data.answer.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (parseInt(mod.data.answer, 10) === sol.result) onModuleSolved(mod, modEl);
      else {
        mod.data.answer = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(equation);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderWord(mod: WordModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-word-display';
    display.textContent = mod.data.input.padEnd(6, '_').split('').join(' ');

    const letters = document.createElement('div');
    letters.className = 'bd-word-letters';
    const sol = mod.getSolution(state).word as string;
    const available = GameHelpers.shuffle(sol.split(''));
    available.forEach(letter => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-word-btn';
      b.textContent = letter;
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= sol.length) return;
        mod.data.input += letter;
        renderModules();
      });
      letters.appendChild(b);
    });

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (mod.data.input === sol) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(display);
    body.appendChild(letters);
    body.appendChild(actions);
  }

  function renderReaction(mod: ReactionModule, body: HTMLElement, modEl: HTMLElement) {
    const indicator = document.createElement('div');
    indicator.className = 'bd-reaction-indicator' + (mod.data.lit ? ' bd-reaction-indicator--lit' : '');
    indicator.textContent = mod.data.lit ? '¡PULSA!' : 'ESPERA...';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bd-pattern-confirm';
    btn.textContent = 'PULSAR';
    btn.addEventListener('click', () => {
      if (mod.solved || mod.data.pressed) return;
      mod.data.pressed = true;
      if (mod.data.lit) {
        // lit y litTime siempre se asignan juntos (ver el único punto
        // donde se ponen: mod.data.lit = true seguido de litTime =
        // Date.now(), más abajo en este mismo archivo) — dentro de
        // este if, litTime nunca es null en runtime, aunque el tipo
        // number|null no lo exprese.
        const elapsed = Date.now() - mod.data.litTime!;
        const sol = mod.getSolution(state).targetMs;
        if (Math.abs(elapsed - sol) <= 200) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
      } else {
        onModuleStrike(modEl);
      }
      renderModules();
    });

    if (!mod.data.lit && !mod.data.pressed) {
      const delay = randInt(2000, 5000);
      setTimeout(() => {
        // Guard ampliado: el guard original solo miraba el estado de
        // ESTE módulo (mod.solved / mod.data.pressed), no si el juego
        // en sí seguía activo. Si el usuario salía de la partida
        // (stop()) mientras este timeout de 2-5s estaba pendiente y
        // el módulo no había sido tocado, igual disparaba y
        // reconstruía todo el tablero (renderModules) en una vista
        // ya cerrada.
        if (!state.playing) return;
        if (!mod.solved && !mod.data.pressed) {
          mod.data.lit = true;
          mod.data.litTime = Date.now();
          renderModules();
        }
      }, delay);
    }

    body.appendChild(indicator);
    body.appendChild(btn);
  }

  function renderMatching(mod: MatchingModule, body: HTMLElement, modEl: HTMLElement) {
    const grid = document.createElement('div');
    grid.className = 'bd-matching-grid';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';

    // Usa el tablero ya fijado en data.board (generado una sola vez en
    // createMatchingModule), no un tablero recalculado en cada render
    // — ver el comentario en la interfaz MatchingModule.
    const shuffled = mod.data.board;
    
    shuffled.forEach((sym, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-matching-card' + (mod.data.matched.includes(idx) ? ' bd-matching-card--matched' : '');
      b.textContent = mod.data.matched.includes(idx) || mod.data.selected.includes(idx) ? sym : '?';
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.matched.includes(idx)) return;
        
        if (mod.data.selected.length === 2) {
          mod.data.selected = [];
        }
        
        if (mod.data.selected.includes(idx)) {
          mod.data.selected = mod.data.selected.filter(i => i !== idx);
        } else {
          mod.data.selected.push(idx);
        }
        
        if (mod.data.selected.length === 2) {
          const [i1, i2] = mod.data.selected;
          if (shuffled[i1] === shuffled[i2]) {
            mod.data.matched.push(i1, i2);
            mod.data.selected = [];
            if (mod.data.matched.length === 8) onModuleSolved(mod, modEl);
          }
        }
        renderModules();
      });
      grid.appendChild(b);
    });

    body.appendChild(grid);
  }

  function renderCipher(mod: CipherModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state);
    const cipher = document.createElement('div');
    cipher.className = 'bd-cipher-text';
    cipher.textContent = `Cifrado: ${sol.encoded}`;
    
    const shiftInfo = document.createElement('div');
    shiftInfo.className = 'bd-btn-label';
    shiftInfo.textContent = `Desplazamiento: ${sol.shift}`;

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = mod.data.input.padEnd(6, '_').split('').join(' ');

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(6, 1fr)';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = letter;
      b.addEventListener('click', () => {
        if (mod.solved || mod.data.input.length >= 6) return;
        mod.data.input += letter;
        renderModules();
      });
      pad.appendChild(b);
    });

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.input = mod.data.input.slice(0, -1);
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (mod.data.input === sol.original) onModuleSolved(mod, modEl);
      else {
        mod.data.input = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(cipher);
    body.appendChild(shiftInfo);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderTiming(mod: TimingModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state).offset;
    const clock1 = document.createElement('div');
    clock1.className = 'bd-timing-clock';
    clock1.textContent = `Reloj 1: ${state.timeLeft % 60}s`;

    const clock2 = document.createElement('div');
    clock2.className = 'bd-timing-clock';
    clock2.textContent = `Reloj 2: ${((state.timeLeft % 60) + sol) % 60}s`;

    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = `Offset: +${sol}s`;

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'bd-pattern-confirm';
    confirm.textContent = 'Sincronizado';
    confirm.addEventListener('click', () => {
      if (mod.solved) return;
      onModuleSolved(mod, modEl);
      renderModules();
    });

    body.appendChild(clock1);
    body.appendChild(clock2);
    body.appendChild(hint);
    body.appendChild(confirm);
  }

  function renderCoordinates(mod: CoordinatesModule, body: HTMLElement, modEl: HTMLElement) {
    const sol = mod.getSolution(state);
    const hint = document.createElement('div');
    hint.className = 'bd-btn-label';
    hint.textContent = 'Introduce X, Y';

    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = `X:${mod.data.x || '_'} Y:${mod.data.y || '_'}`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(d);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        if (mod.data.x.length < 1) mod.data.x += d;
        else if (mod.data.y.length < 1) mod.data.y += d;
        renderModules();
      });
      pad.appendChild(b);
    }

    const actions = document.createElement('div');
    actions.className = 'bd-code-actions';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'bd-code-key bd-code-key--wide';
    clr.textContent = '⌫';
    clr.setAttribute('aria-label', 'Borrar último dígito');
    clr.addEventListener('click', () => {
      if (mod.solved) return;
      mod.data.x = '';
      mod.data.y = '';
      renderModules();
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'bd-code-key bd-code-key--wide bd-code-key--ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
      if (mod.solved) return;
      if (parseInt(mod.data.x, 10) === sol.x && parseInt(mod.data.y, 10) === sol.y) onModuleSolved(mod, modEl);
      else {
        mod.data.x = '';
        mod.data.y = '';
        onModuleStrike(modEl);
      }
      renderModules();
    });
    actions.appendChild(clr);
    actions.appendChild(ok);

    body.appendChild(hint);
    body.appendChild(display);
    body.appendChild(pad);
    body.appendChild(actions);
  }

  function renderBattery(mod: BatteryModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.style.fontSize = '1rem';
    display.textContent = `Nivel actual: ${state.batteryLevel}/4`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(4, 1fr)';
    for (let i = 1; i <= 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(i);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedLevel = i;
        const sol = mod.getSolution(state);
        if (i === sol.targetLevel) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    }

    body.appendChild(display);
    body.appendChild(pad);
  }

  function renderPorts(mod: PortsModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-password-clues';
    display.textContent = `Puerto: ${state.portType} (Conteo: ${state.portCount})`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(3, 1fr)';
    const portTypes = ['DVI', 'Parallel', 'PS/2', 'RJ-45', 'Stereo RCA', 'USB'];
    portTypes.forEach(port => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key bd-code-key--wide';
      b.textContent = port;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedPort = port;
        const sol = mod.getSolution(state);
        if (port === sol.targetPort) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    });

    body.appendChild(display);
    body.appendChild(pad);
  }

  function renderCompass(mod: CompassModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = `Dirección: ${mod.data.currentDirection}`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(4, 1fr)';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    directions.forEach(dir => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = dir;
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedDirection = dir;
        const sol = mod.getSolution(state);
        if (dir === sol.targetDirection) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    });

    body.appendChild(display);
    body.appendChild(pad);
  }

  function renderSlots(mod: SlotsModule, body: HTMLElement, modEl: HTMLElement) {
    const display = document.createElement('div');
    display.className = 'bd-code-display';
    display.textContent = `Batería: ${state.batteryLevel} | Puertos: ${state.portCount}`;

    const pad = document.createElement('div');
    pad.className = 'bd-code-pad';
    pad.style.gridTemplateColumns = 'repeat(5, 1fr)';
    for (let i = 0; i <= 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-code-key';
      b.textContent = String(i);
      b.addEventListener('click', () => {
        if (mod.solved) return;
        mod.data.selectedSlot = i;
        const sol = mod.getSolution(state);
        if (i === sol.targetSlot) onModuleSolved(mod, modEl);
        else onModuleStrike(modEl);
        renderModules();
      });
      pad.appendChild(b);
    }

    body.appendChild(display);
    body.appendChild(pad);
  }

  function tick() {
    if (!state.playing) return;
    state.timeLeft -= 1;
    if (state.timeLeft % 7 === 0) state.indicatorLit = !state.indicatorLit;
    updateHud();
    if (state.timeLeft <= 0) endGame(false);
  }

  function startGame() {
    if (timerInterval) clearInterval(timerInterval);
    initAudio();
    const cfg = getConfig();
    state.playing = true;
    state.serial = genSerial();
    state.totalTime = cfg.totalTime;
    state.timeLeft = cfg.totalTime;
    state.strikes = 0;
    state.maxStrikes = cfg.maxStrikes;
    state.animMs = cfg.animMs;
    state.indicatorLit = Math.random() > 0.5;
    state.batteryLevel = genBatteryLevel();
    state.portType = genPortType();
    state.portCount = genPortCount();
    state.modules = generateBomb(cfg);
    state.role = 'operator';

    result.textContent = '';
    setPhase('game');
    setRole('operator');
    updateHud();
    renderModules();
setInfo('💣 Operador: desactiva módulos. Experto: consulta el manual. Alterna roles con los botones superiores.', 'info');

    timerInterval = setInterval(tick, 1000);
  }

  function endGame(won: boolean) {
    state.playing = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    const defused = state.modules.filter(m => m.solved).length;
    const score = defused * 1000 + (won ? state.timeLeft : 0);

    if (won) {
      playSound('win');
      result.textContent = `¡Bomba desactivada! Tiempo restante: ${timerEl.textContent} · Puntuación: ${score}`;
      result.style.color = '#86efac';
      setInfo('Todos los módulos desactivados. ¡Victoria!', 'ok');
    } else {
      playSound('lose');
      const reason = state.timeLeft <= 0 ? 'Tiempo agotado' : 'Demasiados strikes';
      result.textContent = `${reason}. Módulos desactivados: ${defused}/${state.modules.length} · Puntuación: ${score}`;
      result.style.color = '#fca5a5';
      setInfo(reason + '.', 'fail');
    }

    Leaderboard.save('bombdefusal', score);

    renderModules();
  }

  function stopGame() {
    state.playing = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    setPhase('setup');
    setInfo('', 'info');
  }

  roleOperator.addEventListener('click', () => setRole('operator'));
  roleExpert.addEventListener('click', () => setRole('expert'));
  start.addEventListener('click', startGame);
  if (restart) restart.addEventListener('click', stopGame);
}

export function stop() {
  if (activeState) activeState.playing = false;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
}

