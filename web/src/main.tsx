import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import './styles.css';
import { clearCode, getCode, InvalidCodeError, listDevices, listEvents, setCode, type FamilyEvent } from './api';
import { Crew } from './Crew';
import { Detail } from './Detail';
import { EventForm } from './EventForm';
import { IOSInstall, NoCode, Onboarding } from './Gate';
import { Home } from './Home';
import { currentSubscription, needsIOSInstall, pushSupported, refreshSubscription, registerSW } from './push';

type Route = { name: 'home' | 'new' | 'crew' } | { name: 'event' | 'edit'; id: number };
function parseHash(): Route {
  const m = /^#\/(new|crew|event|edit)(?:\/(\d+))?/.exec(location.hash);
  if (!m) return { name: 'home' };
  if (m[1] === 'event' || m[1] === 'edit') return m[2] ? { name: m[1], id: Number(m[2]) } : { name: 'home' };
  return { name: m[1] as 'new' | 'crew' };
}
const go = (hash: string) => { location.hash = hash; };

// Install links carry the family code: /?k=CODE. Keep it, then strip it from the address bar.
const fromUrl = new URLSearchParams(location.search).get('k');
if (fromUrl) { setCode(fromUrl); history.replaceState(null, '', location.pathname + location.hash); }

type Phase = 'loading' | 'nocode' | 'ios' | 'onboarding' | 'ready';

function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [badCode, setBadCode] = useState(false);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [deviceCount, setDeviceCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [route, setRoute] = useState<Route>(parseHash());
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { const f = () => setRoute(parseHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);

  const refresh = useCallback(async () => {
    try {
      const [ev, devs] = await Promise.all([listEvents(), listDevices()]);
      setEvents(ev.events); setDeviceCount(devs.length); setNow(Date.now()); setLoadError(false);
      return true;
    } catch (e) {
      if (e instanceof InvalidCodeError) { setBadCode(true); clearCode(); setPhase('nocode'); }
      else setLoadError(true);
      return false;
    }
  }, []);

  const boot = useCallback(async () => {
    if (!getCode()) return setPhase('nocode');
    if (pushSupported()) registerSW().catch((e) => console.warn('service worker unavailable', e));
    if (!(await refresh())) return;
    if (needsIOSInstall()) return setPhase('ios');
    if (pushSupported()) {
      const sub = await currentSubscription().catch(() => null);
      if (sub && Notification.permission === 'granted') void refreshSubscription().catch(() => {});
      else if (!sessionStorage.getItem('skip-onboarding')) return setPhase('onboarding');
    }
    setPhase('ready');
  }, [refresh]);

  useEffect(() => { void boot(); }, [boot]);

  // keep the list fresh: every 30 s and whenever the app comes back to the foreground
  useEffect(() => {
    if (phase !== 'ready') return;
    const tick = () => void refresh();
    const id = setInterval(tick, 30_000);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [phase, refresh]);

  if (phase === 'loading') return <div class="app"><p class="muted center" style={{ marginTop: 120 }}>Cargando la nave…</p></div>;
  if (phase === 'nocode') return <div class="app"><NoCode hadCode={badCode} onVerified={() => { setBadCode(false); setPhase('loading'); void boot(); }} /></div>;
  if (phase === 'ios') return <div class="app"><IOSInstall /></div>;
  if (phase === 'onboarding') {
    return <div class="app"><Onboarding onDone={() => { void refresh(); setPhase('ready'); }} onSkip={() => { sessionStorage.setItem('skip-onboarding', '1'); setPhase('ready'); }} /></div>;
  }

  const byId = (id: number) => events.find((e) => e.id === id);
  let view;
  switch (route.name) {
    case 'new':
      view = <EventForm now={now} onBack={() => go('#/')} onDone={async () => { await refresh(); go('#/'); }} />; break;
    case 'edit': {
      const ev = byId(route.id);
      view = ev ? <EventForm existing={ev} now={now} onBack={() => go(`#/event/${ev.id}`)} onDone={async (id) => { await refresh(); go(`#/event/${id}`); }} /> : <Missing />;
      break;
    }
    case 'event': {
      const ev = byId(route.id);
      view = ev ? <Detail event={ev} now={now} onBack={() => go('#/')} onDeleted={async () => { await refresh(); go('#/'); }} /> : <Missing />;
      break;
    }
    case 'crew': view = <Crew onChanged={() => void refresh()} />; break;
    default: view = <Home events={events} now={now} deviceCount={deviceCount} />;
  }
  return (
    <div class="app">
      {loadError && <p class="err center" role="alert" style={{ padding: '8px 16px', background: 'var(--card)' }}>Sin conexión con la nave. Reintentando…</p>}
      {view}
    </div>
  );
}

function Missing() {
  return (
    <main class="screen full" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 100 }}>
      <h1 class="title">Tarea no encontrada</h1>
      <p class="muted">Puede que ya se haya eliminado.</p>
      <a class="btn" href="#/" style={{ padding: '0 24px' }}>Volver a las tareas</a>
    </main>
  );
}

render(<App />, document.getElementById('app')!);
