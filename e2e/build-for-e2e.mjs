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
//
// `--host`: sin esto, vite preview solo escucha en localhost con UN
// SOLO stack de IP (el log lo confirma: "Network: use --host to
// expose"). En el job de k6 (CI), el binario nativo de k6 y este
// proceso de vite corren como procesos de sistema separados en el
// mismo runner — el server sí está arriba (se ve como "orphan
// process" al final del job) pero si Vite bindeó solo IPv4 (127.0.0.1)
// y el cliente k6 resuelve "localhost" a IPv6 (::1) primero (o
// viceversa), la conexión es rechazada al instante: exactamente el
// "connect: connection refused" que ve k6 en el 100% de sus 3.4M+
// requests, aunque wait-on ya haya confirmado el puerto abierto antes
// (wait-on pudo haber usado el mismo stack de IP que sí escuchaba).
// `--host` hace bind en 0.0.0.0 (todas las interfaces IPv4) y evita
// este mismatch sin importar a qué IP resuelva "localhost" en cada
// proceso.
const { spawn } = await import('node:child_process');
const args = ['vite', 'preview', '--port', '3000', '--host'];
const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_BASE: '/' }
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
