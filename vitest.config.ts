import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Incluye .tsx además de .js/.ts: con la migración a Preact en marcha
    // (ver js/components/*.tsx), un futuro test que renderice un
    // componente directamente (p.ej. con @testing-library/preact) va a
    // vivir en un archivo .tsx — sin esta extensión acá, Vitest lo
    // ignoraría en silencio (no aparece como "0 tests", simplemente el
    // archivo nunca se recoge, así que un CI en verde no lo detecta).
    include: ['test/**/*.test.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        'audio/',
        'assets/',
        'css'
      ]
    }
  }
});
