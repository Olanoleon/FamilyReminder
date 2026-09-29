import { describe, expect, it } from 'vitest';
import { reminderBody } from '../shared/message.ts';
import { zonedToUtc, utcToZoned } from '../shared/time.ts';

const TZ = 'America/Bogota'; // UTC-5, no DST
const start = zonedToUtc('2026-09-30', '17:00', TZ);
const ev = { title: 'Clase de guitarra', who: 'Ricardo', startsAt: start, timezone: TZ };

describe('zonedToUtc', () => {
  it('converts Bogotá wall time to UTC', () => {
    expect(new Date(start).toISOString()).toBe('2026-09-30T22:00:00.000Z');
  });
  it('round-trips', () => {
    expect(utcToZoned(start, TZ)).toEqual({ date: '2026-09-30', time: '17:00' });
  });
  it('handles DST zones', () => {
    expect(new Date(zonedToUtc('2026-07-01', '12:00', 'Europe/Madrid')).toISOString()).toBe('2026-07-01T10:00:00.000Z');
    expect(new Date(zonedToUtc('2026-01-01', '12:00', 'Europe/Madrid')).toISOString()).toBe('2026-01-01T11:00:00.000Z');
  });
  it('rejects garbage', () => {
    expect(zonedToUtc('nope', '17:00', TZ)).toBeNaN();
  });
});

describe('reminderBody', () => {
  it('says mañana for a day-before reminder', () => {
    expect(reminderBody(ev, start - 24 * 3600e3)).toBe('HEYYY guys, Ricardo tiene clase de guitarra mañana a las 17:00');
  });
  it('says hoy for a 2h-before reminder', () => {
    expect(reminderBody(ev, start - 2 * 3600e3)).toBe('HEYYY guys, Ricardo tiene clase de guitarra hoy a las 17:00');
  });
  it('says the weekday within a week', () => {
    expect(reminderBody(ev, start - 3 * 24 * 3600e3)).toBe('HEYYY guys, Ricardo tiene clase de guitarra el mié 30 a las 17:00');
  });
  it('says the date beyond a week', () => {
    expect(reminderBody(ev, start - 7 * 24 * 3600e3)).toBe('HEYYY guys, Ricardo tiene clase de guitarra el 30 de sep a las 17:00');
  });
  it('uses "todos tienen" for the whole crew', () => {
    expect(reminderBody({ ...ev, who: 'Todos', title: 'Firmar permiso' }, start - 3600e3)).toBe('HEYYY guys, todos tienen firmar permiso hoy a las 17:00');
  });
});
