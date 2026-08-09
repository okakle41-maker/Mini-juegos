/**
 * customCursor.ts — Controla el cursor personalizado (#cursorDot).
 *
 * Reescrito de cero (Aug 2026) junto con el sistema de hover de
 * cards. Antes eran dos elementos (#cursorGlow siguiendo al mouse en
 * línea recta + #cursorRing con lerp para el efecto de estela). Ahora
 * es UN solo elemento — menos nodos que mover/componer por frame — y
 * el lerp (que antes solo tenía el ring) se aplica al punto entero:
 * el cursor completo "persigue" la posición real del mouse con un
 * pequeño resorte en vez de teletransportarse ahí en línea recta. Es
 * ese lag sutil el que le da la sensación de vida/peso — no un glow
 * más grande ni más blureado — y no cuesta nada extra de Rendering:
 * es solo aritmética (lerp) sumada al mismo write de `transform` que
 * ya se hacía de todos modos.
 *
 * El cursor nativo solo se oculta (body.custom-cursor-active) una vez
 * que se detecta un movimiento real de mouse, para no romper la
 * experiencia en dispositivos táctiles o trackpads que no disparan
 * 'mousemove'.
 */

const HOVER_SELECTOR = 'a, button, [role="button"], .game-card, input, select, textarea, .filter-btn, label, [data-clickable]';

// FPS del loop de seguimiento. Igual que en el diseño anterior:
// seguimos reprogramando vía requestAnimationFrame (para que el
// navegador pueda pausarlo en tabs en background, etc.) pero solo
// hacemos el trabajo real (lerp + write de estilo) cuando pasó al
// menos FRAME_BUDGET_MS desde el último frame procesado.
const CURSOR_FPS = 60;
const FRAME_BUDGET_MS = 1000 / CURSOR_FPS;

// Factor de suavizado del lerp: más alto = persigue más rápido/más
// ajustado al mouse real, más bajo = más lag/más "resorte". 0.35 da
// un seguimiento notorio pero sin sentirse desconectado del puntero
// real (a diferencia del 0.18 que tenía el ring viejo, pensado para
// una ESTELA visiblemente atrasada detrás de un punto que sí era
// instantáneo — acá no hay un segundo punto instantáneo de
// referencia, así que un lag tan grande se sentiría como que el
// cursor "no responde").
const LERP_FACTOR = 0.35;

class CustomCursor {
  private dotEl: HTMLElement | null = null;

  private mouseX = 0;
  private mouseY = 0;
  private dotX = 0;
  private dotY = 0;

  private rafId: number | null = null;
  private activated = false;
  private looping = false;
  private lastFrameTime = 0;

  /** Ver nota en `dotTransform()`: el scale de hover se incluye a
   *  mano en el mismo string de `transform` que ya escribe el loop,
   *  porque un estilo inline siempre gana por especificidad sobre
   *  cualquier transform que `.cursor-hover` intentara aplicar por
   *  CSS solo. */
  private isHovering = false;

  private dotTransform(): string {
    const scale = this.isHovering ? ' scale(3.4)' : '';
    return `translate3d(${this.dotX}px, ${this.dotY}px, 0) translate(-50%, -50%)${scale}`;
  }

  init(): void {
    // Modo bajo consumo: el cursor personalizado completo se apaga
    // — no solo se oculta con CSS (que dejaría el RAF corriendo en
    // segundo plano igual), directamente no inicializamos nada.
    if (document.body.classList.contains('perf-mode')) {
      return;
    }

    this.dotEl = document.getElementById('cursorDot');

    if (!this.dotEl) {
      console.warn('[CustomCursor] No se encontró #cursorDot en el DOM');
      return;
    }

    // Evitar cursor personalizado en dispositivos sin puntero fino (táctiles)
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    document.addEventListener('mouseover', this.handleMouseOver, { passive: true });
    document.addEventListener('mouseout', this.handleMouseOut, { passive: true });
    document.addEventListener('mouseleave', this.hide, { passive: true });
    document.addEventListener('mouseenter', this.show, { passive: true });

    // El loop arranca recién en el primer mousemove (ver
    // handleMouseMove) en vez de correr desde el init(): con el mouse
    // quieto no hay nada que animar, así que mantener un RAF
    // recursivo 24/7 solo quema CPU de scripting sin ningún beneficio
    // visual.
  }

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (!this.activated) {
      this.activated = true;
      document.body.classList.add('custom-cursor-active');
      // Primer movimiento: arrancar el punto YA en la posición real
      // del mouse en vez de dejar que el lerp lo arrastre desde
      // (0,0) — sin esto, el cursor "viajaría" visiblemente desde la
      // esquina superior izquierda en el primer frame.
      this.dotX = this.mouseX;
      this.dotY = this.mouseY;
      if (this.dotEl) this.dotEl.style.transform = this.dotTransform();
    }

