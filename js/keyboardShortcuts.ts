/**
 * Keyboard Shortcuts Manager
 * Maneja atajos de teclado globales para acciones comunes
 */

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: (e: KeyboardEvent) => void;
}

class KeyboardShortcuts {
  private shortcuts: Map<string, Shortcut[]> = new Map();
  private isEnabled: boolean = true;

  constructor() {
    this.init();
  }

  private init(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    console.log('[KeyboardShortcuts] Inicializado');
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isEnabled) return;

    // Ignorar si el usuario está en un input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = this.getKeyString(e);
    const shortcuts = this.shortcuts.get(key);

    if (shortcuts) {
      e.preventDefault();
      shortcuts.forEach(shortcut => shortcut.handler(e));
    }
  }

  private getKeyString(e: KeyboardEvent): string {
    const parts: string[] = [];
    // Ctrl (Windows/Linux) y Cmd (Mac) se tratan como la misma marca
    // lógica "mod": en un teclado real nunca se presionan ambas a la
    // vez, así que exigir ctrl+meta simultáneos hace que el atajo sea
    // inalcanzable. Con esto, "solo ctrl" o "solo meta" generan la
    // misma clave que buildKeyString produce para un shortcut
    // registrado con ctrl y/o meta.
    if (e.ctrlKey || e.metaKey) parts.push('mod');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  register(shortcut: Shortcut): void {
    const key = this.buildKeyString(shortcut);
    if (!this.shortcuts.has(key)) {
      this.shortcuts.set(key, []);
    }
    this.shortcuts.get(key)!.push(shortcut);
    console.log(`[KeyboardShortcuts] Registrado: ${key} - ${shortcut.description}`);
  }

  unregister(shortcut: Shortcut): void {
    const key = this.buildKeyString(shortcut);
    const shortcuts = this.shortcuts.get(key);
    if (shortcuts) {
      const index = shortcuts.indexOf(shortcut);
      if (index > -1) {
        shortcuts.splice(index, 1);
      }
    }
  }

  private buildKeyString(shortcut: Shortcut): string {
    const parts: string[] = [];
    // ctrl y/o meta colapsan a una sola marca "mod" (ver getKeyString).
    // Basta con uno de los dos para registrar el shortcut como
    // "requiere modificador", ya sea Ctrl (Win/Linux) o Cmd (Mac).
    if (shortcut.ctrl || shortcut.meta) parts.push('mod');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  getRegisteredShortcuts(): Shortcut[] {
    const all: Shortcut[] = [];
    this.shortcuts.forEach(shortcuts => all.push(...shortcuts));
    return all;
  }
}

// Singleton instance
export const keyboardShortcuts = new KeyboardShortcuts();

// Atajos predeterminados
// Nota: basta con "ctrl: true" (no hace falta duplicar con
// "meta: true") — buildKeyString/getKeyString tratan Ctrl y Cmd como
// el mismo modificador lógico, así que esto ya funciona en
// Windows/Linux (Ctrl) y Mac (Cmd) por igual.
keyboardShortcuts.register({
  key: 'k',
  ctrl: true,
  description: 'Abrir búsqueda',
  handler: (e) => {
    const searchInput = document.getElementById('lobbySearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
});

keyboardShortcuts.register({
  key: 'escape',
  description: 'Cerrar vista actual / volver al lobby',
  handler: (e) => {
    // Implementar lógica para cerrar modales o volver al lobby
    const viewManager = (window as any).viewManager;
    if (viewManager && typeof viewManager.showView === 'function') {
      viewManager.showView('home');
    }
  }
});

keyboardShortcuts.register({
  key: '/',
  ctrl: true,
  description: 'Mostrar ayuda de atajos',
  handler: (e) => {
    // Mostrar modal con lista de atajos
    console.log('Atajos registrados:', keyboardShortcuts.getRegisteredShortcuts());
  }
});

keyboardShortcuts.register({
  key: 'n',
  ctrl: true,
  description: 'Navegar a siguiente sección',
  handler: (e) => {
    // Implementar navegación entre secciones
  }
});

keyboardShortcuts.register({
  key: 'p',
  ctrl: true,
  description: 'Navegar a sección anterior',
  handler: (e) => {
    // Implementar navegación entre secciones
  }
});

export default keyboardShortcuts;
