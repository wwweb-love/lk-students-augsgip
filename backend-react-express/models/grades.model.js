const { pool } = require('../db/pool')

// Журнал оценок (успеваемость) — зеркало выгрузки из 1С (таблица grades_1c).
// Связь со студентом — по СНИЛС: в 1С оценки привязаны к студенту по СНИЛС,
// а в таблице students он хранится в свободном формате («XXX-XXX-XXX XX»),
// поэтому нормализуем до 11 цифр на стороне SQL.

// Нормализация СНИЛС до 11 цифр; null, если цифр не 11
function normalizeSnils(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 11 ? digits : null
}

// Все оценки студента по СНИЛС (фильтры применяет контроллер — сводка считается по всему журналу)
async function findBySnils(snils, client = pool) {
  const result = await client.query(
    `SELECT
       id,
       group_name,
       discipline,
       semester,
       to_char(date, 'YYYY-MM-DD') AS date,
       work_type,
       grade,
       passed,
       synced_at
     FROM grades_1c
     WHERE snils = $1
     ORDER BY
       discipline,
       semester NULLS LAST,
       date NULLS LAST,
       id`,
    [snils]
  )
  return result.rows
}

// Все оценки группы (для Teacher/Admin: ?group=...)
async function findByGroup(groupName, client = pool) {
  const result = await client.query(
    `SELECT
       id,
       snils,
       student_name,
       group_name,
       discipline,
       semester,
       to_char(date, 'YYYY-MM-DD') AS date,
       work_type,
       grade,
       passed,
       synced_at
     FROM grades_1c
     WHERE group_name = $1
     ORDER BY
       student_name,
       discipline,
       semester NULLS LAST,
       date NULLS LAST,
       id`,
    [groupName]
  )
  return result.rows
}

// Сводка успеваемости по журналу: средний балл, распределение 2..5, зачёты
function summarize(rows) {
  const numeric = rows.filter((r) => Number.isInteger(r.grade))
  const passed = rows.filter((r) => r.passed === true).length
  const failed = rows.filter((r) => r.passed === false).length

  const distribution = { 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of numeric) distribution[r.grade] += 1

  const average = numeric.length
    ? Math.round((numeric.reduce((sum, r) => sum + r.grade, 0) / numeric.length) * 100) / 100
    : null

  return {
    total: rows.length,          // всего записей журнала
    numeric: numeric.length,     // из них 5-балльных оценок
    passed,                      // зачётов
    failed,                      // незачётов
    average,                     // средний балл (2 знака) или null
    distribution,                // { 2, 3, 4, 5 }
  }
}

module.exports = { normalizeSnils, findBySnils, findByGroup, summarize }