    this.ensureLoop();
  };

  // `target.closest(HOVER_SELECTOR)` recorre el DOM hacia arriba en
  // CADA evento — con hover rápido sobre cards (que tienen ~10 hijos
  // cada una: icon, nombre, descripción, botón favorito...) esto se
  // dispara una vez por cada hijo cruzado, sumándose directamente
  // encima del Recalculate Style/Layerize que ya generan las cards en
  // el mismo instante. `mouseover`/`mouseout` sí necesitan quedarse a
  // nivel document (a diferencia de mouseenter/mouseleave) porque son
  // la única forma de delegar sobre cards que TODAVÍA NO EXISTEN al
  // momento de este `init()` — LobbyRenderer las inserta después vía
  // `innerHTML`, así que adjuntar listeners directos en cada card acá
  // se perdería las que se agregan más tarde.
  //
  // Optimización: si `e.target` mismo ya es un match directo (lo más
  // común — la mayoría de los mouseover ocurren sobre el elemento de
  // interés, no sobre un nieto profundo), `matches()` resuelve en O(1)
  // sin recorrer nada. Solo se cae a `closest()` (más caro) cuando el
  // target es un descendiente y hace falta subir a buscar el
  // ancestro — el caso menos frecuente.
  private resolveHoverTarget(target: HTMLElement | null): HTMLElement | null {
    if (!target) return null;
    if (target.matches(HOVER_SELECTOR)) return target;
    return target.closest(HOVER_SELECTOR);
  }

  private handleMouseOver = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (this.resolveHoverTarget(target)) {
      this.isHovering = true;
      this.dotEl?.classList.add('cursor-hover');
      // Reaplicar el transform ya (no solo esperar al próximo frame
      // del loop) para que el cambio de escala se vea en el mismo
      // instante en que el mouse entra al elemento, no con el
      // pequeño delay de esperar el próximo tick.
      if (this.dotEl) this.dotEl.style.transform = this.dotTransform();
    }
  };

  private handleMouseOut = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    const related = e.relatedTarget as HTMLElement | null;
    if (this.resolveHoverTarget(target) && !this.resolveHoverTarget(related)) {
      this.isHovering = false;
      this.dotEl?.classList.remove('cursor-hover');
      if (this.dotEl) this.dotEl.style.transform = this.dotTransform();
    }
  };

  private show = (): void => {
    if (!this.activated) return;
    this.dotEl?.style.removeProperty('opacity');
  };

  private hide = (): void => {
    if (this.dotEl) this.dotEl.style.opacity = '0';
  };

  // Loop con lerp: el punto "persigue" la posición real del mouse con
  // un resorte suave en vez de saltar ahí directo. Throttleado a
  // CURSOR_FPS igual que el diseño anterior — el resto de los
  // callbacks de RAF retornan casi inmediatamente si no pasó
  // suficiente tiempo desde el último frame procesado.
  private loop = (timestamp: number): void => {
    const elapsed = timestamp - this.lastFrameTime;

    if (elapsed < FRAME_BUDGET_MS) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    this.lastFrameTime = timestamp;

    this.dotX += (this.mouseX - this.dotX) * LERP_FACTOR;
    this.dotY += (this.mouseY - this.dotY) * LERP_FACTOR;

    if (this.dotEl) {
      this.dotEl.style.transform = this.dotTransform();
    }

    // Con el mouse quieto, el lerp converge exponencialmente pero
    // nunca llega a exactamente 0 — sin este corte, `loop()` seguiría
    // reprogramándose (y el navegador reprogramando el RAF) para
    // siempre aunque el punto ya esté visualmente pegado al cursor.
    // 0.05px de diferencia es imperceptible; cortamos ahí.
    const dx = this.mouseX - this.dotX;
    const dy = this.mouseY - this.dotY;
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      this.looping = false;
      this.rafId = null;
      return;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private ensureLoop(): void {
    if (this.looping) return;
    this.looping = true;
    // Reset explícito: si no, `elapsed` en el primer frame se calcularía
    // contra el `lastFrameTime` de un ciclo de movimiento anterior (a veces
    // segundos atrás), lo cual da un `elapsed` gigante y de casualidad deja
    // pasar ese frame sin throttle. Arrancando en 0 forzamos que el primer
    // frame del nuevo ciclo también respete el budget normal.
    this.lastFrameTime = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.looping = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    document.removeEventListener('mouseleave', this.hide);
    document.removeEventListener('mouseenter', this.show);

    // Bug: al activar "modo bajo consumo" con el cursor gamer ya
    // activo, destroy() apagaba el loop y los listeners pero dejaba
    // `custom-cursor-active` puesta en <body> — esa clase es la que
    // hace `cursor: none !important` en TODO (ver styles.css). Sin
    // el loop de #cursorDot corriendo para dibujar el punto, y sin el
    // cursor nativo del navegador (oculto por esa clase), el usuario
    // se quedaba sin ningún cursor visible en pantalla. Sacarla acá
    // restaura el cursor nativo del navegador de inmediato al entrar
    // en perf-mode. `activated` también se resetea para que, si el
    // modo se desactiva más tarde, el próximo mousemove reinicie el
    // cursor personalizado desde cero limpio (mismo camino que la
    // primera carga) en vez de arrastrar estado de la activación
    // anterior.
    document.body.classList.remove('custom-cursor-active');
    this.activated = false;
  }
}

const CustomCursorInstance = new CustomCursor();

export default CustomCursorInstance;

document.addEventListener('DOMContentLoaded', () => {
  CustomCursorInstance.init();
});
