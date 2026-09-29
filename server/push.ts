import webpush from 'web-push';
import type { Store } from './store.ts';

export interface Notice { title: string; body: string; url?: string; tag?: string }
export type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;

export function realSender(): Sender {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set (run `npm run vapid`)');
  webpush.setVapidDetails(VAPID_SUBJECT ?? 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 60 * 60 });
}

/** Push a notice to every subscribed phone; prunes subscriptions the push service says are gone. */
export async function broadcast(store: Store, send: Sender, notice: Notice) {
  const subs = store.listSubs();
  let delivered = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(notice));
      delivered++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) store.deleteSub(s.endpoint);
      else console.error(`push to "${s.deviceName}" failed:`, err?.statusCode ?? err?.message ?? err);
    }
  }));
  return { delivered, total: subs.length };
}
