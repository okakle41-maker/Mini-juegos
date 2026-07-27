import audioManager from '../audioManager.js';
/**
 * js/games/progresstiming.logic.ts
 *
 * Lógica pesada de "Progress Timing" (init/stop), extraída de
 * progresstiming.ts para lazy loading — ver `logic` en
 * progresstiming.ts y el comentario de GameConfig.logic en
 * core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: StoppableThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts).
 */

interface PTSettings {
  speed: number;
  zoneSize: number;
  movingZone: boolean;
  incremental: boolean;
  incSpeed: boolean;
  incSize: boolean;
  incMove: boolean;
  perfect: boolean;
  [key: string]: number | boolean;
}

let cleanup: (() => void) | null = null;

export function init() {
    const $ = (id: string) => document.getElementById(id);
    const container = $('progresstiming');
    if (!container) return;

    const config      = $('ptConfig') as HTMLElement,  game       = $('ptGame') as HTMLElement;
    const startBtn    = $('ptStart') as HTMLElement,   randomBtn  = $('ptRandom') as HTMLElement;
    const basicBtn    = $('ptBasicMode') as HTMLElement, advancedBtn = $('ptAdvancedMode') as HTMLElement;
    const advancedPanel = $('ptAdvancedPanel') as HTMLElement;
    const speedSlider = $('ptSpeed') as HTMLInputElement,   zoneSlider  = $('ptZoneSize') as HTMLInputElement;
    const speedValue  = $('ptSpeedValue') as HTMLElement, zoneValue = $('ptSizeValue') as HTMLElement;

    const cb: Record<string, HTMLInputElement> = {
      incremental: $('ptIncremental') as HTMLInputElement,
      movingZone:  $('ptMovingZone') as HTMLInputElement,
      incSpeed:    $('ptIncSpeed') as HTMLInputElement,
      incSize:     $('ptIncSize') as HTMLInputElement,
      incMove:     $('ptIncMove') as HTMLInputElement,
      perfect:     $('ptPerfectEnabled') as HTMLInputElement,
    };
    const pv: Record<string, HTMLElement> = {
      track:   $('ptPreviewTrack') as HTMLElement,
      target:  $('ptPreviewTarget') as HTMLElement,
      perfect: $('ptPreviewPerfect') as HTMLElement,
      marker:  $('ptPreviewMarker') as HTMLElement,
    };
    const g: Record<string, HTMLElement> = {
      track:     $('ptTrack') as HTMLElement,
      target:    $('ptTarget') as HTMLElement,
      perfect:   $('ptPerfect') as HTMLElement,
      marker:    $('ptMarker') as HTMLElement,
      result:    $('ptResult') as HTMLElement,
      timer:     $('ptTimerFill') as HTMLElement,
      round:     $('ptRound') as HTMLElement,
      state:     $('ptState') as HTMLElement,
      particles: $('ptParticles') as HTMLElement,
    };

    const s: PTSettings = { speed:50, zoneSize:20, movingZone:false, incremental:true,
                incSpeed:true, incSize:true, incMove:true, perfect:true };

    let previewPos = 0, previewDir = 1, previewZone = 35, previewZoneDir = 1, previewRaf: number | null = null;
    let running = false;
    let pos = 0, dir = 1, zonePos = 35, zoneDir = 1;
    let round = 1, score = 0;
    const maxRounds = 5;
    let lastFrame = 0, raf: number | null = null, iv: ReturnType<typeof setInterval> | null = null;
    let canClick = false, roundStarting = false;
    let startDir = 1, timeRemaining = 100, controlsRegistered = false;
    /** setTimeout del fade-in tras pulsar "Empezar" (startGame). Sin
     *  trackear, si stop() se llamaba dentro de esos 350ms, este
     *  timeout igual disparaba después y arrancaba el bucle del juego
     *  (registerControls + startLoop) sobre una vista ya cerrada — a
     *  diferencia de los demás setTimeout de este archivo, que solo
     *  cierran/reflejan estado y son inofensivos si sobreviven. */
    let startFadeTimeout: ReturnType<typeof setTimeout> | null = null;

    function updateSliderTexts() {
      s.speed    = +speedSlider.value;
      s.zoneSize = +zoneSlider.value;
      speedValue.textContent = s.speed + '%';
      zoneValue.textContent  = s.zoneSize + '%';
    }

    function updatePreviewLayout() {
      pv.target.style.width = s.zoneSize + '%';
      pv.perfect.style.display = s.perfect ? 'block' : 'none';
      if (s.perfect) {
        const pw = Math.max(20, s.zoneSize * 0.35);
        pv.perfect.style.width = pw + '%';
        pv.perfect.style.left  = ((100 - pw) / 2) + '%';
      }
    }

    function setMode(advanced: boolean) {
      basicBtn.classList.toggle('active', !advanced);
      basicBtn.setAttribute('aria-pressed', String(!advanced));
      advancedBtn.classList.toggle('active', advanced);
      advancedBtn.setAttribute('aria-pressed', String(advanced));
      advancedPanel.classList.toggle('open', advanced);
    }

    function randomize() {
      speedSlider.value = String(20 + Math.floor(Math.random() * 81));
      zoneSlider.value  = String(6  + Math.floor(Math.random() * 25));
      for (const k of ['incremental','movingZone','incSpeed','incSize','incMove','perfect']) {
        const el = cb[k];
        el.checked = Math.random() < 0.5;
        s[k] = el.checked;
      }
      updateSliderTexts();
      updatePreviewLayout();
    }

    function startPreview() {
      if (previewRaf) cancelAnimationFrame(previewRaf);
      let last = performance.now();
      const tick = (t: number) => {
        const dt = (t - last) / 1000; last = t;
        updatePreview(dt);
        previewRaf = requestAnimationFrame(tick);
      };
      previewRaf = requestAnimationFrame(tick);
    }

    function updatePreview(dt: number) {
      if (!pv.track) return;
      const tw = pv.track.clientWidth, mw = pv.marker.offsetWidth, usable = tw - mw;
      const speed = 120 + s.speed * 4;
      previewPos += speed * dt * previewDir;
      if (previewPos >= usable) { previewPos = usable; previewDir = -1; }
      if (previewPos <= 0)      { previewPos = 0;      previewDir =  1; }
      pv.marker.style.left = previewPos + 'px';
      let zoneStart;
      if (s.movingZone) {
        const zw = tw * (s.zoneSize / 100), max = tw - zw;
        previewZone += 120 * dt * previewZoneDir;
        if (previewZone >= max) { previewZone = max; previewZoneDir = -1; }
        if (previewZone <= 0)   { previewZone = 0;   previewZoneDir =  1; }
        pv.target.style.left = previewZone + 'px';
        zoneStart = previewZone;
      } else {
        pv.target.style.left = '35%';
        zoneStart = tw * 0.35;
      }
      const center = previewPos + mw / 2;
      const zoneEnd = zoneStart + tw * (s.zoneSize / 100);
      const inside = center >= zoneStart && center <= zoneEnd;
      pv.target.classList.toggle('active', inside);
      pv.marker.classList.toggle('inside', inside);
    }

    function startGame() {
      if (running) return;
      running = true;
      score = 0; round = 1; pos = 0; dir = 1; zoneDir = 1; startDir = 1;
      g.result.textContent = ''; g.state.textContent = '-'; g.round.textContent = '1';
      config.classList.add('fadeOut');
      startFadeTimeout = setTimeout(() => {
        startFadeTimeout = null;
        config.style.display = 'none';
        game.classList.add('active', 'fadeIn');
        resetRound(); registerControls(); startLoop();
      }, 350);
    }

    function resetRound() {
      const tw = g.track.clientWidth, mw = g.marker.offsetWidth, zw = tw * (s.zoneSize / 100);
      pos = startDir === 1 ? 0 : tw - mw;
      dir = startDir; startDir *= -1;
      zonePos = Math.random() * (tw - zw);
      g.marker.style.left = pos + 'px';
      g.target.style.left = zonePos + 'px';
      g.target.style.width = zw + 'px';
      if (s.perfect) {
        const pw = zw * 0.35;
        g.perfect.style.display = 'block';
        g.perfect.style.width = pw + 'px';
        g.perfect.style.left  = ((zw - pw) / 2) + 'px';
      } else {
        g.perfect.style.display = 'none';
      }
      timeRemaining = 100; g.timer.style.width = '100%';
      g.result.textContent = ''; g.result.className = 'pt-result';
      canClick = false; showCountdown();
    }

    function showCountdown() {
      roundStarting = true; g.result.className = 'pt-result show';
      g.result.textContent = '3'; let c = 3;
      iv = setInterval(() => {
        c--;
        if (c > 0)        g.result.textContent = String(c);
        else if (c === 0) g.result.textContent = 'GO!';
        else {
          if (iv) clearInterval(iv);
          g.result.textContent = ''; g.result.className = 'pt-result';
          roundStarting = false; canClick = true;
        }
      }, 500);
    }

    function startLoop() {
      if (raf) cancelAnimationFrame(raf);
      lastFrame = performance.now();
      const tick = (t: number) => {
        if (!running) return;
        const dt = (t - lastFrame) / 1000; lastFrame = t;
        update(dt); raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function stopLoop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    function update(dt: number) {
      const tw = g.track.clientWidth, mw = g.marker.offsetWidth, usable = tw - mw;
      if (roundStarting || !canClick) {
        g.marker.style.left = pos + 'px';
        if (s.movingZone) g.target.style.left = zonePos + 'px';
        return;
      }
      const markerSpeed = 120 + s.speed * 4;
      pos += markerSpeed * dt * dir;
      if (pos >= usable) { pos = usable; dir = -1; }
      if (pos <= 0)      { pos = 0;      dir =  1; }
      g.marker.style.left = pos + 'px';
      if (s.movingZone) {
        const zw = g.target.offsetWidth, maxZ = tw - zw;
        const zoneSpeed = 80 + s.speed * 1.5 + (s.incMove ? round * 8 : 0);
        zonePos += zoneSpeed * dt * zoneDir;
        if (zonePos >= maxZ) { zonePos = maxZ; zoneDir = -1; }
        if (zonePos <= 0)    { zonePos = 0;    zoneDir =  1; }
        g.target.style.left = zonePos + 'px';
      }
      const center = pos + mw / 2;
      const zl = g.target.offsetLeft, zr = zl + g.target.offsetWidth;
      g.marker.classList.toggle('inside', center >= zl && center <= zr);
      g.target.classList.toggle('active', center >= zl && center <= zr);
      timeRemaining -= dt * 18;
      if (timeRemaining < 0) timeRemaining = 0;
      g.timer.style.width = timeRemaining + '%';
      if (timeRemaining <= 0) failRound();
    }

    function registerControls() {
      if (controlsRegistered) return;
      controlsRegistered = true;
      ptKeyDownHandler = e => {
        if (!running) return;
        if (game.classList.contains('hidden')) return;
        if (e.code === 'Space') { e.preventDefault(); checkHit(); }
      };
      document.addEventListener('keydown', ptKeyDownHandler);
      g.track.addEventListener('mousedown', () => { if (running) checkHit(); });
    }

    function checkHit() {
      if (!running || !canClick) return;
      canClick = false;
      const center = pos + g.marker.offsetWidth / 2;
      const zl = g.target.offsetLeft, zr = zl + g.target.offsetWidth;
      if (center < zl || center > zr) return failRound();
      if (!s.perfect) return goodRound();
      const pl = zl + g.perfect.offsetLeft, pr = pl + g.perfect.offsetWidth;
      if (center >= pl && center <= pr) perfectRound(); else goodRound();
    }

    function flashResult(text: string, cls: string) {
      g.state.textContent = text;
      g.result.textContent = text;
      g.result.className = 'pt-result show ' + cls;
    }

    function perfectRound() {
      score += 2; flashResult('PERFECT', 'success');
      audioManager?.play('perfect');
      g.marker.classList.add('perfect'); g.target.classList.add('pulse'); game.classList.add('success');
      createParticles(16);
      setTimeout(() => {
        g.marker.classList.remove('perfect'); g.target.classList.remove('pulse'); game.classList.remove('success');
        nextRound();
      }, 550);
    }

    function goodRound() {
      score++; flashResult('GOOD', 'normal'); game.classList.add('success'); createParticles(8);
      audioManager?.play('good');
      setTimeout(() => { game.classList.remove('success'); nextRound(); }, 450);
    }

    function failRound() {
      flashResult('FAIL', 'fail'); game.classList.add('fail'); stopLoop();
      audioManager?.play('miss');
      setTimeout(() => finish(false), 700);
    }

    function createParticles(n = 10) {
      if (!g.particles) return;
      g.particles.innerHTML = '';
      const cy = g.track.getBoundingClientRect().height / 2;
      const cx = pos + g.marker.offsetWidth / 2;
      for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        p.className = 'pt-particle show';
        p.style.left = cx + 'px'; p.style.top = cy + 'px';
        p.style.setProperty('--x', (Math.random() * 120 - 60) + 'px');
        p.style.setProperty('--y', (Math.random() * 80  - 40) + 'px');
        g.particles.appendChild(p);
        setTimeout(() => p.remove(), 800);
      }
    }

    function nextRound() {
      if (!running) return;
      round++;
      if (round > maxRounds) return finish(true);
      g.round.textContent = String(round);
      if (s.incremental) {
        if (s.incSpeed) s.speed    = Math.min(100, s.speed + 8);
        if (s.incSize)  s.zoneSize = Math.max(5,   s.zoneSize - 2);
      }
      resetRound();
    }

    function finish(success: boolean) {
      stopLoop();
      if (success) { audioManager?.play('perfect'); flashResult('¡MINIJUEGO SUPERADO!', 'success'); g.state.textContent = 'COMPLETADO'; }
      else         { audioManager?.play('gameover'); flashResult('INTÉNTALO DE NUEVO',   'fail');    g.state.textContent = 'FALLASTE'; }
      setTimeout(() => {
        game.classList.remove('active', 'fadeIn');
        config.style.display = '';
        config.classList.remove('fadeOut');
        running = false;
        g.result.textContent = ''; g.result.className = 'pt-result';
      }, 2500);
    }

    // wire events
    speedSlider.addEventListener('input', () => { updateSliderTexts(); updatePreviewLayout(); });
    zoneSlider.addEventListener('input',  () => { updateSliderTexts(); updatePreviewLayout(); });
    cb.incremental.addEventListener('change', () => s.incremental = cb.incremental.checked);
    cb.movingZone .addEventListener('change', () => s.movingZone  = cb.movingZone.checked);
    cb.incSpeed   .addEventListener('change', () => s.incSpeed    = cb.incSpeed.checked);
    cb.incSize    .addEventListener('change', () => s.incSize     = cb.incSize.checked);
    cb.incMove    .addEventListener('change', () => s.incMove     = cb.incMove.checked);
    cb.perfect    .addEventListener('change', () => {
      s.perfect = cb.perfect.checked;
      pv.perfect.style.display = s.perfect ? 'block' : 'none';
    });
    basicBtn   .addEventListener('click', () => setMode(false));
    advancedBtn.addEventListener('click', () => setMode(true));
    randomBtn  .addEventListener('click', randomize);
    startBtn   .addEventListener('click', startGame);

    updateSliderTexts();
    updatePreviewLayout();
    startPreview();

    cleanup = function () {
      stopLoop();
      if (previewRaf) { cancelAnimationFrame(previewRaf); previewRaf = null; }
      if (iv)         { clearInterval(iv);                iv = null; }
      if (startFadeTimeout) { clearTimeout(startFadeTimeout); startFadeTimeout = null; }
      running = false; canClick = false; roundStarting = false;
      game.classList.remove('active', 'fadeIn', 'success', 'fail');
      config.style.display = '';
      config.classList.remove('fadeOut');
      g.result.textContent = ''; g.result.className = 'pt-result';
      round = 1; score = 0; pos = 0; dir = 1;
      startPreview();
      if (ptKeyDownHandler) {
        document.removeEventListener('keydown', ptKeyDownHandler);
        ptKeyDownHandler = null;
        controlsRegistered = false;
      }
    };}

let ptKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

export function stop() {
  if (cleanup) cleanup();
}
