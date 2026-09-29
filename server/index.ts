import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { realSender } from './push.ts';
import { startScheduler } from './scheduler.ts';
import { createStore } from './store.ts';

const familyCode = process.env.FAMILY_CODE;
if (!familyCode || familyCode.length < 6) throw new Error('FAMILY_CODE must be set (at least 6 characters)');

const store = createStore(openDb());
const send = realSender();
const app = createApp(store, send, { familyCode, vapidPublicKey: process.env.VAPID_PUBLIC_KEY! });

if (existsSync('web/dist')) {
  app.use('*', serveStatic({ root: './web/dist' }));
  app.get('*', serveStatic({ path: './web/dist/index.html' })); // SPA fallback
}

startScheduler(store, send);
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => console.log(`Family Reminders listening on :${port}`));
