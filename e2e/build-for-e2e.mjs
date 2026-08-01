// e2e/build-for-e2e.mjs
//
// Build específico para los tests e2e de Playwright. Idéntico a
// `npm run build`, pero forzando VITE_BASE=/ en vez del /Mini-juegos/
// real de producción (ver vite.config.ts) — el servidor de preview
// que usa Playwright corre en http://localhost:3000 y los specs
// navegan con page.goto('/'), así que la app tiene que servirse desde
// la raíz del puerto, no desde un subpath.
//
// Se escribe como script de Node (en vez de `VITE_BASE=/ vite build`
// inline en package.json) porque esa sintaxis de asignación de env
// var solo funciona en shells POSIX — rompe en PowerShell/cmd de
// Windows sin el paquete cross-env, que este proyecto no tiene entre
// sus dependencias. spawnSync con `env` explícito es portable sin
// agregar una dependencia nueva solo para esto.

import { spawnSync } from 'node:child_process';

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_BASE: '/' }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('npx', ['vite', 'build']);
run('npm', ['run', 'build:sw']);

// `vite preview` vuelve a evaluar vite.config.ts en su propio
// proceso al arrancar — no reutiliza el VITE_BASE con el que se hizo
// el build anterior. Sin pasarlo también acá, el preview serviría
// en /Mini-juegos/ otra vez (leyendo el fallback de vite.config.ts)
// aunque el dist/ generado arriba ya tenga sus assets en la raíz,
// resultando en una respuesta 302 que Playwright no sigue como
// espera page.goto('/').
const { spawn } = await import('node:child_process');
const args = ['vite', 'preview', '--port', '3000'];
const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_BASE: '/' }
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
