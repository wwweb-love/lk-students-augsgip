const { pool } = require('../db/pool')

const FIELDS = 'id, name, specialty, group_name, login, password, email, snils, role'

// Поля таблицы students_1c (без role — в зеркале 1С ролей нет)
const FIELDS_1C = 'id, name, specialty, group_name, login, password, email, snils'

// Все студенты (без паролей) — для админ-списка
async function findAll(client = pool) {
  const result = await client.query(
    `SELECT id, name, specialty, group_name, login, email, snils, role
     FROM students
     ORDER BY id`
  )
  return result.rows
}

// Поиск студента по id (для middleware авторизации)
async function findById(id, client = pool) {
  const result = await client.query(`SELECT ${FIELDS} FROM students WHERE id = $1`, [id])
  return result.rows[0] || null
}

// Поиск студента по логину (для входа)
async function findByLogin(login, client = pool) {
  const result = await client.query(`SELECT ${FIELDS} FROM students WHERE login = $1`, [login])
  return result.rows[0] || null
}

// Поиск студента, заведённого в 1С, по СНИЛС (для регистрации)
async function findCandidateBySnils(snils, client = pool) {
  const digits = normalizeSnils(snils)
  if (!digits) return null
  const result = await client.query(
    `SELECT ${FIELDS_1C} FROM students_1c WHERE regexp_replace(snils, '\D', '', 'g') = $1`,
    [digits]
  )
  return result.rows[0] || null
}

// Нормализация СНИЛС до 11 цифр; null, если цифр не 11
function normalizeSnils(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 11 ? digits : null
}

// Поиск студента по email (для сброса пароля)
async function findByEmail(email, client = pool) {
  const result = await client.query(
    `SELECT ${FIELDS} FROM students WHERE lower(email) = lower($1)`,
    [email]
  )
  return result.rows[0] || null
}

// Занят ли логин другим пользователем
async function isLoginTaken(login, excludeId, client = pool) {
  const result = await client.query(
    'SELECT id FROM students WHERE login = $1 AND id != $2',
    [login, excludeId]
  )
  return result.rows.length > 0
}

// Занята ли почта другим пользователем
async function isEmailTaken(email, excludeId = null, client = pool) {
  const result = await client.query(
    'SELECT id FROM students WHERE lower(email) = lower($1) AND id != $2',
    [email, excludeId]
  )
  return result.rows.length > 0
}

// Уже есть ли студент с таким СНИЛС (для защиты от повторной регистрации)
// Формат-независимо: сравниваются только цифры
async function findBySnils(snils, client = pool) {
  const digits = normalizeSnils(snils)
  if (!digits) return null
  const result = await client.query(
    `SELECT ${FIELDS} FROM students WHERE regexp_replace(snils, '\D', '', 'g') = $1`,
    [digits]
  )
  return result.rows[0] || null
}

// Обновить пароль (хеш) пользователя
async function setPassword(userId, hashedPassword, client = pool) {
  await client.query('UPDATE students SET password = $1 WHERE id = $2', [
    hashedPassword,
    userId,
  ])
}

// Обновление произвольного набора полей (только из белого списка)
// email: null — разрешает очистить почту
const UPDATABLE = ['name', 'specialty', 'group_name', 'login', 'password', 'email', 'snils', 'role']

async function updateById(id, fields, client = pool) {
  const keys = Object.keys(fields).filter((k) => UPDATABLE.includes(k))
  if (keys.length === 0) return findById(id, client)

  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
  const values = [id, ...keys.map((k) => fields[k])]

  const result = await client.query(
    `UPDATE students SET ${sets} WHERE id = $1 RETURNING ${FIELDS}`,
    values
  )
  return result.rows[0] || null
}

// Удаление пользователя (токены сброса удалятся каскадом)
async function removeById(id, client = pool) {
  const result = await client.query('DELETE FROM students WHERE id = $1', [id])
  return result.rowCount > 0
}

// Создание записи студента (по умолчанию — роль Student)
async function create(student, client = pool) {
  const result = await client.query(
    `INSERT INTO students (name, specialty, group_name, login, password, email, snils, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${FIELDS}`,
    [
      student.name,
      student.specialty,
      student.group_name,
      student.login,
      student.password,
      student.email,
      student.snils,
      student.role || 'Student',
    ]
  )
  return result.rows[0]
}

module.exports = {
  findById,
  findByLogin,
  findByEmail,
  findBySnils,
  findCandidateBySnils,
  normalizeSnils,
  isLoginTaken,
  isEmailTaken,
  create,
  findAll,
  setPassword,
  updateById,
  removeById,
}
