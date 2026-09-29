import { useState } from 'preact/hooks';
import { InvalidCodeError, parseCode, setCode, verifyCode } from './api';
import { Icon, Screen, Stars } from './common';
import { enablePush, getDeviceName, pushSupported } from './push';

export function NoCode({ hadCode, onVerified }: { hadCode: boolean; onVerified: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(hadCode ? 'Ese código no es válido. Pídele el enlace a Leon.' : '');
  const [busy, setBusy] = useState(false);

  async function go(e: Event) {
    e.preventDefault();
    const code = parseCode(text);
    if (!code) return setError('Pega el enlace o el código que te compartió Leon.');
    setBusy(true);
    try { await verifyCode(code); setCode(code); onVerified(); }
    catch (err) { setError(err instanceof InvalidCodeError ? 'Ese código no es válido. Pídele el enlace a Leon.' : 'No hay conexión con la nave. Inténtalo de nuevo.'); setBusy(false); }
  }

  return (
    <Screen full>
      <div class="hero lock" style={{ marginTop: 40 }}><div class="planet"><Icon name="lock" size={48} stroke={2.4} /></div></div>
      <div class="center" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 class="title">Acceso <span style={{ color: 'var(--red-soft)' }}>restringido</span></h1>
        <p class="muted" style={{ fontSize: 16, lineHeight: 1.5 }}>Esta nave es solo para la familia. Abre el enlace de instalación que te compartió Leon, o pégalo aquí.</p>
      </div>
      <form onSubmit={go} style={{ display: 'contents' }}>
        <div class="field">
          <label for="code">Enlace o código</label>
          <input id="code" class="input" type="text" value={text} placeholder="https://…/?k=ABCD" autoCapitalize="off" autoCorrect="off" spellcheck={false}
            aria-invalid={error ? 'true' : undefined} aria-describedby="code-err" onInput={(e) => { setText(e.currentTarget.value); setError(''); }} />
          {error && <span id="code-err" class="err">{error}</span>}
        </div>
        <div class="spacer" />
        <button type="submit" class="btn" disabled={busy}>{busy ? 'Verificando…' : 'Continuar'}</button>
        <p class="small center">No es un inicio de sesión: el código solo evita que extraños envíen avisos.</p>
      </form>
    </Screen>
  );
}

export function IOSInstall() {
  const steps: [string, preact.ComponentChildren, string][] = [
    ['1', <>Toca <b>Compartir</b> en la barra de Safari</>, 'share'],
    ['2', <>Elige <b>Agregar a pantalla de inicio</b></>, 'addSquare'],
    ['3', <>Abre la app desde el ícono y activa los avisos</>, 'bell'],
  ];
  return (
    <Screen full>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <img src="/icon-192.png" alt="" width="56" height="56" style={{ borderRadius: 16, border: '3px solid var(--ink)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'Fredoka', fontSize: 18, fontWeight: 600 }}>Family Reminders</span>
          <span class="small">Nave familiar</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 class="title">Súbela a tu <em>iPhone</em></h1>
        <p class="muted" style={{ fontSize: 15, lineHeight: 1.5 }}>En iPhone los avisos solo funcionan si la app está en tu pantalla de inicio (iOS 16.4 o superior).</p>
      </div>
      <ol class="steps">
        {steps.map(([n, text, icon]) => (
          <li key={n}><span class="n">{n}</span><span style={{ flex: 1 }}>{text}</span><Icon name={icon} size={24} color="var(--cyan)" /></li>
        ))}
      </ol>
      <p class="muted" style={{ fontSize: 14 }}>¿Usas Android? Ábrela en Chrome y activa los avisos directamente.</p>
    </Screen>
  );
}

export function Onboarding({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [name, setName] = useState(getDeviceName());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function activate(e: Event) {
    e.preventDefault();
    if (!name.trim()) return setError('Dinos de quién es este teléfono.');
    setBusy(true); setError('');
    try {
      const r = await enablePush(name.trim());
      if (r === 'ok') return onDone();
      setError(r === 'denied'
        ? 'Los avisos están bloqueados. Actívalos en los ajustes del navegador o del teléfono y vuelve a intentarlo.'
        : 'Este navegador no admite avisos. En iPhone, instala la app en la pantalla de inicio; en Android usa Chrome.');
    } catch { setError('No se pudo activar. Revisa tu conexión e inténtalo de nuevo.'); }
    setBusy(false);
  }

  return (
    <>
      <Stars />
      <Screen full>
        <div class="hero" style={{ marginTop: 28 }}><div class="ring" /><div class="planet"><Icon name="bell" size={52} stroke={2.4} /></div></div>
        <div class="center" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <span class="eyebrow" style={{ color: 'var(--green)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="check" size={14} stroke={3} />Código de la nave verificado</span>
          <h1 class="title" style={{ fontSize: 34 }}>Bienvenido <em>a bordo</em></h1>
          <p class="muted" style={{ fontSize: 16, lineHeight: 1.5 }}>Activa los avisos y este teléfono recibirá cada recordatorio de la familia: clases, tareas, vueltas y permisos.</p>
        </div>
        <form onSubmit={activate} style={{ display: 'contents' }}>
          <div class="field" style={{ marginTop: 8 }}>
            <label for="device">¿De quién es este teléfono?</label>
            <input id="device" class="input" type="text" value={name} placeholder="Ej. iPhone de Daniela" maxLength={60} autoComplete="off"
              onInput={(e) => { setName(e.currentTarget.value); setError(''); }} aria-invalid={error && !name.trim() ? 'true' : undefined} />
            <span class="small">Así lo verá el resto de la tripulación.</span>
          </div>
          {error && <p class="err" role="alert">{error}</p>}
          <div class="spacer" />
          <button type="submit" class="btn" disabled={busy || !pushSupported()}><Icon name="bell" size={22} />{busy ? 'Activando…' : 'Activar notificaciones'}</button>
          <p class="small center">Tu teléfono te pedirá permiso. Puedes desactivarlo cuando quieras en sus ajustes.</p>
          <button type="button" class="link-btn" onClick={onSkip}>Ahora no</button>
        </form>
      </Screen>
    </>
  );
}
