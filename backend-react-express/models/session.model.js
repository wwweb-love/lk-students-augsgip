const { pool } = require('../db/pool')

// Зафиксировать вход: создать запись сессии (sid приходит внутри JWT)
async function create({ userId, sid, ip, userAgent }, client = pool) {
  await client.query(
    `INSERT INTO sessions (user_id, sid, ip, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, sid, ip || null, String(userAgent || '').slice(0, 255) || null]
  )
}

// «Последняя активность» — обновляется не чаще раза в минуту (условие в SQL,
// запрос выполняется вне основного потока и не тормозит ответ)
async function touch(sid, client = pool) {
  await client.query(
    `UPDATE sessions SET last_seen = now()
     WHERE sid = $1 AND ended_at IS NULL AND last_seen < now() - interval '60 seconds'`,
    [sid]
  )
}

// Завершить сессию при выходе
async function close(sid, client = pool) {
  await client.query(
    `UPDATE sessions SET ended_at = now() WHERE sid = $1 AND ended_at IS NULL`,
    [sid]
  )
}

module.exports = { create, touch, close }
