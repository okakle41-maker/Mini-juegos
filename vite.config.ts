import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync, mkdirSync, cpSync } from 'fs';
import preact from '@preact/preset-vite';

/**
 * `css/`, `assets/` y `audio/` se referencian desde JS como rutas string
 * planas ("css/bombdefusal.css", "assets/icons/circle.svg",
 * "audio/bg_level-iii.mp3" — ver `css` en GameConfig, renderCube() en
 * views/skillchecks.ts, y TRACKS en musicPlayer.ts), no como
 * `import './foo.css'`. Vite solo copia al build lo que reconoce como
 * asset importado o lo que vive dentro de `publicDir` — con la
 * configuración anterior (sin publicDir explícito, ambas carpetas en la
 * raíz del proyecto en vez de dentro de public/) ninguna de las dos
 * sobrevivía a `vite build`: en dev funcionaban porque `root: '.'`
 * expone todo el filesystem del proyecto, pero en `dist/` sencillamente
 * no estaban — un `<link>`/`<img>` a esas rutas en producción cae en el
 * fallback SPA de Vite y devuelve index.html con Content-Type: text/html
 * en vez de un 404 limpio, lo que además hace el bug invisible a un
 * curl rápido si no se mira el Content-Type de la respuesta.
 *
 * Se copian a mano con un plugin liviano en vez de moverlas dentro de
 * public/, para no reescribir los ~40 sitios que ya referencian estas
 * rutas relativas al root del proyecto.
 */
function copyStaticAssets() {
  let outDir = 'dist';
  return {
    name: 'copy-css-and-assets',
    // outDir puede venir sobreescrito por --outDir en la CLI (como hace
    // test/buildStaticAssets.test.ts para no pisar un dist/ real que el
    // desarrollador pueda tener abierto en `vite preview`) — leerlo acá
    // en vez de asumir 'dist' a mano evita que el plugin copie a un
    // directorio que no es el que Vite realmente terminó usando.
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      for (const dir of ['css', 'assets', 'audio']) {
        const src = resolve(import.meta.dirname, dir);
        const dest = resolve(import.meta.dirname, outDir, dir);
        if (!existsSync(src)) continue;
        mkdirSync(dest, { recursive: true });
        cpSync(src, dest, { recursive: true });
      }
    }
  };
}

// GitHub Pages (único destino de deploy de este proyecto, ver
// .github/workflows/deploy.yml) sirve el sitio en un subpath
// (https://usuario.github.io/Mini-juegos/), no en la raíz del dominio.
// Sin `base`, Vite genera todas las rutas de assets asumiendo raíz
// ('/'), lo que rompe CSS/JS/imágenes en producción aunque funcione
// perfecto en local (localhost sí es la raíz).
// VITE_BASE permite fijar el subpath real desde deploy.yml sin tocar
// este archivo — debe coincidir exactamente con el nombre del repo en
// GitHub (ver el step "Build" en .github/workflows/deploy.yml).
const base = process.env.VITE_BASE || '/Mini-juegos/';

export default defineConfig({
  root: '.',
  base,
  plugins: [copyStaticAssets(), preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separar módulos core de los juegos
          if (id.includes('/js/core/')) {
            return 'core';
          }
          // Separar managers
          if (id.includes('/js/') && 
              (id.includes('leaderboardManager') || 
               id.includes('favoritesManager') || 
               id.includes('audioManager') || 
               id.includes('backgroundManager'))) {
            return 'managers';
          }
          // Separar bootstrap
          if (id.includes('gameBootstrap') || 
              id.includes('/js/app.') || 
              id.includes('transitions') || 
              id.includes('sidebarViews')) {
            return 'bootstrap';
          }
          // Separar juegos individuales — EXCEPTO los módulos *.logic.ts
          // (lógica pesada cargada vía import() dinámico, ver
          // GameConfig.logic en core/gameRegistry.ts): si cayeran aquí
          // también, Rollup los metería en el mismo chunk estático
          // 'games' y el import() dinámico dejaría de servir para nada
          // — el chunk lazy nunca se separaría del resto. Al no
          // asignarles manualChunks, Rollup vuelve a su comportamiento
          // por defecto: cada import() dinámico obtiene su propio chunk.
          if (id.includes('/js/games/') && !id.endsWith('.logic.ts')) {
            return 'games';
          }
          // Sin match: undefined explícito = "usa el chunking por
          // defecto de Rollup" para este módulo, exactamente el mismo
          // comportamiento que el fallthrough implícito de antes —
          // noImplicitReturns solo exige que quede explícito.
          return undefined;
        },
        // El SDK de Supabase (cargado vía import() dinámico en
        // supabaseClient.ts, ver ese archivo para el detalle completo
        // de por qué no usa manualChunks) recibía por defecto un nombre
        // de chunk genérico sin sentido (dist-[hash].js) porque Rollup
        // nombra los chunks lazy según su módulo de entrada, y el
        // "módulo de entrada" de un import('@supabase/supabase-js') es
        // el propio paquete de node_modules, no algo bajo /js/. Se
        // detecta ese caso por el contenido real del chunk
        // (moduleIds incluye algún path de @supabase/) y se le da un
        // nombre reconocible — puramente cosmético (no cambia qué se
        // separa de qué, ni cuándo se descarga cada chunk), pero hace
        // mucho más fácil identificar ese chunk en el Network tab del
        // navegador o en la salida de `npm run build`.
        chunkFileNames: (chunkInfo) => {
          const isSupabaseChunk = chunkInfo.moduleIds.some((id) => id.includes('/node_modules/@supabase/'));
          if (isSupabaseChunk) {
            return 'assets/vendor-supabase-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        // Antes drop_console:false conservaba TODO console.* en
        // producción a propósito, porque no había forma de distinguir
        // "traza de debug ruidosa" de "error real que sí queremos ver
        // en la consola de un usuario". Desde que existe
        // js/core/devLog.ts (devLog/devWarn, gateados por
        // import.meta.env.DEV y ya eliminados del bundle por Vite en
        // build), esa distinción ya la hace el propio código fuente —
        // esto es solo una red de seguridad adicional: si algún
        // console.log/info se cuela sin pasar por devLog, Terser lo
        // quita igual. console.error/warn NO están en esta lista a
        // propósito: son la señal real que un desarrollador necesita
        // ver al debuggear un problema reportado por un usuario en
        // producción (ver los 9 console.error/warn reales del proyecto,
        // p.ej. fallos de Service Worker, elementos de UI faltantes).
        drop_console: ['log', 'info'],
        drop_debugger: true
      }
    },
    sourcemap: true,
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  preview: {
    port: 3000
  },
  assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.ogg', '**/*.png', '**/*.jpg', '**/*.svg']
});
