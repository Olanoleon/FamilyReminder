// Timezone helpers shared by the server (notification text) and the web app (form → UTC).

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface Parts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  dow: number; // 0 = domingo
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimezone(tz: string): boolean {
  try { formatter(tz); return true; } catch { return false; }
}

/** Wall-clock parts of an instant as seen in `tz`. */
export function partsInZone(ms: number, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const x of formatter(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, dow };
}

/** Convert a wall-clock date/time in `tz` ("2026-09-30", "17:00") to a UTC instant (ms). NaN if invalid. */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return NaN;
  const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = partsInZone(guess, tz);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wall - shown;
  }
  return guess;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-09-30" and "17:00" for an instant in `tz` (inverse of zonedToUtc). */
export function utcToZoned(ms: number, tz: string) {
  const p = partsInZone(ms, tz);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export const hhmm = (ms: number, tz: string) => {
  const p = partsInZone(ms, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
};

/** "hoy", "mañana", "el vie 3", "el 3 de oct" — how far the event is from the moment the reminder fires. */
export function dayWord(fireMs: number, startMs: number, tz: string): string {
  const a = partsInZone(fireMs, tz);
  const b = partsInZone(startMs, tz);
  const diff = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff < 7) return `el ${DOW[b.dow]} ${b.day}`;
  return `el ${b.day} de ${MON[b.month - 1]}`;
}

/** "mié 30 sep · 15:00" */
export function shortStamp(ms: number, tz: string): string {
  const p = partsInZone(ms, tz);
  return `${DOW[p.dow]} ${p.day} ${MON[p.month - 1]} · ${pad(p.hour)}:${pad(p.minute)}`;
}
