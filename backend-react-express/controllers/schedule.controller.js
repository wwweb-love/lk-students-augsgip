const { ok } = require('../utils/response')
const { parseDateParam, getWeekRange, dayIndex } = require('../utils/week')
const scheduleModel = require('../models/schedule.model')

// GET /api/schedules?date=YYYYMMDD — неделя занятий, сгруппированная по дням [пн..вс]
const getWeek = async (req, res) => {
  const target = parseDateParam(req.query.date)
  const { dateStart, dateEnd } = getWeekRange(target)

  const rows = await scheduleModel.findWeekByGroup(dateStart, dateEnd, req.user.group_name)

  // 7 «корзин»: [пн, вт, ср, чт, пт, сб, вс]
  const week = Array.from({ length: 7 }, () => [])
  for (const row of rows) {
    week[dayIndex(row.date)].push(row)
  }

  console.log(`✅ Расписание за неделю (${dateStart}-${dateEnd}) получено: ${rows.length} пар`)
  ok(res, week)
}

module.exports = { getWeek }
