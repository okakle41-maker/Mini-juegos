import audioManager from '../audioManager.js';
/**
 * js/games/bouncebarGame.logic.ts
 *
 * Lógica pesada de "Bounce Bar" (init/stop), extraída de
 * js/games/multipoint.ts (el wrapper que registra este juego en
 * GameRegistry — no confundir con js/views/multipoint.ts, el HTML de
 * la vista) para lazy loading. Ver `logic` en games/multipoint.ts y
 * el comentario de GameConfig.logic en core/gameRegistry.ts.
 *
 * Reescrito del patrón `this: StoppableThis` a un closure module-level
 * (ver misma nota en Maze/maze.logic.ts).
 */

let cleanup: (() => void) | null = null;
/** id del setInterval del countdown "3, 2, 1" — ver misma nota en
 *  multipointGame.logic.ts: corre antes de que existan los listeners
 *  que `cleanup` cancelaba, así que si stop() se llamaba durante la
 *  cuenta regresiva, este interval seguía y terminaba arrancando el
 *  juego solo (running=true, listeners agregados) sobre una vista
 *  ya cerrada. */
let countdownInterval: ReturnType<typeof setInterval> | null = null;

export function init() {
    const wrap = document.getElementById('bouncebar-root');
    if (!wrap) return;

    const $ = (id: string) => wrap.querySelector('#' + id) as HTMLElement;

    wrap.innerHTML = `
      <div class="mp2-card bb-card">
        <div class="mp2-header">
          <div>
            <div class="mp2-title">Bounce Bar</div>
            <div class="mp2-sub">La barra retrocede y se lanza — pulsa cuando llegue a la zona</div>
          </div>
          <div class="mp2-badge" id="bbBadge" role="status" aria-live="polite">LISTO</div>
        </div>

        <div class="mp2-track-wrap">
          <div class="mp2-track bb-track" id="bbTrack">
            <div class="bb-zone" id="bbZone"></div>
            <div class="bb-fill" id="bbFill"></div>
            <div class="bb-cursor" id="bbCursor"></div>
          </div>
        </div>

        <div class="bb-phase-label" id="bbPhase" role="status" aria-live="assertive">Preparado</div>
        <div class="mp2-result" id="bbResult" role="status" aria-live="polite"></div>

        <div class="mp2-stats" id="bbStats" style="display:none">
          <div class="mp2-stat"><span class="mp2-stat-val" id="bbStatHit">0</span><span class="mp2-stat-lbl">Acertados</span></div>
          <div class="mp2-stat"><span class="mp2-stat-val" id="bbStatRounds">0</span><span class="mp2-stat-lbl">Rondas</span></div>
          <div class="mp2-stat"><span class="mp2-stat-val" id="bbStatScore">0</span><span class="mp2-stat-lbl">Puntos</span></div>
        </div>

        <div class="mp2-actions">
          <button class="mp2-btn mp2-btn--start bb-start" id="bbStart">▶ EMPEZAR</button>
        </div>
      </div>
    `;

    const track    = $('bbTrack');
    const zone     = $('bbZone');
    const fill     = $('bbFill');
    const cursor   = $('bbCursor');
    const phase    = $('bbPhase');
    const result   = $('bbResult');
    const stats    = $('bbStats');
    const badge    = $('bbBadge');
    const startBtn = $('bbStart');

    const TOTAL_ROUNDS = 5;
    const ZONE_WIDTH   = 14;   // % width of hit zone

    let running = false, raf: number | null = null;
    let pos = 0;             // 0–100 %
    let roundHits = 0, totalRounds = 0, score = 0;
    let difficulty = 1;
    let phaseState: 'idle' | 'pullback' | 'launch' | 'result' = 'idle';

    // Per-round config (randomized each round)
    let zonePos = 0;
    let pullTarget = 0, launchSpeed = 0;
    let pullSpeed  = 0;
    let canHit = false, hitThisRound = false;

    void track;

    function placeZone() {
      // Zone can be anywhere from 55% to 85%
      zonePos = 55 + Math.random() * 30;
      zone.style.left  = zonePos + '%';
      zone.style.width = ZONE_WIDTH + '%';
    }

    function startRound() {
      totalRounds++;
      hitThisRound = false;
      canHit = false;

      // Difficulty ramps up
      difficulty = 1 + (totalRounds - 1) * 0.3;
      pullTarget = 5 + Math.random() * 15;       // pull back to 5–20%
      pullSpeed  = 18 + difficulty * 4;           // px/s in %/s
      launchSpeed= 55 + difficulty * 10;

      placeZone();
      pos = 30 + Math.random() * 10;             // start ~30–40%
      fill.style.width  = pos + '%';
      fill.style.transition = 'none';
      cursor.style.left = pos + '%';

      phaseState = 'pullback';
      phase.textContent = '⬅ Retrocediendo…';
      phase.style.color = '#f472b6';
    }

    function endGame(won: boolean) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      phaseState = 'idle';

      stats.style.display = 'flex';
      $('bbStatHit').textContent    = String(roundHits);
      $('bbStatRounds').textContent = String(TOTAL_ROUNDS);
      $('bbStatScore').textContent  = String(score);

      if (won) {
        badge.textContent = '✔ SUPERADO';
        badge.className   = 'mp2-badge mp2-badge--win';
        result.innerHTML  = `<span style="color:#4ade80">✔ ¡Superado! ${roundHits}/${TOTAL_ROUNDS}</span>`;
        audioManager?.play('perfect');
      } else {
        badge.textContent = '✖ FALLADO';
        badge.className   = 'mp2-badge mp2-badge--fail';
        result.innerHTML  = `<span style="color:#f87171">✖ ${roundHits}/${TOTAL_ROUNDS} acertados</span>`;
        audioManager?.play('gameover');
      }

      if (window.Leaderboard) window.Leaderboard.save('bouncebar', score);
      (startBtn as HTMLButtonElement).textContent = '↺ REINICIAR';
      (startBtn as HTMLButtonElement).disabled    = false;

      document.removeEventListener('keydown', onKey);
      wrap!.removeEventListener('click', onClick);
    }

    function processHit() {
      if (!canHit || hitThisRound) return;
      const inZone = pos >= zonePos && pos <= zonePos + ZONE_WIDTH;
      hitThisRound = true;
      canHit       = false;

      if (inZone) {
        const center   = zonePos + ZONE_WIDTH / 2;
        const dist     = Math.abs(pos - center);
        const precision = 1 - (dist / (ZONE_WIDTH / 2));
        const gained   = Math.round(100 + precision * 150);
        score  += gained;
        roundHits++;
        result.innerHTML = `<span style="color:#4ade80">✔ +${gained}</span>`;
        cursor.classList.add('bb-cursor--hit');
        setTimeout(() => cursor.classList.remove('bb-cursor--hit'), 400);
        audioManager?.play(precision > 0.7 ? 'perfect' : 'good');
      } else {
        result.innerHTML = `<span style="color:#f87171">✖ ¡Fallaste!</span>`;
        cursor.classList.add('bb-cursor--miss');
        setTimeout(() => cursor.classList.remove('bb-cursor--miss'), 400);
        audioManager?.play('miss');
      }

      // Pause briefly then next round or end
      phaseState = 'result';
      phase.textContent = '';
      setTimeout(() => {
        if (!running) return;
        if (totalRounds >= TOTAL_ROUNDS) {
          endGame(roundHits >= Math.ceil(TOTAL_ROUNDS * 0.6));
        } else {
          startRound();
        }
      }, 900);
    }

    let lastFrame2 = 0;
    function loop(ts: number) {
      if (!running) return;
      const dt = Math.min((ts - lastFrame2) / 1000, 0.05);
      lastFrame2 = ts;

      if (phaseState === 'pullback') {
        pos -= pullSpeed * dt;
        if (pos <= pullTarget) {
          pos = pullTarget;
          phaseState = 'launch';
          phase.textContent = '🚀 ¡AHORA!';
          phase.style.color = '#fbbf24';
          canHit = true;

          // flash zone
          zone.classList.add('bb-zone--pulse');
          setTimeout(() => zone.classList.remove('bb-zone--pulse'), 500);
        }
      } else if (phaseState === 'launch') {
        pos += launchSpeed * dt;
        if (pos > 100) {
          pos = 100;
          // Auto-miss if not clicked
          if (!hitThisRound) {
            result.innerHTML = `<span style="color:#f87171">✖ ¡Demasiado tarde!</span>`;
            audioManager?.play('miss');
          }
          phaseState = 'result';
          phase.textContent = '';
          canHit = false;
          setTimeout(() => {
            if (!running) return;
            if (totalRounds >= TOTAL_ROUNDS) {
              endGame(roundHits >= Math.ceil(TOTAL_ROUNDS * 0.6));
            } else {
              startRound();
            }
          }, 900);
        }
      }

      fill.style.width  = pos + '%';
      cursor.style.left = pos + '%';
      raf = requestAnimationFrame(loop);
    }

    function startGame() {
      running = false;
      if (raf) cancelAnimationFrame(raf);

      roundHits = 0; totalRounds = 0; score = 0; difficulty = 1;
      stats.style.display = 'none';
      result.innerHTML  = '';
      badge.textContent = '▶ JUGANDO';
      badge.className   = 'mp2-badge mp2-badge--run';
      (startBtn as HTMLButtonElement).disabled = true;
      phaseState        = 'idle';
      pos = 30;
      fill.style.width  = '0%';
      cursor.style.left = '0%';

      let count = 3;
      phase.textContent = String(count);
      phase.style.color = '#a78bfa';
      const cd = setInterval(() => {
        count--;
        if (count > 0) {
          phase.textContent = String(count);
        } else {
          clearInterval(cd);
          countdownInterval = null;
          running    = true;
          lastFrame2 = performance.now();
          startRound();
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
        processHit();
      }
    }
    function onClick(e: MouseEvent) {
      if (e.target === startBtn) return;
      processHit();
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
