/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// ─── Workbox precaching ──────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ─── IndexedDB helpers ───────────────────────────────────────────────────────
const DB_NAME = 'enat-agar-db-v2';
const STORE_NAME = 'anc-data';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet<T = any>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function dbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface StoredAppointment {
  week: number;
  description: string;
  dateStr: string;
  displayDate: string;
}

interface NotificationConfig {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  enabled: boolean;
}

// ─── Helper: Convert 12h to 24h ──────────────────────────────────────────────
function to24Hour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM' && hour === 12) return 0;
  if (period === 'PM' && hour !== 12) return hour + 12;
  return hour;
}

// ─── Helper: Get tomorrow's date string ──────────────────────────────────────
function getTomorrowStr(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
}

// ─── Core notification logic ─────────────────────────────────────────────────
async function checkAndNotify(force: boolean = false): Promise<void> {
  try {
    const appointments = await dbGet<StoredAppointment[]>('appointments');
    const config = await dbGet<NotificationConfig>('notificationConfig');

    if (!appointments || !Array.isArray(appointments)) return;
    if (!config || !config.enabled) return;

    const now = new Date();
    const notifHour = to24Hour(config.hour, config.period);
    const notifMinute = config.minute;

    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const minutesTarget = notifHour * 60 + notifMinute;
    
    if (!force && minutesNow < minutesTarget) return;

    const tomorrowStr = getTomorrowStr();

    for (const apt of appointments) {
      if (apt.dateStr !== tomorrowStr) continue;

      const notifKey = `notified_${apt.week}_${apt.dateStr}`;
      const alreadySent = await dbGet<boolean>(notifKey);
      if (alreadySent) continue;

      await self.registration.showNotification('የቀጠሮ ማስታወሻ – Enat Agar', {
        body: 'ነገ የእርግዝና ክትትል ቀጠሮ አለሽ፡፡',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: notifKey,
        requireInteraction: true,
        // Strong vibration pattern for audible/physical alert
        // @ts-ignore
        vibrate: [300, 100, 300, 100, 500, 200, 500],
        data: { 
          week: apt.week, 
          date: apt.dateStr,
          description: apt.description 
        },
        actions: [
          {
            action: 'open',
            title: 'መተግበሪያውን ክፈት'
          },
          {
            action: 'dismiss',
            title: 'አሰናብት'
          }
        ]
      });

      await dbSet(notifKey, true);
    }
  } catch (err) {
    console.error('[SW] checkAndNotify error:', err);
  }
}

// ─── Message handler ─────────────────────────────────────────────────────────
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type } = event.data || {};

  if (type === 'STORE_ANC_DATA') {
    const { appointments, notificationConfig } = event.data;
    (async () => {
      try {
        await dbSet('appointments', appointments);
        await dbSet('notificationConfig', notificationConfig);
        await checkAndNotify(true);
      } catch (err) {
        console.error('[SW] Store error:', err);
      }
    })();
  }

  if (type === 'FORCE_CHECK') {
    event.waitUntil(checkAndNotify(true));
  }
});

// ─── Periodic Background Sync ────────────────────────────────────────────────
self.addEventListener('periodicsync', (event: Event) => {
  const psEvent = event as ExtendableEvent & { tag: string };
  if (psEvent.tag === 'anc-appointment-check') {
    psEvent.waitUntil(checkAndNotify());
  }
});

// ─── Activate fallback ───────────────────────────────────────────────────────
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await (self as any).clients.claim();
      await checkAndNotify();
    })()
  );
});

// ─── Sync fallback ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event: ExtendableEvent & { tag: string }) => {
  if (event.tag === 'anc-check') {
    event.waitUntil(checkAndNotify());
  }
});

// ─── Notification click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    (self as any).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: WindowClient[]) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return (self as any).clients.openWindow('/');
      })
  );
});
