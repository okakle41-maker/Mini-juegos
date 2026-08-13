/**
 * notificationSystem.tsx — Sistema de notificaciones toast/achievement
 * flotantes, con cola de hasta `maxVisible` elementos visibles.
 *
 * Migrado a Preact (continuación de la migración incremental del shell:
 * ver GameCard.tsx, FilterBar.tsx, ModuleOfDay.tsx) porque el original
 * (js/notificationSystem.ts, ver historial de git) tenía un bug de
 * sincronización real y activo, no solo cosmético:
 *
 *   dismiss(id) recibía un id único por notificación, pero buscaba QUÉ
 *   elemento del DOM remover por *coincidencia de texto*
 *   (`element.textContent.includes(notification.title)`), no por ese
 *   id. Dos notificaciones visibles a la vez con el mismo título (por
 *   ejemplo, dos "Conexión recuperada" seguidas, o dos logros con
 *   nombres parecidos) hacían que dismiss() de una pudiera cerrar la
 *   otra, o ambas — el array `this.notifications` (estado "lógico") y
 *   los <div> reales en `this.container` (estado "visual") eran dos
 *   fuentes de verdad sincronizadas a mano por una heurística de texto,
 *   exactamente el patrón de bug que ya motivó migrar lobbyRenderer.
 *
 * Con el array de notificaciones viviendo en un solo useState y cada
 * NotificationItem con su `key` real (el id), Preact hace el matching
 * elemento↔notificación por identidad, no por contenido — la clase de
 * bug de arriba deja de poder existir estructuralmente, no solo "queda
 * arreglada por ahora".
 *
 * Contrato público preservado 1:1 para no tocar a ningún consumidor
 * (app.tsx, main.ts, multiplayerSystem.ts, socialSharing.ts,
 * utils/connectionWatcher.ts, utils/copyRoomCode.ts, window.notificationSystem
 * para debugging): mismos métodos, misma firma, mismo singleton
 * exportado como named export y default.
 */
import { render } from 'preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'achievement';

interface NotificationAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  icon?: string;
  timestamp: number;
}

interface AchievementNotificationData {
  name: string;
  description: string;
  icon: string;
}

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 4000;
const EXIT_ANIMATION_MS = 300;

const DEFAULT_ICONS: Record<NotificationType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
  achievement: '🏆',
};

function generateId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store mínimo fuera de Preact: la clase pública NotificationSystem
 * (más abajo) es una fachada delgada sobre este store — permite seguir
 * exportando un singleton con métodos síncronos (success/error/...) sin
 * que el resto de la app necesite saber que por dentro hay un
 * componente Preact. Un solo listener (el propio NotificationHost) se
 * suscribe acá.
 */
type Listener = (notifications: Notification[]) => void;

class NotificationStore {
  private notifications: Notification[] = [];
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.notifications);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach(l => l(this.notifications));
  }

  push(notification: Notification): void {
    // Mismo límite de maxVisible que el original: descarta las más
    // viejas antes de agregar la nueva, en vez de dejar crecer la cola
    // sin límite y confiar en el CSS para ocultar el exceso.
    while (this.notifications.length >= MAX_VISIBLE) {
      this.notifications = this.notifications.slice(1);
    }
    this.notifications = [...this.notifications, notification];
    this.emit();
  }

  dismiss(id: string): void {
    if (!this.notifications.some(n => n.id === id)) return;
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.emit();
  }

  clear(): void {
    this.notifications = [];
    this.emit();
  }

  getAll(): Notification[] {
    return this.notifications;
  }
}

