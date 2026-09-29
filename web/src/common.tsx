import type { ComponentChildren } from 'preact';

const PATHS: Record<string, string[]> = {
  bell: ['M10.268 21a2 2 0 0 0 3.464 0', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  tasks: ['M8 2h8v4H8z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M12 11h4', 'M12 16h4', 'M8 11h.01', 'M8 16h.01'],
  plus: ['M5 12h14', 'M12 5v14'],
  back: ['m15 18-6-6 6-6'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  calendar: ['M3 4h18v18H3z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
  repeat: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
  pencil: ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'],
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  radio: ['M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M16.24 7.76a6 6 0 0 1 0 8.49', 'M4.93 19.07a10 10 0 0 1 0-14.14', 'M7.76 16.24a6 6 0 0 1 0-8.49', 'M19.07 4.93a10 10 0 0 1 0 14.14'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  share: ['M12 2v13', 'm16 6-4-4-4 4', 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'],
  addSquare: ['M3 3h18v18H3z', 'M8 12h8', 'M12 8v8'],
  lock: ['M3 11h18v11H3z', 'M7 11V7a5 5 0 0 1 10 0v4'],
};

export function Icon({ name, size = 20, stroke = 2.5, color }: { name: keyof typeof PATHS | string; size?: number; stroke?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} stroke-width={stroke}
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export const CREW: Record<string, string> = { Ricardo: '#e4344b', Daniela: '#36d6e7', Leon: '#8be04e', Todos: '#f5c518' };
export const colorFor = (who: string) => CREW[who] ?? '#f5c518';
/** Device names are free text ("iPhone de Daniela"); pick the member color if a name is in there. */
export const memberOf = (text: string) => Object.keys(CREW).find((n) => n !== 'Todos' && text.toLowerCase().includes(n.toLowerCase()));

export function Avatar({ who, large }: { who: string; large?: boolean }) {
  return (
    <div class={`avatar${large ? ' lg' : ''}`} style={{ background: colorFor(who) }}>
      {who === 'Todos' ? <Icon name="users" size={large ? 30 : 20} /> : who.charAt(0).toUpperCase()}
    </div>
  );
}

export function Stars() { return <div class="stars" aria-hidden="true" />; }

export function Bip({ talking }: { talking: boolean }) {
  return (
    <svg width="110" height="120" viewBox="0 0 120 130" aria-hidden="true">
      <ellipse class="bip-shadow" cx="60" cy="124" rx="26" ry="4" fill="#000" opacity="0.4" />
      <g class="bip-bob">
        <line x1="60" y1="26" x2="60" y2="12" stroke="#05070f" stroke-width="4" stroke-linecap="round" />
        <circle class="bip-light" cx="60" cy="9" r="6" fill="#f5c518" stroke="#05070f" stroke-width="3" />
        <circle class="bip-hand" cx="16" cy="78" r="9" fill="#a78bfa" stroke="#05070f" stroke-width="4" />
        <circle class={`bip-hand${talking ? ' bip-wave' : ''}`} cx="104" cy="78" r="9" fill="#a78bfa" stroke="#05070f" stroke-width="4" />
        <circle cx="60" cy="68" r="40" fill="#a78bfa" stroke="#05070f" stroke-width="5" />
        <path d="M38 44 A30 30 0 0 1 56 35" stroke="#ddd3ff" stroke-width="5" fill="none" stroke-linecap="round" />
        <rect x="32" y="50" width="56" height="36" rx="16" fill="#0b1020" stroke="#05070f" stroke-width="3" />
        <g class="bip-eyes"><circle cx="48" cy="63" r="5" fill="#36d6e7" /><circle cx="72" cy="63" r="5" fill="#36d6e7" /></g>
        <rect class={`bip-mouth${talking ? ' bip-talk' : ''}`} x="53" y="74" width="14" height="4" rx="2" fill="#36d6e7" />
        <ellipse cx="40" cy="95" rx="5" ry="3" fill="#ff8fb1" opacity="0.8" />
        <ellipse cx="80" cy="95" rx="5" ry="3" fill="#ff8fb1" opacity="0.8" />
      </g>
    </svg>
  );
}

export function Nav({ current }: { current: 'home' | 'crew' | 'none' }) {
  return (
    <nav class="nav" aria-label="Principal">
      <div class="nav-inner">
        <a class="tab" href="#/" aria-current={current === 'home' ? 'page' : undefined}><Icon name="tasks" size={24} />Tareas</a>
        <a class="fab" href="#/new" aria-label="Nueva tarea"><Icon name="plus" size={28} stroke={3} /></a>
        <a class="tab" href="#/crew" aria-current={current === 'crew' ? 'page' : undefined}><Icon name="users" size={24} />Tripulación</a>
      </div>
    </nav>
  );
}

export function Screen({ children, full }: { children: ComponentChildren; full?: boolean }) {
  return <main class={`screen${full ? ' full' : ''}`}>{children}</main>;
}

export function Notice({ text }: { text: string }) {
  return (
    <div class="notif">
      <div class="app-ico"><Icon name="bell" /></div>
      <div><b>Family assistant</b><span>{text}</span></div>
    </div>
  );
}

// ---- reminder labels -------------------------------------------------------
export function offsetLabel(min: number, suffix = ' antes'): string {
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  let s: string;
  if (min % 10080 === 0) s = n(min / 10080, 'semana', 'semanas');
  else if (min % 1440 === 0) s = n(min / 1440, 'día', 'días');
  else if (min % 60 === 0) s = `${min / 60} h`;
  else s = `${min} min`;
  return s + suffix;
}
export const PRESETS = [10080, 1440, 120, 30];
