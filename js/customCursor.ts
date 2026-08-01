/**
 * customCursor.ts — Controla el cursor personalizado (#cursorGlow + #cursorRing).
 *
 * El HTML y CSS para este cursor ya existían (con el efecto de anillo con
 * glow), pero ningún módulo TS lo posicionaba: el cursor nativo se ocultaba
 * globalmente vía CSS y el cursor personalizado nunca se movía, dejando al
 * usuario sin ningún cursor visible.
 *
 * - #cursorGlow: sigue al mouse de forma inmediata (punto pequeño).
 * - #cursorRing: sigue con un pequeño retraso (efecto de estela).
 * - Ambos crecen y cambian de color al pasar sobre elementos interactivos
 *   (clase .cursor-hover, ya definida en css/styles.css).
 *
 * El cursor nativo solo se oculta (body.custom-cursor-active) una vez que
 * se detecta un movimiento real de mouse, para no romper la experiencia
 * en dispositivos táctiles o trackpads que no disparan 'mousemove'.
 */

const HOVER_SELECTOR = 'a, button, [role="button"], .game-card, input, select, textarea, .filter-btn, label, [data-clickable]';

class CustomCursor {
  private glowEl: HTMLElement | null = null;
  private ringEl: HTMLElement | null = null;

  private mouseX = 0;
  private mouseY = 0;
  private ringX = 0;
  private ringY = 0;

  private rafId: number | null = null;
  private activated = false;

  init(): void {
    this.glowEl = document.getElementById('cursorGlow');
    this.ringEl = document.getElementById('cursorRing');

    if (!this.glowEl || !this.ringEl) {
      console.warn('[CustomCursor] No se encontraron #cursorGlow / #cursorRing en el DOM');
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

    this.loop();
  }

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (!this.activated) {
      this.activated = true;
      document.body.classList.add('custom-cursor-active');
    }

    if (this.glowEl) {
      this.glowEl.style.transform = `translate(${this.mouseX}px, ${this.mouseY}px) translate(-50%, -50%)`;
    }
  };

  private handleMouseOver = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target?.closest(HOVER_SELECTOR)) {
      this.glowEl?.classList.add('cursor-hover');
      this.ringEl?.classList.add('cursor-hover');
    }
  };

  private handleMouseOut = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    const related = e.relatedTarget as HTMLElement | null;
    if (target?.closest(HOVER_SELECTOR) && !related?.closest(HOVER_SELECTOR)) {
      this.glowEl?.classList.remove('cursor-hover');
      this.ringEl?.classList.remove('cursor-hover');
    }
  };

  private show = (): void => {
    if (!this.activated) return;
    this.glowEl?.style.removeProperty('opacity');
    this.ringEl?.style.removeProperty('opacity');
  };

  private hide = (): void => {
    if (this.glowEl) this.glowEl.style.opacity = '0';
    if (this.ringEl) this.ringEl.style.opacity = '0';
  };

  // Loop con lerp para que el anillo "persiga" al punto con una estela suave
  private loop = (): void => {
    this.ringX += (this.mouseX - this.ringX) * 0.18;
    this.ringY += (this.mouseY - this.ringY) * 0.18;

    if (this.ringEl) {
      this.ringEl.style.transform = `translate(${this.ringX}px, ${this.ringY}px) translate(-50%, -50%)`;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseover', this.handleMouseOver);
    document.removeEventListener('mouseout', this.handleMouseOut);
    document.removeEventListener('mouseleave', this.hide);
    document.removeEventListener('mouseenter', this.show);
  }
}

const CustomCursorInstance = new CustomCursor();

export default CustomCursorInstance;

document.addEventListener('DOMContentLoaded', () => {
  CustomCursorInstance.init();
});
