# Family Reminders — "Nave familiar"

A tiny installable web app (PWA) for the family. Anyone creates a task ("Clase de guitarra", Ricardo, mañana 17:00) with any number of reminders (1 día antes, 2 h antes, 45 min antes…). At each reminder time the server sends a **Web Push** to every phone that installed the app:

> **Family assistant** — HEYYY guys, Ricardo tiene clase de guitarra mañana a las 17:00

No accounts. A shared **family code** in the install link keeps strangers from sending pushes.

## Run locally

```bash
npm install
cp .env.example .env          # then fill it:
npm run vapid                 #   paste the two VAPID_* lines into .env
#   FAMILY_CODE=<8+ random characters>
npm run dev:server            # API + scheduler on :8787
npm run dev:web               # UI on :5173 (proxies /api)
```

Open `http://localhost:5173/?k=<FAMILY_CODE>`. Push works on `localhost` in desktop Chrome/Edge/Firefox.
`npm test` runs the unit tests; `npm run build && npm run dev:server` serves the production build from :8787.

## Deploy (Railway)

1. Put this folder in a GitHub repo (Railway deploys from GitHub; `.env` and `data/` are gitignored).
2. Railway → **New Project → Deploy from GitHub repo**. It builds the `Dockerfile` automatically.
3. Service → **Settings → Volumes → Add volume**, mount path `/data` (this is where the SQLite file lives; without it tasks vanish on every deploy).
4. Service → **Variables**: `FAMILY_CODE`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`). Generate keys with `npm run vapid`.
5. Service → **Settings → Networking → Generate Domain**. Keep it at **1 replica** (the scheduler must run in exactly one place).

Keep the same VAPID keys forever — changing them invalidates every phone's subscription.

## Install on each phone

Share `https://<your-app>.up.railway.app/?k=<FAMILY_CODE>` (also under **Tripulación → Copiar enlace de instalación**).

- **Android:** open in Chrome → menu → *Install app* → open it → *Activar notificaciones*.
- **iPhone (iOS 16.4+):** open in **Safari** → Share → *Add to Home Screen* → open the app from the icon → *Activar notificaciones*. iOS only delivers web push to Home-Screen apps.

Then **Tripulación → Enviar prueba a todos** to confirm all phones receive it.

## How it works

- `server/` — Hono API, SQLite (`node:sqlite`, file at `DB_PATH`), scheduler (30 s tick; a reminder is *claimed* before sending so it fires at most once, even across restarts), `web-push`.
- `shared/` — timezone maths and the notification text, used by server and UI (`reminderBody`).
- `web/` — Preact PWA + service worker (`web/public/sw.js`).
- Reminders whose time already passed when a task is saved are skipped; editing recomputes unsent reminders; a task whose start time already passed never fires late reminders.
- Dead subscriptions (uninstalled apps) are pruned when the push service answers 404/410.

Weekly repeat: tick "Repetir cada semana"; once an occurrence passes, the task moves to next week with a fresh set of reminders.
