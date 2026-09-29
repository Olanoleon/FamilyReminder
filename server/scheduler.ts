import { PUSH_TITLE, reminderBody } from '../shared/message.ts';
import { broadcast, type Sender } from './push.ts';
import type { Store } from './store.ts';

/** Fires every due reminder once. Reminders whose event already started are marked skipped instead of sent. */
export async function tick(store: Store, send: Sender, now = Date.now()) {
  let fired = 0;
  store.rollRecurring(now);
  for (const d of store.dueReminders(now)) {
    const stale = d.event.startsAt < now;
    if (!store.claimReminder(d.reminderId, stale)) continue; // claim first → at-most-once, even across restarts/overlapping ticks
    if (stale) continue;
    await broadcast(store, send, {
      title: PUSH_TITLE,
      body: reminderBody(d.event, d.fireAt),
      url: `/#/event/${d.event.id}`,
      tag: `reminder-${d.reminderId}`,
    });
    fired++;
  }
  return fired;
}

export function startScheduler(store: Store, send: Sender, everyMs = 30_000) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await tick(store, send); } catch (e) { console.error('scheduler tick failed', e); } finally { running = false; }
  };
  void run();
  return setInterval(run, everyMs);
}
