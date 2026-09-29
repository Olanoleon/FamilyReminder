import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { PUSH_TITLE, WHO } from '../shared/message.ts';
import { isValidTimezone } from '../shared/time.ts';
import { broadcast, type Sender } from './push.ts';
import type { EventInput, Store } from './store.ts';

interface Opts { familyCode: string; vapidPublicKey: string }

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function parseEvent(b: any): EventInput | string {
  const title = typeof b?.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 120) return 'title';
  if (!(WHO as readonly string[]).includes(b?.who)) return 'who';
  if (!Number.isFinite(b?.startsAt)) return 'startsAt';
  if (typeof b?.timezone !== 'string' || !isValidTimezone(b.timezone)) return 'timezone';
  const offsets: unknown = b?.offsets;
  if (!Array.isArray(offsets) || offsets.length > 20 || !offsets.every((o) => Number.isInteger(o) && o > 0 && o <= 60 * 24 * 365)) return 'offsets';
  return { title, who: b.who, startsAt: Math.round(b.startsAt), timezone: b.timezone, offsets: [...new Set(offsets as number[])] };
}

export function createApp(store: Store, send: Sender, opts: Opts) {
  const app = new Hono();
  const api = new Hono();

  // Public: the browser needs this key to subscribe (it is public by design).
  api.get('/vapid-key', (c) => c.json({ key: opts.vapidPublicKey }));

  // Everything else needs the shared family code. It is not a login — it only keeps strangers from sending pushes.
  api.use('*', async (c, next) => {
    if (c.req.path.endsWith('/vapid-key')) return next();
    const code = c.req.header('x-family-code') ?? '';
    if (!safeEqual(code, opts.familyCode)) return c.json({ error: 'invalid_code' }, 401);
    return next();
  });

  api.get('/events', (c) => c.json({ now: Date.now(), events: store.listEvents() }));

  api.post('/events', async (c) => {
    const p = parseEvent(await c.req.json().catch(() => null));
    if (typeof p === 'string') return c.json({ error: `invalid_${p}` }, 400);
    return c.json(store.createEvent(p), 201);
  });

  api.put('/events/:id', async (c) => {
    const p = parseEvent(await c.req.json().catch(() => null));
    if (typeof p === 'string') return c.json({ error: `invalid_${p}` }, 400);
    const ev = store.updateEvent(Number(c.req.param('id')), p);
    return ev ? c.json(ev) : c.json({ error: 'not_found' }, 404);
  });

  api.delete('/events/:id', (c) => (store.deleteEvent(Number(c.req.param('id'))) ? c.body(null, 204) : c.json({ error: 'not_found' }, 404)));

  api.get('/devices', (c) =>
    c.json(store.listSubs().map(({ endpoint, deviceName, platform, createdAt }) => ({ endpoint, deviceName, platform, createdAt }))));

  api.post('/subscribe', async (c) => {
    const b: any = await c.req.json().catch(() => null);
    const s = b?.subscription;
    const name = typeof b?.deviceName === 'string' ? b.deviceName.trim().slice(0, 60) : '';
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth || !name) return c.json({ error: 'invalid_subscription' }, 400);
    const platform = ['iOS', 'Android'].includes(b.platform) ? b.platform : 'Otro';
    store.upsertSub({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, deviceName: name, platform });
    return c.json({ ok: true }, 201);
  });

  api.post('/unsubscribe', async (c) => {
    const b: any = await c.req.json().catch(() => null);
    if (typeof b?.endpoint === 'string') store.deleteSub(b.endpoint);
    return c.body(null, 204);
  });

  api.post('/test', async (c) =>
    c.json(await broadcast(store, send, {
      title: PUSH_TITLE, body: 'HEYYY guys, esto es una prueba de comunicaciones. Si lo lees, todo funciona.', tag: 'test',
    })));

  app.route('/api', api);
  return app;
}
