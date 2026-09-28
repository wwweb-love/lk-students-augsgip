const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();
const { transformSchedules } = require("../transform/transform-schedules");
const cron = require('node-cron');
const { getDateNow } = require("../helpers/date")
const { getDateStartAndDateEnd } = require("../helpers/getDateStartAndDateEnd")

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Функция для получения и сохранения данных
const fetchAndSaveSchedules = async () => {
    try {
        const username = "WebUser_LK";
        const password = "WebUser_LK";
        const authString = Buffer.from(`${username}:${password}`).toString('base64');

        const { year, month, day } = getDateNow()

        const { dateStart, dateEnd } = getDateStartAndDateEnd(`${year}${month}${day}`)
        console.log(`synchronization data - TABLE schedule ${dateStart} - ${dateEnd}`)

        const url = `http://sql1c-02/college_copy_gun/hs/student_lk/schedule/${dateStart}/${dateEnd}`;

        // Получаем данные из 1С
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            }
        });

        // Проверяем статус ответа
        if (!response.ok) {
            throw new Error(`HTTP ошибка! статус: ${response.status} ${response.statusText}`);
        }

        // Проверяем Content-Type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error('Сервер вернул не JSON ответ');
        }

        const rawSchedules = await response.json();
        
        // Трансформируем данные в плоскую структуру (дни -> пара урок)
        const schedules = transformSchedules(rawSchedules);
        
        // Сохраняем в базу данных с удалением только за период
        if (schedules.length > 0) {
            const savedIds = await saveSchedulesWithDelete(schedules, dateStart, dateEnd);
            return { success: true, count: savedIds.length };
        } else {
            return { success: true, count: 0 };
        }

    } catch (err) {
        return { success: false, error: err.message };
    }
};

// Функция: удаление только за период + вставка новых данных
const saveSchedulesWithDelete = async (schedules, dateStart, dateEnd) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Удаляем данные ТОЛЬКО за указанный период
        const deleteResult = await client.query(
            'DELETE FROM schedule WHERE date BETWEEN $1 AND $2;',
            [dateStart, dateEnd]
        );

        // Вставляем новые данные
        if (schedules.length > 0) {
            const values = [];
            const placeholders = [];

            schedules.forEach((item, index) => {
                const offset = index * 7;
                placeholders.push(
                    `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
                );
                values.push(
                    item.date,
                    item.group,
                    item.time,
                    item.subject || 'Не указано',
                    item.room || null,
                    item.type || 'Не указано',
                    item.teacher || 'Не указано'
                );
            });

            const query = `
                INSERT INTO schedule (date, group_name, time, subject, room, type, teacher)
                VALUES ${placeholders.join(', ')}
                RETURNING id;
            `;

            const result = await client.query(query, values);

            await client.query('COMMIT');
            return result.rows.map(row => row.id);
        } else {
            await client.query('COMMIT');
            return [];
        }

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
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