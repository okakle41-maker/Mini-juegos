import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Solo Chromium. Firefox/WebKit/Mobile generaban timeouts
  // intermitentes por la infraestructura del propio arnés de e2e
  // (contención de red al arrancar 5 navegadores contra un único
  // servidor, más el margen de tiempo real que necesita cada motor
  // bajo carga) y no por bugs reales de la app — confirmado tras
  // varias rondas de diagnóstico. Mantener 5 motores solo para un
  // lobby, con ese costo de mantenimiento, no pagaba su lugar. Si más
  // adelante aparece un bug reportado específico de Safari/Firefox,
  // reagregar el proyecto puntual para reproducirlo es más barato que
  // sostener los cinco todo el tiempo.
  workers: 2,
  timeout: 45000,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // IMPORTANTE: e2e corre contra el build de producción (vite build
    // + vite preview), no contra el dev server (`vite`/npm run dev).
    // El dev server sirve cientos de módulos .ts individuales sin
    // bundlear vía HTTP; bajo la carga concurrente de 5 navegadores
    // pidiendo esos módulos a la vez, Firefox y WebKit —más
    // conservadores que Chromium negociando muchas conexiones
    // HTTP/1.1 paralelas al mismo origen— pueden tardar lo suficiente
    // como para que page.goto o la primera pintura de #gameList
    // superen el timeout, incluso sin ningún bug en la app. El build
    // de preview sirve unos pocos chunks ya bundleados y minificados,
    // eliminando esa fuente de lentitud estructural en vez de solo
    // subir timeouts (que sería tratar el síntoma).
    // VITE_BASE=/ (aplicado por el script e2e/build-for-e2e.mjs, ver
    // ese archivo para el motivo de resolverlo así en vez de una env
    // var inline) fuerza a que el build se sirva en la raíz del
    // puerto de preview, no en /Mini-juegos/ (el base real usado en
    // producción para GitHub Pages, ver vite.config.ts). Sin esto,
    // `vite preview` serviría la app en
    // http://localhost:3000/Mini-juegos/ mientras que playwright.config
    // usa baseURL 'http://localhost:3000' y los specs navegan con
    // page.goto('/') — page.goto encontraría la carpeta vacía y
    // fallaría de una forma mucho más confusa que un simple 404 (Vite
    // preview devuelve el index.html en la raíz igual por su fallback
    // de SPA, pero con todas las rutas de assets rotas apuntando a
    // /Mini-juegos/assets/... que no existe en ese path — otra fuente
    // de "todo parece cargar pero nada funciona" distinta a la que ya
    // se investigó, y fácil de confundir con ella).
    command: 'node ./e2e/build-for-e2e.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
