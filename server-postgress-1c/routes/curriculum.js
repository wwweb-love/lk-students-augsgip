const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();
const cron = require('node-cron');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Метод HTTP-сервиса 1С student_lk: все группы с полными учебными планами
const ONEC_CURRICULUM_URL = process.env.ONEC_CURRICULUM_URL
    || 'http://sql1c-02/college_copy_gun/hs/student_lk/study_plan';

// Нормализация значений: '', null, undefined, мусор -> null
const asInt = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
};

const asText = (value) => (value === null || value === undefined ? '' : String(value));

// Плоская шапка группы (колонки таблицы); дисциплины уходят в JSONB
const planHeader = (group) => ({
    group_name: asText(group.group_name),
    course: asInt(group.course),
    admission_year: asInt(group.admission_year),
    plan_name: asText(group.plan && group.plan.name),
    plan_code: asText(group.plan && group.plan.code),
    specialty: asText(group.plan && group.plan.specialty),
    qualification: asText(group.plan && group.plan.qualification),
    form: asText(group.plan && group.plan.form),
    start_year: asInt(group.plan && group.plan.start_year),
    duration_years: asInt(group.plan && group.plan.duration_years),
    disciplines: Array.isArray(group.disciplines) ? group.disciplines : [],
    raw: group,
});

const fetchAndSaveCurriculum = async () => {
    console.log(`[${new Date().toISOString()}] Синхронизация учебного плана...`);

    try {
        const username = process.env.ONEC_USER;
        const password = process.env.ONEC_PASSWORD;
        const authString = Buffer.from(`${username}:${password}`).toString('base64');

        const response = await fetch(ONEC_CURRICULUM_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
        }

        const groups = await response.json();

        if (!Array.isArray(groups)) {
            throw new Error('Ожидался массив групп учебного плана');
        }

        if (groups.length === 0) {
            console.log('Нет данных учебного плана для синхронизации');
            return { success: true, count: 0 };
        }

        const rows = groups
            .filter(g => g && asText(g.group_name) !== '')
            .map(planHeader);

        if (rows.length === 0) {
            throw new Error('В ответе 1С нет ни одной группы с именем');
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            await client.query('TRUNCATE TABLE curriculum_1c RESTART IDENTITY;');

            // Один многострочный INSERT (все строки за раз)
            const values = [];
            const placeholders = rows.map((r, i) => {
                const base = i * 12;
                values.push(
                    r.group_name,
                    r.course,
                    r.admission_year,
                    r.plan_name,
                    r.plan_code,
                    r.specialty,
                    r.qualification,
                    r.form,
                    r.start_year,
                    r.duration_years,
                    JSON.stringify(r.disciplines),
                    JSON.stringify(r.raw),
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6},
                         $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}::jsonb, $${base + 12}::jsonb)`;
            });

            await client.query(`
                INSERT INTO curriculum_1c (
                    group_name, course, admission_year,
                    plan_name, plan_code, specialty, qualification, form,
                    start_year, duration_years, disciplines, raw
                )
                VALUES ${placeholders.join(', ')}
            `, values);

            await client.query('COMMIT');

            console.log(`✅ Синхронизация учебного плана завершена: ${rows.length} групп`);
            return { success: true, count: rows.length };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('❌ Ошибка синхронизации учебного плана:', err.message);
        return { success: false, error: err.message };
    }
};

// Cron-задача: каждый час (0-й минуты), часовой пояс Москвы
cron.schedule('0 * * * *', fetchAndSaveCurriculum, {
    timezone: "Europe/Moscow"
});

// GET /api/curriculum/sync — ручной запуск синхронизации из 1С
router.get('/sync', async (req, res) => {
    const result = await fetchAndSaveCurriculum();

    if (result.success) {
        res.status(200).json({
            message: `Синхронизация завершена: ${result.count} групп`,
            count: result.count,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/curriculum — список групп с планом (без тяжёлых дисциплин)
// Параметры: ?specialty=...&course=...&q=... (поиск по названию группы)
router.get('/', async (req, res) => {
    try {
        const { specialty, course, q } = req.query;
        const where = [];
        const params = [];

        if (specialty) {
            params.push(`%${specialty}%`);
            where.push(`specialty ILIKE $${params.length}`);
        }
        if (course) {
            const c = asInt(course);
            if (c === null) {
                return res.status(400).json({ error: 'Параметр course должен быть числом' });
            }
            params.push(c);
            where.push(`course = $${params.length}`);
        }
        if (q) {
            params.push(`%${q}%`);
            where.push(`group_name ILIKE $${params.length}`);
        }

        const sql = `
            SELECT id, group_name, course, admission_year,
                   plan_name, plan_code, specialty, qualification, form,
                   start_year, duration_years,
                   jsonb_array_length(disciplines) AS disciplines_count,
                   synced_at
            FROM curriculum_1c
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY group_name
        `;

        const { rows } = await pool.query(sql, params);

        res.status(200).json({
            count: rows.length,
            items: rows,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Ошибка чтения учебного плана:', err.message);
        res.status(500).json({ error: err.message, timestamp: new Date().toISOString() });
    }
});

// GET /api/curriculum/:group — полный план одной группы (включая дисциплины и семестры)
router.get('/:group', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, group_name, course, admission_year,
                    plan_name, plan_code, specialty, qualification, form,
                    start_year, duration_years, disciplines, raw, synced_at
             FROM curriculum_1c
             WHERE group_name = $1`,
            [req.params.group]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: `Группа не найдена: ${req.params.group}`,
                timestamp: new Date().toISOString()
            });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('❌ Ошибка чтения плана группы:', err.message);
        res.status(500).json({ error: err.message, timestamp: new Date().toISOString() });
    }
});

module.exports = router;
module.exports.fetchAndSaveCurriculum = fetchAndSaveCurriculum;
