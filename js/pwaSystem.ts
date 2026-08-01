/**
 * PWA System
 * Sistema de Progressive Web App Features: Push Notifications, Background Sync, Offline Mode, App Shortcuts
 */

interface PWAConfig {
  pushNotifications: boolean;
  backgroundSync: boolean;
  offlineMode: boolean;
  shortcutsEnabled: boolean;
}

class PWASystem {
  private config: PWAConfig;
  private storageKey = 'pwa_config';
  private registration: ServiceWorkerRegistration | null = null;
  private pushSubscription: PushSubscription | null = null;
  private syncQueue: Array<{ url: string; data: any }> = [];

  constructor() {
    this.config = this.loadConfig();
    this.init();
  }

  private loadConfig(): PWAConfig {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[PWA] Failed to load config:', e);
      }
    }
    return {
      pushNotifications: false,
      backgroundSync: true,
      offlineMode: true,
      shortcutsEnabled: true
    };
  }

  private saveConfig(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.config));
  }

  private async init(): Promise<void> {
    // Registrar service worker si no está registrado
    if ('serviceWorker' in navigator) {
      this.registration = await navigator.serviceWorker.getRegistration();
      
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { type: 'module' });
      }

      // Configurar push notifications
      if (this.config.pushNotifications) {
        await this.setupPushNotifications();
      }

      // Configurar background sync
      if (this.config.backgroundSync) {
        this.setupBackgroundSync();
      }

      // Configurar app shortcuts
      if (this.config.shortcutsEnabled) {
        this.setupAppShortcuts();
      }

      // Detectar estado de conexión
      this.setupConnectionMonitoring();
    }
  }

  // Push Notifications
  async setupPushNotifications(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[PWA] Push notifications not supported');
      return false;
    }

    if (!this.registration) return false;

    // Solicitar permiso
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[PWA] Push notification permission denied');
      return false;
    }

    try {
      // Suscribirse a push notifications
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          'YOUR_VAPID_PUBLIC_KEY_HERE' // Reemplazar con tu VAPID key
        ) as any
      });

      this.pushSubscription = subscription;
      this.config.pushNotifications = true;
      this.saveConfig();
      
      console.log('[PWA] Push notifications enabled');
      return true;
    } catch (e) {
      console.error('[PWA] Failed to subscribe to push:', e);
      return false;
    }
  }

  async disablePushNotifications(): Promise<void> {
    if (this.pushSubscription) {
      await this.pushSubscription.unsubscribe();
      this.pushSubscription = null;
    }
    this.config.pushNotifications = false;
    this.saveConfig();
  }

  async sendLocalNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-96.png',
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  // Background Sync
  setupBackgroundSync(): void {
    if (!('serviceWorker' in navigator) || !this.registration) return;

    // Escuchar eventos de sincronización
    navigator.serviceWorker.addEventListener('sync', (event: any) => {
      if (event.tag === 'sync-data') {
        event.waitUntil(this.syncData());
      }
    });
  }

  async queueSync(url: string, data: any): Promise<void> {
    this.syncQueue.push({ url, data });
    
    // Intentar sincronizar inmediatamente si hay conexión
    if (navigator.onLine) {
      await this.syncData();
    } else {
      // Registrar background sync para cuando vuelva la conexión
      if (this.registration && 'sync' in this.registration) {
        await (this.registration as any).sync.register('sync-data');
      }
    }
  }

  private async syncData(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    const items = [...this.syncQueue];
    this.syncQueue = [];

    for (const item of items) {
      try {
        await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        });
      } catch (e) {
        console.error('[PWA] Failed to sync item:', e);
        this.syncQueue.push(item); // Re-queue on failure
      }
    }
  }

  // Offline Mode
  setupConnectionMonitoring(): void {
    window.addEventListener('online', () => {
      console.log('[PWA] Connection restored');
      this.syncData();
      this.sendLocalNotification('Conexión restaurada', {
        body: 'Sincronizando datos...'
      });
    });

    window.addEventListener('offline', () => {
      console.log('[PWA] Connection lost');
      this.sendLocalNotification('Sin conexión', {
        body: 'Modo offline activado'
      });
    });
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  // App Shortcuts
  setupAppShortcuts(): void {
    if (!('navigator' in window) || !('installPrompt' in (window as any))) return;

    // Detectar si la app está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.registerShortcuts();
    }
  }

  private registerShortcuts(): void {
    if (!('navigator' in window) || !(window as any).userActivation) return;

    // Registrar shortcuts (Chrome/Edge)
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((registration) => {
        (registration as any).shortcuts?.add([
          {
            name: 'Jugar Simon',
            short_name: 'Simon',
            description: 'Jugar Simon Dice',
            url: '/?game=simon',
            icons: [{ src: '/assets/icon-96.png', sizes: '96x96' }]
          },
          {
            name: 'Ver Logros',
            short_name: 'Logros',
            description: 'Ver tus logros',
            url: '/?view=logros',
            icons: [{ src: '/assets/icon-96.png', sizes: '96x96' }]
          }
        ]);
      });
    }
  }

  // Install Prompt
  async promptInstall(): Promise<boolean> {
    const deferredPrompt = (window as any).deferredPrompt;
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('[PWA] App installed');
      this.registerShortcuts();
    }

    (window as any).deferredPrompt = null;
    return outcome === 'accepted';
  }

  canInstall(): boolean {
    return !!(window as any).deferredPrompt;
  }

  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches;
  }

  // Config methods
  setPushNotifications(enabled: boolean): void {
    this.config.pushNotifications = enabled;
    this.saveConfig();
    if (enabled) {
      this.setupPushNotifications();
    } else {
      this.disablePushNotifications();
    }
  }

  setBackgroundSync(enabled: boolean): void {
    this.config.backgroundSync = enabled;
    this.saveConfig();
  }

  setOfflineMode(enabled: boolean): void {
    this.config.offlineMode = enabled;
    this.saveConfig();
  }

  setShortcutsEnabled(enabled: boolean): void {
    this.config.shortcutsEnabled = enabled;
    this.saveConfig();
    if (enabled && this.isInstalled()) {
      this.registerShortcuts();
    }
  }

  getConfig(): PWAConfig {
    return { ...this.config };
  }

  // Utility
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  // Cache management
  async clearCache(): Promise<void> {
    if (!this.registration) return;

    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
  }

  async preloadAssets(urls: string[]): Promise<void> {
    if (!this.registration) return;

    const cache = await caches.open('precache-v1');
    await cache.addAll(urls);
  }
}

// Singleton instance
export const pwaSystem = new PWASystem();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  (window as any).pwaSystem = pwaSystem;
  
  // Capturar install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    (window as any).deferredPrompt = e;
  });
}

export default pwaSystem;
