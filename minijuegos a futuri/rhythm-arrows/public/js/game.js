/**
 * rhythm-arrows/public/js/game.js
 *
 * Lógica del minijuego "Rhythm Arrows".
 *
 * El jugador debe completar un recorrido siguiendo un ritmo preciso.
 * Las flechas forman una figura geométrica conectada mediante líneas.
 * Una línea verde avanza automáticamente entre vértices; el jugador
 * debe pulsar la tecla de la flecha EXACTAMENTE cuando la línea se
 * detiene justo antes de alcanzar la flecha.
 *
 * Si falla (pronto/tarde/dirección incorrecta) → la cadena se rompe.
 */

(function () {
  'use strict';

  // ── Configuración ─────────────────────────────────────────────────────
  const CANVAS_SIZE = 700;
  const CENTER = CANVAS_SIZE / 2;
  const RADIUS = 230;
  // Distancia (px) antes del centro del vértice donde la línea verde se
  // detiene — el jugador debe pulsar cuando la cabeza de la línea llega
  // a este punto, justo en el borde del círculo de la flecha.
  const STOP_DISTANCE = 30;

  // Direcciones válidas y sus teclas.
  const DIRECTIONS = ['up', 'down', 'left', 'right'];
  const DIR_CHARS = { up: '↑', down: '↓', left: '←', right: '→' };
  const KEY_MAP = {
    arrowup: 'up', w: 'up',
    arrowdown: 'down', s: 'down',
    arrowleft: 'left', a: 'left',
    arrowright: 'right', d: 'right',
  };

  // ── Estado del juego ──────────────────────────────────────────────────
  let vertices = [];          // [{ x, y, dir, angle, lit }]
  let activeIndex = 0;        // índice del vértice actual (el que la línea busca)
  let nextIndex = 1;          // índice del próximo vértice al que viaja la línea
  let previousIndex = -1;     // de dónde viene la línea
  let lineProgress = 0;       // 0..1 (progreso de la línea entre previous→next)
  let lineActive = false;     // si la línea está en movimiento
  let gameRunning = false;
  let completedCount = 0;
  let totalVertices = 4;
  let startTime = 0;
  let elapsedTime = 0;
  let perfectCount = 0;
  let goodCount = 0;
  let windowMs = 160;         // ventana de acierto en ms (±)
  let travelMs = 1000;        // duración del viaje de la línea entre vértices (ms)
  let lastTimestamp = 0;
  let animationId = null;
  let feedbackTimer = null;
  let showTimingIndicator = false; // si se muestra el indicador del momento exacto

  // ── Elementos DOM ─────────────────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const screenHome = document.getElementById('home-screen');
  const screenGame = document.getElementById('game-screen');
  const overlay = document.getElementById('result-overlay');
  const feedbackEl = document.getElementById('input-feedback');
  const statVertices = document.getElementById('stat-vertices');
  const statCompleted = document.getElementById('stat-completed');
  const statTime = document.getElementById('stat-time');

  // ── Audio (WebAudio API) ──────────────────────────────────────────────
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration = 0.1, type = 'square', gainValue = 0.04) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  const sounds = {
    tick: () => playTone(880, 0.05, 'sine', 0.04),
    perfect: () => playTone(1047, 0.1, 'triangle', 0.06),
    good: () => playTone(784, 0.08, 'triangle', 0.05),
    fail: () => { playTone(200, 0.2, 'sawtooth', 0.06); setTimeout(() => playTone(150, 0.25, 'sawtooth', 0.05), 120); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'triangle', 0.06), i * 120)); },
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
  }

  function $(id) { return document.getElementById(id); }

  function showFeedback(text, isGood) {
    if (!feedbackEl) return;
    feedbackEl.textContent = text;
    feedbackEl.className = 'input-feedback show ' + (isGood ? 'good' : 'bad');
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedbackEl.className = 'input-feedback';
    }, 450);
  }

  // ── Generación de la figura ───────────────────────────────────────────
  /**
   * Genera los vértices de una figura regular de N lados.
   * Cada vértice recibe una dirección aleatoria.
   * Ninguna flecha comienza encendida: la primera (índice 0, la de
   * arriba) es la ÚLTIMA en encenderse al cerrar el circuito.
   */
  function generateFigure(sideCount) {
    const points = [];
    for (let i = 0; i < sideCount; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / sideCount;
      points.push({
        x: CENTER + RADIUS * Math.cos(angle),
        y: CENTER + RADIUS * Math.sin(angle),
        angle,
        dir: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
        lit: false,
      });
    }
    return points;
  }

  /** Devuelve el progreso máximo de la línea para el viaje actual. */
  function getMaxProgress() {
    if (previousIndex < 0 || nextIndex < 0) return 1;
    const from = vertices[previousIndex];
    const to = vertices[nextIndex];
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    return Math.max(0, 1 - STOP_DISTANCE / dist);
  }

  // ── Dibujo ────────────────────────────────────────────────────────────
  function drawFigure() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Fondo sutil dentro del canvas.
    ctx.fillStyle = 'rgba(5, 2, 0, 0.85)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Líneas de conexión entre vértices consecutivos (siempre visibles,
    // atenuadas — son las "conexiones" de la figura).
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.2)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const w = vertices[(i + 1) % vertices.length];
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(w.x, w.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Línea del ritmo (naranja neón, si está activa y hay un recorrido).
    if (lineActive && previousIndex >= 0 && nextIndex >= 0) {
      const from = vertices[previousIndex];
      const to = vertices[nextIndex];
      // La línea se detiene a STOP_DISTANCE px antes del centro del vértice.
      const maxProgress = getMaxProgress();
      const progress = Math.min(lineProgress, maxProgress);
      const x = from.x + (to.x - from.x) * progress;
      const y = from.y + (to.y - from.y) * progress;

      // Línea con resplandor.
      ctx.save();
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();

      // Cabeza de la línea (círculo brillante).
      ctx.save();
      ctx.shadowColor = '#ff9a3c';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Indicador del momento exacto de acierto (opcional).
    drawTimingIndicator();

    // Vértices (flechas).
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const isActive = i === nextIndex;
      const isMatchPoint = i === 0; // la primera flecha es el punto de cierre
      const isLit = v.lit;

      // Círculo del vértice.
      ctx.beginPath();
      ctx.arc(v.x, v.y, 32, 0, Math.PI * 2);
      ctx.fillStyle = isLit ? 'rgba(249, 115, 22, 0.2)' : (isMatchPoint ? 'rgba(255, 154, 60, 0.12)' : 'rgba(20, 8, 0, 0.9)');
      ctx.fill();
      ctx.strokeStyle = isLit ? '#f97316' : (isActive ? '#ff9a3c' : (isMatchPoint ? 'rgba(255, 154, 60, 0.5)' : 'rgba(249, 115, 22, 0.25)'));
      ctx.lineWidth = isActive || isLit ? 4 : (isMatchPoint ? 2 : 2);
      ctx.stroke();

      // Resplandor para vértice activo (el que la línea busca).
      if (isActive) {
        ctx.save();
        ctx.shadowColor = '#ff9a3c';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(v.x, v.y, 32, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff9a3c';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }

      // Flecha. La del vértice activo se resalta en naranja neón siempre.
      drawArrow(v.x, v.y, v.dir, isLit, isActive);
    }
  }

  function drawArrow(x, y, dir, lit, active) {
    const size = 24;
    ctx.save();
    ctx.translate(x, y);
    // La flecha base apunta hacia arriba (punta en (0, -size/2)).
    // Rotaciones correctas para que cada flecha apunte en su dirección real:
    //   up    → 0            (ya apunta arriba)
    //   down  → Math.PI      (180°)
    //   left  → -Math.PI / 2 (90° antihorario)
    //   right → Math.PI / 2  (90° horario)
    ctx.rotate({ up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[dir] || 0);

    // La flecha del vértice activo (la que hay que pulsar) se ve siempre
    // en naranja neón brillante, incluso antes de que la línea arranque.
    if (active) {
      ctx.fillStyle = '#ff9a3c';
      ctx.shadowColor = '#ff9a3c';
      ctx.shadowBlur = 18;
    } else {
      ctx.fillStyle = lit ? '#ff9a3c' : '#fff7ed';
      ctx.shadowColor = lit ? '#ff9a3c' : 'transparent';
      ctx.shadowBlur = lit ? 12 : 0;
    }

    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 2, size / 2);
    ctx.lineTo(0, size / 4);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Dibuja el indicador del momento exacto de acierto.
   * Muestra:
   *  - El punto exacto donde la línea debe estar al pulsar (marcador blanco).
   *  - La ventana de acierto (±windowMs) como una zona resaltada en el camino.
   *  - La zona "perfecta" (35% de la ventana) en un tono más intenso.
   * Todo se calcula según la dificultad (velocidad y precisión) actuales.
   */
  function drawTimingIndicator() {
    if (!showTimingIndicator || !lineActive || previousIndex < 0 || nextIndex < 0) return;

    const from = vertices[previousIndex];
    const to = vertices[nextIndex];
    const maxProgress = getMaxProgress();

    // Convertir la ventana de acierto (ms) a progreso en el camino.
    // lineProgress avanza a razón de dt/travelMs, así que la ventana
    // en fracción del viaje es windowMs / travelMs.
    const windowProgress = windowMs / travelMs;
    const perfectProgress = windowProgress * 0.35;

    // Punto exacto de acierto (donde la línea se detiene).
    const hitX = from.x + (to.x - from.x) * maxProgress;
    const hitY = from.y + (to.y - from.y) * maxProgress;

    // ── Zona de acierto (ventana completa) ──
    // La ventana de acierto es simétrica en tiempo (±windowMs), pero en el
    // juego pulsar después de maxProgress siempre falla (la línea se detiene
    // ahí). Por eso la zona efectiva va desde maxProgress - windowProgress
    // hasta maxProgress.
    const zoneStart = Math.max(0, maxProgress - windowProgress);
    const zoneEnd = maxProgress;

    const zx1 = from.x + (to.x - from.x) * zoneStart;
    const zy1 = from.y + (to.y - from.y) * zoneStart;
    const zx2 = from.x + (to.x - from.x) * zoneEnd;
    const zy2 = from.y + (to.y - from.y) * zoneEnd;

    // Línea de la ventana de acierto (naranja translúcido).
    ctx.save();
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(zx1, zy1);
    ctx.lineTo(zx2, zy2);
    ctx.stroke();
    ctx.restore();

    // ── Zona perfecta (35% de la ventana) ──
    const pStart = Math.max(0, maxProgress - perfectProgress);
    const pEnd = maxProgress;

    const px1 = from.x + (to.x - from.x) * pStart;
    const py1 = from.y + (to.y - from.y) * pStart;
    const px2 = from.x + (to.x - from.x) * pEnd;
    const py2 = from.y + (to.y - from.y) * pEnd;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 154, 60, 0.8)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();
    ctx.restore();

    // ── Marcador del punto exacto ──
    // Anillo blanco pulsante en la posición exacta donde debes pulsar.
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hitX, hitY, 10 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Punto central sólido.
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hitX, hitY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Etiqueta de texto ──
    ctx.save();
    ctx.fillStyle = 'rgba(255, 154, 60, 0.95)';
    ctx.font = 'bold 12px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PULSÁ AQUÍ', hitX, hitY - 18);
    ctx.restore();
  }

  // ── Flujo del juego ───────────────────────────────────────────────────

  /**
   * Inicia una nueva partida con la configuración elegida.
   */
  function startGame() {
    const verticesCount = Number($('vertices-select').value) || 4;
    const speed = Number($('speed-select').value) || 1;
    const precision = Number($('precision-select').value) || 0.16;
    const timingIndicatorEl = $('timing-indicator');
    showTimingIndicator = timingIndicatorEl ? timingIndicatorEl.checked : false;

    totalVertices = verticesCount;
    vertices = generateFigure(verticesCount);
    // Ninguna flecha comienza encendida: la primera (la de arriba, índice 0)
    // es la ÚLTIMA en encenderse al cerrar el circuito.

    // Config de velocidad y precisión.
    travelMs = 1100 / speed;
    windowMs = Math.round(precision * 1000);

    // Estado inicial del recorrido.
    completedCount = 0; // ninguna flecha encendida al inicio
    activeIndex = 0;
    previousIndex = 0;
    nextIndex = 1;
    lineProgress = 0;
    lineActive = false;
    gameRunning = true;
    perfectCount = 0;
    goodCount = 0;
    startTime = performance.now();
    elapsedTime = 0;

    // Actualizar cabecera.
    statVertices.textContent = String(totalVertices);
    statCompleted.textContent = completedCount + ' / ' + totalVertices;
    statTime.textContent = '0.00s';

    // Mostrar pantalla de juego y arrancar.
    showScreen('game-screen');
    overlay.classList.add('hidden');

    // Pequeña pausa de preparación para que el jugador vea la figura.
    setTimeout(() => {
      if (!gameRunning) return;
      startLineTravel();
    }, 1200);

    sounds.tick();
  }

  /** Arranca el viaje de la línea desde previousIndex hacia nextIndex. */
  function startLineTravel() {
    if (!gameRunning) return;
    lineActive = true;
    lineProgress = 0;
  }

  /**
   * Maneja la pulsación del jugador.
   * @param {string} dir - 'up' | 'down' | 'left' | 'right'
   */
  function handleInput(dir) {
    if (!gameRunning || !lineActive) return;

    const targetDir = vertices[nextIndex].dir;

    // 1. Dirección incorrecta → fallo inmediato.
    if (dir !== targetDir) {
      failGame('Dirección incorrecta');
      return;
    }

    // 2. Calcular cuánto se aproxima a la llegada de la línea.
    //    El momento exacto de acierto es cuando la línea llega a
    //    maxProgress (se detiene a STOP_DISTANCE px del centro).
    const maxProgress = getMaxProgress();
    const delta = Math.abs(lineProgress - maxProgress);
    const deltaMs = delta * travelMs;

    if (deltaMs <= windowMs) {
      // ¡Preciso!
      const isPerfect = deltaMs <= windowMs * 0.35;
      if (isPerfect) perfectCount++;
      else goodCount++;

      // Encender la flecha objetivo.
      vertices[nextIndex].lit = true;
      completedCount++;

      if (isPerfect) {
        sounds.perfect();
        showFeedback('¡PERFECTO!', true);
      } else {
        sounds.good();
        showFeedback('¡Bien!', true);
      }

      statCompleted.textContent = completedCount + ' / ' + totalVertices;

      // Si todas las flechas están encendidas (incluida la primera, que
      // se enciende al final) → ¡circuito completo!
      if (completedCount === totalVertices) {
        winGame();
        return;
      }

      // Avanzar hacia el siguiente vértice sin encender.
      advanceRecorrido();
    } else if (lineProgress >= maxProgress) {
      // Pulsó tarde (la línea ya llegó y pasó).
      failGame('¡Muy tarde!');
    } else {
      // Pulsó demasiado pronto.
      failGame('¡Muy pronto!');
    }
  }

  /**
   * Avanza al siguiente vértice del recorrido.
   */
  function advanceRecorrido() {
    // Buscar el siguiente vértice sin encender, en orden cíclico.
    const from = nextIndex;
    let idx = (from + 1) % vertices.length;

    // Recorrer en orden hasta encontrar uno sin encender.
    // La primera flecha (índice 0) también puede ser seleccionada cuando
    // es la última que falta.
    while (vertices[idx].lit) {
      idx = (idx + 1) % vertices.length;
    }

    previousIndex = from;
    nextIndex = idx;
    lineActive = false;
    lineProgress = 0;

    // Pequeña pausa antes de que la línea arranque de nuevo.
    setTimeout(() => startLineTravel(), 250);
  }

  // ── Fin de partida ────────────────────────────────────────────────────
  function winGame() {
    gameRunning = false;
    lineActive = false;
    elapsedTime = (performance.now() - startTime) / 1000;
    sounds.win();

    // Calcular estrellas (3 máx) — ahora hay totalVertices pulsaciones
    // (incluida la última que enciende la primera flecha).
    const accuracy = (perfectCount + goodCount) / totalVertices;
    let stars = 1;
    if (accuracy >= 0.6) stars = 2;
    if (accuracy >= 0.9) stars = 3;

    showResult(true, elapsedTime, perfectCount, goodCount, stars);
  }

  function failGame(reason) {
    gameRunning = false;
    lineActive = false;
    elapsedTime = (performance.now() - startTime) / 1000;
    sounds.fail();
    showResult(false, elapsedTime, perfectCount, goodCount, 0, reason);
  }

  function showResult(won, time, perfect, good, stars, failReason) {
    const icon = $('result-icon');
    const title = $('result-title');
    const details = $('result-details');
    const starsEl = $('result-stars');

    if (won) {
      icon.textContent = '🏆';
      title.textContent = '¡Circuito completado!';
      details.textContent =
        'Tiempo: ' + time.toFixed(2) + 's · Perfectos: ' + perfect + ' · Buenos: ' + good;
    } else {
      icon.textContent = '💥';
      title.textContent = 'Cadena rota';
      details.textContent = (failReason || 'Fallaste') + ' · Tiempo: ' + time.toFixed(2) + 's';
    }

    // Estrellas.
    let starsHtml = '';
    if (won) {
      for (let i = 0; i < 3; i++) {
        starsHtml += i < stars ? '⭐' : '☆';
      }
    }
    starsEl.textContent = starsHtml;

    overlay.classList.remove('hidden');
  }

  // ── Bucle de animación ────────────────────────────────────────────────
  function animate(timestamp) {
    if (!gameRunning) {
      // Aún así dibujar una vez para que la figura se vea.
      drawFigure();
      return;
    }

    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const dt = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Actualizar el progreso de la línea.
    if (lineActive) {
      lineProgress += dt / travelMs;
      // La línea se detiene a STOP_DISTANCE px antes del centro del vértice.
      const maxProgress = getMaxProgress();
      if (lineProgress >= maxProgress) {
        lineProgress = maxProgress;
        // La línea llegó pero el jugador no pulsó a tiempo.
        failGame('¡Se te pasó la flecha!');
        return;
      }
    }

    // Actualizar tiempo.
    elapsedTime = (performance.now() - startTime) / 1000;
    statTime.textContent = elapsedTime.toFixed(2) + 's';

    drawFigure();
    animationId = requestAnimationFrame(animate);
  }

  // ── Inicialización de eventos ─────────────────────────────────────────
  function init() {
    // Botón comenzar.
    $('btn-start').addEventListener('click', () => {
      lastTimestamp = 0;
      startGame();
      if (animationId) cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(animate);
    });

    // Volver al menú desde el juego.
    $('btn-back').addEventListener('click', () => {
      gameRunning = false;
      if (animationId) cancelAnimationFrame(animationId);
      overlay.classList.add('hidden');
      showScreen('home-screen');
    });

    // Botones del overlay.
    $('btn-retry').addEventListener('click', () => {
      overlay.classList.add('hidden');
      $('btn-start').click();
    });
    $('btn-menu').addEventListener('click', () => {
      gameRunning = false;
      if (animationId) cancelAnimationFrame(animationId);
      overlay.classList.add('hidden');
      showScreen('home-screen');
    });

    // Teclado.
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const dir = KEY_MAP[key];
      if (!dir) return;
      e.preventDefault();
      handleInput(dir);
    });
  }

  // Arranque.
  document.addEventListener('DOMContentLoaded', init);

})();