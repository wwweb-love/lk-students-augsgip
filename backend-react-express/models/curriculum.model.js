const { pool } = require('../db/pool')

// Учебный план группы — зеркало выгрузки из 1С (таблица curriculum_1c).
// Одной группе может соответствовать несколько записей (разные годы),
// берём самую свежую (id DESC).
async function findByGroup(groupName, client = pool) {
  const result = await client.query(
    `SELECT
       id,
       group_name,
       course,
       admission_year,
       plan_name,
       plan_code,
       specialty,
       qualification,
       form,
       start_year,
       duration_years,
       disciplines,
       synced_at
     FROM curriculum_1c
     WHERE group_name = $1
     ORDER BY id DESC
     LIMIT 1`,
    [groupName]
  )
  return result.rows[0] || null
}

module.exports = { findByGroup }
