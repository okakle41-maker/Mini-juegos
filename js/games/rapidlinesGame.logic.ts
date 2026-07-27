/**
 * js/games/rapidlinesGame.logic.ts
 *
 * Lógica pesada de "Rapid Lines" (clases RapidArrow/RapidLines +
 * init/stop), extraída de rapidlines.ts para lazy loading — ver
 * `logic` en rapidlines.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: RapidLinesThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts).
 */

import safeStorage from '../core/safeStorage.js';
import audioManager from '../audioManager.js';

class RapidArrow {
  game: RapidLines;
  direction: string;
  speed: number;
  length: number;
  element: HTMLDivElement;
  key?: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rotation: number;

  constructor(game: RapidLines, direction: string) {
    this.game      = game;
    this.direction = direction;
    this.speed     = game.config.currentSpeed;
    this.length    = 220;
    this.element   = document.createElement('div');
    this.element.className = 'rapid-arrow';
    game.arena.appendChild(this.element);

    switch (direction) {
      case 'left':
        this.key = 'KeyA'; this.x = -220; this.y = game.arena.clientHeight/2; this.dx=1; this.dy=0; this.rotation=0; break;
      case 'right':
        this.key = 'KeyD'; this.x = game.arena.clientWidth+220; this.y = game.arena.clientHeight/2; this.dx=-1; this.dy=0; this.rotation=180; break;
      case 'top':
        this.key = 'KeyW'; this.x = game.arena.clientWidth/2; this.y = -220; this.dx=0; this.dy=1; this.rotation=90; break;
      case 'bottom':
        this.key = 'KeyS'; this.x = game.arena.clientWidth/2; this.y = game.arena.clientHeight+220; this.dx=0; this.dy=-1; this.rotation=-90; break;
    }
  }

  getTipPosition(): { x: number; y: number } {
    let tipX = this.x, tipY = this.y;
    const offset = this.length / 2;
    switch (this.direction) {
      case 'left':   tipX += offset; break;
      case 'right':  tipX -= offset; break;
      case 'top':    tipY += offset; break;
      case 'bottom': tipY -= offset; break;
    }
    return { x: tipX, y: tipY };
  }

  remove() { this.element.remove(); }
}

class RapidLines {
  arena: HTMLElement;
  center: HTMLElement | null;
  effects: HTMLElement;
  startBtn: HTMLElement;
  result: HTMLElement;
  scoreEl: HTMLElement;
  comboEl: HTMLElement;
  bestEl: HTMLElement;
  timeEl: HTMLElement;
  running: boolean;
  arrows: RapidArrow[];
  score: number;
  combo: number;
  best: number;
  timer: ReturnType<typeof setInterval> | null;
  time: number;
  boundKeyDown!: (e: KeyboardEvent) => void;
  config: {
    startSpeed: number;
    currentSpeed: number;
    speedIncrease: number;
    maxSpeed: number;
    arrows: number;
    perfectRadius: number;
    goodRadius: number;
    duration: number;
  };

  constructor(arena: HTMLElement, center: HTMLElement | null, effects: HTMLElement, startBtn: HTMLElement, result: HTMLElement, scoreEl: HTMLElement, comboEl: HTMLElement, bestEl: HTMLElement, timeEl: HTMLElement) {
    this.arena    = arena;
    this.center   = center;
    this.effects  = effects;
    this.startBtn = startBtn;
    this.result   = result;
    this.scoreEl  = scoreEl;
    this.comboEl  = comboEl;
    this.bestEl   = bestEl;
    this.timeEl   = timeEl;

    this.running = false;
    this.arrows  = [];
    this.score   = 0;
    this.combo   = 0;
    this.best    = safeStorage.getNumber('rapidBest', 0);
    this.bestEl.textContent = String(this.best);
    this.timer   = null;
    this.time    = 60;
    this.config  = {
      startSpeed: 6, currentSpeed: 6, speedIncrease: 0.15,
      maxSpeed: 14, arrows: 1, perfectRadius: 18, goodRadius: 45, duration: 60
    };
    this.bindEvents();
  }

  bindEvents() {
    this.startBtn.addEventListener('click', () => this.start());
    this.boundKeyDown = e => this.keyDown(e);
    document.addEventListener('keydown', this.boundKeyDown);
  }

  start() {
    audioManager.play('perfect');
    if (this.running) return;
    this.running = true;
    this.score = 0; this.combo = 0;
    this.scoreEl.textContent = '0'; this.comboEl.textContent = '0'; this.result.textContent = '';
    this.config.currentSpeed = this.config.startSpeed;
    this.time = this.config.duration;
    this.timeEl.textContent = String(this.time);
    this.clearArena();
    this.fillArena();
    this.startTimer();
    requestAnimationFrame(() => this.update());
  }

  stop() {
    this.running = false;
    clearInterval(this.timer); this.timer = null;
    this.clearArena();
    document.removeEventListener('keydown', this.boundKeyDown);
  }

