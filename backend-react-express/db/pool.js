const { Pool } = require('pg')
const config = require('../config')

// Единственный пул соединений с PostgreSQL на всё приложение
const pool = new Pool({
  connectionString: config.databaseUrl,
})

/**
 * Выполняет функцию в рамках транзакции.
 * При ошибке — автоматический ROLLBACK, при успехе — COMMIT.
 */
async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { pool, withTransaction }
