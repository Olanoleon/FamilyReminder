import { addDays } from '../shared/time.ts';
import type { Db } from './db.ts';

export interface ReminderRow { id: number; offsetMinutes: number; fireAt: number; sentAt: number | null; skipped: boolean }
export interface EventRow { id: number; title: string; who: string; startsAt: number; timezone: string; repeatWeekly: boolean; reminders: ReminderRow[] }
export interface EventInput { title: string; who: string; startsAt: number; timezone: string; repeatWeekly: boolean; offsets: number[] }
export interface SubRow { id: number; endpoint: string; p256dh: string; auth: string; deviceName: string; platform: string; createdAt: number }

export function createStore(db: Db, now: () => number = Date.now) {
  const q = {
    events: db.prepare('SELECT * FROM events ORDER BY starts_at'),
    event: db.prepare('SELECT * FROM events WHERE id = ?'),
    remindersOf: db.prepare('SELECT * FROM reminders WHERE event_id = ? ORDER BY offset_minutes DESC'),
    insEvent: db.prepare('INSERT INTO events (title, who, starts_at, timezone, repeat_weekly, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    updEvent: db.prepare('UPDATE events SET title = ?, who = ?, starts_at = ?, timezone = ?, repeat_weekly = ? WHERE id = ?'),
    delEvent: db.prepare('DELETE FROM events WHERE id = ?'),
    overdueRepeating: db.prepare('SELECT * FROM events WHERE repeat_weekly = 1 AND starts_at < ?'),
    setStart: db.prepare('UPDATE events SET starts_at = ? WHERE id = ?'),
    insReminder: db.prepare('INSERT INTO reminders (event_id, offset_minutes, fire_at, sent_at, skipped) VALUES (?, ?, ?, ?, ?)'),
    delPending: db.prepare('DELETE FROM reminders WHERE event_id = ? AND sent_at IS NULL'),
    delAllReminders: db.prepare('DELETE FROM reminders WHERE event_id = ?'),
    due: db.prepare(`SELECT r.id AS rid, r.fire_at, e.* FROM reminders r JOIN events e ON e.id = r.event_id
                     WHERE r.sent_at IS NULL AND r.fire_at <= ? ORDER BY r.fire_at`),
    claim: db.prepare('UPDATE reminders SET sent_at = ?, skipped = ? WHERE id = ? AND sent_at IS NULL'),
    subs: db.prepare('SELECT * FROM subscriptions ORDER BY created_at'),
    upsertSub: db.prepare(`INSERT INTO subscriptions (endpoint, p256dh, auth, device_name, platform, created_at) VALUES (?, ?, ?, ?, ?, ?)
                           ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, device_name = excluded.device_name, platform = excluded.platform`),
    delSub: db.prepare('DELETE FROM subscriptions WHERE endpoint = ?'),
  };

  const toEvent = (r: any): EventRow => ({
    id: r.id, title: r.title, who: r.who, startsAt: r.starts_at, timezone: r.timezone, repeatWeekly: !!r.repeat_weekly,
    reminders: (q.remindersOf.all(r.id) as any[]).map((x) => ({
      id: x.id, offsetMinutes: x.offset_minutes, fireAt: x.fire_at, sentAt: x.sent_at, skipped: !!x.skipped,
    })),
  });

  const tx = <T>(fn: () => T): T => {
    db.exec('BEGIN');
    try { const out = fn(); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  /** Insert reminders for the given offsets; ones whose fire time already passed are stored as skipped. */
  function addReminders(eventId: number, startsAt: number, offsets: number[], t = now()) {
    for (const off of offsets) {
      const fireAt = startsAt - off * 60_000;
      const past = fireAt <= t;
      q.insReminder.run(eventId, off, fireAt, past ? t : null, past ? 1 : 0);
    }
  }

  return {
    listEvents: () => (q.events.all() as any[]).map(toEvent),
    getEvent: (id: number) => { const r = q.event.get(id); return r ? toEvent(r) : null; },

    createEvent: (i: EventInput) => tx(() => {
      const id = Number(q.insEvent.run(i.title, i.who, i.startsAt, i.timezone, i.repeatWeekly ? 1 : 0, now()).lastInsertRowid);
      addReminders(id, i.startsAt, i.offsets);
      return toEvent(q.event.get(id));
    }),

    /** Edit: unsent reminders are recomputed; reminders already sent are kept (not re-sent) while the start time is unchanged. */
    updateEvent: (id: number, i: EventInput) => tx(() => {
      const cur = q.event.get(id) as any;
      if (!cur) return null;
      q.updEvent.run(i.title, i.who, i.startsAt, i.timezone, i.repeatWeekly ? 1 : 0, id);
      if (cur.starts_at !== i.startsAt) {
        q.delAllReminders.run(id);
        addReminders(id, i.startsAt, i.offsets);
      } else {
        const sent = new Set((q.remindersOf.all(id) as any[]).filter((r) => r.sent_at !== null && !r.skipped).map((r) => r.offset_minutes));
        q.delPending.run(id);
        // drop sent/skipped rows whose offset was deselected
        db.prepare(`DELETE FROM reminders WHERE event_id = ? AND offset_minutes NOT IN (${i.offsets.map(() => '?').join(',') || 'NULL'})`).run(id, ...i.offsets);
        const have = new Set((q.remindersOf.all(id) as any[]).map((r) => r.offset_minutes));
        addReminders(id, i.startsAt, i.offsets.filter((o) => !sent.has(o) && !have.has(o)));
      }
      return toEvent(q.event.get(id));
    }),

    /** Weekly tasks whose occurrence is over move to next week's date with a fresh set of reminders. */
    rollRecurring: (t: number) => tx(() => {
      let rolled = 0;
      for (const e of q.overdueRepeating.all(t) as any[]) {
        const offsets = [...new Set((q.remindersOf.all(e.id) as any[]).map((r) => r.offset_minutes as number))];
        let next = e.starts_at as number;
        while (next < t) next = addDays(next, 7, e.timezone);
        q.setStart.run(next, e.id);
        q.delAllReminders.run(e.id);
        addReminders(e.id, next, offsets, t);
        rolled++;
      }
      return rolled;
    }),

    deleteEvent: (id: number) => Number(q.delEvent.run(id).changes) > 0,

    /** Reminders due now, oldest first. */
    dueReminders: (t: number) => (q.due.all(t) as any[]).map((r) => ({
      reminderId: r.rid as number, fireAt: r.fire_at as number,
      event: { id: r.id as number, title: r.title as string, who: r.who as string, startsAt: r.starts_at as number, timezone: r.timezone as string },
    })),
    /** Atomically claim a reminder (at-most-once). Returns false if another tick already took it. */
    claimReminder: (id: number, skipped: boolean) => Number(q.claim.run(now(), skipped ? 1 : 0, id).changes) === 1,

    listSubs: () => (q.subs.all() as any[]).map((r): SubRow => ({
      id: r.id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, deviceName: r.device_name, platform: r.platform, createdAt: r.created_at,
    })),
    upsertSub: (s: { endpoint: string; p256dh: string; auth: string; deviceName: string; platform: string }) =>
      void q.upsertSub.run(s.endpoint, s.p256dh, s.auth, s.deviceName, s.platform, now()),
    deleteSub: (endpoint: string) => void q.delSub.run(endpoint),
  };
}
export type Store = ReturnType<typeof createStore>;
