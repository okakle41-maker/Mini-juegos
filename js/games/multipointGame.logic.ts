import audioManager from '../audioManager.js';
/**
 * js/games/multipointGame.logic.ts
 *
 * Lógica pesada de "Multi-Point Progress" (init/stop), extraída de
 * js/games/multipoint.ts (el wrapper que registra este juego en
 * GameRegistry — no confundir con js/views/multipoint.ts, el HTML de
 * la vista) para lazy loading. Ver `logic` en games/multipoint.ts y
 * el comentario de GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: StoppableThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts).
 */

interface MPPoint {
  pos: number;
  hit: boolean;
  missed: boolean;
  el: HTMLElement;
}

let cleanup: (() => void) | null = null;
/** id del setInterval del countdown "3, 2, 1" — separado del resto
 *  porque corre ANTES de que el juego esté "running" (y por lo tanto
 *  antes de que existan los listeners que el `cleanup` de más abajo
 *  ya cancelaba). Si stop() se llamaba durante la cuenta regresiva,
 *  este interval seguía y terminaba arrancando el juego solo. */
let countdownInterval: ReturnType<typeof setInterval> | null = null;

export function init() {
    const wrap = document.getElementById('multipoint-root');
    if (!wrap) return;

    const $ = (id: string) => wrap.querySelector('#' + id) as HTMLElement;

    /* ── Config state ── */
    const cfg = {
      points:   5,
      duration: 4000,   // ms
      window:   80,     // ms half-window for a hit
    };

    /* ── Build HTML ── */
    wrap.innerHTML = `
      <div class="mp2-card">
        <div class="mp2-header">
          <div>
            <div class="mp2-title">Multi-Point Progress</div>
            <div class="mp2-sub">Haz clic cuando el marcador pase por cada punto</div>
          </div>
          <div class="mp2-badge" id="mp2Badge" role="status" aria-live="polite">LISTO</div>
        </div>

        <div class="mp2-config" id="mp2Config">
          <div class="mp2-cfg-row">
            <label class="mp2-cfg-label" for="mp2Pts">Puntos <span id="mp2PtsVal">5</span></label>
            <input class="mp2-slider" type="range" id="mp2Pts" min="2" max="12" value="5" aria-valuetext="5 puntos">
          </div>
          <div class="mp2-cfg-row">
            <label class="mp2-cfg-label" for="mp2Dur">Duración <span id="mp2DurVal">4.0s</span></label>
            <input class="mp2-slider" type="range" id="mp2Dur" min="1500" max="8000" step="250" value="4000" aria-valuetext="4.0 segundos">
          </div>
          <div class="mp2-cfg-row">
            <label class="mp2-cfg-label" for="mp2Win">Tolerancia <span id="mp2WinVal">Normal</span></label>
            <input class="mp2-slider" type="range" id="mp2Win" min="30" max="150" step="10" value="80" aria-valuetext="Normal">
          </div>
        </div>

        <div class="mp2-track-wrap">
          <div class="mp2-track" id="mp2Track">
            <div class="mp2-fill" id="mp2Fill"></div>
            <div class="mp2-cursor" id="mp2Cursor"></div>
          </div>
        </div>

        <div class="mp2-result" id="mp2Result" role="status" aria-live="polite"></div>

        <div class="mp2-stats" id="mp2Stats" style="display:none">
          <div class="mp2-stat"><span class="mp2-stat-val" id="mp2StatHit">0</span><span class="mp2-stat-lbl">Acertados</span></div>
          <div class="mp2-stat"><span class="mp2-stat-val" id="mp2StatMiss">0</span><span class="mp2-stat-lbl">Fallados</span></div>
          <div class="mp2-stat"><span class="mp2-stat-val" id="mp2StatScore">0</span><span class="mp2-stat-lbl">Puntos</span></div>
        </div>

        <div class="mp2-actions">
          <button class="mp2-btn mp2-btn--start" id="mp2Start">▶ EMPEZAR</button>
        </div>
      </div>
    `;

    /* ── Refs ── */
    const track    = $('mp2Track');
    const fill     = $('mp2Fill');
    const cursor   = $('mp2Cursor');
    const result   = $('mp2Result');
    const stats    = $('mp2Stats');
    const badge    = $('mp2Badge');
    const startBtn = $('mp2Start');
    const slPts    = $('mp2Pts') as HTMLInputElement, valPts = $('mp2PtsVal');
    const slDur    = $('mp2Dur') as HTMLInputElement, valDur = $('mp2DurVal');
    const slWin    = $('mp2Win') as HTMLInputElement, valWin = $('mp2WinVal');

    /* ── Config sliders ── */
    slPts.addEventListener('input', () => {
      cfg.points = +slPts.value;
      valPts.textContent = String(cfg.points);
      slPts.setAttribute('aria-valuetext', `${cfg.points} puntos`);
    });
    slDur.addEventListener('input', () => {
      cfg.duration = +slDur.value;
      valDur.textContent = (cfg.duration / 1000).toFixed(1) + 's';
      slDur.setAttribute('aria-valuetext', `${(cfg.duration / 1000).toFixed(1)} segundos`);
    });
    slWin.addEventListener('input', () => {
      cfg.window = +slWin.value;
      const label = cfg.window <= 50 ? 'Estricta' : cfg.window <= 90 ? 'Normal' : 'Amplia';
      valWin.textContent = label;
      slWin.setAttribute('aria-valuetext', label);
    });

    /* ── Game state ── */
    let running = false, raf: number | null = null, startTime = 0;
    let points: MPPoint[] = [];
    let hits = 0, misses = 0, score = 0;

    function buildPoints() {
      // Remove old dots
      wrap!.querySelectorAll('.mp2-dot').forEach(d => d.remove());
      points = [];

      const positions: number[] = [];
      // Ensure spread: divide bar into n segments
      for (let i = 0; i < cfg.points; i++) {
        const segStart = i / cfg.points;
        const segEnd   = (i + 1) / cfg.points;
        // random within segment, avoid very edges
        const pos = segStart + (segEnd - segStart) * (0.15 + Math.random() * 0.7);
        positions.push(pos);
      }

      positions.forEach(pos => {
        const dot = document.createElement('div');
        dot.className = 'mp2-dot';
        dot.style.left = (pos * 100) + '%';
        track.appendChild(dot);
        points.push({ pos, hit: false, missed: false, el: dot });
      });
    }

    function endGame() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      fill.style.width  = '100%';
      cursor.style.left = '100%';

      // Mark any remaining as missed
      points.forEach(p => {
        if (!p.hit && !p.missed) {
          p.missed = true;
          p.el.classList.add('mp2-dot--miss');
          misses++;
        }
      });

      const pct = Math.round((hits / cfg.points) * 100);
      score = hits * 100 - misses * 30;
      score = Math.max(0, score);

      $('mp2StatHit').textContent   = String(hits);
      $('mp2StatMiss').textContent  = String(misses);
      $('mp2StatScore').textContent = String(score);
      stats.style.display = 'flex';

      if (pct >= 70) {
        badge.textContent = '✔ SUPERADO';
        badge.className = 'mp2-badge mp2-badge--win';
        result.innerHTML = `<span style="color:#4ade80">✔ ${pct}% — ¡Superado!</span>`;
        audioManager?.play('perfect');
      } else {
        badge.textContent = '✖ FALLADO';
        badge.className = 'mp2-badge mp2-badge--fail';
        result.innerHTML = `<span style="color:#f87171">✖ ${pct}% — Inténtalo de nuevo</span>`;
        audioManager?.play('gameover');
      }

      if (window.Leaderboard) window.Leaderboard.save('multipoint', score);
      (startBtn as HTMLButtonElement).textContent = '↺ REINICIAR';
      (startBtn as HTMLButtonElement).disabled = false;

      document.removeEventListener('keydown', onKey);
      wrap!.removeEventListener('click', onClick);
    }

    function processClick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / cfg.duration, 1);

      // Find nearest unhit point within window
      let best: MPPoint | null = null, bestDist = Infinity;
      points.forEach(p => {
        if (p.hit || p.missed) return;
        const dist = Math.abs((p.pos - progress) * cfg.duration);
        if (dist < cfg.window && dist < bestDist) {
          best = p;
          bestDist = dist;
        }
      });

      if (best) {
        const b = best as MPPoint;
        b.hit = true;
        b.el.classList.add('mp2-dot--hit');
        hits++;
        // precision bonus
        const precision = 1 - (bestDist / cfg.window);
        const gained = Math.round(100 + precision * 50);
        result.innerHTML = `<span style="color:#4ade80">+${gained}</span>`;
        audioManager?.play(precision > 0.7 ? 'perfect' : 'good');
        // burst
        flashCursor('hit');
      } else {
        result.innerHTML = `<span style="color:#f87171">✖ Miss</span>`;
        audioManager?.play('miss');
        flashCursor('miss');
      }
    }

    function flashCursor(type: 'hit' | 'miss') {
      cursor.classList.remove('mp2-cursor--hit', 'mp2-cursor--miss');
      void cursor.offsetWidth;
      cursor.classList.add(type === 'hit' ? 'mp2-cursor--hit' : 'mp2-cursor--miss');
      setTimeout(() => cursor.classList.remove('mp2-cursor--hit', 'mp2-cursor--miss'), 280);
    }

    function loop(ts: number) {
      if (!running) return;
      const elapsed  = ts - startTime;
      const progress = Math.min(elapsed / cfg.duration, 1);

      fill.style.width  = (progress * 100) + '%';
      cursor.style.left = (progress * 100) + '%';

      // Auto-mark missed points well past window
      points.forEach(p => {
        if (!p.hit && !p.missed) {
          const pElapsed = p.pos * cfg.duration;
          if (elapsed > pElapsed + cfg.window * 1.5) {
            p.missed = true;
            p.el.classList.add('mp2-dot--miss');
            misses++;
          }
        }
      });

      if (progress >= 1) { endGame(); return; }
      raf = requestAnimationFrame(loop);
    }

    function startGame() {
      running = false;
      if (raf) cancelAnimationFrame(raf);

      hits = 0; misses = 0; score = 0;
      fill.style.width  = '0%';
      fill.style.transition = 'none';
      cursor.style.left = '0%';
      result.innerHTML  = '';
      stats.style.display = 'none';
      badge.textContent = '▶ JUGANDO';
      badge.className = 'mp2-badge mp2-badge--run';
      (startBtn as HTMLButtonElement).disabled = true;

      buildPoints();

      // Countdown
      let count = 3;
      result.innerHTML = `<span style="color:#a78bfa;font-size:2rem">${count}</span>`;
      const cd = setInterval(() => {
        count--;
        if (count > 0) {
          result.innerHTML = `<span style="color:#a78bfa;font-size:2rem">${count}</span>`;
        } else {
          clearInterval(cd);
          countdownInterval = null;
          result.innerHTML = `<span style="color:#c4b5fd">¡YA!</span>`;
          running = true;
          startTime = performance.now();
          raf = requestAnimationFrame(loop);

          document.addEventListener('keydown', onKey);
          wrap!.addEventListener('click', onClick);
        }
      }, 1000);
      countdownInterval = cd;
    }

    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        processClick(performance.now());
      }
    }
    function onClick(e: MouseEvent) {
      if (e.target === startBtn) return;
      processClick(performance.now());
    }

    startBtn.addEventListener('click', () => {
      if (!running) startGame();
    });

    cleanup = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
      document.removeEventListener('keydown', onKey);
      wrap!.removeEventListener('click', onClick);
    };}

export function stop() {
  if (cleanup) cleanup();
}
