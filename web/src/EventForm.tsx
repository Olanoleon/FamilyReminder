import { useState } from 'preact/hooks';
import { WHO } from '../../shared/message';
import { reminderBody } from '../../shared/message';
import { shortStamp, utcToZoned, zonedToUtc } from '../../shared/time';
import { createEvent, updateEvent, type FamilyEvent } from './api';
import { Icon, Notice, PRESETS, Screen, colorFor, offsetLabel } from './common';

const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ZONES = [...new Set([deviceTz, 'America/Bogota', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid'])];
const UNIT: Record<string, number> = { min: 1, h: 60, d: 1440 };

function defaults(now: number) {
  const t = utcToZoned(now + 86400000, deviceTz);
  return { title: '', who: 'Todos', date: t.date, time: '17:00', tz: deviceTz, offsets: [1440, 120] };
}

export function EventForm({ existing, now, onDone, onBack }: { existing?: FamilyEvent; now: number; onDone: (id: number) => void; onBack: () => void }) {
  const init = existing
    ? { title: existing.title, who: existing.who, ...utcToZoned(existing.startsAt, existing.timezone), tz: existing.timezone,
        offsets: existing.reminders.map((r) => r.offsetMinutes) }
    : defaults(now);
  const [title, setTitle] = useState(init.title);
  const [who, setWho] = useState(init.who);
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [tz, setTz] = useState(init.tz);
  const [offsets, setOffsets] = useState<number[]>(init.offsets);
  const [showCustom, setShowCustom] = useState(false);
  const [cVal, setCVal] = useState('45');
  const [cUnit, setCUnit] = useState('min');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = zonedToUtc(date, time, tz);
  const valid = Number.isFinite(start);
  const zones = ZONES.includes(tz) ? ZONES : [tz, ...ZONES];
  const chips = [...PRESETS, ...offsets.filter((o) => !PRESETS.includes(o))].sort((a, b) => b - a);
  const toggle = (o: number) => setOffsets((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]));

  const rows = [...offsets].sort((a, b) => b - a).map((o) => {
    const fire = start - o * 60000;
    return { o, fire, past: !valid || fire <= now };
  });
  const live = rows.filter((r) => !r.past);
  const first = live[0];
  const preview = first ? reminderBody({ title: title || 'algo', who, startsAt: start, timezone: tz }, first.fire) : '';

  const addCustom = () => {
    const v = parseInt(cVal, 10);
    if (!(v > 0)) return;
    const min = v * UNIT[cUnit];
    setOffsets((cur) => (cur.includes(min) ? cur : [...cur, min]));
    setShowCustom(false);
  };

  async function save() {
    setError('');
    if (!title.trim()) return setError('Escribe qué hay que hacer.');
    if (!valid) return setError('La fecha u hora no es válida.');
    if (offsets.length === 0) return setError('Elige al menos un aviso.');
    if (start <= now) return setError('La tarea debe ser en el futuro.');
    setBusy(true);
    try {
      const input = { title: title.trim(), who, startsAt: start, timezone: tz, offsets };
      const saved = existing ? await updateEvent(existing.id, input) : await createEvent(input);
      onDone(saved.id);
    } catch {
      setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
      setBusy(false);
    }
  }

  return (
    <Screen full>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" class="round" onClick={onBack} aria-label="Volver"><Icon name="back" size={22} /></button>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>{existing ? 'Editar tarea' : 'Nueva tarea'}</h1>
      </header>

      <div class="field">
        <label for="title">¿Qué hay que hacer?</label>
        <input id="title" class="input" type="text" value={title} maxLength={120} placeholder="Ej. Clase de guitarra" autoComplete="off"
          onInput={(e) => setTitle(e.currentTarget.value)} />
      </div>

      <div class="field">
        <span class="label" id="who-l">¿Para quién?</span>
        <div class="crew-pick" role="group" aria-labelledby="who-l">
          {WHO.map((w) => (
            <button type="button" class="pick" key={w} aria-pressed={who === w} onClick={() => setWho(w)}
              style={who === w ? { background: colorFor(w) } : undefined}>
              <span class="dot" style={{ background: colorFor(w) }} />{w}
            </button>
          ))}
        </div>
      </div>

      <div class="grid2">
        <div class="field"><label for="date">Fecha</label><input id="date" class="input" type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} /></div>
        <div class="field"><label for="time">Hora</label><input id="time" class="input" type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} /></div>
      </div>

      <div class="field">
        <label for="tz">Zona horaria</label>
        <select id="tz" class="input sm" value={tz} onChange={(e) => setTz(e.currentTarget.value)}>
          {zones.map((z) => <option value={z} key={z}>{z}{z === deviceTz ? ' (este teléfono)' : ''}</option>)}
        </select>
      </div>

      <div class="field" style={{ gap: 10 }}>
        <span class="label">Avisar a la tripulación</span>
        <div class="chips">
          {chips.map((o) => (
            <button type="button" class="chip" key={o} aria-pressed={offsets.includes(o)} onClick={() => toggle(o)}
              aria-label={`${offsetLabel(o)}${offsets.includes(o) ? ', activado' : ''}`}>
              {offsets.includes(o) && <Icon name={PRESETS.includes(o) ? 'check' : 'x'} size={14} stroke={3} />}
              {offsetLabel(o)}
            </button>
          ))}
          <button type="button" class="chip add" onClick={() => setShowCustom((s) => !s)}><Icon name="plus" size={14} stroke={3} />Personalizado</button>
        </div>
        {showCustom && (
          <div class="custom">
            <div class="field" style={{ width: 84 }}>
              <label for="cval">Cantidad</label>
              <input id="cval" class="input sm" type="number" min="1" value={cVal} onInput={(e) => setCVal(e.currentTarget.value)} />
            </div>
            <div class="field" style={{ flex: 1 }}>
              <label for="cunit">Unidad</label>
              <select id="cunit" class="input sm" value={cUnit} onChange={(e) => setCUnit(e.currentTarget.value)}>
                <option value="min">minutos antes</option><option value="h">horas antes</option><option value="d">días antes</option>
              </select>
            </div>
            <button type="button" class="btn" onClick={addCustom}>Añadir</button>
          </div>
        )}
      </div>

      <section class="card rows" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <h2>Avisos programados</h2>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)' }}>{live.length} {live.length === 1 ? 'aviso programado' : 'avisos programados'}</span>
        </div>
        {rows.map((r) => (
          <div class="row" key={r.o}>
            <div class={`ico${r.past ? ' off' : ''}`}><Icon name="bell" size={16} /></div>
            <div class="grow"><span class={`name${r.past ? ' off' : ''}`}>{offsetLabel(r.o)}</span><span class="sub">{valid ? shortStamp(r.fire, tz) : 'Fecha no válida'}</span></div>
            <span class={`state${r.past ? '' : ' go'}`}>{r.past ? 'Se omite · ya pasó' : 'Programado'}</span>
          </div>
        ))}
        {rows.length === 0 && <p class="muted" style={{ fontSize: 14, padding: '12px 0 4px' }}>Elige al menos un aviso.</p>}
      </section>

      {first && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span class="eyebrow" style={{ color: 'var(--muted)' }}>Así llegará · {offsetLabel(first.o).toUpperCase()}</span>
          <Notice text={preview} />
        </section>
      )}

      {error && <p class="err" role="alert">{error}</p>}
      <button type="button" class="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : existing ? 'Guardar cambios' : 'Guardar tarea'}</button>
    </Screen>
  );
}
