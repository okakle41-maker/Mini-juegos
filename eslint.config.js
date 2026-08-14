// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

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
      // components/ui/**: scaffolding de shadcn/ui fuera del árbol
      // `js/` real del proyecto (depende de '@base-ui/react/button' y
      // del alias '@/lib/utils', ninguno de los dos configurado acá).
      // No está cubierto por el `include` de tsconfig.json ni
      // importado por ningún archivo del proyecto — lintearlo con
      // parserOptions.project rompe con "file not found in any of the
      // provided project(s)" porque, con razón, no pertenece a
      // ningún proyecto TS del repo.
      'components/**',
      // Script k6 (JS plano, ejecutado por el runtime de k6 en CI, no
      // por tsc/vite) — no forma parte de ningún tsconfig del repo.
      'load-test/**',
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

  // Componentes Preact (migración incremental, ver docs/ARCHITECTURE.md
  // y los comentarios de "Fase N de la migración a Preact" en
  // js/components/*.tsx y js/lobbyRenderer.tsx / js/accountView.tsx).
  //
  // Solo las dos reglas clásicas y estables del plugin, NO el config
  // 'recommended-latest' completo: esa variante (desde la v7 del
  // plugin) trae además un conjunto de reglas pensadas para el React
  // Compiler (react-hooks/purity, immutability, set-state-in-render,
  // static-components, etc.) que asumen que el código va a pasar por
  // ese compilador — este proyecto usa Preact sin ningún compilador de
  // memoización automática, así que esas reglas dispararían falsos
  // positivos contra patrones perfectamente válidos en Preact plano.
  //
  // - rules-of-hooks: valida que los hooks (useState/useEffect, ver
  //   HeaderUserBadge.tsx) se llamen solo en el nivel superior de un
  //   componente/hook, nunca dentro de condicionales, loops o funciones
  //   anidadas. Preact reexporta la misma implementación de hooks que
  //   React internamente, así que la regla aplica sin cambios.
  // - exhaustive-deps: valida el array de dependencias de useEffect —
  //   el tipo de bug que es fácil de introducir a mano y que rompe la
  //   sincronización con eventos externos (ver el listener doble de
  //   'auth:changed'/'customization:avatar_changed' en
  //   HeaderUserBadge.tsx, exactamente el patrón que esta regla vigila).
  {
    files: ['js/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
