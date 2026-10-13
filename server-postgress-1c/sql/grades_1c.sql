-- Журнал оценок (успеваемость) из 1С (синхронизируется раз в час, routes/grades.js)
-- Источник: GET http://sql1c-02/college_copy_gun/hs/student_lk/grades
-- Структура ответа 1С: массив студентов
--   {snils, student_name, group_name, grades:[{discipline, semester, date, work_type, grade, passed}]}
-- Одна строка таблицы = одна оценка в журнале студента.
--
-- Оценка хранится в двух взаимоисключающих видах:
--   grade  = 2..5  — 5-балльная оценка (passed = NULL);
--   grade  = NULL  — зачёт: passed = true/false (зачёт / незачёт).
-- Связь со студентом — по СНИЛС (11 цифр), как в students_1c.

CREATE TABLE IF NOT EXISTS grades_1c (
    id           SERIAL PRIMARY KEY,
    snils        VARCHAR(11)  NOT NULL,             -- СНИЛС без пробелов/дефисов, 11 цифр
    student_name VARCHAR(200) NOT NULL DEFAULT '',  -- ФИО на момент выгрузки (для отладки)
    group_name   VARCHAR(100) NOT NULL DEFAULT '',  -- группа, напр. 9С-254
    discipline   VARCHAR(200) NOT NULL,             -- дисциплина, напр. Математика
    semester     SMALLINT,                          -- семестр (NULL, если не заполнен)
    date         DATE,                              -- дата итоговой работы (экзамена/зачёта)
    work_type    VARCHAR(100) NOT NULL DEFAULT '',  -- вид работы: Экзамен / Зачёт / ЛР / ПР / КР …
    grade        SMALLINT,                          -- 2..5, NULL для зачётов
    passed       BOOLEAN,                           -- зачёт (true) / незачёт (false); NULL для 5-балльных
    synced_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Проверка диапазона оценки и взаимоисключения grade/passed
ALTER TABLE grades_1c DROP CONSTRAINT IF EXISTS grades_1c_grade_check;
ALTER TABLE grades_1c ADD CONSTRAINT grades_1c_grade_check
    CHECK (grade IS NULL OR grade BETWEEN 2 AND 5);

CREATE INDEX IF NOT EXISTS grades_1c_snils_idx     ON grades_1c (snils);
CREATE INDEX IF NOT EXISTS grades_1c_group_idx     ON grades_1c (group_name);
CREATE INDEX IF NOT EXISTS grades_1c_discipline_idx ON grades_1c (discipline);
CREATE INDEX IF NOT EXISTS grades_1c_semester_idx  ON grades_1c (semester);
