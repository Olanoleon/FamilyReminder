import { getVapidKey, removeSubscription, saveSubscription } from './api';

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const NAME = 'device-name';
export const getDeviceName = () => safe(() => localStorage.getItem(NAME) ?? '', '');
const setDeviceName = (n: string) => safe(() => localStorage.setItem(NAME, n), undefined);

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;
export const platform = () => (isIOS() ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'Otro');
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** iPhone/iPad only deliver web push to apps added to the Home Screen. */
export const needsIOSInstall = () => isIOS() && !isStandalone();

export const registerSW = () => navigator.serviceWorker.register('/sw.js');

/** Never waits on `serviceWorker.ready`: it hangs forever when registration failed (e.g. in-app browsers). */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

const b64ToBytes = (s: string) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function enablePush(deviceName: string): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  await registerSW();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(await getVapidKey()) }));
  await saveSubscription(sub.toJSON(), deviceName, platform());
  setDeviceName(deviceName);
  return 'ok';
}

/** Re-announce this device on every launch so the server stays in sync (e.g. after its database is reset). */
export async function refreshSubscription() {
  const name = getDeviceName();
  const sub = await currentSubscription();
  if (name && sub && Notification.permission === 'granted') await saveSubscription(sub.toJSON(), name, platform());
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await removeSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}
