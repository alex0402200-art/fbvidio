-- Jalankan ini di Console D1 (satu-satu atau sekaligus)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

ALTER TABLE links ADD COLUMN user_id INTEGER;
ALTER TABLE links ADD COLUMN views INTEGER NOT NULL DEFAULT 0;
