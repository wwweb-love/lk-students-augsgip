const { pool } = require('../db/pool')

// Мессенджер: сообщения между пользователями ЛК (таблица messages).
// Связь с адресатом — по СНИЛС (11 цифр), как во всём проекте (students_1c, grades_1c).

// Нормализация СНИЛС до 11 цифр; null, если цифр не 11
function normalizeSnils(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 11 ? digits : null
}

// Поиск студента по ФИО в ростере из 1С (students_1c).
// Символы LIKE-шаблона (%) экранируем — ищем по подстроке, не по шаблону.
async function searchStudents(query, excludeSnils, client = pool) {
  const escaped = String(query).replace(/[\\%_]/g, (m) => '\\' + m)
  const result = await client.query(
    `SELECT snils, name, group_name
       FROM students_1c
      WHERE snils ~ '^[0-9]{11}$'
        AND name ILIKE '%' || $1 || '%'
        AND ($2::varchar IS NULL OR snils <> $2)
      ORDER BY name
      LIMIT 15`,
    [escaped, excludeSnils]
  )
  return result.rows
}

// Адресат по СНИЛС: ростер 1С или уже зарегистрированный пользователь
async function findRecipient(snils, client = pool) {
  const result = await client.query(
    `(SELECT snils, name, group_name FROM students_1c WHERE snils = $1)
     UNION
     (SELECT snils, name, group_name FROM students WHERE snils = $1)
     LIMIT 1`,
    [snils]
  )
  return result.rows[0] || null
}

// Отправка сообщения; возвращает созданную запись
async function sendMessage(
  { senderId, senderSnils, senderName, recipientSnils, recipientName, body },
  client = pool
) {
  const result = await client.query(
    `INSERT INTO messages
       (sender_id, sender_snils, sender_name, recipient_snils, recipient_name, body)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id,
               body,
               to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at`,
    [
      senderId,
      senderSnils || '',
      String(senderName || '').slice(0, 200),
      recipientSnils,
      String(recipientName || '').slice(0, 200),
      body,
    ]
  )
  return result.rows[0]
}

// Список диалогов текущего пользователя: исходящие (адресат) + входящие (отправитель),
// с последним сообщением и счётчиком непрочитанных.
async function listThreads({ userId, userSnils }, client = pool) {
  const result = await client.query(
    `SELECT
       peer_snils,
       max(peer_name) FILTER (WHERE peer_name <> '') AS peer_name,
       (array_agg(body ORDER BY created_at DESC))[1] AS last_body,
       max(created_at) AS last_at,
       (count(*) FILTER (WHERE incoming AND read_at IS NULL))::int AS unread
     FROM (
       SELECT recipient_snils AS peer_snils,
              recipient_name AS peer_name,
              body,
              created_at,
              NULL::timestamptz AS read_at,
              false AS incoming
         FROM messages
        WHERE sender_id = $1
       UNION ALL
       SELECT sender_snils, sender_name, body, created_at, read_at, true
         FROM messages
        WHERE recipient_snils = $2 AND sender_snils <> $2
     ) t
     GROUP BY peer_snils
     ORDER BY max(created_at) DESC`,
    [userId, userSnils || '']
  )
  return result.rows
}

// Переписка двух участников (от меня к адресату + от адресата ко мне)
async function listThread({ userId, userSnils, peerSnils }, client = pool) {
  const result = await client.query(
    `SELECT
       id,
       CASE WHEN sender_id = $1 THEN 'out' ELSE 'in' END AS direction,
       body,
       to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
       (read_at IS NOT NULL) AS read
     FROM messages
      WHERE (sender_id = $1 AND recipient_snils = $3)
         OR (recipient_snils = $2 AND sender_snils = $3)
     ORDER BY created_at, id`,
    [userId, userSnils || '', peerSnils]
  )
  return result.rows
}

// Отметить входящие из диалога прочитанными; возвращает количество
async function markThreadRead({ userSnils, peerSnils }, client = pool) {
  const result = await client.query(
    `UPDATE messages
        SET read_at = now()
      WHERE recipient_snils = $1
        AND sender_snils = $2
        AND read_at IS NULL`,
    [userSnils || '', peerSnils]
  )
  return result.rowCount
}

module.exports = {
  normalizeSnils,
  searchStudents,
  findRecipient,
  sendMessage,
  listThreads,
  listThread,
  markThreadRead,
}
