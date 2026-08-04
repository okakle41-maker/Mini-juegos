# 🎯 Rhythm Arrows

Minijuego de **ritmo y precisión** — seguí el recorrido de una línea verde por una figura geométrica y pulsá la flecha correcta en el momento exacto.

> **No es un juego de velocidad pura, sino de sincronización perfecta.** Un jugador rápido pero con mal tempo cometerá errores, mientras que un jugador con buen sentido del ritmo podrá completar recorridos complejos incluso a altas velocidades.

---

## ⭐ Concepto

- Las flechas no aparecen aleatoriamente: forman una **figura geométrica** conectada mediante líneas.
- Una **línea verde** avanza automáticamente entre vértices.
- Debes pulsar la tecla de la flecha **exactamente** cuando la línea la alcanza.
- Cada acierto enciende la flecha en verde.
- El recorrido continua hasta **visitar todas las flechas y volver al punto de inicio**, cerrando el circuito.

## 🎮 Mecánica

| Pulsación | Resultado |
|-----------|-----------|
| ✅ Dirección correcta + tiempo preciso | La flecha se ilumina en verde y la línea continúa |
| ⏱️ Demasiado pronto | ❌ La cadena se rompe |
| ⏱️ Demasiado tarde | ❌ La cadena se rompe |
| ❌ Dirección incorrecta | ❌ La cadena se rompe |

## 🔺 Generación de figuras

| Vértices | Figura |
|----------|--------|
| 3 | Triángulo |
| 4 | Cuadrado |
| 5 | Pentágono |
| 6 | Hexágono |
| 8 | Octágono |

Cada vértice contiene una **flecha con una dirección aleatoria** (↑ ↓ ← →). Pueden repetirse o combinarse.

## ⚙️ Dificultad configurable

| Parámetro | Opciones |
|-----------|----------|
| **Figura** | Triángulo (3) → Octágono (8) |
| **Velocidad de la línea** | Lenta (0.7×) → Muy rápida (2.4×) |
| **Precisión (ventana de acierto)** | Relajada (±220 ms) → Extrema (±60 ms) |

La dificultad depende de:
1. **Velocidad** — reduce el tiempo de reacción.
2. **Precisión** — ventana de acierto muy pequeña.
3. **Complejidad de la figura** — más vértices = más pulsaciones = más tiempo manteniendo el ritmo.
4. **Cambios de dirección** — anticipar constantemente la siguiente tecla.

## 🖥️ Requisitos

- **Node.js** ≥ 16.x (solo para servir el archivo, sin dependencias)
- Navegador moderno con soporte de Canvas

## 🚀 Cómo ejecutar

```bash
# 1) Ir a la carpeta del juego
cd "minijuegos a futuri/rhythm-arrows"

# 2) Arrancar el servidor (sin instalación necesaria)
npm start
```

La página estará en **<http://localhost:3002>**

> 💡 También podés abrir `public/index.html` directamente en el navegador — el juego funciona sin servidor.

## 🕹️ Controles

| Acción | Tecla |
|--------|-------|
| Pulsar flecha ↑ | `W` / `↑` |
| Pulsar flecha ↓ | `S` / `↓` |
| Pulsar flecha ← | `A` / `←` |
| Pulsar flecha → | `D` / `→` |

## 🏁 Condición de victoria

- Todas las flechas activadas correctamente.
- La última conexión vuelve al punto de inicio.
- La flecha inicial vuelve a iluminarse.
- **¡Circuito cerrado!**

Recibís **hasta 3 estrellas** según tu precisión (perfectos vs. buenos).

## 🏆 Habilidades que ponen a prueba

- Coordinación mano-ojo
- Memoria motriz
- Capacidad para mantener un ritmo constante
- Precisión temporal
- Tiempo de reacción

## 🗂️ Estructura del proyecto

```
rhythm-arrows/
├── package.json
├── README.md
├── server.js              # Servidor estático (Node.js nativo, sin dependencias)
└── public/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── game.js        # Lógica completa del juego
```
