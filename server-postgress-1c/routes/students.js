const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();
const cron = require('node-cron');
const getStudents = require("../api/get-students")

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Функция для получения и сохранения данных студентов
const fetchAndSaveStudents = async () => {
    console.log(`[${new Date().toISOString()}] Синхронизация студентов...`);

    try {
        const username = process.env.ONEC_USER;
        const password = process.env.ONEC_PASSWORD;
        const authString = Buffer.from(`${username}:${password}`).toString('base64');

        const response = await getStudents(authString);

        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
        }

        const students = await response.json();

        if (!students || students.length === 0) {
            console.log('Нет данных для синхронизации');
            return { success: true, count: 0 };
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Полная очистка таблицы со сбросом счётчика id
            await client.query('TRUNCATE TABLE students_1c RESTART IDENTITY;');

            // Один многострочный INSERT
            const values = [];
            const placeholders = students.map((s, i) => {
                const base = i * 7;
                values.push(
                    s.name || '',
                    s.specialty || '',
                    s.group_name || '',
                    s.login || '',
                    s.password || '',
                    s.email || '',
                    s.snils.replaceAll(" ", "").replaceAll("-", "") || ''
                );
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
            });

            await client.query(`
                INSERT INTO students_1c (name, specialty, group_name, login, password, email, snils)
                VALUES ${placeholders.join(', ')}
            `, values);

            await client.query('COMMIT');

            const insertedCount = students.length;
            console.log(`✅ Синхронизация завершена: ${insertedCount} студентов`);
            return { success: true, count: insertedCount };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('❌ Ошибка синхронизации:', err.message);
        return { success: false, error: err.message };
    }
};

// Cron-задача: каждый час
cron.schedule('0 * * * *', fetchAndSaveStudents, {
    timezone: "Europe/Moscow"
});

// GET запрос для ручного запуска
router.get('/', async (req, res) => {
    const result = await fetchAndSaveStudents();

    if (result.success) {
        res.status(200).json({
            message: `Синхронизация завершена: ${result.count} студентов`,
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

module.exports = router;