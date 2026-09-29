import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path = process.env.DB_PATH ?? './data/family.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      who        TEXT NOT NULL,
      starts_at  INTEGER NOT NULL,   -- UTC ms
      timezone   TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id       INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      offset_minutes INTEGER NOT NULL,
      fire_at        INTEGER NOT NULL, -- UTC ms
      sent_at        INTEGER,          -- set once handled (sent or skipped)
      skipped        INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS reminders_due ON reminders(sent_at, fire_at);
    CREATE TABLE IF NOT EXISTS subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      device_name TEXT NOT NULL,
      platform    TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
  `);
  return db;
}
export type Db = ReturnType<typeof openDb>;
