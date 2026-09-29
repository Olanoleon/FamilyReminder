import { useEffect, useState } from 'preact/hooks';
import { getCode, listDevices, removeSubscription, sendTest, type Device } from './api';
import { Icon, Nav, Screen, Stars, memberOf, colorFor } from './common';
import { currentSubscription, disablePush } from './push';

const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function Crew({ onChanged }: { onChanged: () => void }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [mine, setMine] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => listDevices().then(setDevices).catch(() => setDevices([]));
  useEffect(() => { void load(); void currentSubscription().then((s) => setMine(s?.endpoint ?? '')); }, []);

  async function test() {
    setSending(true); setResult(null);
    try {
      const r = await sendTest();
      setResult(r.total === 0
        ? { ok: false, text: 'Ningún teléfono está suscrito todavía.' }
        : { ok: r.delivered === r.total, text: `Enviada a ${r.delivered} de ${r.total} ${r.total === 1 ? 'teléfono' : 'teléfonos'} · justo ahora` });
      void load();
    } catch { setResult({ ok: false, text: 'No se pudo enviar la prueba. Revisa tu conexión.' }); }
    setSending(false);
  }

  async function copy() {
    const link = `${location.origin}/?k=${encodeURIComponent(getCode())}`;
    try { await navigator.clipboard.writeText(link); }
    catch { window.prompt('Copia este enlace de instalación:', link); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  async function leave() {
    if (!confirm('¿Dejar de recibir avisos en este teléfono?')) return;
    await disablePush(); setMine(''); await load(); onChanged();
  }

  async function removeDevice(d: Device) {
    if (!confirm(`¿Quitar "${d.deviceName}" de la tripulación? Dejará de recibir avisos.`)) return;
    try {
      // For this phone, also drop the browser's own subscription, or the app would re-add it on next launch.
      if (d.endpoint === mine) { await disablePush(); setMine(''); } else await removeSubscription(d.endpoint);
      await load(); onChanged();
    } catch { setResult({ ok: false, text: 'No se pudo quitar el teléfono. Inténtalo de nuevo.' }); }
  }

  const code = getCode();
  return (
    <>
      <Stars />
      <Screen>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span class="eyebrow">Nave familiar</span>
          <h1 class="title">Tripulación <em>a bordo</em></h1>
        </header>

        <section class="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>Prueba de comunicaciones</h2>
            <p class="small" style={{ fontSize: 14 }}>Envía un aviso a todos los teléfonos para confirmar que todos lo reciben.</p>
          </div>
          <button type="button" class="btn red" onClick={test} disabled={sending}><Icon name="radio" size={24} />{sending ? 'Enviando…' : 'Enviar prueba a todos'}</button>
          {result && <div class={`toast${result.ok ? '' : ' bad'}`} role="status"><Icon name={result.ok ? 'check' : 'x'} size={18} stroke={3} />{result.text}</div>}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Teléfonos suscritos</h2>
          {devices === null && <p class="muted">Cargando…</p>}
          {devices?.length === 0 && <p class="muted">Todavía no hay teléfonos. Activa los avisos en cada teléfono de la familia.</p>}
          {devices?.map((d) => {
            const m = memberOf(d.deviceName) ?? 'Todos';
            const d0 = new Date(d.createdAt);
            return (
              <div class="device" key={d.endpoint}>
                <div class="avatar" style={{ background: colorFor(m) }}>{d.deviceName.charAt(0).toUpperCase()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{d.deviceName}</span>
                    {d.endpoint === mine && <span class="tag">ESTE</span>}
                  </div>
                  <span class="small">{d.platform} · suscrito el {d0.getDate()} {MON[d0.getMonth()]}</span>
                </div>
                <span aria-label="Activo" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)' }} />
                <button type="button" class="round" onClick={() => removeDevice(d)} aria-label={`Quitar ${d.deviceName}`} style={{ color: 'var(--red-soft)' }}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            );
          })}
          <p class="small">Si alguien desinstala la app, su teléfono sale de la lista automáticamente.</p>
          {mine && <button type="button" class="link-btn" onClick={leave} style={{ alignSelf: 'flex-start', padding: '4px 0' }}>Dejar de recibir avisos en este teléfono</button>}
        </section>

        <section class="card flat" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="shield" size={24} color="var(--gold)" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Código de la nave</span>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 15, color: 'var(--soft)' }}>••••-{code.slice(-4)}</span>
            </div>
          </div>
          <button type="button" class="btn ghost" onClick={copy}>{copied ? 'Enlace copiado' : 'Copiar enlace de instalación'}</button>
          <p class="small">Compártelo solo con la familia. No es una contraseña: evita que extraños envíen avisos.</p>
        </section>
      </Screen>
      <Nav current="crew" />
    </>
  );
}
