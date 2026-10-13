-- Журнал оценок (успеваемость) из 1С.
-- Таблицу наполняет синхронизатор server-postgress-1c (routes/grades.js, cron каждый час),
-- DDL-источник: server-postgress-1c/sql/grades_1c.sql (дубликат здесь — чтобы бэкенд
-- был самодостаточен при первом развёртывании).
-- Одна строка = одна оценка в журнале студента; связь со студентом — по СНИЛС (11 цифр).
CREATE TABLE IF NOT EXISTS grades_1c (
  id serial PRIMARY KEY,
  snils varchar(11) NOT NULL,               -- СНИЛС без пробелов/дефисов, 11 цифр
  student_name varchar(200) NOT NULL DEFAULT '',
  group_name varchar(100) NOT NULL DEFAULT '',
  discipline varchar(200) NOT NULL,         -- дисциплина, напр. Математика
  semester smallint,                        -- семестр (NULL, если не заполнен)
  date date,                                -- дата итоговой работы
  work_type varchar(100) NOT NULL DEFAULT '', -- Экзамен / Зачёт / ЛР / ПР / КР …
  grade smallint,                           -- 2..5; NULL, если зачёт
  passed boolean,                           -- зачёт (true) / незачёт (false); NULL для 5-балльных
  synced_at timestamptz NOT NULL DEFAULT now()
);

-- 5-балльная оценка только в диапазоне 2..5
ALTER TABLE grades_1c DROP CONSTRAINT IF EXISTS grades_1c_grade_check;
ALTER TABLE grades_1c ADD CONSTRAINT grades_1c_grade_check
  CHECK (grade IS NULL OR grade BETWEEN 2 AND 5);

CREATE INDEX IF NOT EXISTS idx_grades_1c_snils ON grades_1c (snils);
CREATE INDEX IF NOT EXISTS idx_grades_1c_group ON grades_1c (group_name);
CREATE INDEX IF NOT EXISTS idx_grades_1c_discipline ON grades_1c (discipline);
CREATE INDEX IF NOT EXISTS idx_grades_1c_semester ON grades_1c (semester);
