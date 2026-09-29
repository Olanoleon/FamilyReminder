import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { openDb } from '../server/db.ts';
import { tick } from '../server/scheduler.ts';
import { createStore } from '../server/store.ts';
import { zonedToUtc } from '../shared/time.ts';

const TZ = 'America/Bogota';
const H = 3600e3;
const start = zonedToUtc('2026-09-30', '17:00', TZ);

function setup(now: number) {
  const store = createStore(openDb(':memory:'), () => now);
  const sent: { endpoint: string; body: any }[] = [];
  let fail: Record<string, number> = {};
  const send = async (sub: any, payload: string) => {
    if (fail[sub.endpoint]) throw Object.assign(new Error('gone'), { statusCode: fail[sub.endpoint] });
    sent.push({ endpoint: sub.endpoint, body: JSON.parse(payload) });
  };
  const app = createApp(store, send, { familyCode: 'SECRET42', vapidPublicKey: 'pub' });
  const call = (path: string, init: RequestInit = {}, code = 'SECRET42') =>
    app.request(`/api${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-family-code': code } });
  return { store, sent, send, call, fail };
}
const body = (o: object) => ({ body: JSON.stringify(o) });
const ev = { title: 'Clase de guitarra', who: 'Ricardo', startsAt: start, timezone: TZ, repeatWeekly: false, offsets: [1440, 120] };
const sub = (n: string) => ({ subscription: { endpoint: `https://push/${n}`, keys: { p256dh: 'p', auth: 'a' } }, deviceName: `iPhone de ${n}`, platform: 'iOS' });

describe('api', () => {
  it('rejects a wrong family code but serves the public vapid key', async () => {
    const { call } = setup(start - 3 * 24 * H);
    expect((await call('/events', {}, 'nope')).status).toBe(401);
    expect((await call('/vapid-key', {}, 'nope')).status).toBe(200);
  });
  it('validates input', async () => {
    const { call } = setup(start - 3 * 24 * H);
    expect((await call('/events', { method: 'POST', ...body({ ...ev, who: 'Papá' }) })).status).toBe(400);
    expect((await call('/events', { method: 'POST', ...body({ ...ev, offsets: [-5] }) })).status).toBe(400);
  });
  it('skips reminders already in the past at creation', async () => {
    const { call } = setup(start - 5 * H); // 1-day reminder is past, 2h one is not
    const res = await (await call('/events', { method: 'POST', ...body(ev) })).json();
    const by = Object.fromEntries(res.reminders.map((r: any) => [r.offsetMinutes, r]));
    expect(by[1440].skipped).toBe(true);
    expect(by[120].skipped).toBe(false);
  });
});

describe('scheduler', () => {
  it('fires each due reminder exactly once to every device', async () => {
    const t = { now: start - 3 * 24 * H };
    const { store, sent, send, call } = setup(0);
    const s2 = createStore(openDb(':memory:'), () => t.now);
    // use a store whose clock we control
    const app = (await import('../server/app.ts')).createApp(s2, send, { familyCode: 'X'.repeat(8), vapidPublicKey: 'k' });
    const c = (p: string, i: RequestInit = {}) => app.request(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-family-code': 'XXXXXXXX' } });
    await c('/subscribe', { method: 'POST', ...body(sub('Leon')) });
    await c('/subscribe', { method: 'POST', ...body(sub('Daniela')) });
    await c('/events', { method: 'POST', ...body(ev) });

    expect(await tick(s2, send, start - 25 * H)).toBe(0);
    expect(await tick(s2, send, start - 24 * H)).toBe(1);
    expect(sent).toHaveLength(2);
    expect(sent[0].body).toMatchObject({ title: 'Family assistant', body: 'HEYYY guys, Ricardo tiene clase de guitarra mañana a las 17:00' });
    expect(await tick(s2, send, start - 24 * H + 60_000)).toBe(0); // no duplicates
    expect(await tick(s2, send, start - 2 * H)).toBe(1);
    expect(sent[2].body.body).toBe('HEYYY guys, Ricardo tiene clase de guitarra hoy a las 17:00');
    void store; void call;
  });
  it('does not send reminders after the event started, and prunes dead devices', async () => {
    const { store, sent, send, fail } = setup(start - 3 * 24 * H);
    store.upsertSub({ endpoint: 'https://push/alive', p256dh: 'p', auth: 'a', deviceName: 'a', platform: 'iOS' });
    store.upsertSub({ endpoint: 'https://push/dead', p256dh: 'p', auth: 'a', deviceName: 'b', platform: 'iOS' });
    fail['https://push/dead'] = 410;
    store.createEvent({ title: 'x', who: 'Todos', startsAt: start, timezone: TZ, repeatWeekly: false, offsets: [120] });
    expect(await tick(store, send, start + H)).toBe(0); // server was down; event over → skipped
    expect(sent).toHaveLength(0);
    store.createEvent({ title: 'y', who: 'Todos', startsAt: start + 5 * H, timezone: TZ, repeatWeekly: false, offsets: [120] });
    expect(await tick(store, send, start + 3 * H)).toBe(1);
    expect(store.listSubs().map((s) => s.endpoint)).toEqual(['https://push/alive']);
  });
});

describe('edit', () => {
  it('keeps already-sent reminders and recomputes pending ones', async () => {
    const { store, send, sent } = setup(start - 3 * 24 * H);
    store.upsertSub({ endpoint: 'https://push/a', p256dh: 'p', auth: 'a', deviceName: 'a', platform: 'iOS' });
    const e = store.createEvent({ ...ev });
    await tick(store, send, start - 24 * H); // 1-day reminder sent
    expect(sent).toHaveLength(1);
    const upd = store.updateEvent(e.id, { ...ev, title: 'Guitarra', offsets: [1440, 30] })!;
    expect(upd.reminders.map((r) => [r.offsetMinutes, r.sentAt !== null])).toEqual([[1440, true], [30, false]]);
    await tick(store, send, start - 24 * H + 1000);
    expect(sent).toHaveLength(1); // not re-sent
    const moved = store.updateEvent(e.id, { ...ev, startsAt: start + 24 * H })!;
    expect(moved.reminders.every((r) => r.sentAt === null)).toBe(true);
  });
});

describe('weekly repeat', () => {
  it('rolls to next week after the occurrence and keeps firing', async () => {
    const { store, send, sent } = setup(start - 3 * 24 * H);
    store.upsertSub({ endpoint: 'https://push/a', p256dh: 'p', auth: 'a', deviceName: 'a', platform: 'iOS' });
    const e = store.createEvent({ ...ev, offsets: [120], repeatWeekly: true });
    await tick(store, send, start - 2 * H);
    expect(sent).toHaveLength(1);
    await tick(store, send, start + H); // occurrence over → rolls a week ahead
    const rolled = store.getEvent(e.id)!;
    expect(rolled.startsAt).toBe(start + 7 * 24 * H);
    expect(rolled.reminders.map((r) => r.sentAt)).toEqual([null]);
    await tick(store, send, start + 7 * 24 * H - 2 * H);
    expect(sent).toHaveLength(2);
    expect(sent[1].body.body).toContain('hoy a las 17:00');
  });
  it('catches up after the server was down for weeks', async () => {
    const { store, send } = setup(start - 3 * 24 * H);
    const e = store.createEvent({ ...ev, offsets: [120], repeatWeekly: true });
    await tick(store, send, start + 20 * 24 * H);
    expect(store.getEvent(e.id)!.startsAt).toBe(start + 21 * 24 * H);
  });
  it('does not roll one-off events', async () => {
    const { store, send } = setup(start - 3 * 24 * H);
    const e = store.createEvent({ ...ev, offsets: [120] });
    await tick(store, send, start + 3 * 24 * H);
    expect(store.getEvent(e.id)!.startsAt).toBe(start);
  });
});
