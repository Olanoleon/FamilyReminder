import { useEffect, useMemo, useState } from 'preact/hooks';
import { reminderBody } from '../../shared/message';
import { hhmm, partsInZone } from '../../shared/time';
import type { FamilyEvent } from './api';
import { Avatar, Bip, Icon, Nav, Screen, Stars, offsetLabel } from './common';

const DOW = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MON = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dayKey = (ms: number) => { const p = partsInZone(ms, deviceTz); return p.year * 10000 + p.month * 100 + p.day; };
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function dayHeading(ms: number, now: number) {
  const p = partsInZone(ms, deviceTz);
  const base = `${DOW[p.dow]} ${p.day} ${MON[p.month - 1]}`;
  if (dayKey(ms) === dayKey(now)) return `HOY · ${base}`;
  if (dayKey(ms) === dayKey(now + 86400000)) return `MAÑANA · ${base}`;
  return base;
}

function whenLabel(fireAt: number, now: number) {
  const p = partsInZone(fireAt, deviceTz);
  const t = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  const k = dayKey(fireAt);
  if (k === dayKey(now)) return `HOY ${t}`;
  if (k === dayKey(now + 86400000)) return `MAÑANA ${t}`;
  return `${DOW[p.dow]} ${p.day} ${MON[p.month - 1]} ${t}`;
}

export function Home({ events, now, deviceCount }: { events: FamilyEvent[]; now: number; deviceCount: number }) {
  const upcoming = useMemo(() => {
    const p = partsInZone(now, deviceTz);
    const startOfToday = now - (p.hour * 60 + p.minute) * 60000;
    return events.filter((e) => e.startsAt >= startOfToday).sort((a, b) => a.startsAt - b.startsAt);
  }, [events, now]);

  const pending = useMemo(
    () => events.flatMap((e) => e.reminders.filter((r) => r.sentAt === null).map((r) => ({ e, r }))).sort((a, b) => a.r.fireAt - b.r.fireAt),
    [events],
  );
  const weekEnd = now + 7 * 86400000;
  const weekTasks = upcoming.filter((e) => e.startsAt <= weekEnd).length;

  // Bip reads out upcoming reminders, typewriter-style.
  const msgs = pending.slice(0, 5).map(({ e, r }) => ({ when: whenLabel(r.fireAt, now), text: reminderBody(e, r.fireAt) }));
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const cur = msgs.length ? msgs[i % msgs.length] : { when: 'TODO EN ORDEN', text: 'Todo tranquilo, tripulación. Toca + para agregar una tarea y yo aviso a todos.' };
  useEffect(() => {
    if (reduceMotion()) { setN(cur.text.length); return; }
    const id = setInterval(() => setN((x) => Math.min(x + 1, cur.text.length)), 35);
    return () => clearInterval(id);
  }, [cur.text]);
  useEffect(() => setN(0), [cur.text]);
  const talking = n < cur.text.length;

  const groups: { key: number; heading: string; items: FamilyEvent[] }[] = [];
  for (const e of upcoming) {
    const key = dayKey(e.startsAt);
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, heading: dayHeading(e.startsAt, now), items: [] }));
    g.items.push(e);
  }

  return (
    <>
      <Stars />
      <Screen>
        <header style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span class="eyebrow">Nave familiar</span>
            <a href="#/crew" class="chip" style={{ height: 36, textDecoration: 'none', color: 'var(--text)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green)' }} />{deviceCount} a bordo
            </a>
          </div>
          <h1 class="title">Tareas de la <em>tripulación</em></h1>
          <p class="muted">{weekTasks} {weekTasks === 1 ? 'tarea' : 'tareas'} esta semana · {pending.length} {pending.length === 1 ? 'aviso programado' : 'avisos programados'}</p>
          <div class="bip-row">
            <button type="button" class="bip-btn" onClick={() => { setI((x) => (x + 1) % Math.max(msgs.length, 1)); }} aria-label="Escuchar el siguiente aviso">
              <Bip talking={talking} />
            </button>
            <div class="bubble" role="status" aria-live="polite" key={cur.text}>
              <span class="who">BIP · {cur.when}</span>
              <span class="msg">{cur.text.slice(0, n)}{talking && <span class="caret" />}</span>
            </div>
          </div>
          {msgs.length > 1 && <span class="small" style={{ paddingLeft: 8 }}>Toca a Bip para escuchar el siguiente aviso · {(i % msgs.length) + 1} de {msgs.length}</span>}
        </header>

        {groups.length === 0 && (
          <div class="empty card flat">
            <p class="muted">Aún no hay tareas próximas.</p>
            <a class="btn" href="#/new" style={{ padding: '0 22px' }}><Icon name="plus" size={20} stroke={3} />Nueva tarea</a>
          </div>
        )}

        {groups.map((g) => (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} key={g.key}>
            <div class="day">{g.heading}</div>
            {g.items.map((e) => <TaskCard e={e} now={now} key={e.id} />)}
          </section>
        ))}
      </Screen>
      <Nav current="home" />
    </>
  );
}

function TaskCard({ e, now }: { e: FamilyEvent; now: number }) {
  const rs = e.reminders.filter((r) => !r.skipped).sort((a, b) => b.offsetMinutes - a.offsetMinutes);
  const next = rs.find((r) => r.sentAt === null);
  return (
    <a class="task" href={`#/event/${e.id}`}>
      <Avatar who={e.who} />
      <div class="body">
        <div class="t">{e.title}</div>
        <div class="w">{hhmm(e.startsAt, e.timezone)} · {e.who}</div>
        <div class="chips" style={{ gap: 6 }}>
          {rs.map((r) =>
            r.sentAt !== null ? (
              <span class="pill ok" key={r.id}><Icon name="check" size={12} stroke={3} />{offsetLabel(r.offsetMinutes, '')} · enviado</span>
            ) : (
              <span class="pill" key={r.id}>
                {r === next && <Icon name="bell" size={12} />}
                {r === next ? `${offsetLabel(r.offsetMinutes)} · ${hhmm(r.fireAt, e.timezone)}` : offsetLabel(r.offsetMinutes, '')}
              </span>
            ),
          )}
          {e.repeatWeekly && <span class="pill"><Icon name="repeat" size={12} />cada semana</span>}
          {rs.length === 0 && <span class="pill">Sin avisos</span>}
        </div>
      </div>
    </a>
  );
}
