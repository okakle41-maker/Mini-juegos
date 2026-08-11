/**
 * Notification System
 * Sistema de notificaciones toast y alerts personalizadas
 */

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'achievement';

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

interface NotificationAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

class NotificationSystem {
  private notifications: Notification[] = [];
  private container: HTMLElement | null = null;
  private maxVisible = 5;
  private defaultDuration = 4000;

  constructor() {
    this.init();
  }

  private init(): void {
    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 2rem;
      right: 2rem;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);

    // Listen for achievement unlocks
    window.addEventListener('achievement:unlocked', (e: any) => {
      this.showAchievement(e.detail);
    });

    // Listen for theme changes
    window.addEventListener('theme:changed', (e: any) => {
      this.info('Tema cambiado', `Modo ${e.detail} activado`, 2000);
    });

    // Listen for locale changes
    window.addEventListener('locale:changed', (e: any) => {
      this.info('Idioma cambiado', `Idioma: ${e.detail}`, 2000);
    });
  }

  private createNotificationElement(notification: Notification): HTMLElement {
    const element = document.createElement('div');
    element.className = `notification notification--${notification.type}`;
    element.style.cssText = `
      pointer-events: auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
      min-width: 300px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    `;

    const icon = notification.icon || this.getDefaultIcon(notification.type);
    const iconElement = document.createElement('div');
    iconElement.className = 'notification-icon';
    iconElement.style.cssText = `
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    `;
    iconElement.textContent = icon;
    element.appendChild(iconElement);

    const content = document.createElement('div');
    content.className = 'notification-content';
    content.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const title = document.createElement('div');
    title.className = 'notification-title';
    title.style.cssText = `
      font-weight: 600;
      color: var(--text);
      margin-bottom: 0.25rem;
      font-size: 0.95rem;
    `;
    title.textContent = notification.title;
    content.appendChild(title);

    const message = document.createElement('div');
    message.className = 'notification-message';
    message.style.cssText = `
      color: var(--text-muted);
      font-size: 0.875rem;
      line-height: 1.4;
    `;
    message.textContent = notification.message;
    content.appendChild(message);

    if (notification.actions && notification.actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'notification-actions';
      actionsContainer.style.cssText = `
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
      `;

      notification.actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.label;
        button.style.cssText = `
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          transition: all 0.2s ease;
        `;

        if (action.primary) {
          button.style.cssText = `
            padding: 0.375rem 0.75rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--accent-orange);
            background: var(--accent-orange);
            color: white;
            transition: all 0.2s ease;
          `;
        }

        button.addEventListener('click', () => {
          action.action();
          this.dismiss(notification.id);
        });

        actionsContainer.appendChild(button);
      });

      content.appendChild(actionsContainer);
    }

    element.appendChild(content);

    const close = document.createElement('button');
    close.className = 'notification-close';
    close.innerHTML = '×';
    close.style.cssText = `
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    `;
    close.addEventListener('click', () => this.dismiss(notification.id));
    close.addEventListener('mouseenter', () => {
      close.style.background = 'var(--surface)';
      close.style.color = 'var(--text)';
    });
    close.addEventListener('mouseleave', () => {
      close.style.background = 'none';
      close.style.color = 'var(--text-dim)';
    });
    element.appendChild(close);

    return element;
  }

  private getDefaultIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
      achievement: '🏆'
    };
    return icons[type];
  }

  private show(notification: Notification): void {
    if (!this.container) return;

    // Remove oldest if max visible reached
    while (this.notifications.length >= this.maxVisible) {
      this.dismiss(this.notifications[0].id);
    }

    this.notifications.push(notification);
    const element = this.createNotificationElement(notification);
    this.container.appendChild(element);

    // Auto dismiss if not persistent
    if (!notification.persistent) {
      const duration = notification.duration || this.defaultDuration;
      setTimeout(() => this.dismiss(notification.id), duration);
    }
  }

  success(title: string, message: string, duration?: number): void {
    this.show({
      id: this.generateId(),
      type: 'success',
      title,
      message,
      duration,
      timestamp: Date.now()
    });
  }

  error(title: string, message: string, duration?: number): void {
    this.show({
      id: this.generateId(),
      type: 'error',
      title,
      message,
      duration: duration || 6000, // Longer for errors
      timestamp: Date.now()
    });
  }

  warning(title: string, message: string, duration?: number): void {
    this.show({
      id: this.generateId(),
      type: 'warning',
      title,
      message,
      duration,
      timestamp: Date.now()
    });
  }

  info(title: string, message: string, duration?: number): void {
    this.show({
      id: this.generateId(),
      type: 'info',
      title,
      message,
      duration,
      timestamp: Date.now()
    });
  }

  showAchievement(achievement: any): void {
    this.show({
      id: this.generateId(),
      type: 'achievement',
      title: achievement.name,
      message: achievement.description,
      icon: achievement.icon,
      duration: 6000,
      persistent: false,
      timestamp: Date.now()
    });
  }

  custom(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    this.show({
      ...notification,
      id: this.generateId(),
      timestamp: Date.now()
    });
  }

  dismiss(id: string): void {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index === -1) return;

    const notification = this.notifications[index];
    this.notifications.splice(index, 1);

    // Find and remove element
    if (this.container) {
      const elements = this.container.querySelectorAll('.notification');
      elements.forEach(element => {
        if (element.textContent.includes(notification.title)) {
          (element as HTMLElement).style.animation = 'slideOut 0.3s ease-in forwards';
          setTimeout(() => element.remove(), 300);
        }
      });
    }
  }

  clear(): void {
    this.notifications.forEach(n => this.dismiss(n.id));
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    this.clear();
    if (this.container) {
      document.body.removeChild(this.container);
      this.container = null;
    }
  }
}

// Add CSS animations
const style = document.createElement('style') as HTMLStyleElement;
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  .notification--success .notification-icon {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .notification--error .notification-icon {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .notification--warning .notification-icon {
    background: rgba(249, 115, 22, 0.15);
    color: #f97316;
  }

  .notification--info .notification-icon {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .notification--achievement .notification-icon {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
  }
`;
document.head.appendChild(style);

// Singleton instance
export const notificationSystem = new NotificationSystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.notificationSystem = notificationSystem;
}

export default notificationSystem;
