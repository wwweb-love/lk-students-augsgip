const { pool, withTransaction } = require('../db/pool')
const ApiError = require('../utils/ApiError')

// Общий лимит документов одного пользователя — 100 МБ (в байтах)
const MAX_TOTAL_BYTES = 100 * 1024 * 1024

// Список документов (без самих байтов — тяжёлые колонки не тащим в список)
// и суммарный размер для индикатора квоты
async function listByUser(userId, client = pool) {
  const docs = await client.query(
    `SELECT id, filename, mime_type, size_bytes, uploaded_at
       FROM portfolio_documents
      WHERE user_id = $1
      ORDER BY uploaded_at DESC, id DESC`,
    [userId]
  )
  const agg = await client.query(
    `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS total
       FROM portfolio_documents
      WHERE user_id = $1`,
    [userId]
  )
  return { documents: docs.rows, totalBytes: Number(agg.rows[0].total) }
}

// Загрузка с проверкой квоты. Вся проверка — в транзакции под блокировкой
// строки пользователя: параллельные загрузки считают квоту строго по очереди,
// и две одновременные загрузки не проскочат лимит в 100 МБ.
async function createWithQuota({ userId, filename, mimeType, data }) {
  return withTransaction(async (client) => {
    await client.query('SELECT id FROM students WHERE id = $1 FOR UPDATE', [userId])

    const agg = await client.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS total
         FROM portfolio_documents
        WHERE user_id = $1`,
      [userId]
    )
    const used = Number(agg.rows[0].total)

    if (used + data.length > MAX_TOTAL_BYTES) {
      const leftMb = ((MAX_TOTAL_BYTES - used) / (1024 * 1024)).toFixed(1)
      throw ApiError.badRequest(
        `Превышен лимит 100 МБ на документы. Свободно ${leftMb} МБ — удалите лишние файлы`
      )
    }

    const { rows } = await client.query(
      `INSERT INTO portfolio_documents (user_id, filename, mime_type, size_bytes, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, filename, mime_type, size_bytes, uploaded_at`,
      [userId, filename, mimeType, data.length, data]
    )
    return { document: rows[0], totalBytes: used + data.length }
  })
}

// Один документ для скачивания — только если он принадлежит пользователю
async function findByIdForUser(id, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, filename, mime_type, size_bytes, data, uploaded_at
       FROM portfolio_documents
      WHERE id = $1 AND user_id = $2`,
    [id, userId]
  )
  return rows[0] || null
}

// Удаление своего документа; чужие не удаляются (user_id в условии)
async function remove(id, userId, client = pool) {
  const { rows } = await client.query(
    `DELETE FROM portfolio_documents
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [id, userId]
  )
  return rows[0] || null
}

module.exports = { MAX_TOTAL_BYTES, listByUser, createWithQuota, findByIdForUser, remove }
