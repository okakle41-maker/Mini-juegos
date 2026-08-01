import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast } from '../js/toast';

describe('toast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('crea el contenedor #toastContainer la primera vez que se llama', () => {
    expect(document.getElementById('toastContainer')).toBeNull();

    showToast('Hola');

    expect(document.getElementById('toastContainer')).not.toBeNull();
  });

  it('reutiliza el mismo contenedor en llamadas sucesivas, no crea uno nuevo cada vez', () => {
    showToast('Primero');
    const containerAfterFirst = document.getElementById('toastContainer');

    showToast('Segundo');
    const containerAfterSecond = document.getElementById('toastContainer');

    expect(containerAfterFirst).toBe(containerAfterSecond);
    expect(document.querySelectorAll('.toast')).toHaveLength(2);
  });

  it('setea el mensaje vía textContent (no HTML), incluso si el mensaje contiene caracteres especiales', () => {
    showToast('<script>alert(1)</script>');

    const messageEl = document.querySelector('.toast-message');
    expect(messageEl?.textContent).toBe('<script>alert(1)</script>');
    // Si esto hubiera terminado en innerHTML sin escapar, no habría un
    // nodo <script> real dentro (jsdom no lo ejecutaría de todas formas,
    // pero si textContent no coincide con el string original es señal
    // de que se interpretó como marcado en vez de texto plano).
    expect(messageEl?.innerHTML).not.toContain('<script>');
  });

  it('aplica la clase de variante correcta', () => {
    showToast('Algo salió mal', { variant: 'error' });

    expect(document.querySelector('.toast--error')).not.toBeNull();
  });

  it('usa "info" como variante por defecto', () => {
    showToast('Mensaje neutro');

    expect(document.querySelector('.toast--info')).not.toBeNull();
  });

  it('el botón de cerrar remueve el toast', () => {
    showToast('Cerrame');
    const toast = document.querySelector('.toast') as HTMLElement;
    const closeBtn = toast.querySelector('.toast-close') as HTMLElement;

    closeBtn.click();
    // remove() real ocurre en 'transitionend', que jsdom no dispara solo
    // — se simula disparándolo a mano, como haría el navegador tras la
    // transición CSS.
    toast.dispatchEvent(new Event('transitionend'));

    expect(document.querySelector('.toast')).toBeNull();
  });

  it('se auto-descarta pasado el duration por defecto', () => {
    showToast('Desaparezco solo');
    const toast = document.querySelector('.toast') as HTMLElement;

    vi.advanceTimersByTime(5000);
    toast.dispatchEvent(new Event('transitionend'));

    expect(document.querySelector('.toast')).toBeNull();
  });

  it('con duration: 0 no se auto-descarta', () => {
    showToast('Quedate', { duration: 0 });

    vi.advanceTimersByTime(60000);

    expect(document.querySelector('.toast')).not.toBeNull();
  });
});
