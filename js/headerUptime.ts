/**
 * js/headerUptime.ts
 *
 * Reloj de "uptime" y latencia simulada del header.
 * Migrado desde el <script> inline en index.html a un módulo ES,
 * consistente con el resto de la app (main.ts).
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function initHeaderUptime(): void {
  const start = Date.now();
  const uptimeEl = document.getElementById('headerUptime');
  const hexEl = document.getElementById('hexTickMeta');
  const latEl = document.getElementById('headerLatency');

  function tick() {
    const s = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (uptimeEl) uptimeEl.textContent = `${pad(h)}:${pad(m)}:${pad(sec)}`;
    if (hexEl) hexEl.textContent = (s * 7 + 1000).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  }

  tick();
  setInterval(tick, 1000);

  if (latEl) {
    setInterval(() => {
      latEl.textContent = `${9 + Math.floor(Math.random() * 8)}ms`;
    }, 4000);
  }
}

initHeaderUptime();
