-- Учебный план из 1С (синхронизируется раз в час, routes/curriculum.js)
-- Источник: GET http://sql1c-02/college_copy_gun/hs/student_lk/study_plan
-- Структура ответа 1С: массив групп {group_name, course, admission_year, plan{...}, disciplines[{..., by_semester[]}]}
-- Одна строка таблицы = одна группа; дисциплины со семестрами лежат в JSONB.
--
-- Таблица со старой "плоской" схемой была пустой (синхронизация ни разу не проходила) — создаём заново.
DROP TABLE IF EXISTS curriculum_1c CASCADE;

CREATE TABLE IF NOT EXISTS curriculum_1c (
    id               SERIAL PRIMARY KEY,
    group_name       VARCHAR(100)  NOT NULL DEFAULT '',  -- группа, напр. 9С-254
    course           SMALLINT,                           -- курс (NULL, если не заполнен)
    admission_year   SMALLINT,                           -- год поступления
    plan_name        VARCHAR(100)  NOT NULL DEFAULT '',  -- название учебного плана, напр. 08.02.01_9 кл
    plan_code        VARCHAR(20)   NOT NULL DEFAULT '',  -- код плана в 1С, напр. 000000306
    specialty        VARCHAR(200)  NOT NULL DEFAULT '',  -- специальность, напр. Строительство и эксплуатация зданий...
    qualification    VARCHAR(100)  NOT NULL DEFAULT '',  -- квалификация (техник, архитектор и т.п.)
    form             VARCHAR(100)  NOT NULL DEFAULT '',  -- форма обучения (Очная / Заочная / Очно-заочная)
    start_year       SMALLINT,                           -- год начала подготовки (0 = не заполнен в 1С)
    duration_years   SMALLINT,                           -- нормативный срок обучения, лет
    disciplines      JSONB        NOT NULL DEFAULT '[]', -- массив дисциплин 1С с by_semester
    raw              JSONB,                              -- исходная группа целиком из 1С
    synced_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS curriculum_1c_group_idx      ON curriculum_1c (group_name);
CREATE INDEX IF NOT EXISTS curriculum_1c_specialty_idx  ON curriculum_1c (specialty);
CREATE INDEX IF NOT EXISTS curriculum_1c_plan_code_idx  ON curriculum_1c (plan_code);
CREATE INDEX IF NOT EXISTS curriculum_1c_course_idx     ON curriculum_1c (course);
CREATE INDEX IF NOT EXISTS curriculum_1c_disciplines_idx ON curriculum_1c USING gin (disciplines);
