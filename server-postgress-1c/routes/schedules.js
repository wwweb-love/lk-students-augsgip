const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();
const { transformSchedules } = require("../transform/transform-schedules");
const cron = require('node-cron');
const { getDateNow } = require("../helpers/date")
const { getDateStartAndDateEndYear } = require("../helpers/getDateStartAndDateEndYear")

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const fetchAndSaveSchedules = async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const username = process.env.ONEC_USER;
        const password = process.env.ONEC_PASSWORD;
        const authString = Buffer.from(`${username}:${password}`).toString('base64');

        const { year, month, day } = getDateNow();
        const { dateStart, dateEnd } = getDateStartAndDateEndYear(year, month, day);

        const url = `http://sql1c-02/college_copy_gun/hs/student_lk/schedule/${dateStart}/${dateEnd}`;

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            throw new Error(`1C request failed: ${res.status} ${res.statusText}`);
        }

        const response = await res.json();

        await client.query('TRUNCATE TABLE schedule_1c RESTART IDENTITY;');
        console.log(`✅ Синхронизация начата: ${response.length} пар`);

        if (response.length) {
            await client.query(`
                INSERT INTO schedule_1c (date, group_name, time_start, time_end, subject, teacher, room, type)
                SELECT * FROM UNNEST(
                    $1::text[], $2::text[], $3::time[], $4::time[],
                    $5::text[], $6::text[], $7::text[], $8::text[]
                )
            `, [
                response.map(r => r.date),
                response.map(r => r.group_name),
                response.map(r => r.time_start || null),
                response.map(r => r.time_end || null),
                response.map(r => r.subject),
                response.map(r => r.teacher),
                response.map(r => r.room),
                response.map(r => r.type),
            ]);
        }

        await client.query('COMMIT');
        console.log(`✅ Синхронизация завершена: ${response.length} пар`);

        return { success: true, count: response.length };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('fetchAndSaveSchedules error:', err);
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
};

// Настройка cron-задачи: каждый час с 7:00 до 20:00
cron.schedule('0 7-20 * * *', async () => {
    await fetchAndSaveSchedules();
}, {
    timezone: "Europe/Moscow"
});

// GET запрос
router.get('/', async (req, res) => {
    try {
        const result = await fetchAndSaveSchedules();

        if (result.success) {
            res.status(200).json({
                message: `Успешно сохранено ${result.count} записей`,
                count: result.count
            });
        } else {
            res.status(500).json({
                error: result.error,
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        res.status(500).json({
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;