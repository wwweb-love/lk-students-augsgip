const { ok } = require('../utils/response')
const ApiError = require('../utils/ApiError')
const curriculumModel = require('../models/curriculum.model')

// GET /api/curriculum — учебный план группы авторизованного пользователя
// Группа берётся из req.user (токен), а не из query — студент видит только свой план.
const getMyCurriculum = async (req, res) => {
  const groupName = req.user.group_name
  if (!groupName) {
    throw ApiError.notFound('У вашего профиля не указана группа')
  }

  const row = await curriculumModel.findByGroup(groupName)
  if (!row) {
    throw ApiError.notFound(`Учебный план для группы «${groupName}» не найден`)
  }

  const disciplines = (Array.isArray(row.disciplines) ? row.disciplines : [])
    // строки с пустым названием — служебные итоги выгрузки из 1С, студенту они не нужны
    .filter((d) => String(d?.name || '').trim())
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'))

  console.log(`✅ Учебный план группы ${groupName}: ${disciplines.length} дисциплин`)

  ok(res, {
    plan: {
      group_name: row.group_name,
      course: row.course,
      admission_year: row.admission_year,
      plan_name: row.plan_name,
      plan_code: row.plan_code,
      specialty: row.specialty,
      qualification: row.qualification,
      form: row.form,
      start_year: row.start_year,
      duration_years: row.duration_years,
      synced_at: row.synced_at,
    },
    disciplines,
  })
}

module.exports = { getMyCurriculum }
