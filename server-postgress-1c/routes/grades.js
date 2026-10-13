const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();
const cron = require('node-cron');
const getGrades1C = require("../api/get-grades")

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Нормализация значений выгрузки: '', null, undefined, мусор -> null
const asInt = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
};

const asText = (value) => (value === null || value === undefined ? '' : String(value).trim());

// Оценка: только целые 2..5, иначе null (зачёт)
const asGrade = (value) => {
    const n = asInt(value);
    return n !== null && n >= 2 && n <= 5 ? n : null;
};

// Зачёт: true/false/строки «зачёт»/«незачёт», иначе null
const asPassed = (value) => {
    if (value === true || value === false) return value;
    const t = asText(value).toLowerCase();
    if (['зачёт', 'зачет', 'true', '1', 'сдан', 'sd'].includes(t)) return true;
    if (['незачёт', 'незачет', 'не зачёт', 'false', '0', 'нс'].includes(t)) return false;
    return null;
};

// Дата 'YYYY-MM-DD' (допускаем 'ДД.ММ.ГГГГ'); мусор -> null
const asDate = (value) => {
    const t = asText(value);
    if (!t) return null;
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = m ? `${m[1]}-${m[2]}-${m[3]}` : t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
        ? `${t.slice(6)}-${t.slice(3, 5)}-${t.slice(0, 2)}` : null;
    return d && !Number.isNaN(Date.parse(d)) ? d : null;
};

// СНИЛС: ровно 11 цифр (форматы «XXX-XXX-XXX XX» и «XXX XXX XXX XX» -> 11 цифр)
const asSnils = (value) => {
    const digits = asText(value).replace(/\D/g, '');
    return digits.length === 11 ? digits : null;
};

// Разворачиваем {студент ->[]} в плоский массив строк журнала
const flattenGrades = (students) => {
    const rows = [];
    for (const s of students) {
        const snils = asSnils(s && s.snils);
        if (!snils) continue; // без СНИЛС студента не сопоставить — пропускаем

        for (const g of (Array.isArray(s.grades) ? s.grades : [])) {
            const discipline = asText(g && g.discipline);
            if (!discipline) continue; // без дисциплины строка бессмысленна

            const grade = asGrade(g.grade);
            const passed = asPassed(g.passed);
            // Оценка обязана быть хоть в каком-то виде: 2..5 или зачёт/незачёт
            if (grade === null && passed === null) continue;

            rows.push({
                snils,
                student_name: asText(s.student_name || s.name),
                group_name: asText(s.group_name),
                discipline,
                semester: asInt(g.semester),
                date: asDate(g.date),
                work_type: asText(g.work_type || g.workType),
                grade,
                passed,
            });
        }
    }
    return rows;
};

// Функция получения и сохранения журнала оценок
const fetchAndSaveGrades = async () => {
    console.log(`[${new Date().toISOString()}] Синхронизация оценок...`);

    try {
        const username = process.env.ONEC_USER;
        const password = process.env.ONEC_PASSWORD;
        const authString = Buffer.from(`${username}:${password}`).toString('base64');

        const response = await getGrades1C(authString);

        // Мягкий 404: в 1С ещё не добавлен метод /grades — не считаем ошибкой,
        // просто ждём, пока обработчик (1c-grades-handler.txt) будет загружен в 1С
        if (response.status === 404) {
            console.log('⚠️ 1С не отдаёт /hs/student_lk/grades (404): обработчик GradesGET ещё не добавлен в HTTP-сервис student_lk. Синхронизация оценок пропущена.');
            return { success: false, skipped: true, error: 'В 1С не добавлен метод /grades (см. 1c-grades-handler.txt)' };
        }

        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
        }

        const students = await response.json();

        if (!Array.isArray(students)) {
            throw new Error('Ожидался массив студентов с полем grades');
        }

        const rows = flattenGrades(students);

        if (rows.length === 0) {
            console.log('Нет данных оценок для синхронизации');
            return { success: true, count: 0 };
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Полная очистка: журнал — снимок выгрузки, как у students_1c
            await client.query('TRUNCATE TABLE grades_1c RESTART IDENTITY;');

            // Один многострочный INSERT через UNNEST (массово, без цикла round-trip)
            await client.query(`
                INSERT INTO grades_1c (snils, student_name, group_name, discipline, semester, date, work_type, grade, passed)
                SELECT * FROM UNNEST(
                    $1::text[], $2::text[], $3::text[], $4::text[],
                    $5::smallint[], $6::date[], $7::text[], $8::smallint[], $9::boolean[]
                )
            `, [
                rows.map(r => r.snils),
                rows.map(r => r.student_name),
                rows.map(r => r.group_name),
                rows.map(r => r.discipline),
                rows.map(r => r.semester),
                rows.map(r => r.date),
                rows.map(r => r.work_type),
                rows.map(r => r.grade),
                rows.map(r => r.passed),
            ]);

            await client.query('COMMIT');

            const studentsCount = new Set(rows.map(r => r.snils)).size;
            console.log(`✅ Синхронизация оценок завершена: ${rows.length} записей у ${studentsCount} студентов`);
            return { success: true, count: rows.length };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('❌ Ошибка синхронизации оценок:', err.message);
        return { success: false, error: err.message };
    }
};

// Cron-задача: каждый час
cron.schedule('0 * * * *', fetchAndSaveGrades, {
    timezone: "Europe/Moscow"
});

// GET запрос для ручного запуска
router.get('/sync', async (req, res) => {
    const result = await fetchAndSaveGrades();

    if (result.success) {
        res.status(200).json({
            message: `Синхронизация оценок завершена: ${result.count} записей`,
            count: result.count,
            timestamp: new Date().toISOString()
        });
    } else {
        // 503: 1С метод не добавил или сеть недоступна — фронт/админ увидит причину
        res.status(result.skipped ? 503 : 500).json({
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/grades — журнал из БД (для отладки; параметры: ?group=...&snils=...)
router.get('/', async (req, res) => {
    try {
        const { group, snils } = req.query;
        const where = [];
        const params = [];

        if (group) {
            params.push(group);
            where.push(`group_name = $${params.length}`);
        }
        if (snils) {
            params.push(String(snils).replace(/\D/g, ''));
            where.push(`snils = $${params.length}`);
        }

        const sql = `
            SELECT id, snils, student_name, group_name, discipline,
                   semester, to_char(date, 'YYYY-MM-DD') AS date,
                   work_type, grade, passed, synced_at
            FROM grades_1c
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY snils, discipline, semester NULLS LAST, date NULLS LAST, id
            LIMIT 5000
        `;

        const { rows } = await pool.query(sql, params);

        res.status(200).json({
            count: rows.length,
            items: rows,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Ошибка чтения оценок:', err.message);
        res.status(500).json({ error: err.message, timestamp: new Date().toISOString() });
    }
});

module.exports = router;
module.exports.fetchAndSaveGrades = fetchAndSaveGrades;
