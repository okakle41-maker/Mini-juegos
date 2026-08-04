# 🌀 Laberinto Fragmentado (Fragmentad Labyrinth)

Minijuego cooperativo online de **4 jugadores** basado en el clásico **Maze** del proyecto principal.

> **Ningún jugador ve el laberinto completo.** Cada uno observa únicamente un cuadrante distinto del mapa por lo que la comunicación es imprescindible para guiar a un único personaje desde la salida hasta la meta antes de que el tiempo se agote.

---

## ⭐ Concepto

- **4 jugadores cooperativos**, cada uno con un rol fijo:
  - **Jugador A** → Controla al personaje + ve el cuadrante superior-izquierdo.
  - **Jugador B** → Ve el cuadrante superior-derecho y guía por chat/voz.
  - **Jugador C** → Ve el cuadrante inferior-izquierdo y guía por chat/voz.
  - **Jugador D** → Ve el cuadrante inferior-derecho y guía por chat/voz.
- **1 único laberinto** generado en el servidor (autoridad del juego).
- **1 único personaje** que solo el Jugador A puede mover con las flechas / WASD.
- Los demás jugadores solo pueden dar instrucciones mediante **chat de texto** o **directivas rápidas** (y voz externa, p. ej. Discord / Meet).
- **Salida en un cuadrante** — solo quien la tiene visible sabe dónde está.

---

## 🎮 Mecánica

| Rol | Controla al personaje | Visión |
|-----|----------------------|--------|
| A | ✅ | Cuadrante superior-izquierdo |
| B | ❌ | Cuadrante superior-derecho |
| C | ❌ | Cuadrante inferior-izquierdo |
| D | ❌ | Cuadrante inferior-derecho |

- El **tiempo es de 120 segundos** (2 minutos).
- El personaje se representa como un **● verde pulsante** en el cuadrante de quien lo tiene a la vista.
- La **salida** se marca con **E** (celeste brillante) y el **inicio** con **S** (verde).
- Los cuadrantes se **solapan en la fila/columna central**, así los pasillos que cruzan la frontera se ven desde ambos lados — parte clave de la coordinación.

---

## 🖥️ Requisitos

- **Node.js** ≥ 16.x (probado con 18/20/22)
- Navegador moderno (Chrome, Edge, Firefox, Safari)
- Se usa la librería [`ws`](https://www.npmjs.com/package/ws) para WebSockets

---

## 🚀 Cómo ejecutar

```bash
# 1) Ir a la carpeta del juego
cd "minijuegos a futuri/fragmentad-labyrinth"

# 2) Instalar dependencias (solo la primera vez)
npm install

# 3) Arrancar el servidor
npm start
```

El servidor quedará escuchando en:

- **Página web:** <http://localhost:3001>
- **WebSocket:** `ws://localhost:3001`

> 🔥 **Consejo:** abrí la página en 4 pestañas/ventanas/navegadores distintos. En la primera presioná **"Crear sala"**; en las otras tres **"Unirse"** con el código mostrado.

---

## 🕹️ Controles

| Acción | Tecla |
|--------|-------|
| Mover arriba | `W` / `↑` |
| Mover abajo | `S` / `↓` |
| Mover izquierda | `A` / `←` |
| Mover derecha | `D` / `→` |
| Enviar mensaje | Enter (en el input del chat) |

Los botones direccionales (D-pad) también funcionan con clic. Solo el **Jugador A** puede mover al personaje; los botones se deshabilitan para los demás roles.

---

## 💬 Comunicación

- **Chat libre** en el panel inferior.
- **Directivas rápidas** (botones predefinidos) para guiar con un clic:
  - ⬆ Subí / ⬇ Bajá / ⬅ Izq / ➡ Der
  - 🚫 Muro / 🏁 Salida cerca / 📍 Inicio / ⏸ Esperá

---

## 🏁 Condición de victoria

El personaje llega a la **salida (E)** antes de que el temporizador llegue a 0. El equipo gana. Si el tiempo se agota, pierden todos.

---

## 🗂️ Estructura del proyecto

```
fragmentad-labyrinth/
├── package.json
├── README.md
├── server/
│   ├── index.js            # Servidor WebSocket + HTTP estático
│   └── mazeGenerator.js     # Generador de laberintos (copiado del original)
└── public/
    ├── index.html           # Interfaz del cliente
    ├── css/
    │   └── style.css        # Estilos retro-arcade
    └── js/
        └── client.js        # Lógica del cliente
```

---

## 🔐 Seguridad

- Los nombres de jugador y mensajes se **sanean** (anti-XSS).
- El servidor envía a cada cliente **solo su cuadrante** — nunca el mapa completo.
- El movimiento se **valida en el servidor** (no en el cliente), lo que impide atravesar muros.
- El servidor estático previene **path traversal**.

---

## 🧩 Variantes futuras (roadmap)

- [ ] Variante 1 — Niebla por radio de 5 casillas
- [ ] Variante 2 — Capas de información (muros/trampas/puertas/llaves)
- [ ] Variante 3 — Laberintos distintos por jugador
- [ ] Variante 4 — Rotaciones de cuadrante (0/90/180/270)
- [ ] Variante 5 — Portales invisibles
- [ ] Variante 6 — Muros dinámicos cada 15 s
- [ ] Variante 7 — Visión especializada por capas

---

## 🛠️ Troubleshooting

| Problema | Solución |
|----------|----------|
| "No se pudo conectar al servidor" | Verificá que `npm start` esté corriendo en la terminal. |
| El puerto 3001 está ocupado | Cambiá el puerto: `PORT=3002 npm start` (Windows: `set PORT=3002 && npm start`). |
| No se ve el cuadrante del otro jugador | Es **intencional**: cada jugador ve SOLO el suyo. |