const store = new NotificationStore();

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
}) {
  // Anima la salida (fade/slide) antes de que el padre saque este
  // elemento de la lista — mismo timing que el original
  // (EXIT_ANIMATION_MS = 300ms, igual a la animación slideOut). El
  // estado "leaving" es local a ESTE item (identificado por su key/id
  // real vía Preact), así que no hay forma de que la animación de
  // salida de una notificación afecte a otra, a diferencia del
  // querySelectorAll+textContent del original.
  const [leaving, setLeaving] = useState(false);

  const requestDismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(notification.id), EXIT_ANIMATION_MS);
  }, [notification.id, onDismiss]);

  useEffect(() => {
    if (notification.persistent) return;
    const duration = notification.duration ?? DEFAULT_DURATION;
    const timer = setTimeout(requestDismiss, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe armarse una vez por notificación, no reiniciarse en cada render.
  }, []);

  const icon = notification.icon || DEFAULT_ICONS[notification.type];

  return (
    <div
      className={`notification notification--${notification.type}`}
      style={{ animation: leaving ? 'slideOut 0.3s ease-in forwards' : 'slideIn 0.3s ease-out' }}
    >
      <div className="notification-icon">{icon}</div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        {notification.actions && notification.actions.length > 0 && (
          <div className="notification-actions">
            {notification.actions.map((action, i) => (
              <button
                key={i}
                type="button"
                className={action.primary ? 'notification-action--primary' : 'notification-action'}
                onClick={() => {
                  action.action();
                  requestDismiss();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="notification-close"
        aria-label="Cerrar notificación"
        onClick={requestDismiss}
      >
        ×
      </button>
    </div>
  );
}

function NotificationHost() {
  const [notifications, setNotifications] = useState<Notification[]>(() => store.getAll());

  useEffect(() => store.subscribe(setNotifications), []);

  return (
    <>
      {notifications.map(n => (
        <NotificationItem key={n.id} notification={n} onDismiss={id => store.dismiss(id)} />
      ))}
    </>
  );
}

let containerEl: HTMLElement | null = null;

function ensureMounted(): void {
  if (containerEl) return;
  containerEl = document.createElement('div');
  containerEl.className = 'notification-container';
  containerEl.setAttribute('role', 'status');
  containerEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(containerEl);
  render(<NotificationHost />, containerEl);
}

/**
 * Fachada pública: mismos métodos/firmas que la clase original, para
 * no requerir ningún cambio en los ~6 módulos que ya la consumen (ver
 * comentario de arriba). Por dentro, cada método solo empuja al store;
 * el componente NotificationHost es la única fuente de verdad del DOM.
 */
class NotificationSystem {
  constructor() {
    ensureMounted();

    window.addEventListener('achievement:unlocked', (e: Event) => {
      this.showAchievement((e as CustomEvent<AchievementNotificationData>).detail);
    });

    window.addEventListener('theme:changed', (e: Event) => {
      this.info('Tema cambiado', `Modo ${(e as CustomEvent<string>).detail} activado`, 2000);
    });

    window.addEventListener('locale:changed', (e: Event) => {
      this.info('Idioma cambiado', `Idioma: ${(e as CustomEvent<string>).detail}`, 2000);
    });
  }

  success(title: string, message: string, duration?: number): void {
    store.push({ id: generateId(), type: 'success', title, message, duration, timestamp: Date.now() });
  }

  error(title: string, message: string, duration?: number): void {
    store.push({
      id: generateId(),
      type: 'error',
      title,
      message,
      duration: duration || 6000, // Longer for errors
      timestamp: Date.now(),
    });
  }

  warning(title: string, message: string, duration?: number): void {
    store.push({ id: generateId(), type: 'warning', title, message, duration, timestamp: Date.now() });
  }

  info(title: string, message: string, duration?: number): void {
    store.push({ id: generateId(), type: 'info', title, message, duration, timestamp: Date.now() });
  }

  showAchievement(achievement: AchievementNotificationData): void {
    store.push({
      id: generateId(),
      type: 'achievement',
      title: achievement.name,
      message: achievement.description,
      icon: achievement.icon,
      duration: 6000,
      persistent: false,
      timestamp: Date.now(),
    });
  }

  custom(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    store.push({ ...notification, id: generateId(), timestamp: Date.now() });
  }

  dismiss(id: string): void {
    store.dismiss(id);
  }

  clear(): void {
    store.clear();
  }

  destroy(): void {
    store.clear();
    if (containerEl) {
      render(null, containerEl);
      containerEl.remove();
      containerEl = null;
    }
  }
}

// Singleton instance
export const notificationSystem = new NotificationSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.notificationSystem = notificationSystem;
}

export default notificationSystem;
