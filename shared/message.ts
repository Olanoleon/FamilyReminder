import { dayWord, hhmm } from './time.ts';

export const PUSH_TITLE = 'Family assistant';
export const WHO = ['Ricardo', 'Daniela', 'Leon', 'Todos'] as const;
export type Who = (typeof WHO)[number];

/** Body of the push notification, e.g. "HEYYY guys, Ricardo tiene clase de guitarra mañana a las 17:00". */
export function reminderBody(e: { title: string; who: string; startsAt: number; timezone: string }, fireMs: number): string {
  const who = e.who === 'Todos' ? 'todos tienen' : `${e.who} tiene`;
  const t = e.title.trim();
  const title = t.charAt(0).toLowerCase() + t.slice(1);
  return `HEYYY guys, ${who} ${title} ${dayWord(fireMs, e.startsAt, e.timezone)} a las ${hhmm(e.startsAt, e.timezone)}`;
}
