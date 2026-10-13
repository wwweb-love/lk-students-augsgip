-- Мессенджер: сообщения между пользователями личного кабинета.
-- Отправитель — пользователь из таблицы students (id).
-- Получатель хранится по СНИЛС (11 цифр) — как и в students_1c / grades_1c:
-- связь через СНИЛС принятая в проекте, сообщение дождётся адресата после регистрации.
-- Имена сторон фиксируются на момент отправки (denormalized) — список диалогов
-- отображается без JOIN к ростеру.
CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  sender_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sender_snils varchar(11) NOT NULL DEFAULT '',
  sender_name varchar(200) NOT NULL DEFAULT '',
  recipient_snils varchar(11) NOT NULL,
  recipient_name varchar(200) NOT NULL DEFAULT '',
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Входящие: непрочитанные и выборка диалога адресата
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON messages (recipient_snils, created_at);
-- Исходящие: выборка «своих» сообщений для списка диалогов
CREATE INDEX IF NOT EXISTS idx_messages_sender_peer ON messages (sender_id, recipient_snils, created_at);
