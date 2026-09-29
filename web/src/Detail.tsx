import { useState } from 'preact/hooks';
import { hhmm, partsInZone, shortStamp } from '../../shared/time';
import { deleteEvent, type FamilyEvent } from './api';
import { Avatar, Icon, Screen, colorFor, offsetLabel } from './common';

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function Detail({ event: e, now, onBack, onDeleted }: { event: FamilyEvent; now: number; onBack: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const p = partsInZone(e.startsAt, e.timezone);
  const t = partsInZone(now, e.timezone);
  const diff = Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(t.year, t.month - 1, t.day)) / 86400000);
  const rel = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : diff === -1 ? 'Ayer' : diff > 0 ? `En ${diff} días` : `Hace ${-diff} días`;
  const reminders = [...e.reminders].sort((a, b) => b.offsetMinutes - a.offsetMinutes);

  async function remove() {
    if (!confirm(`¿Eliminar "${e.title}"? Se cancelarán los avisos que no se han enviado.`)) return;
    setBusy(true);
    try { await deleteEvent(e.id); onDeleted(); } catch { setBusy(false); alert('No se pudo eliminar. Inténtalo de nuevo.'); }
  }

  return (
    <Screen full>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" class="round" onClick={onBack} aria-label="Volver"><Icon name="back" size={22} /></button>
        <span class="eyebrow" style={{ color: 'var(--muted)' }}>Tarea</span>
        <span style={{ width: 44 }} />
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar who={e.who} large />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.08em', color: colorFor(e.who) }}>{e.who.toUpperCase()}</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{e.title}</h1>
        </div>
      </div>

      <div class="grid2" style={{ gap: 10 }}>
        <div class="card flat" style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 16, padding: 14 }}>
          <Icon name="calendar" color="var(--gold)" />
          <span style={{ fontSize: 16, fontWeight: 800 }}>{DOW[p.dow]} {p.day} {MON[p.month - 1]}</span>
          <span class="small">{rel}</span>
        </div>
        <div class="card flat" style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 16, padding: 14 }}>
          <Icon name="clock" color="var(--gold)" />
          <span style={{ fontSize: 16, fontWeight: 800 }}>{hhmm(e.startsAt, e.timezone)}</span>
          <span class="small">{e.timezone}</span>
        </div>
      </div>

      <section class="card rows">
        <h2 style={{ marginBottom: 8 }}>Avisos</h2>
        {reminders.map((r) => {
          const state = r.skipped ? 'off' : r.sentAt !== null ? 'ok' : 'wait';
          return (
            <div class="row" style={{ minHeight: 54 }} key={r.id}>
              <span class={`led ${state === 'off' ? 'off' : state === 'ok' ? 'ok' : ''}`} />
              <div class="grow"><span class={`name${state === 'off' ? ' off' : ''}`}>{offsetLabel(r.offsetMinutes)}</span><span class="sub">{shortStamp(r.fireAt, e.timezone)}</span></div>
              <span class={`state ${state === 'ok' ? 'go' : state === 'wait' ? 'wait' : ''}`}>{state === 'off' ? 'Omitido' : state === 'ok' ? 'Enviado' : 'Pendiente'}</span>
            </div>
          );
        })}
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, border: '2px dashed var(--line)', color: e.repeatWeekly ? 'var(--text)' : 'var(--muted)' }}>
        <Icon name="repeat" />
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Repetir cada semana</span>
        <span class={`pill${e.repeatWeekly ? ' ok' : ''}`}>{e.repeatWeekly ? 'Activado' : 'No'}</span>
      </div>

      <div class="spacer" />
      <div class="grid2">
        <a class="btn" href={`#/edit/${e.id}`} style={{ height: 54, fontSize: 18, fontWeight: 600 }}><Icon name="pencil" size={18} />Editar</a>
        <button type="button" class="btn danger" onClick={remove} disabled={busy}><Icon name="trash" size={18} />Eliminar</button>
      </div>
      <p class="small center">Al editar se recalculan los avisos pendientes. Al eliminar se cancelan los que no se han enviado.</p>
    </Screen>
  );
}
