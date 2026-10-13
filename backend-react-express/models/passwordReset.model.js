const { pool } = require('../db/pool')

// Создать токен сброса пароля
async function create(userId, token, expiresAt, client = pool) {
  await client.query(
    `INSERT INTO password_resets (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  )
}

// Найти действительный (не использованный и не истёкший) токен + данные пользователя
async function findValid(token, client = pool) {
  const result = await client.query(
    `SELECT pr.id, pr.user_id, pr.expires_at, s.email, s.login, s.name
     FROM password_resets pr
     JOIN students s ON s.id = pr.user_id
     WHERE pr.token = $1 AND pr.used = false AND pr.expires_at > now()`,
    [token]
  )
  return result.rows[0] || null
}

// Отметить токен использованным
async function markUsed(id, client = pool) {
  await client.query('UPDATE password_resets SET used = true WHERE id = $1', [id])
}

// Отозвать все активные токены пользователя (после смены пароля / перед новой ссылкой)
async function invalidateForUser(userId, client = pool) {
  await client.query(
    'UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false',
    [userId]
  )
}

module.exports = { create, findValid, markUsed, invalidateForUser }
