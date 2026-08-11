// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    // Carpetas generadas / no-fuente que nunca deben lintearse.
    ignores: [
      'dist/**',
      'dist-test-build-check/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'public/**',
      // Script k6 (JS plano, ejecutado por el runtime de k6 en CI, no
      // por tsc/vite) — no forma parte de ningún tsconfig del repo.
      'load-test/**',
      // Vestigio de un scaffold shadcn/ui: no está en ningún tsconfig,
      // no lo importa nada del proyecto (verificado con grep) y ni
      // siquiera compilaría — depende de '@base-ui/react/button', que
      // no está en package.json. Se excluye en vez de forzarlo a un
      // tsconfig al que no pertenece.
      'components/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      parserOptions: {
        // Habilita reglas type-aware (detectan floating promises,
        // misuse de promesas, etc.) usando el mismo tsconfig del proyecto.
        project: ['./tsconfig.json', './tsconfig.sw.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- Higiene de imports/variables ---
      // Este es el problema real que motivó agregar linting: imports
      // dinámicos/estáticos que quedan sin usar (ej. `escapeHtml` en
      // multiplayerSystem.ts) pasaban desapercibidos porque tsc con
      // `strict: false` no los marca como error.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // El proyecto ya usa `strictNullChecks` y `noImplicitAny` en
      // tsconfig, así que `any` explícito debería ser una excepción
      // consciente, no el default. Se deja como warning (no error)
      // para no romper CI de golpe sobre 52k líneas existentes.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Floating promises son un bug real y silencioso en código con
      // muchos `await import(...)` y llamadas a Supabase — si a alguien
      // se le olvida el `await`, esto lo atrapa.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // No bloquear sobre el estilo de `interface` vs `type`, eso es
      // gusto del equipo, no un bug.
      '@typescript-eslint/consistent-type-definitions': 'off',

      // console.log es aceptable en un proyecto sin backend propio,
      // pero console.error/warn deberían ser intencionales, no ruido.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Errores clásicos de JS que sí queremos bloquear siempre.
      eqeqeq: ['error', 'smart'],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },

  // Los tests toleran más: mocks con `any`, asserts sueltos, etc.
  {
    files: ['test/**/*.ts', 'e2e/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // El service worker corre en su propio scope global (self, caches,
  // etc.), no en el DOM — no debería activar reglas pensadas para
  // código de browser normal.
  {
    files: ['sw.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.sw.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // sw.ts compila aislado (isolatedModules, tsconfig.sw.json propio)
      // y no puede importar devLog sin romper ese aislamiento. Sus
      // console.log son trazas de ciclo de vida (install/activate/cache)
      // útiles para depurar problemas de caché real en producción desde
      // devtools — no son ruido de desarrollo como en el resto del app.
      'no-console': 'off',
    },
  },

  // e2e/ (specs de Playwright + su script de build) y este mismo
  // archivo de config no están cubiertos por tsconfig.json ni
  // tsconfig.sw.json (Playwright resuelve sus propios tipos aparte).
  // Sin un tsconfig real que los incluya, las reglas type-aware
  // (no-floating-promises, no-misused-promises) no pueden evaluarse
  // ahí — se limitan a las reglas sintácticas (no type-aware), que
  // siguen cubriendo unused-vars, no-var, eqeqeq, etc.
  {
    files: ['e2e/**/*.ts', 'e2e/**/*.mjs', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },

  // Desactiva reglas de estilo que puedan chocar con un futuro Prettier,
  // sin forzar Prettier ahora mismo.
  eslintConfigPrettier
);
