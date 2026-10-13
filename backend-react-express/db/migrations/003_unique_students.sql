-- Уникальность ключевых полей students: login, email, snils
-- Идемпотентно: ограничение добавляется только если его ещё нет.
-- Пустые/NULL-значения email не конфликтуют (в PostgreSQL несколько NULL допустимы).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'students'::regclass
      AND c.contype = 'u'
      AND a.attname = 'login'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_login_key UNIQUE (login);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'students'::regclass
      AND c.contype = 'u'
      AND a.attname = 'email'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_email_key UNIQUE (email);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'students'::regclass
      AND c.contype = 'u'
      AND a.attname = 'snils'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_snils_key UNIQUE (snils);
  END IF;
END $$;
