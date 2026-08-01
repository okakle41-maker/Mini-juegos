# Guía de Testing de Accesibilidad con Lectores de Pantalla

Esta guía proporciona instrucciones para realizar testing manual de accesibilidad con lectores de pantalla reales: NVDA (Windows), JAWS (Windows) y VoiceOver (macOS/iOS).

**Versión del proyecto:** 3.0.0
**Sistema de accesibilidad mejorado:** js/accessibilitySystem.ts

## Tabla de Contenidos

1. [Preparación](#preparación)
2. [Testing con NVDA (Windows)](#testing-con-nvda-windows)
3. [Testing con JAWS (Windows)](#testing-con-jaws-windows)
4. [Testing con macOS](#testing-con-macos)
5. [Testing con iOS](#testing-con-ios)
6. [Escenarios de Testing](#escenarios-de-testing)
7. [Features de Accesibilidad v3.0.0](#features-de-accesibilidad-v300)
8. [Problemas Comunes](#problemas-comunes)
9. [Reporte de Resultados](#reporte-de-resultados)

---

## Preparación

### Software Requerido

**Windows:**
- NVDA (Gratis): https://www.nvaccess.org/download/
- JAWS (Prueba): https://www.freedomscientific.com/products/software/jaws/

**macOS:**
- VoiceOver (Integrado): Cmd + F5 para activar

**iOS:**
- VoiceOver (Integrado): Configuración > Accesibilidad > VoiceOver

### Entorno de Testing

1. **Perfil de Navegador Limpio**: Usa un perfil de navegador nuevo sin extensiones
2. **Configuración por Defecto**: Restablece el lector de pantalla a la configuración por defecto
3. **Desactivar Animaciones**: Desactiva las animaciones CSS durante el testing
4. **Modo de Alto Contraste**: Prueba con alto contraste activado

---

## Testing con NVDA (Windows)

### Instalación

1. Descarga NVDA desde https://www.nvaccess.org/download/
2. Instala con la configuración por defecto
3. Inicia NVDA (Ctrl + Alt + N)

### Comandos de Teclado

| Comando | Acción |
|----------|--------|
| NVDA + Q | Cerrar NVDA |
| NVDA + Ctrl + K | Leer elemento actual |
| NVDA + Tab | Leer elemento enfocado |
| NVDA + B | Leer ventana actual |
| NVDA + T | Leer título |
| NVDA + F2 | Alternar modo de voz |
| NVDA + S | Activar/desactivar voz |
| NVDA + Ctrl + D | Leer formato del documento |
| NVDA + F7 | Lista de elementos |
| NVDA + F8 | Lista de objetos |

### Procedimiento de Testing

1. **Navegar al Lobby**
   - Presiona NVDA + Tab para navegar entre elementos
   - Verifica que cada tarjeta de juego se anuncie correctamente
   - Verifica que los nombres y descripciones de juegos sean legibles

2. **Navegar a un Juego**
   - Selecciona un juego y presiona Enter
   - Verifica que la vista del juego se anuncie
   - Verifica que los controles del juego sean accesibles

3. **Probar Controles del Juego**
   - Navega entre elementos del juego con Tab
   - Verifica que los botones tengan etiquetas apropiadas
   - Verifica que los cambios de estado del juego se anuncien

4. **Probar Navegación por Teclado**
   - Usa Tab, Shift+Tab, teclas de flecha
   - Verifica que el orden del foco sea lógico
   - Verifica que el foco sea visible

---

## Testing con JAWS (Windows)

### Instalación

1. Descarga la prueba de JAWS desde https://www.freedomscientific.com/products/software/jaws/
2. Instala con la configuración por defecto
3. Inicia JAWS (Insert + J)

### Comandos de Teclado

| Comando | Acción |
|----------|--------|
| Insert + J | Ventana de JAWS |
| Insert + Q | Cerrar JAWS |
| Insert + Tab | Leer elemento enfocado |
| Insert + B | Leer ventana actual |
| Insert + T | Leer título |
| Insert + F2 | Alternar modo de voz |
| Insert + S | Activar/desactivar voz |
| Insert + F7 | Lista de elementos |
| Insert + F8 | Lista de objetos |

### Procedimiento de Testing

Sigue el mismo procedimiento que el testing con NVDA, usando los comandos específicos de JAWS.

---

## Testing con macOS

### Activar VoiceOver

1. Abre Preferencias del Sistema > Accesibilidad > VoiceOver
2. Marca "Activar VoiceOver"
3. O usa el atajo de teclado: Cmd + F5

### Comandos de Teclado

| Comando | Acción |
|----------|--------|
| Cmd + F5 | Activar/desactivar VoiceOver |
| VO + Q | Cerrar VoiceOver |
| VO + A | Leer todo |
| VO + Shift + A | Leer desde el cursor |
| VO + C | Leer elemento actual |
| VO + U | Rotor |
| VO + ] | Siguiente elemento |
| VO + [ | Elemento anterior |
| VO + Shift + ] | Siguiente encabezado |
| VO + Shift + [ | Encabezado anterior |
| VO + Shift + ; | Interactuar con elemento |

### Procedimiento de Testing

1. **Navegar al Lobby**
   - Usa VO + ] para navegar entre elementos
   - Usa el rotor (VO + U) para navegar por encabezados, botones, etc.
   - Verifica que cada tarjeta de juego se anuncie correctamente

2. **Navegar a un Juego**
   - Selecciona un juego con VO + Espacio
   - Verifica que la vista del juego se anuncie
   - Verifica que los controles del juego sean accesibles

3. **Probar Controles del Juego**
   - Navega entre elementos del juego con VO + ]
   - Verifica que los botones tengan etiquetas apropiadas
   - Verifica que los cambios de estado del juego se anuncien

---

## Testing con iOS

### Activar VoiceOver

1. Abre Configuración > Accesibilidad > VoiceOver
2. Activa VoiceOver
3. Triple clic en el botón lateral para activar/desactivar (si está configurado)

### Comandos de Táctil

| Comando | Acción |
|----------|--------|
| Triple clic | Activar/desactivar VoiceOver |
| Tocar simple | Seleccionar elemento |
| Tocar doble | Activar elemento |
| Deslizar izquierda/derecha | Navegar elementos |
| Deslizar arriba/abajo | Cambiar rotor |
| Tocar con dos dedos | Leer pantalla |
| Deslizar hacia arriba con dos dedos | Leer desde arriba |

### Procedimiento de Testing

1. **Navegar al Lobby**
   - Desliza a la derecha para navegar entre elementos
   - Usa el rotor para navegar por encabezados, botones, etc.
   - Verifica que cada tarjeta de juego se anuncie correctamente

2. **Navegar a un Juego**
   - Toca dos veces para seleccionar un juego
   - Verifica que la vista del juego se anuncie
   - Verifica que los controles del juego sean accesibles

3. **Probar Controles del Juego**
   - Navega entre elementos del juego con deslizamiento
   - Verifica que los botones tengan etiquetas apropiadas
   - Verifica que los cambios de estado del juego se anuncien

---

## Escenarios de Testing

### Escenario 1: Navegación del Lobby

**Pasos de Testing:**
1. Navega al lobby
2. Lista todas las tarjetas de juegos
3. Verifica que cada tarjeta anuncie: nombre del juego, descripción, dificultad
4. Navega a los controles de filtro
5. Verifica que los filtros se anuncien y sean usables

**Resultados Esperados:**
- Todas las tarjetas de juegos se anuncian con etiquetas apropiadas
- Los controles de filtro son accesibles y anuncian su estado
- El orden del foco es lógico

### Escenario 2: Selección de Juego

**Pasos de Testing:**
1. Navega a una tarjeta de juego específica
2. Activa el juego
3. Verifica que la vista del juego se anuncie
4. Verifica que las instrucciones del juego sean legibles

**Resultados Esperados:**
- La vista del juego se anuncia con título
- Las instrucciones son legibles
- Los controles del juego son accesibles

### Escenario 3: Controles del Juego

**Pasos de Testing:**
1. Navega entre los controles del juego
2. Verifica que cada botón tenga una etiqueta
3. Activa los botones y verifica el feedback
4. Verifica que los cambios de estado del juego se anuncien

**Resultados Esperados:**
- Todos los botones tienen etiquetas apropiadas
- Las acciones proporcionan feedback de audio
- Los cambios de estado se anuncian

### Escenario 4: Navegación por Teclado

**Pasos de Testing:**
1. Navega usando Tab, Shift+Tab
2. Verifica que el orden del foco sea lógico
3. Verifica que el foco sea visible
4. Prueba la tecla Escape para volver al lobby

**Resultados Esperados:**
- El orden del foco sigue el diseño visual
- El foco es claramente visible
- La tecla Escape funciona como se espera

### Escenario 5: Modo de Alto Contraste

**Pasos de Testing:**
1. Activa el modo de alto contraste
2. Navega por la aplicación
3. Verifica que todos los elementos sean legibles
4. Verifica que los colores cumplan con los estándares WCAG AA

**Resultados Esperados:**
- Todo el texto es legible
- Los elementos interactivos son claramente visibles
- El contraste de color cumple con los estándares

---

## Features de Accesibilidad v3.0.0

### Sistema de Accesibilidad Mejorado

El proyecto v3.0.0 incluye un sistema de accesibilidad completo en `js/accessibilitySystem.ts` con las siguientes características:

#### Navegación por Teclado
- Atajos globales configurables
- Skip links para contenido principal
- Navegación por headings con Alt+Shift+H
- Indicadores de focus mejorados y visibles

#### Modos de Contraste
- **Normal**: Contraste estándar
- **High**: Alto contraste para baja visión
- **Increased**: Contraste aumentado

#### Tamaños de Texto
- Small, Normal, Large, Extra-Large

#### Modos de Daltonismo
- None, Protanopia, Deuteranopia, Tritanopia, Achromatopsia

#### ARIA Live Regions
- Regiones polite para anuncios informativos
- Regiones assertive para anuncios críticos
- Método `announce()` para anuncios dinámicos

#### Focus Management
- Focus trap para modales y diálogos
- Manejo de foco visible (teclado vs mouse)
- Release focus automático

#### Presets de Accesibilidad
- **High Contrast**: Alto contraste + texto grande
- **Low Vision**: Contraste aumentado + texto extra grande
- **Motor Impairment**: Navegación por teclado + reduced motion

### Testing de Features v3.0.0

#### Test de Skip Links
1. Presiona Alt+Shift+N para saltar al contenido principal
2. Verifica que el foco se mueva al contenido principal
3. Verifica que el lector de pantalla anuncie el skip link

#### Test de Modos de Contraste
1. Activa modo high contrast: `window.Minijuegos.accessibilitySystem.setContrastMode('high')`
2. Verifica que los colores tengan suficiente contraste
3. Verifica que el texto sea legible

#### Test de Tamaños de Texto
1. Cambia tamaño de texto: `window.Minijuegos.accessibilitySystem.setTextSize('large')`
2. Verifica que el texto sea legible
3. Verifica que no haya overflow horizontal

#### Test de ARIA Live Regions
1. Dispara un logro: `window.Minijuegos.badgeSystem.unlockBadge('first_win')`
2. Verifica que el lector de pantalla anuncie el logro
3. Verifica que el anuncio sea claro y descriptivo

#### Test de Focus Trap
1. Abre un modal
2. Verifica que el foco esté atrapado dentro del modal
3. Verifica que Tab/Shift+Tab navegue solo dentro del modal

---

## Problemas Comunes

### Etiquetas ARIA Faltantes

**Síntoma:** El elemento se anuncia como "botón" o "enlace" sin contexto

**Solución:** Agrega `aria-label` o `aria-labelledby`

### Foco No Visible

**Síntoma:** El usuario no puede ver dónde está el foco

**Solución:** Agrega un indicador de foco visible con CSS

### Sin Actualizaciones de Live Region

**Síntoma:** Los cambios de contenido dinámico no se anuncian

**Solución:** Usa `aria-live="polite"` o `aria-live="assertive"`

### Orden Incorrecto de Encabezados

**Síntoma:** Los niveles de encabezado no siguen un orden lógico

**Solución:** Usa la jerarquía de encabezados apropiada (h1, h2, h3, etc.)

### Texto Alt Faltante

**Síntoma:** Las imágenes se anuncian como "imagen" sin descripción

**Solución:** Agrega texto `alt` descriptivo

---

## Reporte de Resultados

### Plantilla de Reporte de Testing

```markdown
## Reporte de Testing con Lector de Pantalla

**Fecha:** [Fecha]
**Tester:** [Nombre]
**Lector de Pantalla:** [NVDA/JAWS/VoiceOver]
**SO:** [Windows/macOS/iOS]
**Navegador:** [Chrome/Firefox/Safari]

### Resultados del Testing

| Escenario | Estado | Notas |
|----------|--------|-------|
| Navegación del Lobby | Aprobado/Falló | [Notas] |
| Selección de Juego | Aprobado/Falló | [Notas] |
| Controles del Juego | Aprobado/Falló | [Notas] |
| Navegación por Teclado | Aprobado/Falló | [Notas] |
| Modo de Alto Contraste | Aprobado/Falló | [Notas] |

### Problemas Encontrados

1. [Descripción del problema]
   - Ubicación: [Dónde]
   - Severidad: [Crítico/Mayor/Menor]
   - Solución sugerida: [Solución]

### Recomendaciones

[Recomendaciones generales para mejora]
```

### Niveles de Severidad

- **Crítico**: Bloquea a los usuarios de completar tareas principales
- **Mayor**: Impacta significativamente la usabilidad pero existen soluciones alternativas
- **Menor**: Inconveniente menor o molestia

---

## Mejores Prácticas

1. **Testear Temprano y Frecuentemente**: Integra el testing de accesibilidad en el flujo de desarrollo
2. **Testear con Múltiples Lectores de Pantalla**: Diferentes lectores se comportan de manera diferente
3. **Testear con Usuarios Reales**: Nada supera el testing con usuarios reales de lectores de pantalla
4. **Documentar Todo**: Mantén registros detallados de los resultados del testing
5. **Priorizar Problemas**: Enfócate en los problemas críticos y mayores primero

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [NVDA Documentation](https://www.nvaccess.org/documentation/)
- [JAWS Documentation](https://www.freedomscientific.com/Training/JAWS)
- [VoiceOver User Guide](https://www.apple.com/accessibility/voiceover/)
