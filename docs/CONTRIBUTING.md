# Guía de Contribución

¡Gracias por tu interés en contribuir a Minijuegos — Entrenador de Bots! Esta guía te ayudará a empezar.

## Tabla de Contenidos

1. [Código de Conducta](#código-de-conducta)
2. [Cómo Contribuir](#cómo-contribuir)
3. [Proceso de Desarrollo](#proceso-de-desarrollo)
4. [Estándares de Código](#estándares-de-código)
5. [Testing](#testing)
6. [Envío de Pull Requests](#envío-de-pull-requests)
7. [Reporte de Bugs](#reporte-de-bugs)
8. [Sugerencias de Features](#sugerencias-de-features)

---

## Código de Conducta

- **Respeto**: Trata a todos con respeto y profesionalidad
- **Inclusión**: Fomenta un ambiente inclusivo para todos los contribuidores
- **Colaboración**: Trabaja de forma constructiva con otros contribuidores
- **Comunicación**: Sé claro y directo en tus comunicaciones

---

## Cómo Contribuir

### Áreas de Contribución

- **Corrección de bugs**: Reporta y soluciona problemas existentes
- **Nuevos minijuegos**: Agrega nuevos módulos de entrenamiento cognitivo
- **Mejoras de UX/UI**: Mejora la experiencia de usuario y diseño
- **Documentación**: Mejora la documentación existente
- **Testing**: Agrega tests para mejorar la cobertura
- **Accesibilidad**: Mejora la accesibilidad del proyecto
- **Performance**: Optimiza el rendimiento de la aplicación
- **Sistemas v3.0.0**: Extiende o mejora los nuevos sistemas de gamificación, badges, notificaciones, transiciones, sonidos, accesibilidad, PWA y skeleton loading

### Primeros Pasos

1. **Fork el repositorio** en GitHub
2. **Clona tu fork** localmente:
   ```bash
   git clone https://github.com/tu-usuario/minijuegos-entrenador-bots.git
   cd minijuegos-entrenador-bots
   ```
3. **Instala dependencias**:
   ```bash
   npm install
   ```
4. **Inicia el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

---

## Proceso de Desarrollo

### Flujo de Trabajo

1. **Crea una rama** para tu contribución:
   ```bash
   git checkout -b feature/tu-feature-o-bugfix
   ```
   Usa prefijos descriptivos:
   - `feature/` para nuevas funcionalidades
   - `bugfix/` para correcciones de bugs
   - `docs/` para cambios en documentación
   - `test/` para cambios en tests
   - `refactor/` para refactorizaciones

2. **Realiza tus cambios** siguiendo los estándares de código

3. **Ejecuta tests**:
   ```bash
   npm run test:run
   npm run type-check
   ```

4. **Commitea tus cambios** con mensajes claros:
   ```bash
   git commit -m "feat: agregar nuevo minijuego de memoria"
   git commit -m "fix: corregir error en validación de input"
   ```

5. **Push a tu fork**:
   ```bash
   git push origin feature/tu-feature-o-bugfix
   ```

6. **Crea un Pull Request** en GitHub

---

## Estándares de Código

### TypeScript

- Usa TypeScript estricto
- Evita `any` (solo 3 usos documentados en el proyecto)
- Usa type guards en lugar de `as any`
- Mantén los tipos en `js/types/` cuando sean compartidos

### Convenciones

- **Comentarios**: Documentan el "por qué", no solo el "qué"
- **data-ui**: Usa `data-ui` en lugar de `id` para elementos de juego
- **Eventos custom**: Usa eventos custom para desacoplar módulos
- **Guards defensivos**: Usa `if (!elemento) return;` en lugar de `!`

### Formato

- Indentación: 2 espacios
- Comillas: Comillas simples
- Punto y coma: Sí
- Trailing commas: Sí en objetos y arrays multilínea

### Nombres

- **Archivos**: `kebab-case.ts` (ej: `gameBootstrap.ts`)
- **Clases**: `PascalCase` (ej: `GameRegistry`)
- **Funciones**: `camelCase` (ej: `initGame`)
- **Constantes**: `UPPER_SNAKE_CASE` (ej: `MAX_ROUNDS`)
- **Interfaces**: `PascalCase` (ej: `GameConfig`)

---

## Testing

### Tipos de Tests

- **Unit tests**: Prueban funciones individuales
- **Integration tests**: Prueban interacción entre módulos
- **E2E tests**: Prueban flujos completos de usuario (Playwright)

### Ejecutar Tests

```bash
# Unit tests (Vitest)
npm test              # modo watch
npm run test:run      # una sola pasada
npm run test:ui       # UI interactiva

# E2E tests (Playwright)
npm run test:e2e      # headless
npm run test:e2e:ui   # UI interactiva
npm run test:e2e:headed # con navegador visible
```

### Agregar Tests

- Todo nuevo minijuego debe tener tests
- Usa `dataUiIntegrity.test.ts` para verificar integración vista-lógica
- Agrega tests de accesibilidad para nuevos componentes

---

## Envío de Pull Requests

### Checklist antes de enviar

- [ ] Tests pasan (`npm run test:run`)
- [ ] Type check pasa (`npm run type-check`)
- [ ] Código sigue los estándares del proyecto
- [ ] Commits tienen mensajes claros
- [ ] Documentación actualizada si es necesario
- [ ] No hay console.log o debug code

### Plantilla de PR

```markdown
## Descripción
Breve descripción de los cambios realizados.

## Tipo de Cambio
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe cómo probaste tus cambios.

## Screenshots (si aplica)
Agrega screenshots para cambios visuales.

## Checklist
- [ ] Tests actualizados
- [ ] Documentación actualizada
- [ ] No breaking changes sin discusión previa
```

---

## Reporte de Bugs

### Antes de Reportar

1. **Busca issues existentes** para evitar duplicados
2. **Verifica si el bug persiste** en la última versión
3. **Reproduce el bug** consistentemente

### Plantilla de Bug Report

```markdown
## Título
Descripción corta del bug

## Descripción Detallada
Explica el bug en detalle.

## Pasos para Reproducir
1. Ve a '...'
2. Click en '....'
3. Scroll a '....'
4. Ve el error

## Comportamiento Esperado
Describe lo que debería pasar.

## Comportamiento Actual
Describe lo que realmente pasa.

## Capturas de Pantalla
Agrega capturas si aplica.

## Entorno
- OS: [ej: Windows 10, macOS 13]
- Navegador: [ej: Chrome 120, Firefox 121]
- Versión del proyecto: [ej: 2.6.0]

## Logs Relevantes
Agrega logs de consola si aplica.
```

---

## Sugerencias de Features

### Antes de Sugerir

1. **Busca issues existentes** para evitar duplicados
2. **Considera el alcance** del proyecto
3. **Piensa en la implementación** técnica

### Plantilla de Feature Request

```markdown
## Título
Descripción corta de la feature

## Descripción Detallada
Explica la feature en detalle.

## Problema que Soluciona
¿Qué problema actual resuelve esta feature?

## Solución Propuesta
Describe cómo debería funcionar.

## Alternativas Consideradas
Menciona alternativas que consideraste.

## Impacto
¿Cómo afecta esto al proyecto existente?

## Prioridad
- [ ] Alta
- [ ] Media
- [ ] Baja
```

---

## Recursos Adicionales

- [README.md](README.md) - Documentación principal
- [Arquitectura](README.md#arquitectura) - Detalles de arquitectura
- [Cómo agregar un minijuego](README.md#cómo-agregar-un-minijuego-nuevo) - Guía específica
- [Convenciones de código](README.md#convenciones-de-código) - Estándares del proyecto

---

## Contacto

Para preguntas o discusiones:
- Abre un issue en GitHub
- Únete a las discusiones del proyecto

---

## Licencia

Al contribuir, acuerdas que tus contribuciones serán licenciadas bajo la misma licencia que el proyecto (MIT).
