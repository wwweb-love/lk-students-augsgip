// Тест учебного плана (GET /api/curriculum) — npm run test:curriculum
// Проверяет права доступа, состав ответа и что план соответствует группе пользователя.
const { generate } = require('../utils/token')

const BASE = 'http://127.0.0.1:3000'
const adminToken = generate({ id: 1 }) // Roman (Admin)
const studentToken = generate({ id: 3 }) // roman (Student, группа 9С-231)
const emptyGroupToken = generate({ id: 173 }) // Тест Справки (группа не указана)

let passed = 0
let failed = 0

function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ` — ${extra}` : ''}`)
  cond ? passed++ : failed++
}

async function get(path, token = null) {
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

;(async () => {
  // 1-3. Доступ по ролям
  let r = await get('/api/curriculum')
  check('1. GET /curriculum без токена → 401', r.status === 401, `status=${r.status}`)

  r = await get('/api/curriculum', 'abc.def.ghi')
  check('2. GET /curriculum с битым токеном → 401', r.status === 401, `status=${r.status}`)

  // 4-5. План доступен Student и Admin
  r = await get('/api/curriculum', studentToken)
  check('3. GET /curriculum: Student → 200', r.status === 200, `status=${r.status}`)

  r = await get('/api/curriculum', adminToken)
  check('4. GET /curriculum: Admin → 200', r.status === 200, `status=${r.status}`)

  // 6. Состав ответа: план + дисциплины
  r = await get('/api/curriculum', studentToken)
  const data = r.json?.data
  const plan = data?.plan
  const disciplines = data?.disciplines
  const shapeOk =
    !!plan &&
    typeof plan.group_name === 'string' &&
    typeof plan.specialty === 'string' &&
    Array.isArray(disciplines) &&
    disciplines.length > 0 &&
    disciplines.every(
      (d) =>
        typeof d.name === 'string' &&
        d.name.trim() &&
        Array.isArray(d.by_semester) &&
        typeof d.total_hours === 'number'
    )
  check('5. состав ответа (plan + disciplines)', shapeOk,
    `группа=${plan?.group_name}, дисциплин=${disciplines?.length}`)

  // 7. План именно группы авторизованного пользователя
  check('6. план соответствует группе пользователя',
    plan?.group_name === '9С-231', plan?.group_name)

  // 8. Строки-итоги без названия отброшены
  check('7. нет дисциплин с пустым названием',
    disciplines.every((d) => d.name.trim()), `всего=${disciplines.length}`)

  // 9. Дисциплины отсортированы по алфавиту
  const names = disciplines.map((d) => d.name)
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ru'))
  check('8. дисциплины отсортированы по алфавиту',
    JSON.stringify(names) === JSON.stringify(sorted))

  // 10. У пользователя без группы — понятная ошибка
  r = await get('/api/curriculum', emptyGroupToken)
  check('9. группа не указана → 404 с описанием',
    r.status === 404 && String(r.json?.error || '').includes('группа'),
    `status=${r.status}, error=${r.json?.error}`)

  console.log(`\nИтого: ${passed} PASS, ${failed} FAIL`)
  // Не process.exit(): на Windows закрытие keep-alive соединений fetch
  // в момент process.exit() вызывает ассерт libuv. Даём процессу завершиться самому.
  process.exitCode = failed ? 1 : 0
})().catch((e) => {
  console.error('FATAL', e)
  process.exitCode = 1
})
