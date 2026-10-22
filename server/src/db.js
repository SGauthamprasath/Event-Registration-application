// db.js - opens the SQLite file and creates the tables.
// Every "only once" rule lives here as a PRIMARY KEY / UNIQUE constraint,
// so the database itself rejects duplicates even if two requests race.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'event.db');
fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma('journal_mode = WAL');   // readers don't block the writer: good for many dashboards polling
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email      TEXT PRIMARY KEY,
    name       TEXT,
    department TEXT,
    year       INTEGER,
    roll_no    TEXT UNIQUE,            -- two students can never share a roll number
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    title                TEXT NOT NULL,
    description          TEXT,
    brochure_url         TEXT,
    venue                TEXT,
    starts_at            TEXT NOT NULL,   -- ISO string in UTC
    ends_at              TEXT NOT NULL,
    attendance_closes_at TEXT             -- optional, defaults to ends_at
  );

  CREATE TABLE IF NOT EXISTS registrations (
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    email         TEXT    NOT NULL REFERENCES users(email),
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, email)         -- one registration per student per event
  );

  CREATE TABLE IF NOT EXISTS attendance (
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    email      TEXT    NOT NULL REFERENCES users(email),
    marked_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    device_id  TEXT,                      -- NULL for manual marks
    ip         TEXT,
    user_agent TEXT,
    method     TEXT DEFAULT 'scan',       -- 'scan' or 'manual'
    PRIMARY KEY (event_id, email),        -- one attendance row per student per event
    UNIQUE (event_id, device_id)          -- one phone can mark only one student per event
  );

  CREATE TABLE IF NOT EXISTS login_codes (
    email      TEXT PRIMARY KEY,          -- one live code per email; a new request replaces it
    code_hash  TEXT    NOT NULL,          -- HMAC of the code, never the code itself
    expires_at INTEGER NOT NULL,          -- epoch ms
    attempts   INTEGER NOT NULL DEFAULT 0,
    sent_at    INTEGER NOT NULL           -- epoch ms, for the resend cooldown
  );
`);

module.exports = db;
