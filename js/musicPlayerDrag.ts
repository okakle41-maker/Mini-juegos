/**
 * musicPlayerDrag.ts — Permite arrastrar los widgets flotantes del
 * reproductor de música: el panel expandido (#musicPlayer, arrastrado
 * desde su header .mp-head) y el botón ♪ colapsado (#musicPlayerFab,
 * arrastrado desde sí mismo). Son dos elementos distintos (ver
 * musicPlayer.ts) que se muestran de a uno por vez, así que cada uno
 * necesita su propia instancia de este drag genérico.
 */

function makeDraggable(element: HTMLElement, handle: HTMLElement): void {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  // Umbral en píxeles: por debajo de esto, un mousedown+mouseup se
  // sigue tratando como click (p.ej. para expandir el FAB), no como
  // arrastre — un mouse algo tembloroso no debería bloquear el click.
  const MOVE_THRESHOLD = 4;

  function getPos(): { left: number; top: number } {
    const r = element.getBoundingClientRect();
    return { left: r.left, top: r.top };
  }

  function applyPos(left: number, top: number): void {
    // Keep inside viewport
    const w = element.offsetWidth;
    const h = element.offsetHeight;
    left = Math.max(0, Math.min(left, window.innerWidth - w));
    top = Math.max(0, Math.min(top, window.innerHeight - h));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.bottom = 'auto';
    element.style.right = 'auto';
  }

  // Mouse
  handle.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    const pos = getPos();
    origLeft = pos.left;
    origTop = pos.top;
    startX = e.clientX;
    startY = e.clientY;
    element.style.transition = 'border-color 0.2s, box-shadow 0.2s';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      moved = true;
      element.dataset.dragMoved = 'true';
    }
    applyPos(origLeft + dx, origTop + dy);
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    // Se limpia en el próximo tick, no de inmediato: el listener
    // 'click' del propio handle se dispara justo después de 'mouseup'
    // (mismo gesto), y necesita poder leer dragMoved todavía en 'true'.
    if (moved) setTimeout(() => delete element.dataset.dragMoved, 0);
  });

  // Touch
  handle.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      const t = e.touches[0];
      dragging = true;
      moved = false;
      const pos = getPos();
      origLeft = pos.left;
      origTop = pos.top;
      startX = t.clientX;
      startY = t.clientY;
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
        moved = true;
        element.dataset.dragMoved = 'true';
      }
      applyPos(origLeft + dx, origTop + dy);
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener('touchend', () => {
    dragging = false;
    if (moved) setTimeout(() => delete element.dataset.dragMoved, 0);
  });
}

function initMusicPlayerDrag(): void {
  const player = document.getElementById('musicPlayer');
  const playerHandle = player?.querySelector<HTMLElement>('.mp-head');
  if (player && playerHandle) makeDraggable(player, playerHandle);

  const fab = document.getElementById('musicPlayerFab');
  if (fab) makeDraggable(fab, fab);
}

initMusicPlayerDrag();

export {};
