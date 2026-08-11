/**
 * PWA System
 * Sistema de Progressive Web App Features: Push Notifications, Background Sync, Offline Mode, App Shortcuts
 */

import { devLog } from './core/devLog.js';

// El evento `beforeinstallprompt` no es un tipo DOM estándar (no todos
// los navegadores lo implementan), así que TypeScript no lo trae de
// fábrica. Se declara acá, en el único módulo que conoce su forma real.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// SyncManager/'sync' en ServiceWorkerRegistration y SyncEvent tampoco son
// tipos DOM estándar en todos los entornos (Background Sync API) —
// se declaran acá, en el único módulo que los usa.
interface SyncManager {
  register: (tag: string) => Promise<void>;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync: SyncManager;
}

interface ServiceWorkerRegistrationWithShortcuts extends ServiceWorkerRegistration {
  shortcuts?: {
    add: (shortcuts: unknown[]) => Promise<void>;
  };
}

interface SyncEvent extends Event {
  tag: string;
  waitUntil: (promise: Promise<unknown>) => void;
}

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
  private syncQueue: Array<{ url: string; data: unknown }> = [];

  constructor() {
    this.config = this.loadConfig();
    // No se puede `await` desde un constructor — es intencional que
    // init() corra en segundo plano; cualquier error que no atrape
    // internamente queda logueado en vez de perderse en silencio.
    void this.init().catch((err: unknown) => {
      console.error('[PWA] Error durante la inicialización:', err);
    });
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
      // getRegistration() devuelve undefined si no hay registro, pero
      // this.registration es ServiceWorkerRegistration | null (todo el
      // resto del código lo chequea con !this.registration, que trata
      // igual a ambos) — se normaliza acá para no tener que cambiar el
      // tipo de la propiedad en toda la clase.
      this.registration = (await navigator.serviceWorker.getRegistration()) ?? null;
      
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
        ) as BufferSource
      });

      this.pushSubscription = subscription;
      this.config.pushNotifications = true;
      this.saveConfig();
      
      devLog('[PWA] Push notifications enabled');
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
    navigator.serviceWorker.addEventListener('sync', ((event: SyncEvent) => {
      if (event.tag === 'sync-data') {
        event.waitUntil(this.syncData());
      }
    }) as EventListener);
  }

  async queueSync(url: string, data: unknown): Promise<void> {
    this.syncQueue.push({ url, data });
    
    // Intentar sincronizar inmediatamente si hay conexión
    if (navigator.onLine) {
      await this.syncData();
    } else {
      // Registrar background sync para cuando vuelva la conexión
      if (this.registration && 'sync' in this.registration) {
        await (this.registration as ServiceWorkerRegistrationWithSync).sync.register('sync-data');
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
      devLog('[PWA] Connection restored');
      void this.syncData().catch((err: unknown) => {
        console.error('[PWA] Error al sincronizar tras reconectar:', err);
      });
      void this.sendLocalNotification('Conexión restaurada', {
        body: 'Sincronizando datos...'
      }).catch((err: unknown) => {
        console.error('[PWA] Error al mostrar notificación:', err);
      });
    });

    window.addEventListener('offline', () => {
      devLog('[PWA] Connection lost');
      void this.sendLocalNotification('Sin conexión', {
        body: 'Modo offline activado'
      }).catch((err: unknown) => {
        console.error('[PWA] Error al mostrar notificación:', err);
      });
    });
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  // App Shortcuts
  setupAppShortcuts(): void {
    // Antes este guard chequeaba `'installPrompt' in window`, una
    // propiedad que nunca se define en ningún lado del código — lo que
    // sí se guarda en window es `deferredPrompt` (ver el listener de
    // 'beforeinstallprompt' más abajo), bajo otro nombre. Como
    // `installPrompt` jamás existe, este método retornaba siempre de
    // forma temprana y los shortcuts de la app nunca se registraban,
    // sin importar si la PWA estaba instalada o no.
    //
    // Además, condicionar esto a `deferredPrompt` tampoco sería
    // correcto: ese evento solo se dispara ANTES de instalar la app
    // (mientras el navegador ofrece el prompt), y una vez instalada
    // (el caso que este método realmente maneja, ver el chequeo de
    // display-mode inmediatamente abajo) el navegador ya no lo vuelve
    // a disparar en cargas futuras. El único guard que hace falta acá
    // es que `navigator` exista, que ya está garantizado por el
    // llamador (init() solo entra a este bloque dentro de
    // `if ('serviceWorker' in navigator)`).
    if (typeof navigator === 'undefined') return;

    // Detectar si la app está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.registerShortcuts();
    }
  }

  private registerShortcuts(): void {
    // Antes este guard chequeaba `(window as any).userActivation`, que
    // no existe: la API real es `navigator.userActivation` (un objeto
    // con `.isActive`/`.hasBeenActive`, no algo en `window`). Al buscar
    // la propiedad en el objeto equivocado, esto siempre daba
    // `undefined` y registerShortcuts() retornaba temprano en el 100%
    // de los casos — los shortcuts de la app nunca llegaban a
    // registrarse desde ninguno de sus 3 call sites (arranque de la
    // PWA instalada, justo tras instalar, y al habilitar shortcuts en
    // configuración). Ninguno de esos call sites tiene relación con
    // "el usuario interactuó recientemente" (que es lo que
    // userActivation representaría de todas formas, y ni siquiera como
    // booleano), así que el chequeo correcto es solo la disponibilidad
    // real de la API que se usa a continuación.
    if (!('navigator' in window) || !navigator.serviceWorker) return;

    // Registrar shortcuts (Chrome/Edge)
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((registration) => {
        return (registration as ServiceWorkerRegistrationWithShortcuts).shortcuts?.add([
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
      }).catch((err: unknown) => {
        console.error('[PWA] Error al registrar shortcuts:', err);
      });
    }
  }

  // Install Prompt
  async promptInstall(): Promise<boolean> {
    const deferredPrompt = window.deferredPrompt as BeforeInstallPromptEvent | null;
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      devLog('[PWA] App installed');
      this.registerShortcuts();
    }

    window.deferredPrompt = null;
    return outcome === 'accepted';
  }

  canInstall(): boolean {
    return !!window.deferredPrompt;
  }

  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches;
  }

  // Config methods
  setPushNotifications(enabled: boolean): void {
    this.config.pushNotifications = enabled;
    this.saveConfig();
    if (enabled) {
      void this.setupPushNotifications().catch((err: unknown) => {
        console.error('[PWA] Error al activar notificaciones push:', err);
      });
    } else {
      void this.disablePushNotifications().catch((err: unknown) => {
        console.error('[PWA] Error al desactivar notificaciones push:', err);
      });
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
  window.pwaSystem = pwaSystem;
  
  // Capturar install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    window.deferredPrompt = e;
  });
}

export default pwaSystem;
