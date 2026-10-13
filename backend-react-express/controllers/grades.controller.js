const ApiError = require('../utils/ApiError')
const { ok } = require('../utils/response')
const gradesModel = require('../models/grades.model')

// GET /api/grades — журнал оценок (успеваемость) авторизованного пользователя.
// Студент видит только свои оценки (по своему СНИЛС из токена).
// Teacher/Admin могут запросить чужие журналы: ?snils=... или ?group=... (для проверки).
// Фильтры журнала: ?semester=2&discipline=матем (влияют только на список, не на сводку).
const getMyGrades = async (req, res) => {
  const semesterRaw = req.query.semester
  const semester = semesterRaw === undefined || semesterRaw === '' ? null : Number(semesterRaw)
  if (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 12)) {
    throw ApiError.badRequest('Параметр semester должен быть числом от 1 до 12')
  }
  const discipline = String(req.query.discipline || '').trim() || null

  const wantsForeign = req.query.snils || req.query.group
  if (wantsForeign) {
    const isPrivileged = ['Admin', 'Teacher'].includes(String(req.user.role))
    if (!isPrivileged) throw ApiError.forbidden('Смотреть чужие оценки может только преподаватель или администратор')
  }

  // Кого показываем: по умолчанию — самого себя
  let rows
  if (req.query.group) {
    rows = await gradesModel.findByGroup(String(req.query.group).trim())
  } else {
    const snils = req.query.snils
      ? gradesModel.normalizeSnils(req.query.snils)
      : gradesModel.normalizeSnils(req.user.snils)

    // У профиля нет СНИЛС — оценки не сопоставимы: пустой журнал, не ошибка
    rows = snils ? await gradesModel.findBySnils(snils) : []
  }

  // Сводка — по всему журналу без фильтров, чтобы «средний балл» не плавал при фильтрации.
  // Список — с учётом фильтров.
  const filtered = filterRows(rows, { semester, discipline })

  ok(res, {
    grades: filtered,
    summary: gradesModel.summarize(rows),
    synced_at: rows[0]?.synced_at || null,
  })
}

// Клиентская фильтрация журнала: семестр (точное совпадение) + поиск по дисциплине
function filterRows(rows, { semester, discipline }) {
  return rows.filter((r) => {
    if (semester !== null && Number(r.semester) !== semester) return false
    if (discipline && !String(r.discipline).toLowerCase().includes(discipline.toLowerCase())) return false
    return true
  })
}

module.exports = { getMyGrades }
