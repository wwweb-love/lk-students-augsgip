-- Сессии входа (для аналитики админки: входы сегодня, онлайн сейчас)
CREATE TABLE IF NOT EXISTS sessions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sid text NOT NULL UNIQUE,
  ip varchar(45),
  user_agent varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions (last_seen);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions (created_at);

-- Дата регистрации: у существующих записей NULL (неизвестна),
-- новые записи получают now() автоматически
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE students ALTER COLUMN created_at SET DEFAULT now();
