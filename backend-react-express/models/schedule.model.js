const { pool } = require('../db/pool')

// Занятия группы за неделю (dateStart/dateEnd — YYYYMMDD)
async function findWeekByGroup(dateStart, dateEnd, groupName, client = pool) {
  const result = await client.query(
    `SELECT
       date,
       group_name,
       time_start,
       time_end,
       subject,
       teacher,
       room,
       type
     FROM schedule_1c
     WHERE date BETWEEN $1 AND $2 AND group_name = $3
     ORDER BY date, time_start`,
    [dateStart, dateEnd, groupName]
  )
  return result.rows
}

module.exports = { findWeekByGroup }
