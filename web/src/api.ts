export interface Reminder { id: number; offsetMinutes: number; fireAt: number; sentAt: number | null; skipped: boolean }
export interface FamilyEvent { id: number; title: string; who: string; startsAt: number; timezone: string; repeatWeekly: boolean; reminders: Reminder[] }
export interface Device { endpoint: string; deviceName: string; platform: string; createdAt: number }
export interface EventInput { title: string; who: string; startsAt: number; timezone: string; repeatWeekly: boolean; offsets: number[] }

const KEY = 'family-code';
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export const getCode = () => safe(() => localStorage.getItem(KEY) ?? '', '');
export const setCode = (c: string) => safe(() => localStorage.setItem(KEY, c), undefined);
export const clearCode = () => safe(() => localStorage.removeItem(KEY), undefined);

/** Accepts a pasted install link (…/?k=CODE) or the bare code. */
export function parseCode(input: string): string {
  const s = input.trim();
  const m = /[?&#]k=([^&#\s]+)/.exec(s);
  return decodeURIComponent(m ? m[1] : s);
}

export class InvalidCodeError extends Error {}

async function call<T>(path: string, init: RequestInit = {}, code = getCode()): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-family-code': code, ...init.headers },
  });
  if (res.status === 401) throw new InvalidCodeError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const verifyCode = (code: string) => call<unknown>('/events', {}, code);
export const listEvents = () => call<{ now: number; events: FamilyEvent[] }>('/events');
export const createEvent = (e: EventInput) => call<FamilyEvent>('/events', { method: 'POST', body: JSON.stringify(e) });
export const updateEvent = (id: number, e: EventInput) => call<FamilyEvent>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(e) });
export const deleteEvent = (id: number) => call<void>(`/events/${id}`, { method: 'DELETE' });
export const listDevices = () => call<Device[]>('/devices');
export const sendTest = () => call<{ delivered: number; total: number }>('/test', { method: 'POST' });
export const saveSubscription = (subscription: PushSubscriptionJSON, deviceName: string, platform: string) =>
  call<void>('/subscribe', { method: 'POST', body: JSON.stringify({ subscription, deviceName, platform }) });
export const removeSubscription = (endpoint: string) => call<void>('/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
export const getVapidKey = () => fetch('/api/vapid-key').then((r) => r.json() as Promise<{ key: string }>).then((x) => x.key);
