import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT,
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  stage         TEXT NOT NULL,
  team_a        TEXT NOT NULL,
  team_b        TEXT NOT NULL,
  kickoff       TEXT,                       -- מועד פתיחה (ISO). אחרי המועד הניחושים ננעלים.
  locked        INTEGER NOT NULL DEFAULT 0, -- נעילה ידנית של האדמין
  result_entered INTEGER NOT NULL DEFAULT 0,
  actual_winner TEXT,                       -- 'A' או 'B' (מי שעלה הלאה)
  actual_score_a INTEGER,                   -- תוצאת 90 דקות
  actual_score_b INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  match_id   INTEGER NOT NULL,
  winner     TEXT NOT NULL,   -- 'A' או 'B'
  score_a    INTEGER NOT NULL,
  score_b    INTEGER NOT NULL,
  points     INTEGER NOT NULL DEFAULT 0,
  scored     INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, match_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (match_id) REFERENCES matches(id)
);
`);

// --- מיגרציות בטוחות: הוספת עמודות לחיבור ל-API כדורגל ---
const matchCols = db.prepare("PRAGMA table_info(matches)").all().map((c) => c.name);
if (!matchCols.includes('provider_fixture_id')) {
  db.exec("ALTER TABLE matches ADD COLUMN provider_fixture_id TEXT"); // מזהה המשחק ב-API
}
if (!matchCols.includes('provider_home_is_a')) {
  db.exec("ALTER TABLE matches ADD COLUMN provider_home_is_a INTEGER NOT NULL DEFAULT 1"); // האם 'home' ב-API = נבחרת א'
}
