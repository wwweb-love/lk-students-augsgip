const ApiError = require('./ApiError')

const DATE_RE = /^\d{8}$/

function formatYmd(date) {
  return (
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0')
  )
}

// Разбирает параметр ?date=YYYYMMDD в объект Date (с валидацией)
function parseDateParam(date) {
  if (!date) {
    throw ApiError.badRequest('Параметр date обязателен. Пример: ?date=20260804')
  }
  if (!DATE_RE.test(date)) {
    throw ApiError.badRequest('Неверный формат date. Пример: ?date=20260804')
  }

  const year = parseInt(date.slice(0, 4), 10)
  const month = parseInt(date.slice(4, 6), 10)
  const day = parseInt(date.slice(6, 8), 10)

  const target = new Date(year, month - 1, day)
  if (target.getFullYear() !== year || target.getMonth() !== month - 1 || target.getDate() !== day) {
    throw ApiError.badRequest('Некорректная дата. Пример: ?date=20260804')
  }

  return target
}

// Границы недели (пн–вс) для любой даты, в формате YYYYMMDD
function getWeekRange(date) {
  const dow = date.getDay() // 0 = воскресенье
  const diffToMonday = dow === 0 ? -6 : 1 - dow

  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return { dateStart: formatYmd(monday), dateEnd: formatYmd(sunday) }
}

// Индекс дня недели по дате YYYYMMDD: 0 = понедельник ... 6 = воскресенье
function dayIndex(dateStr) {
  const d = new Date(
    parseInt(dateStr.slice(0, 4), 10),
    parseInt(dateStr.slice(4, 6), 10) - 1,
    parseInt(dateStr.slice(6, 8), 10)
  )
  return (d.getDay() + 6) % 7
}

module.exports = { parseDateParam, formatYmd, getWeekRange, dayIndex }
