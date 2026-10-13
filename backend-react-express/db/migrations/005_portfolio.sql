-- Портфолио: документы пользователей хранятся в PostgreSQL (bytea).
-- Отдельная таблица, а не поле в students: одна пользователю — много документов (1:N),
-- бинарные данные не должны раздувать основную таблицу (MVCC переписывает строку целиком).
-- Связь со студентом — user_id FK с каскадным удалением (документы уходят вместе с пользователем).
CREATE TABLE IF NOT EXISTS portfolio_documents (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  filename varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  data bytea NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_documents_user ON portfolio_documents (user_id);