  startTimer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.time--;
      this.timeEl.textContent = String(this.time);
      if (this.time <= 0) this.gameOver('Tiempo agotado');
    }, 1000);
  }

  gameOver(text: string) {
    this.running = false;
    clearInterval(this.timer);
    if (text !== 'MISS') audioManager.play('gameover');
    this.result.innerHTML = `<span style="color:#ff5555">${text}</span>`;
    this.clearArena();
  }

  clearArena() {
    this.arrows.forEach(a => a.element.remove());
    this.arrows = [];
  }

  fillArena() {
    const dirs = ['left','right','top','bottom'];
    while (this.arrows.length < this.config.arrows) {
      this.spawnArrow(dirs[Math.floor(Math.random() * dirs.length)]);
    }
  }

  spawnArrow(direction: string) {
    this.arrows.push(new RapidArrow(this, direction));
  }

  update() {
    if (!this.running) return;
    const centerX = this.arena.clientWidth  / 2;
    const centerY = this.arena.clientHeight / 2;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.x += a.dx * a.speed; a.y += a.dy * a.speed;
      a.element.style.left = a.x + 'px'; a.element.style.top = a.y + 'px';
      let rotation = 0;
      switch (a.direction) {
        case 'left': rotation=0; break; case 'right': rotation=180; break;
        case 'top':  rotation=90; break; case 'bottom': rotation=-90; break;
      }
      a.element.style.transform = `translate(-50%,-50%) rotate(${rotation}deg)`;
      const tip = a.getTipPosition();
      const dist = Math.hypot(tip.x - centerX, tip.y - centerY);
      if (dist < 12) { this.gameOver('MISS'); return; }
    }
    requestAnimationFrame(() => this.update());
  }

  keyDown(e: KeyboardEvent) {
    if (!this.running || this.arrows.length === 0) return;
    if (!['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) return;
    const arrow = this.arrows[0];
    if (e.code !== arrow.key) {
      this.combo = 0; this.comboEl.textContent = '0';
      this.gameOver('Tecla incorrecta'); return;
    }
    const centerX = this.arena.clientWidth  / 2;
    const centerY = this.arena.clientHeight / 2;
    const tip  = arrow.getTipPosition();
    const dist = Math.hypot(tip.x - centerX, tip.y - centerY);

    if (dist > this.config.goodRadius) {
      this.combo = 0; this.comboEl.textContent = '0';
      this.gameOver('MISS'); audioManager.play('miss'); return;
    }

    let text: string, gained: number;
    if (dist <= this.config.perfectRadius) {
      text = 'PERFECT'; gained = 150; audioManager.play('perfect');
    } else {
      text = 'GOOD';    gained = 90;  audioManager.play('good');
    }
    gained += this.combo * 10 + this.config.currentSpeed * 15;
    this.combo++;
    this.score += Math.round(gained);
    this.scoreEl.textContent = String(this.score);
    this.comboEl.textContent = String(this.combo);

    if (this.score > this.best) {
      this.best = this.score;
      this.bestEl.textContent = String(this.best);
      safeStorage.setNumber('rapidBest', this.best);
    }

    this.result.innerHTML = `<span style="color:#44ff88">${text}<br>+${Math.round(gained)}</span>`;
    this.showHitText(tip.x, tip.y, text, text === 'PERFECT' ? '#00ff88' : '#ffd54a');
    this.spawnParticles(tip.x, tip.y, text === 'PERFECT' ? '#00ff88' : '#ffd54a');

    arrow.element.remove();
    this.arrows.shift();
    this.config.currentSpeed = Math.min(this.config.maxSpeed, this.config.currentSpeed + this.config.speedIncrease);
    this.fillArena();
  }

  showHitText(x: number, y: number, text: string, color: string) {
    const hit = document.createElement('div');
    hit.className = 'rapid-hit-text';
    hit.textContent = text;
    hit.style.left = x + 'px'; hit.style.top = y + 'px'; hit.style.color = color;
    this.arena.appendChild(hit);
    requestAnimationFrame(() => {
      hit.style.transform = 'translate(-50%,-90px) scale(1.3)';
      hit.style.opacity = '0';
    });
    setTimeout(() => hit.remove(), 700);
  }

  spawnParticles(x: number, y: number, color: string) {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'rapid-particle';
      p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.background = color;
      this.effects.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 70;
      p.animate([
        { transform: 'translate(-50%,-50%)', opacity: 1 },
        { transform: `translate(${Math.cos(angle)*speed}px,${Math.sin(angle)*speed}px)`, opacity: 0 }
      ], { duration: 500, easing: 'ease-out' });
      setTimeout(() => p.remove(), 500);
    }
  }
}


let activeGame: RapidLines | null = null;

export function init() {
  const arena   = document.getElementById('rapidArena') as HTMLElement | null;
  if (!arena) return;

  const center  = document.getElementById('rapidCenter') as HTMLElement | null;
  const effects = document.getElementById('rapidEffects') as HTMLElement | null;
  const startBtn = document.getElementById('startRapid') as HTMLElement | null;
  const result  = document.getElementById('rapidResult') as HTMLElement | null;
  const scoreEl = document.getElementById('rapidScore') as HTMLElement | null;
  const comboEl = document.getElementById('rapidCombo') as HTMLElement | null;
  const bestEl  = document.getElementById('rapidBest') as HTMLElement | null;
  const timeEl  = document.getElementById('rapidTime') as HTMLElement | null;

  if (!effects || !startBtn || !result || !scoreEl || !comboEl || !bestEl || !timeEl) return;

  activeGame = new RapidLines(arena, center, effects, startBtn, result, scoreEl, comboEl, bestEl, timeEl);
}

export function stop() {
  if (activeGame) activeGame.stop();
}
